from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from market_data import MarketDataService
from models import Order, OrderSide, OrderStatus, OrderType, Position, Trade, User, Watchlist


class TradingEngine:
    BASE_FEE_RATE = 0.0008
    MIN_FEE = 1.0
    BASE_SLIPPAGE_RATE = 0.0005
    MAX_SLIPPAGE_RATE = 0.005

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
        requested_price = market_price if order_type == OrderType.MARKET else float(limit_price or 0)

        if order_type == OrderType.LIMIT and not limit_price:
            raise ValueError("Limit price is required for limit orders")

        estimated_execution = self._estimate_execution(symbol, side, requested_price, quantity, order_type)

        if side == OrderSide.BUY:
            estimated_cost = estimated_execution["net_cash"]
            if user.balance < estimated_cost:
                raise ValueError(
                    f"Insufficient balance. Estimated fill requires ${estimated_cost:.2f} including fees and slippage."
                )
        else:
            position = self.db.query(Position).filter(
                Position.user_id == user_id,
                Position.symbol == symbol,
            ).first()
            if not position or position.quantity < quantity:
                raise ValueError("Insufficient shares to sell")

        status = self._resolve_order_status(order_type, side, market_price, requested_price)
        order = Order(
            user_id=user_id,
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=estimated_execution["executed_price"] if status == OrderStatus.FILLED else float(limit_price or market_price),
            requested_price=requested_price,
            executed_price=estimated_execution["executed_price"] if status == OrderStatus.FILLED else 0.0,
            fees=estimated_execution["fees"] if status == OrderStatus.FILLED else 0.0,
            slippage=estimated_execution["slippage_value"] if status == OrderStatus.FILLED else 0.0,
            status=status,
        )
        self.db.add(order)
        self.db.flush()

        trade_payload = None
        if status == OrderStatus.FILLED:
            trade_payload = self._execute_order(user, order, estimated_execution)

        self.db.commit()
        self.db.refresh(order)

        return {
            "order": self.serialize_order(order),
            "trade": trade_payload,
            "portfolio": self.get_portfolio(user_id),
            "quote": quote,
            "message": self._build_order_message(trade_payload) if trade_payload else "Limit order is pending",
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
                "gross_total": round(trade.gross_total, 2),
                "net_total": round(trade.net_total, 2),
                "fees": round(trade.fees, 2),
                "slippage": round(trade.slippage, 2),
                "total": round(trade.net_total, 2),
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
            "requested_price": round(order.requested_price, 2),
            "executed_price": round(order.executed_price, 2),
            "fees": round(order.fees, 2),
            "slippage": round(order.slippage, 2),
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

    def _execute_order(self, user: User, order: Order, execution: Dict[str, float]) -> Dict[str, Any]:
        execution_price = execution["executed_price"]
        gross_value = execution["gross_value"]
        fees = execution["fees"]
        net_cash = execution["net_cash"]
        slippage_value = execution["slippage_value"]

        position = self.db.query(Position).filter(
            Position.user_id == user.id,
            Position.symbol == order.symbol,
        ).first()

        if order.side == OrderSide.BUY:
            user.balance -= net_cash
            if position:
                total_cost = (position.avg_price * position.quantity) + net_cash
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
            user.balance += net_cash
            realized = ((execution_price - position.avg_price) * order.quantity) - fees
            user.realized_pnl += realized
            position.quantity -= order.quantity
            if position.quantity == 0:
                self.db.delete(position)

        order.status = OrderStatus.FILLED
        order.price = execution_price
        order.executed_price = execution_price
        order.fees = fees
        order.slippage = slippage_value

        trade = Trade(
            order_id=order.id,
            user_id=user.id,
            symbol=order.symbol,
            price=execution_price,
            quantity=order.quantity,
            gross_total=gross_value,
            net_total=net_cash,
            fees=fees,
            slippage=slippage_value,
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
            "gross_total": round(trade.gross_total, 2),
            "net_total": round(trade.net_total, 2),
            "fees": round(trade.fees, 2),
            "slippage": round(trade.slippage, 2),
            "total": round(trade.net_total, 2),
            "timestamp": trade.timestamp.isoformat() if trade.timestamp else None,
        }

    def _estimate_execution(
        self,
        symbol: str,
        side: OrderSide,
        reference_price: float,
        quantity: int,
        order_type: OrderType,
    ) -> Dict[str, float]:
        quote = self.market_service.get_quote(symbol) or {}
        daily_move = quote.get("change_percent")
        if isinstance(daily_move, str):
            daily_move = daily_move.replace("%", "").strip()
        try:
            daily_move_value = abs(float(daily_move or 0.0))
        except (TypeError, ValueError):
            daily_move_value = 0.0

        size_component = min(quantity / 5000, 1.0)
        volatility_component = min(daily_move_value / 8.0, 1.0)
        slippage_rate = self.BASE_SLIPPAGE_RATE + (size_component * 0.0025) + (volatility_component * 0.0015)
        if order_type == OrderType.LIMIT:
            slippage_rate *= 0.45
        slippage_rate = min(slippage_rate, self.MAX_SLIPPAGE_RATE)

        executed_price = reference_price * (1 + slippage_rate if side == OrderSide.BUY else 1 - slippage_rate)
        gross_value = executed_price * quantity
        fees = max(self.MIN_FEE, gross_value * self.BASE_FEE_RATE)
        slippage_value = abs(executed_price - reference_price) * quantity
        net_cash = gross_value + fees if side == OrderSide.BUY else gross_value - fees

        return {
            "reference_price": reference_price,
            "executed_price": executed_price,
            "gross_value": gross_value,
            "fees": fees,
            "slippage_rate": slippage_rate,
            "slippage_value": slippage_value,
            "net_cash": net_cash,
        }

    def _build_order_message(self, trade_payload: Optional[Dict[str, Any]]) -> str:
        if not trade_payload:
            return "Limit order is pending"
        return (
            f"Order executed at ${trade_payload['price']:.2f}. "
            f"Fees: ${trade_payload['fees']:.2f}, slippage impact: ${trade_payload['slippage']:.2f}."
        )

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
