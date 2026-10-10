import { NextResponse } from 'next/server';
import { getAuthSession, getDecryptedPageToken } from '@/server/security/secrets';
import { isAllowedOrigin } from '@/server/security/origin';
import { writeLog } from '@/server/logger/logger';
import fs from 'fs';
import path from 'path';

const API_VERSION = 'v26.0';
const GRAPH_API_BASE = 'https://graph.facebook.com';

const DATA_DIR = path.join(process.cwd(), 'data');
const COMMENTS_DIR = path.join(DATA_DIR, 'comments');

if (!fs.existsSync(COMMENTS_DIR)) {
  fs.mkdirSync(COMMENTS_DIR, { recursive: true });
}

export interface SpamComment {
  id: string;
  postId: string;
  postMessage?: string;
  message: string;
  fromName: string;
  fromId?: string;
  createdTime: string;
  spamReasons: ('link' | 'phone' | 'keyword')[];
  status: 'flagged' | 'deleted' | 'ignored';
}

export interface CommentScannerState {
  active: boolean;
  pageId: string;
  pageName: string;
  postLimit: number; // 0 for all
  totalPostsFound: number;
  scannedPosts: number;
  flaggedCount: number;
  statusMessage: string;
  shouldStop: boolean;
  error?: string;
  finishedAt?: string;
}

let activeScanner: CommentScannerState = {
  active: false,
  pageId: '',
  pageName: '',
  postLimit: 50,
  totalPostsFound: 0,
  scannedPosts: 0,
  flaggedCount: 0,
  statusMessage: 'Ready to scan.',
  shouldStop: false,
};

function getCommentsFilePath(pageId: string): string {
  return path.join(COMMENTS_DIR, `${pageId}.json`);
}

