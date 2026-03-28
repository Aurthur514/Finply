from __future__ import annotations

from typing import Any, Dict, List

from sqlalchemy.orm import Session

from market_data import MarketDataService
from ml_models.news_predictor import NewsStockPredictor
from recommendation_engine import RecommendationEngine
from research_engine import ResearchEngine


class ScenarioEngine:
    """Finance-focused scenario simulator inspired by MiroFish-style seed + simulation workflows."""

    def __init__(self, db_session: Session):
        self.db = db_session
        self.market_service = MarketDataService()
        self.news_predictor = NewsStockPredictor()
        self.recommendation_engine = RecommendationEngine(db_session)
        self.research_engine = ResearchEngine(db_session)

    def suggest_news_scenarios(self, symbol: str, days: int = 3) -> Dict[str, Any]:
        normalized_symbol = symbol.upper().strip()
        quote = self._scenario_quote(normalized_symbol)
        if not quote:
            raise ValueError(f"{normalized_symbol} is not a supported market symbol")

        company_context = self._company_context(normalized_symbol)
        query_terms = [normalized_symbol, company_context["company_name"], *company_context["aliases"], "stock", "company"]
        news = self.news_predictor.fetch_news(" ".join([item for item in query_terms if item]), days=days)
        if not news:
            fallback_seed = self._fallback_market_seed(normalized_symbol, company_context["company_name"], quote)
            return {
                "symbol": normalized_symbol,
                "company_name": company_context["company_name"],
                "days": days,
                "overall_sentiment": "neutral",
                "theme_brief": [],
                "seeds": [fallback_seed],
            }

        summary = self.news_predictor.summarize_news_sentiment(" ".join([item for item in query_terms if item]), days=days)
        global_variables = [self._theme_to_variable(item["theme"], item["direction"]) for item in summary.get("themes", [])[:4]]

        seeds = []
        for article in news[:5]:
            text = f"{article.get('title', '')} {article.get('description', '')}"
            sentiment = self.news_predictor.analyze_sentiment(self.news_predictor.clean_text(text))
            local_themes = self.news_predictor.extract_market_themes([article])
            variables = [self._theme_to_variable(item["theme"], item["direction"]) for item in local_themes[:3]]
            merged_variables = list(dict.fromkeys([*variables, *global_variables]))[:5]
            impact = self._explain_news_impact(
                normalized_symbol,
                company_context["company_name"],
                article,
                local_themes,
                sentiment["sentiment"],
            )
            seeds.append(
                {
                    "headline": article.get("title"),
                    "summary": article.get("description"),
                    "published_at": article.get("publishedAt"),
                    "seed_event": self._headline_to_seed_event(normalized_symbol, article),
                    "variables": merged_variables,
                    "sentiment": sentiment["sentiment"],
                    "confidence": sentiment["confidence"],
                    "company_name": company_context["company_name"],
                    "impact_summary": impact["impact_summary"],
                    "why_it_matters": impact["why_it_matters"],
                    "effect_path": impact["effect_path"],
                }
            )

        return {
            "symbol": normalized_symbol,
            "company_name": company_context["company_name"],
            "days": days,
            "overall_sentiment": summary.get("overall_sentiment", "neutral"),
            "theme_brief": summary.get("themes", []),
            "seeds": seeds,
        }

    def simulate(
        self,
        symbol: str,
        seed_event: str,
        horizon_days: int = 30,
        variables: List[str] | None = None,
    ) -> Dict[str, Any]:
        normalized_symbol = symbol.upper().strip()
        quote = self._scenario_quote(normalized_symbol)
        if not quote:
            raise ValueError(f"{normalized_symbol} is not a supported market symbol")

        event_text = seed_event.strip()
        if not event_text:
            raise ValueError("A seed event is required to run a scenario simulation")

        variable_list = [item.strip() for item in (variables or []) if item and item.strip()]
        current_price = float(quote.get("price", 0.0) or 0.0)
        event_bias = self._event_bias(event_text)
        variable_bias = self._variable_bias(variable_list)
        combined_bias = event_bias + variable_bias
        technical = self.market_service.get_technical_analysis(normalized_symbol)
        global_context = self.market_service._run_with_timeout(
            lambda: self.recommendation_engine.get_global_context(normalized_symbol),
            timeout_seconds=3.5,
            fallback=self._fallback_global_context(),
        ) or self._fallback_global_context()
        forecast = self.market_service._run_with_timeout(
            lambda: self.recommendation_engine.build_forecast(
                normalized_symbol,
                global_context,
                horizon_days,
                current_price_override=current_price,
            ),
            timeout_seconds=3.5,
            fallback=self._fallback_forecast(current_price, horizon_days, combined_bias),
        ) or self._fallback_forecast(current_price, horizon_days, combined_bias)

        base_scenario = forecast.get("scenarios", {}).get("base", {})
        bull_scenario = forecast.get("scenarios", {}).get("bull", {})
        bear_scenario = forecast.get("scenarios", {}).get("bear", {})

        adjusted_bull = self._adjust_target(current_price, bull_scenario.get("return_percent", 0.0), combined_bias * 0.7)
        adjusted_base = self._adjust_target(current_price, base_scenario.get("return_percent", 0.0), combined_bias * 0.45)
        adjusted_bear = self._adjust_target(current_price, bear_scenario.get("return_percent", 0.0), combined_bias * 0.2)

        mode = "upside" if combined_bias > 0.4 else "downside" if combined_bias < -0.4 else "balanced"
        pressure_map = self._pressure_map(variable_list, global_context)
        signal = self._scenario_signal(technical, combined_bias)
        confidence = self._scenario_confidence(technical, combined_bias)

        return {
            "symbol": normalized_symbol,
            "seed_event": event_text,
            "horizon_days": horizon_days,
            "mode": mode,
            "bias_score": round(combined_bias, 2),
            "variables": variable_list,
            "overview": {
                "current_price": round(current_price, 2),
                "source": quote.get("source"),
                "signal": signal,
                "confidence": confidence,
            },
            "scenario_tree": {
                "bull": adjusted_bull,
                "base": adjusted_base,
                "bear": adjusted_bear,
            },
            "pressure_map": pressure_map,
            "simulation_report": {
                "executive_take": self._executive_take(normalized_symbol, event_text, mode, adjusted_base),
                "world_state": self._world_state_summary(global_context, technical, variable_list),
                "critical_paths": self._critical_paths(variable_list, global_context, technical),
                "warning_flags": self._warning_flags(mode, technical, pressure_map),
                "decision_playbook": self._decision_playbook(mode, adjusted_base, adjusted_bear, adjusted_bull),
            },
        }

    def _event_bias(self, seed_event: str) -> float:
        positive_markers = ["beat", "approval", "upgrade", "surge", "launch", "strong", "growth", "contract", "stimulus"]
        negative_markers = ["miss", "ban", "probe", "downgrade", "delay", "weak", "cut", "lawsuit", "tariff", "risk"]
        score = 0.0
        lower = seed_event.lower()
        for marker in positive_markers:
            if marker in lower:
                score += 0.35
        for marker in negative_markers:
            if marker in lower:
                score -= 0.35
        return max(-1.5, min(1.5, score))

    def _variable_bias(self, variables: List[str]) -> float:
        score = 0.0
        for variable in variables:
            lower = variable.lower()
            if any(token in lower for token in ["higher demand", "margin expansion", "policy support", "usd weak", "lower yields", "better guidance"]):
                score += 0.2
            if any(token in lower for token in ["regulation", "cost pressure", "usd strong", "higher yields", "supply shock", "execution risk"]):
                score -= 0.2
        return max(-1.0, min(1.0, score))

    def _adjust_target(self, current_price: float, base_return_percent: float, bias_percent: float) -> Dict[str, float]:
        total_return_percent = float(base_return_percent) + (bias_percent * 100)
        target_price = current_price * (1 + (total_return_percent / 100))
        return {
            "target_price": round(target_price, 2),
            "return_percent": round(total_return_percent, 2),
        }

    def _pressure_map(self, variables: List[str], global_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        map_items: List[Dict[str, Any]] = []
        for item in global_context.get("driver_map", [])[:5]:
            map_items.append(
                {
                    "name": item.get("name"),
                    "impact_score": item.get("impact_score"),
                    "relationship": item.get("relationship"),
                    "type": "market_driver",
                }
            )
        for variable in variables[:5]:
            map_items.append(
                {
                    "name": variable,
                    "impact_score": round(self._variable_bias([variable]), 2),
                    "relationship": "supports" if self._variable_bias([variable]) >= 0 else "pressures",
                    "type": "scenario_variable",
                }
            )
        return map_items[:8]

    def _executive_take(self, symbol: str, event_text: str, mode: str, adjusted_base: Dict[str, float]) -> str:
        return (
            f"{symbol} is being simulated against the seed event '{event_text}'. "
            f"The scenario currently resolves to a {mode} path, with a base-case target of "
            f"${adjusted_base['target_price']:.2f} over the modeled horizon."
        )

    def _world_state_summary(self, global_context: Dict[str, Any], technical: Dict[str, Any], variables: List[str]) -> str:
        risk_summary = global_context.get("risk_summary") or "Macro conditions are mixed."
        technical_action = technical.get("recommendation", {}).get("action", "HOLD")
        variable_clause = f" Scenario variables in play: {', '.join(variables[:4])}." if variables else ""
        return f"{risk_summary} Technical posture currently reads {technical_action}.{variable_clause}"

    def _critical_paths(self, variables: List[str], global_context: Dict[str, Any], technical: Dict[str, Any]) -> List[str]:
        catalysts = [item.get("name") for item in global_context.get("top_positive_drivers", []) if item.get("name")]
        paths = []
        if variables:
            paths.append(f"If {variables[0]} materializes early, narrative momentum can accelerate the base case.")
        if catalysts:
            paths.append(f"Watch whether {catalysts[0]} acts as a confirmation catalyst rather than just a headline.")
        if technical.get("signals"):
            paths.append(f"Technical signal watch: {technical['signals'][0].get('signal', 'trend confirmation')} should hold to support the current branch.")
        paths.append("Monitor whether macro tailwinds remain aligned with the stock-specific narrative after the first market reaction.")
        return paths[:3]

    def _warning_flags(self, mode: str, technical: Dict[str, Any], pressure_map: List[Dict[str, Any]]) -> List[str]:
        flags: List[str] = []
        technical_signals = technical.get("signals", [])
        if technical_signals:
            flags.append(f"Technical watchpoint: {technical_signals[-1].get('signal', 'signal deterioration')}.")
        negative_pressures = [item for item in pressure_map if float(item.get("impact_score", 0.0) or 0.0) < 0]
        if mode == "downside":
            flags.append("Scenario engine is leaning risk-off; downside path deserves tighter trade sizing.")
        if negative_pressures:
            flags.append(f"Primary pressure point: {negative_pressures[0]['name']}.")
        return flags[:4]

    def _decision_playbook(
        self,
        mode: str,
        base: Dict[str, float],
        bear: Dict[str, float],
        bull: Dict[str, float],
    ) -> List[str]:
        if mode == "upside":
            return [
                f"Base case points to ${base['target_price']:.2f}; consider accumulation only if the seed event gains confirmation.",
                f"Use the bear path near ${bear['target_price']:.2f} as a stress anchor for sizing.",
                "Prefer staged entries over one-shot conviction buys.",
            ]
        if mode == "downside":
            return [
                f"Base case is fragile; protect against a move toward ${bear['target_price']:.2f}.",
                "Wait for confirmation before adding risk and favor defense over anticipation.",
                f"Upside recovery scenario still exists near ${bull['target_price']:.2f}, but it needs catalyst validation.",
            ]
        return [
            f"Balanced scenario around ${base['target_price']:.2f}; let confirmation break the tie.",
            "Track whether follow-through headlines improve or weaken the current setup.",
            "Keep position size moderate until one branch of the tree becomes dominant.",
        ]

    def _headline_to_seed_event(self, symbol: str, article: Dict[str, Any]) -> str:
        title = (article.get("title") or "").strip()
        summary = (article.get("description") or "").strip()
        if title and summary:
            return f"{title}. Market narrative: {summary}"
        return title or summary or "A new market development emerges"

    def _theme_to_variable(self, theme: str, direction: str) -> str:
        labels = {
            "monetary_policy": "interest-rate path",
            "energy": "energy-input pricing",
            "technology": "AI and semiconductor demand",
            "consumer": "consumer spending resilience",
            "geopolitics": "geopolitical risk premium",
            "financials": "credit and liquidity conditions",
        }
        base = labels.get(theme, theme.replace("_", " "))
        if direction == "tailwind":
            return f"stronger {base}"
        return f"worsening {base}"

    def _company_context(self, symbol: str) -> Dict[str, Any]:
        normalized = symbol.upper().strip()
        india_aliases = getattr(self.market_service, "india_equity_aliases", {})
        if normalized in india_aliases:
            details = india_aliases[normalized]
            return {
                "company_name": details.get("name", normalized),
                "aliases": [normalized, details.get("yahoo", normalized)],
            }
        for base_symbol, details in india_aliases.items():
            if normalized == details.get("yahoo"):
                return {
                    "company_name": details.get("name", base_symbol),
                    "aliases": [base_symbol, normalized],
                }

        company_map = {
            "AAPL": ("Apple", ["Apple Inc", "iPhone"]),
            "MSFT": ("Microsoft", ["Microsoft Corp", "Azure"]),
            "NVDA": ("NVIDIA", ["NVIDIA Corp", "semiconductor", "GPU"]),
            "GOOGL": ("Alphabet", ["Google", "Alphabet Inc"]),
            "AMZN": ("Amazon", ["Amazon.com", "AWS"]),
            "TSLA": ("Tesla", ["Tesla Inc", "EV"]),
            "META": ("Meta", ["Meta Platforms", "Facebook"]),
            "AMD": ("AMD", ["Advanced Micro Devices", "chipmaker"]),
            "NFLX": ("Netflix", ["streaming", "subscriber growth"]),
        }
        company_name, aliases = company_map.get(normalized, (normalized, [normalized]))
        return {
            "company_name": company_name,
            "aliases": aliases,
        }

    def _explain_news_impact(
        self,
        symbol: str,
        company_name: str,
        article: Dict[str, Any],
        local_themes: List[Dict[str, Any]],
        sentiment: str,
    ) -> Dict[str, Any]:
        title = article.get("title") or "Market development"
        description = article.get("description") or "No description available."
        primary_theme = local_themes[0] if local_themes else None
        theme_name = (primary_theme or {}).get("theme", "market narrative").replace("_", " ")
        direction = (primary_theme or {}).get("direction", "mixed")

        if sentiment == "positive":
            impact_summary = f"{title} is a potential upside catalyst for the stock."
        elif sentiment == "negative":
            impact_summary = f"{title} is a potential downside risk for the stock."
        else:
            impact_summary = f"{title} may influence the stock, but the market signal is still mixed."

        why_it_matters = (
            f"This matters because it can change expectations around revenue growth, margins, or valuation multiples. "
            f"The headline maps most closely to the {theme_name} theme and currently reads as a {direction} input."
        )
        effect_path = (
            f"Effect path: headline -> investor narrative -> expected fundamentals -> price reaction. "
            f"Context: {description}"
        )
        return {
            "impact_summary": impact_summary,
            "why_it_matters": why_it_matters,
            "effect_path": effect_path,
        }

    def _fallback_market_seed(self, symbol: str, company_name: str, quote: Dict[str, Any]) -> Dict[str, Any]:
        price = float(quote.get("price", 0.0) or 0.0)
        change = float(quote.get("change", 0.0) or 0.0)
        change_percent = str(quote.get("change_percent", "0%") or "0%")
        source = str(quote.get("source", "market feed") or "market feed")

        if change > 0:
            seed_event = f"Price strength is building with the stock trading near ${price:.2f} after a {change_percent} move."
            sentiment = "positive"
            variables = ["stronger momentum", "follow-through buying", "higher near-term expectations"]
            impact_summary = "Recent price strength is acting as the primary market seed for the scenario."
        elif change < 0:
            seed_event = f"Selling pressure is building with the stock trading near ${price:.2f} after a {change_percent} move."
            sentiment = "negative"
            variables = ["weaker momentum", "risk reduction", "lower near-term expectations"]
            impact_summary = "Recent price weakness is acting as the primary market seed for the scenario."
        else:
            seed_event = f"The stock is consolidating near ${price:.2f} with limited directional conviction from the latest market move."
            sentiment = "neutral"
            variables = ["range-bound price action", "waiting for confirmation", "mixed macro signals"]
            impact_summary = "Flat price action is acting as the primary market seed while the market waits for a clearer catalyst."

        return {
            "headline": f"Live market setup for {symbol}",
            "summary": f"Using the latest available market move from {source} as the scenario seed for {company_name}.",
            "published_at": quote.get("timestamp"),
            "seed_event": seed_event,
            "variables": variables,
            "sentiment": sentiment,
            "confidence": 0.58,
            "company_name": company_name,
            "impact_summary": impact_summary,
            "why_it_matters": "When recent price action is the best available signal, positioning and momentum can shape the next leg before fresh news arrives.",
            "effect_path": "Effect path: current market move -> positioning and sentiment -> updated expectations -> next price reaction.",
        }

    def _scenario_quote(self, symbol: str) -> Dict[str, Any] | None:
        quote = self.market_service._run_with_timeout(
            lambda: self.market_service.get_quote(symbol),
            timeout_seconds=2.2,
            fallback=None,
        )
        if quote:
            return quote
        if self.market_service._is_known_crypto(symbol):
            return self.market_service._fallback_quote(symbol, is_crypto=True)
        if self.market_service._is_known_stock(symbol):
            return self.market_service._fallback_quote(self.market_service._display_stock_symbol(symbol), is_crypto=False)
        return None

    def _fallback_global_context(self) -> Dict[str, Any]:
        return {
            "risk_regime": {"label": "Mixed", "score": 0.0},
            "top_positive_drivers": [],
            "top_negative_drivers": [],
            "driver_map": [],
            "risk_summary": "Macro conditions are mixed and the scenario is relying on lightweight fallback context.",
        }

    def _fallback_forecast(self, current_price: float, horizon_days: int, combined_bias: float) -> Dict[str, Any]:
        base_return = combined_bias * 0.06
        bull_return = base_return + 0.08
        bear_return = base_return - 0.09
        return {
            "horizon_days": horizon_days,
            "current_price": round(current_price, 2),
            "expected_volatility_percent": 12.0,
            "macro_bias_score": round(combined_bias, 3),
            "scenarios": {
                "bull": self._scenario_payload(current_price, bull_return, 0.25),
                "base": self._scenario_payload(current_price, base_return, 0.5),
                "bear": self._scenario_payload(current_price, bear_return, 0.25),
            },
            "path": [],
        }

    def _scenario_payload(self, current_price: float, projected_return: float, probability: float) -> Dict[str, float]:
        target_price = current_price * (1 + projected_return)
        return {
            "target_price": round(target_price, 2),
            "return_percent": round(projected_return * 100, 2),
            "probability": probability,
        }

    def _scenario_signal(self, technical: Dict[str, Any], combined_bias: float) -> str:
        action = str(technical.get("recommendation", {}).get("action", "HOLD")).upper()
        if "BUY" in action or combined_bias > 0.45:
            return "BUY"
        if "SELL" in action or combined_bias < -0.45:
            return "SELL"
        return "HOLD"

    def _scenario_confidence(self, technical: Dict[str, Any], combined_bias: float) -> float:
        signal_count = len(technical.get("signals", []))
        return round(min(0.92, 0.5 + min(signal_count, 4) * 0.04 + abs(combined_bias) * 0.12), 2)
