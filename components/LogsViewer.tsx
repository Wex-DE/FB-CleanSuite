import React, { useState, useMemo } from 'react';
import { LogEntry } from '@/server/types';
import { Download, RefreshCw, Terminal, Trash2, Search, Filter } from 'lucide-react';

interface LogsViewerProps {
  logs: LogEntry[];
  onRefresh: () => void;
}

export const LogsViewer: React.FC<LogsViewerProps> = ({ logs, onRefresh }) => {
  const [clearing, setClearing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'error' | 'warn' | 'success' | 'info'>('all');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedLevel !== 'all' && log.level !== selectedLevel) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          log.message.toLowerCase().includes(q) ||
          log.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, selectedLevel, searchQuery]);

  const exportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `facebook_cleanup_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all activity logs?')) return;
    setClearing(true);
    try {
      await fetch('/api/cleanup/logs', { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      console.error('Failed to clear logs:', err);
    } finally {
      setClearing(false);
    }
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-rose-600 dark:text-rose-400 font-semibold';
      case 'warn':
        return 'text-amber-600 dark:text-amber-400';
      case 'success':
        return 'text-emerald-600 dark:text-emerald-400 font-semibold';
      default:
        return 'text-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm dark:shadow-xl overflow-hidden transition-all">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-blue-500/10 p-2 text-blue-500 border border-blue-500/20">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                System Audit &amp; Activity Logs
              </h3>
              <span className="rounded-md bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                {logs.length} Events
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Live token-sanitized execution log stream
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition w-36 sm:w-44 shadow-sm"
            />
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs shadow-sm">
            <Filter className="h-3 w-3 text-slate-400" />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Levels</option>
              <option value="error">Errors Only</option>
              <option value="success">Success Only</option>
              <option value="info">Info Only</option>
            </select>
          </div>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            onClick={handleClear}
            disabled={clearing || logs.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition active:scale-95 disabled:opacity-40 shadow-sm"
            title="Clear all stored logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
          <button
            onClick={exportLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-40 shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="h-80 overflow-y-auto p-4 font-mono text-xs bg-slate-50 dark:bg-slate-950/90 space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-400 italic py-12 text-center font-sans">
            No logs match the current search or filter.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2.5 leading-relaxed hover:bg-slate-200/50 dark:hover:bg-white/[0.03] p-1.5 rounded-lg transition"
            >
              <span className="text-slate-400 flex-shrink-0 text-[11px]">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="rounded bg-slate-200/80 dark:bg-slate-900 border border-slate-300/80 dark:border-white/10 px-1.5 py-0.5 text-[9px] uppercase font-bold text-slate-600 dark:text-slate-400 flex-shrink-0">
                {log.category}
              </span>
              <span className={`${getLevelColor(log.level)} break-all`}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
