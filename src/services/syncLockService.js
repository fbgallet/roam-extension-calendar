/**
 * Sync Lock Service - Prevents duplicate syncs across multiple component instances
 *
 * This service maintains a global lock to prevent the same Roam event from being
 * synced to Google Calendar multiple times concurrently, which would create duplicate
 * GCal events with different IDs.
 *
 * Use case: When multiple Calendar component instances exist (e.g., in development
 * with hot reload), they can both try to auto-sync the same event simultaneously.
 */

// Global lock tracking which Roam UIDs are currently being synced
const syncLocks = new Map();

/**
 * Acquire a sync lock for a Roam event
 * @param {string} roamUid - Roam block UID
 * @returns {boolean} True if lock was acquired, false if already locked
 */
export const acquireSyncLock = (roamUid) => {
  if (syncLocks.has(roamUid)) {
    const lockTime = syncLocks.get(roamUid);
    const now = Date.now();

    // If lock is older than 30 seconds, assume it's stale and take it over
    // This prevents deadlocks from crashes/errors
    if (now - lockTime > 30000) {
      console.warn(`[SyncLock] Stale lock detected for ${roamUid}, taking over`);
      syncLocks.set(roamUid, now);
      return true;
    }

    console.log(`[SyncLock] Already syncing ${roamUid}, skipping`);
    return false;
  }

  syncLocks.set(roamUid, Date.now());
  console.log(`[SyncLock] Acquired lock for ${roamUid}`);
  return true;
};

/**
 * Release a sync lock for a Roam event
 * @param {string} roamUid - Roam block UID
 */
export const releaseSyncLock = (roamUid) => {
  if (syncLocks.delete(roamUid)) {
    console.log(`[SyncLock] Released lock for ${roamUid}`);
  }
};

/**
 * Check if a Roam event is currently being synced
 * @param {string} roamUid - Roam block UID
 * @returns {boolean} True if currently locked
 */
export const isSyncLocked = (roamUid) => {
  return syncLocks.has(roamUid);
};

/**
 * Clear all sync locks (useful for cleanup/reset)
 */
export const clearAllSyncLocks = () => {
  const count = syncLocks.size;
  syncLocks.clear();
  if (count > 0) {
    console.log(`[SyncLock] Cleared ${count} sync locks`);
  }
};

/**
 * Get sync lock statistics (for debugging)
 */
export const getSyncLockStats = () => {
  return {
    activeLocks: syncLocks.size,
    locks: Array.from(syncLocks.entries()).map(([roamUid, lockTime]) => ({
      roamUid,
      lockTime,
      age: Date.now() - lockTime,
    })),
  };
};

export default {
  acquireSyncLock,
  releaseSyncLock,
  isSyncLocked,
  clearAllSyncLocks,
  getSyncLockStats,
};
