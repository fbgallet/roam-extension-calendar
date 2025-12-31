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
import { getSyncMetadata } from "../models/SyncMetadata";
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
  const normalizeTitle = (title) => {
    return (title || "")
      .replace(/{{[[TODO]]}}\s*/g, "")
      .replace(/{{[[DONE]]}}\s*/g, "")
      .replace(/\[\[TODO\]\]\s*/g, "")
      .replace(/\[\[DONE\]\]\s*/g, "")
      .replace(/^\[\s*\]\s*/g, "")
      .replace(/^\[x\]\s*/g, "")
      .trim()
      .toLowerCase();
  };

  const title1 = normalizeTitle(event1.summary || event1.title);
  const title2 = normalizeTitle(event2.summary || event2.title);

  // Titles must match
  if (title1 !== title2) return false;

  // Get start times
  const start1 = new Date(
    event1.start?.dateTime || event1.start?.date || event1.start
  );
  const start2 = new Date(
    event2.start?.dateTime || event2.start?.date || event2.start
  );

  // Times must match (within 1 minute tolerance)
  const timeDiff = Math.abs(start1 - start2);
  if (timeDiff > 60000) return false; // 1 minute tolerance

  // Get end times if they exist
  const end1 = event1.end?.dateTime || event1.end?.date || event1.end;
  const end2 = event2.end?.dateTime || event2.end?.date || event2.end;

  if (end1 && end2) {
    const endDate1 = new Date(end1);
    const endDate2 = new Date(end2);
    const endDiff = Math.abs(endDate1 - endDate2);
    if (endDiff > 60000) return false; // 1 minute tolerance
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
    if (metadata?.gCalId === event.id) return true;
  }

  // Check if event description contains Roam block link
  if (event.description) {
    const hasRoamLink = /Roam block:\s*https:\/\/roamresearch\.com\/#\/app\/[^/]+\/page\/[a-zA-Z0-9_-]{9}/.test(
      event.description
    );
    if (hasRoamLink) return true;
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
    if (event.id === targetEvent.id) continue;

    // Check if duplicate
    if (areEventsDuplicate(targetEvent, event)) {
      const eventIsSynced = isEventSyncedToRoam(event);

      duplicates.push({
        event,
        isSynced: eventIsSynced,
        shouldKeep: false, // Will be determined by deduplication strategy
      });
    }
  }

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
  return duplicates
    .filter((d) => d.event.id !== oldestId)
    .map((d) => d.event);
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
      console.log(`[Dedup] Removed duplicate event: "${event.summary}" (${event.id})`);
    } catch (error) {
      results.failed++;
      results.errors.push({
        event: event.summary,
        error: error.message,
      });
      console.error(`[Dedup] Failed to remove duplicate: "${event.summary}"`, error);
    }
  }

  return results;
};

/**
 * Normalize title for duplicate comparison
 * Extracted for reuse in hash-based deduplication
 * @param {string} title - Event title/summary
 * @returns {string} Normalized title
 */
const normalizeTitle = (title) => {
  return (title || "")
    .replace(/{{[[TODO]]}}\s*/g, "")
    .replace(/{{[[DONE]]}}\s*/g, "")
    .replace(/\[\[TODO\]\]\s*/g, "")
    .replace(/\[\[DONE\]\]\s*/g, "")
    .replace(/^\[\s*\]\s*/g, "")
    .replace(/^\[x\]\s*/g, "")
    .trim()
    .toLowerCase();
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

  console.log(`[Dedup] Starting hash-based deduplication for ${allEvents.length} events...`);

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
      const endMinute = endTime ? Math.floor(new Date(endTime).getTime() / 60000) : 'none';
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

      // First, look for a synced event
      for (const event of duplicateGroup) {
        if (isEventSyncedToRoam(event)) {
          eventToKeep = event;
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
      }

      // Mark all others for removal
      for (const event of duplicateGroup) {
        if (event.id !== eventToKeep.id) {
          eventsToRemove.push(event);
        }
      }
    }
  }

  // Step 3: Remove duplicates
  if (eventsToRemove.length > 0) {
    console.log(`[Dedup] Removing ${eventsToRemove.length} duplicate events...`);
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
