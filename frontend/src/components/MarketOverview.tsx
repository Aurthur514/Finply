import React, { useState, useEffect } from 'react';
import { stockAPI, MarketOverview as MarketOverviewType } from '../api';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

const MarketOverview: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketOverviewType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketData();
    // Update every 60 seconds
    const interval = setInterval(loadMarketData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadMarketData = async () => {
    try {
      setLoading(true);
      const response = await stockAPI.getMarketOverview();
      setMarketData(response.data);
    } catch (error) {
      console.error('Failed to load market overview:', error);
    } finally {
      setLoading(false);
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

  const indexSP500 = marketData?.indices?.['S&P 500'];
  const indexNasdaq = marketData?.indices?.['NASDAQ'];
  const indexDow = marketData?.indices?.['DOW JONES'];
  const cryptoBtc = marketData?.cryptocurrencies?.['BTC'];
  const cryptoEth = marketData?.cryptocurrencies?.['ETH'];
  const cryptoBnb = marketData?.cryptocurrencies?.['BNB'];

  if (loading && !marketData) {
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
          <GlobeAltIcon className="h-8 w-8 mr-3 text-blue-500" />
          Market Overview
        </h1>
        <p className="text-gray-600">Real-time global market indices and cryptocurrency prices</p>
      </div>

      {/* Market Indices */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Major Indices</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {marketData?.indices && Object.entries(marketData.indices).map(([name, data]) => {
            const ChangeIcon = getChangeIcon(data.change_percent);
            const changeColor = getChangeColor(data.change_percent);

            return (
              <div key={name} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{name}</h3>
                  <ChangeIcon className={`h-5 w-5 ${changeColor}`} />
                </div>
                <div className="text-2xl font-bold mb-1">
                  {data.price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
                <div className={`text-sm font-medium ${changeColor}`}>
                  {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)} ({data.change_percent})
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cryptocurrency Overview */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Major Cryptocurrencies</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {marketData?.cryptocurrencies && Object.entries(marketData.cryptocurrencies).map(([symbol, data]) => {
            const ChangeIcon = getChangeIcon(data.change_percent);
            const changeColor = getChangeColor(data.change_percent);

            return (
              <div key={symbol} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{symbol}/USD</h3>
                  <ChangeIcon className={`h-5 w-5 ${changeColor}`} />
                </div>
                <div className="text-2xl font-bold mb-1">
                  ${data.price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
                <div className={`text-sm font-medium ${changeColor}`}>
                  {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)} ({data.change_percent})
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Market Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Market Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">US Stock Market</h3>
            <div className="space-y-2">
              {indexSP500 && indexNasdaq && indexDow && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">S&P 500:</span>
                    <span className={`font-medium ${getChangeColor(indexSP500.change_percent)}`}>
                      {indexSP500.change_percent}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">NASDAQ:</span>
                    <span className={`font-medium ${getChangeColor(indexNasdaq.change_percent)}`}>
                      {indexNasdaq.change_percent}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">DOW JONES:</span>
                    <span className={`font-medium ${getChangeColor(indexDow.change_percent)}`}>
                      {indexDow.change_percent}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Cryptocurrency Market</h3>
            <div className="space-y-2">
              {cryptoBtc && cryptoEth && cryptoBnb && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bitcoin:</span>
                    <span className={`font-medium ${getChangeColor(cryptoBtc.change_percent)}`}>
                      {cryptoBtc.change_percent}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ethereum:</span>
                    <span className={`font-medium ${getChangeColor(cryptoEth.change_percent)}`}>
                      {cryptoEth.change_percent}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Binance Coin:</span>
                    <span className={`font-medium ${getChangeColor(cryptoBnb.change_percent)}`}>
                      {cryptoBnb.change_percent}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {marketData?.timestamp && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Last updated: {new Date(marketData.timestamp).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Market Sentiment */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Market Sentiment</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Overall Market Mood</h3>
            {marketData?.indices && (() => {
              const positiveIndices = Object.values(marketData.indices).filter(
                index => parseFloat(index.change_percent) > 0
              ).length;
              const totalIndices = Object.keys(marketData.indices).length;
              const positiveRatio = positiveIndices / totalIndices;

              return (
                <div className="flex items-center">
                  <div className={`text-2xl font-bold ${
                    positiveRatio > 0.5 ? 'text-green-600' :
                    positiveRatio < 0.5 ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {positiveRatio > 0.5 ? 'Bullish' :
                     positiveRatio < 0.5 ? 'Bearish' : 'Neutral'}
                  </div>
                  <span className="ml-2 text-sm text-gray-600">
                    ({positiveIndices}/{totalIndices} positive)
                  </span>
                </div>
              );
            })()}
          </div>

          <div className="bg-white rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Crypto Market Mood</h3>
            {marketData?.cryptocurrencies && (() => {
              const positiveCryptos = Object.values(marketData.cryptocurrencies).filter(
                crypto => parseFloat(crypto.change_percent) > 0
              ).length;
              const totalCryptos = Object.keys(marketData.cryptocurrencies).length;
              const positiveRatio = positiveCryptos / totalCryptos;

              return (
                <div className="flex items-center">
                  <div className={`text-2xl font-bold ${
                    positiveRatio > 0.5 ? 'text-green-600' :
                    positiveRatio < 0.5 ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {positiveRatio > 0.5 ? 'Bullish' :
                     positiveRatio < 0.5 ? 'Bearish' : 'Neutral'}
                  </div>
                  <span className="ml-2 text-sm text-gray-600">
                    ({positiveCryptos}/{totalCryptos} positive)
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketOverview;
