import React from 'react';

interface SelectedAssetRailProps {
  symbol: string;
  latestPrice?: number;
  latestQuoteSource?: string;
  inWatchlist: boolean;
  disableTrading?: boolean;
  onBuy: () => void;
  onSell: () => void;
  onOpenAnalysis: () => void;
  onOpenPredictions: () => void;
  onOpenResearch: () => void;
  onToggleWatchlist: () => Promise<void> | void;
}

const SelectedAssetRail: React.FC<SelectedAssetRailProps> = ({
  symbol,
  latestPrice,
  latestQuoteSource,
  inWatchlist,
  disableTrading = false,
  onBuy,
  onSell,
  onOpenAnalysis,
  onOpenPredictions,
  onOpenResearch,
  onToggleWatchlist,
}) => {
  const isOfflinePrice = typeof latestQuoteSource === 'string' && latestQuoteSource.toLowerCase().includes('offline');
  const hasLatestPrice = typeof latestPrice === 'number' && Number.isFinite(latestPrice);

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Selected Asset</div>
      <div className="mt-2 text-3xl font-semibold text-slate-950">{symbol}</div>
      <div className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
        {hasLatestPrice ? `$${latestPrice.toFixed(2)}` : 'Price unavailable'}
      </div>
      <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        isOfflinePrice ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
      }`}>
        {hasLatestPrice ? latestQuoteSource || 'Unknown source' : 'Waiting for quote'}
      </div>
      {isOfflinePrice && (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This price is from the offline fallback feed and may differ from the live market.
        </div>
      )}

      <div className="mt-5 space-y-2">
        <button
          onClick={onBuy}
          disabled={disableTrading}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Buy {symbol}
        </button>
        <button
          onClick={onSell}
          disabled={disableTrading}
          className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Sell {symbol}
        </button>
      </div>

      <div className="mt-5 border-t border-slate-200 pt-5">
        <div className="text-xs uppercase tracking-wide text-slate-500">Research</div>
        <div className="mt-3 space-y-2">
          <button
            onClick={onOpenAnalysis}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Technical Analysis
          </button>
          <button
            onClick={onOpenPredictions}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            AI Predictions
          </button>
          <button
            onClick={onOpenResearch}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Research Memo
          </button>
          <button
            onClick={onToggleWatchlist}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {inWatchlist ? 'Remove From Watchlist' : 'Add To Watchlist'}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-amber-50 p-4">
        <div className="text-sm font-semibold text-amber-950">Workflow</div>
        <div className="mt-2 text-sm text-amber-900">
          Research the asset, inspect the signal, then route straight into the order panel without losing context.
        </div>
      </div>
    </aside>
  );
};

export default SelectedAssetRail;
