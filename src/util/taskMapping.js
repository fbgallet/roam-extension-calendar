/**
 * Task Mapping Utilities
 * Converts Google Tasks to FullCalendar events and handles task-related conversions
 */

import { Colors } from "@blueprintjs/core";
import { getTagFromName } from "../models/EventTag";

/**
 * Convert a Google Task to a FullCalendar event
 * @param {object} task - Google Task object
 * @param {object} listConfig - Task list configuration
 * @param {string} roamUid - Optional Roam block UID (if task is already imported)
 * @returns {object} FullCalendar event object
 */
export const taskToFCEvent = (task, listConfig, roamUid = null) => {
  // Tasks API returns due date in YYYY-MM-DDTHH:mm:ss.sssZ format
  // but due dates are actually just dates (no time), so we extract just the date
  const dueDate = task.due ? task.due.split("T")[0] : null;
  const isCompleted = task.status === "completed";

  // Determine tag based on listConfig
  let eventTag;
  if (listConfig.showAsSeparateTag) {
    const tagName = listConfig.displayName || listConfig.name;
    eventTag = getTagFromName(tagName);
  }
  if (!eventTag) {
    eventTag = getTagFromName("Google Tasks");
  }

  // Add TODO or DONE tag
  const statusTag = getTagFromName(isCompleted ? "DONE" : "TODO");
  const eventTags = eventTag ? [eventTag] : [];
  if (statusTag) eventTags.push(statusTag);

  // If roamUid is provided, this is a synced task (exists in Roam)
  // Otherwise, it's a Google Task-only event (like GCal events)
  const isGTaskEvent = !roamUid;

  return {
    id: roamUid || `gtask-${task.id}`,
    title: `${isCompleted ? "{{[[DONE]]}}" : "{{[[TODO]]}}"} ${task.title || "(No title)"}`,
    start: dueDate,
    allDay: true,
    classNames: ["fc-event-gtask", isCompleted ? "fc-event-done" : "fc-event-todo"],
    extendedProps: {
      eventTags,
      isRef: false,
      hasTime: false,
      isGTaskEvent: isGTaskEvent, // Flag for Google Task-only events (not imported to Roam)
      gTaskId: task.id,
      gTaskListId: listConfig.id,
      gTaskStatus: task.status,
      gTaskListName: listConfig.name,
      gTaskData: task, // Store full task data for popover display
      description: task.notes || "",
      roamUid: roamUid,
    },
    color: eventTag?.color || Colors.BLUE3,
    display: "block",
    editable: !isGTaskEvent, // Google Task-only events are not editable (like GCal events)
  };
};

/**
 * Check if a FullCalendar event is a Google Task
 * @param {object} fcEvent - FullCalendar event object
 * @returns {boolean}
 */
export const isGoogleTaskEvent = (fcEvent) => {
  return fcEvent?.extendedProps?.isGoogleTask === true;
};

/**
 * Get Google Task ID from a FullCalendar event
 * @param {object} fcEvent - FullCalendar event object
 * @returns {string|null}
 */
export const getGTaskIdFromFCEvent = (fcEvent) => {
  return fcEvent?.extendedProps?.gTaskId || null;
};

/**
 * Get Google Task List ID from a FullCalendar event
 * @param {object} fcEvent - FullCalendar event object
 * @returns {string|null}
 */
export const getGTaskListIdFromFCEvent = (fcEvent) => {
  return fcEvent?.extendedProps?.gTaskListId || null;
};

/**
 * Check if a Google Task event is completed
 * @param {object} fcEvent - FullCalendar event object
 * @returns {boolean}
 */
export const isGoogleTaskCompleted = (fcEvent) => {
  return fcEvent?.extendedProps?.gTaskStatus === "completed";
};

/**
 * Convert multiple Google Tasks to FullCalendar events
 * @param {array} tasks - Array of Google Task objects with taskListConfig
 * @param {function} getRoamUid - Function to get Roam UID for a task ID
 * @returns {array} Array of FullCalendar events
 */
export const tasksToFCEvents = (tasks, getRoamUid = () => null) => {
  return tasks
    .filter((task) => task.due) // Only tasks with due dates
    .map((task) => {
      const roamUid = getRoamUid(task.id);
      return taskToFCEvent(task, task.taskListConfig, roamUid);
    });
};

/**
 * Format task title for display (remove TODO/DONE markers if present)
 * @param {string} title - Task title
 * @returns {string} Clean title
 */
export const cleanTaskTitle = (title) => {
  if (!title) return "(No title)";
  return title
    .replace(/^\{\{\[\[TODO\]\]\}\}\s*/i, "")
    .replace(/^\{\{\[\[DONE\]\]\}\}\s*/i, "")
    .replace(/^\[\[TODO\]\]\s*/i, "")
    .replace(/^\[\[DONE\]\]\s*/i, "")
    .trim();
};

/**
 * Get display title for a task with status indicator
 * @param {object} task - Google Task object
 * @returns {string} Display title with status
 */
export const getTaskDisplayTitle = (task) => {
  const isCompleted = task.status === "completed";
  const cleanTitle = cleanTaskTitle(task.title);
  return `${isCompleted ? "✓" : "○"} ${cleanTitle}`;
};

export default {
  taskToFCEvent,
  isGoogleTaskEvent,
  getGTaskIdFromFCEvent,
  getGTaskListIdFromFCEvent,
  isGoogleTaskCompleted,
  tasksToFCEvents,
  cleanTaskTitle,
  getTaskDisplayTitle,
};