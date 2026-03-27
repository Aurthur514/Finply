import React, { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { stockAPI } from '../api';

interface ChartData {
  date: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

interface StockChartProps {
  symbol: string;
  type?: 'stock' | 'crypto';
  onTradeIntent?: (symbol: string, side: 'buy' | 'sell') => void;
}

const periods = [
  { value: '1d', label: '1D', interval: '5m' },
  { value: '5d', label: '5D', interval: '15m' },
  { value: '1mo', label: '1M', interval: '1h' },
  { value: '3mo', label: '3M', interval: '1d' },
  { value: '1y', label: '1Y', interval: '1d' },
];

const StockChart: React.FC<StockChartProps> = ({ symbol, type = 'stock', onTradeIntent }) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('3mo');

  useEffect(() => {
    const loadChart = async () => {
      setLoading(true);
      try {
        const selectedPeriod = periods.find((item) => item.value === period);
        const response =
          type === 'crypto'
            ? await stockAPI.getCryptoHistory(symbol, period, selectedPeriod?.interval || '1d')
            : await stockAPI.getStockHistory(symbol, period, selectedPeriod?.interval || '1d');

        const transformed = response.data.data.map((item: any) => ({
          date: new Date(item.date).toLocaleDateString(),
          price: item.close,
          open: item.open,
          high: item.high,
          low: item.low,
          volume: item.volume,
        }));

        setChartData(transformed);
      } catch (error) {
        setChartData([]);
      } finally {
        setLoading(false);
      }
    };

    loadChart();
  }, [period, symbol, type]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{symbol} Chart</h3>
          <p className="text-sm text-slate-500">Trade directly from chart view with one-click order staging.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onTradeIntent?.(symbol, 'buy')}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            BUY
          </button>
          <button
            onClick={() => onTradeIntent?.(symbol, 'sell')}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            SELL
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {periods.map((item) => (
          <button
            key={item.value}
            onClick={() => setPeriod(item.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              period === item.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="h-80">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-900" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">No chart data available.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="sentinelChart" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `$${Number(value).toFixed(0)}`} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                contentStyle={{ borderRadius: 16, borderColor: '#cbd5e1' }}
              />
              <Area type="monotone" dataKey="price" stroke="#0f766e" fill="url(#sentinelChart)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default StockChart;
