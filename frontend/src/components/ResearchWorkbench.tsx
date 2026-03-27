import React, { useEffect, useState } from 'react';
import { DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline';

import { ResearchMemo, researchAPI } from '../api';

interface ResearchWorkbenchProps {
  defaultSymbol: string;
}

const formatMoney = (value?: number | null) => {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return 'N/A';
  }
  if (Math.abs(value) >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  return `$${value.toFixed(2)}`;
};

const ResearchWorkbench: React.FC<ResearchWorkbenchProps> = ({ defaultSymbol }) => {
  const [symbol, setSymbol] = useState(defaultSymbol.toUpperCase());
  const [inputValue, setInputValue] = useState(defaultSymbol.toUpperCase());
  const [memo, setMemo] = useState<ResearchMemo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMemo = async (nextSymbol: string, forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await researchAPI.getResearchMemo(nextSymbol, 30, forceRefresh);
      setMemo(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to generate research memo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemo(symbol);
  }, [symbol]);

  useEffect(() => {
    const nextSymbol = defaultSymbol.toUpperCase();
    setSymbol(nextSymbol);
    setInputValue(nextSymbol);
  }, [defaultSymbol]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <DocumentMagnifyingGlassIcon className="mr-2 h-5 w-5 text-slate-900" />
          <h3 className="text-lg font-semibold text-slate-900">Research Memo</h3>
        </div>
        <button
          onClick={() => loadMemo(symbol, true)}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-800 disabled:bg-slate-400"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700">Symbol</label>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm focus:border-slate-900 focus:ring-slate-900"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={() => {
              const next = inputValue.trim().toUpperCase();
              if (next) {
                if (next === symbol) {
                  loadMemo(next, true);
                  return;
                }
                setSymbol(next);
              }
            }}
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-slate-400"
          >
            Generate
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {memo && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">FinRobot-style memo</div>
                <div className="mt-1 text-2xl font-bold text-slate-950">{memo.symbol}</div>
                <div className="mt-1 text-sm text-slate-600">{memo.executive_summary}</div>
              </div>
              <div className="rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">{memo.stance}</div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="rounded-xl bg-white p-4">
                <div className="text-xs text-slate-500">Price</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{formatMoney(memo.overview.price)}</div>
                <div className="text-sm text-slate-600">{memo.overview.change_percent || 'N/A'}</div>
              </div>
              <div className="rounded-xl bg-white p-4">
                <div className="text-xs text-slate-500">Signal</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{memo.overview.signal}</div>
                <div className="text-sm text-slate-600">{(memo.overview.confidence * 100).toFixed(0)}% confidence</div>
              </div>
              <div className="rounded-xl bg-white p-4">
                <div className="text-xs text-slate-500">Predicted Price</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{formatMoney(memo.overview.predicted_price)}</div>
                <div className="text-sm text-slate-600">
                  {memo.overview.price_gap_percent !== null && memo.overview.price_gap_percent !== undefined
                    ? `${memo.overview.price_gap_percent.toFixed(2)}% gap`
                    : 'No target'}
                </div>
              </div>
              <div className="rounded-xl bg-white p-4">
                <div className="text-xs text-slate-500">Source</div>
                <div className="mt-1 text-base font-semibold text-slate-950">{memo.overview.source || 'Internal'}</div>
                <div className="text-sm text-slate-600">{new Date(memo.generated_at).toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Investment Thesis</div>
                <div className="mt-3 space-y-3">
                  {memo.investment_thesis.map((point) => (
                    <div key={point} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      {point}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Catalysts</div>
                <div className="mt-3 space-y-3">
                  {memo.catalysts.length === 0 && <div className="text-sm text-slate-500">No major catalysts identified.</div>}
                  {memo.catalysts.map((item) => (
                    <div key={item.title} className="rounded-xl bg-sky-50 p-3">
                      <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-700">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diligence Questions</div>
                <div className="mt-3 space-y-2">
                  {memo.diligence_questions.map((question) => (
                    <div key={question} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                      {question}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valuation Snapshot</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Market Cap</div>
                    <div className="text-lg font-semibold text-slate-950">{formatMoney(memo.valuation_snapshot.market_cap)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">P/E</div>
                    <div className="text-lg font-semibold text-slate-950">
                      {memo.valuation_snapshot.pe_ratio ? memo.valuation_snapshot.pe_ratio.toFixed(2) : 'N/A'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Dividend Yield</div>
                    <div className="text-lg font-semibold text-slate-950">
                      {memo.valuation_snapshot.dividend_yield !== undefined && memo.valuation_snapshot.dividend_yield !== null
                        ? `${memo.valuation_snapshot.dividend_yield.toFixed(2)}%`
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Expected Return</div>
                    <div className="text-lg font-semibold text-slate-950">
                      {memo.valuation_snapshot.expected_return_percent !== undefined && memo.valuation_snapshot.expected_return_percent !== null
                        ? `${memo.valuation_snapshot.expected_return_percent.toFixed(2)}%`
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Flags</div>
                <div className="mt-3 space-y-2">
                  {memo.risk_flags.map((flag) => (
                    <div key={flag} className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
                      {flag}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Macro Driver Map</div>
                {memo.macro_driver_map.risk_summary && (
                  <div className="mt-2 text-sm text-slate-600">{memo.macro_driver_map.risk_summary}</div>
                )}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Tailwinds</div>
                    <div className="mt-2 space-y-2">
                      {memo.macro_driver_map.tailwinds.map((driver) => (
                        <div key={driver.symbol} className="text-sm text-slate-800">
                          <span className="font-medium">{driver.name}</span> ({driver.impact_score.toFixed(2)})
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Headwinds</div>
                    <div className="mt-2 space-y-2">
                      {memo.macro_driver_map.headwinds.map((driver) => (
                        <div key={driver.symbol} className="text-sm text-slate-800">
                          <span className="font-medium">{driver.name}</span> ({driver.impact_score.toFixed(2)})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">News Brief</div>
                <div className="mt-3 space-y-3">
                  {memo.news_brief.length === 0 && <div className="text-sm text-slate-500">No recent news digest available.</div>}
                  {memo.news_brief.map((item, index) => (
                    <div key={`${item.title}-${index}`} className="rounded-xl bg-slate-50 p-3">
                      <div className="text-sm font-semibold text-slate-900">{item.title || 'Market update'}</div>
                      <div className="mt-1 text-sm text-slate-700">{item.summary || 'No summary available.'}</div>
                      {item.sentiment && <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{item.sentiment}</div>}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchWorkbench;
