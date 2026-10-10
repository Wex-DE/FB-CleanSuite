import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  pageName: string;
  totalPosts: number;
  mode: 'test' | 'full';
  testCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  pageName,
  totalPosts,
  mode,
  testCount = 5,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-white dark:bg-slate-900 p-6 shadow-2xl text-slate-800 dark:text-slate-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 text-red-500">
            <div className="rounded-full bg-red-500/10 p-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {mode === 'full' ? 'Confirm Full Page Cleanup' : `Confirm Test Deletion (${testCount} posts)`}
              </h2>
              <p className="text-xs text-red-500 font-medium">Permanent Action Warning</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Target Facebook Page</div>
            <div className="text-base font-semibold text-slate-900 dark:text-white mt-0.5">{pageName}</div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {mode === 'full' ? (
                <>Eligible posts scheduled for deletion: <span className="font-semibold text-slate-900 dark:text-white">{totalPosts.toLocaleString()}</span></>
              ) : (
                <>Batch limit: <span className="font-semibold text-slate-900 dark:text-white">{testCount} posts</span></>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            This action will call Meta&apos;s official Graph API endpoint <code className="text-red-500 font-mono">DELETE /&#123;post-id&#125;</code> for each post.
            Deleted posts cannot be recovered by this application or by Meta Support.
          </p>

          <p className="text-xs text-amber-600 dark:text-amber-300 font-medium">
            Deletion will proceed conservatively one post at a time. You can Pause or Stop the worker anytime.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-red-600/30 hover:bg-red-500 transition active:scale-95"
          >
            {mode === 'full' ? 'Yes, Start Full Cleanup' : `Yes, Delete ${testCount} Test Posts`}
          </button>
        </div>
      </div>
    </div>
  );
};
