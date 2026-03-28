import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const API_TIMEOUT_MS = Number(process.env.REACT_APP_API_TIMEOUT_MS || 15000);
const PREDICTION_CACHE_TTL_MS = 120000;
const REQUEST_CACHE_TTL_MS = 120000;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.code === 'ECONNABORTED') {
      error.message = 'Request timed out. The app switched to a faster fail instead of waiting 60 seconds.';
    }
    return Promise.reject(error);
  }
);

const predictionCache = new Map<string, { expiresAt: number; data: any }>();
const inflightPredictionRequests = new Map<string, Promise<any>>();
const requestCache = new Map<string, { expiresAt: number; data: any }>();
const inflightRequests = new Map<string, Promise<any>>();

const getCachedRequest = async <T>(cacheKey: string, loader: () => Promise<T>, ttlMs = REQUEST_CACHE_TTL_MS, forceRefresh = false) => {
  const now = Date.now();
  const cached = requestCache.get(cacheKey);

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  if (!forceRefresh) {
    const inflight = inflightRequests.get(cacheKey);
    if (inflight) {
      return inflight as Promise<T>;
    }
  }

  const request = loader()
    .then((data) => {
      requestCache.set(cacheKey, {
        expiresAt: Date.now() + ttlMs,
        data,
      });
      return data;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, request as Promise<any>);
  return request;
};

export const predictionAPI = {
  async getPrediction(symbol: string, forceRefresh = false) {
    const normalized = symbol.trim().toUpperCase();
    const now = Date.now();
    const cacheKey = normalized;
    const cached = predictionCache.get(cacheKey);

    if (!forceRefresh && cached && cached.expiresAt > now) {
      return cached.data;
    }

    if (!forceRefresh) {
      const inflight = inflightPredictionRequests.get(cacheKey);
      if (inflight) {
        return inflight;
      }
    }

    const request = api
      .get(`/predictions/${normalized}`)
      .then((response) => {
        predictionCache.set(cacheKey, {
          expiresAt: Date.now() + PREDICTION_CACHE_TTL_MS,
          data: response.data,
        });
        return response.data;
      })
      .finally(() => {
        inflightPredictionRequests.delete(cacheKey);
      });

    inflightPredictionRequests.set(cacheKey, request);
    return request;
  },
};

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
}

export interface PortfolioResponse {
  user_id: number;
  cash_balance: number;
  total_value: number;
  positions_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  positions: PortfolioPosition[];
  holdings: PortfolioPosition[];
  watchlist_symbols: string[];
}

export interface OrderResponse {
  id: number;
  user_id: number;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit';
  quantity: number;
  price: number;
  requested_price: number;
  executed_price: number;
  fees: number;
  slippage: number;
  status: 'pending' | 'filled' | 'rejected' | 'cancelled';
  created_at: string;
}

export interface TradeResponse {
  id: number;
  order_id: number;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  gross_total: number;
  net_total: number;
  fees: number;
  slippage: number;
  total: number;
  timestamp: string;
}

export interface WatchlistItem {
  id: number;
  symbol: string;
  price: number;
  change_percent: number;
  change_percent_label: string;
  added_at: string;
}

