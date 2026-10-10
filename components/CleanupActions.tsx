import React, { useState } from 'react';
import { Search, FlaskConical, Trash2, Zap, Calendar, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

interface CleanupActionsProps {
  discovering: boolean;
  onDiscover: () => void;
  onStartTest: (count: number) => void;
  onStartFull: () => void;
  disabled: boolean;
  totalPending: number;
  // Filter states
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  sortOrder: 'oldest_first' | 'newest_first';
  setSortOrder: (val: 'oldest_first' | 'newest_first') => void;
  earliestPostDate: string | null;
  latestPostDate: string | null;
  availableYears: string[];
  selectedYearFilter: string;
  onYearSelect: (year: string) => void;
  activeDatePreset: string;
  onApplyPreset: (preset: string) => void;
}

export const CleanupActions: React.FC<CleanupActionsProps> = ({
  discovering,
  onDiscover,
  onStartTest,
  onStartFull,
  disabled,
  totalPending,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  sortOrder,
  setSortOrder,
  earliestPostDate,
  latestPostDate,
  availableYears,
  selectedYearFilter,
  onYearSelect,
  activeDatePreset,
  onApplyPreset,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div>
      {/* 3-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Discover Posts (Dry Run) */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/5 bg-white/90 dark:bg-slate-900/60 p-5 backdrop-blur-xl shadow-sm dark:shadow-xl flex flex-col justify-between space-y-4 transition hover:border-blue-500/30">
          <div className="space-y-3">
            {/* Card Header matching Card 2 & 3 */}
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Search className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Step 1
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                1. Discover Posts (Dry Run)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Scan and list all eligible posts without deleting. Builds the local queue.
              </p>
            </div>

            {/* Seamless Built-in Date & Sort Controls */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200/80 dark:border-white/5 text-xs">
              {/* Presets and Year Selector */}
              <div className="flex items-center gap-1.5 justify-between">
                <select
                  value={selectedYearFilter}
                  onChange={(e) => onYearSelect(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Years</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  {[
                    { id: 'all', label: 'All' },
                    { id: '30d', label: '30D' },
                    { id: '90d', label: '90D' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onApplyPreset(p.id)}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                        activeDatePreset === p.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date From & To */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-slate-400 block mb-0.5">From Date</label>
                  <input
                    type="date"
                    value={startDate}
                    min={earliestPostDate || undefined}
                    max={latestPostDate || todayStr}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-400 block mb-0.5">To Date</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || earliestPostDate || undefined}
                    max={latestPostDate || todayStr}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Older to Recent Sort Toggle */}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] font-medium text-slate-400">Order:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSortOrder('oldest_first')}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                      sortOrder === 'oldest_first'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Older to Recent
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder('newest_first')}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                      sortOrder === 'newest_first'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Newest to Old
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onDiscover}
            disabled={discovering || disabled}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-md hover:bg-blue-500 transition active:scale-[0.99] disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{discovering ? 'Discovering Posts...' : 'Run Discovery (Dry Run)'}</span>
          </button>
        </div>

        {/* Card 2: Test Deletion */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/5 bg-white/90 dark:bg-slate-900/60 p-5 backdrop-blur-xl shadow-sm dark:shadow-xl flex flex-col justify-between space-y-4 transition hover:border-purple-500/30">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <FlaskConical className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Step 2 (Safe Trial)
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                2. Test Deletion
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Delete a small batch to verify everything works correctly before bulk actions.
              </p>
            </div>

            {/* Test Mode Feature Breakdown */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200/80 dark:border-white/5 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Auto-Stop Limit:</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">Strict Cap</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Eligible in Queue:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPending.toLocaleString()} posts</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Worker automatically stops once the chosen test count is reached. Perfect for verifying Meta API permissions.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Choose Test Batch Size:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[1, 5, 10].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onStartTest(count)}
                  disabled={disabled || totalPending === 0}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/80 py-2.5 px-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition active:scale-95 disabled:opacity-40 shadow-sm"
                >
                  Test {count} Post{count > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Full Cleanup */}
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 dark:bg-slate-900/60 p-5 backdrop-blur-xl shadow-sm dark:shadow-xl flex flex-col justify-between space-y-4 transition hover:border-rose-500/40">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Trash2 className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                Step 3 (Bulk Execution)
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                3. Full Cleanup
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Delete all remaining eligible posts in the queue. Requires explicit confirmation.
              </p>
            </div>

            {/* Bulk Execution Feature Breakdown */}
            <div className="space-y-2.5 pt-2 border-t border-rose-500/15 text-xs">
              <div className="rounded-xl bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/20 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-rose-700 dark:text-rose-300 font-medium">Pending Cleanup:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{totalPending.toLocaleString()} posts</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-rose-700 dark:text-rose-300 font-medium">Safety Rate Limiter:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Adaptive Backoff Active</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Processes all queued posts sequentially at your selected delay. Can be paused, resumed, or stopped anytime.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onStartFull}
            disabled={disabled || totalPending === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 px-4 text-xs font-semibold text-white shadow-md hover:bg-rose-500 transition active:scale-[0.99] disabled:opacity-50"
          >
            <span>Start Full Cleanup</span>
            <span className="font-bold">&gt;</span>
          </button>
        </div>

      </div>
    </div>
  );
};
