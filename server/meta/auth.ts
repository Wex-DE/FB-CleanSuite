import { encryptSecret, saveAuthSession, getAuthSession } from '../security/secrets';
import { writeLog } from '../logger/logger';
import { deletionWorker } from '../worker/deletionWorker';
import { requeueExpiredTokenFailedItems } from '../worker/queue';

const GRAPH_API_BASE = 'https://graph.facebook.com';
const API_VERSION = process.env.META_API_VERSION || 'v26.0';

export function getMetaAppConfig() {
  const appId = process.env.META_APP_ID || '';
  const appSecret = process.env.META_APP_SECRET || '';
  const redirectUri = process.env.META_REDIRECT_URI || 'http://127.0.0.1:3000/api/auth/callback';
  return { appId, appSecret, redirectUri, version: API_VERSION };
}

export function buildOAuthLoginUrl(explicitState?: string): string {
  const { appId, redirectUri } = getMetaAppConfig();
  if (!appId) {
    throw new Error('META_APP_ID is not configured in .env.local');
  }

  // Official scoped permissions for Page Post Management and Content Reading
  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_manage_engagement',
    'pages_read_user_content',
    'business_management',
  ].join(',');

  const state = explicitState || `agy_${Date.now()}`;

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    state,
  });

  return `https://www.facebook.com/${API_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForUserToken(code: string): Promise<{
  userId: string;
  userName: string;
  userToken: string;
}> {
  const { appId, appSecret, redirectUri, version } = getMetaAppConfig();

  const tokenUrl = `${GRAPH_API_BASE}/${version}/oauth/access_token?` +
    new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

  const res = await fetch(tokenUrl);
  const data = await res.json();

  if (!res.ok || data.error) {
    const errorMsg = data.error?.message || 'Failed to exchange authorization code';
    writeLog('error', 'AUTH', `OAuth code exchange failed: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const userToken = data.access_token;

  // Retrieve user identity
  const meRes = await fetch(`${GRAPH_API_BASE}/${version}/me?fields=id,name&access_token=${userToken}`);
  const meData = await meRes.json();

  if (!meRes.ok || meData.error) {
    throw new Error(meData.error?.message || 'Failed to fetch user profile');
  }

  // Save session securely
  saveAuthSession({
    userId: meData.id,
    userName: meData.name,
    encryptedUserToken: encryptSecret(userToken),
    updatedAt: new Date().toISOString(),
  });

  writeLog('success', 'AUTH', `Successfully authenticated user: ${meData.name} (${meData.id})`);

  return {
    userId: meData.id,
    userName: meData.name,
    userToken,
  };
}

