import React, { useState, useEffect } from 'react';
import { Settings, Play, Pause, Square, Clock, Loader2, Info } from 'lucide-react';
import { WorkerState } from '@/server/types';

interface WorkerControlCardProps {
  worker: WorkerState | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSetDelay: (seconds: number) => void;
  disabled?: boolean;
}

export const WorkerControlCard: React.FC<WorkerControlCardProps> = ({
  worker,
  onPause,
  onResume,
  onStop,
  onSetDelay,
  disabled = false,
}) => {
  const status = worker?.status || 'idle';
  const delaySeconds = worker?.currentDelaySeconds || worker?.baseDelaySeconds || 10;
  const isRunning = status === 'running';
  const isPaused = status === 'paused';

  // Format countdown until next action
  const [secondsUntilNext, setSecondsUntilNext] = useState<number | null>(null);

  useEffect(() => {
    if (!worker?.nextActionAt || status !== 'running') {
      setSecondsUntilNext(null);
      return;
    }

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.round((new Date(worker.nextActionAt!).getTime() - Date.now()) / 1000));
      setSecondsUntilNext(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [worker?.nextActionAt, status]);

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/5 bg-white/90 dark:bg-slate-900/60 p-6 backdrop-blur-xl shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-5 border-b border-slate-200/80 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Worker Control
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Manage automatic deletion process
              </p>
            </div>
          </div>

          <div>
            {isRunning ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Running
              </span>
            ) : isPaused ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Paused
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700/60">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                Idle
              </span>
            )}
          </div>
        </div>

        {/* Current Activity Box */}
        <div className="py-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
              {isRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                  <span>Deleting posts automatically...</span>
                </>
              ) : isPaused ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-amber-500" />
                  <span>Worker paused</span>
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Worker standing by</span>
                </>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {isRunning && secondsUntilNext !== null ? (
                <>
                  Next deletion in{' '}
                  <span className="text-blue-600 dark:text-blue-400 font-bold">{secondsUntilNext} seconds</span>
                </>
              ) : (
                worker?.currentActionDescription || 'Select an action below to start discovery or cleanup.'
              )}
            </p>
          </div>
        </div>

        {/* Pause / Resume / Stop Controls */}
        <div className="grid grid-cols-2 gap-3 pb-4">
          {isRunning ? (
            <button
              onClick={onPause}
              disabled={disabled}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 py-2.5 px-4 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition active:scale-95 disabled:opacity-50 shadow-sm"
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
          ) : isPaused ? (
            <button
              onClick={onResume}
              disabled={disabled}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 py-2.5 px-4 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition active:scale-95 disabled:opacity-50 shadow-sm"
            >
              <Play className="h-4 w-4" />
              Resume
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 py-2.5 px-4 text-xs font-medium text-slate-400">
              <Play className="h-4 w-4 opacity-50" />
              Ready
            </div>
          )}

          <button
            onClick={onStop}
            disabled={disabled || (!isRunning && !isPaused)}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 py-2.5 px-4 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 transition active:scale-95 disabled:opacity-30 shadow-sm"
          >
            <Square className="h-4 w-4" />
            Stop
          </button>
        </div>
      </div>

      {/* Delay Selector & Safety Modes */}
      <div className="pt-3 border-t border-slate-200/80 dark:border-white/5 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-500" />
            Deletion Speed Mode:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { sec: 1, label: 'Turbo 1s' },
              { sec: 5, label: 'Fast 5s' },
              { sec: 10, label: 'Safe 10s' },
              { sec: 30, label: 'Ghost 30s' },
            ].map(({ sec, label }) => (
              <button
                key={sec}
                onClick={() => onSetDelay(sec)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  delaySeconds === sec
                    ? sec >= 10
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px]">
          {delaySeconds >= 10 ? (
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Safe Mode Active: Recommended by Meta Rate Limit Guidelines (zero throttling risk).
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              High Speed Mode Active: Best for quick small batches.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
