import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RiskSummary {
  mean: number | null;
  median: number | null;
  p5: number | null;
  p95: number | null;
}

interface RiskResponse {
  user_id: number;
  base_value: number | null;
  simulated_values: number[];
  summary: RiskSummary;
}

interface RiskSimulatorProps {
  userId: number;
}

const RiskSimulator: React.FC<RiskSimulatorProps> = ({ userId }) => {
  const [riskData, setRiskData] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRisk = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/risk/simulate/${userId}?runs=400&days=252`);
      setRiskData(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to fetch risk simulation');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchRisk();
    }
  }, [userId, fetchRisk]);

  const formatCurrency = (value: number | null | undefined, digits = 2) =>
    Number.isFinite(value) ? `$${Number(value).toFixed(digits)}` : 'N/A';

  const chartData = (riskData?.simulated_values || [])
    .filter((value): value is number => Number.isFinite(value))
    .slice(0, 50)
    .map((value, idx) => ({ x: idx + 1, value }));

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <ShieldCheckIcon className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold">Risk Simulator</h3>
        </div>
        <button
          onClick={fetchRisk}
          disabled={loading}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Simulating...' : 'Re-run'}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {riskData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">Base Portfolio Value</div>
              <div className="text-2xl font-semibold">{formatCurrency(riskData.base_value)}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">Median Simulated Value</div>
              <div className="text-2xl font-semibold">{formatCurrency(riskData.summary.median)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">5th Percentile (Downside)</div>
              <div className="text-2xl font-semibold">{formatCurrency(riskData.summary.p5)}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <div className="text-xs text-gray-500">95th Percentile (Upside)</div>
              <div className="text-2xl font-semibold">{formatCurrency(riskData.summary.p95)}</div>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" hide />
                <YAxis tickFormatter={(value) => formatCurrency(Number(value), 0)} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'Value']} />
                <Area type="monotone" dataKey="value" stroke="#2563eb" fillOpacity={1} fill="url(#riskGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">No simulation data available.</div>
      )}
    </div>
  );
};

export default RiskSimulator;
