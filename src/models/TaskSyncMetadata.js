/**
 * TaskSyncMetadata - Handles sync metadata storage for Google Tasks
 *
 * Sync metadata is stored in extension storage, NOT in Roam blocks.
 * Maps Roam block UIDs to their corresponding Google Task IDs.
 */

import { extensionStorage } from "..";

const STORAGE_KEY = "gtasks-sync-metadata";

// In-memory cache of sync metadata
let syncMetadataCache = null;

/**
 * Sync metadata structure for a single task
 */
export const createTaskSyncMetadata = ({
  gTaskId,
  gTaskListId,
  roamUid,
  gTaskUpdated = null,
  roamUpdated = null,
  lastSync = Date.now(),
  status = "needsAction",
}) => ({
  gTaskId,
  gTaskListId,
  roamUid,
  gTaskUpdated,
  roamUpdated,
  lastSync,
  status,
});

/**
 * Load all task sync metadata from storage
 */
export const loadTaskSyncMetadata = () => {
  if (syncMetadataCache !== null) {
    return syncMetadataCache;
  }

  try {
    const stored = extensionStorage.get(STORAGE_KEY);
    syncMetadataCache = stored || {};
    return syncMetadataCache;
  } catch (error) {
    console.error("[TaskSync] Failed to load sync metadata:", error);
    syncMetadataCache = {};
    return syncMetadataCache;
  }
};

/**
 * Save all task sync metadata to storage
 */
const persistTaskSyncMetadata = () => {
  try {
    extensionStorage.set(STORAGE_KEY, syncMetadataCache);
  } catch (error) {
    console.error("[TaskSync] Failed to persist sync metadata:", error);
  }
};

/**
 * Get sync metadata for a specific Roam block
 * @param {string} roamUid - Roam block UID
 * @returns {object|null} Sync metadata or null if not found
 */
export const getTaskSyncMetadata = (roamUid) => {
  const allMetadata = loadTaskSyncMetadata();
  return allMetadata[roamUid] || null;
};

/**
 * Get sync metadata by Google Task ID
 * @param {string} gTaskId - Google Task ID
 * @returns {object|null} Sync metadata or null if not found
 */
export const getTaskSyncMetadataByGTaskId = (gTaskId) => {
  const allMetadata = loadTaskSyncMetadata();
  for (const [roamUid, metadata] of Object.entries(allMetadata)) {
    if (metadata.gTaskId === gTaskId) {
      return { ...metadata, roamUid };
    }
  }
  return null;
};

/**
 * Get Roam UID by Google Task ID
 * @param {string} gTaskId - Google Task ID
 * @returns {string|null} Roam block UID or null if not found
 */
export const getRoamUidByGTaskId = (gTaskId) => {
  const allMetadata = loadTaskSyncMetadata();
  for (const [roamUid, metadata] of Object.entries(allMetadata)) {
    if (metadata.gTaskId === gTaskId) {
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
export const saveTaskSyncMetadata = async (roamUid, metadata) => {
  loadTaskSyncMetadata(); // Ensure cache is loaded
  syncMetadataCache[roamUid] = metadata;
  persistTaskSyncMetadata();
  return roamUid;
};

/**
 * Update specific fields in sync metadata
 * @param {string} roamUid - Roam block UID
 * @param {object} updates - Fields to update
 */
export const updateTaskSyncMetadata = async (roamUid, updates) => {
  const existing = getTaskSyncMetadata(roamUid);

  if (existing) {
    const updatedMetadata = { ...existing, ...updates };
    await saveTaskSyncMetadata(roamUid, updatedMetadata);
    return updatedMetadata;
  }

  return null;
};

/**
 * Delete sync metadata for a Roam block
 * @param {string} roamUid - Roam block UID
 */
export const deleteTaskSyncMetadata = async (roamUid) => {
  loadTaskSyncMetadata();

  if (syncMetadataCache[roamUid]) {
    delete syncMetadataCache[roamUid];
    persistTaskSyncMetadata();
    return true;
  }

  return false;
};

/**
 * Check if a Roam block is synced with a Google Task
 * @param {string} roamUid - Roam block UID
 */
export const isTaskSynced = (roamUid) => {
  return getTaskSyncMetadata(roamUid) !== null;
};

/**
 * Get the Google Task ID from a Roam block's metadata
 * @param {string} roamUid - Roam block UID
 */
export const getGTaskIdFromBlock = (roamUid) => {
  const metadata = getTaskSyncMetadata(roamUid);
  return metadata ? metadata.gTaskId : null;
};

/**
 * Get all synced tasks for a specific task list
 * @param {string} taskListId - Google Task List ID
 */
export const getSyncedTasksForList = (taskListId) => {
  const allMetadata = loadTaskSyncMetadata();
  const result = {};

  for (const [roamUid, metadata] of Object.entries(allMetadata)) {
    if (metadata.gTaskListId === taskListId) {
      result[roamUid] = metadata;
    }
  }

  return result;
};

/**
 * Clear all task sync metadata (useful for disconnecting)
 */
export const clearAllTaskSyncMetadata = () => {
  syncMetadataCache = {};
  persistTaskSyncMetadata();
};

/**
 * Sync status types for tasks
 */
export const TaskSyncStatus = {
  SYNCED: "synced",
  PENDING: "pending",
  CONFLICT: "conflict",
  LOCAL_ONLY: "local-only",
  GTASK_ONLY: "gtask-only",
};

/**
 * Determine sync status by comparing timestamps
 */
export const determineTaskSyncStatus = (metadata, gTask) => {
  if (!metadata) {
    return TaskSyncStatus.LOCAL_ONLY;
  }

  if (!gTask) {
    // Google Task might have been deleted
    return TaskSyncStatus.LOCAL_ONLY;
  }

  const gTaskUpdated = new Date(gTask.updated).getTime();
  const roamUpdated = metadata.roamUpdated || metadata.lastSync;

  // Both modified since last sync
  if (gTaskUpdated > metadata.lastSync && roamUpdated > metadata.lastSync) {
    return TaskSyncStatus.CONFLICT;
  }

  // Google Task is newer
  if (gTaskUpdated > roamUpdated) {
    return TaskSyncStatus.PENDING; // Needs update from Google
  }

  // Roam is newer
  if (roamUpdated > gTaskUpdated) {
    return TaskSyncStatus.PENDING; // Needs update to Google
  }

  return TaskSyncStatus.SYNCED;
};

export default {
  createTaskSyncMetadata,
  loadTaskSyncMetadata,
  getTaskSyncMetadata,
  getTaskSyncMetadataByGTaskId,
  getRoamUidByGTaskId,
  saveTaskSyncMetadata,
  updateTaskSyncMetadata,
  deleteTaskSyncMetadata,
  isTaskSynced,
  getGTaskIdFromBlock,
  getSyncedTasksForList,
  clearAllTaskSyncMetadata,
  determineTaskSyncStatus,
  TaskSyncStatus,
};