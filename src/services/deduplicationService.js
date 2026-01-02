/**
 * Deduplication Service
 *
 * Handles detection and removal of duplicate Google Calendar events.
 * Duplicates can occur when:
 * - Extension storage is cleared and events are re-synced
 * - Manual event creation creates duplicates
 * - Sync issues cause multiple copies
 *
 * Strategy: Keep synced events (with Roam block link), remove pure duplicates
 */

import { deleteEvent as deleteGCalEvent } from "./googleCalendarService";
import { getSyncMetadata, getRoamUidByGCalId } from "../models/SyncMetadata";
import { extensionStorage } from "..";

const DEDUP_RUN_KEY = "gcal-dedup-last-run";
const DEDUP_COOLDOWN_MS = 24 * 60 * 60 * 1000; // Run once per day max

/**
 * Compare two events for similarity
 * @param {object} event1 - First event
 * @param {object} event2 - Second event
 * @returns {boolean} True if events are duplicates
 */
export const areEventsDuplicate = (event1, event2) => {
  // Same ID means same event, not duplicate
  if (event1.id === event2.id) return false;

  // Normalize titles for comparison
  // This must match cleanTitleForGCal logic to properly compare Roam vs GCal titles
  const normalizeTitle = (title) => {
    let normalized = (title || "")
      // Remove any non-alphanumeric prefix (bullets, dashes, special chars)
      .replace(/^[^\w\s\[\{#]+\s*/, "")
      // Remove TODO/DONE markers (various formats)
      .replace(/\{\{\[\[TODO\]\]\}\}\s*/g, "")
      .replace(/\{\{\[\[DONE\]\]\}\}\s*/g, "")
      .replace(/\[\[TODO\]\]\s*/g, "")
      .replace(/\[\[DONE\]\]\s*/g, "")
      .replace(/^\[\s*\]\s*/g, "")
      .replace(/^\[x\]\s*/gi, "")
      // Remove page references [[Page Name]] -> Page Name
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      // Remove hashtags #tag or #[[tag]]
      .replace(/#\[\[([^\]]+)\]\]/g, "")
      .replace(/#([^\s]+)/g, "")
      // Remove block embeds {{embed: ((uid))}}
      .replace(/\{\{embed:\s*\(\([a-zA-Z0-9_-]+\)\)\}\}/g, "")
      // Remove other Roam syntax {{...}}
      .replace(/\{\{[^}]+\}\}/g, "")
      // Clean up extra whitespace
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return normalized;
  };

  const title1 = normalizeTitle(event1.summary || event1.title);
  const title2 = normalizeTitle(event2.summary || event2.title);

  // Debug logging for duplicate detection
  // console.log(`[Dedup] Comparing titles:`, {
  //   raw1: event1.summary || event1.title,
  //   raw2: event2.summary || event2.title,
  //   normalized1: title1,
  //   normalized2: title2,
  //   match: title1 === title2,
  // });

  // Titles must match
  if (title1 !== title2) return false;

  // Get start times - normalize to handle timezone differences
  // GCal events have start.dateTime (ISO string), FC events have start as Date object
  const getStartTime = (event) => {
    if (event.start?.dateTime) {
      // GCal format: { dateTime: "2025-12-02T01:00:00+01:00" }
      return new Date(event.start.dateTime);
    } else if (event.start?.date) {
      // All-day GCal format: { date: "2025-12-02" }
      return new Date(event.start.date + "T00:00:00");
    } else if (event.start instanceof Date) {
      // FullCalendar Date object - already in local time
      return event.start;
    } else {
      // String or other format
      return new Date(event.start);
    }
  };

  const start1 = getStartTime(event1);
  const start2 = getStartTime(event2);

  // Compare using local time components to avoid timezone issues
  const sameStartTime =
    start1.getFullYear() === start2.getFullYear() &&
    start1.getMonth() === start2.getMonth() &&
    start1.getDate() === start2.getDate() &&
    start1.getHours() === start2.getHours() &&
    start1.getMinutes() === start2.getMinutes();

  // console.log(`[Dedup] Time comparison:`, {
  //   start1: start1.toISOString(),
  //   start2: start2.toISOString(),
  //   start1Local: `${start1.getFullYear()}-${start1.getMonth()+1}-${start1.getDate()} ${start1.getHours()}:${start1.getMinutes()}`,
  //   start2Local: `${start2.getFullYear()}-${start2.getMonth()+1}-${start2.getDate()} ${start2.getHours()}:${start2.getMinutes()}`,
  //   startMatch: sameStartTime,
  // });
  if (!sameStartTime) return false;

  // Get end times if they exist - use same normalization
  const getEndTime = (event) => {
    if (event.end?.dateTime) {
      return new Date(event.end.dateTime);
    } else if (event.end?.date) {
      return new Date(event.end.date + "T00:00:00");
    } else if (event.end instanceof Date) {
      return event.end;
    } else if (event.end) {
      return new Date(event.end);
    }
    return null;
  };

  const endDate1 = getEndTime(event1);
  const endDate2 = getEndTime(event2);

  if (endDate1 && endDate2) {
    const sameEndTime =
      endDate1.getFullYear() === endDate2.getFullYear() &&
      endDate1.getMonth() === endDate2.getMonth() &&
      endDate1.getDate() === endDate2.getDate() &&
      endDate1.getHours() === endDate2.getHours() &&
      endDate1.getMinutes() === endDate2.getMinutes();

    // console.log(`[Dedup] End time comparison:`, {
    //   end1: endDate1.toISOString(),
    //   end2: endDate2.toISOString(),
    //   end1Local: `${endDate1.getFullYear()}-${endDate1.getMonth()+1}-${endDate1.getDate()} ${endDate1.getHours()}:${endDate1.getMinutes()}`,
    //   end2Local: `${endDate2.getFullYear()}-${endDate2.getMonth()+1}-${endDate2.getDate()} ${endDate2.getHours()}:${endDate2.getMinutes()}`,
    //   endMatch: sameEndTime,
    // });
    if (!sameEndTime) return false;
  }

  return true;
};

/**
 * Check if an event is synced to Roam
 * @param {object} event - GCal event
 * @param {string} eventId - Optional Roam block UID (for FC events)
 * @returns {boolean} True if event is synced to Roam
 */
export const isEventSyncedToRoam = (event, eventId = null) => {
  // If we have a Roam block UID, check sync metadata
  if (eventId) {
    const metadata = getSyncMetadata(eventId);
    if (metadata?.gCalId === event.id) {
      // console.log(`[Dedup] Event "${event.summary}" (${event.id}) is synced via eventId metadata`);
      return true;
    }
  }

  // Check sync metadata by GCal ID (most reliable method)
  // This handles batch deduplication where we don't have the Roam UID
  const roamUid = getRoamUidByGCalId(event.id);
  if (roamUid) {
    // console.log(`[Dedup] Event "${event.summary}" (${event.id}) is synced via gCalId lookup -> roamUid: ${roamUid}`);
    return true;
  }

  // Fallback: Check if event description contains Roam block link
  if (event.description) {
    const hasRoamLink =
      /Roam block:\s*https:\/\/roamresearch\.com\/#\/app\/[^/]+\/page\/[a-zA-Z0-9_-]{9}/.test(
        event.description
      );
    if (hasRoamLink) {
      // console.log(`[Dedup] Event "${event.summary}" (${event.id}) is synced via description Roam link`);
      return true;
    }
  }

  return false;
};

/**
 * Find duplicate events for a given event
 * @param {object} targetEvent - Event to find duplicates for
 * @param {array} allEvents - Array of all events to search
 * @param {string} targetEventRoamId - Optional Roam block UID for target event
 * @returns {array} Array of duplicate events
 */
export const findDuplicatesForEvent = (
  targetEvent,
  allEvents,
  targetEventRoamId = null
) => {
  const duplicates = [];
  const targetIsSynced = isEventSyncedToRoam(targetEvent, targetEventRoamId);

  for (const event of allEvents) {
    // Skip the target event itself
    if (event.id === targetEvent.id) {
      continue;
    }

    // Check if duplicate
    if (areEventsDuplicate(targetEvent, event)) {
      const eventIsSynced = isEventSyncedToRoam(event);
      // console.log(`[Dedup] Found duplicate: "${event.summary}" (${event.id}), isSynced: ${eventIsSynced}`);

      duplicates.push({
        event,
        isSynced: eventIsSynced,
        shouldKeep: false, // Will be determined by deduplication strategy
      });
    }
  }

  // console.log(`[Dedup] findDuplicatesForEvent result: ${duplicates.length} duplicates found`);
  return duplicates;
};

/**
 * Determine which duplicates to remove
 * Strategy:
 * - If target is synced to Roam, remove ALL duplicates (synced or not)
 * - If target is not synced, keep the oldest event, remove newer ones
 *
 * @param {object} targetEvent - Event to deduplicate
 * @param {array} duplicates - Array of duplicate events from findDuplicatesForEvent
 * @param {boolean} targetIsSynced - Whether target event is synced to Roam
 * @returns {array} Events to remove
 */
export const getDuplicatesToRemove = (
  targetEvent,
  duplicates,
  targetIsSynced
) => {
  if (targetIsSynced) {
    // If target is synced, remove ALL duplicates
    return duplicates.map((d) => d.event);
  }

  // If target is not synced, keep the oldest event
  // Sort by created/updated time
  const allEvents = [targetEvent, ...duplicates.map((d) => d.event)];
  allEvents.sort((a, b) => {
    const timeA = new Date(a.created || a.updated || 0);
    const timeB = new Date(b.created || b.updated || 0);
    return timeA - timeB;
  });

  // Keep the first (oldest), remove the rest
  const oldestId = allEvents[0].id;
  return duplicates.filter((d) => d.event.id !== oldestId).map((d) => d.event);
};

/**
 * Remove duplicate events from Google Calendar
 * @param {string} calendarId - Google Calendar ID
 * @param {array} eventsToRemove - Array of GCal events to delete
 * @returns {object} { removed: number, failed: number, errors: array }
 */
export const removeDuplicateEvents = async (calendarId, eventsToRemove) => {
  const results = {
    removed: 0,
    failed: 0,
    errors: [],
  };

  for (const event of eventsToRemove) {
    try {
      await deleteGCalEvent(calendarId, event.id);
      results.removed++;
      // console.log(`[Dedup] Removed duplicate event: "${event.summary}" (${event.id})`);
    } catch (error) {
      results.failed++;
      results.errors.push({
        event: event.summary,
        error: error.message,
      });
      console.error(
        `[Dedup] Failed to remove duplicate: "${event.summary}"`,
        error
      );
    }
  }

  return results;
};

/**
 * Normalize title for duplicate comparison
 * Extracted for reuse in hash-based deduplication
 * This must match cleanTitleForGCal logic to properly compare Roam vs GCal titles
 * @param {string} title - Event title/summary
 * @returns {string} Normalized title
 */
const normalizeTitle = (title) => {
  return (
    (title || "")
      // Remove any non-alphanumeric prefix (bullets, dashes, special chars)
      .replace(/^[^\w\s\[\{#]+\s*/, "")
      // Remove TODO/DONE markers (various formats)
      .replace(/\{\{\[\[TODO\]\]\}\}\s*/g, "")
      .replace(/\{\{\[\[DONE\]\]\}\}\s*/g, "")
      .replace(/\[\[TODO\]\]\s*/g, "")
      .replace(/\[\[DONE\]\]\s*/g, "")
      .replace(/^\[\s*\]\s*/g, "")
      .replace(/^\[x\]\s*/gi, "")
      // Remove page references [[Page Name]] -> Page Name
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      // Remove hashtags #tag or #[[tag]]
      .replace(/#\[\[([^\]]+)\]\]/g, "")
      .replace(/#([^\s]+)/g, "")
      // Remove block embeds {{embed: ((uid))}}
      .replace(/\{\{embed:\s*\(\([a-zA-Z0-9_-]+\)\)\}\}/g, "")
      // Remove other Roam syntax {{...}}
      .replace(/\{\{[^}]+\}\}/g, "")
      // Clean up extra whitespace
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
};

/**
 * Generate a hash key for an event based on duplicate-defining properties
 * Events with the same key are potential duplicates
 * @param {object} event - GCal event
 * @returns {string} Hash key
 */
const getEventHashKey = (event) => {
  const title = normalizeTitle(event.summary || event.title);
  const startTime = new Date(
    event.start?.dateTime || event.start?.date || event.start
  ).getTime();
  // Round to minute to handle 1-minute tolerance
  const startMinute = Math.floor(startTime / 60000);
  return `${title}|${startMinute}`;
};

/**
 * Deduplicate all events in a calendar using hash-based O(n) algorithm
 * @param {string} calendarId - Google Calendar ID
 * @param {array} allEvents - Array of all GCal events
 * @returns {object} Stats: { scanned, duplicatesFound, removed, failed }
 */
export const deduplicateAllEvents = async (calendarId, allEvents) => {
  const stats = {
    scanned: allEvents.length,
    duplicatesFound: 0,
    removed: 0,
    failed: 0,
  };

  console.log(
    `[Dedup] Starting hash-based deduplication for ${allEvents.length} events...`
  );

  // Step 1: Group events by hash key - O(n)
  const eventGroups = new Map();
  for (const event of allEvents) {
    const key = getEventHashKey(event);
    if (!eventGroups.has(key)) {
      eventGroups.set(key, []);
    }
    eventGroups.get(key).push(event);
  }

  // Step 2: Process only groups with potential duplicates - O(n) total
  const eventsToRemove = [];

  for (const [key, group] of eventGroups) {
    // Skip groups with only one event (no duplicates)
    if (group.length <= 1) continue;

    // Also check end times to confirm duplicates (handles edge cases)
    // Group by end time as well for more precise matching
    const confirmedDuplicateGroups = new Map();
    for (const event of group) {
      const endTime = event.end?.dateTime || event.end?.date || event.end;
      const endMinute = endTime
        ? Math.floor(new Date(endTime).getTime() / 60000)
        : "none";
      const endKey = `${key}|${endMinute}`;

      if (!confirmedDuplicateGroups.has(endKey)) {
        confirmedDuplicateGroups.set(endKey, []);
      }
      confirmedDuplicateGroups.get(endKey).push(event);
    }

    // Process each confirmed duplicate group
    for (const [, duplicateGroup] of confirmedDuplicateGroups) {
      if (duplicateGroup.length <= 1) continue;

      stats.duplicatesFound += duplicateGroup.length - 1;

      // Find which event to keep:
      // Priority 1: Synced to Roam (has Roam block link)
      // Priority 2: Oldest event (by created/updated time)
      let eventToKeep = null;

      console.log(
        `[Dedup] Processing duplicate group with ${duplicateGroup.length} events:`
      );
      for (const event of duplicateGroup) {
        console.log(`[Dedup]   - "${event.summary}" (id: ${event.id})`);
      }

      // First, look for a synced event
      for (const event of duplicateGroup) {
        if (isEventSyncedToRoam(event)) {
          eventToKeep = event;
          console.log(
            `[Dedup] Keeping synced event: "${event.summary}" (${event.id})`
          );
          break;
        }
      }

      // If no synced event, keep the oldest
      if (!eventToKeep) {
        duplicateGroup.sort((a, b) => {
          const timeA = new Date(a.created || a.updated || 0).getTime();
          const timeB = new Date(b.created || b.updated || 0).getTime();
          return timeA - timeB;
        });
        eventToKeep = duplicateGroup[0];
        console.log(
          `[Dedup] No synced event found, keeping oldest: "${eventToKeep.summary}" (${eventToKeep.id})`
        );
      }

      // Mark all others for removal
      for (const event of duplicateGroup) {
        if (event.id !== eventToKeep.id) {
          console.log(
            `[Dedup] Marking for removal: "${event.summary}" (${event.id})`
          );
          eventsToRemove.push(event);
        }
      }
    }
  }

  // Step 3: Remove duplicates
  if (eventsToRemove.length > 0) {
    console.log(
      `[Dedup] Removing ${eventsToRemove.length} duplicate events...`
    );
    const removeResults = await removeDuplicateEvents(
      calendarId,
      eventsToRemove
    );
    stats.removed = removeResults.removed;
    stats.failed = removeResults.failed;
  }

  console.log(
    `[Dedup] ✅ Deduplication complete: ${stats.scanned} scanned, ${stats.duplicatesFound} duplicates found, ${stats.removed} removed, ${stats.failed} failed`
  );

  return stats;
};

/**
 * Check if auto-deduplication should run
 * Runs once per day max to avoid excessive API calls
 * @returns {boolean} True if should run
 */
export const shouldRunAutoDeduplication = () => {
  const lastRun = extensionStorage.get(DEDUP_RUN_KEY);
  if (!lastRun) return true;

  const timeSinceLastRun = Date.now() - lastRun;
  return timeSinceLastRun > DEDUP_COOLDOWN_MS;
};

/**
 * Mark auto-deduplication as run
 */
export const markDeduplicationRun = () => {
  extensionStorage.set(DEDUP_RUN_KEY, Date.now());
};

/**
 * Reset auto-deduplication cooldown (for manual trigger)
 */
export const resetDeduplicationCooldown = () => {
  extensionStorage.set(DEDUP_RUN_KEY, null);
};

export default {
  areEventsDuplicate,
  isEventSyncedToRoam,
  findDuplicatesForEvent,
  getDuplicatesToRemove,
  removeDuplicateEvents,
  deduplicateAllEvents,
  shouldRunAutoDeduplication,
  markDeduplicationRun,
  resetDeduplicationCooldown,
};