function loadComments(pageId: string): SpamComment[] {
  try {
    const file = getCommentsFilePath(pageId);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch {
    // fallback
  }
  return [];
}

function saveComments(pageId: string, comments: SpamComment[]) {
  try {
    const file = getCommentsFilePath(pageId);
    fs.writeFileSync(file, JSON.stringify(comments, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save comments', err);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Adaptive Rate Limit Guard
function evaluateRateLimit(res: Response): number {
  try {
    const appUsage = res.headers.get('x-app-usage');
    if (appUsage) {
      const p = JSON.parse(appUsage);
      const maxVal = Math.max(p.call_count || 0, p.total_cputime || 0, p.total_time || 0);
      if (maxVal >= 85) return 8000;
      if (maxVal >= 70) return 3000;
    }
    const bizUsage = res.headers.get('x-business-use-case-usage');
    if (bizUsage) {
      const p = JSON.parse(bizUsage);
      for (const key of Object.keys(p)) {
        const items = p[key];
        if (Array.isArray(items)) {
          for (const it of items) {
            const maxVal = Math.max(it.call_count || 0, it.total_cputime || 0, it.total_time || 0);
            if (maxVal >= 85) return 8000;
            if (maxVal >= 70) return 3000;
          }
        }
      }
    }
  } catch {}
  return 0;
}

// Detection rules
const LINK_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]+|wa\.me\/[^\s]+|bit\.ly\/[^\s]+|[a-zA-Z0-9-]+\.(com|org|net|io|xyz|info|biz|club|site|online)\b)/i;
const PHONE_REGEX = /(\+?[0-9]{1,4}[\s-]?)?(\(?[0-9]{2,5}\)?[\s-]?)?[0-9]{3,5}[\s-]?[0-9]{3,5}/;

// Background Scan Execution
async function runBackgroundScan(
  pageId: string,
  pageName: string,
  pageToken: string,
  options: {
    postLimit: number;
    checkLinks: boolean;
    checkPhones: boolean;
    customKeywords: string[];
    whitelistKeywords?: string[];
  }
) {
  try {
    activeScanner = {
      active: true,
      pageId,
      pageName,
      postLimit: options.postLimit,
      totalPostsFound: 0,
      scannedPosts: 0,
      flaggedCount: 0,
      statusMessage: 'Discovering posts from Facebook Graph API...',
      shouldStop: false,
    };

    writeLog(
      'info',
      'COMMENTS',
      `Starting comments scan for Page: ${pageName} (${pageId}) with limit: ${
        options.postLimit === 0 ? 'ALL POSTS (Full Page)' : options.postLimit
      }`
    );

    // 1. Fetch posts (with pagination support for All Posts)
    const posts: { id: string; message?: string; created_time?: string }[] = [];
    const limitParam = options.postLimit > 0 ? Math.min(options.postLimit, 50) : 50;
    let nextUrl: string | null = `${GRAPH_API_BASE}/${API_VERSION}/${pageId}/published_posts?fields=id,message,created_time&limit=${limitParam}&access_token=${pageToken}`;

    while (nextUrl && !activeScanner.shouldStop) {
      let res: Response = await fetch(nextUrl);
      let data: any = await res.json();

      if (!res.ok || data.error) {
        // Fallback to /feed if published_posts is restricted
        if (posts.length === 0 && nextUrl.includes('/published_posts?')) {
          nextUrl = `${GRAPH_API_BASE}/${API_VERSION}/${pageId}/feed?fields=id,message,created_time&limit=${limitParam}&access_token=${pageToken}`;
          continue;
        }
        throw new Error(data.error?.message || 'Failed to fetch posts from Meta Graph API');
      }

      const fetchedList = data.data || [];
      for (const p of fetchedList) {
        if (!posts.some((existing) => existing.id === p.id)) {
          posts.push(p);
          if (options.postLimit > 0 && posts.length >= options.postLimit) {
            break;
          }
        }
      }

      activeScanner.totalPostsFound = posts.length;

      if (options.postLimit > 0 && posts.length >= options.postLimit) {
        break;
      }

      // Safety ceiling: up to 1000 posts in a single scan to avoid infinite loops
      if (options.postLimit === 0 && posts.length >= 1000) {
        break;
      }

      if (data.paging && data.paging.next && (!options.postLimit || posts.length < options.postLimit)) {
        nextUrl = data.paging.next;
        await sleep(500); // polite pause between post pages
      } else {
        nextUrl = null;
      }
    }

    if (activeScanner.shouldStop) {
      activeScanner.active = false;
      activeScanner.statusMessage = 'Scan cancelled by user.';
      return;
    }

    activeScanner.totalPostsFound = posts.length;
    activeScanner.statusMessage = `Found ${posts.length} posts. Inspecting comments...`;

    const existingComments = loadComments(pageId);
    const commentsMap = new Map<string, SpamComment>(existingComments.map((c) => [c.id, c]));

    // 2. Iterate each post and fetch comments
    for (let i = 0; i < posts.length; i++) {
      if (activeScanner.shouldStop) {
        break;
      }

      const post = posts[i];
      activeScanner.scannedPosts = i + 1;
      activeScanner.statusMessage = `Scanning post ${i + 1} of ${posts.length}...`;

      try {
        let commentsUrl: string | null = `${GRAPH_API_BASE}/${API_VERSION}/${post.id}/comments?fields=id,message,from,created_time&limit=100&access_token=${pageToken}`;
        let pageCommentsCount = 0;

        while (commentsUrl && !activeScanner.shouldStop && pageCommentsCount < 200) {
          let commRes = await fetch(commentsUrl);
          let commData: any = await commRes.json();

          // Check if rate limited
          if (
            !commRes.ok &&
            (commData.error?.code === 17 ||
              commData.error?.code === 32 ||
              commData.error?.code === 613 ||
              commRes.status === 429)
          ) {
            writeLog('warn', 'COMMENTS', `Rate limit detected from Meta. Cooling down 12s...`);
            activeScanner.statusMessage = `Meta rate limit detected. Cooling down 12s...`;
            await sleep(12000);
            commRes = await fetch(commentsUrl);
            commData = await commRes.json();
          }

          // Evaluate adaptive rate-limit cooldown from headers
          const cooldown = evaluateRateLimit(commRes);
          if (cooldown > 0) {
            activeScanner.statusMessage = `Adaptive Rate-Limit Guard active (cooling down ${cooldown / 1000}s)...`;
            await sleep(cooldown);
          }

          if (commRes.ok && Array.isArray(commData.data)) {
            for (const item of commData.data) {
              const msg = item.message || '';
              if (!msg.trim()) continue;

              // Whitelist check: skip if comment contains any whitelisted term/domain
              if (options.whitelistKeywords && options.whitelistKeywords.length > 0) {
                const lower = msg.toLowerCase();
                if (options.whitelistKeywords.some((w) => lower.includes(w))) {
                  continue;
                }
              }

              const reasons: ('link' | 'phone' | 'keyword')[] = [];

              if (options.checkLinks && LINK_REGEX.test(msg)) {
                reasons.push('link');
              }

              if (
                options.checkPhones &&
                PHONE_REGEX.test(msg) &&
                msg.replace(/[^0-9]/g, '').length >= 10
              ) {
                reasons.push('phone');
              }

              if (options.customKeywords.length > 0) {
                const lower = msg.toLowerCase();
                if (options.customKeywords.some((kw) => lower.includes(kw))) {
                  reasons.push('keyword');
                }
              }

              if (reasons.length > 0) {
                const existing = commentsMap.get(item.id);
                commentsMap.set(item.id, {
                  id: item.id,
                  postId: post.id,
                  postMessage: post.message ? post.message.slice(0, 60) : undefined,
                  message: msg,
                  fromName: item.from?.name || 'Anonymous User',
                  fromId: item.from?.id,
                  createdTime: item.created_time,
                  spamReasons: reasons,
                  status: existing?.status === 'deleted' ? 'deleted' : 'flagged',
                });
              }
            }

            pageCommentsCount += commData.data.length;

            if (commData.paging && commData.paging.next && pageCommentsCount < 200) {
              commentsUrl = commData.paging.next;
              await sleep(300);
            } else {
              commentsUrl = null;
            }
          } else {
            commentsUrl = null;
          }
        }

        activeScanner.flaggedCount = Array.from(commentsMap.values()).filter(
          (c) => c.status === 'flagged'
        ).length;

        // Save progress to disk incrementally every 5 posts
        if ((i + 1) % 5 === 0 || i === posts.length - 1) {
          saveComments(pageId, Array.from(commentsMap.values()));
        }

        // Safe pacing between posts (350ms)
        await sleep(350);
      } catch (postErr) {
        console.error(`Error scanning post ${post.id}`, postErr);
      }
    }

    // Save final comments
    saveComments(pageId, Array.from(commentsMap.values()));
    activeScanner.active = false;
    activeScanner.finishedAt = new Date().toISOString();
    activeScanner.statusMessage = activeScanner.shouldStop
      ? `Scan stopped. Analyzed ${activeScanner.scannedPosts} posts and found ${activeScanner.flaggedCount} spam comments.`
      : `Scan complete! Checked ${activeScanner.scannedPosts} posts and flagged ${activeScanner.flaggedCount} spam comments.`;

    writeLog(
      'success',
      'COMMENTS',
      `Comments scan completed. Analyzed ${activeScanner.scannedPosts} posts, total flagged: ${activeScanner.flaggedCount}.`
    );
  } catch (err: any) {
    activeScanner.active = false;
    activeScanner.error = err.message || 'Scan failed';
    activeScanner.statusMessage = `Scan failed: ${err.message || 'Unknown error'}`;
    writeLog('error', 'COMMENTS', `Comments scan error: ${err.message}`);
  }
}

export async function GET(req: Request) {
  const session = getAuthSession();
  const pageId = session?.selectedPageId;
  if (!pageId) {
    return NextResponse.json({ comments: [], scanner: activeScanner });
  }

  const comments = loadComments(pageId);
  return NextResponse.json({
    comments,
    scanner: {
      ...activeScanner,
      active: activeScanner.active && activeScanner.pageId === pageId,
    },
  });
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden cross-origin request' }, { status: 403 });
  }

  const session = getAuthSession();
  const pageId = session?.selectedPageId;
  const pageName = session?.selectedPageName || 'Connected Page';
  const pageToken = getDecryptedPageToken();

  if (!pageId || !pageToken) {
    return NextResponse.json(
      { error: 'No active Facebook Page connected. Please authenticate first.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const action = body.action || 'scan';

    if (action === 'scan' || action === 'start_scan') {
      // 0 means All Posts (Full Page)
      const rawLimit = Number(body.postLimit);
      const postLimit = rawLimit === 0 ? 0 : Math.min(500, Math.max(5, rawLimit || 50));
      const checkLinks = body.checkLinks !== false;
      const checkPhones = body.checkPhones !== false;
      const customKeywords: string[] = Array.isArray(body.customKeywords)
        ? body.customKeywords.map((k: string) => k.toLowerCase().trim()).filter(Boolean)
        : [];
      const whitelistKeywords: string[] = Array.isArray(body.whitelistKeywords)
        ? body.whitelistKeywords.map((k: string) => k.toLowerCase().trim()).filter(Boolean)
        : [];

      if (activeScanner.active && activeScanner.pageId === pageId) {
        return NextResponse.json({
          success: true,
          alreadyRunning: true,
          scanner: activeScanner,
        });
      }

      // Trigger background scan
      runBackgroundScan(pageId, pageName, pageToken, {
        postLimit,
        checkLinks,
        checkPhones,
        customKeywords,
        whitelistKeywords,
      });

      return NextResponse.json({
        success: true,
        started: true,
        scanner: activeScanner,
      });
    }

    if (action === 'stop_scan') {
      activeScanner.shouldStop = true;
      activeScanner.statusMessage = 'Stopping scanner...';
      return NextResponse.json({ success: true, stopping: true });
    }

    if (action === 'delete_single') {
      const commentId = body.commentId;
      if (!commentId) {
        return NextResponse.json({ error: 'commentId is required' }, { status: 400 });
      }

      const delUrl = `${GRAPH_API_BASE}/${API_VERSION}/${commentId}?access_token=${pageToken}`;
      const delRes = await fetch(delUrl, { method: 'DELETE' });
      const delData = await delRes.json();

      if (delRes.ok && delData.success) {
        const comments = loadComments(pageId);
        const item = comments.find((c) => c.id === commentId);
        if (item) item.status = 'deleted';
        saveComments(pageId, comments);
        writeLog('success', 'COMMENTS', `Deleted comment ${commentId}`);
        return NextResponse.json({ success: true, message: `Comment deleted.` });
      } else {
        const msg = delData.error?.message || 'Failed to delete comment on Facebook';
        writeLog('error', 'COMMENTS', `Failed to delete comment ${commentId}: ${msg}`);
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    if (action === 'delete_batch') {
      const commentIds: string[] = body.commentIds;
      if (!Array.isArray(commentIds) || commentIds.length === 0) {
        return NextResponse.json({ error: 'commentIds array is required' }, { status: 400 });
      }

      const comments = loadComments(pageId);
      const results = { deleted: [] as string[], failed: [] as string[] };

      for (const id of commentIds) {
        try {
          const delUrl = `${GRAPH_API_BASE}/${API_VERSION}/${id}?access_token=${pageToken}`;
          const delRes = await fetch(delUrl, { method: 'DELETE' });
          const delData = await delRes.json();

          if (delRes.ok && delData.success) {
            results.deleted.push(id);
            const item = comments.find((c) => c.id === id);
            if (item) item.status = 'deleted';
          } else {
            results.failed.push(id);
          }
        } catch {
          results.failed.push(id);
        }

        if (commentIds.length > 1) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      saveComments(pageId, comments);
      writeLog(
        'success',
        'COMMENTS',
        `Batch comment deletion completed. Deleted: ${results.deleted.length}, Failed: ${results.failed.length}`
      );

      return NextResponse.json({ success: true, results, comments });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Comments operation failed' }, { status: 500 });
  }
}
