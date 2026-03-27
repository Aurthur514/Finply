import React, { useEffect, useMemo, useState } from 'react';

interface TradingPanelProps {
  userId: number;
  symbol?: string;
  side?: 'buy' | 'sell';
  accountBalance: number;
  marketDataSource?: string;
  onSubmitOrder: (payload: {
    symbol: string;
    order_type: 'market' | 'limit';
    side: 'buy' | 'sell';
    quantity: number;
    limit_price?: number;
  }) => Promise<void>;
}

const TradingPanel: React.FC<TradingPanelProps> = ({
  symbol = 'AAPL',
  side = 'buy',
  accountBalance,
  marketDataSource,
  onSubmitOrder,
}) => {
  const [localSymbol, setLocalSymbol] = useState(symbol);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [localSide, setLocalSide] = useState<'buy' | 'sell'>(side);
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalSymbol(symbol);
  }, [symbol]);

  useEffect(() => {
    setLocalSide(side);
  }, [side]);

  const estimatedTotal = useMemo(() => {
    const price = orderType === 'limit' ? Number(limitPrice || 0) : 0;
    return price > 0 ? price * quantity : null;
  }, [limitPrice, orderType, quantity]);

  const submit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmitOrder({
        symbol: localSymbol.toUpperCase(),
        order_type: orderType,
        side: localSide,
        quantity,
        limit_price: orderType === 'limit' ? Number(limitPrice) : undefined,
      });
      setShowConfirm(false);
      setQuantity(1);
      setLimitPrice('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Unable to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOfflinePrice = typeof marketDataSource === 'string' && marketDataSource.toLowerCase().includes('offline');
  const canSubmit =
    localSymbol.trim().length > 0 &&
    quantity > 0 &&
    (!Number.isNaN(Number(limitPrice)) || orderType === 'market') &&
    (orderType === 'market' || Number(limitPrice) > 0) &&
    !(isOfflinePrice && orderType === 'market');

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Order Panel</h3>
          <p className="text-sm text-slate-500">
            Simulated execution with {isOfflinePrice ? 'fallback market prices.' : 'the latest available market prices.'}
          </p>
        </div>
        <div className="rounded-xl bg-slate-100 px-3 py-2 text-right">
          <div className="text-xs uppercase tracking-wide text-slate-500">Cash Balance</div>
          <div className="text-lg font-semibold text-slate-900">${accountBalance.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Symbol
          <input
            value={localSymbol}
            onChange={(event) => setLocalSymbol(event.target.value.toUpperCase())}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-0 transition focus:border-blue-500"
            placeholder="AAPL"
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Order Type
          <select
            value={orderType}
            onChange={(event) => setOrderType(event.target.value as 'market' | 'limit')}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500"
          >
            <option value="market">Market</option>
            <option value="limit">Limit</option>
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Side
          <select
            value={localSide}
            onChange={(event) => setLocalSide(event.target.value as 'buy' | 'sell')}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Quantity
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500"
          />
        </label>

        {orderType === 'limit' && (
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Limit Price
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={limitPrice}
              onChange={(event) => setLimitPrice(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-500"
              placeholder="182.50"
            />
          </label>
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        {orderType === 'market' ? 'Market orders execute at the latest available price.' : 'Limit orders fill only when the market reaches your limit.'}
        {estimatedTotal !== null && (
          <div className="mt-2 font-medium text-slate-900">Estimated notional: ${estimatedTotal.toFixed(2)}</div>
        )}
      </div>

      {isOfflinePrice && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Current pricing is coming from the offline fallback feed. Market orders are disabled until a live quote is available. Use this as research context only.
        </div>
      )}

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <button
        onClick={() => setShowConfirm(true)}
        disabled={!canSubmit || isSubmitting}
        className={`mt-5 w-full rounded-xl px-4 py-3 font-semibold text-white transition ${
          localSide === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
        } disabled:cursor-not-allowed disabled:bg-slate-400`}
      >
        {isSubmitting ? 'Submitting...' : `${localSide.toUpperCase()} ${localSymbol || 'ASSET'}`}
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">Confirm order</h4>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <div>Symbol: <span className="font-medium text-slate-900">{localSymbol}</span></div>
              <div>Side: <span className="font-medium text-slate-900">{localSide.toUpperCase()}</span></div>
              <div>Order Type: <span className="font-medium text-slate-900">{orderType.toUpperCase()}</span></div>
              <div>Quantity: <span className="font-medium text-slate-900">{quantity}</span></div>
              {orderType === 'limit' && <div>Limit Price: <span className="font-medium text-slate-900">${Number(limitPrice).toFixed(2)}</span></div>}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:bg-slate-400"
              >
                {isSubmitting ? 'Sending...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingPanel;
