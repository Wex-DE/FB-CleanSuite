import fs from 'fs';
import path from 'path';
import { LogEntry } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOGS_DIR = path.join(DATA_DIR, 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function sanitizeMessage(msg: string): string {
  // Strip potential tokens (bearer tokens, EAAB..., EAAQ..., secrets)
  return msg
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.~]+/gi, 'Bearer [REDACTED]')
    .replace(/EAA[0-9a-zA-Z]{15,}/g, '[REDACTED_ACCESS_TOKEN]')
    .replace(/access_token=[^& \t\n\r]+/gi, 'access_token=[REDACTED]')
    .replace(/client_secret=[^& \t\n\r]+/gi, 'client_secret=[REDACTED]')
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[REDACTED]"');
}

export function writeLog(
  level: LogEntry['level'],
  category: LogEntry['category'],
  message: string,
  details?: Record<string, unknown>
): LogEntry {
  const sanitizedMessage = sanitizeMessage(message);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const logFile = path.join(LOGS_DIR, `cleanup_${dateStr}.jsonl`);

  // Sanitize details if present
  let sanitizedDetails: Record<string, unknown> | undefined;
  if (details) {
    try {
      const detailsStr = sanitizeMessage(JSON.stringify(details));
      sanitizedDetails = JSON.parse(detailsStr);
    } catch {
      sanitizedDetails = undefined;
    }
  }

  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now.toISOString(),
    level,
    category,
    message: sanitizedMessage,
    details: sanitizedDetails,
  };

  try {
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to append to log file:', err);
  }

  return entry;
}

export function readRecentLogs(limit = 100): LogEntry[] {
  try {
    if (!fs.existsSync(LOGS_DIR)) return [];
    const files = fs.readdirSync(LOGS_DIR)
      .filter((f) => f.endsWith('.jsonl'))
      .sort()
      .reverse();

    const entries: LogEntry[] = [];
    for (const file of files) {
      const fullPath = path.join(LOGS_DIR, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(lines[i]);
          entries.push(parsed);
          if (entries.length >= limit) return entries;
        } catch {
          // ignore malformed lines
        }
      }
    }
    return entries;
  } catch {
    return [];
  }
}

export function clearLogs(): void {
  try {
    if (!fs.existsSync(LOGS_DIR)) return;
    const files = fs.readdirSync(LOGS_DIR).filter((f) => f.endsWith('.jsonl'));
    for (const file of files) {
      fs.unlinkSync(path.join(LOGS_DIR, file));
    }
  } catch (err) {
    console.error('Failed to clear logs:', err);
  }
}
