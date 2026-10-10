import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const KEY_FILE = path.join(DATA_DIR, 'secrets.key');
const SESSION_FILE = path.join(DATA_DIR, 'auth_session.json');

const ALGORITHM = 'aes-256-gcm';

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getOrCreateKey(): Buffer {
  if (process.env.TOKEN_ENCRYPTION_KEY && process.env.TOKEN_ENCRYPTION_KEY.length >= 32) {
    return crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY).digest();
  }

  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE);
  }

  const newKey = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, newKey, { mode: 0o600 });
  return newKey;
}

export function encryptSecret(plainText: string): string {
  const key = getOrCreateKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(cipherText: string): string | null {
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encrypted] = parts;
    const key = getOrCreateKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    return null;
  }
}

export interface StoredAuthSession {
  userId?: string;
  userName?: string;
  encryptedUserToken?: string;
  selectedPageId?: string;
  selectedPageName?: string;
  encryptedPageToken?: string;
  updatedAt: string;
}

export function getAuthSession(): StoredAuthSession | null {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const content = fs.readFileSync(SESSION_FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function saveAuthSession(session: StoredAuthSession): void {
  const tmpFile = `${SESSION_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(session, null, 2), { mode: 0o600 });
  fs.renameSync(tmpFile, SESSION_FILE);
}

export function clearAuthSession(): void {
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
  }
}

export function getDecryptedPageToken(): string | null {
  const session = getAuthSession();
  if (!session?.encryptedPageToken) return null;
  return decryptSecret(session.encryptedPageToken);
}

export function getDecryptedUserToken(): string | null {
  const session = getAuthSession();
  if (!session?.encryptedUserToken) return null;
  return decryptSecret(session.encryptedUserToken);
}
