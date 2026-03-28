import React, { useCallback, useEffect, useState } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';

import { ScenarioResponse, ScenarioSeed, ScenarioSeedResponse, scenarioAPI } from '../api';

interface ScenarioLabProps {
  defaultSymbol: string;
}

const defaultSeed = (symbol: string) => `Latest market setup for ${symbol}`;

const ScenarioLab: React.FC<ScenarioLabProps> = ({ defaultSymbol }) => {
  const [symbol, setSymbol] = useState(defaultSymbol.toUpperCase());
  const [inputSymbol, setInputSymbol] = useState(defaultSymbol.toUpperCase());
  const [seedEvent, setSeedEvent] = useState(defaultSeed(defaultSymbol.toUpperCase()));
  const [variablesText, setVariablesText] = useState('higher demand\nmargin expansion\nlower yields');
  const [horizonDays, setHorizonDays] = useState(30);
  const [result, setResult] = useState<ScenarioResponse | null>(null);
  const [seedBundle, setSeedBundle] = useState<ScenarioSeedResponse | null>(null);
  const [loadingSeeds, setLoadingSeeds] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  const runScenarioWithInputs = useCallback(async (
    symbolToUse: string,
    nextSeedEvent: string,
    nextVariablesText: string,
    forceRefresh = false,
  ) => {
    if (!symbolToUse || !nextSeedEvent.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const variables = nextVariablesText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
      const response = await scenarioAPI.runScenario(symbolToUse, nextSeedEvent.trim(), horizonDays, variables, forceRefresh);
      setResult(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to run scenario simulation');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [horizonDays]);

  const runScenario = useCallback(async (forceRefresh = false, overrideSymbol?: string) => {
    const symbolToUse = (overrideSymbol || symbol).trim().toUpperCase();
    await runScenarioWithInputs(symbolToUse, seedEvent, variablesText, forceRefresh);
  }, [runScenarioWithInputs, seedEvent, symbol, variablesText]);

  const loadSeeds = useCallback(async (forceRefresh = false, overrideSymbol?: string) => {
    const symbolToUse = (overrideSymbol || symbol).trim().toUpperCase();
    if (!symbolToUse) {
      return;
    }

    setLoadingSeeds(true);
    setSeedError(null);
    try {
      const response = await scenarioAPI.getScenarioSeeds(symbolToUse, 3, forceRefresh);
      setSeedBundle(response.data);
    } catch (err: any) {
      setSeedBundle(null);
      setSeedError(err?.response?.data?.detail || err.message || 'Failed to import scenario seeds from news');
    } finally {
      setLoadingSeeds(false);
    }
  }, [symbol]);

  useEffect(() => {
    const nextSymbol = defaultSymbol.toUpperCase();
    setSymbol(nextSymbol);
    setInputSymbol(nextSymbol);
    setSeedEvent(defaultSeed(nextSymbol));
    setVariablesText('');
  }, [defaultSymbol]);

  useEffect(() => {
    void loadSeeds(false, symbol);
  }, [loadSeeds, symbol]);

  useEffect(() => {
    if (!seedBundle?.seeds?.length) {
      void runScenarioWithInputs(symbol, seedEvent, variablesText, false);
      return;
    }

    const firstSeed = seedBundle.seeds[0];
    setSeedEvent(firstSeed.seed_event);
    setVariablesText(firstSeed.variables.join('\n'));
    void runScenarioWithInputs(symbol, firstSeed.seed_event, firstSeed.variables.join('\n'), false);
  }, [runScenarioWithInputs, seedBundle, symbol]);

  const applySeed = (seed: ScenarioSeed) => {
    setSeedEvent(seed.seed_event);
    setVariablesText(seed.variables.join('\n'));
    void runScenarioWithInputs(symbol, seed.seed_event, seed.variables.join('\n'), true);
  };

  const submit = () => {
    const next = inputSymbol.trim().toUpperCase();
    if (!next) {
      return;
    }
    if (next === symbol) {
      void loadSeeds(true, next);
      return;
    }
    setSymbol(next);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <SparklesIcon className="mr-2 h-5 w-5 text-violet-600" />
          <h3 className="text-lg font-semibold text-slate-900">Scenario Lab</h3>
        </div>
        <button
          onClick={() => {
            void runScenario(true);
            void loadSeeds(true);
          }}
          disabled={loading || loadingSeeds}
          className="rounded-lg bg-violet-600 px-3 py-1 text-sm text-white hover:bg-violet-700 disabled:bg-slate-400"
        >
          {loading || loadingSeeds ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Symbol</label>
          <input
            value={inputSymbol}
            onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Horizon Days</label>
          <input
            type="number"
            min={1}
            max={365}
            value={horizonDays}
            onChange={(e) => setHorizonDays(Number(e.target.value) || 30)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:ring-violet-500"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={submit}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
          >
            Run Scenario
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imported News Seeds</div>
            <div className="mt-1 text-sm text-slate-600">
              Relevant world/news headlines for {symbol} can be used directly as scenario seeds.
            </div>
          </div>
          {seedBundle?.overall_sentiment && (
            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              {seedBundle.overall_sentiment.toUpperCase()}
            </div>
          )}
        </div>
        {seedError && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{seedError}</div>}
        <div className="mt-3 grid gap-3">
          {loadingSeeds && <div className="text-sm text-slate-500">Importing scenario seeds from news...</div>}
          {!loadingSeeds && seedBundle?.seeds?.length ? (
            seedBundle.seeds.map((seed, index) => (
              <button
                key={`${seed.headline}-${index}`}
                onClick={() => applySeed(seed)}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-300 hover:bg-violet-50"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{seed.headline || `Seed ${index + 1}`}</div>
                    <div className="mt-1 text-sm text-slate-600">{seed.summary || 'No summary available.'}</div>
                    {seed.published_at && (
                      <div className="mt-1 text-xs text-slate-400">{new Date(seed.published_at).toLocaleString()}</div>
                    )}
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {seed.sentiment.toUpperCase()} · {(seed.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Seed Event</div>
                <div className="mt-1 text-sm text-slate-700">{seed.seed_event}</div>
                {seed.impact_summary && (
                  <>
                    <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">How This Affects</div>
                    <div className="mt-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{seed.impact_summary}</div>
                  </>
                )}
                {seed.why_it_matters && (
                  <>
                    <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Why It Matters</div>
                    <div className="mt-1 text-sm text-slate-700">{seed.why_it_matters}</div>
                  </>
                )}
                {seed.effect_path && (
                  <>
                    <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Effect Path</div>
                    <div className="mt-1 text-sm text-slate-600">{seed.effect_path}</div>
                  </>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {seed.variables.map((item) => (
                    <span key={item} className="rounded-full bg-violet-50 px-3 py-1 text-xs text-violet-800">
                      {item}
                    </span>
                  ))}
                </div>
              </button>
            ))
          ) : (
            !loadingSeeds && <div className="text-sm text-slate-500">No imported scenario seeds available yet.</div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <label className="block text-sm font-medium text-slate-700">
          Seed Event
          <textarea
            value={seedEvent}
            onChange={(e) => setSeedEvent(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:ring-violet-500"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Scenario Variables
          <textarea
            value={variablesText}
            onChange={(e) => setVariablesText(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm focus:border-violet-500 focus:ring-violet-500"
            placeholder="One variable per line"
          />
        </label>
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">MiroFish-inspired simulation</div>
                <div className="mt-1 text-2xl font-bold text-slate-950">{result.symbol}</div>
                <div className="mt-2 text-sm text-slate-600">{result.simulation_report.executive_take}</div>
              </div>
              <div className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-800">
                {result.mode.toUpperCase()} · Bias {result.bias_score.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Current Price</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">${result.overview.current_price.toFixed(2)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Signal</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{result.overview.signal || 'N/A'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Confidence</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">
                {result.overview.confidence !== undefined ? `${(result.overview.confidence * 100).toFixed(0)}%` : 'N/A'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Source</div>
              <div className="mt-2 text-base font-semibold text-slate-950">{result.overview.source || 'Internal'}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(result.scenario_tree).map(([branch, data]) => (
              <div key={branch} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{branch}</div>
                <div className="mt-2 text-xl font-semibold text-slate-950">${data.target_price.toFixed(2)}</div>
                <div className={`text-sm ${data.return_percent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {data.return_percent.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">World State</div>
                <div className="mt-3 text-sm text-slate-700">{result.simulation_report.world_state}</div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Critical Paths</div>
                <div className="mt-3 space-y-2">
                  {result.simulation_report.critical_paths.map((item) => (
                    <div key={item} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decision Playbook</div>
                <div className="mt-3 space-y-2">
                  {result.simulation_report.decision_playbook.map((item) => (
                    <div key={item} className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pressure Map</div>
                <div className="mt-3 space-y-2">
                  {result.pressure_map.map((item) => (
                    <div key={`${item.type}-${item.name}`} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="mt-1 text-slate-600">
                        {item.relationship} · impact {Number(item.impact_score || 0).toFixed(2)} · {item.type.replace('_', ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Warning Flags</div>
                <div className="mt-3 space-y-2">
                  {result.simulation_report.warning_flags.map((item) => (
                    <div key={item} className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Input Variables</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.variables.map((item) => (
                    <span key={item} className="rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-800">
                      {item}
                    </span>
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

export default ScenarioLab;
