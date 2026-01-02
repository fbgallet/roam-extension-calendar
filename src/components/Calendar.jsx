import FullCalendar from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/interaction";
import googleCalendarPlugin from "@fullcalendar/google-calendar";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import {
  filterEvents,
  getBlocksToDisplayFromDNP,
  getCalendarUidFromPage,
  getMatchingTags,
  moveDroppedEventBlock,
  parseEventObject,
  updateStartDate,
  updateStoredTags,
  updateTimestampsInBlock,
  updateUntilDate,
} from "../util/data";
import { useState, useEffect, useRef } from "react";
import Event from "./Event";
import MultiSelectFilter from "./MultiSelectFilter";
import { useCalendarConfigVersion } from "../contexts/CalendarConfigContext";
import {
  createChildBlock,
  createNewPageIfNotExisting,
  deleteBlock,
  deleteBlockIfNoChild,
  getBlockContentByUid,
  getBlocksUidReferencedInThisBlock,
  getOrderedDirectChildren,
  getParentBlock,
  updateBlock,
} from "../util/roamApi";
import NewEventDialog from "./NewEventDialog";
import { dateToISOString, eventTimeFormats, getDayOfYear } from "../util/dates";
import {
  displayTime,
  eventsOrder,
  extensionStorage,
  firstDay,
  mapOfTags,
  maxTime,
  minTime,
  timeFormat,
  timeGrid,
} from "..";
import { refreshTagsUids } from "../models/EventTag";
import {
  isAuthenticated,
  getConnectedCalendars,
  getEvents as getGCalEvents,
  createEvent as createGCalEvent,
  updateEvent as updateGCalEvent,
  getAccessToken,
  getConnectionStatus,
} from "../services/googleCalendarService";
import { gcalEventToFCEvent, fcEventToGCalEvent, mergeGCalDataToFCEvent, findCalendarForEvent } from "../util/gcalMapping";
import { saveSyncMetadata, createSyncMetadata, getSyncMetadata, updateSyncMetadata, getRoamUidByGCalId, determineSyncStatus, SyncStatus } from "../models/SyncMetadata";
import { applyGCalToRoamUpdate, syncEventToGCal } from "../services/syncService";
// import { recoverLostSyncs, isSafeToAutoSync } from "../services/syncRecoveryService"; // Commented out with sync recovery
// import { deduplicateAllEvents, shouldRunAutoDeduplication, markDeduplicationRun } from "../services/deduplicationService"; // Commented out with auto-dedup
import { areEventsDuplicate } from "../services/deduplicationService";
import { enrichEventsWithTaskData } from "../services/taskService";
import { getTasksEnabled, getConnectedTaskLists, getTasks } from "../services/googleCalendarService";
import { fetchTasksForRange, importTaskToRoam, getExistingRoamBlockForTask } from "../services/googleTasksService";
import { taskToFCEvent } from "../util/taskMapping";
import { getRoamUidByGTaskId, getTaskSyncMetadata } from "../models/TaskSyncMetadata";
import {
  getAllCachedEventsForRange,
  setAllCachedEventsForRange,
  invalidateAllEventsCache,
  updateEventInAllCache,
  removeEventFromAllCache,
  addEventToAllCache,
} from "../services/eventCacheService";

let events = [];
let filteredEvents = [];

