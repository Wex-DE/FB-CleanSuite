// Type definitions for Facebook Page Post Cleanup Tool

export type QueueItemStatus =
  | 'pending'
  | 'processing'
  | 'deleted'
  | 'failed'
  | 'skipped'
  | 'unknown';

export interface QueueItem {
  postId: string;
  createdTime?: string;
  messageSnippet?: string;
  status: QueueItemStatus;
  attempts: number;
  discoveredAt: string;
  lastAttemptAt?: string;
  lastHttpStatus?: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  nextEligibleAt?: string;
}

export interface QueueState {
  pageId: string;
  pageName: string;
  createdAt: string;
  updatedAt: string;
  totalDiscovered: number;
  items: QueueItem[];
}

export type WorkerStateStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'error';

export interface WorkerState {
  status: WorkerStateStatus;
  mode: 'dry_run' | 'test' | 'full';
  testLimit?: number;
  currentPostId?: string;
  currentActionDescription: string;
  nextActionAt?: string;
  currentDelaySeconds: number;
  baseDelaySeconds: number;
  backoffLevel: number;
  consecutiveFailures: number;
  tokenExpired?: boolean;
  tokenExpiryMessage?: string;
  stats: {
    total: number;
    pending: number;
    deleted: number;
    failed: number;
    skipped: number;
    unknown: number;
  };
  lastError?: {
    code: string;
    message: string;
    timestamp: string;
  };
}

export interface PageInfo {
  id: string;
  name: string;
  category?: string;
  tasks?: string[];
  hasDeletePermission: boolean;
  selected: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  category: 'AUTH' | 'DISCOVERY' | 'DELETION' | 'WORKER' | 'BACKOFF' | 'SYSTEM' | 'COMMENTS';
  message: string;
  details?: Record<string, unknown>;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user?: {
    id: string;
    name: string;
  };
  selectedPage?: {
    id: string;
    name: string;
  };
  hasConfiguredApp: boolean;
  tokenExpiresAt?: number;
  tokenExpiresInSeconds?: number | null;
  tokenExpired?: boolean;
  tokenExpiryMessage?: string;
}

export interface GraphApiErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_user_title?: string;
    error_user_msg?: string;
  };
}
