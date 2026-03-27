import React, { useEffect, useState } from 'react';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ForecastResponse, GlobalContext, predictionAPI } from '../api';

interface PredictionComponent {
  signal: string;
  confidence: number;
  reasoning: string;
}

interface NewsTheme {
  theme: string;
  impact_score: number;
  direction: string;
  strength: number;
}

interface RecommendationSummary {
  stance: string;
  entry_bias: string;
  time_horizon_days: number;
  expected_return_percent: number;
}

interface Prediction {
  symbol: string;
  signal: string;
  confidence: number;
  predicted_price?: number;
  reasoning: string;
  risk_summary?: string;
  catalysts?: string[];
  provider?: string;
  model?: string;
  global_context?: GlobalContext;
  forecast?: ForecastResponse;
  recommendation_summary?: RecommendationSummary;
  news_themes?: NewsTheme[];
  components?: {
    technical?: PredictionComponent;
    news?: PredictionComponent;
    time_series?: PredictionComponent;
  };
  timestamp: string;
}

interface PredictionsDashboardProps {
  defaultSymbol: string;
}

const PredictionsDashboard: React.FC<PredictionsDashboardProps> = ({ defaultSymbol }) => {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [inputValue, setInputValue] = useState(defaultSymbol);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = async (symbolToFetch: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await predictionAPI.getPrediction(symbolToFetch);
      setPrediction(response);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to fetch prediction');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction(symbol);
  }, [symbol]);

  useEffect(() => {
    const nextSymbol = defaultSymbol.toUpperCase();
    setSymbol(nextSymbol);
    setInputValue(nextSymbol);
  }, [defaultSymbol]);

  const getSignalClasses = (signal: string) => {
    switch (signal.toUpperCase()) {
      case 'BUY':
        return 'bg-emerald-50 text-emerald-700';
      case 'SELL':
        return 'bg-rose-50 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value.toUpperCase());
  };

  const refresh = () => {
    setLoading(true);
    predictionAPI.getPrediction(symbol, true)
      .then((response) => {
        setPrediction(response);
        setError(null);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.detail || err.message || 'Failed to fetch prediction');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const submitSymbol = () => {
    const nextSymbol = inputValue.trim().toUpperCase();
    if (!nextSymbol) {
      return;
    }
    if (nextSymbol === symbol) {
      refresh();
      return;
    }
    setSymbol(nextSymbol);
  };

  const predictionComponents = prediction?.components ? Object.entries(prediction.components) : [];
  const forecastPath = prediction?.forecast?.path || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <ChartBarIcon className="mr-2 h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">AI Predictions</h3>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:bg-slate-400"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700">Symbol</label>
          <input
            value={inputValue}
            onChange={handleSymbolChange}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={submitSymbol}
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:bg-slate-400"
          >
            Analyze
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {prediction && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-500">Symbol</div>
                <div className="text-2xl font-bold text-slate-900">{prediction.symbol}</div>
              </div>
              <div className={`rounded-full px-3 py-1 text-sm font-semibold ${getSignalClasses(prediction.signal)}`}>
                {prediction.signal.toUpperCase()}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs text-slate-500">Confidence</div>
                <div className="text-3xl font-bold text-slate-900">{(prediction.confidence * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Predicted Price</div>
                <div className="text-2xl font-semibold text-slate-900">
                  {prediction.predicted_price ? `$${prediction.predicted_price.toFixed(2)}` : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Updated</div>
                <div className="text-sm font-medium text-slate-900">{new Date(prediction.timestamp).toLocaleString()}</div>
                {(prediction.provider || prediction.model) && (
                  <div className="mt-1 text-xs text-slate-500">
                    {prediction.provider || 'AI'} {prediction.model ? `· ${prediction.model}` : ''}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reasoning</div>
              <p className="mt-2 text-sm text-slate-700">{prediction.reasoning}</p>
            </div>

            {prediction.recommendation_summary && (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendation</div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">{prediction.recommendation_summary.stance}</div>
                  <div className="mt-1 text-sm text-slate-600">{prediction.recommendation_summary.entry_bias}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Forecast Horizon</div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {prediction.recommendation_summary.time_horizon_days} days
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Base Return</div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">
                    {prediction.recommendation_summary.expected_return_percent.toFixed(2)}%
                  </div>
                </div>
              </div>
            )}

            {prediction.risk_summary && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Risk Summary</div>
                <p className="mt-2 text-sm text-amber-900">{prediction.risk_summary}</p>
              </div>
            )}

            {prediction.catalysts && prediction.catalysts.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Catalysts</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prediction.catalysts.map((catalyst) => (
                    <span key={catalyst} className="rounded-full bg-sky-50 px-3 py-1 text-sm text-sky-700">
                      {catalyst}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {prediction.forecast && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Forward Forecast</div>
                  <div className="text-sm text-slate-600">
                    Volatility band: {prediction.forecast.expected_volatility_percent.toFixed(2)}% | Macro bias score:{' '}
                    {prediction.forecast.macro_bias_score.toFixed(3)}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {Object.entries(prediction.forecast.scenarios).map(([scenario, data]) => (
                    <div key={scenario} className="rounded-xl bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{scenario}</div>
                      <div className="mt-2 text-xl font-semibold text-slate-950">${data.target_price.toFixed(2)}</div>
                      <div className="text-sm text-slate-600">
                        {data.return_percent.toFixed(2)}% | {(data.probability * 100).toFixed(0)}% probability
                      </div>
                    </div>
                  ))}
                </div>

                {forecastPath.length > 0 && (
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={forecastPath}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '']} />
                        <Legend />
                        <Line type="monotone" dataKey="high" stroke="#16a34a" strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="mid" stroke="#0f172a" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="low" stroke="#dc2626" strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {prediction.global_context && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global Transmission Map</div>
                  <div className="text-sm text-slate-600">{prediction.global_context.risk_summary}</div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Top Tailwinds</div>
                    <div className="mt-3 space-y-3">
                      {prediction.global_context.top_positive_drivers.slice(0, 4).map((driver) => (
                        <div key={driver.symbol} className="flex items-center justify-between text-sm">
                          <div>
                            <div className="font-medium text-slate-900">{driver.name}</div>
                            <div className="text-slate-600">
                              {driver.latest_move_percent.toFixed(2)}% move | corr {driver.correlation.toFixed(2)}
                            </div>
                          </div>
                          <div className="font-semibold text-emerald-700">{driver.impact_score.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-rose-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Top Headwinds</div>
                    <div className="mt-3 space-y-3">
                      {prediction.global_context.top_negative_drivers.slice(0, 4).map((driver) => (
                        <div key={driver.symbol} className="flex items-center justify-between text-sm">
                          <div>
                            <div className="font-medium text-slate-900">{driver.name}</div>
                            <div className="text-slate-600">
                              {driver.latest_move_percent.toFixed(2)}% move | corr {driver.correlation.toFixed(2)}
                            </div>
                          </div>
                          <div className="font-semibold text-rose-700">{driver.impact_score.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Regime</div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-lg font-semibold text-slate-950">{prediction.global_context.risk_regime.label}</div>
                    <div className="text-sm text-slate-600">Score {prediction.global_context.risk_regime.score.toFixed(3)}</div>
                  </div>
                </div>
              </div>
            )}

            {prediction.news_themes && prediction.news_themes.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cross-Market Themes</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {prediction.news_themes.map((theme) => (
                    <span
                      key={theme.theme}
                      className={`rounded-full px-3 py-1 text-sm ${
                        theme.direction === 'tailwind' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {theme.theme.replace('_', ' ')} · {theme.direction}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {predictionComponents.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              {predictionComponents.map(([name, component]) => (
                <div key={name} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name.replace('_', ' ')}</div>
                  <div className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getSignalClasses(component.signal)}`}>
                    {component.signal.toUpperCase()}
                  </div>
                  <div className="mt-3 text-sm text-slate-500">Confidence</div>
                  <div className="text-lg font-semibold text-slate-900">{(component.confidence * 100).toFixed(0)}%</div>
                  <p className="mt-3 text-sm text-slate-600">{component.reasoning}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!prediction && !loading && <div className="py-8 text-center text-slate-500">No prediction available.</div>}
    </div>
  );
};

export default PredictionsDashboard;