export const stockAPI = {
  getStockQuote: (symbol: string, forceRefresh = false) =>
    getCachedRequest(`stock-quote:${symbol.toUpperCase()}`, () => api.get<CryptoQuote>(`/stocks/${symbol}`), 45000, forceRefresh),
  getStockHistory: (symbol: string, period = '1y', interval = '1d', forceRefresh = false) =>
    getCachedRequest(
      `stock-history:${symbol.toUpperCase()}:${period}:${interval}`,
      () => api.get(`/stocks/${symbol}/history`, { params: { period, interval } }),
      300000,
      forceRefresh
    ),
  getCryptoQuote: (symbol: string, forceRefresh = false) =>
    getCachedRequest(`crypto-quote:${symbol.toUpperCase()}`, () => api.get<CryptoQuote>(`/stocks/crypto/${symbol}`), 45000, forceRefresh),
  getCryptoHistory: (symbol: string, period = '1y', interval = '1d', forceRefresh = false) =>
    getCachedRequest(
      `crypto-history:${symbol.toUpperCase()}:${period}:${interval}`,
      () => api.get(`/stocks/crypto/${symbol}/history`, { params: { period, interval } }),
      300000,
      forceRefresh
    ),
  getTechnicalAnalysis: (symbol: string, forceRefresh = false) =>
    getCachedRequest(`technical:${symbol.toUpperCase()}`, () => api.get<TechnicalAnalysis>(`/stocks/analysis/${symbol}`), 300000, forceRefresh),
  getMarketOverview: (forceRefresh = false) =>
    getCachedRequest('market-overview', () => api.get<MarketOverview>('/stocks/market/overview'), 60000, forceRefresh),
  getMarketContext: (symbol: string, forceRefresh = false) =>
    getCachedRequest(`market-context:${symbol.toUpperCase()}`, () => api.get<GlobalContext>(`/stocks/market/context/${symbol}`), 180000, forceRefresh),
  getProviderHealth: (forceRefresh = false) =>
    getCachedRequest('provider-health', () => api.get<ProviderHealth>('/stocks/market/providers/health'), 30000, forceRefresh),
  getTopMovers: (limit = 10, forceRefresh = false) =>
    getCachedRequest(`top-movers:${limit}`, () => api.get('/stocks/market/top-movers', { params: { limit } }), 90000, forceRefresh),
  searchSymbols: (query: string, limit = 10) => api.get(`/stocks/search/${query}`, { params: { limit } }),
  getLivePrices: (symbols: string[], forceRefresh = false) => {
    const normalizedSymbols = symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
    const cacheKey = `live-prices:${normalizedSymbols.slice().sort().join(',')}`;
    return getCachedRequest(
      cacheKey,
      () =>
        api.get<{ symbols: string[]; prices: Record<string, CryptoQuote>; timestamp: number }>('/stocks/live-prices', {
          params: { symbols: normalizedSymbols.join(',') },
        }),
      45000,
      forceRefresh
    );
  },
};

export const researchAPI = {
  getResearchMemo: (symbol: string, horizonDays = 30, forceRefresh = false) =>
    getCachedRequest(
      `research:${symbol.toUpperCase()}:${horizonDays}`,
      () => api.get<ResearchMemo>(`/research/${symbol}`, { params: { horizon_days: horizonDays } }),
      180000,
      forceRefresh
    ),
};

export const newsAPI = {
  getSummary: (query: string, days = 3, forceRefresh = false) =>
    getCachedRequest(
      `news-summary:${query.toUpperCase()}:${days}`,
      () => api.get<NewsSummary>('/news/summary', { params: { query, days } }),
      180000,
      forceRefresh
    ),
};

export const tradingAPI = {
  createUser: (name: string, email: string, initialBalance = 100000) =>
    api.post('/trading/users', { name, email, initial_balance: initialBalance }),
  getUser: (userId: number) => api.get(`/trading/users/${userId}`),
  placeOrder: (payload: {
    user_id: number;
    symbol: string;
    order_type: 'market' | 'limit';
    side: 'buy' | 'sell';
    quantity: number;
    limit_price?: number;
  }) => api.post('/trading/orders', payload),
  cancelOrder: (orderId: number, userId: number) =>
    api.delete(`/trading/orders/${orderId}`, { params: { user_id: userId } }),
  getPortfolio: (userId: number) => api.get<PortfolioResponse>(`/trading/portfolio/${userId}`),
  getOrders: (userId: number) => api.get<OrderResponse[]>(`/trading/orders/${userId}`),
  getTrades: (userId: number, limit = 100) =>
    api.get<TradeResponse[]>(`/trading/trades/${userId}`, { params: { limit } }),
  getWatchlist: (userId: number) => api.get<WatchlistItem[]>(`/trading/watchlist/${userId}`),
  addToWatchlist: (userId: number, symbol: string) => api.post('/trading/watchlist', { user_id: userId, symbol }),
  removeFromWatchlist: (userId: number, symbol: string) =>
    api.delete(`/trading/watchlist/${symbol}`, { params: { user_id: userId } }),
};

