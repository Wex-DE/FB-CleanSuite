import { NextResponse } from 'next/server';
import { getAuthSession, clearAuthSession, getDecryptedPageToken, getDecryptedUserToken } from '@/server/security/secrets';
import { getMetaAppConfig, checkTokenExpiry } from '@/server/meta/auth';
import { deletionWorker } from '@/server/worker/deletionWorker';

export async function GET() {
  const session = getAuthSession();
  const { appId } = getMetaAppConfig();

  const authenticated = Boolean(session?.encryptedUserToken || session?.encryptedPageToken);

  let tokenExpiresAt: number | undefined;
  let tokenExpiresInSeconds: number | null | undefined;
  let tokenExpired = false;
  let tokenExpiryMessage: string | undefined;

  if (authenticated) {
    const tokenToInspect = getDecryptedPageToken() || getDecryptedUserToken();
    if (tokenToInspect) {
      const expiry = await checkTokenExpiry(tokenToInspect);
      tokenExpiresAt = expiry.expiresAt;
      tokenExpiresInSeconds = expiry.expiresInSeconds;
      tokenExpired = expiry.isExpired;
      tokenExpiryMessage = expiry.errorMessage;
    }
  }

  return NextResponse.json({
    authenticated,
    hasConfiguredApp: Boolean(appId),
    user: session?.userId ? { id: session.userId, name: session.userName } : undefined,
    selectedPage: session?.selectedPageId
      ? { id: session.selectedPageId, name: session.selectedPageName }
      : undefined,
    tokenExpiresAt,
    tokenExpiresInSeconds,
    tokenExpired,
    tokenExpiryMessage,
  });
}

export async function DELETE() {
  clearAuthSession();
  deletionWorker.resetContext();
  return NextResponse.json({ success: true, message: 'Session logged out and tokens cleared.' });
}

export async function POST() {
  clearAuthSession();
  deletionWorker.resetContext();
  return NextResponse.json({ success: true, message: 'Session logged out and tokens cleared.' });
}
