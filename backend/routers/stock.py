import asyncio
import copy
import time
from typing import Dict, List
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException, Query

from ai_engine import HedgeFundAI
from market_data import MarketDataService
from models import SessionLocal
from recommendation_engine import RecommendationEngine


router = APIRouter(prefix="/stocks", tags=["stocks"])
market_service = MarketDataService()
MARKET_CONTEXT_CACHE_TTL_SECONDS = 180
market_context_cache: dict[str, tuple[float, Dict]] = {}


def _get_cached_market_context(symbol: str) -> Dict | None:
    cached = market_context_cache.get(symbol)
    if not cached:
        return None

    cached_at, payload = cached
    if time.time() - cached_at > MARKET_CONTEXT_CACHE_TTL_SECONDS:
        market_context_cache.pop(symbol, None)
        return None

    return copy.deepcopy(payload)


def _store_cached_market_context(symbol: str, payload: Dict) -> Dict:
    market_context_cache[symbol] = (time.time(), copy.deepcopy(payload))
    return payload


@router.get("/market/overview")
async def get_market_overview() -> Dict:
    return market_service.get_market_overview()


@router.get("/market/top-movers")
async def get_top_movers(limit: int = Query(10, ge=1, le=25)) -> Dict:
    return market_service.get_top_movers(limit)


@router.get("/market/context/{symbol}")
async def get_market_context(symbol: str) -> Dict:
    db = SessionLocal()
    try:
        normalized_symbol = symbol.upper().strip()
        cached = _get_cached_market_context(normalized_symbol)
        if cached is not None:
            return cached
        payload = RecommendationEngine(db).get_global_context(normalized_symbol)
        return _store_cached_market_context(normalized_symbol, payload)
    finally:
        db.close()


@router.get("/market/providers/health")
async def get_provider_health() -> Dict:
    return market_service.get_provider_health()


@router.get("/search/{query}")
async def search_symbols(query: str, limit: int = Query(10, ge=1, le=25)) -> List[Dict]:
    return market_service.search_symbols(query, limit)


@router.get("/popular/stocks")
async def get_popular_stocks() -> List[str]:
    return market_service.popular_stocks


@router.get("/popular/cryptos")
async def get_popular_cryptos() -> List[str]:
    return market_service.popular_cryptos


@router.get("/live-prices")
async def get_live_prices(symbols: str = Query(...)) -> Dict:
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    prices: Dict[str, Dict] = {}
    limited_symbols = symbol_list[:8]

    with ThreadPoolExecutor(max_workers=min(6, max(1, len(limited_symbols)))) as executor:
        quote_map = {
            symbol: executor.submit(market_service.get_quote, symbol)
            for symbol in limited_symbols
        }
        for symbol, future in quote_map.items():
            try:
                quote = future.result(timeout=6)
            except Exception:
                quote = None
            if quote:
                prices[symbol] = quote

    return {
        "symbols": limited_symbols,
        "prices": prices,
        "timestamp": asyncio.get_event_loop().time(),
    }


@router.get("/ai/predict/{symbol}")
async def get_ai_prediction(symbol: str) -> Dict:
    db = SessionLocal()
    try:
        return HedgeFundAI(db).generate_prediction(symbol.upper())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI prediction error: {exc}") from exc
    finally:
        db.close()


@router.get("/ai/scanner")
async def get_market_scanner() -> List[Dict]:
    db = SessionLocal()
    try:
        return HedgeFundAI(db).get_market_scanner()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scanner error: {exc}") from exc
    finally:
        db.close()


@router.get("/ai/history/{symbol}")
async def get_prediction_history(symbol: str, limit: int = Query(10, ge=1, le=100)) -> List[Dict]:
    db = SessionLocal()
    try:
        return HedgeFundAI(db).get_prediction_history(symbol.upper(), limit)
    finally:
        db.close()


@router.get("/analysis/{symbol}")
async def get_technical_analysis(symbol: str) -> Dict:
    analysis = market_service.get_technical_analysis(symbol.upper())
    if "error" in analysis:
        raise HTTPException(status_code=404, detail=analysis["error"])
    return analysis


@router.get("/crypto/{symbol}")
async def get_crypto_quote(symbol: str) -> Dict:
    quote = market_service.get_crypto_quote(symbol.upper())
    if not quote:
        raise HTTPException(status_code=404, detail=f"Cryptocurrency {symbol} not found")
    return quote


@router.get("/crypto/{symbol}/history")
async def get_crypto_history(
    symbol: str,
    period: str = Query("1y"),
    interval: str = Query("1d"),
) -> Dict:
    df = market_service.get_historical_data(symbol.upper(), period, interval)
    if df is None:
        raise HTTPException(status_code=404, detail=f"Historical data for {symbol} not found")

    return {
        "symbol": symbol.upper(),
        "period": period,
        "interval": interval,
        "data": df.reset_index().to_dict(orient="records"),
    }


@router.get("/{symbol}/history")
async def get_stock_history(
    symbol: str,
    period: str = Query("1y"),
    interval: str = Query("1d"),
) -> Dict:
    df = market_service.get_historical_data(symbol.upper(), period, interval)
    if df is None:
        raise HTTPException(status_code=404, detail=f"Historical data for {symbol} not found")

    return {
        "symbol": symbol.upper(),
        "period": period,
        "interval": interval,
        "data": df.reset_index().to_dict(orient="records"),
    }


@router.get("/{symbol}")
async def get_stock_quote(symbol: str) -> Dict:
    quote = market_service.get_stock_quote(symbol.upper())
    if not quote:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    return quote
