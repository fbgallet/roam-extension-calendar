/**
 * Google Tasks Service
 * Handles direct interaction with Google Tasks API for importing/syncing tasks
 */

import {
  getTasks,
  updateTask as apiUpdateTask,
  getConnectedTaskLists,
  getTasksEnabled,
} from "./googleCalendarService";

import {
  saveTaskSyncMetadata,
  getTaskSyncMetadata,
  updateTaskSyncMetadata,
  getRoamUidByGTaskId,
  createTaskSyncMetadata,
} from "../models/TaskSyncMetadata";

import { createChildBlock, updateBlock } from "../util/roamApi";

/**
 * Fetch tasks with due dates from all enabled task lists
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @returns {Array} Array of tasks with their list config
 */
export const fetchTasksForRange = async (startDate, endDate) => {
  if (!getTasksEnabled()) return [];

  const connectedLists = getConnectedTaskLists();
  const enabledLists = connectedLists.filter((list) => list.syncEnabled);

  if (enabledLists.length === 0) return [];

  const allTasks = [];

  for (const listConfig of enabledLists) {
    try {
      const tasks = await getTasks(listConfig.id, {
        dueMin: startDate,
        dueMax: endDate,
        showCompleted: true,
      });

      // Filter only tasks with due dates and enrich with list config
      const tasksWithDue = tasks
        .filter((task) => task.due)
        .map((task) => ({
          ...task,
          taskListId: listConfig.id,
          taskListConfig: listConfig,
        }));

      allTasks.push(...tasksWithDue);
    } catch (error) {
      console.error(
        `[Tasks] Failed to fetch from list ${listConfig.name}:`,
        error
      );
    }
  }

  return allTasks;
};

/**
 * Convert a Google Task to Roam block content
 * @param {object} task - Google Task object
 * @param {object} listConfig - Task list configuration
 * @returns {string} Roam block content
 */
export const taskToRoamContent = (task, listConfig) => {
  const isCompleted = task.status === "completed";
  const checkbox = isCompleted ? "{{[[DONE]]}}" : "{{[[TODO]]}}";

  // Build the content with checkbox and title
  let content = `${checkbox} ${task.title || "(No title)"}`;

  // Add trigger tag for the task list
  const primaryTag =
    listConfig.displayName ||
    listConfig.triggerTags?.[0] ||
    listConfig.name;
  if (primaryTag) {
    content += primaryTag.includes(" ")
      ? ` #[[${primaryTag}]]`
      : ` #${primaryTag}`;
  }

  return content;
};

/**
 * Import a Google Task to Roam as a TODO/DONE block
 * @param {object} task - Google Task object
 * @param {object} listConfig - Task list configuration
 * @returns {string|null} New block UID or null if failed
 */
export const importTaskToRoam = async (task, listConfig) => {
  // Parse due date - Tasks API returns YYYY-MM-DDTHH:mm:ss.sssZ format
  const dueDate = new Date(task.due);
  const dnpUid = window.roamAlphaAPI.util.dateToPageUid(dueDate);

  if (!dnpUid) {
    console.error(`[Tasks] Could not find DNP UID for date: ${task.due}`);
    return null;
  }

  const content = taskToRoamContent(task, listConfig);

  try {
    const newBlockUid = await createChildBlock(dnpUid, content);

    // Add task notes as child block if present
    if (task.notes && newBlockUid) {
      await createChildBlock(newBlockUid, task.notes);
    }

    // Save sync metadata
    if (newBlockUid) {
      await saveTaskSyncMetadata(
        newBlockUid,
        createTaskSyncMetadata({
          gTaskId: task.id,
          gTaskListId: listConfig.id,
          roamUid: newBlockUid,
          gTaskUpdated: new Date(task.updated).getTime(),
          roamUpdated: Date.now(),
          status: task.status,
        })
      );
      console.log(
        `[Tasks] Imported task "${task.title}" to Roam block ${newBlockUid}`
      );
    }

    return newBlockUid;
  } catch (error) {
    console.error(`[Tasks] Failed to import task "${task.title}":`, error);
    return null;
  }
};

/**
 * Update an existing Roam block from a Google Task
 * @param {string} roamUid - Roam block UID
 * @param {object} task - Google Task object
 * @param {object} listConfig - Task list configuration
 */
