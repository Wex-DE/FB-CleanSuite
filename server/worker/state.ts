import fs from 'fs';
import path from 'path';
import { WorkerState } from '../types';
import { getAuthSession } from '../security/secrets';

const DATA_DIR = path.join(process.cwd(), 'data');
const STATES_DIR = path.join(DATA_DIR, 'states');
const LEGACY_STATE_FILE = path.join(DATA_DIR, 'state.json');

// Ensure states directory exists
if (!fs.existsSync(STATES_DIR)) {
  fs.mkdirSync(STATES_DIR, { recursive: true });
}

const DEFAULT_STATE: WorkerState = {
  status: 'idle',
  mode: 'dry_run',
  currentActionDescription: 'Idle - ready to start',
  currentDelaySeconds: 10,
  baseDelaySeconds: 10,
  backoffLevel: 0,
  consecutiveFailures: 0,
  stats: {
    total: 0,
    pending: 0,
    deleted: 0,
    failed: 0,
    skipped: 0,
    unknown: 0,
  },
};

export function getPersistedWorkerState(pageId?: string): WorkerState {
  try {
    const activePageId = pageId || getAuthSession()?.selectedPageId;
    if (activePageId) {
      const pageFile = path.join(STATES_DIR, `${activePageId}.json`);
      if (fs.existsSync(pageFile)) {
        const content = fs.readFileSync(pageFile, 'utf8');
        return { ...DEFAULT_STATE, ...JSON.parse(content) };
      }
    }

    if (fs.existsSync(LEGACY_STATE_FILE)) {
      const content = fs.readFileSync(LEGACY_STATE_FILE, 'utf8');
      return { ...DEFAULT_STATE, ...JSON.parse(content) };
    }

    return { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function savePersistedWorkerState(state: WorkerState, pageId?: string): void {
  const activePageId = pageId || getAuthSession()?.selectedPageId;
  const targetFile = activePageId
    ? path.join(STATES_DIR, `${activePageId}.json`)
    : LEGACY_STATE_FILE;

  const tmpFile = `${targetFile}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, targetFile);
}
