import React from 'react';
import { NewspaperIcon } from '@heroicons/react/24/outline';

interface NewsItem {
  title: string;
  impact: string;
  sentiment: string;
  timestamp: string;
}

interface NewsFeedProps {
  news: NewsItem[];
  symbol?: string;
  loading?: boolean;
}

const NewsFeed: React.FC<NewsFeedProps> = ({ news, symbol, loading = false }) => {
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive':
      case 'bullish':
        return 'text-green-600';
      case 'negative':
      case 'bearish':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <NewspaperIcon className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold">News Intelligence</h3>
        </div>
        {symbol && (
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Tracking {symbol}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {news.map((item, index) => (
          <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
            <h4 className="font-medium text-gray-900 text-sm mb-1">{item.title}</h4>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${getSentimentColor(item.sentiment)}`}>
                {item.impact}
              </span>
              <span className="text-xs text-gray-500">{item.timestamp}</span>
            </div>
          </div>
        ))}

        {news.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No recent news intelligence{symbol ? ` for ${symbol}` : ''}
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default NewsFeed;
