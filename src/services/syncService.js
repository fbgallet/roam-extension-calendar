/**
 * Sync Service - Handles two-way synchronization between Roam and Google Calendar
 *
 * Sync algorithm:
 * 1. Fetch GCal events updated since lastSyncTime
 * 2. For each GCal event:
 *    - Find matching Roam event by gCalId
 *    - No match → gcal-only (import prompt)
 *    - Match → compare timestamps:
 *      - gCalUpdated > roamUpdated → Update Roam
 *      - roamUpdated > gCalUpdated → Update GCal
 *      - Both changed → Mark conflict
 * 3. For Roam events with trigger tags:
 *    - Has gCalId → Update GCal
 *    - No gCalId + should sync → Create in GCal
 * 4. Update lastSyncTime
 */

import {
  getEvents,
  createEvent,
  updateEvent as updateGCalEvent,
  deleteEvent as deleteGCalEvent,
  getConnectedCalendars,
  updateConnectedCalendar,
} from "./googleCalendarService";

import {
  loadSyncMetadata,
  getSyncMetadata,
  saveSyncMetadata,
  updateSyncMetadata,
  deleteSyncMetadata,
  getRoamUidByGCalId,
  createSyncMetadata,
  SyncStatus,
  determineSyncStatus,
} from "../models/SyncMetadata";

import {
  fcEventToGCalEvent,
  gcalEventToFCEvent,
  findCalendarForEvent,
  gcalEventToRoamContent,
  mergeGCalDataToFCEvent,
} from "../util/gcalMapping";

import { enrichEventsWithTaskData } from "./taskService";

import {
  getBlockContentByUid,
  updateBlock,
  createChildBlock,
  deleteBlock,
  getParentBlock,
  deleteBlockIfNoChild,
  isExistingNode,
  getTreeByUid,
} from "../util/roamApi";

/**
 * Helper to detect if a block content contains TODO marker
 */
const hasTodoMarker = (content) => {
  return content && content.includes("{{[[TODO]]}}");
};

/**
 * Helper to extract end date from event for storage
 * Returns ISO date string (YYYY-MM-DD)
 */
const getEventEndDateString = (gcalEvent) => {
  if (!gcalEvent) return null;

  const endDateTime = gcalEvent.end?.dateTime || gcalEvent.end?.date;
  if (!endDateTime) return null;

  const endDate = new Date(endDateTime);

  // For all-day events, GCal end date is exclusive (next day), subtract 1 day
  if (!gcalEvent.end?.dateTime && gcalEvent.end?.date) {
    endDate.setDate(endDate.getDate() - 1);
  }

  return endDate.toISOString().split("T")[0];
};
import { getCalendarUidFromPage } from "../util/data";
import { startDateRegex, untilDateRegex, roamDateRegex } from "../util/regex";
import { rangeEndAttribute } from "../index";

/**
 * Sync result object
 */
export const createSyncResult = () => ({
  imported: [],
  exported: [],
  updated: [],
  conflicts: [],
  errors: [],
  deletedFromGCal: [],
  deletedFromRoam: [],
});

/**
 * Sync a single Roam event to Google Calendar
 * @param {string} roamUid - Roam block UID
 * @param {object} fcEvent - FullCalendar event object
 * @param {string} calendarId - Target Google Calendar ID
 * @returns {object} Sync result
 */
