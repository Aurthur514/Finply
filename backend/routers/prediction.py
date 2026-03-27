import copy
import time
from typing import Dict, Tuple

from fastapi import APIRouter, HTTPException

from market_data import MarketDataService
from models import SessionLocal
from recommendation_engine import RecommendationEngine

router = APIRouter(prefix="/predictions", tags=["predictions"])
market_service = MarketDataService()
PREDICTION_CACHE_TTL_SECONDS = 120
prediction_cache: dict[Tuple[str, int], tuple[float, Dict]] = {}


def _get_cached_prediction(symbol: str, horizon_days: int) -> Dict | None:
    cache_key = (symbol, horizon_days)
    cached = prediction_cache.get(cache_key)
    if not cached:
        return None

    cached_at, payload = cached
    if time.time() - cached_at > PREDICTION_CACHE_TTL_SECONDS:
        prediction_cache.pop(cache_key, None)
        return None

    return copy.deepcopy(payload)


def _store_cached_prediction(symbol: str, horizon_days: int, payload: Dict) -> Dict:
    prediction_cache[(symbol, horizon_days)] = (time.time(), copy.deepcopy(payload))
    return payload


@router.get("/{symbol}")
async def predict_stock_movement(symbol: str) -> Dict:
    """Generate a macro-aware AI prediction for a supported symbol."""
    db = SessionLocal()
    try:
        normalized_symbol = symbol.upper().strip()
        cached = _get_cached_prediction(normalized_symbol, 30)
        if cached is not None:
            return cached
        quote = market_service.get_quote(normalized_symbol)
        if not quote:
            raise HTTPException(status_code=404, detail=f"{normalized_symbol} is not a supported market symbol")
        payload = RecommendationEngine(db).generate_recommendation(normalized_symbol, forecast_days=30)
        return _store_cached_prediction(normalized_symbol, 30, payload)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
    finally:
        db.close()


@router.get("/{symbol}/forecast")
async def predict_symbol_forecast(symbol: str, horizon_days: int = 30) -> Dict:
    db = SessionLocal()
    try:
        normalized_symbol = symbol.upper().strip()
        if horizon_days < 5 or horizon_days > 180:
            raise HTTPException(status_code=400, detail="horizon_days must be between 5 and 180")
        quote = market_service.get_quote(normalized_symbol)
        if not quote:
            raise HTTPException(status_code=404, detail=f"{normalized_symbol} is not a supported market symbol")
        cached = _get_cached_prediction(normalized_symbol, horizon_days)
        if cached is not None:
            return cached
        payload = RecommendationEngine(db).generate_recommendation(normalized_symbol, forecast_days=horizon_days)
        return _store_cached_prediction(normalized_symbol, horizon_days, payload)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Forecast failed: {str(e)}")
    finally:
        db.close()


@router.get("/train/{symbol}")
async def train_model(symbol: str) -> Dict:
    """Expose a safe compatibility endpoint for the demo prediction stack."""
    try:
        normalized_symbol = symbol.upper().strip()
        quote = market_service.get_stock_quote(normalized_symbol) or market_service.get_crypto_quote(normalized_symbol)
        if not quote:
            raise HTTPException(status_code=404, detail=f"{normalized_symbol} is not a supported market symbol")

        return {
            "symbol": normalized_symbol,
            "message": "Training is not required for the current demo ensemble predictor.",
            "mode": "demo",
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")
