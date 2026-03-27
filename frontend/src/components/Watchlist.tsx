import React, { useState } from 'react';

import { WatchlistItem } from '../api';

interface WatchlistProps {
  items: WatchlistItem[];
  onAdd: (symbol: string) => Promise<void>;
  onRemove: (symbol: string) => Promise<void>;
  onQuickBuy: (symbol: string) => void;
  onSelectSymbol: (symbol: string) => void;
}

const Watchlist: React.FC<WatchlistProps> = ({ items, onAdd, onRemove, onQuickBuy, onSelectSymbol }) => {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!symbol.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onAdd(symbol.toUpperCase());
      setSymbol('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Unable to add symbol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Watchlist</h3>
          <p className="text-sm text-slate-500">Refreshed with portfolio polling every 10 seconds.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{items.length} assets</span>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={symbol}
          onChange={(event) => setSymbol(event.target.value.toUpperCase())}
          onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
          placeholder="Add symbol"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2"
        />
        <button
          onClick={handleAdd}
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
        >
          {loading ? 'Adding...' : 'Add'}
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.symbol} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <button onClick={() => onSelectSymbol(item.symbol)} className="text-left">
                <div className="text-base font-semibold text-slate-900">{item.symbol}</div>
                <div className="text-sm text-slate-500">${item.price.toFixed(2)}</div>
              </button>
              <div className={`text-sm font-semibold ${item.change_percent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {item.change_percent >= 0 ? '+' : ''}
                {item.change_percent.toFixed(2)}%
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onQuickBuy(item.symbol)}
                className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Quick Buy
              </button>
              <button
                onClick={() => onRemove(item.symbol)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No watchlist assets yet.</div>}
      </div>
    </div>
  );
};

export default Watchlist;
