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
  DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { BeakerIcon } from '@heroicons/react/24/outline';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
    { id: 'trading', label: 'Paper Trading', icon: CurrencyDollarIcon },
    { id: 'crypto', label: 'Cryptocurrency', icon: CpuChipIcon },
    { id: 'market', label: 'Market Overview', icon: GlobeAltIcon },
    { id: 'analysis', label: 'Technical Analysis', icon: ChartBarIcon },
    { id: 'predictions', label: 'AI Predictions', icon: MagnifyingGlassIcon },
    { id: 'backtest', label: 'Backtesting Lab', icon: BeakerIcon },
    { id: 'research', label: 'Research Memo', icon: DocumentMagnifyingGlassIcon },
    { id: 'assistant', label: 'AI Copilot', icon: ChatBubbleLeftRightIcon },
    { id: 'news', label: 'News Intelligence', icon: NewspaperIcon },
    { id: 'portfolio', label: 'Portfolio', icon: BriefcaseIcon },
    { id: 'history', label: 'Order History', icon: ClockIcon },
    { id: 'risk', label: 'Risk Simulator', icon: ShieldCheckIcon },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-64 overflow-y-auto bg-gray-900 p-5 text-white">
      <h2 className="text-xl font-bold mb-8 text-blue-400">Sentinel</h2>

      <ul className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.id}
              className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-800 text-gray-300'
              }`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Sidebar;
