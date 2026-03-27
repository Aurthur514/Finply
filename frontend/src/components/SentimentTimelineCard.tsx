import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SparklesIcon } from '@heroicons/react/24/outline';

import { NewsSummary } from '../api';

interface SentimentTimelineCardProps {
  summary: NewsSummary | null;
  loading?: boolean;
}

const sentimentToScore = (sentiment: string) => {
  switch (sentiment) {
    case 'bullish':
    case 'positive':
      return 1;
    case 'bearish':
    case 'negative':
      return -1;
    default:
      return 0;
  }
};

const SentimentTimelineCard: React.FC<SentimentTimelineCardProps> = ({ summary, loading = false }) => {
  const chartData =
    summary?.timeline?.map((item, index) => ({
      index: index + 1,
      score: sentimentToScore(item.sentiment),
      confidence: Math.round(item.confidence * 100),
      headline: item.title || `Article ${index + 1}`,
      label: item.publishedAt ? new Date(item.publishedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : `#${index + 1}`,
    })) || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <SparklesIcon className="h-5 w-5 text-violet-600" />
        <h3 className="text-lg font-semibold text-slate-900">Sentiment Timeline</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-violet-600"></div>
        </div>
      ) : chartData.length > 0 ? (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sentimentArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis
                  domain={[-1, 1]}
                  ticks={[-1, 0, 1]}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => (value === 1 ? 'Bull' : value === -1 ? 'Bear' : 'Neutral')}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'score'
                      ? value === 1
                        ? 'Bullish'
                        : value === -1
                          ? 'Bearish'
                          : 'Neutral'
                      : `${value}%`,
                    name === 'score' ? 'Sentiment' : 'Confidence',
                  ]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.headline || 'Headline'}
                />
                <Area type="monotone" dataKey="score" stroke="#8b5cf6" fill="url(#sentimentArea)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            The timeline shows recent headline tone from bearish to bullish. Use it as narrative context, not as a trading signal by itself.
          </div>
        </>
      ) : (
        <div className="py-8 text-center text-sm text-slate-500">Not enough recent headlines to build a sentiment timeline.</div>
      )}
    </div>
  );
};

export default SentimentTimelineCard;
