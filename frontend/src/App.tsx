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
      const stored = localStorage.getItem('sentinel_user_id');
      if (stored) {
        setUserId(Number(stored));
        return;
      }

      const response = await tradingAPI.createUser('Sentinel User', 'user@sentinel.local', 100000);
      localStorage.setItem('sentinel_user_id', String(response.data.user_id));
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
  const showWorkspaceHeader = ['dashboard', 'trading', 'portfolio', 'history', 'risk', 'research'].includes(activeTab);
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
    <div className="h-screen overflow-hidden bg-slate-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="ml-64 h-screen overflow-y-auto p-6">
        {showWorkspaceHeader && (
          <>
            <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Sentinel AI Financial Sandbox</div>
                <h1 className="text-3xl font-semibold text-slate-950">Interactive paper trading workspace</h1>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-slate-500">Portfolio snapshot</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">${totalValue.toFixed(2)}</div>
                <div className={`text-sm ${dashboardChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {dashboardChange >= 0 ? '+' : ''}${dashboardChange.toFixed(2)} ({dashboardChangePercent.toFixed(2)}%)
                </div>
              </div>
            </header>

            <div className="mb-6">
              <StockSearch onSelectStock={setSelectedSymbol} selectedSymbol={selectedSymbol} />
            </div>
          </>
        )}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Active Asset</div>
              <div className="mt-1 flex items-center gap-3">
                <div className="text-2xl font-semibold text-slate-950">{selectedSymbol}</div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                  {hasLatestPrice ? `$${latestPrice.toFixed(2)}` : 'Price unavailable'}
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isOfflinePrice ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {hasLatestPrice ? latestQuoteSource : 'Waiting for quote'}
                </div>
              </div>
              {isOfflinePrice && (
                <div className="mt-2 text-sm text-amber-700">
                  Price is from fallback market data and may not match the live exchange.
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-full px-3 py-1 font-semibold ${
                    !providerHealth
                      ? 'bg-slate-100 text-slate-700'
                      : providerHealth.status === 'healthy'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Stock Data {providerHealthLabel}
                </span>
                {liveProviders.length > 0 && (
                  <span className="text-slate-500">Live providers: {liveProviders.join(', ')}</span>
                )}
                {providerHealth?.status === 'degraded' && (
                  <span className="text-amber-700">Fallbacks may appear for some stock symbols.</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={openBuyForSelected}
                disabled={isOfflinePrice}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Buy {selectedSymbol}
              </button>
              <button
                onClick={openSellForSelected}
                disabled={isOfflinePrice}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Sell {selectedSymbol}
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Analysis
              </button>
              <button
                onClick={() => setActiveTab('predictions')}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                AI View
              </button>
              <button
                onClick={() => setActiveTab('research')}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Research Memo
              </button>
            </div>
          </div>
        </div>

        {appError && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{appError}</div>}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr]">
              <StockChart symbol={selectedSymbol} onTradeIntent={stageTrade} />
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
            <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
              <TradingPanel
                userId={userId ?? 0}
                symbol={tradeDraft.symbol}
                side={tradeDraft.side}
                accountBalance={cashBalance}
                marketDataSource={latestQuoteSource}
                onSubmitOrder={submitOrder}
              />
              <div className="space-y-6">
                <SentimentSummaryCard summary={sentimentSummary} symbol={selectedSymbol} loading={loadingSentimentSummary} />
                <SentimentTimelineCard summary={sentimentSummary} loading={loadingSentimentSummary} />
                <NewsFeed news={newsItems} symbol={selectedSymbol} loading={loadingNews} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trading' && (
          <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr,0.7fr]">
            <div className="space-y-6">
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
              <Watchlist
                items={watchlist}
                onAdd={handleAddWatchlist}
                onRemove={handleRemoveWatchlist}
                onQuickBuy={(symbol) => stageTrade(symbol, 'buy')}
                onSelectSymbol={setSelectedSymbol}
              />
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

        {activeTab === 'history' && <OrderHistory trades={trades} orders={orders} loading={loadingTradingData} />}

        {activeTab === 'risk' && (
          <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <RiskCalculator accountBalance={cashBalance} marketPrice={latestPrice} />
            <RiskSimulator userId={userId ?? 0} />
          </div>
        )}

        {activeTab === 'crypto' && <CryptoDashboard />}

        {activeTab === 'market' && <MarketOverview />}

        {activeTab === 'analysis' && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr,0.7fr]">
            <TechnicalAnalysis defaultSymbol={selectedSymbol} />
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

        {activeTab === 'research' && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr,0.7fr]">
            <ResearchWorkbench defaultSymbol={selectedSymbol} />
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

        {activeTab === 'predictions' && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr,0.7fr]">
            <PredictionsDashboard defaultSymbol={selectedSymbol} />
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

        {activeTab === 'assistant' && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr,0.7fr]">
            <AssistantPanel selectedSymbol={selectedSymbol} userId={userId} />
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

        {activeTab === 'news' && <NewsFeed news={newsItems} symbol={selectedSymbol} loading={loadingNews} />}
      </main>

      <div className="fixed right-4 top-4 z-[60] space-y-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[260px] rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
              toast.tone === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
