import React, { useEffect, useState } from 'react';
import { CpuChipIcon } from '@heroicons/react/24/outline';

import { predictionAPI } from '../api';

interface SignalCard {
  symbol: string;
  signal: string;
  confidence: number;
  predicted_price?: number;
  recommendation_summary?: {
    expected_return_percent: number;
  };
  global_context?: {
    risk_regime: {
      label: string;
    };
  };
}

interface AISignalsProps {
  symbols?: string[];
  onUseSignal?: (symbol: string, side: 'buy' | 'sell') => void;
}

const defaultSignalSymbols = ['AAPL', 'NVDA', 'BTC'];

const AISignals: React.FC<AISignalsProps> = ({ symbols, onUseSignal }) => {
  const [signals, setSignals] = useState<SignalCard[]>([]);
  const [loading, setLoading] = useState(false);
  const activeSymbols = symbols ?? defaultSignalSymbols;

  useEffect(() => {
    let cancelled = false;

    const fetchSignals = async () => {
      setLoading(true);
      try {
        const settled = await Promise.allSettled(
          activeSymbols.map(async (symbol) => {
            const response = await predictionAPI.getPrediction(symbol);
            return response as SignalCard;
          })
        );
        const results = settled
          .filter((item): item is PromiseFulfilledResult<SignalCard> => item.status === 'fulfilled')
          .map((item) => item.value);
        if (!cancelled) {
          setSignals(results.sort((left, right) => right.confidence - left.confidence));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSignals();
    const interval = window.setInterval(fetchSignals, 300000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeSymbols]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CpuChipIcon className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">Macro-Aware AI Signals</h3>
        </div>
        {loading && <div className="text-sm text-slate-500">Refreshing...</div>}
      </div>

      <div className="space-y-3">
        {signals.map((signalCard) => {
          const action =
            signalCard.signal === 'SELL' ? 'sell' : signalCard.signal === 'BUY' ? 'buy' : null;

          return (
            <button
              key={signalCard.symbol}
              onClick={() => action && onUseSignal?.(signalCard.symbol, action)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
            >
              <div>
                <div className="text-base font-semibold text-slate-900">{signalCard.symbol}</div>
                <div className="text-sm text-slate-500">
                  {signalCard.signal} · {(signalCard.confidence * 100).toFixed(0)}% confidence
                </div>
                <div className="text-xs text-slate-500">
                  Regime {signalCard.global_context?.risk_regime.label || 'Mixed'}
                  {signalCard.recommendation_summary
                    ? ` · ${signalCard.recommendation_summary.expected_return_percent.toFixed(2)}% base return`
                    : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">
                  {signalCard.predicted_price ? `$${signalCard.predicted_price.toFixed(2)}` : 'N/A'}
                </div>
                <div className="text-xs text-slate-500">{action ? 'Click to stage order' : 'Watch for setup'}</div>
              </div>
            </button>
          );
        })}

        {!loading && signals.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No AI signals available.
          </div>
        )}
      </div>
    </div>
  );
};

export default AISignals;
