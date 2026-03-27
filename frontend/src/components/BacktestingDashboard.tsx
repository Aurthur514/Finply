import React, { useCallback, useEffect, useState } from 'react';
import { BeakerIcon } from '@heroicons/react/24/outline';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { backtestAPI, BacktestResponse, BacktestStrategyDefinition } from '../api';

interface BacktestingDashboardProps {
  defaultSymbol: string;
}

const periodOptions = ['6mo', '1y', '2y', '5y'];

const formatCurrency = (value: number | null | undefined) =>
  Number.isFinite(value) ? `$${Number(value).toFixed(2)}` : 'N/A';

const metricTone = (value: number) => (value >= 0 ? 'text-emerald-600' : 'text-rose-600');

const BacktestingDashboard: React.FC<BacktestingDashboardProps> = ({ defaultSymbol }) => {
  const [symbol, setSymbol] = useState(defaultSymbol.toUpperCase());
  const [inputValue, setInputValue] = useState(defaultSymbol.toUpperCase());
  const [strategy, setStrategy] = useState('sma_cross');
  const [period, setPeriod] = useState('1y');
  const [initialCapital, setInitialCapital] = useState('10000');
  const [strategies, setStrategies] = useState<BacktestStrategyDefinition[]>([]);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStrategies = useCallback(async () => {
    try {
      const response = await backtestAPI.listStrategies();
      setStrategies(response.data);
      if (response.data.length > 0 && !response.data.find((item) => item.key === strategy)) {
        setStrategy(response.data[0].key);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to load backtest strategies');
    }
  }, [strategy]);

  const runBacktest = useCallback(async (forceRefresh = false, overrideSymbol?: string) => {
    const symbolToUse = (overrideSymbol || symbol).trim().toUpperCase();
    if (!symbolToUse) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await backtestAPI.runBacktest(
        symbolToUse,
        strategy,
        period,
        '1d',
        Number(initialCapital) || 10000,
        undefined,
        forceRefresh,
      );
      setResult(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to run backtest');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [initialCapital, period, strategy, symbol]);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  useEffect(() => {
    const nextSymbol = defaultSymbol.toUpperCase();
    setSymbol(nextSymbol);
    setInputValue(nextSymbol);
  }, [defaultSymbol]);

  useEffect(() => {
    if (strategies.length > 0) {
      runBacktest(false);
    }
  }, [runBacktest, strategies]);

  const submit = () => {
    const nextSymbol = inputValue.trim().toUpperCase();
    if (!nextSymbol) {
      return;
    }
    if (nextSymbol === symbol) {
      runBacktest(true, nextSymbol);
      return;
    }
    setSymbol(nextSymbol);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <BeakerIcon className="mr-2 h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-900">Backtesting Lab</h3>
        </div>
        <button
          onClick={() => runBacktest(true)}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:bg-slate-400"
        >
          {loading ? 'Running...' : 'Re-run'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-slate-700">Symbol</label>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Strategy</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            {strategies.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            {periodOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Initial Capital</label>
          <input
            value={initialCapital}
            onChange={(e) => setInitialCapital(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={submit}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:bg-slate-400"
        >
          Run Backtest
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-500">Backtest</div>
                <div className="text-2xl font-bold text-slate-900">
                  {result.symbol} · {result.strategy.label}
                </div>
                <div className="mt-1 text-sm text-slate-600">{result.strategy.description}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                Benchmark: <span className="font-semibold text-slate-900">{result.benchmark.symbol}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Final Value</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{formatCurrency(result.metrics.final_value)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Return</div>
              <div className={`mt-2 text-xl font-semibold ${metricTone(result.metrics.total_return_percent)}`}>
                {result.metrics.total_return_percent.toFixed(2)}%
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">CAGR</div>
              <div className={`mt-2 text-xl font-semibold ${metricTone(result.metrics.cagr_percent)}`}>
                {result.metrics.cagr_percent.toFixed(2)}%
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sharpe Ratio</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{result.metrics.sharpe_ratio.toFixed(2)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Max Drawdown</div>
              <div className={`mt-2 text-xl font-semibold ${metricTone(result.metrics.max_drawdown_percent)}`}>
                {result.metrics.max_drawdown_percent.toFixed(2)}%
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Volatility</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{result.metrics.volatility_percent.toFixed(2)}%</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Win Rate</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{result.metrics.win_rate_percent.toFixed(2)}%</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trades</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{result.trade_count}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Equity Curve</div>
              <div className="text-sm text-slate-600">
                Strategy vs benchmark over {result.period}. Benchmark return: {result.benchmark.return_percent.toFixed(2)}%
              </div>
            </div>

            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                  <Legend />
                  <Line type="monotone" dataKey="equity" stroke="#4f46e5" strokeWidth={2.5} dot={false} name="Strategy" />
                  <Line type="monotone" dataKey="benchmark_equity" stroke="#0f172a" strokeDasharray="6 4" dot={false} name="Benchmark" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.75fr,1.25fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Strategy Notes</div>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <p>Initial capital: {formatCurrency(result.initial_capital)}</p>
                <p>Period: {result.period} · Interval: {result.interval}</p>
                <p>Use this panel as a research tool, not a live-trading approval system.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Trades</div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="pb-2 pr-4 font-medium">Entry</th>
                      <th className="pb-2 pr-4 font-medium">Exit</th>
                      <th className="pb-2 pr-4 font-medium">Entry Price</th>
                      <th className="pb-2 pr-4 font-medium">Exit Price</th>
                      <th className="pb-2 pr-4 font-medium">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.length > 0 ? (
                      result.trades.map((trade, index) => (
                        <tr key={`${trade.entry_date}-${trade.exit_date}-${index}`} className="border-b border-slate-100">
                          <td className="py-3 pr-4 text-slate-700">{trade.entry_date}</td>
                          <td className="py-3 pr-4 text-slate-700">{trade.exit_date}</td>
                          <td className="py-3 pr-4 text-slate-700">{formatCurrency(trade.entry_price)}</td>
                          <td className="py-3 pr-4 text-slate-700">{formatCurrency(trade.exit_price)}</td>
                          <td className={`py-3 pr-4 font-medium ${metricTone(trade.return_percent)}`}>{trade.return_percent.toFixed(2)}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          No completed trades for this configuration.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="py-10 text-center text-slate-500">Run a strategy to generate backtest metrics and an equity curve.</div>
      )}
    </div>
  );
};

export default BacktestingDashboard;
