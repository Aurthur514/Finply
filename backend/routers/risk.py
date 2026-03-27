import random
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from models import SessionLocal
from trading_engine import TradingEngine


router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/simulate/{user_id}")
async def simulate_portfolio_risk(user_id: int, days: int = 252, runs: int = 500) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        portfolio = TradingEngine(db).get_portfolio(user_id)
    except ValueError as exc:
        db.close()
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    base_value = portfolio.get("total_value", 0)
    holdings = portfolio.get("positions", [])

    if base_value == 0 or not holdings:
        db.close()
        return {
            "user_id": user_id,
            "base_value": base_value,
            "simulated_values": [],
            "summary": {
                "mean": base_value,
                "median": base_value,
                "p5": base_value,
                "p95": base_value,
            },
        }

    results = []
    for _ in range(runs):
        value = base_value
        for _ in range(days):
            daily_return = random.normalvariate(0.0002, 0.02)
            value *= 1 + daily_return
        results.append(value)

    db.close()
    results.sort()
    mean_val = sum(results) / len(results)
    median_val = results[len(results) // 2]
    p5 = results[int(len(results) * 0.05)]
    p95 = results[int(len(results) * 0.95)]

    return {
        "user_id": user_id,
        "base_value": base_value,
        "simulated_values": results,
        "summary": {
            "mean": mean_val,
            "median": median_val,
            "p5": p5,
            "p95": p95,
        },
    }
