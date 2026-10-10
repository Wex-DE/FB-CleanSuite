import { getDecryptedUserToken, getAuthSession, saveAuthSession, encryptSecret } from '../security/secrets';
import { PageInfo } from '../types';
import { writeLog } from '../logger/logger';

const GRAPH_API_BASE = 'https://graph.facebook.com';
const API_VERSION = process.env.META_API_VERSION || 'v26.0';

export async function fetchUserManagedPages(): Promise<PageInfo[]> {
  const session = getAuthSession();
  const userToken = getDecryptedUserToken();

  // If user directly imported a Page token, return that single Page
  if (session?.selectedPageId && session.selectedPageName && session.encryptedPageToken && !userToken) {
    return [
      {
        id: session.selectedPageId,
        name: session.selectedPageName,
        hasDeletePermission: true,
        selected: true,
      },
    ];
  }

  if (!userToken) {
    throw new Error('Not authenticated. Please connect your Facebook account or provide an access token.');
  }

  const url = `${GRAPH_API_BASE}/${API_VERSION}/me/accounts?fields=id,name,category,tasks,access_token&limit=100&access_token=${userToken}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.error) {
    const errorMsg = data.error?.message || 'Failed to fetch accounts';
    writeLog('error', 'AUTH', `Failed to fetch user Pages: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const pages: PageInfo[] = [];
  const accounts = data.data || [];

  for (const acc of accounts) {
    const tasks: string[] = acc.tasks || [];
    // Page management or moderation tasks allow post management
    const canManage =
      tasks.includes('MANAGE') ||
      tasks.includes('CREATE_CONTENT') ||
      tasks.includes('MODERATE') ||
      tasks.length === 0; // If tasks array not returned in older models, assume granted if in accounts

    const isSelected = session?.selectedPageId === acc.id;

    pages.push({
      id: acc.id,
      name: acc.name,
      category: acc.category,
      tasks,
      hasDeletePermission: canManage,
      selected: isSelected,
    });
  }

  return pages;
}

export async function selectPageById(pageId: string): Promise<{ id: string; name: string }> {
  const session = getAuthSession();
  const userToken = getDecryptedUserToken();

  // If it's already the active page token
  if (session?.selectedPageId === pageId && session.encryptedPageToken) {
    return { id: session.selectedPageId, name: session.selectedPageName || pageId };
  }

  if (!userToken) {
    throw new Error('User access token not found. Please log in again.');
  }

  // Fetch the Page token specifically
  const url = `${GRAPH_API_BASE}/${API_VERSION}/me/accounts?fields=id,name,access_token,tasks&limit=100&access_token=${userToken}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || 'Failed to retrieve page accounts');
  }

  const page = (data.data || []).find((p: { id: string }) => p.id === pageId);
  if (!page || !page.access_token) {
    throw new Error(`Page with ID ${pageId} not found or Page token was not returned.`);
  }

  saveAuthSession({
    ...session,
    selectedPageId: page.id,
    selectedPageName: page.name,
    encryptedPageToken: encryptSecret(page.access_token),
    updatedAt: new Date().toISOString(),
  });

  writeLog('info', 'AUTH', `Selected Page for cleanup: ${page.name} (${page.id})`);

  return { id: page.id, name: page.name };
}
