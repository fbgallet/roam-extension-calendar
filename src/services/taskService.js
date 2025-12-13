/**
 * Task Service - Handles enrichment of Google Calendar events that are actually Tasks
 *
 * Google Tasks created in Calendar appear as events with a generic description
 * containing a link to the task. This service fetches the actual task data
 * to replace the placeholder description with the real task notes.
 */

import { listTaskLists, getTasks } from "./googleCalendarService";
import { isGCalTask, extractTaskIdFromEvent } from "../util/gcalMapping";

// Cache for tasks to avoid repeated API calls
let tasksCache = {
  tasks: [], // Array of all fetched tasks
  tasksByWebViewLink: new Map(), // Map webViewLink -> task
  tasksByTitleAndDue: new Map(), // Map "title|dueDate" -> task
  lastFetched: null,
  fetchedRange: null,
};

/**
 * Clear the tasks cache
 */
export const clearTasksCache = () => {
  tasksCache = {
    tasks: [],
    tasksByWebViewLink: new Map(),
    tasksByTitleAndDue: new Map(),
    lastFetched: null,
    fetchedRange: null,
  };
};

/**
 * Fetch and cache all tasks for a date range
 * @param {Date} timeMin - Start of date range
 * @param {Date} timeMax - End of date range
 * @param {boolean} forceRefresh - Force refresh even if cache is valid
 */
export const fetchAndCacheTasks = async (timeMin, timeMax, forceRefresh = false) => {
  // Check if cache is still valid (fetched within last 5 minutes for same range)
  const now = Date.now();
  const cacheValid =
    !forceRefresh &&
    tasksCache.lastFetched &&
    now - tasksCache.lastFetched < 5 * 60 * 1000 &&
    tasksCache.fetchedRange?.min === timeMin.toISOString() &&
    tasksCache.fetchedRange?.max === timeMax.toISOString();

  if (cacheValid) {
    console.log("[Tasks] Using cached tasks data");
    return tasksCache.tasks;
  }

  console.log("[Tasks] Fetching tasks from Google Tasks API...");

  try {
    const taskLists = await listTaskLists();

    if (!taskLists || taskLists.length === 0) {
      console.log("[Tasks] No task lists found (user may need to re-authenticate with Tasks scope)");
      return [];
    }

    const allTasks = [];

    for (const taskList of taskLists) {
      try {
        const tasks = await getTasks(taskList.id, {
          dueMin: timeMin,
          dueMax: timeMax,
          showCompleted: true,
        });

        for (const task of tasks) {
          const enrichedTask = {
            ...task,
            taskListId: taskList.id,
            taskListTitle: taskList.title,
          };
          allTasks.push(enrichedTask);
        }
      } catch (error) {
        // Check if it's an auth error
        if (error?.status === 401 || error?.status === 403) {
          console.error("[Tasks] Authentication error - user needs to re-authenticate with Tasks scope");
        } else {
          console.warn(`[Tasks] Failed to fetch tasks from list "${taskList.title}":`, error);
        }
      }
    }

    // Build lookup maps
    const tasksByWebViewLink = new Map();
    const tasksByTitleAndDue = new Map();

    for (const task of allTasks) {
      // Index by webViewLink if available
      if (task.webViewLink) {
        tasksByWebViewLink.set(task.webViewLink, task);
      }

      // Index by title + due date for fallback matching
      if (task.title && task.due) {
        const key = `${task.title.toLowerCase()}|${task.due.split("T")[0]}`;
        tasksByTitleAndDue.set(key, task);
      }
    }

    // Update cache
    tasksCache = {
      tasks: allTasks,
      tasksByWebViewLink,
      tasksByTitleAndDue,
      lastFetched: now,
      fetchedRange: {
        min: timeMin.toISOString(),
        max: timeMax.toISOString(),
      },
    };

    console.log(`[Tasks] Cached ${allTasks.length} tasks from ${taskLists.length} task lists`);
    return allTasks;
  } catch (error) {
    console.error("[Tasks] Failed to fetch tasks:", error);
    return [];
  }
};

/**
 * Find the matching task for a Google Calendar event
 * @param {object} gcalEvent - Google Calendar event object
 * @returns {object|null} Matching task or null
 */
export const findTaskForEvent = (gcalEvent) => {
  if (!isGCalTask(gcalEvent)) {
    return null;
  }

  // Extract task ID from the event description
  const taskId = extractTaskIdFromEvent(gcalEvent);

  if (taskId) {
    // Try to find by webViewLink (contains the task ID)
    for (const [webViewLink, task] of tasksCache.tasksByWebViewLink) {
      if (webViewLink.includes(taskId)) {
        return task;
      }
    }

    // Also check task IDs directly
    const taskById = tasksCache.tasks.find((t) => t.id === taskId);
    if (taskById) {
      return taskById;
    }
  }

  // Fallback: match by title + due date
  const eventTitle = gcalEvent.summary?.toLowerCase();
  const eventDue = (gcalEvent.start?.date || gcalEvent.start?.dateTime)?.split("T")[0];

  if (eventTitle && eventDue) {
    const key = `${eventTitle}|${eventDue}`;
    const taskByTitleDue = tasksCache.tasksByTitleAndDue.get(key);
    if (taskByTitleDue) {
      return taskByTitleDue;
    }
  }

  return null;
};

/**
 * Enrich a Google Calendar event with task data if it's a task
 * Replaces the placeholder description with the actual task notes
 * @param {object} gcalEvent - Google Calendar event object
 * @returns {object} Enriched event (or original if not a task)
 */
export const enrichEventWithTaskData = (gcalEvent) => {
  if (!isGCalTask(gcalEvent)) {
    return gcalEvent;
  }

  const task = findTaskForEvent(gcalEvent);

  if (!task) {
    console.log(`[Tasks] No matching task found for event "${gcalEvent.summary}"`);
    return gcalEvent;
  }

  console.log(`[Tasks] Enriching event "${gcalEvent.summary}" with task notes`);

  // Create enriched event with task data
  return {
    ...gcalEvent,
    // Replace the placeholder description with actual task notes
    description: task.notes || "",
    // Add task metadata to extendedProps for reference
    _taskData: {
      taskId: task.id,
      taskListId: task.taskListId,
      taskListTitle: task.taskListTitle,
      status: task.status,
      completed: task.completed,
      webViewLink: task.webViewLink,
    },
  };
};

/**
 * Enrich multiple Google Calendar events with task data
 * @param {array} gcalEvents - Array of Google Calendar events
 * @param {Date} timeMin - Start of date range (for fetching tasks)
 * @param {Date} timeMax - End of date range (for fetching tasks)
 * @returns {array} Array of enriched events
 */
export const enrichEventsWithTaskData = async (gcalEvents, timeMin, timeMax) => {
  // Check if any events are tasks
  const taskEvents = gcalEvents.filter(isGCalTask);

  if (taskEvents.length === 0) {
    return gcalEvents;
  }

  console.log(`[Tasks] Found ${taskEvents.length} task events to enrich`);

  // Fetch and cache tasks for the date range
  await fetchAndCacheTasks(timeMin, timeMax);

  // Enrich each event
  return gcalEvents.map(enrichEventWithTaskData);
};

export default {
  clearTasksCache,
  fetchAndCacheTasks,
  findTaskForEvent,
  enrichEventWithTaskData,
  enrichEventsWithTaskData,
};