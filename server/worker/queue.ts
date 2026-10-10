import fs from 'fs';
import path from 'path';
import { QueueState, QueueItem, QueueItemStatus } from '../types';
import { getAuthSession } from '../security/secrets';

const DATA_DIR = path.join(process.cwd(), 'data');
const QUEUES_DIR = path.join(DATA_DIR, 'queues');
const LEGACY_QUEUE_FILE = path.join(DATA_DIR, 'queue.json');

// Ensure queues directory exists
if (!fs.existsSync(QUEUES_DIR)) {
  fs.mkdirSync(QUEUES_DIR, { recursive: true });
}

export function getQueueFilePath(pageId?: string): string {
  const activePageId = pageId || getAuthSession()?.selectedPageId;
  if (!activePageId) {
    return LEGACY_QUEUE_FILE;
  }
  return path.join(QUEUES_DIR, `${activePageId}.json`);
}

export function getQueueState(pageId?: string): QueueState | null {
  try {
    const activePageId = pageId || getAuthSession()?.selectedPageId;
    if (!activePageId) {
      return null;
    }
    const filePath = path.join(QUEUES_DIR, `${activePageId}.json`);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }

    // Check if legacy queue file exists and matches the active page
    if (fs.existsSync(LEGACY_QUEUE_FILE)) {
      const legacyContent = fs.readFileSync(LEGACY_QUEUE_FILE, 'utf8');
      const parsed: QueueState = JSON.parse(legacyContent);
      if (parsed.pageId === activePageId) {
        if (parsed.pageId) {
          saveQueueState(parsed);
        }
        return parsed;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function saveQueueState(state: QueueState): void {
  state.updatedAt = new Date().toISOString();
  state.totalDiscovered = state.items.length;

  const targetFile = path.join(QUEUES_DIR, `${state.pageId}.json`);
  const tmpFile = `${targetFile}.tmp.${Date.now()}`;
  const backupFile = path.join(QUEUES_DIR, `${state.pageId}.backup.json`);

  const jsonStr = JSON.stringify(state, null, 2);
  try {
    fs.writeFileSync(tmpFile, jsonStr, 'utf8');
    try {
      fs.renameSync(tmpFile, targetFile);
    } catch {
      // On Windows when the file is briefly locked by another handle, fallback to direct write
      fs.writeFileSync(targetFile, jsonStr, 'utf8');
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch {}
    }
  } catch {
    fs.writeFileSync(targetFile, jsonStr, 'utf8');
  }

  // Maintain safety backup
  try {
    fs.writeFileSync(backupFile, jsonStr, 'utf8');
  } catch {
    // backup write failure is non-fatal
  }
}

export function initializeQueue(
  pageId: string,
  pageName: string,
  items: Array<{ id: string; created_time?: string; message?: string }>
): QueueState {
  const now = new Date().toISOString();
  const existingQueue = getQueueState(pageId);
  const existingMap = new Map<string, QueueItem>();
  if (existingQueue && Array.isArray(existingQueue.items)) {
    for (const item of existingQueue.items) {
      existingMap.set(item.postId, item);
    }
  }

  const queueItems: QueueItem[] = items.map((item) => {
    const existing = existingMap.get(item.id);
    if (existing) {
      // Preserve existing status (e.g. 'deleted', 'failed', attempts, etc.)
      return {
        ...existing,
        createdTime: existing.createdTime || item.created_time,
        messageSnippet: existing.messageSnippet || (item.message ? item.message.slice(0, 80) : undefined),
      };
    }

    return {
      postId: item.id,
      createdTime: item.created_time,
      messageSnippet: item.message ? item.message.slice(0, 80) : undefined,
      status: 'pending',
      attempts: 0,
      discoveredAt: now,
    };
  });

  const queueState: QueueState = {
    pageId,
    pageName,
    createdAt: existingQueue?.createdAt || now,
    updatedAt: now,
    totalDiscovered: queueItems.length,
    items: queueItems,
  };

  saveQueueState(queueState);
  return queueState;
}

export function updateQueueItemStatus(
  postId: string,
  status: QueueItemStatus,
  details?: {
    pageId?: string;
    httpStatus?: number;
    errorCode?: string;
    errorMessage?: string;
    nextEligibleAt?: string;
    incrementAttempt?: boolean;
  }
): QueueItem | null {
  const queue = getQueueState(details?.pageId);
  if (!queue) return null;

  const itemIndex = queue.items.findIndex((i) => i.postId === postId);
  if (itemIndex === -1) return null;

  const item = queue.items[itemIndex];
  item.status = status;
  item.lastAttemptAt = new Date().toISOString();

  // Only increment attempt counter when an actual API attempt completes, not on marking 'processing'
  const shouldIncrement =
    details?.incrementAttempt !== undefined
      ? details.incrementAttempt
      : status !== 'processing';

  if (shouldIncrement) {
    item.attempts += 1;
  }

  if (details) {
    if (details.httpStatus !== undefined) item.lastHttpStatus = details.httpStatus;
    if (details.errorCode !== undefined) item.lastErrorCode = details.errorCode;
    if (details.errorMessage !== undefined) item.lastErrorMessage = details.errorMessage;
    if (details.nextEligibleAt !== undefined) item.nextEligibleAt = details.nextEligibleAt;
  }

  saveQueueState(queue);
  return item;
}

export function getNextPendingItem(pageId?: string): QueueItem | null {
  const queue = getQueueState(pageId);
  if (!queue) return null;

  const now = new Date().toISOString();
  return (
    queue.items.find((item) => {
      if (item.status !== 'pending') return false;
      if (item.nextEligibleAt && item.nextEligibleAt > now) return false;
      return true;
    }) || null
  );
}

export function getQueueStats(pageId?: string): {
  total: number;
  pending: number;
  deleted: number;
  failed: number;
  skipped: number;
  unknown: number;
} {
  const queue = getQueueState(pageId);
  if (!queue) {
    return { total: 0, pending: 0, deleted: 0, failed: 0, skipped: 0, unknown: 0 };
  }

  let pending = 0;
  let deleted = 0;
  let failed = 0;
  let skipped = 0;
  let unknown = 0;

  for (const item of queue.items) {
    switch (item.status) {
      case 'pending':
      case 'processing':
        pending++;
        break;
      case 'deleted':
        deleted++;
        break;
      case 'failed':
        failed++;
        break;
      case 'skipped':
        skipped++;
        break;
      case 'unknown':
        unknown++;
        break;
    }
  }

  return {
    total: queue.items.length,
    pending,
    deleted,
    failed,
    skipped,
    unknown,
  };
}

/**
 * Reverts any items previously marked as failed or processing due to an expired access token
 * back to 'pending' so they can be processed once a valid token is provided.
 */
export function requeueExpiredTokenFailedItems(pageId?: string): number {
  const queue = getQueueState(pageId);
  if (!queue) return 0;

  let recoveredCount = 0;
  for (const item of queue.items) {
    const errorMsg = item.lastErrorMessage || '';
    const isTokenFailure =
      errorMsg.includes('Session has expired') ||
      errorMsg.includes('Error validating access token') ||
      errorMsg.includes('Session is invalid') ||
      item.lastErrorCode === '190';

    if ((item.status === 'failed' || item.status === 'processing') && isTokenFailure) {
      item.status = 'pending';
      item.lastErrorMessage = undefined;
      item.lastErrorCode = undefined;
      item.nextEligibleAt = undefined;
      recoveredCount++;
    }
  }

  if (recoveredCount > 0) {
    saveQueueState(queue);
  }

  return recoveredCount;
}
