import * as fs from 'fs';
import * as path from 'path';

const STATE_FILE = path.join(process.cwd(), 'sync-state.json');

export interface FileState {
  path: string;
  modifiedTime: string;
  driveModifiedTime: string;
}

export interface SyncState {
  lastSync: string;
  files: Record<string, FileState>;
}

/**
 * Loads the sync state from disk
 */
export function loadState(): SyncState {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      lastSync: new Date(0).toISOString(),
      files: {},
    };
  }

  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('⚠️  Failed to load sync state, starting fresh:', error);
    return {
      lastSync: new Date(0).toISOString(),
      files: {},
    };
  }
}

/**
 * Saves the sync state to disk
 */
export function saveState(state: SyncState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('❌ Failed to save sync state:', error);
    throw error;
  }
}

/**
 * Checks if a file has changed based on modified time
 */
export function hasChanged(
  state: SyncState,
  fileId: string,
  driveModifiedTime: string
): boolean {
  const fileState = state.files[fileId];
  
  if (!fileState) {
    // File not in state, it's new
    return true;
  }

  // Compare modified times
  return new Date(driveModifiedTime) > new Date(fileState.driveModifiedTime);
}

/**
 * Gets a list of file IDs that exist in state but not in current Drive files
 * These are files that have been deleted from Drive
 */
export function getDeletedFiles(
  state: SyncState,
  currentDriveFileIds: Set<string>
): string[] {
  const deletedFiles: string[] = [];

  for (const fileId in state.files) {
    if (!currentDriveFileIds.has(fileId)) {
      deletedFiles.push(fileId);
    }
  }

  return deletedFiles;
}

/**
 * Updates the state for a specific file
 */
export function updateFileState(
  state: SyncState,
  fileId: string,
  fileState: FileState
): void {
  state.files[fileId] = fileState;
  state.lastSync = new Date().toISOString();
}

/**
 * Removes a file from the state
 */
export function removeFileState(state: SyncState, fileId: string): void {
  delete state.files[fileId];
  state.lastSync = new Date().toISOString();
}