export const syncEventToGCal = async (roamUid, fcEvent, calendarId) => {
  try {
    const metadata = getSyncMetadata(roamUid);
    const gcalEvent = fcEventToGCalEvent(fcEvent, calendarId);

    if (metadata && metadata.gCalId) {
      // Update existing event
      const result = await updateGCalEvent(calendarId, metadata.gCalId, gcalEvent);

      await updateSyncMetadata(roamUid, {
        gCalUpdated: result.updated,
        etag: result.etag,
        roamUpdated: Date.now(),
        lastSync: Date.now(),
      });

      return { success: true, action: "updated", gCalId: result.id };
    } else {
      // Create new event
      const result = await createEvent(calendarId, gcalEvent);

      // Check if the Roam block has TODO marker
      const blockContent = getBlockContentByUid(roamUid);
      const isTodo = hasTodoMarker(blockContent);

      // Extract end date for cleanup purposes
      const eventEndDate = fcEvent.end
        ? new Date(fcEvent.end).toISOString().split("T")[0]
        : new Date(fcEvent.start).toISOString().split("T")[0];

      await saveSyncMetadata(
        roamUid,
        createSyncMetadata({
          gCalId: result.id,
          gCalCalendarId: calendarId,
          etag: result.etag,
          gCalUpdated: result.updated,
          roamUpdated: Date.now(),
          lastSync: Date.now(),
          eventEndDate,
          isTodo,
        })
      );

      return { success: true, action: "created", gCalId: result.id };
    }
  } catch (error) {
    console.error("Error syncing event to GCal:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a synced event from Google Calendar
 * @param {string} roamUid - Roam block UID
 */
export const deleteEventFromGCal = async (roamUid) => {
  try {
    const metadata = getSyncMetadata(roamUid);

    if (metadata && metadata.gCalId) {
      await deleteGCalEvent(metadata.gCalCalendarId, metadata.gCalId);
      await deleteSyncMetadata(roamUid);
      return { success: true };
    }

    return { success: false, error: "No sync metadata found" };
  } catch (error) {
    console.error("Error deleting event from GCal:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch events from Google Calendar for a date range
 * Automatically enriches Google Tasks with their actual notes/description
 * @param {string} calendarId - Calendar ID
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @param {object} calendarConfig - Calendar configuration
 * @returns {array} Array of FC events
 */
export const fetchGCalEventsForRange = async (
  calendarId,
  startDate,
  endDate,
  calendarConfig
) => {
  try {
    let gcalEvents = await getEvents(calendarId, startDate, endDate);

    // Filter out cancelled events
    gcalEvents = gcalEvents.filter((event) => event.status !== "cancelled");

    // Enrich any Google Tasks with their actual notes/description
    // This replaces the placeholder description with the real task data
    gcalEvents = await enrichEventsWithTaskData(gcalEvents, startDate, endDate);

    return gcalEvents.map((gcalEvent) => gcalEventToFCEvent(gcalEvent, calendarConfig));
  } catch (error) {
    console.error("Error fetching GCal events:", error);
    return [];
  }
};

/**
 * Perform incremental sync for a calendar
 * Fetches only events updated since lastSyncTime
 * @param {object} calendarConfig - Calendar configuration
 * @returns {object} Sync result
 */
export const incrementalSync = async (calendarConfig) => {
  const result = createSyncResult();
  const { id: calendarId, lastSyncTime } = calendarConfig;

  try {
    // Fetch events updated since last sync
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // Next 90 days

    const options = {};
    if (lastSyncTime) {
      options.updatedMin = new Date(lastSyncTime);
      options.showDeleted = true;
    }

    const gcalEvents = await getEvents(calendarId, timeMin, timeMax, options);

    for (const gcalEvent of gcalEvents) {
      try {
        await processGCalEvent(gcalEvent, calendarConfig, result);
      } catch (error) {
        result.errors.push({
          eventId: gcalEvent.id,
          error: error.message,
        });
      }
    }

    // Update last sync time
    updateConnectedCalendar(calendarId, {
      lastSyncTime: Date.now(),
    });
  } catch (error) {
    console.error("Error during incremental sync:", error);
    result.errors.push({ error: error.message });
  }

  return result;
};

/**
 * Process a single GCal event during sync
 */
const processGCalEvent = async (gcalEvent, calendarConfig, result) => {
  const roamUid = getRoamUidByGCalId(gcalEvent.id);

  if (gcalEvent.status === "cancelled") {
    // Event was deleted in GCal
    if (roamUid) {
      result.deletedFromGCal.push({
        gCalId: gcalEvent.id,
        roamUid,
      });
      await deleteSyncMetadata(roamUid);
    }
    return;
  }

  if (!roamUid) {
    // New event from GCal, not yet imported
    result.imported.push({
      gCalEvent: gcalEvent,
      calendarConfig,
      status: "pending",
    });
    return;
  }

  // Event exists in both systems - check for conflicts
  const metadata = getSyncMetadata(roamUid);
  const syncStatus = determineSyncStatus(metadata, gcalEvent);

  switch (syncStatus) {
    case SyncStatus.CONFLICT:
      result.conflicts.push({
        roamUid,
        gCalEvent,
        metadata,
        calendarConfig,
      });
      break;

    case SyncStatus.PENDING:
      const gCalUpdated = new Date(gcalEvent.updated).getTime();
      const roamUpdated = metadata.roamUpdated || metadata.lastSync;

      if (gCalUpdated > roamUpdated) {
        // GCal is newer - update Roam
        result.updated.push({
          direction: "gcal-to-roam",
          roamUid,
          gCalEvent,
          calendarConfig,
        });
      } else {
        // Roam is newer - update GCal
        result.updated.push({
          direction: "roam-to-gcal",
          roamUid,
          metadata,
          calendarConfig,
        });
      }
      break;

    case SyncStatus.SYNCED:
      // No action needed
      break;
  }
};

/**
 * Apply sync results - import GCal events to Roam
 */
export const applyImport = async (gcalEvent, calendarConfig) => {
  try {
    const eventStart = gcalEvent.start.dateTime || gcalEvent.start.date;
    const startDate = new Date(eventStart);
    const dnpUid = window.roamAlphaAPI.util.dateToPageUid(startDate);

    const content = gcalEventToRoamContent(gcalEvent, calendarConfig);
    const newBlockUid = await createChildBlock(dnpUid, content);

    if (newBlockUid) {
      // Check if this is a multi-day event and create end date child block
      const gcalEndDate = gcalEvent.end?.dateTime || gcalEvent.end?.date;
      if (gcalEndDate && rangeEndAttribute) {
        const isAllDayEvent = !gcalEvent.start.dateTime;
        let endDateObj = new Date(gcalEndDate);

        // For all-day events, GCal end date is exclusive (next day)
        if (isAllDayEvent) {
          endDateObj = new Date(endDateObj.getTime() - 24 * 60 * 60 * 1000);
        }

        // Check if it's actually a multi-day event
        if (startDate.toDateString() !== endDateObj.toDateString()) {
          const endDateStr = window.roamAlphaAPI.util.dateToPageTitle(endDateObj);
          const endBlockContent = `${rangeEndAttribute}:: [[${endDateStr}]]`;
          await createChildBlock(newBlockUid, endBlockContent, "first");
          console.log(`[GCal Import] Created end date child block: ${endBlockContent}`);
        }
      }

      // Check if the imported content has TODO marker
      const isTodo = hasTodoMarker(content);

      // Extract end date for cleanup purposes
      const eventEndDate = getEventEndDateString(gcalEvent);

      await saveSyncMetadata(
        newBlockUid,
        createSyncMetadata({
          gCalId: gcalEvent.id,
          gCalCalendarId: calendarConfig.id,
          etag: gcalEvent.etag,
          gCalUpdated: gcalEvent.updated,
          roamUpdated: Date.now(),
          eventEndDate,
          isTodo,
        })
      );
    }

    return { success: true, roamUid: newBlockUid };
  } catch (error) {
    console.error("Error importing GCal event:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Find child blocks containing date information (start:: or end::/until::)
 * @param {string} parentUid - Parent block UID
 * @returns {object} Object with startBlock and endBlock info
 */
const findDateChildBlocks = (parentUid) => {
  const tree = getTreeByUid(parentUid);
  if (!tree || !tree[0] || !tree[0].children) {
    return { startBlock: null, endBlock: null };
  }

  let startBlock = null;
  let endBlock = null;

  for (const child of tree[0].children) {
    const content = child.string || "";

    // Check for start date pattern (start:: [[Date]])
    if (startDateRegex) {
      startDateRegex.lastIndex = 0;
      if (startDateRegex.test(content)) {
        startBlock = { uid: child.uid, content };
      }
    }

    // Check for end/until date pattern (end:: [[Date]] or until:: [[Date]])
    if (untilDateRegex) {
      untilDateRegex.lastIndex = 0;
      if (untilDateRegex.test(content)) {
        endBlock = { uid: child.uid, content };
      }
    }

    // Also check for roamDateRegex to find any date references in children
    // This handles cases where dates are in children but without start::/end:: prefix
    roamDateRegex.lastIndex = 0;
    if (roamDateRegex.test(content) && !startBlock && !endBlock) {
      // If we find a date but no specific start/end marker, check if it looks like an end date
      // by checking if the rangeEndAttribute is present
      if (rangeEndAttribute && content.toLowerCase().includes(rangeEndAttribute.toLowerCase())) {
        endBlock = { uid: child.uid, content };
      }
    }
  }

  return { startBlock, endBlock };
};

/**
 * Update a child block's date reference
 * @param {string} blockUid - Block UID to update
 * @param {string} currentContent - Current block content
 * @param {Date} newDate - New date to set
 */
const updateChildBlockDate = async (blockUid, currentContent, newDate) => {
  const newRoamDate = window.roamAlphaAPI.util.dateToPageTitle(newDate);
  roamDateRegex.lastIndex = 0;
  const matchingDates = currentContent.match(roamDateRegex);

  if (matchingDates && matchingDates.length) {
    // Replace the existing date with the new one
    const currentDateStr = matchingDates[0].replace("[[", "").replace("]]", "");
    const newContent = currentContent.replace(currentDateStr, newRoamDate);
    await updateBlock(blockUid, newContent);
    console.log(`[GCal→Roam] Updated child block date: ${currentDateStr} → ${newRoamDate}`);
  }
};

/**
 * Apply sync results - update Roam from GCal
 */
export const applyGCalToRoamUpdate = async (roamUid, gcalEvent, calendarConfig) => {
  try {
    // Check if the Roam block still exists (it may have been deleted)
    if (!isExistingNode(roamUid)) {
      console.log("Roam block no longer exists, cleaning up stale metadata:", roamUid);
      await deleteSyncMetadata(roamUid);
      // Re-import the event as a new block
      return await applyImport(gcalEvent, calendarConfig);
    }

    const content = gcalEventToRoamContent(gcalEvent, calendarConfig);
    await updateBlock(roamUid, content);

    // Check if the date changed and move the block if needed
    const gcalStartDate = gcalEvent.start.dateTime || gcalEvent.start.date;
    const gcalEndDate = gcalEvent.end?.dateTime || gcalEvent.end?.date;
    const newEventDate = new Date(gcalStartDate);
    const newDnpUid = window.roamAlphaAPI.util.dateToPageUid(newEventDate);

    // =========================================================================
    // Handle child blocks with start:: and end:: dates (multi-day events)
    // =========================================================================
    const { startBlock, endBlock } = findDateChildBlocks(roamUid);

    // Check if this is a multi-day event in GCal
    const isAllDayEvent = !gcalEvent.start.dateTime;
    let gcalStartDateObj = new Date(gcalStartDate);
    let gcalEndDateObj = gcalEndDate ? new Date(gcalEndDate) : null;

    // For all-day events, GCal end date is exclusive (next day), so we need to subtract 1 day
    // to get the actual last day of the event
    if (isAllDayEvent && gcalEndDateObj) {
      gcalEndDateObj = new Date(gcalEndDateObj.getTime() - 24 * 60 * 60 * 1000);
    }

    const isMultiDayEvent =
      gcalEndDateObj &&
      gcalStartDateObj.toDateString() !== gcalEndDateObj.toDateString();

    console.log("[GCal→Roam] Event dates:", {
      start: gcalStartDateObj.toDateString(),
      end: gcalEndDateObj?.toDateString(),
      isMultiDay: isMultiDayEvent,
      hasStartBlock: !!startBlock,
      hasEndBlock: !!endBlock,
    });

    // Update start child block if it exists
    if (startBlock) {
      await updateChildBlockDate(startBlock.uid, startBlock.content, gcalStartDateObj);
    }

    // Update end/until child block if it exists
    if (endBlock) {
      if (isMultiDayEvent && gcalEndDateObj) {
        await updateChildBlockDate(endBlock.uid, endBlock.content, gcalEndDateObj);
      } else if (!isMultiDayEvent) {
        // Event is no longer multi-day, should we remove the end block?
        // For now, just update it to match the start date or leave it
        console.log("[GCal→Roam] Event is no longer multi-day, end block may be stale");
      }
    } else if (isMultiDayEvent && gcalEndDateObj && rangeEndAttribute) {
      // No end block exists but the event is multi-day - create one
      const endDateStr = window.roamAlphaAPI.util.dateToPageTitle(gcalEndDateObj);
      const endBlockContent = `${rangeEndAttribute}:: [[${endDateStr}]]`;
      await createChildBlock(roamUid, endBlockContent, "first");
      console.log(`[GCal→Roam] Created end date child block: ${endBlockContent}`);
    }

    // =========================================================================
    // Handle block location (move to correct DNP if start date changed)
    // =========================================================================
    const currentParentUid = getParentBlock(roamUid);
    if (currentParentUid) {
      // Get the DNP UID that contains the current parent
      // The parent might be a "Calendar" block, so we need to check its parent too
      let currentDnpUid = getParentBlock(currentParentUid);
      // If no grandparent, the parent itself might be the DNP
      if (!currentDnpUid) {
        currentDnpUid = currentParentUid;
      }

      // Check if the event date is different from current location
      const currentDateFromUid = window.roamAlphaAPI.util.pageTitleToDate(
        window.roamAlphaAPI.pull("[:node/title]", [":block/uid", currentDnpUid])?.[":node/title"]
      );

      if (currentDateFromUid) {
        const currentDnpDateStr = window.roamAlphaAPI.util.dateToPageUid(currentDateFromUid);

        if (newDnpUid !== currentDnpDateStr) {
          // Date changed - move the block to the new DNP
          console.log("GCal event date changed, moving block from", currentDnpDateStr, "to", newDnpUid);

          const newCalendarBlockUid = await getCalendarUidFromPage(newDnpUid);
          await window.roamAlphaAPI.moveBlock({
            location: {
              "parent-uid": newCalendarBlockUid,
              order: "last",
            },
            block: { uid: roamUid },
          });

          // Clean up empty calendar block in old location
          deleteBlockIfNoChild(currentParentUid);
        }
      }
    }

    // Update metadata with current TODO status and end date
    const updatedContent = getBlockContentByUid(roamUid);
    const isTodo = hasTodoMarker(updatedContent);
    const eventEndDate = getEventEndDateString(gcalEvent);

    await updateSyncMetadata(roamUid, {
      gCalUpdated: gcalEvent.updated,
      etag: gcalEvent.etag,
      roamUpdated: Date.now(),
      lastSync: Date.now(),
      eventEndDate,
      isTodo,
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating Roam from GCal:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Apply sync results - update GCal from Roam
 */
export const applyRoamToGCalUpdate = async (roamUid, fcEvent, calendarId) => {
  return syncEventToGCal(roamUid, fcEvent, calendarId);
};

/**
 * Resolve a conflict by choosing a side
 * @param {object} conflict - Conflict object from sync result
 * @param {string} resolution - "roam" | "gcal" | "both"
 */
export const resolveConflict = async (conflict, resolution, calendarConfig) => {
  const { roamUid, gCalEvent, metadata } = conflict;

  try {
    switch (resolution) {
      case "gcal":
        // Keep GCal version, update Roam
        return await applyGCalToRoamUpdate(roamUid, gCalEvent, calendarConfig);

      case "roam":
        // Keep Roam version, update GCal
        const blockContent = getBlockContentByUid(roamUid);
        // Would need to reconstruct FC event from block content
        // For now, just update metadata to mark as synced
        await updateSyncMetadata(roamUid, {
          lastSync: Date.now(),
          roamUpdated: Date.now(),
        });
        return { success: true, action: "kept-roam" };

      case "both":
        // Keep both - create duplicate in Roam
        return await applyImport(gCalEvent, calendarConfig);

      default:
        return { success: false, error: "Invalid resolution" };
    }
  } catch (error) {
    console.error("Error resolving conflict:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Full sync for all connected calendars
 */
export const fullSync = async () => {
  const calendars = getConnectedCalendars();
  const results = [];

  for (const calendar of calendars) {
    if (!calendar.syncEnabled) continue;

    const result = await incrementalSync(calendar);
    results.push({
      calendarId: calendar.id,
      calendarName: calendar.name,
      ...result,
    });
  }

  return results;
};

/**
 * Check if a Roam event needs to be synced
 * @param {string} roamUid - Roam block UID
 * @param {object} fcEvent - FullCalendar event
 */
export const checkNeedsSync = (roamUid, fcEvent) => {
  const metadata = getSyncMetadata(roamUid);

  if (!metadata) {
    // Not synced yet - check if has trigger tag
    const calendars = getConnectedCalendars();
    const targetCalendar = findCalendarForEvent(fcEvent, calendars);
    return targetCalendar !== null;
  }

  // Already synced - check if updated since last sync
  return metadata.roamUpdated > metadata.lastSync;
};

/**
 * Get sync status for a Roam event
 */
export const getEventSyncStatus = (roamUid) => {
  const metadata = getSyncMetadata(roamUid);

  if (!metadata) {
    return { synced: false, status: SyncStatus.LOCAL_ONLY };
  }

  return {
    synced: true,
    status: metadata.roamUpdated > metadata.lastSync ? SyncStatus.PENDING : SyncStatus.SYNCED,
    gCalId: metadata.gCalId,
    lastSync: metadata.lastSync,
  };
};

export default {
  syncEventToGCal,
  deleteEventFromGCal,
  fetchGCalEventsForRange,
  incrementalSync,
  fullSync,
  applyImport,
  applyGCalToRoamUpdate,
  applyRoamToGCalUpdate,
  resolveConflict,
  checkNeedsSync,
  getEventSyncStatus,
  createSyncResult,
};
