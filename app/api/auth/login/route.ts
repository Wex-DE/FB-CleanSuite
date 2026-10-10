import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildOAuthLoginUrl, importDirectToken } from '@/server/meta/auth';
import { deletionWorker } from '@/server/worker/deletionWorker';

export async function GET(req: NextRequest) {
  try {
    const state = crypto.randomBytes(24).toString('hex');
    const url = buildOAuthLoginUrl(state);

    const wantsJson = req.headers.get('accept')?.includes('application/json');
    if (wantsJson) {
      const res = NextResponse.json({ url });
      res.cookies.set('oauth_state', state, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 300, // 5 minutes
      });
      return res;
    }

    const res = NextResponse.redirect(url);
    res.cookies.set('oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 300,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to generate OAuth URL' },
      { status: 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const result = await importDirectToken(token);
    if (result.type === 'page') {
      deletionWorker.switchPageContext(result.id);
    } else if (result.selectedPageId) {
      deletionWorker.switchPageContext(result.selectedPageId);
    }
    return NextResponse.json({
      success: true,
      type: result.type,
      id: result.id,
      name: result.name,
      message: `Successfully connected ${result.type === 'page' ? 'Page' : 'User'}: ${result.name}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Invalid or expired token' },
      { status: 400 }
    );
  }
}
