from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models import OrderSide, OrderType, SessionLocal
from trading_engine import TradingEngine


router = APIRouter(prefix="/trading", tags=["trading"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class UserCreateRequest(BaseModel):
    name: str = Field(default="Finply User")
    email: str
    initial_balance: float = Field(default=100000.0, gt=0)


class OrderRequest(BaseModel):
    user_id: int
    symbol: str
    order_type: OrderType
    side: OrderSide
    quantity: int = Field(gt=0)
    limit_price: Optional[float] = Field(default=None, gt=0)


class WatchlistRequest(BaseModel):
    user_id: int
    symbol: str


@router.post("/users")
async def create_user(request: UserCreateRequest, db: Session = Depends(get_db)) -> Dict:
    try:
        user = TradingEngine(db).create_user(request.name, request.email, request.initial_balance)
        return {
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "balance": user.balance,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/users/{user_id}")
async def get_user(user_id: int, db: Session = Depends(get_db)) -> Dict:
    try:
        user = TradingEngine(db).get_user(user_id)
        return {
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "balance": user.balance,
            "realized_pnl": user.realized_pnl,
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/orders")
async def place_order(request: OrderRequest, db: Session = Depends(get_db)) -> Dict:
    try:
        return TradingEngine(db).place_order(
            user_id=request.user_id,
            symbol=request.symbol,
            order_type=request.order_type,
            side=request.side,
            quantity=request.quantity,
            limit_price=request.limit_price,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/orders/{order_id}")
async def cancel_order(
    order_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db),
) -> Dict:
    try:
        order = TradingEngine(db).cancel_order(user_id=user_id, order_id=order_id)
        return {"message": "Order cancelled", "order": order}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/portfolio/{user_id}")
async def get_portfolio(user_id: int, db: Session = Depends(get_db)) -> Dict:
    try:
        return TradingEngine(db).get_portfolio(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/orders/{user_id}")
async def get_orders(user_id: int, db: Session = Depends(get_db)) -> List[Dict]:
    try:
        return TradingEngine(db).get_orders(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/trades/{user_id}")
async def get_trades(
    user_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> List[Dict]:
    try:
        return TradingEngine(db).get_trades(user_id, limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/watchlist/{user_id}")
async def get_watchlist(user_id: int, db: Session = Depends(get_db)) -> List[Dict]:
    try:
        return TradingEngine(db).get_watchlist(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/watchlist")
async def add_to_watchlist(request: WatchlistRequest, db: Session = Depends(get_db)) -> Dict:
    try:
        return TradingEngine(db).add_to_watchlist(request.user_id, request.symbol)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/watchlist/{symbol}")
async def remove_from_watchlist(
    symbol: str,
    user_id: int = Query(...),
    db: Session = Depends(get_db),
) -> Dict:
    try:
        TradingEngine(db).remove_from_watchlist(user_id, symbol)
        return {"message": "Removed from watchlist"}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
