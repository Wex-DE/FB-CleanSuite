import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForUserToken } from '@/server/meta/auth';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const storedState = req.cookies.get('oauth_state')?.value;

  if (error) {
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('auth_error', errorDescription || error);
    return NextResponse.redirect(redirectUrl);
  }

  // Cryptographic state verification (Anti-CSRF protection)
  if (!state || !storedState || state !== storedState) {
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('auth_error', 'Invalid or missing OAuth state parameter (CSRF protection blocked request)');
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('auth_error', 'No authorization code returned');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await exchangeCodeForUserToken(code);
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('auth_success', 'true');
    const res = NextResponse.redirect(redirectUrl);
    // Remove one-time state cookie
    res.cookies.delete('oauth_state');
    return res;
  } catch (err: any) {
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('auth_error', err.message || 'Failed to exchange token');
    return NextResponse.redirect(redirectUrl);
  }
}
