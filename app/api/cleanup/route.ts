import { NextResponse } from 'next/server';
import { deletionWorker } from '@/server/worker/deletionWorker';
import { getQueueState } from '@/server/worker/queue';
import { isAllowedOrigin } from '@/server/security/origin';
import { getAuthSession } from '@/server/security/secrets';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status') || 'mixed';
  const sort = url.searchParams.get('sort') || 'oldest_first'; // 'oldest_first' | 'newest_first'
  const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 5000);

  const session = getAuthSession();
  const selectedPageId = session?.selectedPageId;

  if (!selectedPageId) {
    return NextResponse.json({
      worker: {
        status: 'idle',
        mode: 'dry_run',
        currentActionDescription: 'No page connected',
        currentDelaySeconds: 10,
        baseDelaySeconds: 10,
        backoffLevel: 0,
        consecutiveFailures: 0,
        stats: { total: 0, pending: 0, deleted: 0, failed: 0, skipped: 0, unknown: 0 },
      },
      queue: {
        totalDiscovered: 0,
        totalFiltered: 0,
        currentFilter: statusFilter,
        currentSort: sort,
        earliestPostDate: null,
        latestPostDate: null,
        recentItems: [],
      },
    });
  }

  const workerState = deletionWorker.getState();
  const queue = getQueueState(selectedPageId);

  let allItems = queue?.items ? [...queue.items] : [];

  // Calculate earliest and latest post dates from entire queue
  let earliestPostDate: string | null = null;
  let latestPostDate: string | null = null;
  if (allItems.length > 0) {
    const validDates = allItems
      .map((i) => i.createdTime)
      .filter(Boolean) as string[];
    if (validDates.length > 0) {
      const sortedDates = [...validDates].sort();
      earliestPostDate = sortedDates[0].split('T')[0];
      latestPostDate = sortedDates[sortedDates.length - 1].split('T')[0];
    }
  }

  // Filter items by requested status
  let filteredItems: typeof allItems = [];
  if (statusFilter === 'deleted') {
    filteredItems = allItems.filter((i) => i.status === 'deleted');
  } else if (statusFilter === 'failed') {
    filteredItems = allItems.filter(
      (i) => i.status === 'failed' || i.status === 'skipped' || i.status === 'unknown'
    );
  } else if (statusFilter === 'pending') {
    filteredItems = allItems.filter((i) => i.status === 'pending' || i.status === 'processing');
  } else if (statusFilter === 'all') {
    filteredItems = allItems;
  } else {
    // Default 'mixed': include ALL processed items (deleted, failed, processing) and top pending items
    const processed = allItems.filter((i) => i.status !== 'pending');
    const pending = allItems
      .filter((i) => i.status === 'pending')
      .slice(0, Math.max(100, limit - processed.length));
    filteredItems = [...processed, ...pending];
  }

  // Sort items according to requested sort
  filteredItems.sort((a, b) => {
    const timeA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
    const timeB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
    if (sort === 'oldest_first') {
      return timeA - timeB;
    } else {
      return timeB - timeA;
    }
  });

  return NextResponse.json({
    worker: workerState,
    queue: {
      pageId: queue?.pageId,
      pageName: queue?.pageName,
      totalDiscovered: queue?.totalDiscovered || 0,
      totalFiltered: filteredItems.length,
      currentFilter: statusFilter,
      currentSort: sort,
      earliestPostDate,
      latestPostDate,
      counts: {
        pending: workerState.stats.pending,
        deleted: workerState.stats.deleted,
        failed: workerState.stats.failed + workerState.stats.skipped + workerState.stats.unknown,
        all: workerState.stats.total || allItems.length,
      },
      recentItems: filteredItems.slice(0, limit),
    },
  });
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden cross-origin request' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = body.action; // 'start' | 'pause' | 'resume' | 'stop' | 'set_delay'

    switch (action) {
      case 'start': {
        const mode = body.mode || 'dry_run'; // 'dry_run' | 'test' | 'full'
        const testLimit = body.testLimit ? Number(body.testLimit) : 5;
        const state = await deletionWorker.start(mode, testLimit);
        return NextResponse.json({ success: true, worker: state });
      }

      case 'pause': {
        const state = deletionWorker.pause();
        return NextResponse.json({ success: true, worker: state });
      }

      case 'resume': {
        const state = deletionWorker.resume();
        return NextResponse.json({ success: true, worker: state });
      }

      case 'stop': {
        const state = deletionWorker.stop();
        return NextResponse.json({ success: true, worker: state });
      }

      case 'set_delay': {
        const delaySeconds = Number(body.delaySeconds);
        if (isNaN(delaySeconds) || delaySeconds < 1) {
          return NextResponse.json(
            { error: 'Delay must be at least 1 second' },
            { status: 400 }
          );
        }
        deletionWorker.setBaseDelay(delaySeconds);
        return NextResponse.json({ success: true, worker: deletionWorker.getState() });
      }

      case 'delete_single': {
        const postId = body.postId;
        if (!postId) {
          return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
        }
        const { deletePagePost } = await import('@/server/meta/deletePost');
        const { updateQueueItemStatus } = await import('@/server/worker/queue');
        
        const result = await deletePagePost(postId);
        if (result.success) {
          updateQueueItemStatus(postId, 'deleted', { httpStatus: result.httpStatus });
          deletionWorker.refreshStats();
          return NextResponse.json({ success: true, message: `Successfully deleted post ${postId}` });
        } else {
          updateQueueItemStatus(postId, 'failed', {
            httpStatus: result.httpStatus,
            errorCode: result.rateLimited ? 'RATE_LIMIT' : 'ERROR',
            errorMessage: result.errorMessage,
          });
          deletionWorker.refreshStats();
          return NextResponse.json(
            { success: false, error: result.errorMessage || 'Failed to delete post' },
            { status: 400 }
          );
        }
      }

      case 'delete_batch': {
        const postIds = body.postIds;
        if (!Array.isArray(postIds) || postIds.length === 0) {
          return NextResponse.json({ error: 'postIds array is required' }, { status: 400 });
        }
        const { deletePagePost } = await import('@/server/meta/deletePost');
        const { updateQueueItemStatus } = await import('@/server/worker/queue');

        const results = {
          deleted: [] as string[],
          failed: [] as string[],
        };

        for (const postId of postIds) {
          const result = await deletePagePost(postId);
          if (result.success) {
            updateQueueItemStatus(postId, 'deleted', { httpStatus: result.httpStatus });
            results.deleted.push(postId);
          } else {
            updateQueueItemStatus(postId, 'failed', {
              httpStatus: result.httpStatus,
              errorCode: result.rateLimited ? 'RATE_LIMIT' : 'ERROR',
              errorMessage: result.errorMessage,
            });
            results.failed.push(postId);
          }
          if (postIds.length > 1) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
        deletionWorker.refreshStats();
        return NextResponse.json({ success: true, results });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Worker action failed' }, { status: 500 });
  }
}
