from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from backtesting_engine import BacktestingEngine


router = APIRouter(prefix="/backtest", tags=["backtest"])
engine = BacktestingEngine()


@router.get("/strategies")
async def list_backtest_strategies() -> List[Dict[str, str]]:
    return engine.list_strategies()


@router.get("/run/{symbol}")
async def run_backtest(
    symbol: str,
    strategy: str = Query("buy_hold"),
    period: str = Query("1y"),
    interval: str = Query("1d"),
    benchmark: Optional[str] = Query(None),
    initial_capital: float = Query(10000.0, ge=100.0, le=10000000.0),
) -> Dict:
    try:
        return engine.run_backtest(
            symbol=symbol,
            strategy_key=strategy,
            period=period,
            interval=interval,
            benchmark_symbol=benchmark,
            initial_capital=initial_capital,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Backtest error: {exc}") from exc
