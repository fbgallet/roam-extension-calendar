/**
 * SyncMetadata - Handles sync metadata storage in extension storage
 *
 * Sync metadata is stored in extension storage, NOT in Roam blocks.
 * Maps Roam block UIDs to their corresponding GCal event IDs.
 */

import { extensionStorage } from "..";

const STORAGE_KEY = "gcal-sync-metadata";

// In-memory cache of sync metadata
let syncMetadataCache = null;

/**
 * Sync metadata structure for a single event
 */
export const createSyncMetadata = ({
  gCalId,
  gCalCalendarId,
  etag = null,
  gCalUpdated = null,
  roamUpdated = null,
  lastSync = Date.now(),
  eventEndDate = null, // ISO date string (YYYY-MM-DD) for cleanup purposes
  isTodo = false, // Whether the Roam block has TODO status (preserved during cleanup)
}) => ({
  gCalId,
  gCalCalendarId,
  etag,
  gCalUpdated,
  roamUpdated,
  lastSync,
  eventEndDate,
  isTodo,
});

/**
 * Load all sync metadata from storage
 */
export const loadSyncMetadata = () => {
  if (syncMetadataCache !== null) {
    return syncMetadataCache;
  }

  try {
    const stored = extensionStorage.get(STORAGE_KEY);
    syncMetadataCache = stored || {};
    return syncMetadataCache;
  } catch (error) {
    console.error("Failed to load sync metadata:", error);
    syncMetadataCache = {};
    return syncMetadataCache;
  }
};

/**
 * Save all sync metadata to storage
 */
const persistSyncMetadata = () => {
  try {
    extensionStorage.set(STORAGE_KEY, syncMetadataCache);
  } catch (error) {
    console.error("Failed to persist sync metadata:", error);
  }
};

/**
 * Get sync metadata for a specific Roam block
 * @param {string} roamUid - Roam block UID
 * @returns {object|null} Sync metadata or null if not found
 */
export const getSyncMetadata = (roamUid) => {
  const allMetadata = loadSyncMetadata();
  return allMetadata[roamUid] || null;
};

/**
 * Get Roam UID by GCal event ID
 * @param {string} gCalId - Google Calendar event ID
 * @returns {string|null} Roam block UID or null if not found
 */
export const getRoamUidByGCalId = (gCalId) => {
  const allMetadata = loadSyncMetadata();
  for (const [roamUid, metadata] of Object.entries(allMetadata)) {
    if (metadata.gCalId === gCalId) {
      return roamUid;
    }
  }
  return null;
};

/**
 * Save sync metadata for a Roam block
 * @param {string} roamUid - Roam block UID
 * @param {object} metadata - Sync metadata
 */
export const saveSyncMetadata = async (roamUid, metadata) => {
  loadSyncMetadata(); // Ensure cache is loaded
  syncMetadataCache[roamUid] = metadata;
  persistSyncMetadata();
  return roamUid;
};

/**
 * Update specific fields in sync metadata
 * @param {string} roamUid - Roam block UID
 * @param {object} updates - Fields to update
 */
export const updateSyncMetadata = async (roamUid, updates) => {
  const existing = getSyncMetadata(roamUid);

  if (existing) {
    const updatedMetadata = { ...existing, ...updates };
    await saveSyncMetadata(roamUid, updatedMetadata);
    return updatedMetadata;
  }

  return null;
};

/**
 * Delete sync metadata for a Roam block
 * @param {string} roamUid - Roam block UID
 */
export const deleteSyncMetadata = async (roamUid) => {
  loadSyncMetadata();

  if (syncMetadataCache[roamUid]) {
    delete syncMetadataCache[roamUid];
    persistSyncMetadata();
    return true;
  }

  return false;
};

/**
 * Check if a Roam block is synced with GCal
 * @param {string} roamUid - Roam block UID
 */
export const isSynced = (roamUid) => {
  return getSyncMetadata(roamUid) !== null;
};

/**
 * Get the Google Calendar ID from a Roam block's metadata
 * @param {string} roamUid - Roam block UID
 */
export const getGCalIdFromEvent = (roamUid) => {
  const metadata = getSyncMetadata(roamUid);
  return metadata ? metadata.gCalId : null;
};

/**
 * Get all synced events for a specific calendar
 * @param {string} calendarId - Google Calendar ID
 */
export const getSyncedEventsForCalendar = (calendarId) => {
  const allMetadata = loadSyncMetadata();
  const result = {};

  for (const [roamUid, metadata] of Object.entries(allMetadata)) {
    if (metadata.gCalCalendarId === calendarId) {
      result[roamUid] = metadata;
    }
  }

  return result;
};

/**
 * Clear all sync metadata (useful for disconnecting)
 */
