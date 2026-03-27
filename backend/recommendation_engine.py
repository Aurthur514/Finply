from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from ai_engine import HedgeFundAI
from market_data import MarketDataService
from ml_models.news_predictor import NewsStockPredictor
from openai_service import OpenAIService


@dataclass(frozen=True)
class DriverDefinition:
    symbol: str
    name: str
    category: str
    region: str
    weight: float


class RecommendationEngine:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.market_service = MarketDataService()
        self.news_predictor = NewsStockPredictor()
        self.openai_service = OpenAIService()
        self.ai_engine = HedgeFundAI(db_session)
        self.global_drivers: List[DriverDefinition] = [
            DriverDefinition("^GSPC", "S&P 500", "equity_index", "US", 1.0),
            DriverDefinition("^IXIC", "NASDAQ", "equity_index", "US", 1.1),
            DriverDefinition("^DJI", "Dow Jones", "equity_index", "US", 0.8),
            DriverDefinition("^VIX", "Volatility Index", "risk", "US", 1.2),
            DriverDefinition("^TNX", "US 10Y Treasury Yield", "rates", "US", 1.1),
            DriverDefinition("DX-Y.NYB", "US Dollar Index", "fx", "Global", 0.9),
            DriverDefinition("GC=F", "Gold Futures", "commodity", "Global", 0.5),
            DriverDefinition("CL=F", "Crude Oil Futures", "commodity", "Global", 0.9),
            DriverDefinition("HG=F", "Copper Futures", "commodity", "Global", 0.7),
            DriverDefinition("^FTSE", "FTSE 100", "equity_index", "Europe", 0.5),
            DriverDefinition("^GDAXI", "DAX", "equity_index", "Europe", 0.6),
            DriverDefinition("^N225", "Nikkei 225", "equity_index", "Asia", 0.6),
            DriverDefinition("^HSI", "Hang Seng", "equity_index", "Asia", 0.6),
            DriverDefinition("XLK", "Technology Select Sector", "sector", "US", 1.0),
            DriverDefinition("XLF", "Financial Select Sector", "sector", "US", 0.95),
            DriverDefinition("XLE", "Energy Select Sector", "sector", "US", 0.95),
            DriverDefinition("XLV", "Health Care Select Sector", "sector", "US", 0.7),
            DriverDefinition("XLI", "Industrial Select Sector", "sector", "US", 0.7),
            DriverDefinition("XLY", "Consumer Discretionary", "sector", "US", 0.7),
            DriverDefinition("XLP", "Consumer Staples", "sector", "US", 0.55),
            DriverDefinition("SOXX", "Semiconductor ETF", "sector", "US", 1.2),
            DriverDefinition("BTC", "Bitcoin", "crypto", "Global", 0.4),
            DriverDefinition("ETH", "Ethereum", "crypto", "Global", 0.3),
        ]
        self.symbol_sector_map = {
            "AAPL": "technology",
            "MSFT": "technology",
            "NVDA": "technology",
            "AMD": "technology",
            "TSLA": "consumer_discretionary",
            "AMZN": "consumer_discretionary",
            "META": "technology",
            "GOOGL": "technology",
            "NFLX": "communication",
            "JPM": "financials",
            "BAC": "financials",
            "C": "financials",
            "GS": "financials",
            "XOM": "energy",
            "CVX": "energy",
            "RELIANCE.NS": "energy",
            "TCS.NS": "technology",
            "INFY.NS": "technology",
            "HDFCBANK.NS": "financials",
            "RELIANCE.BO": "energy",
            "TCS.BO": "technology",
            "INFY.BO": "technology",
            "HDFCBANK.BO": "financials",
            "BTC": "crypto",
            "ETH": "crypto",
        }

    def generate_recommendation(self, symbol: str, forecast_days: int = 30) -> Dict[str, Any]:
        normalized_symbol = symbol.upper().strip()
        quote = self.market_service.get_quote(normalized_symbol)
        if not quote:
            raise ValueError(f"{normalized_symbol} is not a supported market symbol")

        technical = self.market_service.get_technical_analysis(normalized_symbol)
        baseline_prediction = self.ai_engine.generate_prediction(normalized_symbol)
        news = self.news_predictor.fetch_news(f"{normalized_symbol} market", days=2)[:6]
        news_model = self.news_predictor.predict_stock_movement(normalized_symbol)
        global_context = self.get_global_context(normalized_symbol)
        forecast = self.build_forecast(
            normalized_symbol,
            global_context,
            forecast_days,
            current_price_override=float(quote.get("price", 0.0) or 0.0),
        )
        signal, confidence, rationale = self._merge_views(
            baseline_prediction=baseline_prediction,
            technical=technical,
            news_model=news_model,
            global_context=global_context,
            forecast=forecast,
        )

        recommendation = {
            "symbol": normalized_symbol,
            "signal": signal,
            "confidence": confidence,
            "predicted_price": forecast["scenarios"]["base"]["target_price"],
            "reasoning": rationale,
            "risk_summary": global_context["risk_summary"],
            "catalysts": [driver["name"] for driver in global_context["top_positive_drivers"][:3]],
            "provider": "Sentinel Quant Engine",
            "model": "macro-aware-v2",
            "components": baseline_prediction.get("components", {}),
            "timestamp": baseline_prediction.get("timestamp"),
            "global_context": global_context,
            "forecast": forecast,
            "recommendation_summary": {
                "stance": signal,
                "entry_bias": "accumulate on weakness" if signal == "BUY" else "wait for confirmation" if signal == "HOLD" else "reduce strength / hedge",
                "time_horizon_days": forecast_days,
                "expected_return_percent": forecast["scenarios"]["base"]["return_percent"],
            },
            "news_themes": news_model.get("themes", []),
            "news": news,
        }

        if self.openai_service.enabled:
            ai_prediction = self.openai_service.generate_prediction(
                normalized_symbol,
                {
                    "quote": quote,
                    "technical": technical,
                    "baseline_prediction": baseline_prediction,
                    "global_context": global_context,
                    "forecast": forecast,
                    "news": news,
                    "news_model": news_model,
                },
            )
            if ai_prediction:
                recommendation["signal"] = ai_prediction["signal"]
                recommendation["confidence"] = round((recommendation["confidence"] + ai_prediction["confidence"]) / 2, 2)
                recommendation["predicted_price"] = ai_prediction["predicted_price"] or recommendation["predicted_price"]
                recommendation["reasoning"] = ai_prediction["reasoning"]
                recommendation["risk_summary"] = ai_prediction.get("risk_summary") or recommendation["risk_summary"]
                recommendation["catalysts"] = ai_prediction.get("catalysts", recommendation["catalysts"])
                recommendation["provider"] = ai_prediction.get("provider", recommendation["provider"])
                recommendation["model"] = ai_prediction.get("model", recommendation["model"])

        return recommendation

    def get_global_context(self, symbol: str) -> Dict[str, Any]:
        profile = self._infer_symbol_profile(symbol)
        target_history = self.market_service.get_historical_data(symbol, period="3mo", interval="1d")
        if target_history is None or target_history.empty:
            target_history = self._synthetic_history(symbol)
        target_returns = self._returns(target_history)

        driver_impacts = []
        for definition in self._relevant_drivers(profile):
            driver_history = self.market_service.get_historical_data(definition.symbol, period="3mo", interval="1d")
            if driver_history is None or driver_history.empty:
                driver_history = self._synthetic_history(definition.symbol)
            driver_returns = self._returns(driver_history)
            latest_move = self._latest_return_pct(driver_history)
            correlation = self._safe_correlation(target_returns, driver_returns)
            if np.isnan(correlation):
                correlation = 0.0

            impact_score = latest_move * correlation * definition.weight
            relationship = "supports" if impact_score > 0 else "pressures" if impact_score < 0 else "neutral"
            driver_impacts.append(
                {
                    "symbol": definition.symbol,
                    "name": definition.name,
                    "category": definition.category,
                    "region": definition.region,
                    "latest_move_percent": round(latest_move, 2),
                    "correlation": round(correlation, 3),
                    "impact_score": round(impact_score, 3),
                    "relationship": relationship,
                }
            )

        driver_impacts.sort(key=lambda item: abs(item["impact_score"]), reverse=True)
        top_positive = [item for item in driver_impacts if item["impact_score"] > 0][:5]
        top_negative = [item for item in driver_impacts if item["impact_score"] < 0][:5]

        risk_regime = self._build_risk_regime(driver_impacts)
        risk_summary = (
            f"Global regime is {risk_regime['label'].lower()} with a composite score of {risk_regime['score']:.2f}. "
            f"The largest tailwinds are {self._list_names(top_positive[:2]) or 'limited'}, while the main headwinds are "
            f"{self._list_names(top_negative[:2]) or 'limited'}."
        )

        return {
            "profile": profile,
            "risk_regime": risk_regime,
            "top_positive_drivers": top_positive,
            "top_negative_drivers": top_negative,
            "driver_map": driver_impacts[:10],
            "risk_summary": risk_summary,
        }

    def build_forecast(
        self,
        symbol: str,
        global_context: Dict[str, Any],
        forecast_days: int,
        current_price_override: Optional[float] = None,
    ) -> Dict[str, Any]:
        history = self.market_service.get_historical_data(symbol, period="6mo", interval="1d")
        if history is None or history.empty:
            history = self._synthetic_history(symbol, periods=252)

        close = history["close"].dropna()
        returns = close.pct_change().dropna()
        history_price = float(close.iloc[-1])
        current_price = float(current_price_override) if current_price_override and current_price_override > 0 else history_price
        daily_drift = float(returns.mean()) if not returns.empty else 0.0005
        daily_vol = float(returns.std()) if not returns.empty else 0.02
        regime_score = float(global_context["risk_regime"]["score"])
        macro_bias = regime_score * 0.0015

        base_return = (daily_drift + macro_bias) * forecast_days
        bull_return = base_return + (daily_vol * np.sqrt(forecast_days) * 0.9)
        bear_return = base_return - (daily_vol * np.sqrt(forecast_days) * 1.1)

        scenarios = {
            "bull": self._scenario_payload(current_price, bull_return, 0.25),
            "base": self._scenario_payload(current_price, base_return, 0.5),
            "bear": self._scenario_payload(current_price, bear_return, 0.25),
        }

        confidence_band = daily_vol * np.sqrt(forecast_days)
        path = self._forecast_path(current_price, base_return, confidence_band, forecast_days)

        return {
            "horizon_days": forecast_days,
            "current_price": round(current_price, 2),
            "expected_volatility_percent": round(confidence_band * 100, 2),
            "macro_bias_score": round(regime_score, 3),
            "scenarios": scenarios,
            "path": path,
        }

    def _merge_views(
        self,
        baseline_prediction: Dict[str, Any],
        technical: Dict[str, Any],
        news_model: Dict[str, Any],
        global_context: Dict[str, Any],
        forecast: Dict[str, Any],
    ) -> tuple[str, float, str]:
        score = 0.0
        signal_map = {"BUY": 1.0, "HOLD": 0.0, "SELL": -1.0}

        baseline_signal = str(baseline_prediction.get("signal", "HOLD")).upper()
        score += signal_map.get(baseline_signal, 0.0) * float(baseline_prediction.get("confidence", 0.6))

        recommendation = technical.get("recommendation", {})
        technical_action = str(recommendation.get("action", "HOLD"))
        if "BUY" in technical_action:
            score += 0.35
        elif "SELL" in technical_action:
            score -= 0.35

        score += (float(news_model.get("probability_up", 0.5)) - 0.5) * 1.2
        score += float(global_context["risk_regime"]["score"]) * 0.8
        score += float(forecast["scenarios"]["base"]["return_percent"]) / 100

        if score > 0.55:
            signal = "BUY"
        elif score < -0.55:
            signal = "SELL"
        else:
            signal = "HOLD"

        confidence = round(min(0.96, 0.52 + abs(score) * 0.35), 2)
        rationale = (
            f"{signal} bias based on blended symbol momentum, deterministic news sentiment, and global transmission effects. "
            f"Base-case {forecast['horizon_days']}-day return is {forecast['scenarios']['base']['return_percent']:.2f}%, "
            f"while the market regime is {global_context['risk_regime']['label'].lower()}."
        )
        return signal, confidence, rationale

    def _forecast_path(self, current_price: float, base_return: float, confidence_band: float, forecast_days: int) -> List[Dict[str, Any]]:
        checkpoints = sorted(set([0, max(1, forecast_days // 4), max(2, forecast_days // 2), forecast_days]))
        path = []
        for day in checkpoints:
            progress = day / max(forecast_days, 1)
            projected_return = base_return * progress
            midpoint = current_price * (1 + projected_return)
            band = current_price * confidence_band * np.sqrt(max(progress, 0.0001)) * 0.5
            path.append(
                {
                    "day": int(day),
                    "mid": round(midpoint, 2),
                    "low": round(max(0.01, midpoint - band), 2),
                    "high": round(midpoint + band, 2),
                }
            )
        return path

    def _scenario_payload(self, current_price: float, projected_return: float, probability: float) -> Dict[str, Any]:
        target_price = current_price * (1 + projected_return)
        return {
            "target_price": round(target_price, 2),
            "return_percent": round(projected_return * 100, 2),
            "probability": probability,
        }

    def _build_risk_regime(self, driver_impacts: List[Dict[str, Any]]) -> Dict[str, Any]:
        weights = {
            "^VIX": -1.2,
            "^TNX": -0.8,
            "DX-Y.NYB": -0.6,
            "^GSPC": 0.8,
            "^IXIC": 0.9,
            "XLK": 0.7,
            "SOXX": 0.8,
            "CL=F": 0.2,
            "HG=F": 0.35,
            "BTC": 0.25,
        }
        score = 0.0
        for item in driver_impacts:
            multiplier = weights.get(item["symbol"], 0.15)
            score += (item["latest_move_percent"] / 100) * multiplier

        if score > 0.04:
            label = "Risk On"
        elif score < -0.04:
            label = "Risk Off"
        else:
            label = "Mixed"

        return {"label": label, "score": round(score, 3)}

    def _relevant_drivers(self, profile: Dict[str, Any]) -> List[DriverDefinition]:
        preferred_categories = {"equity_index", "risk", "rates", "fx", "commodity"}
        sector = profile["sector"]

        if sector == "technology":
            preferred_categories.add("sector")
        elif sector == "financials":
            preferred_categories.update({"sector", "rates"})
        elif sector == "energy":
            preferred_categories.update({"sector", "commodity"})
        elif sector == "crypto":
            preferred_categories.add("crypto")

        selected = []
        for definition in self.global_drivers:
            if definition.category not in preferred_categories and definition.category != "crypto":
                continue
            if sector == "technology" and definition.symbol not in {"XLK", "SOXX"} and definition.category == "sector":
                continue
            if sector == "financials" and definition.symbol != "XLF" and definition.category == "sector":
                continue
            if sector == "energy" and definition.symbol != "XLE" and definition.category == "sector":
                continue
            if sector == "crypto" and definition.category not in {"crypto", "risk", "fx", "rates"}:
                continue
            selected.append(definition)

        return selected[:4]

    def _infer_symbol_profile(self, symbol: str) -> Dict[str, Any]:
        sector = self.symbol_sector_map.get(symbol, "broad_market")
        if symbol.endswith(".NS") or symbol.endswith(".BO"):
            region = "India"
        elif symbol in {"BTC", "ETH", "BNB", "SOL", "ADA"}:
            region = "Global"
        else:
            region = "US"

        asset_type = "crypto" if self.market_service._is_known_crypto(symbol) else "equity"
        return {
            "symbol": symbol,
            "sector": sector,
            "region": region,
            "asset_type": asset_type,
        }

    def _returns(self, df: Optional[pd.DataFrame]) -> pd.Series:
        if df is None or df.empty or "close" not in df:
            return pd.Series(dtype=float)
        return df["close"].pct_change().dropna().tail(45)

    def _latest_return_pct(self, df: Optional[pd.DataFrame]) -> float:
        returns = self._returns(df)
        if returns.empty:
            return 0.0
        return float(returns.iloc[-1] * 100)

    def _safe_correlation(self, left: pd.Series, right: pd.Series) -> float:
        if left.empty or right.empty:
            return 0.0
        aligned = pd.concat([left, right], axis=1, join="inner").dropna()
        if len(aligned) < 15:
            return 0.0
        return float(aligned.iloc[:, 0].corr(aligned.iloc[:, 1]) or 0.0)

    def _list_names(self, items: List[Dict[str, Any]]) -> str:
        names = [item["name"] for item in items if item.get("name")]
        return ", ".join(names)

    def _synthetic_history(self, symbol: str, periods: int = 180) -> pd.DataFrame:
        seed = sum(ord(char) for char in symbol)
        base_price = 60 + (seed % 220)
        index = pd.date_range(end=pd.Timestamp.utcnow(), periods=periods, freq="D")
        steps = np.arange(periods)
        slope = ((seed % 13) - 6) / 900
        seasonal = np.sin((steps / max(periods, 1)) * np.pi * 6 + (seed % 11)) * 0.025
        trend = 1 + (steps * slope)
        close = base_price * trend * (1 + seasonal)
        frame = pd.DataFrame(
            {
                "open": close * 0.996,
                "high": close * 1.008,
                "low": close * 0.992,
                "close": close,
                "volume": np.full(periods, 1000000 + (seed % 500000)),
            },
            index=index,
        )
        frame.index.name = "date"
        return frame
