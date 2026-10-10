import { NextResponse } from 'next/server';
import { fetchUserManagedPages, selectPageById } from '@/server/meta/pages';
import { deletionWorker } from '@/server/worker/deletionWorker';
import { isAllowedOrigin } from '@/server/security/origin';

export async function GET() {
  try {
    const pages = await fetchUserManagedPages();
    return NextResponse.json({ pages });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch pages' },
      { status: 400 }
    );
  }
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden cross-origin request' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const pageId = body.pageId;

    if (!pageId) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
    }

    const selected = await selectPageById(pageId);
    deletionWorker.switchPageContext(pageId);
    return NextResponse.json({
      success: true,
      page: selected,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to select page' },
      { status: 400 }
    );
  }
}
