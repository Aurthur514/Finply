import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`inline-block animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 ${sizeClasses[size]} ${className}`} />
  );
};

interface LoadingCardProps {
  title?: string;
  className?: string;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({ title, className = '' }) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center space-x-3 mb-4">
          <LoadingSpinner size="sm" />
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
      )}
      <div className="space-y-3">
        <div className="h-4 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-slate-200 rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
};

interface LoadingGridProps {
  columns?: number;
  rows?: number;
  className?: string;
}

export const LoadingGrid: React.FC<LoadingGridProps> = ({ columns = 2, rows = 3, className = '' }) => {
  return (
    <div className={`grid gap-6 ${className}`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns * rows }).map((_, index) => (
        <div key={index} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
            <div className="h-20 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 bg-slate-200 rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default LoadingSpinner;