export const updateRoamBlockFromTask = async (roamUid, task, listConfig) => {
  const content = taskToRoamContent(task, listConfig);

  try {
    await updateBlock(roamUid, content);

    // Update sync metadata
    await updateTaskSyncMetadata(roamUid, {
      gTaskUpdated: new Date(task.updated).getTime(),
      roamUpdated: Date.now(),
      status: task.status,
      lastSync: Date.now(),
    });

    console.log(`[Tasks] Updated Roam block ${roamUid} from task "${task.title}"`);
    return true;
  } catch (error) {
    console.error(`[Tasks] Failed to update Roam block ${roamUid}:`, error);
    return false;
  }
};

/**
 * Mark a task as complete in Google Tasks
 * @param {string} taskListId - Task list ID
 * @param {string} taskId - Task ID
 */
export const markTaskComplete = async (taskListId, taskId) => {
  return await apiUpdateTask(taskListId, taskId, {
    status: "completed",
  });
};

/**
 * Mark a task as incomplete in Google Tasks
 * @param {string} taskListId - Task list ID
 * @param {string} taskId - Task ID
 */
export const markTaskIncomplete = async (taskListId, taskId) => {
  return await apiUpdateTask(taskListId, taskId, {
    status: "needsAction",
  });
};

/**
 * Sync task completion status from Roam to Google Tasks
 * Called when a TODO is changed to DONE or vice versa in Roam
 * @param {string} roamUid - Roam block UID
 * @param {boolean} isCompleted - Whether the task is now completed
 */
export const syncTaskCompletionToGoogle = async (roamUid, isCompleted) => {
  const metadata = getTaskSyncMetadata(roamUid);
  if (!metadata) {
    console.log(`[Tasks] No sync metadata for block ${roamUid}`);
    return null;
  }

  try {
    const result = isCompleted
      ? await markTaskComplete(metadata.gTaskListId, metadata.gTaskId)
      : await markTaskIncomplete(metadata.gTaskListId, metadata.gTaskId);

    // Update sync metadata
    await updateTaskSyncMetadata(roamUid, {
      status: isCompleted ? "completed" : "needsAction",
      roamUpdated: Date.now(),
      gTaskUpdated: new Date(result.updated).getTime(),
      lastSync: Date.now(),
    });

    console.log(
      `[Tasks] Synced completion to Google: ${isCompleted ? "completed" : "needsAction"}`
    );
    return result;
  } catch (error) {
    console.error("[Tasks] Failed to sync completion to Google:", error);
    throw error;
  }
};

/**
 * Check if a task already exists in Roam
 * @param {string} gTaskId - Google Task ID
 * @returns {string|null} Roam block UID if exists, null otherwise
 */
export const getExistingRoamBlockForTask = (gTaskId) => {
  return getRoamUidByGTaskId(gTaskId);
};

/**
 * Process tasks for a date range - import new ones, update existing
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @returns {object} Result with imported and updated counts
 */
export const processTasksForRange = async (startDate, endDate) => {
  const result = {
    imported: 0,
    updated: 0,
    errors: 0,
  };

  const tasks = await fetchTasksForRange(startDate, endDate);

  for (const task of tasks) {
    const existingRoamUid = getExistingRoamBlockForTask(task.id);

    if (existingRoamUid) {
      // Task exists in Roam - check for updates
      const metadata = getTaskSyncMetadata(existingRoamUid);
      const gTaskUpdated = new Date(task.updated).getTime();

      if (gTaskUpdated > (metadata?.roamUpdated || 0)) {
        // Google Task is newer - update Roam
        const success = await updateRoamBlockFromTask(
          existingRoamUid,
          task,
          task.taskListConfig
        );
        if (success) {
          result.updated++;
        } else {
          result.errors++;
        }
      }
    } else {
      // New task - import to Roam
      const newBlockUid = await importTaskToRoam(task, task.taskListConfig);
      if (newBlockUid) {
        result.imported++;
      } else {
        result.errors++;
      }
    }
  }

  console.log(
    `[Tasks] Processed ${tasks.length} tasks: ${result.imported} imported, ${result.updated} updated, ${result.errors} errors`
  );
  return result;
};

export default {
  fetchTasksForRange,
  taskToRoamContent,
  importTaskToRoam,
  updateRoamBlockFromTask,
  markTaskComplete,
  markTaskIncomplete,
  syncTaskCompletionToGoogle,
  getExistingRoamBlockForTask,
  processTasksForRange,
};