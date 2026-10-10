'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Key,
  Facebook,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Github,
  Star,
  HelpCircle,
  Layers,
  Terminal,
  LayoutGrid,
  ArrowRight,
  Trash2,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Sidebar, NavSection } from '@/components/Sidebar';
import { TopNav } from '@/components/TopNav';
import { CleanupOverview } from '@/components/CleanupOverview';
import { WorkerControlCard } from '@/components/WorkerControlCard';
import { CleanupActions } from '@/components/CleanupActions';
import { QueueTable } from '@/components/QueueTable';
import { LogsViewer } from '@/components/LogsViewer';
import { SpamCommentsCleaner } from '@/components/SpamCommentsCleaner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ApiTutorialModal } from '@/components/ApiTutorialModal';
import { PolicyModal } from '@/components/PolicyModal';
import { TokenExpiredModal } from '@/components/TokenExpiredModal';
import { PageInfo, WorkerState, QueueItem, LogEntry, AuthStatusResponse } from '@/server/types';
import { MOCK_DEMO_PAGE, MOCK_DEMO_POSTS, MOCK_DEMO_LOGS } from '@/lib/demoData';

export default function DashboardPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse>({
    authenticated: false,
    hasConfiguredApp: false,
  });
  const [showTokenExpiredModal, setShowTokenExpiredModal] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  const [pages, setPages] = useState<PageInfo[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [manualToken, setManualToken] = useState<string>('');
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [tokenNotice, setTokenNotice] = useState<string | null>(null);

  const [discovering, setDiscovering] = useState<boolean>(false);
  const [discoverySummary, setDiscoverySummary] = useState<string | null>(null);

  const [worker, setWorker] = useState<WorkerState | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueRefreshing, setQueueRefreshing] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Detected Page Date Boundaries
  const [earliestPostDate, setEarliestPostDate] = useState<string | null>(null);
  const [latestPostDate, setLatestPostDate] = useState<string | null>(null);

  // Active navigation section
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Modals
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [tutorialTab, setTutorialTab] = useState<'token' | 'oauth'>('token');
  const [policyModal, setPolicyModal] = useState<{
    isOpen: boolean;
    type: 'privacy' | 'terms';
  }>({ isOpen: false, type: 'privacy' });

  // Theme state (dark / light)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Discovery Filter States (Date filtering & Oldest first vs Newest first)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'oldest_first' | 'newest_first'>('oldest_first');
  const [activeDatePreset, setActiveDatePreset] = useState<string>('all');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');

  // Today's date string for input max attribute
  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate available years strictly from earliestPostDate and latestPostDate
  const availableYears = useMemo(() => {
    if (!earliestPostDate) return [];
    try {
      const startYr = parseInt(earliestPostDate.split('-')[0], 10);
      const endYr = latestPostDate
        ? parseInt(latestPostDate.split('-')[0], 10)
        : new Date().getFullYear();
      const yrs: number[] = [];
      for (let y = startYr; y <= endYr; y++) {
        yrs.push(y);
      }
      return yrs;
    } catch {
      return [];
    }
  }, [earliestPostDate, latestPostDate]);

  // Bottom Area View Mode (Queue Table, Activity Logs, or Split)
  const [bottomViewMode, setBottomViewMode] = useState<'queue' | 'logs' | 'split'>('queue');

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    mode: 'test' | 'full';
    testLimit?: number;
  }>({ isOpen: false, mode: 'full' });

  // Track previous worker status for completion alert sound
  const prevWorkerStatusRef = useRef<string>('idle');

  // Gentle audio chime on completion using browser Web Audio API (zero external files required)
  const playCompletionChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: B5 (987.77 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.15);
      gain2.gain.setValueAtTime(0.18, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);
    } catch {
      // AudioContext may be restricted before user interaction, fail silently
    }
  }, []);

  // Desktop / Browser notification
  const sendBrowserNotification = useCallback((title: string, body: string) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    } catch {
      // fail silently
    }
  }, []);

  // Initialize and toggle theme
  useEffect(() => {
    const savedTheme = (localStorage.getItem('fpc_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('fpc_theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  };

  // Fetch User's Managed Pages
  const fetchPages = useCallback(async () => {
    if (isDemoMode) return;
    try {
      const res = await fetch('/api/pages');
      const data = await res.json();
      if (data.pages && data.pages.length > 0) {
        setPages(data.pages);
        setSelectedPageId((curr) => {
          if (curr && data.pages.some((p: PageInfo) => p.id === curr)) {
            return curr;
          }
          const serverSelected = data.pages.find((p: PageInfo) => p.selected);
          if (serverSelected) return serverSelected.id;
          return data.pages[0].id;
        });
      }
    } catch (err) {
      console.error('Failed to fetch pages', err);
    }
  }, [isDemoMode]);

  // Fetch Auth Status
  const fetchAuthStatus = useCallback(async () => {
    if (isDemoMode) return;
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setAuthStatus(data);
      if (data.authenticated) {
        if (data.selectedPage?.id) {
          setSelectedPageId((curr) => curr || data.selectedPage.id);
        }
        fetchPages();
      } else {
        setWorker(null);
        setQueueItems([]);
        setEarliestPostDate(null);
        setLatestPostDate(null);
        setDiscoverySummary(null);
      }
    } catch (err) {
      console.error('Failed to fetch auth status', err);
    }
  }, [isDemoMode, fetchPages]);

  // Fetch Worker Status & Queue Preview
  const fetchWorkerStatus = useCallback(async () => {
    if (isDemoMode) return;
    try {
      const res = await fetch('/api/cleanup?limit=300');
      const data = await res.json();
      if (data.worker) {
        setWorker(data.worker);
        const prev = prevWorkerStatusRef.current;
        const current = data.worker.status;

        // Trigger chime and desktop notification when cleanup finishes
        if (prev === 'running' && current === 'completed') {
          playCompletionChime();
          sendBrowserNotification(
            'FB CleanSuite: Cleanup Completed! 🎉',
            'All queued posts have been processed and deleted successfully.'
          );
        }
        prevWorkerStatusRef.current = current;

        if (data.worker.tokenExpired) {
          setShowTokenExpiredModal(true);
        }
      }
      if (data.queue) {
        setQueueItems(data.queue.recentItems || []);
        setEarliestPostDate(data.queue.earliestPostDate || null);
        setLatestPostDate(data.queue.latestPostDate || null);
      }
    } catch (err) {
      console.error('Failed to fetch worker status', err);
    }
  }, [playCompletionChime, sendBrowserNotification, isDemoMode]);

  // Manual refresh queue handler
  const handleRefreshQueue = async () => {
    if (isDemoMode) {
      setQueueItems([...MOCK_DEMO_POSTS]);
      return;
    }
    setQueueRefreshing(true);
    try {
      const res = await fetch('/api/cleanup?limit=200');
      const data = await res.json();
      if (data.worker) setWorker(data.worker);
      if (data.queue) {
        setQueueItems(data.queue.recentItems || []);
        setEarliestPostDate(data.queue.earliestPostDate || null);
        setLatestPostDate(data.queue.latestPostDate || null);
      }
    } catch (err) {
      console.error('Failed to refresh queue', err);
    } finally {
      setQueueRefreshing(false);
    }
  };

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    if (isDemoMode) return;
    try {
      const res = await fetch('/api/cleanup/logs?limit=50');
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  }, [isDemoMode]);

  useEffect(() => {
    if (isDemoMode) return;
    fetchAuthStatus();
    fetchWorkerStatus();
    fetchLogs();

    const interval = setInterval(() => {
      if (isDemoMode) return;
      if (authStatus.authenticated) {
        fetchWorkerStatus();
      }
      fetchLogs();
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchAuthStatus, fetchWorkerStatus, fetchLogs, authStatus.authenticated, isDemoMode]);

  // Demo Mode deletion helpers
  const handleDemoDeleteSingle = (postId: string) => {
    setQueueItems((prev) =>
      prev.map((item) => (item.postId === postId ? { ...item, status: 'deleted' } : item))
    );
    setWorker((prev) =>
      prev
        ? {
            ...prev,
            stats: {
              ...prev.stats,
              pending: Math.max(0, prev.stats.pending - 1),
              deleted: prev.stats.deleted + 1,
            },
          }
        : null
    );
  };

  const handleDemoBatchDelete = (postIds: string[]) => {
    setQueueItems((prev) =>
      prev.map((item) => (postIds.includes(item.postId) ? { ...item, status: 'deleted' } : item))
    );
    setWorker((prev) =>
      prev
        ? {
            ...prev,
            stats: {
              ...prev.stats,
              pending: Math.max(0, prev.stats.pending - postIds.length),
              deleted: prev.stats.deleted + postIds.length,
            },
          }
        : null
    );
  };

  // Toggle Interactive Demo Mode
  const handleToggleDemoMode = () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      setDiscoverySummary(null);
      setTimeout(() => {
        fetchAuthStatus();
        fetchWorkerStatus();
        fetchLogs();
      }, 50);
    } else {
      setIsDemoMode(true);
      setPages([MOCK_DEMO_PAGE]);
      setSelectedPageId(MOCK_DEMO_PAGE.id);
      setAuthStatus({
        authenticated: true,
        hasConfiguredApp: false,
        selectedPage: MOCK_DEMO_PAGE,
      });
      setQueueItems([...MOCK_DEMO_POSTS]);
      setLogs([...MOCK_DEMO_LOGS]);
      setEarliestPostDate('2021-03-15');
      setLatestPostDate('2026-08-25');
      setStartDate('2021-03-15');
      setEndDate('2026-08-25');
      setActiveDatePreset('all');
      setSelectedYearFilter('all');
      setWorker({
        status: 'idle',
        mode: 'full',
        currentActionDescription: 'Demo Sandbox Ready. Try testing cleanup speed, presets, and filters!',
        currentDelaySeconds: 5,
        baseDelaySeconds: 5,
        backoffLevel: 0,
        consecutiveFailures: 0,
        stats: {
          total: MOCK_DEMO_POSTS.length,
          pending: MOCK_DEMO_POSTS.filter((p) => p.status === 'pending').length,
          deleted: MOCK_DEMO_POSTS.filter((p) => p.status === 'deleted').length,
          failed: MOCK_DEMO_POSTS.filter((p) => p.status === 'failed').length,
          skipped: 0,
          unknown: 0,
        },
      });
      playCompletionChime();
    }
  };

  // Select Target Page
  const handleSelectPage = async (pageId: string) => {
    if (!pageId || pageId === selectedPageId) return;
    if (isDemoMode) {
      setSelectedPageId(pageId);
      return;
    }
    try {
      setSelectedPageId(pageId);
      // Immediately reset previous page's queue items and dates to avoid showing stale data
      setQueueItems([]);
      setEarliestPostDate(null);
      setLatestPostDate(null);
      setDiscoverySummary(null);

      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.page?.id) {
          setSelectedPageId(data.page.id);
        }
        await Promise.all([fetchAuthStatus(), fetchWorkerStatus(), fetchLogs()]);
      }
    } catch (err) {
      console.error('Failed to select page', err);
    }
  };

  // Import Direct Token
  const handleImportToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;

    setImportLoading(true);
    setTokenNotice(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: manualToken.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setTokenNotice(`Success: Connected ${data.type === 'page' ? 'Page' : 'User'}: ${data.name}`);
        setManualToken('');
        if (data.id) {
          setSelectedPageId(data.id);
        }
        await fetchAuthStatus();
        await fetchPages();
        await fetchWorkerStatus();
        await fetchLogs();
      } else {
        setTokenNotice(`Error: ${data.error || 'Failed to validate token'}`);
      }
    } catch (err: any) {
      setTokenNotice(`Error: ${err.message || 'Network error'}`);
    } finally {
      setImportLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    if (isDemoMode) {
      handleToggleDemoMode();
      return;
    }
    try {
      await fetch('/api/auth/status', { method: 'DELETE' });
      setAuthStatus({ authenticated: false, hasConfiguredApp: false });
      setPages([]);
      setSelectedPageId('');
      setWorker(null);
      setQueueItems([]);
      setEarliestPostDate(null);
      setLatestPostDate(null);
      setDiscoverySummary(null);
      fetchLogs();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  // Preset Date Range Helper
  const applyDatePreset = (preset: string) => {
    setActiveDatePreset(preset);
    setSelectedYearFilter('all');
    const now = new Date();
    const endStr = now.toISOString().split('T')[0];
    setEndDate(endStr);

    if (preset === 'all') {
      setStartDate(earliestPostDate || '');
      setEndDate(latestPostDate || endStr);
    } else if (preset === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
    } else if (preset === '90d') {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      setStartDate(d.toISOString().split('T')[0]);
    }
  };

  // Specific Year Select Helper
  const handleYearSelect = (year: string) => {
    setSelectedYearFilter(year);
    setActiveDatePreset('');
    if (year === 'all') {
      setStartDate(earliestPostDate || '');
      setEndDate(latestPostDate || todayStr);
    } else {
      const yrStart = `${year}-01-01`;
      const yrEnd = `${year}-12-31`;
      setStartDate(earliestPostDate && earliestPostDate > yrStart ? earliestPostDate : yrStart);
      setEndDate(yrEnd > todayStr ? todayStr : yrEnd);
    }
  };

  // Discover Posts (Dry Run)
  const handleDiscoverPosts = async () => {
    setDiscovering(true);
    if (isDemoMode) {
      setDiscoverySummary('Demo Sandbox: Filtering mock posts by selected criteria...');
      setTimeout(() => {
        let filtered = [...MOCK_DEMO_POSTS];
        if (startDate) {
          filtered = filtered.filter((p) => (p.createdTime || '').split('T')[0] >= startDate);
        }
        if (endDate) {
          filtered = filtered.filter((p) => (p.createdTime || '').split('T')[0] <= endDate);
        }
        if (sortOrder === 'oldest_first') {
          filtered.sort((a, b) => (a.createdTime || '').localeCompare(b.createdTime || ''));
        } else {
          filtered.sort((a, b) => (b.createdTime || '').localeCompare(a.createdTime || ''));
        }
        setQueueItems(filtered);
        setWorker((prev) =>
          prev
            ? {
                ...prev,
                stats: {
                  ...prev.stats,
                  total: filtered.length,
                  pending: filtered.filter((p) => p.status === 'pending').length,
                  deleted: filtered.filter((p) => p.status === 'deleted').length,
                  failed: filtered.filter((p) => p.status === 'failed').length,
                },
              }
            : null
        );
        setDiscovering(false);
        setDiscoverySummary(
          `Demo Sandbox: Discovered ${filtered.length} posts matching criteria (${
            sortOrder === 'oldest_first' ? 'Oldest to Recent' : 'Newest to Oldest'
          }).`
        );
      }, 600);
      return;
    }

    setDiscoverySummary('Scanning Meta Graph API for eligible published posts...');

    try {
      const res = await fetch('/api/posts/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          sortOrder,
          limit: 10000,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setDiscoverySummary(
          `Discovered ${data.totalDiscovered.toLocaleString()} eligible posts (sorted: ${
            sortOrder === 'oldest_first' ? 'Oldest to Recent' : 'Newest to Oldest'
          }).`
        );
        fetchWorkerStatus();
        fetchLogs();
      } else {
        setDiscoverySummary(`Discovery failed: ${data.error}`);
      }
    } catch (err: any) {
      setDiscoverySummary(`Error: ${err.message}`);
    } finally {
      setDiscovering(false);
    }
  };

  // Worker Actions
  const handleWorkerAction = async (action: string, payload: Record<string, unknown> = {}) => {
    // Request notification permission if user starts test or full cleanup
    if (action.startsWith('start_') && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (isDemoMode) {
      if (action.startsWith('start')) {
        const limit = payload.mode === 'test' ? (Number(payload.testLimit) || 5) : 9999;
        setWorker((prev) =>
          prev
            ? {
                ...prev,
                status: 'running',
                currentActionDescription: `Demo Sandbox: Simulating deletion with rate-limiting pacing...`,
              }
            : null
        );
        setTimeout(() => {
          let count = 0;
          setQueueItems((prev) =>
            prev.map((item) => {
              if (item.status === 'pending' && count < limit) {
                count++;
                return { ...item, status: 'deleted', processedAt: new Date().toISOString() };
              }
              return item;
            })
          );
          setWorker((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'completed',
                  currentActionDescription: `Demo Sandbox: Cleanup simulation completed successfully! (${count} post${count === 1 ? '' : 's'} processed)`,
                  stats: {
                    ...prev.stats,
                    pending: Math.max(0, prev.stats.pending - count),
                    deleted: prev.stats.deleted + count,
                  },
                }
              : null
          );
          playCompletionChime();
        }, 1200);
      } else if (action === 'pause') {
        setWorker((prev) => (prev ? { ...prev, status: 'paused', currentActionDescription: 'Demo Sandbox: Cleanup paused.' } : null));
      } else if (action === 'resume') {
        setWorker((prev) => (prev ? { ...prev, status: 'running', currentActionDescription: 'Demo Sandbox: Cleanup resumed.' } : null));
      } else if (action === 'stop') {
        setWorker((prev) => (prev ? { ...prev, status: 'stopped', currentActionDescription: 'Demo Sandbox: Cleanup stopped.' } : null));
      } else if (action === 'set_delay') {
        setWorker((prev) =>
          prev
            ? {
                ...prev,
                currentDelaySeconds: Number(payload.delaySeconds) || 5,
              }
            : null
        );
      }
      return;
    }

    try {
      await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      fetchWorkerStatus();
      fetchLogs();
    } catch (err) {
      console.error(`Failed to trigger ${action}`, err);
    }
  };

  const selectedPageObj = pages.find((p) => p.id === selectedPageId) || (authStatus.selectedPage as PageInfo);

  // Section Navigation handler
  const handleSelectNavSection = (section: NavSection) => {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderSettingsSection = () => (
    <div id="settings-section" className="space-y-6">
      {/* If already connected, show active page status card */}
      {authStatus.authenticated && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/20 p-2.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{selectedPageObj?.name || 'Connected Page'}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                Page ID: {selectedPageId || selectedPageObj?.id || 'Unknown'} &bull; Token: AES-256-GCM Encrypted
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition active:scale-95"
            >
              Disconnect Page
            </button>
          </div>
        </div>
      )}

      {/* Connection Cards */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/5 bg-white/90 dark:bg-slate-900/60 p-6 backdrop-blur-xl shadow-sm dark:shadow-xl space-y-6">
        <div className="border-b border-slate-200/80 dark:border-white/5 pb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Key className="h-4 w-4 text-emerald-500" />
            {authStatus.authenticated ? 'Update / Switch Access Token' : 'Connect Your Facebook Page'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Access tokens are encrypted server-side with AES-256-GCM and never exposed to the browser or logs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Option A: Page Access Token (Recommended) */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-slate-950/40 p-6 flex flex-col justify-between space-y-5 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">Option A: Page Access Token</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Direct Explorer token import (Fastest)</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  RECOMMENDED
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Generate a Page token in{' '}
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline hover:text-blue-500 font-medium inline-flex items-center gap-1"
                >
                  Meta Graph API Explorer <ExternalLink className="h-3 w-3 inline" />
                </a>{' '}
                with <code className="rounded bg-slate-200 dark:bg-slate-900 px-1 py-0.5 text-slate-800 dark:text-slate-300 font-mono text-[11px]">pages_manage_posts</code> and paste it below.
              </p>
            </div>

            <form onSubmit={handleImportToken} className="space-y-3">
              <input
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste Page Access Token (starts with EAA...)"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono focus:border-emerald-500 focus:outline-none transition shadow-inner"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={importLoading || !manualToken.trim()}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition active:scale-[0.99] disabled:opacity-50 shadow-md"
                >
                  {importLoading ? 'Validating Token with Meta...' : 'Connect Target Page'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTutorialTab('token');
                    setShowTutorial(true);
                  }}
                  className="rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition inline-flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                  Token Guide
                </button>
              </div>
            </form>

            {tokenNotice && (
              <div
                className={`rounded-xl p-3 text-xs leading-relaxed ${
                  tokenNotice.startsWith('Success')
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                }`}
              >
                {tokenNotice}
              </div>
            )}
          </div>

          {/* Option B: Meta OAuth Flow */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-slate-950/40 p-6 flex flex-col justify-between space-y-5 transition hover:border-slate-300 dark:hover:border-slate-700/60 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-blue-600/10 p-2 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Facebook className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">Option B: Meta OAuth Login Flow</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Standard user popup authorization dialog</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Connects directly through Meta&apos;s OAuth dialog using your configured App ID in <code className="text-slate-800 dark:text-slate-300 font-mono">.env.local</code>.
                Requires setting <code className="text-slate-800 dark:text-slate-300 font-mono">META_APP_ID</code> and <code className="text-slate-800 dark:text-slate-300 font-mono">META_APP_SECRET</code>.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <a
                href="/api/auth/login"
                className="inline-flex items-center justify-center w-full gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-500 transition active:scale-[0.99]"
              >
                <Facebook className="h-4 w-4" />
                Sign in with Facebook OAuth
              </a>
              <button
                type="button"
                onClick={() => {
                  setTutorialTab('oauth');
                  setShowTutorial(true);
                }}
                className="inline-flex items-center justify-center w-full gap-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-sm active:scale-95"
              >
                <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                How to configure Meta OAuth Login?
              </button>
            </div>
          </div>

          {/* Option C: Demo Sandbox / Instant Preview */}
          <div className="md:col-span-2 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-transparent dark:bg-slate-950/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-sm">
            <div className="space-y-1.5 text-left">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                  <Sparkles className="h-3 w-3" />
                  NO CREDENTIALS REQUIRED
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Try before connecting</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Explore CleanSuite in Interactive Demo Sandbox
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                Test-drive post discovery, date filters (2021–2026), AI spam comment cleaning, whitelist rules, and CSV exports with realistic simulated data.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleDemoMode}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-purple-500/20 transition active:scale-95 shrink-0"
            >
              <Sparkles className="h-4 w-4" />
              {isDemoMode ? 'Exit Demo Sandbox' : 'Launch Demo Sandbox'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-100/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Left Sidebar (Desktop Fixed Width, Mobile Drawer) */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={handleSelectNavSection}
        onOpenHelp={() => {
          setTutorialTab('token');
          setShowTutorial(true);
        }}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header / App Bar */}
        <TopNav
          authenticated={authStatus.authenticated}
          selectedPageObj={selectedPageObj}
          pages={pages}
          selectedPageId={selectedPageId}
          onSelectPage={handleSelectPage}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
          tokenExpired={authStatus.tokenExpired || worker?.tokenExpired}
          tokenExpiresInSeconds={authStatus.tokenExpiresInSeconds}
          onRefreshClick={() => setShowTokenExpiredModal(true)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          isDemoMode={isDemoMode}
          onToggleDemoMode={handleToggleDemoMode}
        />

        {/* Demo Mode Alert Banner */}
        {isDemoMode && (
          <div className="bg-gradient-to-r from-purple-500/10 via-amber-500/10 to-blue-500/10 border-b border-purple-500/20 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-purple-800 dark:text-purple-300 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              <span>
                <strong>Demo Sandbox Active:</strong> You are exploring with mock Facebook posts &amp; spam comments. Actions are simulated safely and will not affect any live Meta page.
              </span>
            </div>
            <button
              onClick={handleToggleDemoMode}
              className="px-3 py-1 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/20 transition text-[11px] shrink-0 active:scale-95"
            >
              Exit Sandbox
            </button>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* VIEW 1: DASHBOARD */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {!authStatus.authenticated && !isDemoMode ? (
                renderSettingsSection()
              ) : (
                <>
                  {/* Discovery Summary Notice */}
                  {discoverySummary && (
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3.5 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                      {discoverySummary}
                    </div>
                  )}

                  {/* Overview Stats & Worker Status */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <CleanupOverview
                      worker={worker}
                      totalDiscovered={worker?.stats.total || queueItems.length}
                      pageName={selectedPageObj?.name}
                    />

                    <WorkerControlCard
                      worker={worker}
                      onPause={() => handleWorkerAction('pause')}
                      onResume={() => handleWorkerAction('resume')}
                      onStop={() => handleWorkerAction('stop')}
                      onSetDelay={(sec) => handleWorkerAction('set_delay', { delaySeconds: sec })}
                      disabled={!authStatus.authenticated && !isDemoMode}
                    />
                  </div>

                  {/* Feature Launchers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Post Cleaner Card */}
                    <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:border-blue-500/40 flex flex-col justify-between space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              <Trash2 className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Page Posts Cleaner</h3>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">Bulk delete page posts &amp; media</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Core Engine
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          Filter posts by date presets or custom year ranges, sort chronologically, run safety tests (10/50/100), and bulk delete with rate-limit protection.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            {(worker?.stats?.total || queueItems.length).toLocaleString()} Discovered
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            {(worker?.stats?.pending || queueItems.filter(i => i.status === 'pending').length).toLocaleString()} Pending
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {(worker?.stats?.deleted || 0).toLocaleString()} Deleted
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectNavSection('posts')}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 text-xs font-bold transition shadow-sm active:scale-[0.99]"
                      >
                        <span>Open Post Cleaner</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Spam Comments Card */}
                    <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:border-emerald-500/40 flex flex-col justify-between space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <ShieldAlert className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Spam Comments Cleaner</h3>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">Scam, bot link &amp; phone detection</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            NEW
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          Scan recent posts for malicious links, Telegram/WhatsApp crypto scammers, unwanted phone numbers, and custom blacklisted words. Review and delete in bulk.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Link Detection
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            WhatsApp Scams
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Bulk Purge
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectNavSection('comments')}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold transition shadow-sm active:scale-[0.99]"
                      >
                        <span>Open Spam Cleaner</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Queue Table */}
                  <div id="queue-section">
                    <QueueTable
                      items={queueItems}
                      pageName={selectedPageObj?.name}
                      onRefresh={handleRefreshQueue}
                      isRefreshing={queueRefreshing}
                      totalStats={worker?.stats}
                      isDemoMode={isDemoMode}
                      onDeleteItem={handleDemoDeleteSingle}
                      onBatchDelete={handleDemoBatchDelete}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* VIEW 2: POST CLEANER */}
          {activeSection === 'posts' && (
            <div className="space-y-6">
              {!authStatus.authenticated && !isDemoMode ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">Facebook Page Not Connected</h3>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80">Connect your page in Settings to run Post Cleaner.</p>
                  </div>
                  <button
                    onClick={() => setActiveSection('settings')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
                  >
                    Go to Page Settings
                  </button>
                </div>
              ) : (
                <>
                  {discoverySummary && (
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3.5 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                      {discoverySummary}
                    </div>
                  )}

                  <CleanupActions
                    discovering={discovering}
                    onDiscover={handleDiscoverPosts}
                    onStartTest={(count) =>
                      setConfirmModal({
                        isOpen: true,
                        mode: 'test',
                        testLimit: count,
                      })
                    }
                    onStartFull={() =>
                      setConfirmModal({
                        isOpen: true,
                        mode: 'full',
                      })
                    }
                    disabled={worker?.status === 'running' || (!authStatus.authenticated && !isDemoMode)}
                    totalPending={worker?.stats.pending || queueItems.filter((i) => i.status === 'pending').length}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    sortOrder={sortOrder}
                    setSortOrder={setSortOrder}
                    earliestPostDate={earliestPostDate}
                    latestPostDate={latestPostDate}
                    availableYears={availableYears.map(String)}
                    selectedYearFilter={selectedYearFilter}
                    onYearSelect={handleYearSelect}
                    activeDatePreset={activeDatePreset}
                    onApplyPreset={applyDatePreset}
                  />

                  <div id="queue-section">
                    <QueueTable
                      items={queueItems}
                      pageName={selectedPageObj?.name}
                      onRefresh={handleRefreshQueue}
                      isRefreshing={queueRefreshing}
                      totalStats={worker?.stats}
                      isDemoMode={isDemoMode}
                      onDeleteItem={handleDemoDeleteSingle}
                      onBatchDelete={handleDemoBatchDelete}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* VIEW 3: SPAM COMMENTS CLEANER */}
          {activeSection === 'comments' && (
            <SpamCommentsCleaner
              pageName={selectedPageObj?.name}
              authenticated={authStatus.authenticated}
              isDemoMode={isDemoMode}
            />
          )}

          {/* VIEW 4: ACTIVITY LOGS */}
          {activeSection === 'logs' && (
            <div id="logs-section">
              <LogsViewer logs={logs} onRefresh={fetchLogs} />
            </div>
          )}

          {/* VIEW 5: SETTINGS & ACCESS TOKENS */}
          {activeSection === 'settings' && renderSettingsSection()}
        </main>

        {/* World-Class Developer Footer */}
        <footer className="w-full mt-auto border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 transition-colors">
          <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>127.0.0.1 Loopback Verified</span>
              </div>
              <span>&bull;</span>
              <span>AES-256-GCM Secure Storage</span>
              <span>&bull;</span>
              <span>Zero Cloud Telemetry</span>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <button
                onClick={() => setPolicyModal({ isOpen: true, type: 'privacy' })}
                className="hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-4"
              >
                Privacy Policy
              </button>
              <button
                onClick={() => setPolicyModal({ isOpen: true, type: 'terms' })}
                className="hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-4"
              >
                Terms of Use
              </button>
              <a
                href="https://github.com/Wex-DE/FB-CleanSuite"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 hover:underline"
              >
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                <span>Star on GitHub</span>
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmModal.isOpen}
        pageName={selectedPageObj?.name || 'Selected Page'}
        totalPosts={worker?.stats.pending || 0}
        mode={confirmModal.mode}
        testCount={confirmModal.testLimit}
        onConfirm={() => {
          setConfirmModal({ ...confirmModal, isOpen: false });
          handleWorkerAction('start', {
            mode: confirmModal.mode,
            testLimit: confirmModal.testLimit,
          });
        }}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />

      {/* Api Tutorial Modal */}
      <ApiTutorialModal
        isOpen={showTutorial}
        initialTab={tutorialTab}
        onClose={() => setShowTutorial(false)}
      />

      {/* Policy Modal */}
      <PolicyModal
        isOpen={policyModal.isOpen}
        type={policyModal.type}
        onClose={() => setPolicyModal({ ...policyModal, isOpen: false })}
      />

      {/* Token Expired Modal */}
      <TokenExpiredModal
        isOpen={showTokenExpiredModal}
        onClose={() => setShowTokenExpiredModal(false)}
        onTokenUpdated={() => {
          fetchAuthStatus();
          fetchWorkerStatus();
          fetchLogs();
        }}
        errorMessage={authStatus.tokenExpiryMessage || worker?.tokenExpiryMessage}
        isPausedDueToExpiry={Boolean(worker?.tokenExpired)}
      />
    </div>
  );
}
