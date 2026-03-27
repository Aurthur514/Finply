import copy
import time
from typing import Dict, Tuple

from fastapi import APIRouter, HTTPException, Query

from models import SessionLocal
from research_engine import ResearchEngine


router = APIRouter(prefix="/research", tags=["research"])
RESEARCH_CACHE_TTL_SECONDS = 180
research_cache: dict[Tuple[str, int], tuple[float, Dict]] = {}


def _get_cached_research(symbol: str, horizon_days: int) -> Dict | None:
    cached = research_cache.get((symbol, horizon_days))
    if not cached:
        return None
    cached_at, payload = cached
    if time.time() - cached_at > RESEARCH_CACHE_TTL_SECONDS:
        research_cache.pop((symbol, horizon_days), None)
        return None
    return copy.deepcopy(payload)


def _store_cached_research(symbol: str, horizon_days: int, payload: Dict) -> Dict:
    research_cache[(symbol, horizon_days)] = (time.time(), copy.deepcopy(payload))
    return payload


@router.get("/{symbol}")
async def get_research_memo(symbol: str, horizon_days: int = Query(30, ge=7, le=180)) -> Dict:
    db = SessionLocal()
    try:
        normalized_symbol = symbol.upper().strip()
        cached = _get_cached_research(normalized_symbol, horizon_days)
        if cached is not None:
            return cached
        payload = ResearchEngine(db).build_research_memo(normalized_symbol, horizon_days=horizon_days)
        return _store_cached_research(normalized_symbol, horizon_days, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Research memo failed: {exc}") from exc
    finally:
        db.close()

