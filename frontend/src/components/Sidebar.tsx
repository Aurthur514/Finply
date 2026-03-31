import React from 'react';
import {
  ChartBarIcon,
  HomeIcon,
  CurrencyDollarIcon,
  NewspaperIcon,
  BriefcaseIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  DocumentMagnifyingGlassIcon,
  BeakerIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category?: string;
}

interface MenuCategory {
  id: string;
  label: string;
  items: MenuItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set(['trading', 'analysis']));

  const menuCategories: MenuCategory[] = [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
        { id: 'market', label: 'Market Overview', icon: GlobeAltIcon },
        { id: 'crypto', label: 'Cryptocurrency', icon: CpuChipIcon },
      ]
    },
    {
      id: 'trading',
      label: 'Trading',
      items: [
        { id: 'trading', label: 'Paper Trading', icon: CurrencyDollarIcon },
        { id: 'portfolio', label: 'Portfolio', icon: BriefcaseIcon },
        { id: 'history', label: 'Order History', icon: ClockIcon },
        { id: 'watchlist', label: 'Watchlist', icon: MagnifyingGlassIcon },
      ]
    },
    {
      id: 'analysis',
      label: 'Analysis & Research',
      items: [
        { id: 'analysis', label: 'Technical Analysis', icon: ChartBarIcon },
        { id: 'predictions', label: 'AI Predictions', icon: MagnifyingGlassIcon },
        { id: 'research', label: 'Research Memo', icon: DocumentMagnifyingGlassIcon },
        { id: 'backtest', label: 'Backtesting Lab', icon: BeakerIcon },
        { id: 'scenario', label: 'Scenario Lab', icon: SparklesIcon },
      ]
    },
    {
      id: 'tools',
      label: 'Tools & Intelligence',
      items: [
        { id: 'assistant', label: 'AI Copilot', icon: ChatBubbleLeftRightIcon },
        { id: 'news', label: 'News Intelligence', icon: NewspaperIcon },
        { id: 'risk', label: 'Risk Simulator', icon: ShieldCheckIcon },
      ]
    }
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-900 p-5 text-white">
      <div className="mb-8 hidden lg:block">
        <h2 className="text-xl font-bold text-blue-400">Finply</h2>
        <p className="text-xs text-slate-400 mt-1">AI Financial Sandbox</p>
      </div>

      <nav className="space-y-1 sidebar-nav">
        {menuCategories.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          const hasActiveItem = category.items.some(item => activeTab === item.id);

          return (
            <div key={category.id} className="mb-4">
              <button
                onClick={() => toggleCategory(category.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-slate-800 ${
                  hasActiveItem ? 'bg-slate-800 text-blue-400' : 'text-slate-300'
                }`}
              >
                <span>{category.label}</span>
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>

              {isExpanded && (
                <ul className="mt-1 space-y-1 pl-4">
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => setActiveTab(item.id)}
                          className={`flex w-full items-center space-x-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="absolute bottom-5 left-5 right-5 hidden lg:block">
        <div className="rounded-lg bg-slate-800 p-3 text-xs text-slate-400">
          <div className="font-medium text-slate-300 mb-1">Quick Actions</div>
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('trading')}
              className="block w-full text-left hover:text-blue-400 transition-colors"
            >
              Start Trading
            </button>
            <button
              onClick={() => setActiveTab('assistant')}
              className="block w-full text-left hover:text-blue-400 transition-colors"
            >
              Ask AI Assistant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
