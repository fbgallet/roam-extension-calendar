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
  taskDueDate = null, // ISO date string (YYYY-MM-DD) for cleanup purposes
  isTodo = true, // Tasks are TODOs by default (unless completed)
}) => ({
  gTaskId,
  gTaskListId,
  roamUid,
  gTaskUpdated,
  roamUpdated,
  lastSync,
  status,
  taskDueDate,
  isTodo,
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

/**
 * Get storage statistics for task sync metadata
 * @returns {object} { taskCount, todoCount, estimatedBytes }
 */
export const getTaskStorageStats = () => {
  const allMetadata = loadTaskSyncMetadata();
  const entries = Object.entries(allMetadata);

  let todoCount = 0;
  for (const [, metadata] of entries) {
    if (metadata.isTodo || metadata.status === "needsAction") {
      todoCount++;
    }
  }

  // Estimate ~200 bytes per entry (JSON serialized)
  const estimatedBytes = entries.length * 200;

  return {
    taskCount: entries.length,
    todoCount,
    estimatedBytes,
  };
};

/**
 * Cleanup old task sync metadata for past tasks
 * Removes metadata for tasks whose due date is > N days ago,
 * unless the task still has TODO status.
 * @param {number} daysThreshold - Days after which to cleanup (default: 90 days / ~3 months)
 * @returns {object} { removedCount, keptTodoCount }
 */
export const cleanupOldTaskMetadata = (daysThreshold = 90) => {
  loadTaskSyncMetadata();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thresholdDate = new Date(today.getTime() - daysThreshold * 24 * 60 * 60 * 1000);

  let removedCount = 0;
  let keptTodoCount = 0;
  const toRemove = [];

  for (const [roamUid, metadata] of Object.entries(syncMetadataCache)) {
    // Skip if no due date stored (legacy entry, can't determine age)
    if (!metadata.taskDueDate) {
      continue;
    }

    const dueDate = new Date(metadata.taskDueDate);

    // Check if task due date is before threshold
    if (dueDate < thresholdDate) {
      // Keep if it's still a TODO (not completed)
      if (metadata.isTodo || metadata.status === "needsAction") {
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
    persistTaskSyncMetadata();
    console.log(`[TaskSyncMetadata] Cleaned up ${removedCount} old entries, kept ${keptTodoCount} TODOs`);
  }

  return { removedCount, keptTodoCount };
};

/**
 * Cleanup ALL past tasks (manual cleanup)
 * Removes metadata for all tasks whose due date has passed, regardless of TODO status
 * @returns {object} { removedCount }
 */
export const cleanupAllPastTaskMetadata = () => {
  loadTaskSyncMetadata();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let removedCount = 0;
  const toRemove = [];

  for (const [roamUid, metadata] of Object.entries(syncMetadataCache)) {
    // Skip if no due date stored
    if (!metadata.taskDueDate) {
      continue;
    }

    const dueDate = new Date(metadata.taskDueDate);

    // Remove if due date is before today
    if (dueDate < today) {
      toRemove.push(roamUid);
    }
  }

  // Remove entries
  for (const roamUid of toRemove) {
    delete syncMetadataCache[roamUid];
    removedCount++;
  }

  if (removedCount > 0) {
    persistTaskSyncMetadata();
    console.log(`[TaskSyncMetadata] Removed ${removedCount} past task entries`);
  }

  return { removedCount };
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
  getTaskStorageStats,
  cleanupOldTaskMetadata,
  cleanupAllPastTaskMetadata,
};