from __future__ import annotations

from typing import Any, Dict, List

from market_data import MarketDataService
from ml_models.news_predictor import NewsStockPredictor
from recommendation_engine import RecommendationEngine
from sqlalchemy.orm import Session


class ResearchEngine:
    """Build a structured investment memo inspired by FinRobot-style research workflows."""

    def __init__(self, db_session: Session):
        self.db = db_session
        self.market_service = MarketDataService()
        self.news_predictor = NewsStockPredictor()
        self.recommendation_engine = RecommendationEngine(db_session)

    def build_research_memo(self, symbol: str, horizon_days: int = 30) -> Dict[str, Any]:
        normalized_symbol = symbol.upper().strip()
        quote = self.market_service.get_quote(normalized_symbol)
        if not quote:
            raise ValueError(f"{normalized_symbol} is not a supported market symbol")

        technical = self.market_service.get_technical_analysis(normalized_symbol)
        recommendation = self.recommendation_engine.generate_recommendation(
            normalized_symbol, forecast_days=horizon_days
        )
        global_context = recommendation.get("global_context", {})
        forecast = recommendation.get("forecast", {})
        news = recommendation.get("news", [])[:5]
        news_themes = recommendation.get("news_themes", [])[:5]

        signal = str(recommendation.get("signal", "HOLD")).upper()
        confidence = float(recommendation.get("confidence", 0.0))
        predicted_price = recommendation.get("predicted_price")
        current_price = float(quote.get("price", 0.0) or 0.0)
        price_gap_pct = (
            ((float(predicted_price) / current_price) - 1) * 100
            if predicted_price and current_price > 0
            else None
        )

        stance = self._stance_label(signal, confidence)
        catalysts = recommendation.get("catalysts", [])[:4]
        top_positive = global_context.get("top_positive_drivers", [])[:3]
        top_negative = global_context.get("top_negative_drivers", [])[:3]
        recommendation_action = technical.get("recommendation", {}).get("action", "HOLD")
        recommendation_confidence = technical.get("recommendation", {}).get("confidence", "medium")

        thesis_points = [
            f"AI composite signal is {signal} with {(confidence * 100):.0f}% confidence over a {horizon_days}-day horizon.",
            f"Technical posture currently reads {recommendation_action} with {recommendation_confidence} confidence.",
            self._scenario_sentence(forecast),
        ]
        if catalysts:
            thesis_points.append(f"Primary catalysts include {', '.join(catalysts[:3])}.")

        risk_points = []
        if global_context.get("risk_summary"):
            risk_points.append(global_context["risk_summary"])
        if top_negative:
            risk_points.append(
                "Key external pressure points: "
                + ", ".join(driver["name"] for driver in top_negative)
                + "."
            )
        if price_gap_pct is not None and abs(price_gap_pct) > 15:
            risk_points.append(
                f"The projected move of {price_gap_pct:.1f}% is large enough that execution timing and volatility matter."
            )

        diligence_questions = [
            f"What could invalidate the current {signal} thesis for {normalized_symbol} over the next {horizon_days} days?",
            "Are the top catalysts already priced in, or is there still room for rerating?",
            "Does the macro driver map align with the company or asset's own fundamentals?",
            "Would a smaller starter position make more sense than a full allocation at current volatility?",
        ]

        memo = {
            "symbol": normalized_symbol,
            "generated_at": recommendation.get("timestamp"),
            "stance": stance,
            "overview": {
                "price": current_price,
                "change_percent": quote.get("change_percent"),
                "signal": signal,
                "confidence": confidence,
                "predicted_price": predicted_price,
                "price_gap_percent": round(price_gap_pct, 2) if price_gap_pct is not None else None,
                "market_cap": quote.get("market_cap"),
                "pe_ratio": quote.get("pe_ratio"),
                "dividend_yield": quote.get("dividend_yield"),
                "source": quote.get("source"),
            },
            "executive_summary": (
                f"{normalized_symbol} screens as a {stance.lower()} idea. "
                f"The combined model leans {signal.lower()} with {(confidence * 100):.0f}% confidence, "
                f"while the technical stack currently reads {recommendation_action.lower()}."
            ),
            "investment_thesis": thesis_points,
            "catalysts": [
                {
                    "title": catalyst,
                    "detail": self._catalyst_detail(catalyst, top_positive),
                }
                for catalyst in catalysts
            ],
            "risk_flags": risk_points,
            "valuation_snapshot": {
                "market_cap": quote.get("market_cap"),
                "pe_ratio": quote.get("pe_ratio"),
                "dividend_yield": quote.get("dividend_yield"),
                "predicted_price": predicted_price,
                "expected_return_percent": recommendation.get("recommendation_summary", {}).get(
                    "expected_return_percent"
                ),
            },
            "technical_snapshot": {
                "action": recommendation_action,
                "confidence": recommendation_confidence,
                "signals": technical.get("signals", [])[:5],
            },
            "macro_driver_map": {
                "tailwinds": top_positive,
                "headwinds": top_negative,
                "risk_summary": global_context.get("risk_summary"),
            },
            "news_brief": [
                {
                    "title": item.get("title"),
                    "summary": item.get("summary") or item.get("description"),
                    "sentiment": item.get("sentiment"),
                }
                for item in news
            ],
            "theme_brief": news_themes,
            "diligence_questions": diligence_questions,
        }
        return memo

    def _stance_label(self, signal: str, confidence: float) -> str:
        if signal == "BUY" and confidence >= 0.7:
            return "Accumulation Candidate"
        if signal == "SELL" and confidence >= 0.7:
            return "Risk Reduction Candidate"
        if signal == "BUY":
            return "Watchlist Long"
        if signal == "SELL":
            return "Watchlist Avoid"
        return "Neutral / Wait"

    def _scenario_sentence(self, forecast: Dict[str, Any]) -> str:
        scenarios = forecast.get("scenarios", {})
        base = scenarios.get("base", {})
        bull = scenarios.get("bull", {})
        bear = scenarios.get("bear", {})
        if not base:
            return "Forward scenario framing is limited due to incomplete forecast data."
        return (
            f"Base-case target is ${float(base.get('target_price', 0.0)):.2f}, "
            f"with bull case ${float(bull.get('target_price', 0.0)):.2f} and bear case "
            f"${float(bear.get('target_price', 0.0)):.2f}."
        )

    def _catalyst_detail(self, catalyst: str, top_positive: List[Dict[str, Any]]) -> str:
        match = next(
            (driver for driver in top_positive if catalyst.lower() in driver.get("name", "").lower()),
            None,
        )
        if match:
            return (
                f"{match['name']} is currently acting as a supportive macro/sector input "
                f"with impact score {match['impact_score']:.2f}."
            )
        return f"{catalyst} appears to be one of the leading near-term variables in the current setup."

