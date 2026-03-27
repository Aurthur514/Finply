from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from market_data import MarketDataService
from models import Order, OrderSide, OrderStatus, OrderType, Position, Trade, User, Watchlist


class TradingEngine:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.market_service = MarketDataService()

    def create_user(self, name: str, email: str, initial_balance: float = 100000.0) -> User:
        existing = self.db.query(User).filter(User.email == email).first()
        if existing:
            return existing

        user = User(name=name, email=email, balance=initial_balance)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_user(self, user_id: int) -> User:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")
        return user

    def place_order(
        self,
        user_id: int,
        symbol: str,
        order_type: OrderType,
        side: OrderSide,
        quantity: int,
        limit_price: Optional[float] = None,
    ) -> Dict[str, Any]:
        if quantity <= 0:
            raise ValueError("Quantity must be greater than zero")

        user = self.get_user(user_id)
        symbol = symbol.upper().strip()
        if not self.market_service.get_quote(symbol):
            raise ValueError(f"{symbol} is not a supported market symbol")

        quote = self._get_quote(symbol)
        market_price = quote["price"]
        execution_price = market_price if order_type == OrderType.MARKET else float(limit_price or 0)

        if order_type == OrderType.LIMIT and not limit_price:
            raise ValueError("Limit price is required for limit orders")

        if side == OrderSide.BUY:
            estimated_cost = execution_price * quantity
            if user.balance < estimated_cost:
                raise ValueError("Insufficient balance")
        else:
            position = self.db.query(Position).filter(
                Position.user_id == user_id,
                Position.symbol == symbol,
            ).first()
            if not position or position.quantity < quantity:
                raise ValueError("Insufficient shares to sell")

        status = self._resolve_order_status(order_type, side, market_price, execution_price)
        order = Order(
            user_id=user_id,
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=execution_price if status == OrderStatus.FILLED else float(limit_price or market_price),
            status=status,
        )
        self.db.add(order)
        self.db.flush()

        trade_payload = None
        if status == OrderStatus.FILLED:
            trade_payload = self._execute_order(user, order, market_price if order_type == OrderType.MARKET else execution_price)

        self.db.commit()
        self.db.refresh(order)

        return {
            "order": self.serialize_order(order),
            "trade": trade_payload,
            "portfolio": self.get_portfolio(user_id),
            "quote": quote,
            "message": "Order executed successfully" if trade_payload else "Limit order is pending",
        }

    def cancel_order(self, user_id: int, order_id: int) -> Dict[str, Any]:
        order = self.db.query(Order).filter(
            Order.id == order_id,
            Order.user_id == user_id,
        ).first()
        if not order:
            raise ValueError("Order not found")
        if order.status != OrderStatus.PENDING:
            raise ValueError("Only pending orders can be cancelled")

        order.status = OrderStatus.CANCELLED
        self.db.commit()
        self.db.refresh(order)
        return self.serialize_order(order)

    def get_portfolio(self, user_id: int) -> Dict[str, Any]:
        user = self.get_user(user_id)
        positions = self.db.query(Position).filter(Position.user_id == user_id).order_by(Position.symbol).all()

        items: List[Dict[str, Any]] = []
        unrealized_pnl = 0.0
        positions_value = 0.0

        for position in positions:
            quote = self._get_quote(position.symbol)
            current_price = quote["price"]
            market_value = current_price * position.quantity
            pnl = (current_price - position.avg_price) * position.quantity
            positions_value += market_value
            unrealized_pnl += pnl
            items.append(
                {
                    "symbol": position.symbol,
                    "quantity": position.quantity,
                    "avg_price": round(position.avg_price, 2),
                    "current_price": round(current_price, 2),
                    "market_value": round(market_value, 2),
                    "unrealized_pnl": round(pnl, 2),
                }
            )

        total_value = user.balance + positions_value
        watchlist_symbols = [item.symbol for item in self.db.query(Watchlist).filter(Watchlist.user_id == user_id).all()]

        return {
            "user_id": user.id,
            "cash_balance": round(user.balance, 2),
            "total_value": round(total_value, 2),
            "positions_value": round(positions_value, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "realized_pnl": round(user.realized_pnl, 2),
            "positions": items,
            "holdings": items,
            "watchlist_symbols": watchlist_symbols,
        }

    def get_orders(self, user_id: int) -> List[Dict[str, Any]]:
        orders = (
            self.db.query(Order)
            .filter(Order.user_id == user_id)
            .order_by(Order.created_at.desc(), Order.id.desc())
            .all()
        )
        return [self.serialize_order(order) for order in orders]

    def get_trades(self, user_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        trades = (
            self.db.query(Trade)
            .filter(Trade.user_id == user_id)
            .order_by(Trade.timestamp.desc(), Trade.id.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": trade.id,
                "order_id": trade.order_id,
                "symbol": trade.symbol,
                "side": trade.side.value,
                "quantity": trade.quantity,
                "price": round(trade.price, 2),
                "total": round(trade.price * trade.quantity, 2),
                "timestamp": trade.timestamp.isoformat(),
            }
            for trade in trades
        ]

    def add_to_watchlist(self, user_id: int, symbol: str) -> Dict[str, Any]:
        self.get_user(user_id)
        symbol = symbol.upper().strip()
        existing = self.db.query(Watchlist).filter(
            Watchlist.user_id == user_id,
            Watchlist.symbol == symbol,
        ).first()
        if existing:
            raise ValueError("Symbol already in watchlist")

        item = Watchlist(user_id=user_id, symbol=symbol)
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return self.serialize_watchlist_item(item)

    def remove_from_watchlist(self, user_id: int, symbol: str) -> None:
        item = self.db.query(Watchlist).filter(
            Watchlist.user_id == user_id,
            Watchlist.symbol == symbol.upper().strip(),
        ).first()
        if not item:
            raise ValueError("Symbol not found in watchlist")
        self.db.delete(item)
        self.db.commit()

    def get_watchlist(self, user_id: int) -> List[Dict[str, Any]]:
        self.get_user(user_id)
        items = self.db.query(Watchlist).filter(Watchlist.user_id == user_id).order_by(Watchlist.created_at.desc()).all()
        return [self.serialize_watchlist_item(item) for item in items]

    def serialize_order(self, order: Order) -> Dict[str, Any]:
        return {
            "id": order.id,
            "user_id": order.user_id,
            "symbol": order.symbol,
            "side": order.side.value,
            "order_type": order.order_type.value,
            "quantity": order.quantity,
            "price": round(order.price, 2),
            "status": order.status.value,
            "created_at": order.created_at.isoformat(),
        }

    def serialize_watchlist_item(self, item: Watchlist) -> Dict[str, Any]:
        quote = self._get_quote(item.symbol)
        return {
            "id": item.id,
            "symbol": item.symbol,
            "price": round(quote["price"], 2),
            "change_percent": quote["change_percent_value"],
            "change_percent_label": quote["change_percent_label"],
            "added_at": item.created_at.isoformat(),
        }

    def _resolve_order_status(
        self,
        order_type: OrderType,
        side: OrderSide,
        market_price: float,
        requested_price: float,
    ) -> OrderStatus:
        if order_type == OrderType.MARKET:
            return OrderStatus.FILLED

        if side == OrderSide.BUY and requested_price >= market_price:
            return OrderStatus.FILLED
        if side == OrderSide.SELL and requested_price <= market_price:
            return OrderStatus.FILLED
        return OrderStatus.PENDING

    def _execute_order(self, user: User, order: Order, execution_price: float) -> Dict[str, Any]:
        trade_value = execution_price * order.quantity

        position = self.db.query(Position).filter(
            Position.user_id == user.id,
            Position.symbol == order.symbol,
        ).first()

        if order.side == OrderSide.BUY:
            user.balance -= trade_value
            if position:
                total_cost = (position.avg_price * position.quantity) + trade_value
                position.quantity += order.quantity
                position.avg_price = total_cost / position.quantity
            else:
                position = Position(
                    user_id=user.id,
                    symbol=order.symbol,
                    quantity=order.quantity,
                    avg_price=execution_price,
                )
                self.db.add(position)
        else:
            if not position or position.quantity < order.quantity:
                raise ValueError("Insufficient shares to sell")
            user.balance += trade_value
            realized = (execution_price - position.avg_price) * order.quantity
            user.realized_pnl += realized
            position.quantity -= order.quantity
            if position.quantity == 0:
                self.db.delete(position)

        order.status = OrderStatus.FILLED
        order.price = execution_price

        trade = Trade(
            order_id=order.id,
            user_id=user.id,
            symbol=order.symbol,
            price=execution_price,
            quantity=order.quantity,
            side=order.side,
        )
        self.db.add(trade)
        self.db.flush()

        return {
            "id": trade.id,
            "order_id": trade.order_id,
            "symbol": trade.symbol,
            "side": trade.side.value,
            "quantity": trade.quantity,
            "price": round(trade.price, 2),
            "total": round(trade.price * trade.quantity, 2),
            "timestamp": trade.timestamp.isoformat() if trade.timestamp else None,
        }

    def _get_quote(self, symbol: str) -> Dict[str, Any]:
        quote = self.market_service.get_quote(symbol)
        if not quote:
            raise ValueError(f"Unable to fetch market price for {symbol}")

        raw_change = quote.get("change_percent", 0)
        if isinstance(raw_change, str):
            raw_change = raw_change.replace("%", "").strip()

        return {
            "symbol": symbol,
            "price": float(quote["price"]),
            "change_percent_value": round(float(raw_change), 2),
            "change_percent_label": f"{round(float(raw_change), 2)}%",
            "source": quote.get("source", "market"),
        }


class PaperTradingEngine:
    def __init__(self, db_session: Session):
        self.engine = TradingEngine(db_session)

    def __getattr__(self, item: str) -> Any:
        return getattr(self.engine, item)
