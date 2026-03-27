import React, { useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

import { stockAPI } from '../api';

interface SearchResult {
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  price?: number;
  change_percent?: string;
}

interface StockSearchProps {
  onSelectStock: (symbol: string) => void;
  selectedSymbol: string;
}

const popularSymbols = [
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock' as const },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock' as const },
  { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock' as const },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock' as const },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock' as const },
  { symbol: 'RELIANCE', name: 'Reliance Industries (NSE)', type: 'stock' as const },
  { symbol: 'TCS', name: 'Tata Consultancy Services (NSE)', type: 'stock' as const },
  { symbol: 'INFY', name: 'Infosys (NSE)', type: 'stock' as const },
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' as const },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto' as const },
  { symbol: 'BNB', name: 'Binance Coin', type: 'crypto' as const },
];

const StockSearch: React.FC<StockSearchProps> = ({ onSelectStock, selectedSymbol }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const searchSymbols = async () => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await stockAPI.searchSymbols(query, 10);
        setSearchResults(response.data);
      } catch (error) {
        const filtered = popularSymbols.filter(
          (item) =>
            item.symbol.toLowerCase().includes(query.toLowerCase()) ||
            item.name.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(filtered);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = window.setTimeout(searchSymbols, 300);
    return () => window.clearTimeout(debounceTimer);
  }, [query]);

  const handleSelect = (symbol: string) => {
    onSelectStock(symbol);
    setQuery('');
    setIsOpen(false);
  };

  const getTypeColor = (type: string) => (type === 'crypto' ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50');
  const getTypeIcon = (type: string) => (type === 'crypto' ? 'BTC' : 'EQ');

  return (
    <div className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search stocks, crypto, or companies..."
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
          {loading ? (
            <div className="px-4 py-3 text-center text-gray-500">
              <div className="mx-auto mb-2 h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
              Searching...
            </div>
          ) : query.length < 2 ? (
            <div>
              <div className="border-b bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500">POPULAR SYMBOLS</div>
              {popularSymbols.map((item) => (
                <div
                  key={item.symbol}
                  onClick={() => handleSelect(item.symbol)}
                  className="cursor-pointer border-b border-gray-100 px-4 py-3 hover:bg-gray-50 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-2 text-xs font-semibold text-gray-500">{getTypeIcon(item.type)}</span>
                      <div>
                        <div className="font-semibold text-gray-900">{item.symbol}</div>
                        <div className="text-sm text-gray-600">{item.name}</div>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${getTypeColor(item.type)}`}>{item.type}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map((result) => (
              <div
                key={result.symbol}
                onClick={() => handleSelect(result.symbol)}
                className="cursor-pointer border-b border-gray-100 px-4 py-3 hover:bg-gray-50 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="mr-2 text-xs font-semibold text-gray-500">{getTypeIcon(result.type)}</span>
                    <div>
                      <div className="font-semibold text-gray-900">{result.symbol}</div>
                      <div className="text-sm text-gray-600">{result.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${getTypeColor(result.type)}`}>{result.type}</span>
                    {result.price && (
                      <div className="mt-1 text-sm text-gray-900">
                        ${result.price.toFixed(2)}
                        {result.change_percent && (
                          <span className={`ml-1 ${parseFloat(result.change_percent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {result.change_percent}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-center text-gray-500">No results found for "{query}"</div>
          )}
        </div>
      )}

      {selectedSymbol && (
        <div className="mt-2 text-sm text-gray-600">
          Selected: <span className="font-semibold">{selectedSymbol}</span>
        </div>
      )}
    </div>
  );
};

export default StockSearch;
