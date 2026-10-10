import {
  getPersistedWorkerState,
  savePersistedWorkerState,
} from './state';
import {
  getNextPendingItem,
  updateQueueItemStatus,
  getQueueStats,
  getQueueState,
} from './queue';
import { BackoffManager } from './backoff';
import { deletePagePost } from '../meta/deletePost';
import { writeLog } from '../logger/logger';
import { WorkerState } from '../types';
import { getAuthSession } from '../security/secrets';

class DeletionWorker {
  private state: WorkerState;
  private backoffManager: BackoffManager;
  private isProcessing = false;
  private loopTimeout: NodeJS.Timeout | null = null;
  private processedInSession = 0;
  private currentPageId: string | null = null;

  constructor() {
    const session = getAuthSession();
    this.currentPageId = session?.selectedPageId || null;
    this.state = getPersistedWorkerState(this.currentPageId || undefined);
    this.backoffManager = new BackoffManager(this.state.baseDelaySeconds || 10);

    // Crash recovery: check if previous execution stopped unexpectedly
    this.recoverFromCrash();
  }

  public switchPageContext(newPageId: string): void {
    if (this.currentPageId === newPageId) return;

    // Stop current processing loop cleanly if running
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }
    this.isProcessing = false;
    this.currentPageId = newPageId;
    this.state = getPersistedWorkerState(newPageId);
    this.state.stats = getQueueStats(newPageId);
    this.backoffManager = new BackoffManager(this.state.baseDelaySeconds || 10);
    this.saveState();
    writeLog('info', 'WORKER', `Worker switched context to Page: ${newPageId}`);
  }

  private recoverFromCrash(): void {
    const queue = getQueueState(this.currentPageId || undefined);
    if (queue) {
      let recoveredCount = 0;
      for (const item of queue.items) {
        if (item.status === 'processing') {
          // If marked processing on restart, mark unknown conservatively as required by spec
          updateQueueItemStatus(item.postId, 'unknown', {
            pageId: this.currentPageId || undefined,
            errorMessage: 'Interrupted during previous session. Status marked unknown for safety.',
          });
          recoveredCount++;
        }
      }
      if (recoveredCount > 0) {
        writeLog('warn', 'WORKER', `Crash recovery: marked ${recoveredCount} processing items as 'unknown'`);
      }
    }

    // If state was running, move to paused/stopped on app restart
    if (this.state.status === 'running') {
      this.state.status = 'paused';
      this.state.currentActionDescription = 'Paused after restart. Ready to resume.';
      this.saveState();
    }
  }

  private saveState(): void {
    this.state.stats = getQueueStats(this.currentPageId || undefined);
    savePersistedWorkerState(this.state, this.currentPageId || undefined);
  }

  public resetContext(): void {
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }
    this.isProcessing = false;
    this.currentPageId = null;
    this.state = {
      status: 'idle',
      mode: 'dry_run',
      currentActionDescription: 'Idle - ready to start',
      currentDelaySeconds: 10,
      baseDelaySeconds: 10,
      backoffLevel: 0,
      consecutiveFailures: 0,
      stats: { total: 0, pending: 0, deleted: 0, failed: 0, skipped: 0, unknown: 0 },
    };
    writeLog('info', 'WORKER', 'Worker context cleared on logout/disconnect');
  }

  public refreshStats(pageId?: string): void {
    const targetPageId = pageId || this.currentPageId || getAuthSession()?.selectedPageId;
    if (targetPageId) {
      this.state.stats = getQueueStats(targetPageId);
      this.saveState();
    }
  }

  public resetTokenExpired(): void {
    this.state.tokenExpired = false;
    this.state.tokenExpiryMessage = undefined;
    if (this.state.status === 'paused' && this.state.currentActionDescription.includes('Token')) {
      this.state.currentActionDescription = 'Token refreshed. Worker paused and ready to resume.';
    }
    this.saveState();
    writeLog('info', 'WORKER', 'Token expired state cleared in worker.');
  }

  public getState(): WorkerState {
    const session = getAuthSession();
    const activePageId = session?.selectedPageId || null;

    if (!activePageId) {
      return {
        status: 'idle',
        mode: 'dry_run',
        currentActionDescription: 'No page connected',
        currentDelaySeconds: 10,
        baseDelaySeconds: 10,
        backoffLevel: 0,
        consecutiveFailures: 0,
        stats: { total: 0, pending: 0, deleted: 0, failed: 0, skipped: 0, unknown: 0 },
      };
    }

    if (this.currentPageId !== activePageId) {
      this.switchPageContext(activePageId);
    } else {
      this.state.stats = getQueueStats(activePageId);
    }

    return { ...this.state };
  }

  public setBaseDelay(seconds: number): void {
    const safeSeconds = Math.max(1, seconds);
    this.state.baseDelaySeconds = safeSeconds;
    this.backoffManager.setBaseDelay(safeSeconds);
    this.state.currentDelaySeconds = this.backoffManager.getCurrentDelay();
    this.saveState();
    writeLog('info', 'WORKER', `Configured delay updated to ${safeSeconds}s`);
  }

  public async start(mode: 'dry_run' | 'test' | 'full', testLimit = 5): Promise<WorkerState> {
    if (this.state.status === 'running') {
      return this.getState();
    }

    const session = getAuthSession();
    if (session?.selectedPageId && this.currentPageId !== session.selectedPageId) {
      this.switchPageContext(session.selectedPageId);
    }

    this.state.status = 'running';
    this.state.mode = mode;
    this.state.testLimit = mode === 'test' ? testLimit : undefined;
    this.processedInSession = 0;
    this.state.currentActionDescription = `Starting worker in ${mode} mode...`;
    this.saveState();

    writeLog('info', 'WORKER', `Worker started in mode: ${mode}`);

    this.scheduleNext(100);
    return this.getState();
  }

  public pause(): WorkerState {
    this.state.status = 'paused';
    this.state.currentActionDescription = 'Worker paused by user.';
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }
    this.saveState();
    writeLog('info', 'WORKER', 'Worker paused by user.');
    return this.getState();
  }

  public resume(): WorkerState {
    if (this.state.status === 'running') {
      return this.getState();
    }

    const session = getAuthSession();
    if (session?.selectedPageId && this.currentPageId !== session.selectedPageId) {
      this.switchPageContext(session.selectedPageId);
    }

    this.state.status = 'running';
    this.state.currentActionDescription = 'Worker resumed.';
    this.saveState();
    writeLog('info', 'WORKER', 'Worker resumed by user.');

    this.scheduleNext(100);
    return this.getState();
  }

  public stop(): WorkerState {
    this.state.status = 'stopped';
    this.state.currentActionDescription = 'Worker stopped by user.';
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }
    this.isProcessing = false;
    this.state.currentPostId = undefined;
    this.state.nextActionAt = undefined;
    this.saveState();
    writeLog('info', 'WORKER', 'Worker stopped by user.');
    return this.getState();
  }

  private scheduleNext(delayMs: number): void {
    if (this.loopTimeout) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }

    if (this.state.status !== 'running') {
      return;
    }

    this.state.nextActionAt = new Date(Date.now() + delayMs).toISOString();
    this.saveState();

    this.loopTimeout = setTimeout(() => {
      this.processNext();
    }, delayMs);
  }

  private async processNext(): Promise<void> {
    if (this.state.status !== 'running' || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Check test limit
      if (this.state.mode === 'test' && this.state.testLimit && this.processedInSession >= this.state.testLimit) {
        this.state.status = 'completed';
        this.state.currentActionDescription = `Test mode complete: processed ${this.processedInSession} test items.`;
        this.saveState();
        writeLog('success', 'WORKER', `Test mode finished after ${this.processedInSession} deletions.`);
        this.isProcessing = false;
        return;
      }

      // In dry run mode, no deletion occurs; worker simply marks complete
      if (this.state.mode === 'dry_run') {
        this.state.status = 'completed';
        this.state.currentActionDescription = 'Dry Run complete. Queue inspected with 0 deletions performed.';
        this.saveState();
        writeLog('info', 'WORKER', 'Dry Run finished. No posts were modified.');
        this.isProcessing = false;
        return;
      }

      const item = getNextPendingItem(this.currentPageId || undefined);
      if (!item) {
        this.state.status = 'completed';
        this.state.currentActionDescription = 'Cleanup complete! No more pending posts in queue.';
        this.state.currentPostId = undefined;
        this.saveState();
        writeLog('success', 'WORKER', 'All eligible posts in queue have been processed.');
        this.isProcessing = false;
        return;
      }

      // Mark processing in queue and persist immediately
      this.state.currentPostId = item.postId;
      this.state.currentActionDescription = `Deleting post: ${item.postId}...`;
      updateQueueItemStatus(item.postId, 'processing', { pageId: this.currentPageId || undefined });
      this.saveState();

      // Perform single conservative deletion
      const result = await deletePagePost(item.postId);

      if (result.success) {
        updateQueueItemStatus(item.postId, 'deleted', {
          pageId: this.currentPageId || undefined,
          httpStatus: result.httpStatus,
        });
        this.processedInSession++;

        const decision = this.backoffManager.recordSuccess();
        this.state.currentDelaySeconds = decision.delaySeconds;
        this.state.backoffLevel = this.backoffManager.getBackoffLevel();
        this.state.consecutiveFailures = 0;
        this.state.currentActionDescription = `Deleted post ${item.postId}. Next action in ${decision.delaySeconds}s.`;
        this.saveState();

        this.isProcessing = false;
        this.scheduleNext(decision.delaySeconds * 1000);
        return;
      }

      // Access Token Expiration handling - immediately pause and halt loop
      if (result.tokenExpired) {
        // Revert post back to pending so it can be retried with the new token
        updateQueueItemStatus(item.postId, 'pending', {
          pageId: this.currentPageId || undefined,
          httpStatus: result.httpStatus,
          errorCode: 'TOKEN_EXPIRED',
          errorMessage: result.errorMessage || 'Access token expired or session invalidated.',
        });

        this.state.status = 'paused';
        this.state.tokenExpired = true;
        this.state.tokenExpiryMessage = result.errorMessage || 'Meta Access Token has expired. Please refresh your token to resume.';
        this.state.currentActionDescription = 'Paused: Access token expired. Update token to continue.';
        this.state.currentPostId = undefined;
        this.saveState();

        writeLog('error', 'WORKER', `Cleanup halted: ${this.state.tokenExpiryMessage}`);

        if (this.loopTimeout) {
          clearTimeout(this.loopTimeout);
          this.loopTimeout = null;
        }

        this.isProcessing = false;
        return;
      }

      // Rate limit / Throttling handling
      if (result.rateLimited) {
        const decision = this.backoffManager.recordRateLimit(result.rateLimitCode || 429, result.errorMessage || 'Throttled');
        const nextEligible = new Date(Date.now() + decision.delaySeconds * 1000).toISOString();

        updateQueueItemStatus(item.postId, 'pending', {
          pageId: this.currentPageId || undefined,
          httpStatus: result.httpStatus,
          errorCode: String(result.rateLimitCode || 'RATE_LIMIT'),
          errorMessage: result.errorMessage,
          nextEligibleAt: nextEligible,
        });

        this.state.currentDelaySeconds = decision.delaySeconds;
        this.state.backoffLevel = this.backoffManager.getBackoffLevel();
        this.state.consecutiveFailures = this.backoffManager.getConsecutiveFailures();

        if (decision.action === 'pause_worker') {
          this.state.status = 'paused';
          this.state.currentActionDescription = decision.reason;
          this.saveState();
          this.isProcessing = false;
          return;
        }

        this.state.currentActionDescription = decision.reason;
        this.saveState();
        this.isProcessing = false;
        this.scheduleNext(decision.delaySeconds * 1000);
        return;
      }

      // Permanent non-retryable error (e.g. 404 Not Found, 400 Unsupported request)
      if (result.unsupported || (!result.transient && !result.rateLimited)) {
        const isNotDeletable = result.errorMessage?.includes('not support delete') || result.errorMessage?.includes('cannot be deleted');
        const newStatus = isNotDeletable ? 'skipped' : 'failed';

        updateQueueItemStatus(item.postId, newStatus, {
          pageId: this.currentPageId || undefined,
          httpStatus: result.httpStatus,
          errorCode: 'PERMANENT_ERROR',
          errorMessage: result.errorMessage,
        });

        writeLog(
          isNotDeletable ? 'warn' : 'error',
          'DELETION',
          `Post ${item.postId} marked as ${newStatus}: ${result.errorMessage}`
        );

        this.processedInSession++;
        this.state.currentActionDescription = `Post ${item.postId} ${newStatus}: ${result.errorMessage}`;
        this.saveState();

        this.isProcessing = false;
        this.scheduleNext(this.state.baseDelaySeconds * 1000);
        return;
      }

      // Transient failure (5xx or network glitch)
      const decision = this.backoffManager.recordTransientError(result.httpStatus, result.errorMessage || 'Unknown error');
      const maxRetries = 3;

      if (item.attempts >= maxRetries) {
        updateQueueItemStatus(item.postId, 'failed', {
          pageId: this.currentPageId || undefined,
          httpStatus: result.httpStatus,
          errorCode: 'MAX_RETRIES_EXCEEDED',
          errorMessage: `Exceeded max retry attempts (${maxRetries}). Last error: ${result.errorMessage}`,
        });
        writeLog('error', 'DELETION', `Post ${item.postId} permanently failed after ${maxRetries} attempts.`);
      } else {
        const nextEligible = new Date(Date.now() + decision.delaySeconds * 1000).toISOString();
        updateQueueItemStatus(item.postId, 'pending', {
          pageId: this.currentPageId || undefined,
          httpStatus: result.httpStatus,
          errorCode: 'TEMPORARY_ERROR',
          errorMessage: result.errorMessage,
          nextEligibleAt: nextEligible,
        });
        writeLog('warn', 'DELETION', `Post ${item.postId} failed (attempt ${item.attempts + 1}). Retrying in ${decision.delaySeconds}s.`);
      }

      this.state.currentDelaySeconds = decision.delaySeconds;
      this.state.backoffLevel = this.backoffManager.getBackoffLevel();
      this.state.consecutiveFailures = this.backoffManager.getConsecutiveFailures();

      if (decision.action === 'pause_worker') {
        this.state.status = 'paused';
        this.state.currentActionDescription = decision.reason;
        this.saveState();
        this.isProcessing = false;
        return;
      }

      this.state.currentActionDescription = decision.reason;
      this.saveState();
      this.isProcessing = false;
      this.scheduleNext(decision.delaySeconds * 1000);
    } catch (err: any) {
      writeLog('error', 'WORKER', `Unexpected loop error: ${err.message}`);
      this.state.status = 'error';
      this.state.currentActionDescription = `Worker error: ${err.message}`;
      this.saveState();
      this.isProcessing = false;
    }
  }
}

// Singleton worker instance
export const deletionWorker = new DeletionWorker();
