import { getDecryptedPageToken } from '../security/secrets';
import { writeLog } from '../logger/logger';

const GRAPH_API_BASE = 'https://graph.facebook.com';
const API_VERSION = process.env.META_API_VERSION || 'v26.0';

export interface DeleteResult {
  success: boolean;
  httpStatus: number;
  rateLimited: boolean;
  rateLimitCode?: number;
  transient: boolean;
  unsupported: boolean;
  tokenExpired?: boolean;
  errorMessage?: string;
  appUsage?: string;
  pageUsage?: string;
}

export async function deletePagePost(postId: string): Promise<DeleteResult> {
  const pageToken = getDecryptedPageToken();

  if (!pageToken) {
    return {
      success: false,
      httpStatus: 401,
      rateLimited: false,
      transient: false,
      unsupported: false,
      errorMessage: 'Missing Page Access Token',
    };
  }

  const url = `${GRAPH_API_BASE}/${API_VERSION}/${postId}`;

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${pageToken}`,
        'Content-Type': 'application/json',
      },
    });

    const appUsage = res.headers.get('x-app-usage') || undefined;
    const pageUsage = res.headers.get('x-page-usage') || undefined;

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      // Non-JSON response
    }

    // 200 OK with { "success": true } is standard Meta response
    if (res.ok && (data.success === true || data === true)) {
      writeLog('success', 'DELETION', `Successfully deleted post ${postId}`);
      return {
        success: true,
        httpStatus: res.status,
        rateLimited: false,
        transient: false,
        unsupported: false,
        appUsage,
        pageUsage,
      };
    }

    // Handle Meta errors
    const error = data.error || {};
    const errorCode = error.code;
    const errorSubcode = error.error_subcode;
    const errorMsg = error.message || `Meta returned HTTP ${res.status}`;

    // Access Token Expiration / Invalidation detection
    // Code 190 (Invalid OAuth access token), Subcode 463 (Session expired), or related error messages
    const isTokenExpired =
      errorCode === 190 ||
      errorSubcode === 463 ||
      errorMsg.includes('Session has expired') ||
      errorMsg.includes('Error validating access token') ||
      errorMsg.includes('Session is invalid');

    // Rate-limiting detection (Codes 4, 17, 32, 613 or HTTP 429)
    const isRateLimited =
      res.status === 429 ||
      errorCode === 4 ||
      errorCode === 17 ||
      errorCode === 32 ||
      errorCode === 613;

    // Transient server errors (5xx, network hiccups, code 1 or 2)
    const isTransient =
      res.status >= 500 ||
      errorCode === 1 ||
      errorCode === 2;

    // Post already gone or unsupported delete request (e.g. system aggregation/story, error 100 or subcode 33)
    const isUnsupportedOrMissing =
      errorCode === 100 && (errorMsg.includes('Unsupported delete request') || errorMsg.includes('does not exist')) ||
      errorCode === 21; // Page does not exist or object not found

    writeLog('warn', 'DELETION', `Failed to delete post ${postId}: ${errorMsg}`, {
      httpStatus: res.status,
      errorCode,
      errorSubcode,
      isTokenExpired,
      isRateLimited,
      isTransient,
    });

    return {
      success: false,
      httpStatus: res.status,
      rateLimited: isRateLimited,
      rateLimitCode: errorCode,
      transient: isTransient,
      unsupported: isUnsupportedOrMissing,
      tokenExpired: isTokenExpired,
      errorMessage: errorMsg,
      appUsage,
      pageUsage,
    };
  } catch (err: any) {
    // Network failure / connection reset
    writeLog('error', 'DELETION', `Network error during delete of ${postId}: ${err.message}`);
    return {
      success: false,
      httpStatus: 0,
      rateLimited: false,
      transient: true,
      unsupported: false,
      errorMessage: `Network error: ${err.message}`,
    };
  }
}
