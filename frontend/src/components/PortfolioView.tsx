import React, { useState } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';

import { PortfolioPosition } from '../api';

const safeNumber = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

interface PortfolioViewProps {
  userId: number;
  totalValue: number;
  cashBalance: number;
  unrealizedPnL: number;
  realizedPnL: number;
  positions: PortfolioPosition[];
  onSellPosition: (symbol: string, quantity: number) => Promise<void>;
}

const PortfolioView: React.FC<PortfolioViewProps> = ({
  totalValue,
  cashBalance,
  unrealizedPnL,
  realizedPnL,
  positions,
  onSellPosition,
}) => {
  const [pendingSell, setPendingSell] = useState<{ symbol: string; quantity: number; max: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedPositions = positions.map((position) => ({
    ...position,
    quantity: safeNumber(position.quantity),
    avg_price: safeNumber(position.avg_price),
    current_price: safeNumber(position.current_price),
    market_value: safeNumber(position.market_value),
    unrealized_pnl: safeNumber(position.unrealized_pnl),
  }));

  const handleConfirmSell = async () => {
    if (!pendingSell) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSellPosition(pendingSell.symbol, pendingSell.quantity);
      setPendingSell(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Unable to sell position');
    } finally {
      setLoading(false);
    }
  };

  const chartData = normalizedPositions.map((position) => ({
    name: position.symbol,
    size: position.market_value,
  }));

  const totalPnL = unrealizedPnL + realizedPnL;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-sm">
        <div className="grid gap-6 md:grid-cols-4">
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-400">Total Value</div>
            <div className="mt-2 text-3xl font-semibold">${totalValue.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-400">Cash Balance</div>
            <div className="mt-2 text-2xl font-semibold">${cashBalance.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-400">Unrealized PnL</div>
            <div className={`mt-2 text-2xl font-semibold ${unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-400">Realized PnL</div>
            <div className={`mt-2 text-2xl font-semibold ${realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)}
            </div>
          </div>
        </div>
        <div className={`mt-6 text-sm font-medium ${totalPnL >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
          Net trading PnL: {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Positions</h3>
            <span className="text-sm text-slate-500">{normalizedPositions.length} open</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-3">Symbol</th>
                  <th className="pb-3">Quantity</th>
                  <th className="pb-3">Avg Price</th>
                  <th className="pb-3">Current Price</th>
                  <th className="pb-3">PnL</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {normalizedPositions.map((position) => (
                  <tr key={position.symbol} className="border-t border-slate-100">
                    <td className="py-3 font-semibold text-slate-900">{position.symbol}</td>
                    <td className="py-3 text-slate-600">{position.quantity}</td>
                    <td className="py-3 text-slate-600">${position.avg_price.toFixed(2)}</td>
                    <td className="py-3 text-slate-600">${position.current_price.toFixed(2)}</td>
                    <td className={`py-3 font-medium ${position.unrealized_pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {position.unrealized_pnl >= 0 ? '+' : ''}${position.unrealized_pnl.toFixed(2)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() =>
                          setPendingSell({
                            symbol: position.symbol,
                            quantity: position.quantity,
                            max: position.quantity,
                          })
                        }
                        className="rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white hover:bg-rose-700"
                      >
                        Sell
                      </button>
                    </td>
                  </tr>
                ))}
                {normalizedPositions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No open positions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Allocation</h3>
          <p className="mb-4 text-sm text-slate-500">Position sizing by market value.</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={chartData}
                dataKey="size"
                stroke="#fff"
                fill="#2563eb"
                content={<CustomTreemap />}
              >
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {pendingSell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">Sell {pendingSell.symbol}</h4>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Quantity
              <input
                type="number"
                min={1}
                max={pendingSell.max}
                value={pendingSell.quantity}
                onChange={(event) =>
                  setPendingSell((current) =>
                    current
                      ? {
                          ...current,
                          quantity: Number(event.target.value),
                        }
                      : current
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <div className="mt-2 text-xs text-slate-500">Available quantity: {pendingSell.max}</div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setPendingSell(null)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSell}
                disabled={loading}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white disabled:bg-slate-400"
              >
                {loading ? 'Selling...' : 'Confirm Sell'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CustomTreemap = (props: any) => {
  const { x, y, width, height, name } = props;
  if (width < 40 || height < 28) {
    return null;
  }
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }} />
      <text x={x + 8} y={y + 20} fill="#ffffff" fontSize={12} fontWeight={600}>
        {name}
      </text>
    </g>
  );
};

export default PortfolioView;
