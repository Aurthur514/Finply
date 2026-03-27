import React, { useState, useEffect } from 'react';
import { stockAPI, TechnicalAnalysis as TechnicalAnalysisType } from '../api';
import { ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface TechnicalAnalysisProps {
  defaultSymbol?: string;
}

const TechnicalAnalysis: React.FC<TechnicalAnalysisProps> = ({ defaultSymbol = 'AAPL' }) => {
  const [analysis, setAnalysis] = useState<TechnicalAnalysisType | null>(null);
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState(defaultSymbol.toUpperCase());
  const [inputSymbol, setInputSymbol] = useState(defaultSymbol.toUpperCase());

  useEffect(() => {
    loadAnalysis(symbol);
  }, [symbol]);

  useEffect(() => {
    const nextSymbol = defaultSymbol.toUpperCase();
    setSymbol(nextSymbol);
    setInputSymbol(nextSymbol);
  }, [defaultSymbol]);

  const loadAnalysis = async (sym: string) => {
    try {
      setLoading(true);
      const response = await stockAPI.getTechnicalAnalysis(sym);
      setAnalysis(response.data);
    } catch (error) {
      console.error('Failed to load technical analysis:', error);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextSymbol = inputSymbol.toUpperCase();
    if (nextSymbol === symbol) {
      loadAnalysis(nextSymbol);
      return;
    }
    setSymbol(nextSymbol);
  };

  const getSignalColor = (type: string) => {
    return type === 'bullish' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
  };

  const getSignalIcon = (type: string) => {
    return type === 'bullish' ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getRecommendationColor = (action: string) => {
    if (action.includes('BUY') || action.includes('STRONG BUY')) return 'text-green-600 bg-green-100';
    if (action.includes('SELL') || action.includes('STRONG SELL')) return 'text-red-600 bg-red-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const displayCurrency = analysis?.display_currency || 'USD';
  const pricePrefix = displayCurrency === 'USD' ? '$' : `${displayCurrency} `;
  const displayedCurrentPrice = analysis?.display_price ?? analysis?.current_price ?? 0;
  const displayedSma20 = analysis?.display_indicators?.sma_20 ?? analysis?.indicators.sma_20 ?? 0;
  const displayedSma50 = analysis?.display_indicators?.sma_50 ?? analysis?.indicators.sma_50 ?? 0;
  const displayedBbUpper = analysis?.display_indicators?.bb_upper ?? analysis?.indicators.bb_upper ?? 0;
  const displayedBbLower = analysis?.display_indicators?.bb_lower ?? analysis?.indicators.bb_lower ?? 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
          <ChartBarIcon className="h-8 w-8 mr-3 text-purple-500" />
          Technical Analysis
        </h1>
        <p className="text-gray-600">Advanced technical indicators and trading signals</p>
      </div>

      {/* Symbol Input */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <form onSubmit={handleSymbolSubmit} className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 mb-2">
              Stock Symbol
            </label>
            <input
              type="text"
              id="symbol"
              value={inputSymbol}
              onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter stock symbol (e.g., AAPL, GOOGL, TSLA)"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
            >
              <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
              Analyze
            </button>
          </div>
        </form>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {analysis && !loading && (
        <>
          {/* Current Price & Recommendation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Price</h2>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {pricePrefix}{displayedCurrentPrice.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">
                Symbol: {analysis.symbol}
              </div>
              {analysis.display_currency && analysis.display_currency !== 'USD' && (
                <div className="mt-1 text-xs text-gray-500">
                  USD equivalent: ${analysis.current_price.toFixed(2)}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Recommendation</h2>
              <div className={`inline-block px-4 py-2 rounded-lg font-bold text-lg ${getRecommendationColor(analysis.recommendation.action)}`}>
                {analysis.recommendation.action}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                Confidence: <span className="font-medium">{analysis.recommendation.confidence}</span>
              </div>
            </div>
          </div>

          {/* Technical Indicators */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Technical Indicators</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">RSI (14)</div>
                <div className={`text-xl font-bold ${
                  analysis.indicators.rsi > 70 ? 'text-red-600' :
                  analysis.indicators.rsi < 30 ? 'text-green-600' : 'text-gray-900'
                }`}>
                  {analysis.indicators.rsi.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {analysis.indicators.rsi > 70 ? 'Overbought' :
                   analysis.indicators.rsi < 30 ? 'Oversold' : 'Neutral'}
                </div>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">SMA 20</div>
                <div className="text-xl font-bold text-gray-900">
                  {pricePrefix}{displayedSma20.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {displayedCurrentPrice > displayedSma20 ? 'Above' : 'Below'}
                </div>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">SMA 50</div>
                <div className="text-xl font-bold text-gray-900">
                  {pricePrefix}{displayedSma50.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {displayedCurrentPrice > displayedSma50 ? 'Above' : 'Below'}
                </div>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">MACD</div>
                <div className={`text-xl font-bold ${
                  analysis.indicators.macd > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {analysis.indicators.macd.toFixed(4)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Signal: {analysis.indicators.macd_signal.toFixed(4)}
                </div>
              </div>
            </div>
          </div>

          {/* Trading Signals */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Trading Signals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Bullish Signals ({analysis.recommendation.bullish_signals})</h3>
                <div className="space-y-2">
                  {analysis.signals
                    .filter(signal => signal.type === 'bullish')
                    .map((signal, index) => {
                      const SignalIcon = getSignalIcon(signal.type);
                      return (
                        <div key={index} className={`flex items-center p-3 rounded-lg ${getSignalColor(signal.type)}`}>
                          <SignalIcon className="h-4 w-4 mr-2" />
                          <span className="flex-1">{signal.signal}</span>
                          <span className={`text-xs font-medium ${getStrengthColor(signal.strength)}`}>
                            {signal.strength}
                          </span>
                        </div>
                      );
                    })}
                  {analysis.signals.filter(signal => signal.type === 'bullish').length === 0 && (
                    <p className="text-gray-500 text-sm">No bullish signals detected</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Bearish Signals ({analysis.recommendation.bearish_signals})</h3>
                <div className="space-y-2">
                  {analysis.signals
                    .filter(signal => signal.type === 'bearish')
                    .map((signal, index) => {
                      const SignalIcon = getSignalIcon(signal.type);
                      return (
                        <div key={index} className={`flex items-center p-3 rounded-lg ${getSignalColor(signal.type)}`}>
                          <SignalIcon className="h-4 w-4 mr-2" />
                          <span className="flex-1">{signal.signal}</span>
                          <span className={`text-xs font-medium ${getStrengthColor(signal.strength)}`}>
                            {signal.strength}
                          </span>
                        </div>
                      );
                    })}
                  {analysis.signals.filter(signal => signal.type === 'bearish').length === 0 && (
                    <p className="text-gray-500 text-sm">No bearish signals detected</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bollinger Bands */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bollinger Bands</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Upper Band</div>
                <div className="text-xl font-bold text-red-600">
                  {pricePrefix}{displayedBbUpper.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {displayedCurrentPrice > displayedBbUpper ? 'Above' : 'Below'}
                </div>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Middle Band (SMA 20)</div>
                <div className="text-xl font-bold text-gray-900">
                  {pricePrefix}{displayedSma20.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Reference</div>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Lower Band</div>
                <div className="text-xl font-bold text-green-600">
                  {pricePrefix}{displayedBbLower.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {displayedCurrentPrice < displayedBbLower ? 'Below' : 'Above'}
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Band Analysis</h3>
              <p className="text-sm text-blue-800">
                {displayedCurrentPrice > displayedBbUpper
                  ? 'Price is above the upper Bollinger Band, indicating potential overbought conditions.'
                  : displayedCurrentPrice < displayedBbLower
                  ? 'Price is below the lower Bollinger Band, indicating potential oversold conditions.'
                  : 'Price is within the Bollinger Bands, indicating normal trading conditions.'}
              </p>
            </div>
          </div>

          {/* Timestamp */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            Analysis generated on {new Date(analysis.timestamp).toLocaleString()}
          </div>
        </>
      )}

      {!analysis && !loading && (
        <div className="text-center py-12">
          <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Analysis Available</h3>
          <p className="text-gray-600">Enter a valid stock symbol to view technical analysis</p>
        </div>
      )}
    </div>
  );
};

export default TechnicalAnalysis;
