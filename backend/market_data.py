import yfinance as yf
import ccxt
import pandas as pd
import numpy as np
from typing import Any, Dict, Optional, List
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import os
import requests
from datetime import datetime, timedelta
import ta
from sklearn.linear_model import LinearRegression
import warnings
warnings.filterwarnings('ignore')

class MarketDataService:
    _shared_binance = None
    _shared_coinbase = None
    _shared_http_session = None
    _shared_nse_ready = False
    _shared_fx_cache: Dict[str, float] = {}
    _shared_data_cache: Dict[str, tuple[datetime, object]] = {}
    _shared_provider_metrics: Dict[str, Dict[str, Any]] = {}

    def __init__(self):
        # Initialize exchanges for crypto data
        if MarketDataService._shared_binance is None:
            MarketDataService._shared_binance = ccxt.binance()
        if MarketDataService._shared_coinbase is None:
            MarketDataService._shared_coinbase = ccxt.coinbase()
        if MarketDataService._shared_http_session is None:
            session = requests.Session()
            session.headers.update({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
                "Accept": "application/json,text/plain,*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.nseindia.com/",
            })
            MarketDataService._shared_http_session = session
        self.binance = MarketDataService._shared_binance
        self.coinbase = MarketDataService._shared_coinbase
        self.http = MarketDataService._shared_http_session

        # Popular stocks and cryptos
        self.popular_stocks = [
            'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'NFLX',
            'BABA', 'ORCL', 'CRM', 'AMD', 'INTC', 'UBER', 'LYFT', 'SPOT',
            'PYPL', 'SQ', 'SHOP', 'ZM', 'DOCU', 'COIN', 'MSTR', 'RIOT',
            'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS',
            'RELIANCE.BO', 'TCS.BO', 'INFY.BO', 'HDFCBANK.BO'
        ]

        self.popular_cryptos = [
            'BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'DOGE', 'AVAX',
            'MATIC', 'LINK', 'UNI', 'ALGO', 'VET', 'ICP', 'FIL', 'TRX'
        ]
        self.india_equity_aliases = {
            "RELIANCE": {"yahoo": "RELIANCE.NS", "exchange": "NSE", "name": "Reliance Industries"},
            "TCS": {"yahoo": "TCS.NS", "exchange": "NSE", "name": "Tata Consultancy Services"},
            "INFY": {"yahoo": "INFY.NS", "exchange": "NSE", "name": "Infosys"},
            "HDFCBANK": {"yahoo": "HDFCBANK.NS", "exchange": "NSE", "name": "HDFC Bank"},
            "SBIN": {"yahoo": "SBIN.NS", "exchange": "NSE", "name": "State Bank of India"},
            "ICICIBANK": {"yahoo": "ICICIBANK.NS", "exchange": "NSE", "name": "ICICI Bank"},
        }
        self.us_equity_aliases = {
            "AAPL": {"name": "Apple Inc.", "exchange": "NASDAQ"},
            "GOOGL": {"name": "Alphabet Inc.", "exchange": "NASDAQ"},
            "MSFT": {"name": "Microsoft Corporation", "exchange": "NASDAQ"},
            "TSLA": {"name": "Tesla Inc.", "exchange": "NASDAQ"},
            "AMZN": {"name": "Amazon.com Inc.", "exchange": "NASDAQ"},
            "NVDA": {"name": "NVIDIA Corporation", "exchange": "NASDAQ"},
            "META": {"name": "Meta Platforms Inc.", "exchange": "NASDAQ"},
            "NFLX": {"name": "Netflix Inc.", "exchange": "NASDAQ"},
            "AMD": {"name": "Advanced Micro Devices", "exchange": "NASDAQ"},
            "INTC": {"name": "Intel Corporation", "exchange": "NASDAQ"},
            "ORCL": {"name": "Oracle Corporation", "exchange": "NYSE"},
            "CRM": {"name": "Salesforce Inc.", "exchange": "NYSE"},
            "UBER": {"name": "Uber Technologies Inc.", "exchange": "NYSE"},
            "LYFT": {"name": "Lyft Inc.", "exchange": "NASDAQ"},
            "SPOT": {"name": "Spotify Technology", "exchange": "NYSE"},
            "PYPL": {"name": "PayPal Holdings", "exchange": "NASDAQ"},
            "SQ": {"name": "Block Inc.", "exchange": "NYSE"},
            "SHOP": {"name": "Shopify Inc.", "exchange": "NASDAQ"},
            "ZM": {"name": "Zoom Communications", "exchange": "NASDAQ"},
            "DOCU": {"name": "DocuSign Inc.", "exchange": "NASDAQ"},
            "COIN": {"name": "Coinbase Global", "exchange": "NASDAQ"},
            "MSTR": {"name": "MicroStrategy Incorporated", "exchange": "NASDAQ"},
            "RIOT": {"name": "Riot Platforms", "exchange": "NASDAQ"},
            "BABA": {"name": "Alibaba Group Holding", "exchange": "NYSE"},
        }
        self._fx_cache = MarketDataService._shared_fx_cache
        self._data_cache = MarketDataService._shared_data_cache
        self._provider_metrics = MarketDataService._shared_provider_metrics
        self._quote_cache_ttl = timedelta(seconds=45)
        self._history_cache_ttl = timedelta(minutes=5)
        self._technical_cache_ttl = timedelta(minutes=5)
        self._overview_cache_ttl = timedelta(seconds=45)
        self._top_movers_cache_ttl = timedelta(seconds=90)
        self.alpha_vantage_api_key = os.getenv("ALPHA_VANTAGE_API_KEY", "").strip()
        self.twelve_data_api_key = os.getenv("TWELVE_DATA_API_KEY", "").strip()
        self.fmp_api_key = (os.getenv("FMP_API_KEY", "") or os.getenv("FINANCIAL_MODELING_PREP_API_KEY", "")).strip()
        for provider_name in ["nse", "twelve_data", "fmp", "alpha_vantage", "yahoo_finance", "offline_feed"]:
            self._provider_metrics.setdefault(
                provider_name,
                {
                    "attempts": 0,
                    "successes": 0,
                    "failures": 0,
                    "last_status": "idle",
                    "last_success_at": None,
                    "last_failure_at": None,
                    "last_error": None,
                },
            )

    def _get_cached(self, key: str, ttl: timedelta) -> Optional[object]:
        cached = self._data_cache.get(key)
        if not cached:
            return None
        cached_at, payload = cached
        if datetime.now() - cached_at > ttl:
            self._data_cache.pop(key, None)
            return None
        return payload

    def _set_cached(self, key: str, payload: object) -> object:
        self._data_cache[key] = (datetime.now(), payload)
        return payload

    def _record_provider_result(self, provider: str, ok: bool, error: Optional[str] = None):
        metrics = self._provider_metrics.setdefault(
            provider,
            {
                "attempts": 0,
                "successes": 0,
                "failures": 0,
                "last_status": "idle",
                "last_success_at": None,
                "last_failure_at": None,
                "last_error": None,
            },
        )
        metrics["attempts"] += 1
        metrics["last_status"] = "ok" if ok else "error"
        if ok:
            metrics["successes"] += 1
            metrics["last_success_at"] = datetime.now().isoformat()
            metrics["last_error"] = None
        else:
            metrics["failures"] += 1
            metrics["last_failure_at"] = datetime.now().isoformat()
            metrics["last_error"] = error

    def get_provider_health(self) -> Dict[str, Any]:
        providers = {
            "nse": {
                "label": "NSE India",
                "enabled": True,
                "configured": True,
            },
            "twelve_data": {
                "label": "Twelve Data",
                "enabled": bool(self.twelve_data_api_key),
                "configured": bool(self.twelve_data_api_key),
            },
            "fmp": {
                "label": "Financial Modeling Prep",
                "enabled": bool(self.fmp_api_key),
                "configured": bool(self.fmp_api_key),
            },
            "alpha_vantage": {
                "label": "Alpha Vantage",
                "enabled": bool(self.alpha_vantage_api_key),
                "configured": bool(self.alpha_vantage_api_key),
            },
            "yahoo_finance": {
                "label": "Yahoo Finance",
                "enabled": True,
                "configured": True,
            },
            "offline_feed": {
                "label": "Finply Offline Feed",
                "enabled": True,
                "configured": True,
            },
        }

        snapshot = []
        for provider, details in providers.items():
            metrics = self._provider_metrics.get(provider, {})
            snapshot.append(
                {
                    "provider": provider,
                    "label": details["label"],
                    "enabled": details["enabled"],
                    "configured": details["configured"],
                    "attempts": metrics.get("attempts", 0),
                    "successes": metrics.get("successes", 0),
                    "failures": metrics.get("failures", 0),
                    "last_status": metrics.get("last_status", "idle"),
                    "last_success_at": metrics.get("last_success_at"),
                    "last_failure_at": metrics.get("last_failure_at"),
                    "last_error": metrics.get("last_error"),
                }
            )

        live_ready = any(item["enabled"] and item["last_status"] == "ok" for item in snapshot if item["provider"] != "offline_feed")
        degraded = any(item["enabled"] and item["failures"] > item["successes"] for item in snapshot if item["provider"] != "offline_feed")
        return {
            "status": "healthy" if live_ready and not degraded else "degraded",
            "live_ready": live_ready,
            "degraded": degraded,
            "providers": snapshot,
            "timestamp": datetime.now().isoformat(),
        }

    def _run_with_timeout(self, func, timeout_seconds: float = 6.0, fallback=None):
        executor = ThreadPoolExecutor(max_workers=1)
        future = executor.submit(func)
        try:
            return future.result(timeout=timeout_seconds)
        except FuturesTimeoutError:
            future.cancel()
            executor.shutdown(wait=False, cancel_futures=True)
            return fallback
        except Exception:
            executor.shutdown(wait=False, cancel_futures=True)
            return fallback
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    def _is_known_stock(self, symbol: str) -> bool:
        normalized = symbol.upper().strip()
        return (
            normalized in self.popular_stocks
            or normalized in self.india_equity_aliases
            or any(normalized == details["yahoo"] for details in self.india_equity_aliases.values())
        )

    def _is_known_crypto(self, symbol: str) -> bool:
        return symbol.upper() in self.popular_cryptos

    def _normalize_stock_symbol(self, symbol: str) -> str:
        normalized = symbol.upper().strip()
        alias = self.india_equity_aliases.get(normalized)
        if alias:
            return alias["yahoo"]
        return normalized

    def _display_stock_symbol(self, symbol: str) -> str:
        normalized = symbol.upper().strip()
        for base_symbol, details in self.india_equity_aliases.items():
            if normalized == base_symbol or normalized == details["yahoo"]:
                return base_symbol
        return normalized

    def _exchange_for_symbol(self, symbol: str) -> Optional[str]:
        normalized = symbol.upper().strip()
        if normalized.endswith(".NS"):
            return "NSE"
        if normalized.endswith(".BO"):
            return "BSE"
        alias = self.india_equity_aliases.get(normalized)
        if alias:
            return str(alias["exchange"])
        for details in self.india_equity_aliases.values():
            if normalized == details["yahoo"]:
                return str(details["exchange"])
        return None

    def _looks_like_india_equity(self, symbol: str) -> bool:
        normalized = symbol.upper().strip()
        return self._exchange_for_symbol(normalized) in {"NSE", "BSE"}

    def _resolve_search_label(self, symbol: str) -> str:
        normalized = symbol.upper().strip()
        alias = self.india_equity_aliases.get(normalized)
        if alias:
            return f"{alias['name']} ({alias['exchange']})"
        us_alias = self.us_equity_aliases.get(normalized)
        if us_alias:
            return f"{us_alias['name']} ({us_alias['exchange']})"
        for base_symbol, details in self.india_equity_aliases.items():
            if normalized == details["yahoo"]:
                return f"{details['name']} ({details['exchange']})"
        if normalized.endswith(".NS"):
            return f"{normalized.replace('.NS', '')} (NSE)"
        if normalized.endswith(".BO"):
            return f"{normalized.replace('.BO', '')} (BSE)"
        return normalized

    def _http_get_json(self, url: str, params: Optional[Dict] = None, timeout_seconds: float = 2.0):
        response = self.http.get(url, params=params, timeout=timeout_seconds)
        response.raise_for_status()
        return response.json()

    def _ensure_nse_session(self):
        if MarketDataService._shared_nse_ready:
            return
        try:
            self.http.get("https://www.nseindia.com", timeout=2.0)
            MarketDataService._shared_nse_ready = True
        except Exception:
            pass

    def _safe_float(self, value) -> Optional[float]:
        try:
            if value in (None, "", "None", "null", "N/A"):
                return None
            return float(value)
        except (TypeError, ValueError):
            return None

    def _safe_int(self, value) -> Optional[int]:
        parsed = self._safe_float(value)
        if parsed is None:
            return None
        return int(parsed)

    def _format_change_percent(self, value: Optional[float]) -> str:
        if value is None:
            return "0.0%"
        return f"{round(value, 2)}%"

    def _map_period_to_outputsize(self, period: str) -> int:
        return {
            "1d": 2,
            "5d": 5,
            "1mo": 30,
            "3mo": 90,
            "6mo": 180,
            "1y": 365,
            "2y": 730,
        }.get(period, 180)

    def _map_interval_to_twelve_data(self, interval: str) -> Optional[str]:
        return {
            "1m": "1min",
            "2m": "2min",
            "5m": "5min",
            "15m": "15min",
            "30m": "30min",
            "60m": "1h",
            "90m": "1h",
            "1h": "1h",
            "1d": "1day",
            "1wk": "1week",
            "1mo": "1month",
        }.get(interval)

    def _fetch_stock_quote_from_twelve_data(self, symbol: str) -> Optional[Dict]:
        if not self.twelve_data_api_key:
            return None

        payload = self._http_get_json(
            "https://api.twelvedata.com/quote",
            params={"symbol": symbol, "apikey": self.twelve_data_api_key},
            timeout_seconds=1.8,
        )
        if payload.get("status") == "error" or payload.get("code"):
            return None

        price = self._safe_float(payload.get("close"))
        previous_close = self._safe_float(payload.get("previous_close"))
        change = self._safe_float(payload.get("change"))
        change_percent = self._safe_float(payload.get("percent_change"))
        if price is None:
            return None
        if change is None and previous_close is not None:
            change = price - previous_close
        if change_percent is None and previous_close not in (None, 0):
            change_percent = ((price - previous_close) / previous_close) * 100

        native_currency = (payload.get("currency") or self._infer_native_currency(symbol)).upper()
        normalized_price = self._convert_value_to_usd(price, native_currency)
        normalized_change = self._convert_value_to_usd(change, native_currency) if change is not None else 0.0
        market_cap_native = self._safe_float(payload.get("market_cap"))
        market_cap = self._convert_value_to_usd(market_cap_native, native_currency) if market_cap_native else None

        return {
            "symbol": self._display_stock_symbol(symbol),
            "price": round(normalized_price, 2),
            "change": round(normalized_change or 0.0, 2),
            "change_percent": self._format_change_percent(change_percent),
            "volume": self._safe_int(payload.get("volume")) or 0,
            "market_cap": round(market_cap, 2) if market_cap else None,
            "pe_ratio": self._safe_float(payload.get("pe")),
            "dividend_yield": None,
            "timestamp": datetime.now().isoformat(),
            "source": "Twelve Data",
            "currency": "USD",
            "native_currency": native_currency,
            "fx_rate": round(self._get_fx_rate_to_usd(native_currency), 4),
            "exchange": self._exchange_for_symbol(symbol),
        }

    def _fetch_stock_quote_from_nse(self, symbol: str) -> Optional[Dict]:
        display_symbol = self._display_stock_symbol(symbol)
        if not self._looks_like_india_equity(display_symbol):
            return None

        self._ensure_nse_session()
        payload = self._http_get_json(
            "https://www.nseindia.com/api/quote-equity",
            params={"symbol": display_symbol},
            timeout_seconds=1.8,
        )
        price_info = payload.get("priceInfo") or {}
        security_info = payload.get("securityInfo") or {}
        industry_info = payload.get("industryInfo") or {}
        metadata = payload.get("metadata") or {}

        price = self._safe_float(price_info.get("lastPrice"))
        if price is None:
            return None
        change = self._safe_float(price_info.get("change")) or 0.0
        change_percent = self._safe_float(price_info.get("pChange"))
        volume = self._safe_int(price_info.get("totalTradedVolume")) or 0
        native_currency = "INR"
        normalized_price = self._convert_value_to_usd(price, native_currency)
        normalized_change = self._convert_value_to_usd(change, native_currency)

        return {
            "symbol": display_symbol,
            "price": round(normalized_price, 2),
            "change": round(normalized_change or 0.0, 2),
            "change_percent": self._format_change_percent(change_percent),
            "volume": volume,
            "market_cap": None,
            "pe_ratio": self._safe_float(industry_info.get("pe")),
            "dividend_yield": self._safe_float(security_info.get("yield")),
            "timestamp": datetime.now().isoformat(),
            "source": "NSE India",
            "currency": "USD",
            "native_currency": native_currency,
            "fx_rate": round(self._get_fx_rate_to_usd(native_currency), 4),
            "exchange": "NSE",
            "as_of": metadata.get("lastUpdateTime"),
        }

    def _fetch_stock_quote_from_fmp(self, symbol: str) -> Optional[Dict]:
        if not self.fmp_api_key:
            return None

        payload = self._http_get_json(
            "https://financialmodelingprep.com/stable/quote",
            params={"symbol": symbol, "apikey": self.fmp_api_key},
            timeout_seconds=1.8,
        )
        if not isinstance(payload, list) or not payload:
            return None

        item = payload[0]
        price = self._safe_float(item.get("price"))
        if price is None:
            return None

        change = self._safe_float(item.get("change")) or 0.0
        change_percent = self._safe_float(item.get("changesPercentage"))
        native_currency = (item.get("currency") or self._infer_native_currency(symbol)).upper()
        normalized_price = self._convert_value_to_usd(price, native_currency)
        normalized_change = self._convert_value_to_usd(change, native_currency)
        market_cap_native = self._safe_float(item.get("marketCap"))
        market_cap = self._convert_value_to_usd(market_cap_native, native_currency) if market_cap_native else None

        return {
            "symbol": symbol,
            "price": round(normalized_price, 2),
            "change": round(normalized_change or 0.0, 2),
            "change_percent": self._format_change_percent(change_percent),
            "volume": self._safe_int(item.get("volume")) or 0,
            "market_cap": round(market_cap, 2) if market_cap else None,
            "pe_ratio": self._safe_float(item.get("pe")),
            "dividend_yield": None,
            "timestamp": datetime.now().isoformat(),
            "source": "Financial Modeling Prep",
            "currency": "USD",
            "native_currency": native_currency,
            "fx_rate": round(self._get_fx_rate_to_usd(native_currency), 4),
        }

    def _fetch_stock_quote_from_alpha_vantage(self, symbol: str) -> Optional[Dict]:
        if not self.alpha_vantage_api_key:
            return None

        payload = self._http_get_json(
            "https://www.alphavantage.co/query",
            params={
                "function": "GLOBAL_QUOTE",
                "symbol": symbol,
                "apikey": self.alpha_vantage_api_key,
            },
            timeout_seconds=2.0,
        )
        quote = payload.get("Global Quote") or {}
        if not quote:
            return None

        price = self._safe_float(quote.get("05. price"))
        previous_close = self._safe_float(quote.get("08. previous close"))
        change = self._safe_float(quote.get("09. change"))
        change_percent_raw = str(quote.get("10. change percent", "")).replace("%", "").strip()
        change_percent = self._safe_float(change_percent_raw)
        if price is None:
            return None
        if change is None and previous_close is not None:
            change = price - previous_close

        native_currency = self._infer_native_currency(symbol)
        normalized_price = self._convert_value_to_usd(price, native_currency)
        normalized_change = self._convert_value_to_usd(change, native_currency) if change is not None else 0.0

        return {
            "symbol": symbol,
            "price": round(normalized_price, 2),
            "change": round(normalized_change or 0.0, 2),
            "change_percent": self._format_change_percent(change_percent),
            "volume": self._safe_int(quote.get("06. volume")) or 0,
            "market_cap": None,
            "pe_ratio": None,
            "dividend_yield": None,
            "timestamp": datetime.now().isoformat(),
            "source": "Alpha Vantage",
            "currency": "USD",
            "native_currency": native_currency,
            "fx_rate": round(self._get_fx_rate_to_usd(native_currency), 4),
        }

    def _fetch_stock_history_from_twelve_data(self, symbol: str, period: str, interval: str) -> Optional[pd.DataFrame]:
        if not self.twelve_data_api_key:
            return None
        td_interval = self._map_interval_to_twelve_data(interval)
        if not td_interval:
            return None

        payload = self._http_get_json(
            "https://api.twelvedata.com/time_series",
            params={
                "symbol": symbol,
                "interval": td_interval,
                "outputsize": self._map_period_to_outputsize(period),
                "format": "JSON",
                "apikey": self.twelve_data_api_key,
            },
            timeout_seconds=2.4,
        )
        values = payload.get("values")
        if payload.get("status") == "error" or not isinstance(values, list) or not values:
            return None

        frame = pd.DataFrame(values)
        frame["date"] = pd.to_datetime(frame["datetime"])
        frame = frame.rename(
            columns={
                "open": "open",
                "high": "high",
                "low": "low",
                "close": "close",
                "volume": "volume",
            }
        )
        frame = frame[["date", "open", "high", "low", "close", "volume"]]
        frame[["open", "high", "low", "close", "volume"]] = frame[["open", "high", "low", "close", "volume"]].apply(
            pd.to_numeric, errors="coerce"
        )
        frame = frame.dropna(subset=["open", "high", "low", "close"]).sort_values("date")
        if frame.empty:
            return None
        frame = frame.set_index("date")
        frame.index.name = "date"
        native_currency = (payload.get("meta", {}).get("currency") or self._infer_native_currency(symbol)).upper()
        return self._normalize_price_frame_to_usd(frame, native_currency)

    def _fetch_stock_history_from_alpha_vantage(self, symbol: str, period: str, interval: str) -> Optional[pd.DataFrame]:
        if not self.alpha_vantage_api_key or interval not in {"1d", "1wk", "1mo"}:
            return None

        function = {
            "1d": "TIME_SERIES_DAILY_ADJUSTED",
            "1wk": "TIME_SERIES_WEEKLY_ADJUSTED",
            "1mo": "TIME_SERIES_MONTHLY_ADJUSTED",
        }[interval]
        payload = self._http_get_json(
            "https://www.alphavantage.co/query",
            params={"function": function, "symbol": symbol, "outputsize": "full", "apikey": self.alpha_vantage_api_key},
            timeout_seconds=2.8,
        )
        series_key = next((key for key in payload.keys() if "Time Series" in key), None)
        if not series_key:
            return None

        rows = []
        for date_key, item in payload[series_key].items():
            rows.append(
                {
                    "date": pd.to_datetime(date_key),
                    "open": self._safe_float(item.get("1. open")),
                    "high": self._safe_float(item.get("2. high")),
                    "low": self._safe_float(item.get("3. low")),
                    "close": self._safe_float(item.get("4. close")),
                    "volume": self._safe_float(item.get("6. volume") or item.get("5. volume")) or 0,
                }
            )
        frame = pd.DataFrame(rows).dropna(subset=["open", "high", "low", "close"]).sort_values("date")
        if frame.empty:
            return None

        target_points = self._map_period_to_outputsize(period)
        if target_points > 0:
            frame = frame.tail(target_points)
        frame = frame.set_index("date")
        frame.index.name = "date"
        return self._normalize_price_frame_to_usd(frame, self._infer_native_currency(symbol))

    def _search_stocks_from_fmp(self, query: str, limit: int = 10) -> List[Dict]:
        if not self.fmp_api_key:
            return []

        payload = self._http_get_json(
            "https://financialmodelingprep.com/stable/search-symbol",
            params={"query": query, "apikey": self.fmp_api_key},
            timeout_seconds=2.0,
        )
        if not isinstance(payload, list):
            return []

        results: List[Dict] = []
        seen_symbols: set[str] = set()
        for item in payload:
            raw_symbol = str(item.get("symbol") or "").upper().strip()
            if not raw_symbol:
                continue
            symbol = self._display_stock_symbol(raw_symbol)
            if symbol in seen_symbols:
                continue
            seen_symbols.add(symbol)
            name = str(item.get("name") or self._resolve_search_label(raw_symbol) or symbol).strip()
            results.append(
                {
                    "symbol": symbol,
                    "name": name,
                    "type": "stock",
                    "price": None,
                    "change_percent": None,
                    "exchange": item.get("exchangeShortName") or item.get("exchange") or self._exchange_for_symbol(raw_symbol),
                }
            )
            if len(results) >= limit:
                break
        return results

    def _search_stocks_from_yahoo(self, query: str, limit: int = 10) -> List[Dict]:
        payload = self._http_get_json(
            "https://query1.finance.yahoo.com/v1/finance/search",
            params={"q": query, "quotesCount": max(limit * 2, 10), "newsCount": 0},
            timeout_seconds=2.2,
        )
        items = payload.get("quotes") or []
        if not isinstance(items, list):
            return []

        allowed_quote_types = {"EQUITY", "ETF"}
        results: List[Dict] = []
        seen_symbols: set[str] = set()
        for item in items:
            raw_symbol = str(item.get("symbol") or "").upper().strip()
            quote_type = str(item.get("quoteType") or "").upper().strip()
            if not raw_symbol or quote_type not in allowed_quote_types:
                continue

            symbol = self._display_stock_symbol(raw_symbol)
            if symbol in seen_symbols:
                continue

            exchange = (
                item.get("exchange")
                or item.get("exchDisp")
                or item.get("exchangeDisplay")
                or self._exchange_for_symbol(raw_symbol)
            )
            name = str(
                item.get("shortname")
                or item.get("longname")
                or item.get("name")
                or self._resolve_search_label(raw_symbol)
                or symbol
            ).strip()

            results.append(
                {
                    "symbol": symbol,
                    "name": name,
                    "type": "stock",
                    "price": None,
                    "change_percent": None,
                    "exchange": exchange,
                }
            )
            seen_symbols.add(symbol)
            if len(results) >= limit:
                break

        return results

    def _search_score(self, query: str, symbol: str, name: str) -> int:
        query_normalized = query.strip().lower()
        symbol_normalized = symbol.strip().lower()
        name_normalized = name.strip().lower()

        if not query_normalized:
            return 0
        if symbol_normalized == query_normalized:
            return 100
        if name_normalized == query_normalized:
            return 98
        if name_normalized.startswith(query_normalized):
            return 92
        if symbol_normalized.startswith(query_normalized):
            return 90
        if f" {query_normalized}" in name_normalized or query_normalized in name_normalized:
            return 80
        if query_normalized in symbol_normalized:
            return 70
        return 10

    def _build_local_stock_match(self, symbol: str) -> Optional[Dict]:
        quote = self.get_stock_quote(symbol)
        if not quote:
            return None

        display_symbol = self._display_stock_symbol(symbol)
        return {
            "symbol": display_symbol,
            "name": self._resolve_search_label(symbol),
            "type": "stock",
            "price": quote.get("price"),
            "change_percent": quote.get("change_percent"),
            "exchange": self._exchange_for_symbol(symbol) or self.us_equity_aliases.get(display_symbol, {}).get("exchange"),
        }

    def is_supported_symbol(self, symbol: str) -> bool:
        return self._is_known_stock(symbol) or self._is_known_crypto(symbol)

    def get_quote(self, symbol: str) -> Optional[Dict]:
        normalized = symbol.upper().strip()
        if self._is_known_crypto(normalized):
            return self.get_crypto_quote(normalized)
        return self.get_stock_quote(normalized) or self.get_crypto_quote(normalized)

    def _fallback_price(self, symbol: str, is_crypto: bool = False) -> float:
        seed = sum(ord(char) for char in symbol.upper())
        base = 180 if not is_crypto else 32000
        spread = 120 if not is_crypto else 18000
        return round(base + (seed % spread), 2)

    def _fallback_quote(self, symbol: str, is_crypto: bool = False) -> Dict:
        native_currency = "USD" if is_crypto else self._infer_native_currency(symbol)
        recent_history = self._fallback_history(symbol, period="5d", is_crypto=is_crypto)
        latest_close = float(recent_history["close"].iloc[-1])
        previous_close = float(recent_history["close"].iloc[-2]) if len(recent_history) > 1 else latest_close
        native_price = latest_close * self._get_fx_rate_to_usd(native_currency)
        native_previous_price = previous_close * self._get_fx_rate_to_usd(native_currency)
        native_change = round(native_price - native_previous_price, 2)
        price = self._convert_value_to_usd(native_price, native_currency)
        change = self._convert_value_to_usd(native_change, native_currency)
        change_percent = round((change / max(price - change, 1)) * 100, 2)

        return {
            "symbol": symbol.upper(),
            "price": round(price, 2),
            "change": round(change, 2),
            "change_percent": f"{change_percent}%",
            "volume": 1500000 if not is_crypto else 12500,
            "market_cap": None,
            "pe_ratio": None,
            "dividend_yield": None,
            "timestamp": datetime.now().isoformat(),
            "source": "Finply Offline Feed",
            "currency": "USD",
            "native_currency": native_currency,
            "fx_rate": round(self._get_fx_rate_to_usd(native_currency), 4),
        }

    def _fallback_history(self, symbol: str, period: str = "1y", is_crypto: bool = False) -> pd.DataFrame:
        periods_map = {
            "1d": 24,
            "5d": 40,
            "1mo": 30,
            "3mo": 90,
            "6mo": 180,
            "1y": 365,
            "2y": 730,
        }
        points = periods_map.get(period, 120)
        end = datetime.now()
        freq = "H" if period in {"1d", "5d"} else "D"
        index = pd.date_range(end=end, periods=points, freq=freq)
        base_price = self._fallback_price(symbol, is_crypto=is_crypto)
        phase = (sum(ord(char) for char in symbol.upper()) % 17) / 10
        steps = np.arange(points)
        close = base_price + np.sin((steps / max(points, 1)) * np.pi * 4 + phase) * base_price * 0.04
        close = close - close[-1] + base_price
        open_ = close * (1 - 0.003)
        high = close * (1 + 0.007)
        low = close * (1 - 0.007)
        volume = np.full(points, 1250000 if not is_crypto else 8500)

        df = pd.DataFrame({
            "open": open_.round(2),
            "high": high.round(2),
            "low": low.round(2),
            "close": close.round(2),
            "volume": volume,
        }, index=index)
        df.index.name = "date"
        native_currency = "USD" if is_crypto else self._infer_native_currency(symbol)
        return self._normalize_price_frame_to_usd(df, native_currency)

    def _infer_native_currency(self, symbol: str) -> str:
        symbol = symbol.upper().strip()
        if symbol in self.india_equity_aliases:
            return "INR"
        if symbol.endswith(".NS") or symbol.endswith(".BO"):
            return "INR"
        return "USD"

    def _get_fx_rate_to_usd(self, currency: str) -> float:
        currency = (currency or "USD").upper()
        if currency == "USD":
            return 1.0

        cached = self._fx_cache.get(currency)
        if cached:
            return cached

        pair_map = {
            "INR": "USDINR=X",
        }
        default_rates = {
            "INR": 83.0,
        }
        pair = pair_map.get(currency)
        if not pair:
            return 1.0

        try:
            hist = yf.Ticker(pair).history(period="2d")
            if hist.empty:
                return 1.0
            rate = float(hist["Close"].iloc[-1])
            if rate > 0:
                self._fx_cache[currency] = rate
                return rate
        except Exception as e:
            print(f"Error fetching FX rate for {currency}: {e}")

        fallback_rate = default_rates.get(currency, 1.0)
        self._fx_cache[currency] = fallback_rate
        return fallback_rate

    def _convert_value_to_usd(self, value: Optional[float], currency: str) -> Optional[float]:
        if value is None:
            return None
        fx_rate = self._get_fx_rate_to_usd(currency)
        if fx_rate <= 0:
            return value
        return float(value) / fx_rate

    def _normalize_price_frame_to_usd(self, df: pd.DataFrame, currency: str) -> pd.DataFrame:
        if currency.upper() == "USD":
            return df

        fx_rate = self._get_fx_rate_to_usd(currency)
        if fx_rate <= 0:
            return df

        normalized = df.copy()
        for column in ["open", "high", "low", "close"]:
            if column in normalized.columns:
                normalized[column] = normalized[column] / fx_rate
        return normalized

    def get_stock_quote(self, symbol: str) -> Optional[Dict]:
        """Get real-time stock quote with analysis"""
        symbol = symbol.upper().strip()
        if self._is_known_crypto(symbol):
            return None
        provider_symbol = self._normalize_stock_symbol(symbol)
        display_symbol = self._display_stock_symbol(symbol)
        cache_key = f"stock_quote:{display_symbol}"
        cached = self._get_cached(cache_key, self._quote_cache_ttl)
        if cached is not None:
            return cached

        def _fetch_quote_from_yahoo() -> Optional[Dict]:
            ticker = yf.Ticker(provider_symbol)
            info = ticker.info
            hist = ticker.history(period="2d")

            if hist.empty:
                return self._fallback_quote(display_symbol, is_crypto=False) if self._is_known_stock(display_symbol) else None

            native_currency = (info.get('currency') or self._infer_native_currency(provider_symbol)).upper()
            current_price_native = float(hist['Close'].iloc[-1])
            previous_price_native = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current_price_native

            current_price = self._convert_value_to_usd(current_price_native, native_currency)
            previous_price = self._convert_value_to_usd(previous_price_native, native_currency)

            change = current_price - previous_price
            change_percent = (change / previous_price) * 100 if previous_price != 0 else 0

            volume = hist['Volume'].iloc[-1] if 'Volume' in hist.columns else 0
            market_cap_native = info.get('marketCap', 0)
            market_cap = self._convert_value_to_usd(market_cap_native, native_currency) if market_cap_native else 0
            pe_ratio = info.get('trailingPE', 0)
            dividend_yield = info.get('dividendYield', 0)

            return {
                "symbol": display_symbol,
                "price": round(current_price, 2),
                "change": round(change, 2),
                "change_percent": f"{round(change_percent, 2)}%",
                "volume": int(volume),
                "market_cap": round(market_cap, 2) if market_cap else market_cap,
                "pe_ratio": round(pe_ratio, 2) if pe_ratio else None,
                "dividend_yield": round(dividend_yield * 100, 2) if dividend_yield else None,
                "timestamp": datetime.now().isoformat(),
                "source": "Yahoo Finance",
                "currency": "USD",
                "native_currency": native_currency,
                "fx_rate": round(self._get_fx_rate_to_usd(native_currency), 4),
                "exchange": self._exchange_for_symbol(provider_symbol),
            }

        try:
            fallback_payload = self._fallback_quote(display_symbol, is_crypto=False) if self._is_known_stock(display_symbol) else None
            provider_chain = [
                ("nse", lambda: self._fetch_stock_quote_from_nse(display_symbol), 1.8),
                ("twelve_data", lambda: self._fetch_stock_quote_from_twelve_data(provider_symbol), 1.8),
                ("fmp", lambda: self._fetch_stock_quote_from_fmp(provider_symbol), 1.8),
                ("alpha_vantage", lambda: self._fetch_stock_quote_from_alpha_vantage(provider_symbol), 2.0),
                ("yahoo_finance", _fetch_quote_from_yahoo, 2.5),
            ]
            payload = None
            for provider_name, provider, timeout_seconds in provider_chain:
                payload = self._run_with_timeout(
                    provider,
                    timeout_seconds=timeout_seconds,
                    fallback=None,
                )
                if payload is not None:
                    self._record_provider_result(provider_name, True)
                    break
                self._record_provider_result(provider_name, False, "empty_or_timeout")
            if payload is None:
                self._record_provider_result("offline_feed", True)
                payload = fallback_payload
            if payload is None:
                return None
            return self._set_cached(cache_key, payload)
        except Exception as e:
            print(f"Error fetching stock quote for {display_symbol}: {e}")
            self._record_provider_result("offline_feed", False, str(e))
            return self._fallback_quote(display_symbol, is_crypto=False) if self._is_known_stock(display_symbol) else None

    def get_crypto_quote(self, symbol: str) -> Optional[Dict]:
        """Get real-time cryptocurrency quote"""
        symbol = symbol.upper().strip()
        cache_key = f"crypto_quote:{symbol}"
        cached = self._get_cached(cache_key, self._quote_cache_ttl)
        if cached is not None:
            return cached

        def _from_binance() -> Optional[Dict]:
            ticker = self.binance.fetch_ticker(f'{symbol}/USDT')
            if not ticker:
                return None
            return {
                "symbol": symbol,
                "price": round(ticker['last'], 2),
                "change": round(ticker['change'], 2),
                "change_percent": f"{round(ticker['percentage'], 2)}%",
                "volume": ticker['baseVolume'],
                "market_cap": None,
                "timestamp": datetime.now().isoformat(),
                "source": "Binance",
                "currency": "USD",
                "native_currency": "USD",
            }

        def _from_coinbase() -> Optional[Dict]:
            ticker = self.coinbase.fetch_ticker(f'{symbol}-USD')
            if not ticker:
                return None
            return {
                "symbol": symbol,
                "price": round(ticker['last'], 2),
                "change": round(ticker['change'], 2),
                "change_percent": f"{round(ticker['percentage'], 2)}%",
                "volume": ticker['baseVolume'],
                "timestamp": datetime.now().isoformat(),
                "source": "Coinbase",
                "currency": "USD",
                "native_currency": "USD",
            }

        payload = self._run_with_timeout(_from_binance, timeout_seconds=1.2, fallback=None)
        if payload is None:
            payload = self._run_with_timeout(_from_coinbase, timeout_seconds=1.2, fallback=None)
        if payload is None:
            payload = self._fallback_quote(symbol, is_crypto=True) if self._is_known_crypto(symbol) else None
        if payload is None:
            return None
        return self._set_cached(cache_key, payload)

    def get_historical_data(self, symbol: str, period: str = "1y", interval: str = "1d") -> Optional[pd.DataFrame]:
        """Get historical data for stocks or crypto"""
        symbol = symbol.upper().strip()
        provider_symbol = self._normalize_stock_symbol(symbol) if not self._is_known_crypto(symbol) else symbol
        display_symbol = self._display_stock_symbol(symbol) if not self._is_known_crypto(symbol) else symbol
        cache_key = f"history:{display_symbol}:{period}:{interval}"
        cached = self._get_cached(cache_key, self._history_cache_ttl)
        if cached is not None:
            return cached

        def _fetch_history_from_yahoo() -> Optional[pd.DataFrame]:
            if self._is_known_crypto(symbol):
                ticker = yf.Ticker(f"{symbol}-USD")
            else:
                ticker = yf.Ticker(provider_symbol)

            hist = ticker.history(period=period, interval=interval)

            if hist.empty:
                if self._is_known_crypto(symbol):
                    return self._fallback_history(symbol, period=period, is_crypto=True)
                if self._is_known_stock(display_symbol):
                    return self._fallback_history(display_symbol, period=period, is_crypto=False)
                return None

            df = hist[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
            df.columns = ['open', 'high', 'low', 'close', 'volume']
            df.index.name = 'date'
            native_currency = "USD" if self._is_known_crypto(symbol) else self._infer_native_currency(provider_symbol)
            return self._normalize_price_frame_to_usd(df, native_currency)

        try:
            fallback_payload = (
                self._fallback_history(display_symbol, period=period, is_crypto=self._is_known_crypto(symbol))
                if self._is_known_crypto(symbol) or self._is_known_stock(display_symbol)
                else None
            )
            payload = None
            if self._is_known_crypto(symbol):
                payload = self._run_with_timeout(
                    _fetch_history_from_yahoo,
                    timeout_seconds=3.0,
                    fallback=None,
                )
            else:
                provider_chain = [
                    (lambda: self._fetch_stock_history_from_twelve_data(provider_symbol, period, interval), 2.4),
                    (lambda: self._fetch_stock_history_from_alpha_vantage(provider_symbol, period, interval), 2.8),
                    (_fetch_history_from_yahoo, 3.0),
                ]
                for provider, timeout_seconds in provider_chain:
                    payload = self._run_with_timeout(provider, timeout_seconds=timeout_seconds, fallback=None)
                    if payload is not None:
                        break
            if payload is None:
                payload = fallback_payload
            if payload is None:
                return None
            return self._set_cached(cache_key, payload)
        except Exception as e:
            print(f"Error fetching historical data for {symbol}: {e}")
            if self._is_known_crypto(symbol):
                return self._fallback_history(symbol, period=period, is_crypto=True)
            if self._is_known_stock(symbol):
                return self._fallback_history(symbol, period=period, is_crypto=False)
            return None

    def get_technical_analysis(self, symbol: str, period: str = "6mo") -> Dict:
        """Perform technical analysis on the symbol"""
        cache_key = f"technical:{symbol.upper().strip()}:{period}"
        cached = self._get_cached(cache_key, self._technical_cache_ttl)
        if cached is not None:
            return cached
        try:
            df = self.get_historical_data(symbol, period)
            if df is None or df.empty:
                return {"error": "No data available"}

            # Calculate technical indicators
            analysis = {}

            # Moving averages
            df['SMA_20'] = ta.trend.sma_indicator(df['close'], window=20)
            df['SMA_50'] = ta.trend.sma_indicator(df['close'], window=50)
            df['EMA_12'] = ta.trend.ema_indicator(df['close'], window=12)
            df['EMA_26'] = ta.trend.ema_indicator(df['close'], window=26)

            # RSI
            df['RSI'] = ta.momentum.rsi(df['close'], window=14)

            # MACD
            macd = ta.trend.MACD(df['close'])
            df['MACD'] = macd.macd()
            df['MACD_signal'] = macd.macd_signal()
            df['MACD_hist'] = macd.macd_diff()

            # Bollinger Bands
            bollinger = ta.volatility.BollingerBands(df['close'])
            df['BB_upper'] = bollinger.bollinger_hband()
            df['BB_lower'] = bollinger.bollinger_lband()
            df['BB_middle'] = bollinger.bollinger_mavg()

            # Current values
            current_price = df['close'].iloc[-1]
            sma_20 = df['SMA_20'].iloc[-1]
            sma_50 = df['SMA_50'].iloc[-1]
            rsi = df['RSI'].iloc[-1]
            macd_val = df['MACD'].iloc[-1]
            macd_signal = df['MACD_signal'].iloc[-1]
            bb_upper = df['BB_upper'].iloc[-1]
            bb_lower = df['BB_lower'].iloc[-1]
            native_currency = "USD" if self._is_known_crypto(symbol) else self._infer_native_currency(symbol)
            fx_rate = self._get_fx_rate_to_usd(native_currency)

            def _to_native(value: float) -> float:
                return float(value) * fx_rate if native_currency != "USD" else float(value)

            # Generate signals
            signals = []

            # Trend signals
            if current_price > sma_20 > sma_50:
                signals.append({"type": "bullish", "signal": "Strong uptrend", "strength": "high"})
            elif current_price < sma_20 < sma_50:
                signals.append({"type": "bearish", "signal": "Strong downtrend", "strength": "high"})
            elif current_price > sma_20:
                signals.append({"type": "bullish", "signal": "Above 20-day MA", "strength": "medium"})
            else:
                signals.append({"type": "bearish", "signal": "Below 20-day MA", "strength": "medium"})

            # RSI signals
            if rsi > 70:
                signals.append({"type": "bearish", "signal": "Overbought (RSI > 70)", "strength": "medium"})
            elif rsi < 30:
                signals.append({"type": "bullish", "signal": "Oversold (RSI < 30)", "strength": "medium"})

            # MACD signals
            if macd_val > macd_signal:
                signals.append({"type": "bullish", "signal": "MACD bullish crossover", "strength": "medium"})
            else:
                signals.append({"type": "bearish", "signal": "MACD bearish crossover", "strength": "medium"})

            # Bollinger Band signals
            if current_price > bb_upper:
                signals.append({"type": "bearish", "signal": "Price above upper Bollinger Band", "strength": "low"})
            elif current_price < bb_lower:
                signals.append({"type": "bullish", "signal": "Price below lower Bollinger Band", "strength": "low"})

            analysis = {
                "symbol": self._display_stock_symbol(symbol) if not self._is_known_crypto(symbol) else symbol.upper(),
                "current_price": round(current_price, 2),
                "display_price": round(_to_native(current_price), 2),
                "display_currency": native_currency,
                "fx_rate": round(fx_rate, 4),
                "indicators": {
                    "sma_20": round(sma_20, 2),
                    "sma_50": round(sma_50, 2),
                    "rsi": round(rsi, 2),
                    "macd": round(macd_val, 4),
                    "macd_signal": round(macd_signal, 4),
                    "bb_upper": round(bb_upper, 2),
                    "bb_lower": round(bb_lower, 2)
                },
                "display_indicators": {
                    "sma_20": round(_to_native(sma_20), 2),
                    "sma_50": round(_to_native(sma_50), 2),
                    "bb_upper": round(_to_native(bb_upper), 2),
                    "bb_lower": round(_to_native(bb_lower), 2),
                },
                "signals": signals,
                "recommendation": self._generate_recommendation(signals),
                "timestamp": datetime.now().isoformat()
            }

            return self._set_cached(cache_key, analysis)
        except Exception as e:
            print(f"Error in technical analysis for {symbol}: {e}")
            return {"error": str(e)}

    def _generate_recommendation(self, signals: List[Dict]) -> Dict:
        """Generate trading recommendation based on signals"""
        bullish_count = sum(1 for s in signals if s['type'] == 'bullish')
        bearish_count = sum(1 for s in signals if s['type'] == 'bearish')

        total_signals = len(signals)
        bullish_ratio = bullish_count / total_signals if total_signals > 0 else 0

        if bullish_ratio >= 0.7:
            recommendation = "STRONG BUY"
            confidence = "High"
        elif bullish_ratio >= 0.5:
            recommendation = "BUY"
            confidence = "Medium"
        elif bullish_ratio >= 0.3:
            recommendation = "HOLD"
            confidence = "Medium"
        elif bullish_ratio >= 0.1:
            recommendation = "SELL"
            confidence = "Medium"
        else:
            recommendation = "STRONG SELL"
            confidence = "High"

        return {
            "action": recommendation,
            "confidence": confidence,
            "bullish_signals": bullish_count,
            "bearish_signals": bearish_count,
            "total_signals": total_signals
        }

    def get_market_overview(self) -> Dict:
        """Get overview of major markets"""
        cached = self._get_cached("market_overview", self._overview_cache_ttl)
        if cached is not None:
            return cached
        try:
            # Major indices
            indices = ['^GSPC', '^IXIC', '^DJI', '^VIX']  # S&P 500, NASDAQ, DOW, VIX
            index_data = {}
            index_names = {
                '^GSPC': 'S&P 500',
                '^IXIC': 'NASDAQ',
                '^DJI': 'DOW JONES',
                '^VIX': 'VIX'
            }

            def _load_index(index: str) -> tuple[str, Dict]:
                try:
                    ticker = yf.Ticker(index)
                    hist = ticker.history(period="2d")
                    if not hist.empty:
                        current = hist['Close'].iloc[-1]
                        previous = hist['Close'].iloc[-2] if len(hist) > 1 else current
                        change = current - previous
                        change_pct = (change / previous) * 100
                        return index_names[index], {
                            "price": round(current, 2),
                            "change": round(change, 2),
                            "change_percent": f"{round(change_pct, 2)}%"
                        }
                except Exception:
                    pass
                fallback_quote = self._fallback_quote(index_names.get(index, index), is_crypto=False)
                return index_names[index], {
                    "price": fallback_quote["price"],
                    "change": fallback_quote["change"],
                    "change_percent": fallback_quote["change_percent"],
                }

            with ThreadPoolExecutor(max_workers=min(4, len(indices))) as executor:
                for name, payload in executor.map(_load_index, indices):
                    index_data[name] = payload

            # Major cryptos
            crypto_data = {}
            major_cryptos = ['BTC', 'ETH', 'BNB']

            def _load_crypto(crypto: str) -> tuple[str, Optional[Dict]]:
                return crypto, self.get_crypto_quote(crypto)

            with ThreadPoolExecutor(max_workers=min(3, len(major_cryptos))) as executor:
                for crypto, quote in executor.map(_load_crypto, major_cryptos):
                    if quote:
                        crypto_data[crypto] = {
                            "price": quote['price'],
                            "change": quote['change'],
                            "change_percent": quote['change_percent']
                        }

            payload = {
                "indices": index_data,
                "cryptocurrencies": crypto_data,
                "timestamp": datetime.now().isoformat()
            }
            return self._set_cached("market_overview", payload)
        except Exception as e:
            print(f"Error getting market overview: {e}")
            return {"error": str(e)}

    def search_symbols(self, query: str, limit: int = 10) -> List[Dict]:
        """Search for stocks and cryptocurrencies"""
        query = query.strip()
        if not query:
            return []

        ranked_results: List[tuple[int, Dict]] = []
        seen_symbols: set[str] = set()
        query_upper = query.upper()
        query_lower = query.lower()

        def add_ranked_result(item: Dict):
            symbol = str(item.get("symbol") or "").upper().strip()
            if not symbol or symbol in seen_symbols:
                return
            seen_symbols.add(symbol)
            ranked_results.append((self._search_score(query, symbol, str(item.get("name") or symbol)), item))

        # Prioritize curated local aliases first so obvious names win.
        for base_symbol, details in self.us_equity_aliases.items():
            if (
                query_upper == base_symbol
                or query_lower in details["name"].lower()
                or details["name"].lower().startswith(query_lower)
            ):
                item = self._build_local_stock_match(base_symbol)
                if item:
                    add_ranked_result(item)

        for base_symbol, details in self.india_equity_aliases.items():
            if (
                query_upper == base_symbol
                or query_lower in details["name"].lower()
                or details["name"].lower().startswith(query_lower)
            ):
                item = self._build_local_stock_match(base_symbol)
                if item:
                    add_ranked_result(item)

        # Search stocks from external provider first when configured
        try:
            for item in self._search_stocks_from_fmp(query, limit=limit):
                symbol = item["symbol"]
                quote = self.get_stock_quote(symbol)
                if quote:
                    item["price"] = quote.get("price")
                    item["change_percent"] = quote.get("change_percent")
                add_ranked_result(item)
        except Exception as e:
            print(f"Error searching stocks from FMP for {query}: {e}")

        try:
            remaining = max(limit * 2 - len(ranked_results), 0)
            if remaining > 0:
                for item in self._search_stocks_from_yahoo(query, limit=remaining):
                    symbol = item["symbol"]
                    quote = self.get_stock_quote(symbol)
                    if quote:
                        item["price"] = quote.get("price")
                        item["change_percent"] = quote.get("change_percent")
                    add_ranked_result(item)
        except Exception as e:
            print(f"Error searching stocks from Yahoo for {query}: {e}")

        # Search stocks
        for stock in self.popular_stocks:
            stock_label = self._resolve_search_label(stock)
            if query_upper in stock.upper() or query_lower in stock_label.lower():
                item = self._build_local_stock_match(stock)
                if item:
                    add_ranked_result(item)

        for base_symbol, details in self.india_equity_aliases.items():
            label = f"{details['name']} ({details['exchange']})"
            if query_upper not in base_symbol and query_lower not in details["name"].lower():
                continue
            add_ranked_result({
                "symbol": base_symbol,
                "name": label,
                "type": "stock",
                "price": None,
                "change_percent": None,
                "exchange": details["exchange"],
            })

        # Search cryptos
        for crypto in self.popular_cryptos:
            if query_upper in crypto.upper():
                quote = self.get_crypto_quote(crypto)
                if quote:
                    add_ranked_result({
                        "symbol": crypto,
                        "name": f"{crypto} Coin",
                        "type": "crypto",
                        "price": quote['price'],
                        "change_percent": quote['change_percent']
                    })

        ranked_results.sort(key=lambda item: (-item[0], item[1]["symbol"]))
        return [item for _, item in ranked_results[:limit]]

    def get_top_movers(self, limit: int = 10) -> Dict:
        """Get top gaining and losing stocks/cryptos"""
        cache_key = f"top_movers:{limit}"
        cached = self._get_cached(cache_key, self._top_movers_cache_ttl)
        if cached is not None:
            return cached
        try:
            gainers = []
            losers = []

            # Check popular stocks
            for symbol in self.popular_stocks[:8]:
                quote = self.get_stock_quote(symbol)
                if quote and 'change_percent' in quote:
                    change_pct = float(quote['change_percent'].rstrip('%'))
                    item = {
                        "symbol": symbol,
                        "name": symbol,
                        "price": quote['price'],
                        "change": quote['change'],
                        "change_percent": quote['change_percent']
                    }

                    if change_pct > 0:
                        gainers.append(item)
                    elif change_pct < 0:
                        losers.append(item)

            # Check popular cryptos
            for symbol in self.popular_cryptos[:5]:
                quote = self.get_crypto_quote(symbol)
                if quote and 'change_percent' in quote:
                    change_pct = float(quote['change_percent'].rstrip('%'))
                    item = {
                        "symbol": symbol,
                        "name": f"{symbol} Coin",
                        "price": quote['price'],
                        "change": quote['change'],
                        "change_percent": quote['change_percent']
                    }

                    if change_pct > 0:
                        gainers.append(item)
                    elif change_pct < 0:
                        losers.append(item)

            # Sort and limit
            gainers.sort(key=lambda x: float(x['change_percent'].rstrip('%')), reverse=True)
            losers.sort(key=lambda x: float(x['change_percent'].rstrip('%')))

            payload = {
                "gainers": gainers[:limit],
                "losers": losers[:limit],
                "timestamp": datetime.now().isoformat()
            }
            return self._set_cached(cache_key, payload)
        except Exception as e:
            print(f"Error getting top movers: {e}")
            return {"error": str(e)}

# Example usage
if __name__ == "__main__":
    service = MarketDataService()

    # Test stock quote
    quote = service.get_stock_quote("AAPL")
    print(f"Apple Quote: {quote}")

    # Test crypto quote
    crypto_quote = service.get_crypto_quote("BTC")
    print(f"Bitcoin Quote: {crypto_quote}")

    # Test technical analysis
    analysis = service.get_technical_analysis("AAPL")
    print(f"Technical Analysis: {analysis}")

    # Test market overview
    overview = service.get_market_overview()
    print(f"Market Overview: {overview}")
