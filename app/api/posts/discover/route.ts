import { NextResponse } from 'next/server';
import { discoverPagePosts } from '@/server/meta/posts';
import { getQueueState } from '@/server/worker/queue';
import { isAllowedOrigin } from '@/server/security/origin';
import { deletionWorker } from '@/server/worker/deletionWorker';

export async function GET() {
  const queue = getQueueState();
  return NextResponse.json({
    queue: queue || { items: [], totalDiscovered: 0 },
  });
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden cross-origin request' }, { status: 403 });
  }

  try {
    let maxLimit = 5000;
    let startDate: string | undefined;
    let endDate: string | undefined;
    let sortOrder: 'oldest_first' | 'newest_first' = 'oldest_first';

    try {
      const body = await req.json();
      if (body.limit) maxLimit = Number(body.limit);
      if (body.startDate) startDate = body.startDate;
      if (body.endDate) endDate = body.endDate;
      if (body.sortOrder) sortOrder = body.sortOrder;
    } catch {
      // Body is optional
    }

    const queue = await discoverPagePosts({ maxLimit, startDate, endDate, sortOrder });
    deletionWorker.refreshStats(queue.pageId);
    return NextResponse.json({
      success: true,
      totalDiscovered: queue.totalDiscovered,
      queue,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to discover posts' },
      { status: 400 }
    );
  }
}
