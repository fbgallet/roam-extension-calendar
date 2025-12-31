/**
 * Sync Recovery Service
 *
 * Handles recovery of lost sync metadata between Roam blocks and Google Calendar events.
 * This is critical when extension storage is cleared (e.g., extension reinstall).
 *
 * The only persistent link is in the GCal event description:
 * "---\nRoam block: https://roamresearch.com/#/app/[graph-name]/page/[block-uid]"
 */

import { getBlockContentByUid } from "../util/roamApi";
import {
  getSyncMetadata,
  saveSyncMetadata,
  createSyncMetadata,
} from "../models/SyncMetadata";

/**
 * Extract Roam block UID from a Google Calendar event description
 * @param {string} description - GCal event description
 * @returns {string|null} Block UID if found, null otherwise
 */
export const extractRoamBlockUid = (description) => {
  if (!description) return null;

  // Match pattern: "Roam block: https://roamresearch.com/#/app/[graph]/page/[uid]"
  const match = description.match(
    /Roam block:\s*https:\/\/roamresearch\.com\/#\/app\/[^/]+\/page\/([a-zA-Z0-9_-]{9})/
  );

  if (match && match[1]) {
    return match[1];
  }

  return null;
};

/**
 * Verify if a Roam block exists and matches the GCal event
 * @param {string} blockUid - Roam block UID
 * @param {object} gcalEvent - Google Calendar event object
 * @returns {boolean} True if block exists and content matches
 */
export const verifyRoamBlockMatch = (blockUid, gcalEvent) => {
  try {
    const blockContent = getBlockContentByUid(blockUid);

    if (!blockContent) {
      console.log(`[SyncRecovery] Block ${blockUid} not found in Roam`);
      return false;
    }

    // Basic validation: block exists and has content
    // We don't do exact title matching because:
    // 1. Block content may have been edited
    // 2. GCal summary may have been edited
    // 3. Formatting differences (timestamps, tags, etc.)
    // The presence of the block with the UID is sufficient evidence of sync

    console.log(
      `[SyncRecovery] Block ${blockUid} found in Roam: "${blockContent.substring(
        0,
        50
      )}..."`
    );
    return true;
  } catch (error) {
    console.error(`[SyncRecovery] Error checking block ${blockUid}:`, error);
    return false;
  }
};

/**
 * Check if a GCal event is currently synced (has metadata in storage)
 * @param {string} gCalId - Google Calendar event ID
 * @param {string} blockUid - Roam block UID
 * @returns {boolean} True if sync metadata exists
 */
export const isSyncMetadataPresent = (gCalId, blockUid) => {
  const metadata = getSyncMetadata(blockUid);
  return metadata && metadata.gCalId === gCalId;
};

/**
 * Recreate sync metadata for a lost sync relationship
 * @param {string} blockUid - Roam block UID
 * @param {object} gcalEvent - Google Calendar event object
 * @param {string} calendarId - Google Calendar ID
 * @returns {boolean} True if metadata was created successfully
 */
export const recreateSyncMetadata = async (blockUid, gcalEvent, calendarId) => {
  try {
    const metadata = createSyncMetadata({
      gCalId: gcalEvent.id,
      gCalCalendarId: calendarId,
      etag: gcalEvent.etag,
      gCalUpdated: gcalEvent.updated,
      roamUpdated: Date.now(), // Current time as best guess
    });

    await saveSyncMetadata(blockUid, metadata);

    console.log(
      `[SyncRecovery] ✓ Recreated sync metadata for block ${blockUid} <-> GCal event ${gcalEvent.id}`
    );
    return true;
  } catch (error) {
    console.error(
      `[SyncRecovery] Failed to recreate sync metadata for ${blockUid}:`,
      error
    );
    return false;
  }
};

