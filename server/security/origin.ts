export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const url = new URL(origin);
      return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    } catch {
      return false;
    }
  }

  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    } catch {
      return false;
    }
  }

  // If both origin and referer are absent (direct local cURL/scripts), allow
  return true;
}
