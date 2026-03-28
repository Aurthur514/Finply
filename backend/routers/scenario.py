from __future__ import annotations

from typing import Dict, List

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.orm import Session

from models import SessionLocal
from scenario_engine import ScenarioEngine


router = APIRouter(prefix="/scenario", tags=["scenario"])


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/simulate/{symbol}")
async def simulate_scenario(
    symbol: str,
    seed_event: str = Query(..., min_length=5),
    horizon_days: int = Query(30, ge=1, le=365),
    variables: List[str] = Query(default=[]),
) -> Dict:
    db = SessionLocal()
    try:
        return ScenarioEngine(db).simulate(symbol, seed_event, horizon_days, variables)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        db.close()


@router.get("/seeds/{symbol}")
async def get_scenario_seeds(
    symbol: str,
    days: int = Query(3, ge=1, le=7),
) -> Dict:
    db = SessionLocal()
    try:
        return ScenarioEngine(db).suggest_news_scenarios(symbol, days)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        db.close()