/**
 * Scan GCal events for lost sync relationships and recover them
 * This should be called BEFORE auto-syncing new events to prevent duplicates
 *
 * @param {array} gcalEvents - Array of Google Calendar events to scan
 * @param {string} calendarId - Google Calendar ID
 * @returns {object} Recovery stats: { scanned, recovered, failed }
 */
export const recoverLostSyncs = async (gcalEvents, calendarId) => {
  const stats = {
    scanned: 0,
    recovered: 0,
    failed: 0,
    skipped: 0,
  };

  for (const gcalEvent of gcalEvents) {
    stats.scanned++;

    // Extract Roam block UID from description
    const blockUid = extractRoamBlockUid(gcalEvent.description);

    if (!blockUid) {
      // No Roam block link in description - this is a normal GCal-only event
      stats.skipped++;
      continue;
    }

    // Check if sync metadata already exists
    if (isSyncMetadataPresent(gcalEvent.id, blockUid)) {
      // Already synced, no recovery needed
      stats.skipped++;
      continue;
    }

    // Verify the Roam block exists and matches
    if (!verifyRoamBlockMatch(blockUid, gcalEvent)) {
      // Block doesn't exist or doesn't match - skip recovery
      stats.failed++;
      console.warn(
        `[SyncRecovery] Cannot recover sync for GCal event ${gcalEvent.id} - block ${blockUid} not found or doesn't match`
      );
      continue;
    }

    // Recreate the sync metadata
    const success = await recreateSyncMetadata(blockUid, gcalEvent, calendarId);

    if (success) {
      stats.recovered++;
    } else {
      stats.failed++;
    }
  }

  if (stats.recovered > 0) {
    console.log(
      `[SyncRecovery] ✅ RECOVERY COMPLETE: Recovered ${stats.recovered} lost syncs (${stats.failed} failed, ${stats.skipped} skipped)`
    );
  } else if (stats.scanned > 0) {
  }

  return stats;
};

/**
 * Check if a Roam event should be auto-synced to GCal
 * This checks for potential duplicates by looking for matching GCal events
 *
 * @param {object} roamEvent - FullCalendar event object (Roam event)
 * @param {array} gcalEvents - Array of GCal events to check against
 * @returns {boolean} True if safe to auto-sync (no duplicate found)
 */
export const isSafeToAutoSync = (roamEvent, gcalEvents) => {
  // If already has gCalId, it's already synced
  if (roamEvent.extendedProps?.gCalId) {
    return false;
  }

  // Check for potential duplicates:
  // Same title, same start date/time
  const roamTitle = roamEvent.title
    .replace(/{{[[TODO]]}}\s*/, "")
    .replace(/{{[[DONE]]}}\s*/, "")
    .replace(/\[\[TODO\]\]\s*/, "")
    .replace(/\[\[DONE\]\]\s*/, "")
    .trim();

  const roamStart = new Date(roamEvent.start);

  for (const gcalEvent of gcalEvents) {
    const gcalTitle = (gcalEvent.summary || "").trim();
    const gcalStart = new Date(
      gcalEvent.start?.dateTime || gcalEvent.start?.date
    );

    // Check if titles match (case-insensitive)
    const titlesMatch = roamTitle.toLowerCase() === gcalTitle.toLowerCase();

    // Check if start times match (within 1 minute tolerance for time events)
    const timeDiff = Math.abs(roamStart - gcalStart);
    const timesMatch = timeDiff < 60000; // 1 minute tolerance

    if (titlesMatch && timesMatch) {
      console.warn(
        `[SyncRecovery] ⚠️  Potential duplicate detected - NOT auto-syncing Roam event "${roamTitle}"`
      );
      console.warn(
        `[SyncRecovery]     Matches GCal event: "${gcalTitle}" (${gcalEvent.id})`
      );
      return false;
    }
  }

  return true;
};

export default {
  extractRoamBlockUid,
  verifyRoamBlockMatch,
  isSyncMetadataPresent,
  recreateSyncMetadata,
  recoverLostSyncs,
  isSafeToAutoSync,
};
