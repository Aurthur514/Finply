import React, { useCallback, useEffect, useState } from 'react';
import { stockAPI, CryptoQuote } from '../api';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, CpuChipIcon } from '@heroicons/react/24/outline';

const POPULAR_CRYPTOS = ['BTC', 'ETH', 'BNB', 'SOL', 'DOGE', 'LINK'];

const CryptoDashboard: React.FC = () => {
  const [cryptoData, setCryptoData] = useState<Record<string, CryptoQuote>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCrypto, setSelectedCrypto] = useState('BTC');

  const loadCryptoData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await stockAPI.getLivePrices(POPULAR_CRYPTOS);
      const prices = response.data.prices;

      // Filter only crypto data
      const cryptoPrices: Record<string, CryptoQuote> = {};
      Object.keys(prices).forEach(symbol => {
        if (POPULAR_CRYPTOS.includes(symbol)) {
          cryptoPrices[symbol] = prices[symbol];
        }
      });

      setCryptoData(cryptoPrices);
    } catch (error) {
      console.error('Failed to load crypto data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCryptoData();
    // Set up live updates every 30 seconds
    const interval = setInterval(loadCryptoData, 30000);
    return () => clearInterval(interval);
  }, [loadCryptoData]);

  const formatPrice = (price: number) => {
    if (price >= 1) {
      return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      return `$${price.toFixed(6)}`;
    }
  };

  const getChangeColor = (changePercent: string) => {
    const change = parseFloat(changePercent);
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getChangeIcon = (changePercent: string) => {
    const change = parseFloat(changePercent);
    return change >= 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
  };

  if (loading && Object.keys(cryptoData).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
          <CpuChipIcon className="h-8 w-8 mr-3 text-orange-500" />
          Cryptocurrency Market
        </h1>
        <p className="text-gray-600">Real-time cryptocurrency prices and market data</p>
      </div>

      {/* Top Cryptos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {POPULAR_CRYPTOS.map(symbol => {
          const data = cryptoData[symbol];
          if (!data) return null;

          const ChangeIcon = getChangeIcon(data.change_percent);
          const changeColor = getChangeColor(data.change_percent);

          return (
            <div
              key={symbol}
              className={`bg-white rounded-lg shadow-md p-4 cursor-pointer transition-all hover:shadow-lg ${
                selectedCrypto === symbol ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedCrypto(symbol)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">{symbol}</h3>
                <ChangeIcon className={`h-5 w-5 ${changeColor}`} />
              </div>
              <div className="text-2xl font-bold mb-1">
                {formatPrice(data.price)}
              </div>
              <div className={`text-sm font-medium ${changeColor}`}>
                {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)} ({data.change_percent})
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Vol: {(data.volume / 1000000).toFixed(1)}M
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Crypto Details */}
      {selectedCrypto && cryptoData[selectedCrypto] && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">{selectedCrypto} Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Current Price</h3>
              <p className="text-2xl font-bold">{formatPrice(cryptoData[selectedCrypto].price)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">24h Change</h3>
              <p className={`text-xl font-bold ${getChangeColor(cryptoData[selectedCrypto].change_percent)}`}>
                {cryptoData[selectedCrypto].change >= 0 ? '+' : ''}
                {cryptoData[selectedCrypto].change.toFixed(2)} ({cryptoData[selectedCrypto].change_percent})
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Volume (24h)</h3>
              <p className="text-xl font-bold">
                {(cryptoData[selectedCrypto].volume / 1000000).toFixed(1)}M
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Market Data Source</h3>
            <p className="text-sm text-gray-600">{cryptoData[selectedCrypto].source}</p>
            <p className="text-xs text-gray-400 mt-1">
              Last updated: {new Date(cryptoData[selectedCrypto].timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Market Insights */}
      <div className="mt-8 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Market Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4">
            <h3 className="font-semibold text-green-600 mb-2">Top Gainers (24h)</h3>
            <div className="space-y-2">
              {Object.entries(cryptoData)
                .filter(([, data]) => parseFloat(data.change_percent) > 0)
                .sort(([, a], [, b]) => parseFloat(b.change_percent) - parseFloat(a.change_percent))
                .slice(0, 3)
                .map(([symbol, data]) => (
                  <div key={symbol} className="flex justify-between items-center">
                    <span className="font-medium">{symbol}</span>
                    <span className="text-green-600 font-semibold">{data.change_percent}</span>
                  </div>
                ))}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <h3 className="font-semibold text-red-600 mb-2">Top Losers (24h)</h3>
            <div className="space-y-2">
              {Object.entries(cryptoData)
                .filter(([, data]) => parseFloat(data.change_percent) < 0)
                .sort(([, a], [, b]) => parseFloat(a.change_percent) - parseFloat(b.change_percent))
                .slice(0, 3)
                .map(([symbol, data]) => (
                  <div key={symbol} className="flex justify-between items-center">
                    <span className="font-medium">{symbol}</span>
                    <span className="text-red-600 font-semibold">{data.change_percent}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoDashboard;