const Calendar = ({
  parentElt,
  isInSidebar,
  periodType,
  initialDate,
  initialSettings,
}) => {
  const isLoadingFreshDataRef = useRef(false); // Lock to prevent concurrent loadFreshData calls
  const isMountedRef = useRef(true); // Track if component is still mounted to cancel async operations
  const [newEventDialogIsOpen, setNewEventDialogIsOpen] = useState(false);
  const [focusedPageUid, setFocusedPageUid] = useState(null);
  const [focusedPageTitle, setFocusedPageTitle] = useState(null);
  const [tagToInsert, setTagToInsert] = useState(null);
  // const [events, setEvents] = useState([]);
  const eventsInViewRef = useRef([]); // Track events in current view for batch sync (using ref to avoid infinite loops)
  const [forceToReload, setForceToReload] = useState(false);
  const [position, setPosition] = useState({ x: null, y: null });
  const [focusedTime, setFocusedTime] = useState(null);

  const [filterLogic, setFilterLogic] = useState(
    initialSettings.logic !== null ? initialSettings.logic : "Or"
  );
  const configVersion = useCalendarConfigVersion();
  const [tagsToDisplay, setTagsToDisplay] = useState(
    mapOfTags.filter((tag) => tag["isToDisplay" + (isInSidebar ? "InSb" : "")])
  );
  const [isEntireDNP, setIsEntireDNP] = useState(
    initialSettings.dnp !== null ? initialSettings.dnp : false
  );
  const [isIncludingRefs, setIsIncludingRefs] = useState(
    initialSettings.refs !== null ? initialSettings.refs : false
  );
  const [isWEtoDisplay, setIsWEtoDisplay] = useState(
    initialSettings.we !== null ? initialSettings.we : true
  );
  const isDataToReload = useRef(true);
  const isDataToFilterAgain = useRef(true);
  const calendarRef = useRef(null);
  const viewRange = useRef({
    start: null,
    end: null,
  });
  const selectedDay = useRef(null);
  const periodView = useRef(
    periodType ||
      (initialSettings.view !== null ? initialSettings.view : "dayGridMonth")
  );

  // Cleanup on unmount to prevent zombie async operations
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      // CRITICAL: Set this FIRST to cancel all ongoing async operations
      isMountedRef.current = false;
      // Reset the loading lock to prevent stale locks
      isLoadingFreshDataRef.current = false;
      // Mark data as needing reload for next mount
      isDataToReload.current = true;
    };
  }, [isInSidebar]);

  // Re-establish connection when Calendar opens (if needed)
  useEffect(() => {
    const checkAndRefreshConnection = async () => {
      if (!isAuthenticated()) return;

      try {
        // Try to get access token - this will trigger a silent refresh if token is expired
        await getAccessToken();
      } catch (error) {
        // Silent failure - user can manually reconnect if needed
        console.log("[Calendar] Connection check failed (will use cache):", error.message);
      }
    };

    checkAndRefreshConnection();
  }, []); // Run once on mount

  // Listen for calendar config changes and update tags
  const isFirstMount = useRef(true);
  useEffect(() => {
    // Skip first mount - only react to actual config changes
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    // Update tagsToDisplay with the new mapOfTags whenever config changes
    const updatedTags = mapOfTags.filter((tag) => tag["isToDisplay" + (isInSidebar ? "InSb" : "")]);
    setTagsToDisplay(updatedTags);
    // Reload calendar data to apply new configs
    isDataToReload.current = true;
    invalidateAllEventsCache();
    setForceToReload((prev) => !prev);
  }, [configVersion, isInSidebar]);

  async function updateSize() {
    const calendarApi = calendarRef.current.getApi();
    calendarApi.updateSize();
    isDataToReload.current = true;
    isDataToFilterAgain.current = true;
    setForceToReload((prev) => !prev);
    let tooltip = document.querySelector(".rm-bullet__tooltip");
    if (tooltip) tooltip.remove();
    tooltip = document.querySelector(".bp3-tooltip");
    if (tooltip) tooltip.remove();

    // Invalidate all-events cache on manual refresh
    invalidateAllEventsCache();

    // Check and refresh Google Calendar connection if authenticated
    if (isAuthenticated()) {
      try {
        await getAccessToken(); // This will refresh token if needed
        console.log("[Calendar] Google Calendar connection checked and refreshed");
      } catch (error) {
        console.warn("[Calendar] Failed to refresh Google Calendar connection:", error);
      }
    }

    // GCal refresh
    // const gCalId = await extensionStorage.get("googleCalendarId");
    // if (gCalId) {
    //   const evts = await getGcalEvents(gCalId);
    //   console.log("evts :>> ", evts);
    //   evts.forEach((gCalEvt) => {
    //     events.push(
    //       parseEventObject({
    //         id: gCalEvt.id,
    //         title: gCalEvt.summary,
    //         date: gCalEvt.start.dateTime || new Date(gCalEvt.start.date),
    //         untilDate:
    //           gCalEvt.endTimeUnspecified || !gCalEvt.end.dateTime
    //             ? null
    //             : gCalEvt.end.dateTime,
    //         matchingTags: [],
    //       })
    //     );
    //   });
    // }
  }

  useEffect(() => {
    isDataToFilterAgain.current = true;
    updateStoredTags(mapOfTags);
  }, [tagsToDisplay]);

  useEffect(() => {
    isDataToReload.current = true;
    isDataToFilterAgain.current = true;
  }, [isIncludingRefs, isEntireDNP, isWEtoDisplay]);

  useEffect(() => {
    isDataToFilterAgain.current = true;
  }, [forceToReload]);

  const handleSelectDays = (e) => {
    // console.log("Day selected");
  };

  const handleSquareDayClick = async (info, tag = null) => {
    const targetDnpUid = window.roamAlphaAPI.util.dateToPageUid(info.date);
    const dnpTitle = window.roamAlphaAPI.util.dateToPageTitle(info.date);
    const previousSelectedDay = selectedDay.current;
    selectedDay.current =
      selectedDay.current === targetDnpUid ? null : targetDnpUid;
    if (info.jsEvent.shiftKey) {
      createNewPageIfNotExisting(dnpTitle, targetDnpUid, true);
      window.roamAlphaAPI.ui.rightSidebar.addWindow({
        window: { type: "outline", "block-uid": targetDnpUid },
      });
    } else {
      if (previousSelectedDay === targetDnpUid || tag) {
        createNewPageIfNotExisting(dnpTitle, targetDnpUid, true);
        isDataToReload.current = false;
        isDataToFilterAgain.current = false;
        // console.log("info.jsEvent :>> ", info.jsEvent);
        setPosition({ x: info.jsEvent.clientX, y: info.jsEvent.clientY - 75 });
        setFocusedPageUid(targetDnpUid);
        setFocusedPageTitle(dnpTitle);
        setTagToInsert(tag);
        if (periodView.current.includes("time"))
          setFocusedTime(info.dateStr.slice(11, 16));
        setNewEventDialogIsOpen(true);
      }
    }
  };

  const renderEventContent = (info) => {
    let title = info.event.title;
    let hasCheckbox = false;
    let isChecked;

    // Check for Roam format TODO/DONE (for Roam events)
    if (title.includes("{{[[TODO]]}}")) {
      hasCheckbox = true;
      isChecked = false;
      title = title.replace("{{[[TODO]]}}", "");
    } else if (title.includes("{{[[DONE]]}}")) {
      hasCheckbox = true;
      isChecked = true;
      title = title.replace("{{[[DONE]]}}", "");
    }
    // Check for non-synced GCal format TODO/DONE (for non-synced GCal events)
    else if (title.match(/^\[\[TODO\]\]/) || title.match(/^\[\s*\]/)) {
      hasCheckbox = true;
      isChecked = false;
      title = title.replace(/^\[\[TODO\]\]\s*/, "").replace(/^\[\s*\]\s*/, "");
    } else if (title.match(/^\[\[DONE\]\]/) || title.match(/^\[x\]/)) {
      hasCheckbox = true;
      isChecked = true;
      title = title.replace(/^\[\[DONE\]\]\s*/, "").replace(/^\[x\]\s*/, "");
    }
    // console.log(info);
    const dnpTitle = window.roamAlphaAPI.util.dateToPageTitle(info.event.start);
    if (title.includes(`[[${dnpTitle}]]`)) {
      title = title.replace(`[[${dnpTitle}]]`, "");
    }

    // Remove timestamps from title for display (they're redundant with timeText or grid position)
    // This handles both ranges (21:30-22:30) and single times (21:30)
    if (info.event.extendedProps?.hasTime) {
      // Remove time ranges like "21:30-22:30" or "9:30pm-10:30pm"
      title = title.replace(/\d{1,2}:\d{2}\s*(?:am|pm)?\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm)?/gi, "");
      // Remove single timestamps like "21:30" or "9:30pm"
      title = title.replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)?/gi, "");
    }

    // Remove calendar trigger tags from title for display
    // Get all connected calendars and their trigger tags
    const connectedCalendars = getConnectedCalendars();
    connectedCalendars.forEach((calendar) => {
      if (calendar.triggerTags && calendar.triggerTags.length > 0) {
        calendar.triggerTags.forEach((tag) => {
          // Remove #[[tag]], [[tag]], and #tag formats
          title = title.replace(new RegExp(`#\\[\\[${tag}\\]\\]`, 'gi'), "");
          title = title.replace(new RegExp(`\\[\\[${tag}\\]\\]`, 'gi'), "");
          title = title.replace(new RegExp(`#${tag}\\b`, 'gi'), "");
        });
      }
    });

    title = title.trim();

    // Only show timeText in month view, not in time grid views where position indicates time
    const isTimeGridView = info.view.type.includes("time");
    const shouldShowTime = !isTimeGridView;

    return (
      <Event
        displayTitle={title}
        event={info.event}
        timeText={shouldShowTime ? info.timeText : null}
        hasCheckbox={hasCheckbox}
        isChecked={isChecked}
        tagsToDisplay={tagsToDisplay}
        backgroundColor={info.backgroundColor}
        updateEvent={updateEvent}
        deleteEvent={deleteEvent}
        refreshCalendar={updateSize}
      ></Event>
    );
  };

  const addEvent = async (eventUid, pageUid, isGcal, targetCalendarId = null, gcalOnly = false) => {
    let eventContent = getBlockContentByUid(eventUid);
    const currentDate = new Date(pageUid);
    const dateStr = dateToISOString(currentDate);

    // If syncing to GCal, add the trigger tag FIRST before calculating matchingTags
    let targetCalendar = null;
    if (isGcal && isAuthenticated()) {
      const connectedCalendars = getConnectedCalendars();
      targetCalendar = targetCalendarId
        ? connectedCalendars.find((c) => c.id === targetCalendarId)
        : connectedCalendars.find((c) => c.isDefault) || connectedCalendars[0];

      if (targetCalendar && targetCalendar.syncDirection !== "import" && !gcalOnly) {
        // Add trigger tag to Roam block if not already present (only for 2-way sync)
        const triggerTag = targetCalendar.triggerTags?.[0];
        if (triggerTag) {
          const tagPattern = triggerTag.includes(" ")
            ? `#[[${triggerTag}]]`
            : `#${triggerTag}`;
          if (!eventContent.includes(tagPattern) && !eventContent.includes(`[[${triggerTag}]]`)) {
            eventContent = eventContent + " " + tagPattern;
            await updateBlock(eventUid, eventContent);
          }
        }
      }
    }

    // Handle GCal-only mode: create event on GCal and delete the Roam block
    if (gcalOnly && targetCalendar && targetCalendar.syncDirection !== "import") {
      try {
        // Get children blocks to include in GCal description
        const children = getOrderedDirectChildren(eventUid);
        let childrenDescription = "";
        if (children && children.length > 0) {
          childrenDescription = children.map((child) => `• ${child.string}`).join("\n");
        }

        // Create a temporary FC event to convert to GCal format
        const tempFcEvent = parseEventObject({
          id: eventUid,
          title: eventContent,
          date: dateStr,
          matchingTags: [],
        });

        // Add children content to the description
        if (childrenDescription) {
          tempFcEvent.extendedProps = tempFcEvent.extendedProps || {};
          tempFcEvent.extendedProps.description = childrenDescription;
        }

        const gcalEventData = fcEventToGCalEvent(tempFcEvent, targetCalendar.id, null);
        const createdEvent = await createGCalEvent(targetCalendar.id, gcalEventData);

        console.log("Created GCal-only event:", createdEvent);

        // Delete the Roam block since we don't want it synced
        const parentUid = getParentBlock(eventUid);
        await deleteBlock(eventUid);
        deleteBlockIfNoChild(parentUid);

        // Create an FC event that looks like a pure GCal event
        const fcEvent = gcalEventToFCEvent(createdEvent, targetCalendar);
        events.push(fcEvent);

        // Update all-events cache with new event
        addEventToAllCache(fcEvent);

        isDataToFilterAgain.current = true;
        setForceToReload((prev) => !prev);
        return;
      } catch (error) {
        console.error("Failed to create GCal-only event:", error);
        return;
      }
    }

    // Now calculate matchingTags AFTER the trigger tag has been added
    const matchingTags = getMatchingTags(
      mapOfTags,
      getBlocksUidReferencedInThisBlock(eventUid)
    );

    // Create the FC event with the updated content and tags
    const fcEvent = parseEventObject({
      id: eventUid,
      title: eventContent,
      date: dateStr,
      matchingTags,
    });

    // Complete the GCal sync if needed (2-way sync mode)
    if (targetCalendar && targetCalendar.syncDirection !== "import") {
      try {
        const gcalEventData = fcEventToGCalEvent(fcEvent, targetCalendar.id, eventUid);
        const createdEvent = await createGCalEvent(targetCalendar.id, gcalEventData);

        console.log("Created GCal event:", createdEvent);

        // Save sync metadata to extension storage
        await saveSyncMetadata(
          eventUid,
          createSyncMetadata({
            gCalId: createdEvent.id,
            gCalCalendarId: targetCalendar.id,
            etag: createdEvent.etag,
            gCalUpdated: createdEvent.updated,
            roamUpdated: Date.now(),
          })
        );

        // Update FC event with GCal info
        fcEvent.extendedProps.gCalId = createdEvent.id;
        fcEvent.extendedProps.gCalCalendarId = targetCalendar.id;
        fcEvent.extendedProps.syncStatus = "synced";
      } catch (error) {
        console.error("Failed to sync event to Google Calendar:", error);
      }
    }

    events.push(fcEvent);

    // Update all-events cache with new event
    addEventToAllCache(fcEvent);

    isDataToFilterAgain.current = true;
    setForceToReload((prev) => !prev);
  };

  const updateEvent = (event, updatedProperties) => {
    if (
      event.extendedProps.hasInfosInChildren ||
      event.extendedProps.refSourceUid
    ) {
      const matchingEvents = events.filter((evt) => evt.id === event.id);
      if (
        matchingEvents.length >= 1 ||
        (matchingEvents.length && event.extendedProps.isRef)
      ) {
        // isDataToReload.current = true;
        setForceToReload((prev) => !prev);
      }
    } else {
      const index = events.findIndex(
        (evt) =>
          evt.id === event.id &&
          evt.extendedProps.refSourceUid === event.extendedProps.refSourceUid
      );
      for (const key in updatedProperties) {
        if (updatedProperties[key] !== undefined) {
          if (key === "extendedProps") {
            // Merge extendedProps instead of replacing to preserve existing properties
            events[index][key] = {
              ...events[index][key],
              ...updatedProperties[key],
            };
            // Update each extended prop individually
            for (const extendedProp in updatedProperties["extendedProps"]) {
              event.setExtendedProp(
                extendedProp,
                updatedProperties[key][extendedProp]
              );
            }
          } else {
            events[index][key] = updatedProperties[key];
            event.setProp(key, updatedProperties[key]);
          }
        }
      }

      // Update all-events cache with updated event
      if (index !== -1) {
        updateEventInAllCache(events[index]);
      }

      isDataToFilterAgain.current = true;
    }
  };

  const deleteEvent = (event) => {
    // Get event info before removing
    const eventDate = event.start ? new Date(event.start) : null;
    const eventId = event.id || event.extendedProps?.gCalId;

    event.remove();
    const index = events.findIndex((evt) => evt.id === event.id);
    events.splice(index, 1);

    // Remove from all-events cache
    if (eventId && eventDate) {
      removeEventFromAllCache(eventId, eventDate);
    }

    isDataToFilterAgain.current = true;
    setForceToReload((prev) => !prev);
  };

  const renderDayContent = (info, elt) => {
    // console.log("day:", info);
  };

  const getEventsFromDNP = async (info) => {
    if (
      viewRange.current.start &&
      (viewRange.current.start.getTime() !== info.start.getTime() ||
        viewRange.current.end.getTime() !== info.end.getTime())
    ) {
      isDataToReload.current = true;
      isDataToFilterAgain.current = true;
    }
    viewRange.current.start = info.start;
    viewRange.current.end = info.end;

    if (isDataToReload.current) {
      // Step 0: Check connection status to determine if we should accept stale cache
      let connectionStatus = { isConnected: true, isOffline: false };
      if (isAuthenticated()) {
        try {
          connectionStatus = await getConnectionStatus();
        } catch (error) {
          console.warn("[Calendar] Could not check connection status:", error);
          connectionStatus = { isConnected: false, isOffline: true };
        }
      }

      // Check cache - accept stale cache if offline/disconnected
      const allCacheResult = getAllCachedEventsForRange(
        info.start,
        info.end,
        !connectionStatus.isConnected // Accept stale cache if offline/disconnected
      );
      const hasCachedEvents = allCacheResult.events.length > 0;

      if (hasCachedEvents) {
        // Return cached events IMMEDIATELY - don't wait for any async operations
        events = [...allCacheResult.events];

        // Mark events as potentially stale if we're offline/disconnected
        if (!connectionStatus.isConnected) {
          events.forEach(evt => {
            if (evt.extendedProps) {
              evt.extendedProps.isStaleCache = true;
              evt.extendedProps.connectionStatus = connectionStatus;
            }
          });
          console.log(`[Calendar] Using stale cache (${connectionStatus.message}) - ${events.length} events`);
        }

        // Enrich Roam events from cache with sync metadata (gCalId) to enable proper deduplication
        // This is critical - cached events may not have gCalId enrichment from when they were cached
        // IMPORTANT: Merge, don't replace, to preserve description, location, and other extendedProps from cache
        for (const evt of events) {
          // Only enrich Roam events (not GCal-only events which already have gCalId)
          if (!evt.extendedProps?.isGCalEvent) {
            const metadata = getSyncMetadata(evt.id);
            if (metadata?.gCalId && !evt.extendedProps?.gCalId) {
              // Only add if not already present (cache might already have it)
              evt.extendedProps = {
                ...evt.extendedProps,
                gCalId: metadata.gCalId,
                gCalCalendarId: metadata.gCalCalendarId,
              };
            }
          }
        }

        filteredEvents = filterEvents(events, tagsToDisplay, filterLogic, isInSidebar);

        // Only trigger background refresh if we're connected
        if (connectionStatus.isConnected) {
          const doBackgroundRefresh = async () => {
            await loadFreshData(info);
            // Note: loadFreshData already caches via setAllCachedEventsForRange at line 687
            // No need to re-cache here as it would overwrite with potentially incomplete data
            isDataToFilterAgain.current = true;
            setForceToReload((prev) => !prev);
          };
          doBackgroundRefresh(); // Fire and forget - no await!
        }

        isDataToReload.current = false; // Don't reload again when re-render happens
        return filteredEvents;
      }

      // No cache - try to load fresh data
      // If this fails and we're offline, we'll have no events to display
      try {
        await loadFreshData(info);
      } catch (error) {
        console.error("[Calendar] Failed to load fresh data:", error);
        // On first launch with no cache and API failure, try stale cache as last resort
        const staleCacheResult = getAllCachedEventsForRange(info.start, info.end, true);
        if (staleCacheResult.events.length > 0) {
          console.log("[Calendar] Using stale cache as fallback after load failure");
          events = [...staleCacheResult.events];
          events.forEach(evt => {
            if (evt.extendedProps) {
              evt.extendedProps.isStaleCache = true;
              evt.extendedProps.connectionStatus = connectionStatus;
            }
          });
        }
      }
    }
    if (isDataToFilterAgain.current) {
      filteredEvents = filterEvents(
        events,
        tagsToDisplay,
        filterLogic,
        isInSidebar
      );
    }
    return filteredEvents;
  };

  // Extracted data loading logic for background refresh
  const loadFreshData = async (info) => {
      // Prevent concurrent execution to avoid double-syncing
      if (isLoadingFreshDataRef.current) {
        return;
      }

      isLoadingFreshDataRef.current = true;
      try {
        refreshTagsUids();
      // Load fresh Roam events
      const freshRoamEvents = await getBlocksToDisplayFromDNP(
        info.start,
        info.end,
        !isEntireDNP,
        isIncludingRefs,
        periodView.current.includes("time")
      );
      // const end = performance.now();
      // console.log("Events loading time: ", end - begin);

      // Start with fresh Roam events (this replaces any stale Roam events from cache)
      events = freshRoamEvents;

      // Enrich Roam events with sync metadata (gCalId) to enable proper deduplication
      for (const evt of events) {
        const metadata = getSyncMetadata(evt.id);

        // Add sync metadata if available
        if (metadata?.gCalId && !evt.extendedProps?.gCalId) {
          evt.extendedProps = {
            ...evt.extendedProps,
            gCalId: metadata.gCalId,
            gCalCalendarId: metadata.gCalCalendarId,
          };
        }
      }

      // Load events from all connected Google Calendars (with caching)
      // Strategy:
      // 1. Display cached events immediately for fast rendering
      // 2. ALWAYS fetch from API to get fresh data (unless offline)
      // 3. Update cache with fresh API data
      // 4. Update display with any new/changed events
      // Collect all GCal events for sync recovery and duplicate detection
      const allGCalEvents = [];

      if (isAuthenticated()) {
        const connectedCalendars = getConnectedCalendars();
        const enabledCalendars = connectedCalendars.filter(
          (c) => c.syncEnabled && c.syncDirection !== "export"
        );

        // Step 2: ALWAYS fetch from API to get fresh data
        for (const calendarConfig of enabledCalendars) {
          // Check if component is still mounted before fetching
          if (!isMountedRef.current) break;

          try {
            let gCalEvents = await getGCalEvents(
              calendarConfig.id,
              info.start,
              info.end
            );

            // Check again after async fetch
            if (!isMountedRef.current) break;

            if (gCalEvents && gCalEvents.length) {
              gCalEvents = await enrichEventsWithTaskData(gCalEvents, info.start, info.end);

              // Check again after enrichment
              if (!isMountedRef.current) break;

              // Collect all GCal events for later duplicate detection
              allGCalEvents.push(...gCalEvents);

              // BEGIN COMMENTED OUT - Sync recovery disabled with auto-sync removal
              // With on-demand sync only, users explicitly choose when to link events
              // Automatic recovery would interfere with intentional unsync operations
              /*
              // CRITICAL: Recover lost sync relationships BEFORE processing events
              // This prevents duplicate creation when extension storage is cleared
              await recoverLostSyncs(gCalEvents, calendarConfig.id);
              */
              // END COMMENTED OUT - Sync recovery disabled

              // BEGIN COMMENTED OUT - Auto-deduplication disabled (only needed for auto-sync cleanup)
              // With auto-sync disabled, auto-deduplication is no longer necessary on load
              /*
              // Auto-deduplication: Run once per day on first load for current month
              // This cleans up duplicates created before sync recovery was implemented
              // Skip for year view to avoid performance issues and duplicate risk
              const isYearView = periodView.current === "multiMonthYear";
              if (shouldRunAutoDeduplication() && !isYearView) {
                console.log("[Dedup] Running auto-deduplication for current view...");
                const dedupStats = await deduplicateAllEvents(
                  calendarConfig.id,
                  gCalEvents
                );
                if (dedupStats.removed > 0) {
                  console.log(
                    `[Dedup] ✅ Removed ${dedupStats.removed} duplicate events`
                  );
                  // Refetch events after deduplication
                  gCalEvents = await getGCalEvents(
                    calendarConfig.id,
                    info.start,
                    info.end
                  );
                  // Update collected events
                  allGCalEvents.length = 0; // Clear array
                  allGCalEvents.push(...gCalEvents);
                }
                markDeduplicationRun();
              }
              */
              // END COMMENTED OUT - Auto-deduplication disabled

              // Build lookup Map for O(1) event lookups instead of O(n) findIndex
              const eventIndexByGCalId = new Map();
              for (let i = 0; i < events.length; i++) {
                const gCalId = events[i].extendedProps?.gCalId;
                if (gCalId) {
                  eventIndexByGCalId.set(gCalId, i);
                }
              }

              for (const gcalEvent of gCalEvents) {
                const fcEvent = gcalEventToFCEvent(gcalEvent, calendarConfig);

                // Check if this event is already displayed - O(1) lookup
                const existingEventIndex = eventIndexByGCalId.has(gcalEvent.id)
                  ? eventIndexByGCalId.get(gcalEvent.id)
                  : -1;

                if (existingEventIndex !== -1) {
                  // Event already displayed - check for updates
                  const metadata = getSyncMetadata(events[existingEventIndex].id);
                  if (metadata) {
                    const syncStatus = determineSyncStatus(metadata, gcalEvent);

                    // Save current Roam-specific data before merging
                    const currentTitle = events[existingEventIndex].title;
                    const currentClassNames = events[existingEventIndex].classNames;
                    const currentEventTags = events[existingEventIndex].extendedProps?.eventTags;

                    // Check if GCal has been updated more recently and needs to update Roam
                    if (syncStatus === SyncStatus.PENDING || syncStatus === SyncStatus.CONFLICT) {
                      const gCalUpdated = new Date(gcalEvent.updated).getTime();
                      const roamUpdated = metadata.roamUpdated || metadata.lastSync;

                      if (gCalUpdated > roamUpdated) {
                        // Check if still mounted before modifying Roam
                        if (!isMountedRef.current) break;

                        await applyGCalToRoamUpdate(events[existingEventIndex].id, gcalEvent, calendarConfig);

                        // Check again after async update
                        if (!isMountedRef.current) break;

                        // Get fresh content from Roam block (which now has {{[[TODO]]}} or {{[[DONE]]}})
                        const freshContent = getBlockContentByUid(events[existingEventIndex].id);

                        // Merge GCal data (description, location, etc.)
                        events[existingEventIndex] = mergeGCalDataToFCEvent(
                          events[existingEventIndex],
                          gcalEvent,
                          calendarConfig
                        );

                        // Override title with Roam content to ensure proper TODO/DONE formatting
                        if (freshContent) {
                          events[existingEventIndex].title = freshContent;

                          // Update classNames and tags if TODO/DONE state changed
                          const hasTodo = freshContent.includes("{{[[TODO]]}}");
                          const hasDone = freshContent.includes("{{[[DONE]]}}");

                          if (hasTodo || hasDone) {
                            const newClassNames = [...events[existingEventIndex].classNames].filter(
                              (c) => c !== "TODO" && c !== "DONE"
                            );
                            newClassNames.push(hasTodo ? "TODO" : "DONE");
                            events[existingEventIndex].classNames = newClassNames;

                            // Update event tags
                            const updatedTags = getMatchingTags(
                              mapOfTags,
                              getBlocksUidReferencedInThisBlock(events[existingEventIndex].id)
                            );
                            events[existingEventIndex].extendedProps.eventTags = updatedTags;
                          }
                        }
                      } else {
                        // GCal is not newer, but still merge GCal-only data (description, location, htmlLink)
                        events[existingEventIndex] = mergeGCalDataToFCEvent(
                          events[existingEventIndex],
                          gcalEvent,
                          calendarConfig
                        );

                        // Restore Roam-specific data
                        events[existingEventIndex].title = currentTitle;
                        events[existingEventIndex].classNames = currentClassNames;
                        if (currentEventTags) {
                          events[existingEventIndex].extendedProps.eventTags = currentEventTags;
                        }
                      }
                    } else {
                      // Status is SYNCED - merge GCal data to get description, location, htmlLink
                      events[existingEventIndex] = mergeGCalDataToFCEvent(
                        events[existingEventIndex],
                        gcalEvent,
                        calendarConfig
                      );

                      // Restore Roam-specific data that shouldn't be overwritten by GCal
                      events[existingEventIndex].title = currentTitle;
                      events[existingEventIndex].classNames = currentClassNames;
                      if (currentEventTags) {
                        events[existingEventIndex].extendedProps.eventTags = currentEventTags;
                      }
                    }
                  }
                } else {
                  // Event not in current view - check if linked to Roam
                  const linkedRoamUid = getRoamUidByGCalId(gcalEvent.id);
                  if (linkedRoamUid) {
                    // Event is linked to Roam but not in current view
                    // (likely outside date range or filtered out)
                    const metadata = getSyncMetadata(linkedRoamUid);
                    if (metadata) {
                      const syncStatus = determineSyncStatus(metadata, gcalEvent);
                      if (syncStatus === SyncStatus.PENDING || syncStatus === SyncStatus.CONFLICT) {
                        const gCalUpdated = new Date(gcalEvent.updated).getTime();
                        const roamUpdated = metadata.roamUpdated || metadata.lastSync;

                        if (gCalUpdated > roamUpdated) {
                          // Check if still mounted before modifying Roam
                          if (!isMountedRef.current) break;

                          await applyGCalToRoamUpdate(linkedRoamUid, gcalEvent, calendarConfig);

                          // Check again after async update
                          if (!isMountedRef.current) break;
                        }
                      }
                    }
                    // Don't add GCal event - Roam block exists but not in current view
                  } else {
                    // No linked Roam block - add as GCal-only event
                    events.push(fcEvent);
                  }
                }
              }
            }
          } catch (error) {
            console.error(`Failed to fetch events from ${calendarConfig.name}:`, error);
          }
        }

        // BEGIN COMMENTED OUT - Auto-sync feature disabled in favor of on-demand sync
        // Sync is now always user-initiated to prevent duplicate events in edge cases
        // (extension reinstall, multiple sessions, etc.)
        /*
        // Auto-sync Roam events with GCal trigger tags that aren't synced yet
        // This happens AFTER sync recovery to prevent duplicates
        // Skip for year view to avoid performance issues and duplicate risk
        const isYearViewForAutoSync = periodView.current === "multiMonthYear";
        if (!isYearViewForAutoSync) {
          for (const evt of events) {
            // Check if component is still mounted before syncing
            if (!isMountedRef.current) break;

            // Skip if already synced
            if (evt.extendedProps?.gCalId) continue;

            // Check if event has a GCal trigger tag
            const targetCalendar = findCalendarForEvent(evt, connectedCalendars);

            if (targetCalendar) {
              // CRITICAL: Check if it's safe to auto-sync (no duplicate in GCal)
              if (!isSafeToAutoSync(evt, allGCalEvents)) {
                console.warn(`[Auto-sync] Skipping event "${evt.title}" - potential duplicate detected`);
                continue;
              }

              try {
                const result = await syncEventToGCal(evt.id, evt, targetCalendar.id);

                // Check again after async operation completes
                if (!isMountedRef.current) break;

                if (result.success) {
                  // Update event with sync info for proper deduplication
                  evt.extendedProps = {
                    ...evt.extendedProps,
                    gCalId: result.gCalId,
                    gCalCalendarId: targetCalendar.id,
                  };

                  // Add to allGCalEvents to prevent duplicate checks for subsequent events
                  allGCalEvents.push({
                    id: result.gCalId,
                    summary: evt.title,
                    start: { dateTime: evt.start },
                  });
                }
              } catch (error) {
                console.error("[Auto-sync] Error syncing event:", evt.title, error);
              }
            }
          }
        }
        */
        // END COMMENTED OUT - Auto-sync feature disabled

        // Load tasks from Google Tasks (if enabled)
        if (getTasksEnabled()) {
          const connectedTaskLists = getConnectedTaskLists();

          for (const listConfig of connectedTaskLists) {
            // Check if component is still mounted
            if (!isMountedRef.current) break;

            if (!listConfig.syncEnabled) continue;

            try {
              const tasks = await getTasks(listConfig.id, {
                dueMin: info.start,
                dueMax: info.end,
                showCompleted: true,
              });

              // Check again after async fetch
              if (!isMountedRef.current) break;

              if (tasks && tasks.length) {

                for (const task of tasks) {
                  // Only process tasks with due dates
                  if (!task.due) continue;

                  // Check if this task is already imported to Roam
                  const existingRoamUid = getRoamUidByGTaskId(task.id);

                  if (existingRoamUid) {
                    // Task exists in Roam - check if it's already in events array
                    const existingEventIndex = events.findIndex(evt => evt.id === existingRoamUid);
                    if (existingEventIndex === -1) {
                      // Task exists in Roam but not in current view - add FC event linked to Roam block
                      events.push(taskToFCEvent(task, listConfig, existingRoamUid));
                    }
                  } else {
                    // Task NOT imported to Roam - show as Google Task event (like GCal events)
                    // Use gtask-{id} format to distinguish from Roam blocks
                    events.push(taskToFCEvent(task, listConfig, null));
                  }
                }
              }
            } catch (error) {
              console.error(`[Tasks] Failed to fetch tasks from "${listConfig.name}":`, error);
            }
          }
        }
      }

      // Step 5: Filter duplicate GCal events that match non-synced Roam events with trigger tags
      // When a Roam event has a trigger tag and matches a GCal event, hide the GCal event
      // and mark the Roam event so it shows the "refresh-off" icon
      const filterDuplicateGCalEvents = (allEvents) => {
        // Get connected calendars for tag detection
        const connectedCalendars = getConnectedCalendars();

        // Find Roam events with trigger tags that are NOT yet synced
        const roamEventsWithTriggerTags = allEvents.filter(evt => {
          // Skip GCal-only events
          if (evt.extendedProps?.isGCalEvent) return false;
          // Skip Google Tasks
          if (evt.extendedProps?.isGTaskEvent) return false;
          // Skip already synced events
          if (evt.extendedProps?.gCalId) return false;
          // Check if has a trigger tag for any connected calendar
          return findCalendarForEvent(evt, connectedCalendars) !== null;
        });

        // Find GCal-only events (not linked to any Roam block)
        const gcalOnlyEvents = allEvents.filter(evt =>
          evt.extendedProps?.isGCalEvent && !getRoamUidByGCalId(evt.extendedProps?.gCalId)
        );

        // Find GCal events that match Roam events with trigger tags
        const gcalIdsToHide = new Set();

        for (const roamEvt of roamEventsWithTriggerTags) {
          // Create comparable format for the Roam event
          const roamEventForComparison = {
            id: roamEvt.id,
            summary: roamEvt.title,
            start: roamEvt.start,
            end: roamEvt.end,
          };

          for (const gcalEvt of gcalOnlyEvents) {
            // Create comparable format for the GCal event
            const gcalEventForComparison = {
              id: gcalEvt.extendedProps?.gCalId,
              summary: gcalEvt.title,
              start: gcalEvt.start,
              end: gcalEvt.end,
            };

            if (areEventsDuplicate(roamEventForComparison, gcalEventForComparison)) {
              gcalIdsToHide.add(gcalEvt.extendedProps?.gCalId);
              // Mark the Roam event as having a matching GCal event (for refresh-off icon)
              roamEvt.extendedProps = {
                ...roamEvt.extendedProps,
                hasMatchingGCalEvent: true,
                matchingGCalEventId: gcalEvt.extendedProps?.gCalId,
                matchingGCalCalendarId: gcalEvt.extendedProps?.gCalCalendarId,
              };
            }
          }
        }

        // Filter out matching GCal events from display
        if (gcalIdsToHide.size > 0) {
          console.log(`[Calendar] Hiding ${gcalIdsToHide.size} duplicate GCal event(s) that match Roam events with trigger tags`);
        }

        return allEvents.filter(evt => {
          if (!evt.extendedProps?.isGCalEvent) return true;
          return !gcalIdsToHide.has(evt.extendedProps?.gCalId);
        });
      };

      events = filterDuplicateGCalEvents(events);

      // Step 6: Cache ALL events (Roam + GCal + Tasks) for instant display on next view change
      // Only cache if component is still mounted
      if (!isMountedRef.current) {
        return; // Don't cache data from zombie instance
      }

      setAllCachedEventsForRange(info.start, info.end, events);

      isDataToReload.current = false;
      isDataToFilterAgain.current = true;
      } finally {
        isLoadingFreshDataRef.current = false;
      }
  };

  const handleEventDrop = async (info) => {
    let evtIndex = events.findIndex((evt) => evt.id === info.event.id);
    events[evtIndex].date = dateToISOString(info.event.start);
    events[evtIndex].start = info.event.start;
    events[evtIndex].end = info.event.end;

    // Update all-events cache with updated event
    updateEventInAllCache(events[evtIndex]);

    isDataToFilterAgain.current = true;

    // Handle GCal-only events (not yet imported to Roam)
    const isGCalOnly = info.event.id?.startsWith("gcal-");
    if (isGCalOnly) {
      // Just sync the updated dates to GCal - no Roam block operations needed
      await syncEventToGCalIfNeeded(info.event);
      return;
    }

    if (!info.event.extendedProps.refSourceUid) {
      // is in a timeGrid view
      if (info.view.type.includes("time")) {
        await updateTimestampsInBlock(info.event, info.oldEvent);
      }
      // if moved in the same day, doesn't need block move
      if (!info.delta.days && !info.delta.months) {
        // Still sync to GCal if time changed
        await syncEventToGCalIfNeeded(info.event);
        return;
      }

      // if is multiple days event
      if (info.event.end) {
        const startDayOfYear = getDayOfYear(info.event.start);
        const endDayOfYear = getDayOfYear(info.event.end);
        if (endDayOfYear - startDayOfYear !== 0) {
          await updateUntilDate(info.event, false);
        }
      }

      // if start date is in children
      if (info.event.extendedProps.startUid) {
        await updateStartDate(info.event);
        await syncEventToGCalIfNeeded(info.event);
        return;
      }
    }

    await moveDroppedEventBlock(info.event);
    await syncEventToGCalIfNeeded(info.event);
  };

  // Helper function to sync event to GCal if it's already synced
  const syncEventToGCalIfNeeded = async (fcEvent) => {
    if (!isAuthenticated()) return;

    const eventId = fcEvent.id || fcEvent.extendedProps?.id;
    if (!eventId) return;

    // Handle GCal-only events (not yet imported to Roam)
    if (eventId.startsWith("gcal-")) {
      return await updateGCalOnlyEvent(fcEvent);
    }

    const metadata = getSyncMetadata(eventId);
    if (!metadata || !metadata.gCalId) return; // Not synced to GCal

    try {
      // Fetch fresh content from Roam to ensure we have the latest title
      const freshContent = getBlockContentByUid(eventId);

      // Extract dates explicitly from FC Event object (getters might not spread correctly)
      // Also check our local events array for the most up-to-date end date
      const evtIndex = events.findIndex((evt) => evt.id === eventId);
      const localEvent = evtIndex !== -1 ? events[evtIndex] : null;

      const eventWithFreshContent = {
        id: fcEvent.id,
        title: freshContent || fcEvent.title,
        start: fcEvent.start,
        end: fcEvent.end || localEvent?.end || null,
        allDay: fcEvent.allDay,
        extendedProps: {
          ...fcEvent.extendedProps,
          hasTime: fcEvent.extendedProps?.hasTime ?? !fcEvent.allDay,
        },
      };

      const gcalEventData = fcEventToGCalEvent(eventWithFreshContent, metadata.gCalCalendarId, eventId);
      const result = await updateGCalEvent(
        metadata.gCalCalendarId,
        metadata.gCalId,
        gcalEventData
      );

      await updateSyncMetadata(eventId, {
        gCalUpdated: result.updated,
        etag: result.etag,
        roamUpdated: Date.now(),
        lastSync: Date.now(),
      });

      console.log("Synced event update to GCal:", result.id);
    } catch (error) {
      console.error("Failed to sync event to GCal:", error);
    }
  };

  // Helper function to update GCal-only events (not yet imported to Roam)
  const updateGCalOnlyEvent = async (fcEvent) => {
    if (!isAuthenticated()) return;

    const gCalId = fcEvent.extendedProps?.gCalId;
    const gCalCalendarId = fcEvent.extendedProps?.gCalCalendarId;

    if (!gCalId || !gCalCalendarId) {
      console.error("Missing GCal metadata for GCal-only event:", fcEvent.id);
      return;
    }

    try {
      // Extract dates explicitly from FC Event object (getters might not spread correctly)
      const evtIndex = events.findIndex((evt) => evt.id === fcEvent.id);
      const localEvent = evtIndex !== -1 ? events[evtIndex] : null;

      const eventForGCal = {
        id: fcEvent.id,
        title: fcEvent.title,
        start: fcEvent.start,
        end: fcEvent.end || localEvent?.end || null,
        allDay: fcEvent.allDay,
        extendedProps: {
          ...fcEvent.extendedProps,
          hasTime: fcEvent.extendedProps?.hasTime ?? !fcEvent.allDay,
        },
      };

      const gcalEventData = fcEventToGCalEvent(eventForGCal, gCalCalendarId);
      const result = await updateGCalEvent(gCalCalendarId, gCalId, gcalEventData);

      // Update the event in our local events array
      if (evtIndex !== -1) {
        events[evtIndex].extendedProps.gCalUpdated = result.updated;
        events[evtIndex].extendedProps.gCalEtag = result.etag;
      }

      console.log("Updated GCal-only event:", result.id);
    } catch (error) {
      console.error("Failed to update GCal-only event:", error);
    }
  };

  const handleExternalDrop = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    let targetUid;
    const sourceUid = e.dataTransfer.getData("text");

    // get date & time from calendar DOM table !
    let timeFromTimegrid;
    let dateFromTimegrid;
    if (e.target.dataset["time"]) {
      const x = e.clientX;
      const y = e.clientY;
      const eltsToHide = [];
      timeFromTimegrid = e.target.dataset["time"].slice(0, 5);
      for (let i = 0; i < 3; i++) {
        const elt = document.elementFromPoint(x, y);
        eltsToHide.push({ elt, display: elt.style.display });
        eltsToHide[i].elt.style.display = "none";
      }
      const column = document.elementFromPoint(x, y);
      dateFromTimegrid = column.parentElement.dataset["date"];
      eltsToHide.forEach((elt) => (elt.elt.style.display = elt.display));
    }

    const targetDateString =
      e.target.parentNode.dataset["date"] || dateFromTimegrid;
    const targetDate = new Date(
      targetDateString + (timeFromTimegrid ? " " + timeFromTimegrid : "")
    );
    const date = dateToISOString(targetDate);
    if (sourceUid.includes("isTag")) {
      const draggedTag = JSON.parse(sourceUid);
      handleSquareDayClick(
        {
          date: targetDate,
          dateStr:
            targetDateString + (timeFromTimegrid ? " " + timeFromTimegrid : ""),
          jsEvent: e,
        },
        draggedTag.tagTitle
      );
      return;
    }
    const blockContent = getBlockContentByUid(sourceUid);
    const blockRefs = getBlocksUidReferencedInThisBlock(sourceUid);
    const matchingTags = getMatchingTags(tagsToDisplay, blockRefs);
    let calendarBlockUid = await getCalendarUidFromPage(
      window.roamAlphaAPI.util.dateToPageUid(targetDate)
    );
    if (e.shiftKey) {
      targetUid = await createChildBlock(calendarBlockUid, blockContent);
    } else if (e.altKey || e.ctrlKey) {
      targetUid = await createChildBlock(calendarBlockUid, `((${sourceUid}))`);
    } else {
      targetUid = sourceUid;
      await window.roamAlphaAPI.moveBlock({
        location: {
          "parent-uid": calendarBlockUid,
          order: "last",
        },
        block: { uid: sourceUid },
      });
    }
    if (timeFromTimegrid) {
      await updateTimestampsInBlock({ id: targetUid, start: targetDate });
      isDataToReload.current = true;
    } else isDataToReload.current = false;
    events.push(
      parseEventObject({
        id: targetUid,
        title: blockContent,
        date: date,
        matchingTags: matchingTags,
      })
    );
    isDataToReload.current = true;
    setForceToReload((prev) => !prev);
  };

  const handleEventResize = async (info) => {
    // Update local events array
    const evtIndex = events.findIndex((evt) => evt.id === info.event.id);
    if (evtIndex !== -1) {
      events[evtIndex].start = info.event.start;
      events[evtIndex].end = info.event.end;

      // Update all-events cache with resized event
      updateEventInAllCache(events[evtIndex]);
    }

    // Handle GCal-only events (not yet imported to Roam)
    const isGCalOnly = info.event.id?.startsWith("gcal-");
    if (isGCalOnly) {
      // Just sync the updated dates to GCal - no Roam block operations needed
      await syncEventToGCalIfNeeded(info.event);
      isDataToReload.current = true;
      setForceToReload((prev) => !prev);
      return;
    }

    if (info.view.type.includes("Month") || info.view.type.includes("Year")) {
      if (info.endDelta.days) await updateUntilDate(info.event);
      else if (info.startDelta.days) {
        if (!info.oldEvent.end) await updateUntilDate(info.event);
        if (info.event.extendedProps.startUid)
          await updateStartDate(info.event);
        else moveDroppedEventBlock(info.event);
      }
    } else {
      await updateTimestampsInBlock(info.event);
    }

    // Sync to GCal if event is synced
    await syncEventToGCalIfNeeded(info.event);

    isDataToReload.current = true;
    setForceToReload((prev) => !prev);
  };

  // const parseGoogleCalendarEvent = (event) => {
  //   console.log("event :>> ", event);
  //   return {
  //     id: event.id,
  //     title: event.title,
  //     start: event.start,
  //     end: event.end,
  //     classNames: ["fc-event-gcal"],
  //     extendedProps: {
  //       // eventTags: [getTagFromName("Google calendar")],
  //       isRef: false,
  //     },
  //     color: "grey", //getTagColorFromName("Google calendar"),
  //     display: "block",
  //     editable: false,
  //     url: event.url,
  //   };
  // };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
      }}
      onDrop={handleExternalDrop}
    >
      <NewEventDialog
        newEventDialogIsOpen={newEventDialogIsOpen}
        setNewEventDialogIsOpen={setNewEventDialogIsOpen}
        pageUid={focusedPageUid}
        pageTitle={focusedPageTitle}
        tagToInsert={tagToInsert}
        position={position}
        addEvent={addEvent}
        focusedTime={focusedTime}
        periodView={periodView.current}
      />
      <MultiSelectFilter
        tagsToDisplay={tagsToDisplay}
        setTagsToDisplay={setTagsToDisplay}
        filterLogic={filterLogic}
        setFilterLogic={setFilterLogic}
        isEntireDNP={isEntireDNP}
        setIsEntireDNP={setIsEntireDNP}
        isIncludingRefs={isIncludingRefs}
        setIsIncludingRefs={setIsIncludingRefs}
        isWEtoDisplay={isWEtoDisplay}
        setIsWEtoDisplay={setIsWEtoDisplay}
        parentElt={parentElt}
        updateSize={updateSize}
        isDataToReload={isDataToReload}
        isDataToFilterAgain={isDataToFilterAgain}
        isInSidebar={isInSidebar}
        initialSticky={
          initialSettings.sticky !== null ? initialSettings.sticky : false
        }
        initialMinimized={
          initialSettings.minimized !== null ? initialSettings.minimized : false
        }
        eventsInViewRef={eventsInViewRef}
        refreshCalendar={updateSize}
      />
      <FullCalendar
        plugins={[
          dayGridPlugin,
          timeGridPlugin,
          multiMonthPlugin,
          interactionPlugin,
          googleCalendarPlugin,
        ]}
        ref={calendarRef}
        // aspectRatio={1.35}
        // contentHeight={"auto"}
        views={{
          timeGrid: {
            displayEventTime: displayTime || false,
          },
        }}
        customButtons={{
          refreshButton: {
            text: "↻",
            click: updateSize,
          },
        }}
        height={"90%"}
        expandRows={true}
        multiMonthMinWidth={440}
        // multiMonthMaxColumns={2}
        dayMaxEvents={true}
        initialDate={initialDate || null}
        initialView={periodView.current}
        headerToolbar={{
          left: "prev,next today refreshButton",
          center: "title",
          right:
            "multiMonthYear,dayGridMonth," +
            (timeGrid.week ? "timeGridWeek," : "dayGridWeek,") +
            (timeGrid.day ? "timeGridDay" : "dayGridDay"),
        }}
        firstDay={firstDay === "Sunday" ? 0 : 1}
        weekends={isWEtoDisplay}
        fixedWeekCount={false}
        weekNumbers={true}
        nowIndicator={true}
        eventOrder={
          eventsOrder === "alphanumeric content"
            ? "-duration,title,level"
            : "-duration,level,title"
        }
        eventTimeFormat={eventTimeFormats[timeFormat]}
        slotLabelFormat={eventTimeFormats[timeFormat]}
        slotMinTime={minTime}
        slotMaxTime={maxTime === "00:00" ? "23:59" : maxTime}
        navLinks={true}
        editable={true}
        selectable={true}
        droppable={true}
        // draggable={true}
        // initialEvents={getEventsFromDNP}
        datesSet={(info) => {
          if (periodView.current !== info.view.type) {
            periodView.current = info.view.type;
            extensionStorage.set(
              "fc-periodView" + (isInSidebar ? "-sb" : ""),
              info.view.type
            );
            if (info.view.type.includes("time"))
              setForceToReload((prev) => !prev);
          }
        }}
        // events={getEventsFromDNP}
        // googleCalendarApiKey={process.env.googleCalendarApiKey}
        eventSources={[
          getEventsFromDNP,
          // {
          //   googleCalendarId: "jean.suiloin@gmail.com",
          //   eventDataTransform: parseGoogleCalendarEvent,
          // },
        ]}
        eventsSet={(eventInfo) => {
          // Update events in view for batch sync dialog (using ref to avoid infinite loops)
          eventsInViewRef.current = eventInfo;
        }}
        eventContent={(info, jsEvent) => renderEventContent(info, jsEvent)}
        eventClick={(info) => {
          // info.jsEvent.preventDefault();
          if (info.jsEvent.shiftKey) {
            window.roamAlphaAPI.ui.rightSidebar.addWindow({
              window: { type: "block", "block-uid": info.event.id },
            });
          }
        }}
        eventDrop={handleEventDrop}
        eventResizableFromStart={true}
        eventResize={handleEventResize}
        dateClick={handleSquareDayClick}
        select={handleSelectDays}
        dayHeaders={true}
        viewWillUnmount={() => (isDataToReload.current = true)}
        // dayCellContent={renderDayContent}
      />
    </div>
  );
};

export default Calendar;
