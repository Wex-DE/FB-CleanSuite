import React, { useState, useMemo } from 'react';
import { QueueItem } from '@/server/types';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  SkipForward,
  RefreshCw,
  Calendar,
  ArrowUpDown,
  Layers,
  Search,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Download,
  CheckSquare,
  Square,
  Filter,
  X,
} from 'lucide-react';

interface QueueTableProps {
  items: QueueItem[];
  pageName?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  totalStats?: {
    total: number;
    pending: number;
    deleted: number;
    failed: number;
    skipped: number;
    unknown: number;
  };
  isDemoMode?: boolean;
  onDeleteItem?: (postId: string) => void;
  onBatchDelete?: (postIds: string[]) => void;
}

export const QueueTable: React.FC<QueueTableProps> = ({
  items = [],
  pageName,
  onRefresh,
  isRefreshing = false,
  totalStats,
  isDemoMode = false,
  onDeleteItem,
  onBatchDelete,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'deleted' | 'failed' | 'all'>('pending');
  const [sortOrder, setSortOrder] = useState<'oldest_first' | 'newest_first'>('oldest_first');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [postTypeFilter, setPostTypeFilter] = useState<'all' | 'text' | 'media' | 'links'>('all');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState<boolean>(false);

  // Exact counts for badges (sourced from authoritative totalStats if available)
  const counts = useMemo(() => {
    if (totalStats) {
      return {
        pending: totalStats.pending,
        deleted: totalStats.deleted,
        failed: totalStats.failed + totalStats.skipped + totalStats.unknown,
        all: totalStats.total || items.length,
      };
    }
    return {
      pending: items.filter((i) => i.status === 'pending' || i.status === 'processing').length,
      deleted: items.filter((i) => i.status === 'deleted').length,
      failed: items.filter((i) => i.status === 'failed' || i.status === 'skipped' || i.status === 'unknown').length,
      all: items.length,
    };
  }, [items, totalStats]);

  // Filter items based on activeTab, postTypeFilter and searchQuery
  const filteredItems = useMemo(() => {
    let result = items;
    if (activeTab === 'pending') {
      result = items.filter((i) => i.status === 'pending' || i.status === 'processing');
    } else if (activeTab === 'deleted') {
      result = items.filter((i) => i.status === 'deleted');
    } else if (activeTab === 'failed') {
      result = items.filter((i) => i.status === 'failed' || i.status === 'skipped' || i.status === 'unknown');
    }

    if (postTypeFilter === 'text') {
      result = result.filter((i) => i.messageSnippet && i.messageSnippet.trim().length > 0);
    } else if (postTypeFilter === 'media') {
      result = result.filter((i) => !i.messageSnippet || i.messageSnippet.trim().length === 0);
    } else if (postTypeFilter === 'links') {
      result = result.filter(
        (i) =>
          i.messageSnippet &&
          (i.messageSnippet.includes('http://') ||
            i.messageSnippet.includes('https://') ||
            i.messageSnippet.includes('www.') ||
            i.messageSnippet.includes('.com') ||
            i.messageSnippet.includes('.org') ||
            i.messageSnippet.includes('.net'))
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.postId.toLowerCase().includes(q) ||
          (i.messageSnippet && i.messageSnippet.toLowerCase().includes(q)) ||
          (i.lastErrorMessage && i.lastErrorMessage.toLowerCase().includes(q))
      );
    }

    // Sort items
    return [...result].sort((a, b) => {
      const timeA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
      const timeB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
      return sortOrder === 'oldest_first' ? timeA - timeB : timeB - timeA;
    });
  }, [items, activeTab, postTypeFilter, sortOrder, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Single post delete handler
  const handleDeleteSingle = async (postId: string) => {
    setDeletingPostId(postId);
    if (isDemoMode) {
      setTimeout(() => {
        if (onDeleteItem) {
          onDeleteItem(postId);
        }
        setSelectedIds((prev) => prev.filter((id) => id !== postId));
        setDeletingPostId(null);
      }, 300);
      return;
    }
    try {
      const res = await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_single', postId }),
      });
      if (res.ok) {
        setSelectedIds((prev) => prev.filter((id) => id !== postId));
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch {
      // silently fail — queue will show unchanged status
    } finally {
      setDeletingPostId(null);
    }
  };

  // Batch post delete handler
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} selected post(s) from Facebook?`)) {
      return;
    }

    setIsBatchDeleting(true);
    if (isDemoMode) {
      setTimeout(() => {
        if (onBatchDelete) {
          onBatchDelete(selectedIds);
        }
        setSelectedIds([]);
        setIsBatchDeleting(false);
      }, 400);
      return;
    }
    try {
      const res = await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_batch', postIds: selectedIds }),
      });
      if (res.ok) {
        setSelectedIds([]);
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // CSV export handler — exports ALL filtered items or custom subset (e.g. selected)
  const exportCSV = (customItems?: QueueItem[]) => {
    const targetItems = customItems || filteredItems;
    const dateStr = new Date().toISOString().slice(0, 10);
    const prefix = customItems ? 'fb_posts_selected' : 'fb_posts_backup';
    const filename = `${prefix}_${(pageName || 'page').replace(/\s+/g, '_')}_${dateStr}.csv`;

    const header = ['Date', 'Post ID', 'Facebook URL', 'Status', 'Content'];
    const rows = targetItems.map((item) => [
      formatDate(item.createdTime),
      item.postId,
      `https://www.facebook.com/${item.postId}`,
      item.status,
      (item.messageSnippet || '').replace(/"/g, '""'),
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Full JSON archive export handler
  const exportJSON = (customItems?: QueueItem[]) => {
    const targetItems = customItems || filteredItems;
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `fb_posts_archive_${(pageName || 'page').replace(/\s+/g, '_')}_${dateStr}.json`;

    const archiveData = {
      exportedAt: new Date().toISOString(),
      targetPage: pageName || 'Unknown Page',
      totalPostsExported: targetItems.length,
      posts: targetItems.map((item) => ({
        postId: item.postId,
        createdTime: item.createdTime,
        status: item.status,
        messageSnippet: item.messageSnippet || '',
        facebookUrl: `https://www.facebook.com/${item.postId}`,
        attempts: item.attempts,
        discoveredAt: item.discoveredAt,
        lastErrorMessage: item.lastErrorMessage || null,
      })),
    };

    const blob = new Blob([JSON.stringify(archiveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Selection helpers
  const selectableItems = useMemo(() => {
    return paginatedItems.filter((i) => i.status !== 'deleted' && i.status !== 'processing');
  }, [paginatedItems]);

  const isAllPageSelected = useMemo(() => {
    return selectableItems.length > 0 && selectableItems.every((i) => selectedIds.includes(i.postId));
  }, [selectableItems, selectedIds]);

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      const pageIds = new Set(selectableItems.map((i) => i.postId));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...selectableItems.map((i) => i.postId)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const toggleSelectItem = (postId: string) => {
    setSelectedIds((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  };

  const getStatusBadge = (status: QueueItem['status']) => {
    switch (status) {
      case 'deleted':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Deleted
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse">
            <Clock className="h-3 w-3" />
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      case 'skipped':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <SkipForward className="h-3 w-3" />
            Skipped
          </span>
        );
      case 'unknown':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <AlertCircle className="h-3 w-3" />
            Unknown
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 border border-slate-300/80 dark:border-slate-700/60">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/90 dark:bg-slate-900/60 p-8 text-center backdrop-blur-xl shadow-sm dark:shadow-xl space-y-3">
        <div className="h-10 w-10 mx-auto rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Queue is currently empty</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            No posts discovered yet for <span className="font-medium text-slate-700 dark:text-slate-300">{pageName || 'selected page'}</span>. Run &quot;Discover Posts (Dry Run)&quot; above to scan posts from Meta Graph API.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-slate-900/70 backdrop-blur-xl overflow-hidden shadow-sm dark:shadow-xl transition-all">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950/40">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Queue &amp; Post Deletion History
            </h3>
            <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
              {counts.all.toLocaleString()} Total Discovered
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Target Page: <span className="font-semibold text-slate-800 dark:text-slate-200">{pageName || 'Selected Page'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Search */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search ID or text..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition w-40 sm:w-48 shadow-sm"
            />
          </div>

          {/* Quick Order Selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs shadow-sm">
            <ArrowUpDown className="h-3 w-3 text-slate-400" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'oldest_first' | 'newest_first')}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="oldest_first">Oldest to Recent</option>
              <option value="newest_first">Newest to Oldest</option>
            </select>
          </div>

          {/* Refresh Remaining Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition active:scale-95 disabled:opacity-50 shadow-sm"
              title="Refresh queue view (zero rate limit, reads local cache)"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          )}

          {/* CSV Export Button */}
          <button
            onClick={() => exportCSV()}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition active:scale-95 shadow-sm"
            title="Export current filtered view as CSV with Facebook links"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          {/* JSON Archive Backup */}
          <button
            onClick={() => exportJSON()}
            className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition active:scale-95 shadow-sm"
            title="Download full JSON archive with raw post IDs, snippets & timestamps"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Backup JSON</span>
          </button>
        </div>
      </div>

      {/* Authoritative Filter Tabs (All 4 categories always accessible with exact counts) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-100/60 dark:bg-slate-950/30 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Pending Tab */}
          <button
            onClick={() => {
              setActiveTab('pending');
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 font-semibold transition text-xs ${
              activeTab === 'pending'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Pending Remaining</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'pending'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}
            >
              {counts.pending.toLocaleString()}
            </span>
          </button>

          {/* 2. Deleted Tab */}
          <button
            onClick={() => {
              setActiveTab('deleted');
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 font-semibold transition text-xs ${
              activeTab === 'deleted'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Deleted History</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'deleted'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {counts.deleted.toLocaleString()}
            </span>
          </button>

          {/* 3. Failed / Issues Tab (ALWAYS VISIBLE) */}
          <button
            onClick={() => {
              setActiveTab('failed');
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 font-semibold transition text-xs ${
              activeTab === 'failed'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <AlertCircle className={`h-3.5 w-3.5 ${counts.failed > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
            <span>Failed / Issues</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'failed'
                  ? 'bg-white/20 text-white'
                  : counts.failed > 0
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {counts.failed.toLocaleString()}
            </span>
          </button>

          {/* 4. All Tab */}
          <button
            onClick={() => {
              setActiveTab('all');
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 font-semibold transition text-xs ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white shadow-sm dark:bg-slate-700'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>All Posts</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {counts.all.toLocaleString()}
            </span>
          </button>
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Rows per page:</span>
          {[25, 50, 100].map((size) => (
            <button
              key={size}
              onClick={() => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg border transition ${
                pageSize === size
                  ? 'bg-blue-600 border-blue-600 font-bold text-white shadow-sm'
                  : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Content Type Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-200/60 dark:border-white/[0.05] text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Filter:
          </span>
          {[
            { id: 'all', label: 'All Content' },
            { id: 'text', label: 'With Text Only' },
            { id: 'media', label: 'Photos / Media' },
            { id: 'links', label: 'External Links' },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => {
                setPostTypeFilter(type.id as any);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                postTypeFilter === type.id
                  ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {searchQuery && (
          <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
            Filtering by &quot;{searchQuery}&quot; ({filteredItems.length} match{filteredItems.length === 1 ? '' : 'es'})
          </div>
        )}
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-200/80 dark:border-blue-900/40 text-xs transition-all">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-blue-600 text-white font-bold text-[10px]">
              {selectedIds.length}
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Selected post{selectedIds.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 ml-2 underline"
            >
              <X className="h-3 w-3" />
              Deselect All
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCSV(items.filter((i) => selectedIds.includes(i.postId)))}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 font-semibold transition text-xs shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Selected ({selectedIds.length})</span>
            </button>

            <button
              onClick={handleBatchDelete}
              disabled={isBatchDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition text-xs shadow-sm disabled:opacity-50"
            >
              {isBatchDeleting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Selected ({selectedIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/80 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-white/[0.08] uppercase tracking-wider text-[10px]">
            <tr>
              {/* Select All Checkbox */}
              <th className="px-4 py-3.5 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllPageSelected}
                  onChange={toggleSelectAllPage}
                  disabled={selectableItems.length === 0}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Select / deselect all selectable posts on this page"
                />
              </th>
              <th className="px-5 py-3.5">Post Date</th>
              <th className="px-5 py-3.5">Post ID</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Content Snippet</th>
              <th className="px-5 py-3.5">Attempts</th>
              <th className="px-5 py-3.5">Result / Diagnosis</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 dark:divide-white/[0.06] text-slate-700 dark:text-slate-300">
            {paginatedItems.map((item) => {
              const isSelectable = item.status !== 'deleted' && item.status !== 'processing';
              const isSelected = selectedIds.includes(item.postId);

              return (
                <tr
                  key={item.postId}
                  className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition ${
                    isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                  }`}
                >
                  {/* Row Checkbox */}
                  <td className="px-4 py-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectItem(item.postId)}
                      disabled={!isSelectable}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </td>

                  {/* Date */}
                  <td className="px-5 py-3.5 whitespace-nowrap font-sans font-medium text-slate-800 dark:text-slate-200">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <Calendar className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      {formatDate(item.createdTime)}
                    </span>
                  </td>

                  {/* Post ID */}
                  <td className="px-5 py-3.5 font-mono text-slate-900 dark:text-white font-medium whitespace-nowrap">
                    <span className="bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700/60">
                      {item.postId}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="px-5 py-3.5 whitespace-nowrap">{getStatusBadge(item.status)}</td>

                  {/* Content Snippet */}
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 max-w-sm truncate font-sans text-xs">
                    {item.messageSnippet || (
                      <span className="text-slate-400 italic">(Image / Video / Attachment without text)</span>
                    )}
                  </td>

                  {/* Attempts */}
                  <td className="px-5 py-3.5 font-mono text-slate-700 dark:text-slate-300 font-semibold text-center w-16">
                    {item.attempts}
                  </td>

                  {/* Diagnosis */}
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-sans text-xs">
                    {item.lastErrorMessage ? (
                      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                        <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{item.lastErrorMessage}</span>
                      </div>
                    ) : item.status === 'deleted' ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>HTTP 200 • Permanently Deleted from Page</span>
                      </div>
                    ) : item.status === 'processing' ? (
                      <span className="text-blue-500 font-medium animate-pulse">
                        Sending delete request to Meta Graph API...
                      </span>
                    ) : (
                      <span className="text-slate-400">Scheduled in queue</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View on Facebook */}
                      <a
                        href={`https://www.facebook.com/${item.postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
                        title="View post on Facebook"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>

                      {/* Delete single — only for pending/failed/skipped/unknown */}
                      {isSelectable && (
                        <button
                          onClick={() => handleDeleteSingle(item.postId)}
                          disabled={deletingPostId === item.postId}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition disabled:opacity-50"
                          title="Delete this post now"
                        >
                          {deletingPostId === item.postId ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {paginatedItems.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400 font-sans space-y-2">
                  <div className="h-9 w-9 mx-auto rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    No {activeTab} posts found in current view.
                  </div>
                  {searchQuery && (
                    <p className="text-[11px] text-slate-400">
                      No results matching &quot;{searchQuery}&quot;. Try clearing the search filter.
                    </p>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950/40 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-800 dark:text-slate-200">{paginatedItems.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{filteredItems.length.toLocaleString()}</strong> posts
            (Page {currentPage} of {totalPages})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-xl border border-slate-200 dark:border-white/10 px-3.5 py-1.5 font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition shadow-sm"
            >
              Previous
            </button>
            <span className="text-xs font-mono text-slate-500 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-xl border border-slate-200 dark:border-white/10 px-3.5 py-1.5 font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
