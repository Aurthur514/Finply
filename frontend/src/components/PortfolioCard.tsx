import React from 'react';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';

interface PortfolioCardProps {
  value: number;
  change: number;
  changePercent: number;
}

const PortfolioCard: React.FC<PortfolioCardProps> = ({ value, change, changePercent }) => {
  const isPositive = change >= 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-gray-600 text-sm font-medium mb-2">Portfolio Value</h3>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900">${value.toLocaleString()}</p>
          <div className={`flex items-center mt-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? (
              <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
            ) : (
              <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
            )}
            <span className="text-sm font-medium">
              {isPositive ? '+' : ''}${Math.abs(change).toFixed(2)} ({changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioCard;