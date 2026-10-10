import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Trash2,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Filter,
  Link as LinkIcon,
  Phone,
  Tag,
  AlertTriangle,
  User,
  Clock,
  Layers,
  Square,
  ShieldCheck,
  Download,
  Sparkles,
  Radio,
  Zap,
} from 'lucide-react';
import { SpamComment, CommentScannerState } from '@/app/api/comments/route';
import { MOCK_DEMO_SPAM_COMMENTS } from '@/lib/demoData';

export const SPAM_PRESETS = [
  {
    id: 'crypto',
    name: 'Crypto & Forex Shield',
    desc: 'Telegram bots, WhatsApp brokers & USDT scams',
    icon: '🪙',
    keywords: 'crypto, telegram, t.me, whatsapp, wa.me, forex, invest, binance, usdt, trading, profit, bonus, free money, inbox me',
    links: true,
    phones: true,
  },
  {
    id: 'phishing',
    name: 'Giveaways & Phishing',
    desc: 'Fake rewards, gift cards & scam lottery links',
    icon: '🎁',
    keywords: 'free iphone, claim reward, winner, congratulations, cash gift, lottery, loan, cash prize, click here, claim now',
    links: true,
    phones: false,
  },
  {
    id: 'adult',
    name: 'Adult & Dating Bots',
    desc: 'Explicit trap links & fake dating profiles',
    icon: '🔞',
    keywords: 'dating, hot girl, meet singles, adult, hookup, private video, cam girls, click link, 18+',
    links: true,
    phones: false,
  },
  {
    id: 'jobs',
    name: 'Work-From-Home Scam',
    desc: 'Fake daily earn jobs & part-time recruiter bots',
    icon: '💼',
    keywords: 'work from home, daily earn, part time job, daily income, easy tasks, earn $500, telegram contact, send cv',
    links: true,
    phones: true,
  },
];

interface SpamCommentsCleanerProps {
  pageName?: string;
  authenticated: boolean;
  isDemoMode?: boolean;
}

