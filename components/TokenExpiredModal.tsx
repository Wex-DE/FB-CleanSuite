import React, { useState } from 'react';
import { AlertTriangle, Key, ExternalLink, CheckCircle2, X } from 'lucide-react';

interface TokenExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenUpdated: () => void;
  errorMessage?: string;
  isPausedDueToExpiry?: boolean;
}

export const TokenExpiredModal: React.FC<TokenExpiredModalProps> = ({
  isOpen,
  onClose,
  onTokenUpdated,
  errorMessage,
  isPausedDueToExpiry = true,
}) => {
  const [newToken, setNewToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToken.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: newToken.trim() }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        // Fallback for non-JSON responses
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server returned error (${res.status}). Please check your token.`);
      }

      setSuccess('Access token refreshed successfully! Resuming cleanup...');
      setTimeout(() => {
        setNewToken('');
        setSuccess(null);
        onTokenUpdated();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to update token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-rose-500/30 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex-shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Meta Graph API Access Token Expired
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your session expired or token became invalid. {isPausedDueToExpiry && 'The deletion worker has been safely paused to prevent failed requests.'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600 dark:text-rose-400 font-mono">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Paste Fresh User or Page Access Token
              </label>
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>Get Token via Explorer</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type="password"
                placeholder="EAA..."
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <Key className="absolute right-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-400">
              Generating a token with <code className="text-slate-700 dark:text-slate-300 font-semibold">pages_manage_posts</code> permission will immediately restore cleanup.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !newToken.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Verifying Token...</span>
                </>
              ) : (
                <span>Renew Token & Resume Cleanup</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
