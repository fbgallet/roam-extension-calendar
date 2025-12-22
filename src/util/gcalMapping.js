/**
 * Google Calendar Event Mapping Utilities
 *
 * Handles conversion between Google Calendar events and FullCalendar events
 */

import { getTagFromName } from "../models/EventTag";
import { SyncStatus } from "../models/SyncMetadata";
import { dateToISOString } from "./dates";
import { getUseOriginalColors } from "../services/googleCalendarService";
import { getBlockContentByUid } from "./roamApi";

// Google Calendar event colorId to hex color mapping
// See: https://developers.google.com/calendar/api/v3/reference/colors
const GCAL_EVENT_COLORS = {
  "1": "#a4bdfc", // Lavender
  "2": "#7ae7bf", // Sage
  "3": "#dbadff", // Grape
  "4": "#ff887c", // Flamingo
  "5": "#fbd75b", // Banana
  "6": "#ffb878", // Tangerine
  "7": "#46d6db", // Peacock
  "8": "#e1e1e1", // Graphite
  "9": "#5484ed", // Blueberry
  "10": "#51b749", // Basil
  "11": "#dc2127", // Tomato
};

// ============================================
// Google Tasks Detection Utilities
// ============================================

/**
 * Pattern to detect Google Tasks in calendar event descriptions
 * Tasks created in Google Calendar have a URL like: https://tasks.google.com/task/{taskId}
 */
const TASKS_URL_PATTERN = /https:\/\/tasks\.google\.com\/task\/([a-zA-Z0-9_-]+)/;

/**
 * Check if a Google Calendar event is actually a Google Task
 * Tasks appear in Calendar with a generic description containing a tasks.google.com link
 * @param {object} gcalEvent - Google Calendar event object
 * @returns {boolean} True if the event is a Google Task
 */
export const isGCalTask = (gcalEvent) => {
  return TASKS_URL_PATTERN.test(gcalEvent.description || "");
};

/**
 * Extract the Google Task ID from a calendar event's description
 * @param {object} gcalEvent - Google Calendar event object
 * @returns {string|null} Task ID if found, null otherwise
 */
export const extractTaskIdFromEvent = (gcalEvent) => {
  const match = (gcalEvent.description || "").match(TASKS_URL_PATTERN);
  return match ? match[1] : null;
};

/**
 * Convert a Google Calendar event to a FullCalendar event
 * @param {object} gcalEvent - Google Calendar event object
 * @param {object} calendarConfig - Connected calendar configuration
 * @returns {object} FullCalendar event object
 */
export const gcalEventToFCEvent = (gcalEvent, calendarConfig) => {
  const isAllDay = !gcalEvent.start.dateTime;

  // Determine which tag to use based on showAsSeparateTag
  let eventTag;
  if (calendarConfig.showAsSeparateTag) {
    // Calendar has its own separate tag - use displayName
    const tagName = calendarConfig.displayName || calendarConfig.name;
    eventTag = getTagFromName(tagName);
  }

  // Fall back to main "Google calendar" tag
  if (!eventTag) {
    eventTag = getTagFromName("Google calendar");
  }

  // Build event tags array
  const eventTags = eventTag ? [eventTag] : [];

  // For Google Tasks, add TODO or DONE tag based on task status
  const taskData = gcalEvent._taskData;
  if (taskData) {
    const statusTag = taskData.status === "completed"
      ? getTagFromName("DONE")
      : getTagFromName("TODO");
    if (statusTag) {
      eventTags.push(statusTag);
    }
  }

  // Determine color - use original GCal color if setting enabled, otherwise use tag color
  let eventColor;
  if (getUseOriginalColors()) {
    // Priority: event's colorId > calendar's backgroundColor > tag color > default
    if (gcalEvent.colorId && GCAL_EVENT_COLORS[gcalEvent.colorId]) {
      eventColor = GCAL_EVENT_COLORS[gcalEvent.colorId];
    } else if (calendarConfig.backgroundColor) {
      eventColor = calendarConfig.backgroundColor;
    } else {
      eventColor = eventTag?.color || "#4285f4";
    }
  } else {
    eventColor = eventTag?.color || "#4285f4";
  }

  const fcEvent = {
    id: `gcal-${gcalEvent.id}`, // Prefix to distinguish from Roam UIDs
    title: gcalEvent.summary || "(No title)",
    start: isAllDay ? gcalEvent.start.date : gcalEvent.start.dateTime,
    end: isAllDay ? gcalEvent.end.date : gcalEvent.end.dateTime,
    allDay: isAllDay,
    classNames: ["fc-event-gcal"],
    extendedProps: {
      eventTags,
      isRef: false,
      hasTime: !isAllDay,
      // GCal-specific metadata
      gCalId: gcalEvent.id,
      gCalCalendarId: calendarConfig.id,
      gCalCalendarName: calendarConfig.name, // Original calendar name for display
      gCalEtag: gcalEvent.etag,
      gCalUpdated: gcalEvent.updated,
      description: gcalEvent.description || "",
      location: gcalEvent.location || "",
      syncStatus: SyncStatus.GCAL_ONLY,
      isGCalEvent: true,
      // Google Task data (if this event is a task enriched by taskService)
      _taskData: gcalEvent._taskData || null,
      // Original GCal data for reference
      gCalEventData: {
        htmlLink: gcalEvent.htmlLink,
        creator: gcalEvent.creator,
        organizer: gcalEvent.organizer,
        attendees: gcalEvent.attendees,
        recurrence: gcalEvent.recurrence,
        recurringEventId: gcalEvent.recurringEventId,
        status: gcalEvent.status,
      },
    },
    color: eventColor,
    editable: calendarConfig.syncDirection !== "import",
    // Don't set url property - it causes FullCalendar to navigate on click
    // Store htmlLink in extendedProps instead for manual access
    display: "block",
  };

  return fcEvent;
};