export async function importDirectToken(token: string): Promise<{
  type: 'user' | 'page';
  id: string;
  name: string;
  selectedPageId?: string;
}> {
  const version = API_VERSION;

  // Validate the token by querying /me with universal fields (valid on both User and Page nodes)
  const meRes = await fetch(`${GRAPH_API_BASE}/${version}/me?fields=id,name&access_token=${token}`);
  const meData = await meRes.json();

  if (!meRes.ok || meData.error) {
    const errorMsg = meData.error?.message || 'Invalid or expired token';
    writeLog('error', 'AUTH', `Token validation failed: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Probe /me/accounts to determine if this is a User Access Token or a Page Access Token
  let isUserToken = false;
  let managedPages: Array<{ id: string; name: string; access_token: string }> = [];

  try {
    const accountsRes = await fetch(
      `${GRAPH_API_BASE}/${version}/me/accounts?fields=id,name,access_token&limit=100&access_token=${token}`
    );
    const accountsData = await accountsRes.json();
    if (accountsRes.ok && Array.isArray(accountsData.data)) {
      isUserToken = true;
      managedPages = accountsData.data;
    }
  } catch {
    isUserToken = false;
  }

  const existingSession = getAuthSession() || { updatedAt: new Date().toISOString() };

  if (isUserToken) {
    let autoPageId: string | undefined = undefined;
    let autoPageName: string | undefined = undefined;
    let autoPageToken: string | undefined = undefined;

    if (managedPages.length > 0) {
      autoPageId = managedPages[0].id;
      autoPageName = managedPages[0].name;
      autoPageToken = managedPages[0].access_token;
    }

    saveAuthSession({
      ...existingSession,
      userId: meData.id,
      userName: meData.name,
      encryptedUserToken: encryptSecret(token),
      selectedPageId: autoPageId || existingSession.selectedPageId,
      selectedPageName: autoPageName || existingSession.selectedPageName,
      encryptedPageToken: autoPageToken ? encryptSecret(autoPageToken) : existingSession.encryptedPageToken,
      updatedAt: new Date().toISOString(),
    });

    writeLog(
      'success',
      'AUTH',
      `Direct User Access Token configured for User: ${meData.name} (${meData.id}) with ${managedPages.length} managed page(s).`
    );

    // Requeue any previously token-expired failed items and clear worker token-expired state
    if (autoPageId) {
      requeueExpiredTokenFailedItems(autoPageId);
    }
    deletionWorker.resetTokenExpired();

    return {
      type: 'user',
      id: meData.id,
      name: meData.name,
      selectedPageId: autoPageId,
    };
  } else {
    // Page Access Token directly
    saveAuthSession({
      ...existingSession,
      selectedPageId: meData.id,
      selectedPageName: meData.name,
      encryptedPageToken: encryptSecret(token),
      updatedAt: new Date().toISOString(),
    });
    writeLog('success', 'AUTH', `Direct Page Access Token configured for Page: ${meData.name} (${meData.id})`);

    // Requeue any previously token-expired failed items and clear worker token-expired state
    requeueExpiredTokenFailedItems(meData.id);
    deletionWorker.resetTokenExpired();

    return { type: 'page', id: meData.id, name: meData.name, selectedPageId: meData.id };
  }
}

export interface TokenExpiryInfo {
  isValid: boolean;
  expiresAt?: number; // epoch in seconds, 0 = never expires
  expiresInSeconds?: number | null; // remaining seconds (null if never expires)
  isExpired: boolean;
  errorMessage?: string;
  dataAccessExpiresAt?: number;
}

const tokenExpiryCache = new Map<string, { info: TokenExpiryInfo; cachedAt: number }>();
const TOKEN_CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function checkTokenExpiry(token: string): Promise<TokenExpiryInfo> {
  const cached = tokenExpiryCache.get(token);
  const now = Date.now();
  if (cached && now - cached.cachedAt < TOKEN_CACHE_TTL_MS) {
    // If expiresAt is set, dynamically adjust remaining seconds
    if (cached.info.expiresAt && cached.info.expiresAt > 0) {
      const nowSec = Math.floor(now / 1000);
      const remaining = Math.max(0, cached.info.expiresAt - nowSec);
      return {
        ...cached.info,
        expiresInSeconds: remaining,
        isExpired: remaining <= 0,
        isValid: remaining > 0,
      };
    }
    return cached.info;
  }

  const version = API_VERSION;
  try {
    const url = `${GRAPH_API_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      const err = data.error || {};
      const isExpired = err.code === 190 || err.error_subcode === 463 || (err.message && err.message.includes('Session has expired'));
      const result: TokenExpiryInfo = {
        isValid: false,
        isExpired: Boolean(isExpired),
        errorMessage: err.message || 'Token validation error',
      };
      tokenExpiryCache.set(token, { info: result, cachedAt: now });
      return result;
    }

    const tokenData = data.data;
    if (!tokenData || tokenData.is_valid === false) {
      const result: TokenExpiryInfo = {
        isValid: false,
        isExpired: true,
        errorMessage: tokenData?.error?.message || 'Token is invalid or expired',
      };
      tokenExpiryCache.set(token, { info: result, cachedAt: now });
      return result;
    }

    const expiresAt = tokenData.expires_at || 0;
    const nowSec = Math.floor(now / 1000);

    let expiresInSeconds: number | null = null;
    let isExpired = false;

    if (expiresAt > 0) {
      expiresInSeconds = Math.max(0, expiresAt - nowSec);
      if (expiresInSeconds <= 0) {
        isExpired = true;
      }
    }

    const result: TokenExpiryInfo = {
      isValid: !isExpired,
      expiresAt,
      expiresInSeconds,
      isExpired,
      dataAccessExpiresAt: tokenData.data_access_expires_at,
    };
    tokenExpiryCache.set(token, { info: result, cachedAt: now });
    return result;
  } catch (err: any) {
    return {
      isValid: false,
      isExpired: false,
      errorMessage: err.message || 'Network error checking token expiration',
    };
  }
}

