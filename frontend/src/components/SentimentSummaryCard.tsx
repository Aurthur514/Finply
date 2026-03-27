import React from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

import { NewsSummary } from '../api';

interface SentimentSummaryCardProps {
  summary: NewsSummary | null;
  symbol: string;
  loading?: boolean;
}

const SentimentSummaryCard: React.FC<SentimentSummaryCardProps> = ({ summary, symbol, loading = false }) => {
  const toneClass =
    summary?.overall_sentiment === 'bullish'
      ? 'bg-emerald-100 text-emerald-800'
      : summary?.overall_sentiment === 'bearish'
        ? 'bg-rose-100 text-rose-800'
        : 'bg-slate-100 text-slate-700';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChatBubbleLeftRightIcon className="h-5 w-5 text-sky-600" />
          <h3 className="text-lg font-semibold text-slate-900">Sentiment Summary</h3>
        </div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{symbol}</div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-600"></div>
        </div>
      ) : summary ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${toneClass}`}>
              {summary.overall_sentiment.toUpperCase()}
            </span>
            <span className="text-sm text-slate-500">
              Confidence {Math.round(summary.confidence * 100)}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-50 px-3 py-3">
              <div className="text-lg font-semibold text-emerald-700">{summary.bullish_count}</div>
              <div className="text-xs uppercase tracking-wide text-emerald-900">Bullish</div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <div className="text-lg font-semibold text-slate-700">{summary.neutral_count}</div>
              <div className="text-xs uppercase tracking-wide text-slate-900">Neutral</div>
            </div>
            <div className="rounded-xl bg-rose-50 px-3 py-3">
              <div className="text-lg font-semibold text-rose-700">{summary.bearish_count}</div>
              <div className="text-xs uppercase tracking-wide text-rose-900">Bearish</div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Based on {summary.article_count} recent article{summary.article_count === 1 ? '' : 's'}.
          </div>

          {summary.bullish_headline?.title && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Top Bullish Headline</div>
              <div className="mt-1 text-sm font-medium text-emerald-950">{summary.bullish_headline.title}</div>
            </div>
          )}

          {summary.bearish_headline?.title && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Top Bearish Headline</div>
              <div className="mt-1 text-sm font-medium text-rose-950">{summary.bearish_headline.title}</div>
            </div>
          )}

          {summary.themes.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Themes</div>
              <div className="flex flex-wrap gap-2">
                {summary.themes.slice(0, 4).map((theme) => (
                  <span
                    key={theme.theme}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      theme.direction === 'tailwind' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {theme.theme.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-slate-500">No sentiment summary available for {symbol}.</div>
      )}
    </div>
  );
};

export default SentimentSummaryCard;
