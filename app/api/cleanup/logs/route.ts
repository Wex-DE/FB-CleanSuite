import { NextResponse } from 'next/server';
import { readRecentLogs, clearLogs } from '@/server/logger/logger';
import { isAllowedOrigin } from '@/server/security/origin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(10, Number(searchParams.get('limit') || 100)));
  const logs = readRecentLogs(limit);
  return NextResponse.json({ logs });
}

export async function DELETE(req: Request) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden cross-origin request' }, { status: 403 });
  }

  clearLogs();
  return NextResponse.json({ success: true, message: 'Logs cleared successfully' });
}