export const clearAllSyncMetadata = () => {
  syncMetadataCache = {};
  persistSyncMetadata();
};

/**
 * Sync status types
 */
export const SyncStatus = {
  SYNCED: "synced",
  PENDING: "pending",
  CONFLICT: "conflict",
  LOCAL_ONLY: "local-only",
  GCAL_ONLY: "gcal-only",
};

/**
 * Determine sync status by comparing timestamps
 */
export const determineSyncStatus = (metadata, gCalEvent) => {
  if (!metadata) {
    return SyncStatus.LOCAL_ONLY;
  }

  if (!gCalEvent) {
    // GCal event might have been deleted
    return SyncStatus.LOCAL_ONLY;
  }

  const gCalUpdated = new Date(gCalEvent.updated).getTime();
  const roamUpdated = metadata.roamUpdated || metadata.lastSync;

  // Both modified since last sync
  if (gCalUpdated > metadata.lastSync && roamUpdated > metadata.lastSync) {
    return SyncStatus.CONFLICT;
  }

  // GCal is newer
  if (gCalUpdated > roamUpdated) {
    return SyncStatus.PENDING; // Needs update from GCal
  }

  // Roam is newer
  if (roamUpdated > gCalUpdated) {
    return SyncStatus.PENDING; // Needs update to GCal
  }

  return SyncStatus.SYNCED;
};

/**
 * Get storage statistics for sync metadata
 * @returns {object} { eventCount, todoCount, estimatedBytes }
 */
export const getStorageStats = () => {
  const allMetadata = loadSyncMetadata();
  const entries = Object.entries(allMetadata);

  let todoCount = 0;
  for (const [, metadata] of entries) {
    if (metadata.isTodo) {
      todoCount++;
    }
  }

  // Estimate ~200 bytes per entry (JSON serialized)
  const estimatedBytes = entries.length * 200;

  return {
    eventCount: entries.length,
    todoCount,
    estimatedBytes,
  };
};

/**
 * Cleanup old sync metadata for past events
 * Removes metadata for events that ended more than N days ago,
 * unless the event still has TODO status.
 * @param {number} daysThreshold - Days after which to cleanup (default: 7)
 * @returns {object} { removedCount, keptTodoCount }
 */
export const cleanupOldMetadata = (daysThreshold = 7) => {
  loadSyncMetadata();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thresholdDate = new Date(today.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

  let removedCount = 0;
  let keptTodoCount = 0;
  const toRemove = [];

  for (const [roamUid, metadata] of Object.entries(syncMetadataCache)) {
    // Skip if no end date stored (legacy entry, can't determine age)
    if (!metadata.eventEndDate) {
      continue;
    }

    const endDate = new Date(metadata.eventEndDate);

    // Check if event ended before threshold
    if (endDate < thresholdDate) {
      // Keep if it's still a TODO
      if (metadata.isTodo) {
        keptTodoCount++;
        continue;
      }

      toRemove.push(roamUid);
    }
  }

  // Remove old entries
  for (const roamUid of toRemove) {
    delete syncMetadataCache[roamUid];
    removedCount++;
  }

  if (removedCount > 0) {
    persistSyncMetadata();
    console.log(`[SyncMetadata] Cleaned up ${removedCount} old entries, kept ${keptTodoCount} TODOs`);
  }

  return { removedCount, keptTodoCount };
};

/**
 * Cleanup ALL past events (manual cleanup)
 * Removes metadata for all events that have ended, regardless of TODO status
 * @returns {object} { removedCount }
 */
export const cleanupAllPastMetadata = () => {
  loadSyncMetadata();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let removedCount = 0;
  const toRemove = [];

  for (const [roamUid, metadata] of Object.entries(syncMetadataCache)) {
    // Skip if no end date stored
    if (!metadata.eventEndDate) {
      continue;
    }

    const endDate = new Date(metadata.eventEndDate);

    // Remove if event ended before today
    if (endDate < today) {
      toRemove.push(roamUid);
    }
  }

  // Remove entries
  for (const roamUid of toRemove) {
    delete syncMetadataCache[roamUid];
    removedCount++;
  }

  if (removedCount > 0) {
    persistSyncMetadata();
    console.log(`[SyncMetadata] Removed ${removedCount} past event entries`);
  }

  return { removedCount };
};

export default {
  createSyncMetadata,
  loadSyncMetadata,
  getSyncMetadata,
  getRoamUidByGCalId,
  saveSyncMetadata,
  updateSyncMetadata,
  deleteSyncMetadata,
  isSynced,
  getGCalIdFromEvent,
  getSyncedEventsForCalendar,
  clearAllSyncMetadata,
  determineSyncStatus,
  SyncStatus,
  getStorageStats,
  cleanupOldMetadata,
  cleanupAllPastMetadata,
};