/**
 * Convert a FullCalendar/Roam event to a Google Calendar event
 * @param {object} fcEvent - FullCalendar event object
 * @param {string} calendarId - Target Google Calendar ID
 * @param {string} roamUid - Optional Roam block UID to add link to description
 * @returns {object} Google Calendar event resource
 */
export const fcEventToGCalEvent = (fcEvent, calendarId, roamUid = null) => {
  // For events with children (like multi-day events with until:: child),
  // use only the parent block content, not the flattened content
  let title = fcEvent.title;
  if (roamUid && fcEvent.extendedProps?.hasInfosInChildren) {
    // Get only the parent block content, excluding children
    const parentContent = getBlockContentByUid(roamUid);
    if (parentContent) {
      title = parentContent;
    }
  }
  title = cleanTitleForGCal(title);
  const isAllDay = fcEvent.allDay || !fcEvent.extendedProps?.hasTime;

  const gcalEvent = {
    summary: title,
  };

  // Build description with optional Roam link
  let description = fcEvent.extendedProps?.description || "";

  // Add Roam block link if roamUid provided
  if (roamUid) {
    const graphName = window.roamAlphaAPI?.graph?.name;
    if (graphName) {
      const roamLink = `https://roamresearch.com/#/app/${graphName}/page/${roamUid}`;
      // Remove old Roam link if exists
      description = description.replace(/\n*---\nRoam block:.*$/s, "").trim();
      // Add new link
      description += `\n\n---\nRoam block: ${roamLink}`;
    }
  }

  if (description) {
    gcalEvent.description = description;
  }

  // Ensure start is a valid Date object
  let startDate = fcEvent.start;
  if (!(startDate instanceof Date)) {
    startDate = new Date(startDate);
  }
  if (isNaN(startDate.getTime())) {
    // Try alternative date sources before falling back to now
    if (fcEvent.date) {
      startDate = new Date(fcEvent.date);
    }
    if (isNaN(startDate.getTime())) {
      console.error("Invalid start date for GCal event:", fcEvent.start, fcEvent.date);
      startDate = new Date(); // Fallback to now as last resort
    }
  }

  // Handle start time
  if (isAllDay) {
    gcalEvent.start = {
      date: formatDateForGCal(startDate),
    };
  } else {
    gcalEvent.start = {
      dateTime: formatDateTimeForGCal(startDate),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  // Handle end time
  let endDate = fcEvent.end;
  if (endDate) {
    if (!(endDate instanceof Date)) {
      endDate = new Date(endDate);
    }
    if (isNaN(endDate.getTime())) {
      endDate = null; // Invalid, will use default below
    }
  }

  if (endDate) {
    if (isAllDay) {
      gcalEvent.end = {
        date: formatDateForGCal(endDate),
      };
    } else {
      gcalEvent.end = {
        dateTime: formatDateTimeForGCal(endDate),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
  } else {
    // If no end time, set end to start + 1 day for all-day or start + 1 hour for timed
    if (isAllDay) {
      const defaultEnd = new Date(startDate);
      defaultEnd.setDate(defaultEnd.getDate() + 1);
      gcalEvent.end = {
        date: formatDateForGCal(defaultEnd),
      };
    } else {
      const defaultEnd = new Date(startDate);
      defaultEnd.setHours(defaultEnd.getHours() + 1);
      gcalEvent.end = {
        dateTime: formatDateTimeForGCal(defaultEnd),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
  }

  return gcalEvent;
};

/**
 * Clean a Roam block title for Google Calendar
 * Removes Roam-specific syntax but preserves TODO/DONE as [[TODO]]/[[DONE]]
 */
export const cleanTitleForGCal = (title) => {
  if (!title) return "";

  let cleaned = title;

  // Remove bullet points at the beginning (• or -)
  cleaned = cleaned.replace(/^[•\-]\s*/, "");

  // Convert {{[[TODO]]}} and {{[[DONE]]}} to [[TODO]] and [[DONE]] for GCal
  // This allows bidirectional sync of task status
  cleaned = cleaned.replace(/\{\{\[\[TODO\]\]\}\}/g, "[[TODO]]");
  cleaned = cleaned.replace(/\{\{\[\[DONE\]\]\}\}/g, "[[DONE]]");

  // Remove page references [[Page Name]] EXCEPT [[TODO]] and [[DONE]]
  cleaned = cleaned.replace(/\[\[(?!TODO\]\]|DONE\]\])([^\]]+)\]\]/g, "$1");

  // Remove block references ((block-uid))
  cleaned = cleaned.replace(/\(\([a-zA-Z0-9_-]+\)\)/g, "");

  // Remove hashtags #tag or #[[tag]]
  cleaned = cleaned.replace(/#\[\[([^\]]+)\]\]/g, "");
  cleaned = cleaned.replace(/#([^\s]+)/g, "");

  // Remove timestamps (common formats)
  // cleaned = cleaned.replace(/\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?/gi, "");

  // Remove block embeds {{embed: ((uid))}}
  cleaned = cleaned.replace(/\{\{embed:\s*\(\([a-zA-Z0-9_-]+\)\)\}\}/g, "");

  // Remove other Roam syntax (but not [[TODO]]/[[DONE]])
  cleaned = cleaned.replace(/\{\{[^}]+\}\}/g, "");

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned || "(No title)";
};

/**
 * Format a date for Google Calendar (all-day events)
 * Format: YYYY-MM-DD
 */
export const formatDateForGCal = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Format a datetime for Google Calendar
 * Format: YYYY-MM-DDTHH:mm:ss
 */
export const formatDateTimeForGCal = (date) => {
  const d = new Date(date);
  return d.toISOString();
};

/**
 * Merge GCal event data with existing FC event
 * Used when updating a synced event
 */
export const mergeGCalDataToFCEvent = (fcEvent, gcalEvent, calendarConfig) => {
  const updated = { ...fcEvent };

  // Update basic properties
  updated.title = gcalEvent.summary || updated.title;

  const isAllDay = !gcalEvent.start.dateTime;
  updated.start = isAllDay ? gcalEvent.start.date : gcalEvent.start.dateTime;
  updated.end = isAllDay
    ? gcalEvent.end?.date
    : gcalEvent.end?.dateTime || null;
  updated.allDay = isAllDay;

  // Update extended props
  updated.extendedProps = {
    ...updated.extendedProps,
    gCalEtag: gcalEvent.etag,
    gCalUpdated: gcalEvent.updated,
    description: gcalEvent.description || "",
    location: gcalEvent.location || "",
    syncStatus: SyncStatus.SYNCED,
  };

  return updated;
};

/**
 * Check if two events represent the same calendar entry
 */
export const isSameEvent = (fcEvent, gcalEvent) => {
  // Check by GCal ID stored in extendedProps
  if (fcEvent.extendedProps?.gCalId === gcalEvent.id) {
    return true;
  }

  // Check by prefixed ID
  if (fcEvent.id === `gcal-${gcalEvent.id}`) {
    return true;
  }

  return false;
};

/**
 * Determine if an FC event should be synced based on its tags
 * @param {object} fcEvent - FullCalendar event
 * @param {array} connectedCalendars - Array of connected calendar configs
 * @returns {object|null} Calendar config to sync to, or null if no match
 */
export const findCalendarForEvent = (fcEvent, connectedCalendars) => {
  const eventTags = fcEvent.extendedProps?.eventTags || [];

  for (const calendar of connectedCalendars) {
    if (!calendar.syncEnabled) continue;
    if (calendar.syncDirection === "import") continue;

    // Check if any event tag matches displayName (primary tag) or trigger tags (aliases)
    for (const eventTag of eventTags) {
      const tagName = eventTag.name?.toLowerCase();

      // Check displayName first (for calendars with showAsSeparateTag)
      if (
        calendar.displayName &&
        calendar.displayName.toLowerCase() === tagName
      ) {
        return calendar;
      }

      // Check trigger tags (aliases) - check both tag name and tag pages (which include aliases)
      if (calendar.triggerTags && calendar.triggerTags.length > 0) {
        // Check if tag name matches any trigger tag
        if (calendar.triggerTags.some((trigger) => trigger.toLowerCase() === tagName)) {
          return calendar;
        }

        // Also check if any of the tag's pages (aliases) match trigger tags
        // This handles cases where #gcal gets resolved to "Google calendar" tag
        // but the tag object has pages: ["Google calendar", "gcal"]
        if (eventTag.pages && Array.isArray(eventTag.pages)) {
          for (const page of eventTag.pages) {
            if (calendar.triggerTags.some((trigger) => trigger.toLowerCase() === page.toLowerCase())) {
              return calendar;
            }
          }
        }
      }
    }
  }

  return null;
};

/**
 * Check if an event has any sync trigger tags
 */
export const hasSyncTriggerTag = (fcEvent, connectedCalendars) => {
  return findCalendarForEvent(fcEvent, connectedCalendars) !== null;
};

/**
 * Convert [[TODO]] or [[DONE]] in GCal title to Roam {{[[TODO]]}} or {{[[DONE]]}} format
 * @param {string} title - GCal event title
 * @returns {string} Title with converted TODO/DONE syntax
 */
export const convertGCalTodoToRoam = (title) => {
  if (!title) return title;
  let converted = title;
  // Convert [[TODO]] to {{[[TODO]]}} and [[DONE]] to {{[[DONE]]}}
  converted = converted.replace(/\[\[TODO\]\]/g, "{{[[TODO]]}}");
  converted = converted.replace(/\[\[DONE\]\]/g, "{{[[DONE]]}}");
  return converted;
};

/**
 * Extract Roam block content from GCal event
 * Used when importing a GCal event to Roam
 * Converts [[TODO]]/[[DONE]] in GCal back to {{[[TODO]]}}/{{[[DONE]]}} in Roam
 */
export const gcalEventToRoamContent = (gcalEvent, calendarConfig) => {
  let content = "";

  // Add time if it's a timed event
  if (gcalEvent.start.dateTime) {
    const startDate = new Date(gcalEvent.start.dateTime);
    const hours = startDate.getHours();
    const minutes = startDate.getMinutes();
    const timeStr = `${hours}:${String(minutes).padStart(2, "0")}`;

    if (gcalEvent.end?.dateTime) {
      const endDate = new Date(gcalEvent.end.dateTime);
      const endHours = endDate.getHours();
      const endMinutes = endDate.getMinutes();
      const endTimeStr = `${endHours}:${String(endMinutes).padStart(2, "0")}`;
      content += `${timeStr}-${endTimeStr} `;
    } else {
      content += `${timeStr} `;
    }
  }

  // Get title and convert [[TODO]]/[[DONE]] to Roam format
  let title = gcalEvent.summary || "(No title)";
  title = convertGCalTodoToRoam(title);
  content += title;

  // Add trigger tag
  const primaryTag = calendarConfig.triggerTags?.[0];
  if (primaryTag) {
    content += primaryTag.includes(" ") ? ` #[[${primaryTag}]]` : ` #${primaryTag}`;
  }

  return content;
};

export default {
  // Task detection
  isGCalTask,
  extractTaskIdFromEvent,
  // Event mapping
  gcalEventToFCEvent,
  fcEventToGCalEvent,
  cleanTitleForGCal,
  formatDateForGCal,
  formatDateTimeForGCal,
  mergeGCalDataToFCEvent,
  isSameEvent,
  findCalendarForEvent,
  hasSyncTriggerTag,
  gcalEventToRoamContent,
  convertGCalTodoToRoam,
};
