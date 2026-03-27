from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from market_data import MarketDataService


@dataclass(frozen=True)
class StrategyDefinition:
    key: str
    label: str
    description: str


class BacktestingEngine:
    def __init__(self):
        self.market_service = MarketDataService()
        self.strategies = {
            "buy_hold": StrategyDefinition(
                key="buy_hold",
                label="Buy And Hold",
                description="Baseline benchmark that stays fully invested from the first valid bar.",
            ),
            "sma_cross": StrategyDefinition(
                key="sma_cross",
                label="SMA Crossover",
                description="Long when the 20-day moving average is above the 50-day moving average.",
            ),
            "rsi_reversion": StrategyDefinition(
                key="rsi_reversion",
                label="RSI Mean Reversion",
                description="Long after oversold conditions and step aside after momentum normalizes.",
            ),
        }

    def list_strategies(self) -> List[Dict[str, str]]:
        return [
            {
                "key": strategy.key,
                "label": strategy.label,
                "description": strategy.description,
            }
            for strategy in self.strategies.values()
        ]

    def run_backtest(
        self,
        symbol: str,
        strategy_key: str,
        period: str = "1y",
        interval: str = "1d",
        benchmark_symbol: Optional[str] = None,
        initial_capital: float = 10000.0,
    ) -> Dict[str, Any]:
        normalized_symbol = symbol.upper().strip()
        strategy = self.strategies.get(strategy_key)
        if not strategy:
            raise ValueError(f"Unsupported strategy '{strategy_key}'")

        history = self.market_service.get_historical_data(normalized_symbol, period=period, interval=interval)
        prepared = self._prepare_history(history)
        if prepared is None or len(prepared) < 60:
            raise ValueError(f"Not enough historical data to backtest {normalized_symbol}")

        signal_frame = self._build_signals(prepared.copy(), strategy_key)
        signal_frame["asset_return"] = signal_frame["close"].pct_change().fillna(0.0)
        signal_frame["strategy_return"] = signal_frame["position"].shift(1).fillna(0.0) * signal_frame["asset_return"]
        signal_frame["equity"] = initial_capital * (1 + signal_frame["strategy_return"]).cumprod()
        signal_frame["benchmark_equity"] = initial_capital * (1 + signal_frame["asset_return"]).cumprod()

        benchmark = self._build_benchmark(normalized_symbol, benchmark_symbol, prepared, period, interval, initial_capital)
        trade_log = self._extract_trades(signal_frame)
        metrics = self._compute_metrics(signal_frame, trade_log, initial_capital)
        chart_points = self._build_chart_points(signal_frame, benchmark["series"])
        benchmark_summary = {
            "symbol": benchmark["symbol"],
            "final_value": benchmark["final_value"],
            "return_percent": benchmark["return_percent"],
        }

        return {
            "symbol": normalized_symbol,
            "strategy": {
                "key": strategy.key,
                "label": strategy.label,
                "description": strategy.description,
            },
            "period": period,
            "interval": interval,
            "initial_capital": round(initial_capital, 2),
            "metrics": metrics,
            "trade_count": len(trade_log),
            "trades": trade_log[:12],
            "chart": chart_points,
            "benchmark": benchmark_summary,
        }

    def _prepare_history(self, history: Optional[pd.DataFrame]) -> Optional[pd.DataFrame]:
        if history is None or history.empty or "close" not in history:
            return None
        frame = history.copy()
        frame = frame.sort_index()
        frame = frame[~frame.index.duplicated(keep="last")]
        frame["close"] = pd.to_numeric(frame["close"], errors="coerce")
        frame = frame.dropna(subset=["close"])
        return frame

    def _build_signals(self, frame: pd.DataFrame, strategy_key: str) -> pd.DataFrame:
        frame["position"] = 0.0

        if strategy_key == "buy_hold":
            frame["position"] = 1.0
            return frame

        if strategy_key == "sma_cross":
            frame["sma_fast"] = frame["close"].rolling(20).mean()
            frame["sma_slow"] = frame["close"].rolling(50).mean()
            frame["position"] = np.where(frame["sma_fast"] > frame["sma_slow"], 1.0, 0.0)
            return frame

        if strategy_key == "rsi_reversion":
            delta = frame["close"].diff()
            gains = delta.clip(lower=0)
            losses = -delta.clip(upper=0)
            avg_gain = gains.rolling(14).mean()
            avg_loss = losses.rolling(14).mean()
            rs = avg_gain / avg_loss.replace(0, np.nan)
            frame["rsi"] = 100 - (100 / (1 + rs))
            position = 0.0
            positions: List[float] = []
            for rsi in frame["rsi"].fillna(50):
                if rsi < 30:
                    position = 1.0
                elif rsi > 55:
                    position = 0.0
                positions.append(position)
            frame["position"] = positions
            return frame

        raise ValueError(f"Unsupported strategy '{strategy_key}'")

    def _build_benchmark(
        self,
        symbol: str,
        benchmark_symbol: Optional[str],
        prepared: pd.DataFrame,
        period: str,
        interval: str,
        initial_capital: float,
    ) -> Dict[str, Any]:
        benchmark_name = benchmark_symbol.upper().strip() if benchmark_symbol else self._default_benchmark_for_symbol(symbol)

        benchmark_history = self.market_service.get_historical_data(benchmark_name, period=period, interval=interval)
        benchmark_prepared = self._prepare_history(benchmark_history)

        if benchmark_prepared is None or benchmark_prepared.empty:
            benchmark_series = pd.Series(initial_capital, index=prepared.index)
        else:
            aligned = benchmark_prepared["close"].reindex(prepared.index).ffill().bfill()
            benchmark_returns = aligned.pct_change().fillna(0.0)
            benchmark_series = initial_capital * (1 + benchmark_returns).cumprod()

        return {
            "symbol": benchmark_name,
            "final_value": round(float(benchmark_series.iloc[-1]), 2),
            "return_percent": round(((float(benchmark_series.iloc[-1]) / initial_capital) - 1) * 100, 2),
            "series": benchmark_series,
        }

    def _extract_trades(self, frame: pd.DataFrame) -> List[Dict[str, Any]]:
        trades: List[Dict[str, Any]] = []
        previous_position = 0.0
        entry_price = None
        entry_date = None

        for idx, row in frame.iterrows():
            position = float(row["position"])
            price = float(row["close"])
            if previous_position <= 0 and position > 0:
                entry_price = price
                entry_date = idx
            elif previous_position > 0 and position <= 0 and entry_price is not None and entry_date is not None:
                pnl_percent = ((price / entry_price) - 1) * 100
                trades.append(
                    {
                        "entry_date": str(entry_date.date()),
                        "exit_date": str(idx.date()),
                        "entry_price": round(entry_price, 2),
                        "exit_price": round(price, 2),
                        "return_percent": round(pnl_percent, 2),
                        "outcome": "win" if pnl_percent >= 0 else "loss",
                    }
                )
                entry_price = None
                entry_date = None
            previous_position = position

        if previous_position > 0 and entry_price is not None and entry_date is not None:
            last_price = float(frame["close"].iloc[-1])
            pnl_percent = ((last_price / entry_price) - 1) * 100
            trades.append(
                {
                    "entry_date": str(entry_date.date()),
                    "exit_date": "Open",
                    "entry_price": round(entry_price, 2),
                    "exit_price": round(last_price, 2),
                    "return_percent": round(pnl_percent, 2),
                    "outcome": "open",
                }
            )

        return trades

    def _compute_metrics(self, frame: pd.DataFrame, trades: List[Dict[str, Any]], initial_capital: float) -> Dict[str, Any]:
        equity = frame["equity"]
        strategy_returns = frame["strategy_return"]
        final_value = float(equity.iloc[-1])
        total_return = (final_value / initial_capital) - 1

        periods = max(len(frame), 1)
        annualization_factor = 252 / periods
        cagr = (final_value / initial_capital) ** annualization_factor - 1 if periods > 1 else total_return
        std = float(strategy_returns.std()) if len(strategy_returns) > 1 else 0.0
        volatility = float(std * np.sqrt(252)) if std > 0 else 0.0
        sharpe = float((strategy_returns.mean() / std) * np.sqrt(252)) if std > 0 else 0.0

        running_max = equity.cummax()
        drawdown = (equity / running_max) - 1
        max_drawdown = float(drawdown.min()) if not drawdown.empty else 0.0

        completed_trades = [trade for trade in trades if trade["outcome"] in {"win", "loss"}]
        wins = [trade for trade in completed_trades if trade["outcome"] == "win"]
        win_rate = (len(wins) / len(completed_trades)) if completed_trades else 0.0

        return {
            "final_value": round(final_value, 2),
            "total_return_percent": round(total_return * 100, 2),
            "cagr_percent": round(cagr * 100, 2),
            "sharpe_ratio": round(sharpe, 2),
            "max_drawdown_percent": round(max_drawdown * 100, 2),
            "volatility_percent": round(volatility * 100, 2),
            "win_rate_percent": round(win_rate * 100, 2),
        }

    def _build_chart_points(self, frame: pd.DataFrame, benchmark_equity: pd.Series) -> List[Dict[str, Any]]:
        chart = []
        for idx, row in frame.iloc[:: max(len(frame) // 40, 1)].iterrows():
            point = {
                "date": str(idx.date()),
                "equity": round(float(row["equity"]), 2),
                "benchmark_equity": round(float(benchmark_equity.loc[idx]), 2) if benchmark_equity is not None else None,
                "position": int(row["position"]),
            }
            chart.append(point)
        if chart and chart[-1]["date"] != str(frame.index[-1].date()):
            idx = frame.index[-1]
            chart.append(
                {
                    "date": str(idx.date()),
                    "equity": round(float(frame["equity"].iloc[-1]), 2),
                    "benchmark_equity": round(float(benchmark_equity.iloc[-1]), 2) if benchmark_equity is not None else None,
                    "position": int(frame["position"].iloc[-1]),
                }
            )
        return chart

    def _default_benchmark_for_symbol(self, symbol: str) -> str:
        normalized = symbol.upper().strip()
        if normalized.endswith(".NS") or normalized in {"TCS", "INFY", "RELIANCE", "HDFCBANK", "SBIN", "ICICIBANK"}:
            return "^NSEI"
        if self.market_service._is_known_crypto(normalized):
            return "BTC"
        return "SPY"