export const SpamCommentsCleaner: React.FC<SpamCommentsCleanerProps> = ({
  pageName,
  authenticated,
  isDemoMode,
}) => {
  const [comments, setComments] = useState<SpamComment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scannerState, setScannerState] = useState<CommentScannerState | null>(null);
  const [stopping, setStopping] = useState<boolean>(false);
  const [postLimit, setPostLimit] = useState<number>(50);
  const [checkLinks, setCheckLinks] = useState<boolean>(true);
  const [checkPhones, setCheckPhones] = useState<boolean>(true);
  const [keywordInput, setKeywordInput] = useState<string>('inbox, dm, crypto, investment, whatsapp');
  const [whitelistInput, setWhitelistInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'flagged' | 'deleted' | 'all'>('flagged');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState<boolean>(false);
  const [scanSummary, setScanSummary] = useState<string | null>(null);

  // Auto-Pilot Sentinel states
  const [autoPilotEnabled, setAutoPilotEnabled] = useState<boolean>(false);
  const [autoPilotIntervalHours, setAutoPilotIntervalHours] = useState<number>(6);
  const [autoPilotAction, setAutoPilotAction] = useState<'flag' | 'auto_delete'>('flag');
  const [nextRunAt, setNextRunAt] = useState<number | null>(null);
  const [countdownText, setCountdownText] = useState<string>('');

  // Fetch saved comments and active scanner state
  const fetchComments = async () => {
    if (isDemoMode) {
      setComments(MOCK_DEMO_SPAM_COMMENTS);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/comments');
      const data = await res.json();
      if (data.comments) {
        setComments(data.comments);
      }
      if (data.scanner) {
        setScannerState(data.scanner);
        setScanning(Boolean(data.scanner.active));
        if (data.scanner.statusMessage) {
          setScanSummary(data.scanner.statusMessage);
        }
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isDemoMode) {
      setComments(MOCK_DEMO_SPAM_COMMENTS);
      setLoading(false);
      return;
    }
    if (authenticated) {
      setLoading(true);
      fetchComments();
    }
  }, [authenticated, isDemoMode]);

  // Polling while scan is active
  useEffect(() => {
    if (!scanning || isDemoMode) return;
    const interval = setInterval(() => {
      fetchComments();
    }, 1500);
    return () => clearInterval(interval);
  }, [scanning, isDemoMode]);

  // Run scan
  const handleScan = async () => {
    setScanning(true);
    if (isDemoMode) {
      setScanSummary('Demo Sandbox: Scanning sample posts for spam...');
      setTimeout(() => {
        setComments(MOCK_DEMO_SPAM_COMMENTS);
        setScanning(false);
        setScanSummary('Demo Scan Complete: Analyzed 14 posts and flagged 5 spam comments.');
      }, 1400);
      return;
    }

    setScanSummary(
      postLimit === 0
        ? 'Starting Full Page Scan (analyzing all posts with rate limit guard)...'
        : `Starting scan on latest ${postLimit} posts...`
    );
    try {
      const keywords = keywordInput
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const whitelist = whitelistInput
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean);

      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_scan',
          postLimit,
          checkLinks,
          checkPhones,
          customKeywords: keywords,
          whitelistKeywords: whitelist,
        }),
      });

      const data = await res.json();
      if (data.scanner) {
        setScannerState(data.scanner);
      }
    } catch (err: any) {
      setScanSummary(`Error: ${err.message}`);
      setScanning(false);
    }
  };

  // Stop scan
  const handleStopScan = async () => {
    setStopping(true);
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_scan' }),
      });
      setScanSummary('Stopping scan... waiting for current post to finish.');
    } catch {
      // handle error
    } finally {
      setStopping(false);
    }
  };

  // Apply 1-Click Preset
  const applyPreset = (preset: typeof SPAM_PRESETS[0]) => {
    setKeywordInput(preset.keywords);
    setCheckLinks(preset.links);
    setCheckPhones(preset.phones);
    setScanSummary(`Applied Preset: ${preset.name}. Ready to scan!`);
  };

  // Auto-Pilot Sentinel settings persistence
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fpc_autopilot_comments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.enabled === 'boolean') setAutoPilotEnabled(parsed.enabled);
        if (parsed.interval) setAutoPilotIntervalHours(Number(parsed.interval));
        if (parsed.action) setAutoPilotAction(parsed.action);
      }
    } catch {
      // silently handle
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'fpc_autopilot_comments',
        JSON.stringify({
          enabled: autoPilotEnabled,
          interval: autoPilotIntervalHours,
          action: autoPilotAction,
        })
      );
    } catch {
      // silently handle
    }
  }, [autoPilotEnabled, autoPilotIntervalHours, autoPilotAction]);

  // Auto-Pilot Sentinel countdown and recurring scan trigger
  useEffect(() => {
    if (!autoPilotEnabled) {
      setNextRunAt(null);
      setCountdownText('');
      return;
    }

    if (!nextRunAt) {
      setNextRunAt(Date.now() + autoPilotIntervalHours * 3600 * 1000);
    }

    const timer = setInterval(() => {
      if (!nextRunAt) return;
      const diff = nextRunAt - Date.now();
      if (diff <= 0) {
        if (!scanning) {
          handleScan();
        }
        setNextRunAt(Date.now() + autoPilotIntervalHours * 3600 * 1000);
      } else {
        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdownText(`${hrs > 0 ? `${hrs}h ` : ''}${mins}m ${secs}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [autoPilotEnabled, nextRunAt, autoPilotIntervalHours, scanning]);

  // Export audit report to CSV
  const handleExportCSV = () => {
    if (comments.length === 0) return;
    const headers = ['Comment ID', 'Post ID', 'User Name', 'User ID', 'Date', 'Status', 'Spam Triggers', 'Message'];
    const rows = comments.map((c) => [
      `"${c.id}"`,
      `"${c.postId || ''}"`,
      `"${(c.fromName || '').replace(/"/g, '""')}"`,
      `"${c.fromId || ''}"`,
      `"${c.createdTime}"`,
      `"${c.status}"`,
      `"${c.spamReasons.join(', ')}"`,
      `"${c.message.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `facebook_spam_comments_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const currentKeywords = useMemo(() => {
    return keywordInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }, [keywordInput]);

  // Smart Highlighter for detected spam triggers in comment text
  const highlightSpamText = (
    text: string,
    reasons: ('link' | 'phone' | 'keyword')[],
    keywords: string[]
  ) => {
    if (!text) return text;
    const patterns: string[] = [];

    keywords.forEach((k) => {
      if (k.length >= 2) {
        patterns.push(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      }
    });

    if (reasons.includes('link')) {
      patterns.push(
        'https?:\\/\\/[^\\s]+',
        'www\\.[^\\s]+',
        't\\.me\\/[^\\s]+',
        'wa\\.me\\/[^\\s]+',
        'bit\\.ly\\/[^\\s]+',
        '[a-zA-Z0-9-]+\\.(?:com|org|net|io|xyz|info|biz|club|site|online)\\b'
      );
    }

    if (reasons.includes('phone')) {
      patterns.push('(?:\\+?[0-9]{1,4}[\\s-]?)?(?:\\(?[0-9]{2,5}\\)?[\\s-]?)?[0-9]{3,5}[\\s-]?[0-9]{3,5}');
    }

    if (patterns.length === 0) return text;

    try {
      const combinedRegex = new RegExp(`(${patterns.join('|')})`, 'gi');
      const parts = text.split(combinedRegex);

      return (
        <span>
          {parts.map((part, idx) => {
            if (part && combinedRegex.test(part)) {
              return (
                <mark
                  key={idx}
                  className="bg-amber-400/25 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200 font-semibold px-1 py-0.5 rounded border border-amber-500/30"
                >
                  {part}
                </mark>
              );
            }
            return <React.Fragment key={idx}>{part}</React.Fragment>;
          })}
        </span>
      );
    } catch {
      return text;
    }
  };

  // Single delete
  const handleDeleteSingle = async (commentId: string) => {
    setDeletingId(commentId);
    if (isDemoMode) {
      setTimeout(() => {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, status: 'deleted' } : c))
        );
        setSelectedIds((prev) => prev.filter((id) => id !== commentId));
        setDeletingId(null);
      }, 400);
      return;
    }

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_single', commentId }),
      });
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, status: 'deleted' } : c))
        );
        setSelectedIds((prev) => prev.filter((id) => id !== commentId));
      }
    } catch {
      // handle error
    } finally {
      setDeletingId(null);
    }
  };

  // Batch delete
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} spam comment(s) from Facebook?`)) {
      return;
    }

    setIsBatchDeleting(true);
    if (isDemoMode) {
      setTimeout(() => {
        setComments((prev) =>
          prev.map((c) => (selectedIds.includes(c.id) ? { ...c, status: 'deleted' } : c))
        );
        setSelectedIds([]);
        setIsBatchDeleting(false);
      }, 800);
      return;
    }

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_batch', commentIds: selectedIds }),
      });
      const data = await res.json();
      if (res.ok && data.comments) {
        setComments(data.comments);
        setSelectedIds([]);
      }
    } catch {
      // handle error
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Filtered comments
  const filteredComments = useMemo(() => {
    let result = comments;
    if (activeTab === 'flagged') {
      result = comments.filter((c) => c.status === 'flagged');
    } else if (activeTab === 'deleted') {
      result = comments.filter((c) => c.status === 'deleted');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.message.toLowerCase().includes(q) ||
          c.fromName.toLowerCase().includes(q) ||
          (c.postId && c.postId.includes(q))
      );
    }
    return result;
  }, [comments, activeTab, searchQuery]);

  const flaggedCount = useMemo(() => comments.filter((c) => c.status === 'flagged').length, [comments]);
  const deletedCount = useMemo(() => comments.filter((c) => c.status === 'deleted').length, [comments]);

  const selectableComments = useMemo(
    () => filteredComments.filter((c) => c.status === 'flagged'),
    [filteredComments]
  );

  const isAllSelected =
    selectableComments.length > 0 &&
    selectableComments.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const pageIds = new Set(selectableComments.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...selectableComments.map((c) => c.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-slate-900/70 p-6 backdrop-blur-xl shadow-sm dark:shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex-shrink-0">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Spam &amp; Toxic Comments Cleaner
              </h2>
              <span className="rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                New Tool
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
              Detect and clean external links, Telegram bots, WhatsApp phone numbers, and scam comments across your published Facebook Page posts via official Graph API.
            </p>
          </div>
        </div>

        {/* Scan Status Badge */}
        <div className="flex items-center gap-3">
          {autoPilotEnabled && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-700 dark:text-purple-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              <span className="text-[11px] font-bold">
                Sentinel Active {countdownText ? `(${countdownText})` : ''}
              </span>
            </div>
          )}

          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {flaggedCount} Flagged
            </div>
            <div className="text-[11px] text-slate-400">
              {deletedCount} Cleaned
            </div>
          </div>
        </div>
      </div>

      {/* Scan Configuration Card */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/90 dark:bg-slate-900/60 p-6 backdrop-blur-xl shadow-sm dark:shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Scanner Rules &amp; Detection Settings
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Target Page: <strong className="text-slate-700 dark:text-slate-200">{pageName || 'Selected Page'}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-xs">
          {/* Rule 1: Scan Depth */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-500" />
                Scan Depth:
              </label>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                {postLimit === 15 ? '⚡ Quick' : postLimit === 50 ? '🎯 Standard' : postLimit === 100 ? '🔍 Deep' : '🌐 Complete'}
              </span>
            </div>

            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-white/10 h-[38px]">
              {[
                { num: 15, label: '15' },
                { num: 50, label: '50' },
                { num: 100, label: '100' },
                { num: 0, label: 'All' },
              ].map((opt) => (
                <button
                  key={opt.num}
                  type="button"
                  onClick={() => setPostLimit(opt.num)}
                  className={`flex-1 h-full rounded-lg text-xs font-bold transition flex items-center justify-center ${
                    postLimit === opt.num
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {postLimit === 0
                ? 'Full page posts with rate-limit guard'
                : `Latest ${postLimit} posts on page`}
            </p>
          </div>

          {/* Rule 2: Detection Triggers */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Detection Triggers:
            </label>
            <div className="space-y-1.5 pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checkLinks}
                  onChange={(e) => setCheckLinks(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  External Links (Telegram, URLs)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checkPhones}
                  onChange={(e) => setCheckPhones(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  Phone Numbers &amp; WhatsApp
                </span>
              </label>
            </div>
          </div>

          {/* Rule 3: Custom Spam Keywords */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-emerald-500" />
              Custom Keywords:
            </label>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="e.g. inbox, crypto, whatsapp"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition h-[38px]"
            />
            <p className="text-[11px] text-slate-400 truncate">
              Comma-separated spam terms
            </p>
          </div>

          {/* Rule 4: Whitelist / Safe Terms */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
              Whitelist (Safe Terms):
            </label>
            <input
              type="text"
              value={whitelistInput}
              onChange={(e) => setWhitelistInput(e.target.value)}
              placeholder="e.g. mysite.com, youtube.com"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition h-[38px]"
            />
            <p className="text-[11px] text-slate-400 truncate">
              Never flag these domains or terms
            </p>
          </div>
        </div>

        {/* Quick Spam Threat Presets */}
        <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              1-Click Threat Protection Presets:
            </span>
            <span className="text-[10px] text-slate-400">Instantly populate triggers &amp; keywords</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {SPAM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-slate-950/40 hover:border-blue-500/40 hover:bg-blue-500/5 transition text-left group active:scale-[0.99] shadow-sm"
              >
                <span className="text-lg leading-none mt-0.5">{preset.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-500 transition truncate">
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {preset.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Auto-Pilot Sentinel Scheduler Guard */}
        <div className="rounded-xl border border-purple-500/25 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-transparent p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Radio className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Auto-Pilot Sentinel Guard
                  </h4>
                  {autoPilotEnabled ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      ACTIVE ({countdownText || 'Running'})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-medium text-slate-500">
                      DISABLED
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Continuously scans your page in the background on a repeating schedule.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoPilotEnabled}
                  onChange={(e) => setAutoPilotEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {autoPilotEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>

          {autoPilotEnabled && (
            <div className="pt-2 border-t border-purple-500/15 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Scan Frequency:</span>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/10 p-0.5 bg-white dark:bg-slate-900">
                  {[1, 3, 6, 12, 24].map((hr) => (
                    <button
                      key={hr}
                      type="button"
                      onClick={() => setAutoPilotIntervalHours(hr)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                        autoPilotIntervalHours === hr
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {hr}h
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Auto-Action:</span>
                <select
                  value={autoPilotAction}
                  onChange={(e) => setAutoPilotAction(e.target.value as 'flag' | 'auto_delete')}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="flag">Flag Only (Review before deleting)</option>
                  <option value="auto_delete">Auto-Delete Detected Spam on Sight</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Scan Button & Notice */}
        <div className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
          {/* Progress bar if scanning */}
          {scanning && scannerState && scannerState.totalPostsFound > 0 && (
            <div className="w-full space-y-1.5 bg-slate-100 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-white/5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                  Scanned {scannerState.scannedPosts} of {scannerState.totalPostsFound} posts
                </span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">
                  {scannerState.flaggedCount} spam comments flagged
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        5,
                        Math.round(
                          (scannerState.scannedPosts / scannerState.totalPostsFound) * 100
                        )
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              <span>{scanSummary || 'Ready to inspect comments on target page.'}</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {scanning && (
                <button
                  type="button"
                  onClick={handleStopScan}
                  disabled={stopping}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs transition active:scale-95 disabled:opacity-50"
                  title="Stop scan and keep current findings"
                >
                  <Square className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
                  <span>{stopping ? 'Stopping...' : 'Stop Scan'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleScan}
                disabled={scanning || (!authenticated && !isDemoMode)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition active:scale-95 disabled:opacity-50 shadow-md shadow-rose-500/20"
              >
                {scanning ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Scanning in Progress...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5" />
                    <span>{postLimit === 0 ? 'Scan All Page Posts' : `Scan ${postLimit} Posts`}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results & Action Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-slate-900/70 backdrop-blur-xl overflow-hidden shadow-sm dark:shadow-xl">
        {/* Table Tabs & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950/40 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('flagged')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                activeTab === 'flagged'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
              }`}
            >
              Flagged Spam ({flaggedCount})
            </button>
            <button
              onClick={() => setActiveTab('deleted')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                activeTab === 'deleted'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
              }`}
            >
              Cleaned History ({deletedCount})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
              }`}
            >
              All Scanned ({comments.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search comments or users..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-44 sm:w-56 transition"
              />
            </div>

            {/* Export CSV button */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={comments.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 disabled:opacity-40"
              title="Download full spam report as CSV"
            >
              <Download className="h-3.5 w-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchComments}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between px-5 py-2.5 bg-rose-50/90 dark:bg-rose-950/40 border-b border-rose-200/80 dark:border-rose-900/40 text-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-rose-600 text-white font-bold text-[10px]">
                {selectedIds.length}
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Selected comment{selectedIds.length > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setSelectedIds([])}
                className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 ml-2 underline"
              >
                Deselect All
              </button>
            </div>

            <button
              onClick={handleBatchDelete}
              disabled={isBatchDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {isBatchDeleting ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
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
        )}

        {/* Comments Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-white/[0.08] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={selectableComments.length === 0}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer disabled:opacity-30"
                  />
                </th>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Spam Comment Message</th>
                <th className="px-5 py-3.5">Triggers</th>
                <th className="px-5 py-3.5">Post Context</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-white/[0.06] text-slate-700 dark:text-slate-300">
              {filteredComments.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const isFlagged = item.status === 'flagged';

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition ${
                      isSelected ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        disabled={!isFlagged}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer disabled:opacity-30"
                      />
                    </td>

                    {/* From User */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                          {item.fromName.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {item.fromName}
                        </span>
                      </div>
                    </td>

                    {/* Message */}
                    <td className="px-5 py-3.5 max-w-md font-sans text-xs">
                      <div className="text-slate-800 dark:text-slate-200 leading-snug break-words">
                        {highlightSpamText(item.message, item.spamReasons, currentKeywords)}
                      </div>
                    </td>

                    {/* Triggers */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.spamReasons.map((reason) => {
                          if (reason === 'link') {
                            return (
                              <span
                                key="link"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              >
                                <LinkIcon className="h-2.5 w-2.5" /> Link
                              </span>
                            );
                          }
                          if (reason === 'phone') {
                            return (
                              <span
                                key="phone"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              >
                                <Phone className="h-2.5 w-2.5" /> Phone
                              </span>
                            );
                          }
                          return (
                            <span
                              key="keyword"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                            >
                              <Tag className="h-2.5 w-2.5" /> Keyword
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Post context */}
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs max-w-xs truncate">
                      <a
                        href={`https://www.facebook.com/${item.postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                      >
                        <span>{item.postMessage || item.postId}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {isFlagged ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteSingle(item.id)}
                          disabled={deletingId === item.id}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 hover:text-rose-600 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition disabled:opacity-50"
                          title="Delete this comment now"
                        >
                          {deletingId === item.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Cleaned
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredComments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 space-y-2">
                    <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      No {activeTab} spam comments found.
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Run &quot;Scan for Spam Comments&quot; above to inspect recent posts for link spam and scam bots.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