export interface TechnicalAnalysis {
  symbol: string;
  current_price: number;
  display_price?: number;
  display_currency?: string;
  fx_rate?: number;
  indicators: {
    sma_20: number;
    sma_50: number;
    rsi: number;
    macd: number;
    macd_signal: number;
    bb_upper: number;
    bb_lower: number;
  };
  display_indicators?: {
    sma_20: number;
    sma_50: number;
    bb_upper: number;
    bb_lower: number;
  };
  signals: Array<{
    type: 'bullish' | 'bearish';
    signal: string;
    strength: 'high' | 'medium' | 'low';
  }>;
  recommendation: {
    action: string;
    confidence: string;
    bullish_signals: number;
    bearish_signals: number;
    total_signals: number;
  };
  timestamp: string;
}

export interface CryptoQuote {
  symbol: string;
  price: number;
  change: number;
  change_percent: string;
  volume: number;
  timestamp: string;
  source: string;
}

export interface MarketOverview {
  indices: Record<
    string,
    {
      price: number;
      change: number;
      change_percent: string;
    }
  >;
  cryptocurrencies: Record<
    string,
    {
      price: number;
      change: number;
      change_percent: string;
    }
  >;
  timestamp: string;
}

export interface MarketDriver {
  symbol: string;
  name: string;
  category: string;
  region: string;
  latest_move_percent: number;
  correlation: number;
  impact_score: number;
  relationship: string;
}

export interface GlobalContext {
  profile: {
    symbol: string;
    sector: string;
    region: string;
    asset_type: string;
  };
  risk_regime: {
    label: string;
    score: number;
  };
  top_positive_drivers: MarketDriver[];
  top_negative_drivers: MarketDriver[];
  driver_map: MarketDriver[];
  risk_summary: string;
}

export interface ProviderHealthItem {
  provider: string;
  label: string;
  enabled: boolean;
  configured: boolean;
  attempts: number;
  successes: number;
  failures: number;
  last_status: string;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  last_error?: string | null;
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded';
  live_ready: boolean;
  degraded: boolean;
  providers: ProviderHealthItem[];
  timestamp: string;
}

export interface ForecastScenario {
  target_price: number;
  return_percent: number;
  probability: number;
}

export interface ForecastPoint {
  day: number;
  mid: number;
  low: number;
  high: number;
}

export interface ForecastResponse {
  horizon_days: number;
  current_price: number;
  expected_volatility_percent: number;
  macro_bias_score: number;
  scenarios: {
    bull: ForecastScenario;
    base: ForecastScenario;
    bear: ForecastScenario;
  };
  path: ForecastPoint[];
}

export interface ResearchCatalyst {
  title: string;
  detail: string;
}

export interface ResearchMemo {
  symbol: string;
  generated_at: string;
  stance: string;
  executive_summary: string;
  overview: {
    price: number;
    change_percent?: string;
    signal: string;
    confidence: number;
    predicted_price?: number;
    price_gap_percent?: number | null;
    market_cap?: number | null;
    pe_ratio?: number | null;
    dividend_yield?: number | null;
    source?: string;
  };
  investment_thesis: string[];
  catalysts: ResearchCatalyst[];
  risk_flags: string[];
  valuation_snapshot: {
    market_cap?: number | null;
    pe_ratio?: number | null;
    dividend_yield?: number | null;
    predicted_price?: number | null;
    expected_return_percent?: number | null;
  };
  technical_snapshot: {
    action: string;
    confidence: string;
    signals: Array<{
      type: 'bullish' | 'bearish';
      signal: string;
      strength: 'high' | 'medium' | 'low';
    }>;
  };
  macro_driver_map: {
    tailwinds: MarketDriver[];
    headwinds: MarketDriver[];
    risk_summary?: string;
  };
  news_brief: Array<{
    title?: string;
    summary?: string;
    sentiment?: string;
  }>;
  theme_brief: Array<{
    theme: string;
    impact_score: number;
    direction: string;
    strength: number;
  }>;
  diligence_questions: string[];
}

export interface NewsSummaryHeadline {
  title?: string;
  description?: string;
  publishedAt?: string;
  sentiment: string;
  confidence: number;
}

export interface NewsThemeBrief {
  theme: string;
  impact_score: number;
  direction: string;
  strength: number;
}

export interface NewsSummary {
  query: string;
  overall_sentiment: string;
  confidence: number;
  article_count: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  bullish_headline?: NewsSummaryHeadline | null;
  bearish_headline?: NewsSummaryHeadline | null;
  themes: NewsThemeBrief[];
  timeline: NewsSummaryHeadline[];
}

