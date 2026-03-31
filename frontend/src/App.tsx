import React, { useCallback, useEffect, useRef, useState } from 'react';

import { PortfolioResponse, OrderResponse, TradeResponse, WatchlistItem, ProviderHealth, NewsSummary, api, newsAPI, stockAPI, tradingAPI } from './api';
import AssistantPanel from './components/AssistantPanel';
import AISignals from './components/AISignals';
import CryptoDashboard from './components/CryptoDashboard';
import MarketOverview from './components/MarketOverview';
import NewsFeed from './components/NewsFeed';
import OrderHistory from './components/OrderHistory';
import PortfolioView from './components/PortfolioView';
import PredictionsDashboard from './components/PredictionsDashboard';
import ResearchWorkbench from './components/ResearchWorkbench';
import RiskCalculator from './components/RiskCalculator';
import RiskSimulator from './components/RiskSimulator';
import SelectedAssetRail from './components/SelectedAssetRail';
import SentimentSummaryCard from './components/SentimentSummaryCard';
import SentimentTimelineCard from './components/SentimentTimelineCard';
import Sidebar from './components/Sidebar';
import StockChart from './components/StockChart';
import StockSearch from './components/StockSearch';
import TechnicalAnalysis from './components/TechnicalAnalysis';
import TradingPanel from './components/TradingPanel';
import Watchlist from './components/Watchlist';
import BacktestingDashboard from './components/BacktestingDashboard';
import ScenarioLab from './components/ScenarioLab';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import Onboarding from './components/Onboarding';
import LoadingSpinner, { LoadingCard, LoadingGrid } from './components/Loading';

interface NewsItem {
  title: string;
  impact: string;
  sentiment: string;
  timestamp: string;
}

