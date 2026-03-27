"""
Hedge Fund Style AI Prediction System for Sentinel
Combines technical analysis, news sentiment, and time series models
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
import datetime
from market_data import MarketDataService
from ml_models.news_predictor import NewsStockPredictor
from models import AIPrediction
from sqlalchemy.orm import Session

class HedgeFundAI:
    """Professional AI prediction system combining multiple models"""

    def __init__(self, db_session: Session):
        self.db = db_session
        self.market_service = MarketDataService()
        self.news_predictor = NewsStockPredictor()

    def generate_prediction(self, symbol: str) -> Dict:
        """Generate comprehensive AI prediction for a symbol"""

        # Get technical analysis
        technical_signal = self._technical_model(symbol)

        # Get news sentiment (simulated for now)
        news_signal = self._news_sentiment_model(symbol)

        # Get time series prediction
        ts_signal = self._time_series_model(symbol)

        # Ensemble decision
        ensemble_signal = self._ensemble_decision(technical_signal, news_signal, ts_signal)

        # Save prediction to database
        prediction = AIPrediction(
            symbol=symbol,
            prediction_type="ensemble",
            signal=ensemble_signal["signal"],
            confidence=ensemble_signal["confidence"],
            predicted_price=ensemble_signal.get("predicted_price"),
            reasoning=ensemble_signal.get("reasoning"),
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        )

        self.db.add(prediction)
        self.db.commit()

        return {
            "symbol": symbol,
            "signal": ensemble_signal["signal"],
            "confidence": ensemble_signal["confidence"],
            "predicted_price": ensemble_signal.get("predicted_price"),
            "reasoning": ensemble_signal.get("reasoning"),
            "components": {
                "technical": technical_signal,
                "news": news_signal,
                "time_series": ts_signal
            },
            "timestamp": datetime.datetime.utcnow().isoformat()
        }

    def _technical_model(self, symbol: str) -> Dict:
        """Technical analysis model using RSI, MACD, Bollinger Bands"""

        try:
            # Get historical data
            df = self.market_service.get_historical_data(symbol, period="3mo", interval="1d")
            if df is None or len(df) < 20:
                return {"signal": "HOLD", "confidence": 0.5, "reasoning": "Insufficient data"}

            # Calculate technical indicators
            rsi = self._calculate_rsi(df['close'])
            macd_data = self._calculate_macd(df['close'])
            bb_data = self._calculate_bollinger_bands(df['close'])

            current_rsi = rsi.iloc[-1] if not rsi.empty else 50
            current_macd = macd_data['macd'].iloc[-1] if not macd_data.empty else 0
            macd_signal = macd_data['signal'].iloc[-1] if not macd_data.empty else 0
            bb_upper = bb_data['upper'].iloc[-1] if not bb_data.empty else df['close'].iloc[-1]
            bb_lower = bb_data['lower'].iloc[-1] if not bb_data.empty else df['close'].iloc[-1]
            current_price = df['close'].iloc[-1]

            # Scoring system
            score = 0
            signals = []

            # RSI signals
            if current_rsi < 30:
                score += 2  # Oversold - bullish
                signals.append("RSI oversold")
            elif current_rsi > 70:
                score -= 2  # Overbought - bearish
                signals.append("RSI overbought")

            # MACD signals
            if current_macd > macd_signal and current_macd > 0:
                score += 1.5  # Bullish crossover
                signals.append("MACD bullish crossover")
            elif current_macd < macd_signal and current_macd < 0:
                score -= 1.5  # Bearish crossover
                signals.append("MACD bearish crossover")

            # Bollinger Band signals
            if current_price < bb_lower:
                score += 1  # Price below lower band - potential bounce
                signals.append("Price below lower BB")
            elif current_price > bb_upper:
                score -= 1  # Price above upper band - potential reversal
                signals.append("Price above upper BB")

            # Determine signal
            if score >= 2:
                signal = "BUY"
                confidence = min(0.9, 0.5 + (score / 4))
            elif score <= -2:
                signal = "SELL"
                confidence = min(0.9, 0.5 + (abs(score) / 4))
            else:
                signal = "HOLD"
                confidence = 0.6

            reasoning = f"Technical signals: {', '.join(signals)} (Score: {score:.1f})"

            return {
                "signal": signal,
                "confidence": confidence,
                "reasoning": reasoning,
                "indicators": {
                    "rsi": current_rsi,
                    "macd": current_macd,
                    "bb_upper": bb_upper,
                    "bb_lower": bb_lower
                }
            }

        except Exception as e:
            return {"signal": "HOLD", "confidence": 0.5, "reasoning": f"Technical analysis error: {str(e)}"}

    def _news_sentiment_model(self, symbol: str) -> Dict:
        """News sentiment model backed by the project's predictor."""
        result = self.news_predictor.predict_stock_movement(symbol)
        probability_up = float(result.get("probability_up", 0.5))
        sentiment_score = (probability_up - 0.5) * 2
        confidence = 0.45 + abs(sentiment_score) * 0.4

        if sentiment_score > 0.2:
            signal = "BUY"
            reasoning = f"Positive news sentiment ({sentiment_score:.2f})"
        elif sentiment_score < -0.2:
            signal = "SELL"
            reasoning = f"Negative news sentiment ({sentiment_score:.2f})"
        else:
            signal = "HOLD"
            reasoning = f"Neutral news sentiment ({sentiment_score:.2f})"

        return {
            "signal": signal,
            "confidence": round(min(0.9, confidence), 2),
            "reasoning": reasoning,
            "sentiment_score": round(sentiment_score, 3),
            "themes": result.get("themes", []),
        }

    def _time_series_model(self, symbol: str) -> Dict:
        """Time series prediction model using LSTM-like approach (simulated)"""

        try:
            # Get historical data
            df = self.market_service.get_historical_data(symbol, period="1y", interval="1d")
            if df is None or len(df) < 30:
                return {"signal": "HOLD", "confidence": 0.5, "reasoning": "Insufficient data"}

            # Simple trend analysis (simulating LSTM prediction)
            recent_prices = df['close'].tail(30)
            trend_slope = np.polyfit(range(len(recent_prices)), recent_prices, 1)[0]

            # Volatility calculation
            returns = recent_prices.pct_change().dropna()
            volatility = returns.std() * np.sqrt(252)  # Annualized

            current_price = recent_prices.iloc[-1]

            # Predict next day price (simple extrapolation)
            predicted_price = current_price * (1 + trend_slope * 0.01)

            # Determine signal based on trend and volatility
            if trend_slope > 0.5 and volatility < 0.3:
                signal = "BUY"
                confidence = 0.7
                reasoning = f"Strong uptrend with low volatility"
            elif trend_slope < -0.5 and volatility < 0.3:
                signal = "SELL"
                confidence = 0.7
                reasoning = f"Strong downtrend with low volatility"
            elif volatility > 0.5:
                signal = "HOLD"
                confidence = 0.8
                reasoning = f"High volatility - avoid trading"
            else:
                signal = "HOLD"
                confidence = 0.6
                reasoning = f"Neutral trend"

            return {
                "signal": signal,
                "confidence": confidence,
                "reasoning": reasoning,
                "predicted_price": predicted_price,
                "trend_slope": trend_slope,
                "volatility": volatility
            }

        except Exception as e:
            return {"signal": "HOLD", "confidence": 0.5, "reasoning": f"Time series error: {str(e)}"}

    def _ensemble_decision(self, technical: Dict, news: Dict, ts: Dict) -> Dict:
        """Combine predictions from all models using ensemble voting"""

        # Weight the models
        weights = {
            "technical": 0.5,    # Most important
            "news": 0.2,         # Secondary
            "time_series": 0.3   # Important for prediction
        }

        # Convert signals to scores
        signal_scores = {
            "BUY": 1,
            "HOLD": 0,
            "SELL": -1
        }

        # Calculate weighted ensemble score
        ensemble_score = (
            signal_scores[technical["signal"]] * weights["technical"] * technical["confidence"] +
            signal_scores[news["signal"]] * weights["news"] * news["confidence"] +
            signal_scores[ts["signal"]] * weights["time_series"] * ts["confidence"]
        )

        # Normalize score
        max_possible = sum(weights.values())
        normalized_score = ensemble_score / max_possible

        # Determine final signal
        if normalized_score > 0.2:
            signal = "BUY"
            confidence = min(0.95, 0.5 + normalized_score)
        elif normalized_score < -0.2:
            signal = "SELL"
            confidence = min(0.95, 0.5 + abs(normalized_score))
        else:
            signal = "HOLD"
            confidence = 0.7

        # Build reasoning
        components = []
        if technical["signal"] != "HOLD":
            components.append(f"Technical: {technical['signal']} ({technical['confidence']:.1f})")
        if news["signal"] != "HOLD":
            components.append(f"News: {news['signal']} ({news['confidence']:.1f})")
        if ts["signal"] != "HOLD":
            components.append(f"Time Series: {ts['signal']} ({ts['confidence']:.1f})")

        reasoning = f"Ensemble decision (score: {normalized_score:.2f}). Components: {', '.join(components) if components else 'All models neutral'}"

        result = {
            "signal": signal,
            "confidence": confidence,
            "reasoning": reasoning
        }

        # Add predicted price if available
        if "predicted_price" in ts and ts["predicted_price"]:
            result["predicted_price"] = ts["predicted_price"]

        return result

    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> pd.Series:
        """Calculate RSI indicator"""
        try:
            delta = prices.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            return rsi
        except:
            return pd.Series()

    def _calculate_macd(self, prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
        """Calculate MACD indicator"""
        try:
            exp1 = prices.ewm(span=fast, adjust=False).mean()
            exp2 = prices.ewm(span=slow, adjust=False).mean()
            macd = exp1 - exp2
            signal_line = macd.ewm(span=signal, adjust=False).mean()

            return pd.DataFrame({
                'macd': macd,
                'signal': signal_line,
                'histogram': macd - signal_line
            })
        except:
            return pd.DataFrame()

    def _calculate_bollinger_bands(self, prices: pd.Series, period: int = 20, std_dev: int = 2) -> pd.DataFrame:
        """Calculate Bollinger Bands"""
        try:
            sma = prices.rolling(window=period).mean()
            std = prices.rolling(window=period).std()
            upper = sma + (std * std_dev)
            lower = sma - (std * std_dev)

            return pd.DataFrame({
                'upper': upper,
                'middle': sma,
                'lower': lower
            })
        except:
            return pd.DataFrame()

    def get_prediction_history(self, symbol: str, limit: int = 10) -> List[Dict]:
        """Get prediction history for a symbol"""
        predictions = self.db.query(AIPrediction)\
                           .filter(AIPrediction.symbol == symbol)\
                           .order_by(AIPrediction.timestamp.desc())\
                           .limit(limit).all()

        return [
            {
                "id": pred.id,
                "symbol": pred.symbol,
                "signal": pred.signal,
                "confidence": pred.confidence,
                "predicted_price": pred.predicted_price,
                "reasoning": pred.reasoning,
                "timestamp": pred.timestamp.isoformat()
            }
            for pred in predictions
        ]

    def get_market_scanner(self) -> List[Dict]:
        """Scan market for trading opportunities"""

        # Popular symbols to scan
        symbols = [
            "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META",
            "BTC", "ETH", "BNB", "ADA", "SOL"
        ]

        opportunities = []

        for symbol in symbols:
            try:
                prediction = self.generate_prediction(symbol)

                # Only include high-confidence signals
                if prediction["confidence"] > 0.7:
                    opportunities.append({
                        "symbol": symbol,
                        "signal": prediction["signal"],
                        "confidence": prediction["confidence"],
                        "reasoning": prediction["reasoning"],
                        "current_price": (self.market_service.get_quote(symbol) or {}).get("price")
                    })

            except Exception as e:
                continue

        # Sort by confidence
        opportunities.sort(key=lambda x: x["confidence"], reverse=True)

        return opportunities[:10]  # Top 10 opportunities