export interface BacktestStrategyDefinition {
  key: string;
  label: string;
  description: string;
}

export interface BacktestTrade {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  return_percent: number;
  outcome: string;
}

export interface BacktestChartPoint {
  date: string;
  equity: number;
  benchmark_equity?: number | null;
  position: number;
}

export interface BacktestMetrics {
  final_value: number;
  total_return_percent: number;
  cagr_percent: number;
  sharpe_ratio: number;
  max_drawdown_percent: number;
  volatility_percent: number;
  win_rate_percent: number;
}

export interface BacktestResponse {
  symbol: string;
  strategy: BacktestStrategyDefinition;
  period: string;
  interval: string;
  initial_capital: number;
  metrics: BacktestMetrics;
  trade_count: number;
  trades: BacktestTrade[];
  chart: BacktestChartPoint[];
  benchmark: {
    symbol: string;
    final_value: number;
    return_percent: number;
  };
}

export const backtestAPI = {
  listStrategies: (forceRefresh = false) =>
    getCachedRequest('backtest-strategies', () => api.get<BacktestStrategyDefinition[]>('/backtest/strategies'), 300000, forceRefresh),
  runBacktest: (
    symbol: string,
    strategy: string,
    period = '1y',
    interval = '1d',
    initialCapital = 10000,
    benchmark?: string,
    forceRefresh = false,
  ) =>
    getCachedRequest(
      `backtest:${symbol.toUpperCase()}:${strategy}:${period}:${interval}:${initialCapital}:${benchmark || ''}`,
      () =>
        api.get<BacktestResponse>(`/backtest/run/${symbol}`, {
          params: {
            strategy,
            period,
            interval,
            initial_capital: initialCapital,
            benchmark,
          },
        }),
      180000,
      forceRefresh
    ),
};

export interface ScenarioPressurePoint {
  name: string;
  impact_score: number;
  relationship: string;
  type: string;
}

export interface ScenarioBranch {
  target_price: number;
  return_percent: number;
}

export interface ScenarioResponse {
  symbol: string;
  seed_event: string;
  horizon_days: number;
  mode: string;
  bias_score: number;
  variables: string[];
  overview: {
    current_price: number;
    source?: string;
    signal?: string;
    confidence?: number;
  };
  scenario_tree: {
    bull: ScenarioBranch;
    base: ScenarioBranch;
    bear: ScenarioBranch;
  };
  pressure_map: ScenarioPressurePoint[];
  simulation_report: {
    executive_take: string;
    world_state: string;
    critical_paths: string[];
    warning_flags: string[];
    decision_playbook: string[];
  };
}

export interface ScenarioSeed {
  headline?: string;
  summary?: string;
  published_at?: string;
  seed_event: string;
  variables: string[];
  sentiment: string;
  confidence: number;
  company_name?: string;
  impact_summary?: string;
  why_it_matters?: string;
  effect_path?: string;
}

export interface ScenarioSeedResponse {
  symbol: string;
  company_name?: string;
  days: number;
  overall_sentiment?: string;
  theme_brief?: Array<{
    theme: string;
    impact_score: number;
    direction: string;
    strength: number;
  }>;
  seeds: ScenarioSeed[];
}

export const scenarioAPI = {
  runScenario: (
    symbol: string,
    seedEvent: string,
    horizonDays = 30,
    variables: string[] = [],
    forceRefresh = false,
  ) =>
    getCachedRequest(
      `scenario:${symbol.toUpperCase()}:${seedEvent}:${horizonDays}:${variables.join('|')}`,
      () =>
        api.get<ScenarioResponse>(`/scenario/simulate/${symbol}`, {
          params: {
            seed_event: seedEvent,
            horizon_days: horizonDays,
            variables,
          },
        }),
      120000,
      forceRefresh
    ),
  getScenarioSeeds: (symbol: string, days = 3, forceRefresh = false) =>
    getCachedRequest(
      `scenario-seeds:${symbol.toUpperCase()}:${days}`,
      () =>
        api.get<ScenarioSeedResponse>(`/scenario/seeds/${symbol}`, {
          params: { days },
        }),
      120000,
      forceRefresh
    ),
};
