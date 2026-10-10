import { getDecryptedPageToken, getAuthSession } from '../security/secrets';
import { initializeQueue } from '../worker/queue';
import { writeLog } from '../logger/logger';
import { QueueState } from '../types';

const GRAPH_API_BASE = 'https://graph.facebook.com';
const API_VERSION = process.env.META_API_VERSION || 'v26.0';

interface RawPost {
  id: string;
  created_time?: string;
  message?: string;
}

export interface DiscoverPostsOptions {
  maxLimit?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  sortOrder?: 'oldest_first' | 'newest_first';
  onProgress?: (count: number) => void;
}

export async function discoverPagePosts(options?: DiscoverPostsOptions): Promise<QueueState> {
  const session = getAuthSession();
  const pageToken = getDecryptedPageToken();

  if (!session?.selectedPageId || !pageToken) {
    throw new Error('No Facebook Page selected or Page Access Token is missing.');
  }

  const pageId = session.selectedPageId;
  const pageName = session.selectedPageName || 'Unknown Page';
  const maxLimit = options?.maxLimit || 10000;
  const sortOrder = options?.sortOrder || 'oldest_first'; // Default to oldest first so user deletes older posts!
  const startDate = options?.startDate ? new Date(options.startDate).getTime() : null;
  const endDate = options?.endDate ? new Date(options.endDate + 'T23:59:59.999Z').getTime() : null;

  writeLog('info', 'DISCOVERY', `Starting post discovery for Page: ${pageName} (${pageId}) with filter: sort=${sortOrder}, start=${options?.startDate || 'any'}, end=${options?.endDate || 'any'}`);

  let nextUrl: string | null =
    `${GRAPH_API_BASE}/${API_VERSION}/${pageId}/published_posts?` +
    new URLSearchParams({
      fields: 'id,created_time,message',
      limit: '100',
      access_token: pageToken,
    });

  const discoveredPosts: RawPost[] = [];
  let pageCount = 0;

  while (nextUrl && discoveredPosts.length < maxLimit) {
    pageCount++;
    const res: Response = await fetch(nextUrl);
    const data: any = await res.json();

    if (!res.ok || data.error) {
      const errorMsg = data.error?.message || 'Error fetching posts from Meta Graph API';
      const code = data.error?.code || res.status;
      writeLog('error', 'DISCOVERY', `Discovery failed on page batch ${pageCount}: ${errorMsg}`, { code });
      throw new Error(`Graph API error: ${errorMsg} (Code: ${code})`);
    }

    const posts: RawPost[] = data.data || [];
    if (posts.length === 0) {
      break;
    }

    for (const post of posts) {
      if (post.id && !discoveredPosts.some((p) => p.id === post.id)) {
        // Date filtering
        if (post.created_time) {
          const postTime = new Date(post.created_time).getTime();
          if (startDate && postTime < startDate) continue;
          if (endDate && postTime > endDate) continue;
        }
        discoveredPosts.push(post);
      }
    }

    if (options?.onProgress) {
      options.onProgress(discoveredPosts.length);
    }

    // Check pagination next link
    if (data.paging && data.paging.next) {
      nextUrl = data.paging.next;
      // Gentle pause between discovery pages to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 800));
    } else {
      nextUrl = null;
    }
  }

  // Sort discovered posts:
  // Meta returns newest first by default.
  // If sortOrder === 'oldest_first', we sort ascending so older posts are deleted first!
  discoveredPosts.sort((a, b) => {
    const timeA = a.created_time ? new Date(a.created_time).getTime() : 0;
    const timeB = b.created_time ? new Date(b.created_time).getTime() : 0;
    if (sortOrder === 'oldest_first') {
      return timeA - timeB; // ascending: older posts first
    } else {
      return timeB - timeA; // descending: newest posts first
    }
  });

  writeLog(
    'success',
    'DISCOVERY',
    `Discovery completed. Discovered ${discoveredPosts.length} matching posts (${sortOrder}) for Page: ${pageName}`
  );

  const queue = initializeQueue(pageId, pageName, discoveredPosts);
  return queue;
}