interface ToastItem {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

const emptyPortfolio: PortfolioResponse = {
  user_id: 0,
  cash_balance: 0,
  total_value: 0,
  positions_value: 0,
  unrealized_pnl: 0,
  realized_pnl: 0,
  positions: [],
  holdings: [],
  watchlist_symbols: [],
};

const safeNumber = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [tradeDraft, setTradeDraft] = useState<{ symbol: string; side: 'buy' | 'sell' }>({ symbol: 'AAPL', side: 'buy' });
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResponse>(emptyPortfolio);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [trades, setTrades] = useState<TradeResponse[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loadingTradingData, setLoadingTradingData] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingSentimentSummary, setLoadingSentimentSummary] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [latestQuote, setLatestQuote] = useState<any | undefined>(undefined);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth | null>(null);
  const [sentimentSummary, setSentimentSummary] = useState<NewsSummary | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const latestQuoteRequestId = useRef(0);

  const pushToast = useCallback((message: string, tone: 'success' | 'error') => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const stored = localStorage.getItem('finply_user_id') || localStorage.getItem('sentinel_user_id');
      if (stored) {
        setUserId(Number(stored));
        return;
      }

      const response = await tradingAPI.createUser('Finply User', 'user@finply.local', 100000);
      localStorage.setItem('finply_user_id', String(response.data.user_id));
      setUserId(response.data.user_id);
    } catch (error: any) {
      setAppError(error?.response?.data?.detail || error.message || 'Unable to create paper trading account');
    }
  }, []);

  const refreshTradingData = useCallback(
    async (id: number, silent = false) => {
      if (!silent) {
        setLoadingTradingData(true);
      }
      try {
        const [portfolioResponse, ordersResponse, tradesResponse, watchlistResponse] = await Promise.all([
          tradingAPI.getPortfolio(id),
          tradingAPI.getOrders(id),
          tradingAPI.getTrades(id, 100),
          tradingAPI.getWatchlist(id),
        ]);

        setPortfolio({
          ...emptyPortfolio,
          ...portfolioResponse.data,
          cash_balance: safeNumber(portfolioResponse.data.cash_balance),
          total_value: safeNumber(portfolioResponse.data.total_value),
          positions_value: safeNumber(portfolioResponse.data.positions_value),
          unrealized_pnl: safeNumber(portfolioResponse.data.unrealized_pnl),
          realized_pnl: safeNumber(portfolioResponse.data.realized_pnl),
          positions: Array.isArray(portfolioResponse.data.positions) ? portfolioResponse.data.positions : [],
          holdings: Array.isArray(portfolioResponse.data.holdings) ? portfolioResponse.data.holdings : [],
          watchlist_symbols: Array.isArray(portfolioResponse.data.watchlist_symbols) ? portfolioResponse.data.watchlist_symbols : [],
        });
        setOrders(ordersResponse.data);
        setTrades(tradesResponse.data);
        setWatchlist(watchlistResponse.data);
        setAppError(null);
      } catch (error: any) {
        setAppError(error?.response?.data?.detail || error.message || 'Unable to refresh trading data');
      } finally {
        if (!silent) {
          setLoadingTradingData(false);
        }
      }
    },
    []
  );

  const loadNews = useCallback(async () => {
    setLoadingNews(true);
    try {
      const response = await api.get('/news', { params: { query: selectedSymbol, days: 1 } });
      setNewsItems(
        response.data.map((item: any) => ({
          title: item.title,
          impact: item.description || 'Market update',
          sentiment: item.sentiment || 'neutral',
          timestamp: item.publishedAt ? new Date(item.publishedAt).toLocaleString() : '',
        }))
      );
    } catch (error) {
      console.warn('Unable to load news', error);
    } finally {
      setLoadingNews(false);
    }
  }, [selectedSymbol]);

  const loadSelectedPrice = useCallback(async () => {
    const requestId = ++latestQuoteRequestId.current;
    const normalizedSymbol = selectedSymbol.trim().toUpperCase();

    try {
      const liveResponse = await stockAPI.getLivePrices([normalizedSymbol], true);
      const quote = liveResponse.data.prices?.[normalizedSymbol];
      if (quote?.price !== undefined) {
        if (latestQuoteRequestId.current !== requestId) {
          return;
        }
        setLatestQuote(quote);
        return;
      }
      const stockResponse = await stockAPI.getStockQuote(normalizedSymbol, true);
      if (latestQuoteRequestId.current !== requestId) {
        return;
      }
      setLatestQuote(stockResponse.data);
    } catch {
      if (latestQuoteRequestId.current === requestId) {
        setLatestQuote(undefined);
      }
    }
  }, [selectedSymbol]);

  const loadSentimentSummary = useCallback(async () => {
    setLoadingSentimentSummary(true);
    try {
      const response = await newsAPI.getSummary(selectedSymbol, 3, true);
      setSentimentSummary(response.data);
    } catch {
      setSentimentSummary(null);
    } finally {
      setLoadingSentimentSummary(false);
    }
  }, [selectedSymbol]);

  const loadProviderHealth = useCallback(async (forceRefresh = false) => {
    try {
      const response = await stockAPI.getProviderHealth(forceRefresh);
      setProviderHealth(response.data);
    } catch {
      setProviderHealth(null);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    // Check if user has completed onboarding
    const onboardingCompleted = localStorage.getItem('finply_onboarding_completed');
    if (!onboardingCompleted && userId) {
      // Show onboarding after a brief delay to let the app load
      const timer = setTimeout(() => setShowOnboarding(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [userId]);

  useEffect(() => {
    setLatestQuote(undefined);
    loadNews();
    loadSelectedPrice();
    loadSentimentSummary();
  }, [loadNews, loadSelectedPrice, loadSentimentSummary]);

  useEffect(() => {
    loadProviderHealth();
    const interval = window.setInterval(() => {
      loadProviderHealth(true);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [loadProviderHealth]);

  useEffect(() => {
    if (latestQuote?.price !== undefined) {
      return;
    }

    const retryTimer = window.setTimeout(() => {
      loadSelectedPrice();
    }, 5000);

    return () => window.clearTimeout(retryTimer);
  }, [latestQuote, loadSelectedPrice]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    refreshTradingData(userId);
    const interval = window.setInterval(() => refreshTradingData(userId, true), 30000);
    return () => window.clearInterval(interval);
  }, [refreshTradingData, userId]);

  const stageTrade = (symbol: string, side: 'buy' | 'sell') => {
    setSelectedSymbol(symbol);
    setTradeDraft({ symbol, side });
    setActiveTab('trading');
  };

  const submitOrder = async (payload: {
    symbol: string;
    order_type: 'market' | 'limit';
    side: 'buy' | 'sell';
    quantity: number;
    limit_price?: number;
  }) => {
    if (!userId) {
      throw new Error('Paper trading account not ready');
    }

    const response = await tradingAPI.placeOrder({
      user_id: userId,
      ...payload,
    });
    await refreshTradingData(userId, true);
    setTradeDraft({ symbol: payload.symbol, side: payload.side });
    pushToast(response.data.message || 'Order submitted', 'success');
  };

  const handleSellPosition = async (symbol: string, quantity: number) => {
    if (!userId) {
      throw new Error('Paper trading account not ready');
    }
    await tradingAPI.placeOrder({
      user_id: userId,
      symbol,
      order_type: 'market',
      side: 'sell',
      quantity,
    });
    await refreshTradingData(userId, true);
    pushToast(`Sold ${quantity} ${symbol}`, 'success');
  };

  const handleAddWatchlist = async (symbol: string) => {
    if (!userId) {
      throw new Error('Paper trading account not ready');
    }
    await tradingAPI.addToWatchlist(userId, symbol);
    await refreshTradingData(userId, true);
    pushToast(`${symbol} added to watchlist`, 'success');
  };

  const handleRemoveWatchlist = async (symbol: string) => {
    if (!userId) {
      throw new Error('Paper trading account not ready');
    }
    await tradingAPI.removeFromWatchlist(userId, symbol);
    await refreshTradingData(userId, true);
    pushToast(`${symbol} removed from watchlist`, 'success');
  };

  const cashBalance = safeNumber(portfolio.cash_balance);
  const totalValue = safeNumber(portfolio.total_value);
  const unrealizedPnL = safeNumber(portfolio.unrealized_pnl);
  const realizedPnL = safeNumber(portfolio.realized_pnl);
  const latestPrice = safeNumber(latestQuote?.price, Number.NaN);
  const hasLatestPrice = Number.isFinite(latestPrice);
  const latestQuoteSource = latestQuote?.source || 'Unavailable';
  const isOfflinePrice = typeof latestQuoteSource === 'string' && latestQuoteSource.toLowerCase().includes('offline');
  const providerHealthLabel = providerHealth ? (providerHealth.status === 'healthy' ? 'Healthy' : 'Degraded') : 'Checking';
  const liveProviders =
    providerHealth?.providers
      ?.filter((item) => item.enabled && item.provider !== 'offline_feed' && item.last_status === 'ok')
      .map((item) => item.label)
      .slice(0, 3) || [];
  const dashboardChange = realizedPnL + unrealizedPnL;
  const dashboardChangePercent = totalValue > 0 ? (dashboardChange / Math.max(totalValue - dashboardChange, 1)) * 100 : 0;
  const showWorkspaceHeader = ['dashboard', 'trading', 'portfolio', 'history', 'watchlist', 'risk', 'research', 'backtest', 'scenario'].includes(activeTab);
  const selectedInWatchlist = watchlist.some((item) => item.symbol === selectedSymbol);

  const openBuyForSelected = () => stageTrade(selectedSymbol, 'buy');
  const openSellForSelected = () => {
    setTradeDraft({ symbol: selectedSymbol, side: 'sell' });
    setActiveTab('trading');
  };
  const toggleSelectedWatchlist = async () => {
    if (!userId) {
      return;
    }
    if (selectedInWatchlist) {
      await handleRemoveWatchlist(selectedSymbol);
      return;
    }
    await handleAddWatchlist(selectedSymbol);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h2 className="text-xl font-bold text-blue-400">Finply</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <Sidebar activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); setSidebarOpen(false); }} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 w-64">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      <main className="lg:ml-64 min-h-screen">
        {/* Mobile header */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-slate-900">Finply</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>

        {showWorkspaceHeader && (
          <header className="bg-white border-b border-slate-200 px-4 py-6 lg:px-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="text-sm uppercase tracking-wider text-slate-500 mb-1">Finply AI Financial Sandbox</div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Interactive Trading Workspace</h1>
                  <p className="text-sm text-slate-600 mt-1">Paper trading with AI-powered insights</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 portfolio-metrics">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Portfolio Value</div>
                    <div className="text-xl font-bold text-slate-900">${totalValue.toFixed(2)}</div>
                    <div className={`text-sm font-medium ${dashboardChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {dashboardChange >= 0 ? '+' : ''}${dashboardChange.toFixed(2)} ({dashboardChangePercent.toFixed(2)}%)
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Cash Balance</div>
                    <div className="text-xl font-bold text-slate-900">${cashBalance.toFixed(2)}</div>
                    <div className="text-sm text-slate-600">Available to trade</div>
                  </div>
                </div>
              </div>
            </div>
          </header>
        )}

        <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6 space-y-6">
          {showWorkspaceHeader && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div className="flex-1">
                  <StockSearch onSelectStock={setSelectedSymbol} selectedSymbol={selectedSymbol} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={openBuyForSelected}
                    disabled={isOfflinePrice}
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Buy {selectedSymbol}
                  </button>
                  <button
                    onClick={openSellForSelected}
                    disabled={isOfflinePrice}
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Sell {selectedSymbol}
                  </button>
                  <button
                    onClick={() => setActiveTab('analysis')}
                    className="inline-flex items-center px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Analysis
                  </button>
                  <button
                    onClick={() => setActiveTab('predictions')}
                    className="inline-flex items-center px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    AI View
                  </button>
                </div>
              </div>
            </div>
          )}

          {appError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="text-red-600 text-sm font-medium">{appError}</div>
              </div>
            </div>
          )}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Main chart and signals */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                  {loadingTradingData ? (
                    <LoadingCard title="Loading Chart Data..." className="h-96" />
                  ) : (
                    <StockChart symbol={selectedSymbol} onTradeIntent={stageTrade} />
                  )}
                </div>
                <div className="space-y-6">
                  <AISignals onUseSignal={stageTrade} />
                  <Watchlist
                    items={watchlist}
                    onAdd={handleAddWatchlist}
                    onRemove={handleRemoveWatchlist}
                    onQuickBuy={(symbol) => stageTrade(symbol, 'buy')}
                    onSelectSymbol={setSelectedSymbol}
                  />
                </div>
              </div>

              {/* Trading panel and insights */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TradingPanel
                  userId={userId ?? 0}
                  symbol={tradeDraft.symbol}
                  side={tradeDraft.side}
                  accountBalance={cashBalance}
                  marketDataSource={latestQuoteSource}
                  onSubmitOrder={submitOrder}
                />
                <div className="space-y-6">
                  {loadingSentimentSummary ? (
                    <LoadingCard title="Analyzing Sentiment..." />
                  ) : (
                    <SentimentSummaryCard summary={sentimentSummary} symbol={selectedSymbol} loading={loadingSentimentSummary} />
                  )}
                  {loadingNews ? (
                    <LoadingCard title="Fetching News..." />
                  ) : (
                    <NewsFeed news={newsItems} symbol={selectedSymbol} loading={loadingNews} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Trading Tab */}
          {activeTab === 'trading' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <StockChart symbol={selectedSymbol} onTradeIntent={stageTrade} />
                <OrderHistory trades={trades.slice(0, 8)} orders={orders.slice(0, 8)} loading={loadingTradingData} />
              </div>
              <div className="space-y-6">
                <TradingPanel
                  userId={userId ?? 0}
                  symbol={tradeDraft.symbol}
                  side={tradeDraft.side}
                  accountBalance={cashBalance}
                  marketDataSource={latestQuoteSource}
                  onSubmitOrder={submitOrder}
                />
                <SelectedAssetRail
                  symbol={selectedSymbol}
                  latestPrice={latestPrice}
                  latestQuoteSource={latestQuoteSource}
                  inWatchlist={selectedInWatchlist}
                  disableTrading={isOfflinePrice}
                  onBuy={openBuyForSelected}
                  onSell={openSellForSelected}
                  onOpenAnalysis={() => setActiveTab('analysis')}
                  onOpenPredictions={() => setActiveTab('predictions')}
                  onOpenResearch={() => setActiveTab('research')}
                  onToggleWatchlist={toggleSelectedWatchlist}
                />
              </div>
            </div>
          )}

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <PortfolioView
              userId={userId ?? 0}
              totalValue={totalValue}
              cashBalance={cashBalance}
              unrealizedPnL={unrealizedPnL}
              realizedPnL={realizedPnL}
              positions={portfolio.positions}
              onSellPosition={handleSellPosition}
            />
          )}

          {/* Watchlist Tab */}
          {activeTab === 'watchlist' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">My Watchlist</h2>
                <Watchlist
                  items={watchlist}
                  onAdd={handleAddWatchlist}
                  onRemove={handleRemoveWatchlist}
                  onQuickBuy={(symbol) => stageTrade(symbol, 'buy')}
                  onSelectSymbol={setSelectedSymbol}
                />
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <OrderHistory trades={trades} orders={orders} loading={loadingTradingData} />
          )}

          {/* Risk Tab */}
          {activeTab === 'risk' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RiskCalculator accountBalance={cashBalance} marketPrice={latestPrice} />
              <RiskSimulator userId={userId ?? 0} />
            </div>
          )}

          {/* Crypto Tab */}
          {activeTab === 'crypto' && (
            <CryptoDashboard />
          )}

          {/* Market Tab */}
          {activeTab === 'market' && (
            <MarketOverview />
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 analysis-tools">
              <div className="xl:col-span-2">
                <TechnicalAnalysis defaultSymbol={selectedSymbol} />
              </div>
              <SelectedAssetRail
                symbol={selectedSymbol}
                latestPrice={latestPrice}
                latestQuoteSource={latestQuoteSource}
                inWatchlist={selectedInWatchlist}
                disableTrading={isOfflinePrice}
                onBuy={openBuyForSelected}
                onSell={openSellForSelected}
                onOpenAnalysis={() => setActiveTab('analysis')}
                onOpenPredictions={() => setActiveTab('predictions')}
                onOpenResearch={() => setActiveTab('research')}
                onToggleWatchlist={toggleSelectedWatchlist}
              />
            </div>
          )}

          {/* Research Tab */}
          {activeTab === 'research' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <ResearchWorkbench defaultSymbol={selectedSymbol} />
              </div>
              <SelectedAssetRail
                symbol={selectedSymbol}
                latestPrice={latestPrice}
                latestQuoteSource={latestQuoteSource}
                inWatchlist={selectedInWatchlist}
                disableTrading={isOfflinePrice}
                onBuy={openBuyForSelected}
                onSell={openSellForSelected}
                onOpenAnalysis={() => setActiveTab('analysis')}
                onOpenPredictions={() => setActiveTab('predictions')}
                onOpenResearch={() => setActiveTab('research')}
                onToggleWatchlist={toggleSelectedWatchlist}
              />
            </div>
          )}

          {/* Predictions Tab */}
          {activeTab === 'predictions' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <PredictionsDashboard defaultSymbol={selectedSymbol} />
              </div>
              <SelectedAssetRail
                symbol={selectedSymbol}
                latestPrice={latestPrice}
                latestQuoteSource={latestQuoteSource}
                inWatchlist={selectedInWatchlist}
                disableTrading={isOfflinePrice}
                onBuy={openBuyForSelected}
                onSell={openSellForSelected}
                onOpenAnalysis={() => setActiveTab('analysis')}
                onOpenPredictions={() => setActiveTab('predictions')}
                onOpenResearch={() => setActiveTab('research')}
                onToggleWatchlist={toggleSelectedWatchlist}
              />
            </div>
          )}

          {/* Backtest Tab */}
          {activeTab === 'backtest' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <BacktestingDashboard defaultSymbol={selectedSymbol} />
              </div>
              <SelectedAssetRail
                symbol={selectedSymbol}
                latestPrice={latestPrice}
                latestQuoteSource={latestQuoteSource}
                inWatchlist={selectedInWatchlist}
                disableTrading={isOfflinePrice}
                onBuy={openBuyForSelected}
                onSell={openSellForSelected}
                onOpenAnalysis={() => setActiveTab('analysis')}
                onOpenPredictions={() => setActiveTab('predictions')}
                onOpenResearch={() => setActiveTab('research')}
                onToggleWatchlist={toggleSelectedWatchlist}
              />
            </div>
          )}

          {/* Scenario Tab */}
          {activeTab === 'scenario' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <ScenarioLab defaultSymbol={selectedSymbol} />
              </div>
              <SelectedAssetRail
                symbol={selectedSymbol}
                latestPrice={latestPrice}
                latestQuoteSource={latestQuoteSource}
                inWatchlist={selectedInWatchlist}
                disableTrading={isOfflinePrice}
                onBuy={openBuyForSelected}
                onSell={openSellForSelected}
                onOpenAnalysis={() => setActiveTab('analysis')}
                onOpenPredictions={() => setActiveTab('predictions')}
                onOpenResearch={() => setActiveTab('research')}
                onToggleWatchlist={toggleSelectedWatchlist}
              />
            </div>
          )}

          {/* Assistant Tab */}
          {activeTab === 'assistant' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <AssistantPanel selectedSymbol={selectedSymbol} userId={userId} />
              </div>
              <SelectedAssetRail
                symbol={selectedSymbol}
                latestPrice={latestPrice}
                latestQuoteSource={latestQuoteSource}
                inWatchlist={selectedInWatchlist}
                disableTrading={isOfflinePrice}
                onBuy={openBuyForSelected}
                onSell={openSellForSelected}
                onOpenAnalysis={() => setActiveTab('analysis')}
                onOpenPredictions={() => setActiveTab('predictions')}
                onOpenResearch={() => setActiveTab('research')}
                onToggleWatchlist={toggleSelectedWatchlist}
              />
            </div>
          )}

          {/* News Tab */}
          {activeTab === 'news' && (
            <NewsFeed news={newsItems} symbol={selectedSymbol} loading={loadingNews} />
          )}
        </div>
      </main>

      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[300px] rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              toast.tone === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Onboarding */}
      {showOnboarding && (
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}

export default App;
