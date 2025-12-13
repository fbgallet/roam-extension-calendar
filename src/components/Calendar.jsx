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
import {
  createChildBlock,
  createNewPageIfNotExisting,
  getBlockContentByUid,
  getBlocksUidReferencedInThisBlock,
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
} from "../services/googleCalendarService";
import { gcalEventToFCEvent, fcEventToGCalEvent, mergeGCalDataToFCEvent, findCalendarForEvent } from "../util/gcalMapping";
import { saveSyncMetadata, createSyncMetadata, getSyncMetadata, updateSyncMetadata, getRoamUidByGCalId, determineSyncStatus, SyncStatus } from "../models/SyncMetadata";
import { applyGCalToRoamUpdate, syncEventToGCal } from "../services/syncService";
import { enrichEventsWithTaskData } from "../services/taskService";

let events = [];
let filteredEvents = [];

const Calendar = ({
  parentElt,
  isInSidebar,
  periodType,
  initialDate,
  initialSettings,
}) => {
  const [newEventDialogIsOpen, setNewEventDialogIsOpen] = useState(false);
  const [focusedPageUid, setFocusedPageUid] = useState(null);
  const [focusedPageTitle, setFocusedPageTitle] = useState(null);
  const [tagToInsert, setTagToInsert] = useState(null);
  // const [events, setEvents] = useState([]);
  const [forceToReload, setForceToReload] = useState(false);
  const [position, setPosition] = useState({ x: null, y: null });
  const [focusedTime, setFocusedTime] = useState(null);

  const [filterLogic, setFilterLogic] = useState(
    initialSettings.logic !== null ? initialSettings.logic : "Or"
  );
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
    if (title.includes("{{[[TODO]]}}")) {
      hasCheckbox = true;
      isChecked = false;
      title = title.replace("{{[[TODO]]}}", "");
    } else if (title.includes("{{[[DONE]]}}")) {
      hasCheckbox = true;
      isChecked = true;
      title = title.replace("{{[[DONE]]}}", "");
    }
    // console.log(info);
    const dnpTitle = window.roamAlphaAPI.util.dateToPageTitle(info.event.start);
    if (title.includes(`[[${dnpTitle}]]`)) {
      title = title.replace(`[[${dnpTitle}]]`, "");
    }
    title = title.trim();
    return (
      <Event
        displayTitle={title}
        event={info.event}
        timeText={info.timeText}
        hasCheckbox={hasCheckbox}
        isChecked={isChecked}
        tagsToDisplay={tagsToDisplay}
        backgroundColor={info.backgroundColor}
        updateEvent={updateEvent}
        deleteEvent={deleteEvent}
      ></Event>
    );
  };

  const addEvent = async (eventUid, pageUid, isGcal, targetCalendarId = null) => {
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

      if (targetCalendar && targetCalendar.syncDirection !== "import") {
        // Add trigger tag to Roam block if not already present
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

    // Complete the GCal sync if needed
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
          events[index][key] = updatedProperties[key];
          if (key !== "extendedProps")
            event.setProp(key, updatedProperties[key]);
          else {
            for (const extendedProp in updatedProperties["extendedProps"]) {
              event.setExtendedProp(
                extendedProp,
                updatedProperties[key][extendedProp]
              );
            }
          }
        }
      }
      isDataToFilterAgain.current = true;
    }
  };

  const deleteEvent = (event) => {
    event.remove();
    const index = events.findIndex((evt) => evt.id === event.id);
    events.splice(index, 1);
    isDataToFilterAgain.current = true;
    setForceToReload((prev) => !prev);
  };

  const renderDayContent = (info, elt) => {
    // console.log("day:", info);
  };

  const getEventsFromDNP = async (info) => {
    if (
      viewRange.current.start &&
      (viewRange.current.start.getDate() !== info.start.getDate() ||
        viewRange.current.end.getDate() !== info.end.getDate())
    ) {
      isDataToReload.current = true;
      isDataToFilterAgain.current = true;
    }
    viewRange.current.start = info.start;
    viewRange.current.end = info.end;

    if (isDataToReload.current) {
      refreshTagsUids();
      // const begin = performance.now();
      events = await getBlocksToDisplayFromDNP(
        info.start,
        info.end,
        !isEntireDNP,
        isIncludingRefs,
        periodView.current.includes("time")
      );
      // const end = performance.now();
      // console.log("Events loading time: ", end - begin);

      // Enrich Roam events with sync metadata (gCalId) to enable proper deduplication
      for (const evt of events) {
        const metadata = getSyncMetadata(evt.id);
        if (metadata?.gCalId) {
          evt.extendedProps = {
            ...evt.extendedProps,
            gCalId: metadata.gCalId,
            gCalCalendarId: metadata.gCalCalendarId,
          };
        }
      }

      // Auto-sync Roam events with GCal trigger tags that aren't synced yet
      if (isAuthenticated()) {
        const connectedCalendars = getConnectedCalendars();
        console.log("[Auto-sync] Connected calendars:", connectedCalendars);
        console.log("[Auto-sync] Checking", events.length, "events for auto-sync");
        let syncedCount = 0;

        for (const evt of events) {
          // Skip if already synced
          if (evt.extendedProps?.gCalId) {
            console.log("[Auto-sync] Skipping already synced event:", evt.title);
            continue;
          }

          // Debug: log event tags
          console.log("[Auto-sync] Event:", evt.title, "- Tags:", evt.extendedProps?.eventTags);

          // Check if event has a GCal trigger tag
          const targetCalendar = findCalendarForEvent(evt, connectedCalendars);

          if (targetCalendar) {
            // This event has a trigger tag but isn't synced - sync it now
            console.log("[Auto-sync] ✓ Found target calendar for event:", evt.title, "→", targetCalendar.name);

            try {
              const result = await syncEventToGCal(evt.id, evt, targetCalendar.id);

              if (result.success) {
                // Update event with sync info for proper deduplication
                evt.extendedProps = {
                  ...evt.extendedProps,
                  gCalId: result.gCalId,
                  gCalCalendarId: targetCalendar.id,
                };
                syncedCount++;
                console.log("[Auto-sync] ✓ Successfully synced:", evt.title);
              } else {
                console.log("[Auto-sync] ✗ Sync failed (no success):", evt.title, result);
              }
            } catch (error) {
              console.error("[Auto-sync] ✗ Error syncing event:", evt.title, error);
            }
          } else {
            console.log("[Auto-sync] No target calendar found for event:", evt.title);
          }
        }

        if (syncedCount > 0) {
          console.log(`[Auto-sync] ✓ Completed: synced ${syncedCount} event(s) to Google Calendar`);
        } else {
          console.log("[Auto-sync] No events needed syncing");
        }
      }

      // Load events from all connected Google Calendars
      if (isAuthenticated()) {
        const connectedCalendars = getConnectedCalendars();

        for (const calendarConfig of connectedCalendars) {
          if (!calendarConfig.syncEnabled) continue;
          if (calendarConfig.syncDirection === "export") continue; // Export-only calendars don't import events

          try {
            let gCalEvents = await getGCalEvents(
              calendarConfig.id,
              info.start,
              info.end
            );

            // Enrich Google Tasks with their actual notes/description
            if (gCalEvents && gCalEvents.length) {
              gCalEvents = await enrichEventsWithTaskData(gCalEvents, info.start, info.end);
              console.log(`GCal events from ${calendarConfig.name}:`, gCalEvents);

              for (const gcalEvent of gCalEvents) {
                // Check if this event is already in Roam (by gCalId in existing events or in sync metadata)
                const existingEventIndex = events.findIndex(
                  (evt) => evt.extendedProps?.gCalId === gcalEvent.id
                );

                // Also check sync metadata storage - a Roam block might be synced to this GCal event
                const linkedRoamUid = getRoamUidByGCalId(gcalEvent.id);

                if (existingEventIndex !== -1) {
                  // Event exists in FC - check if GCal has updates
                  const metadata = getSyncMetadata(events[existingEventIndex].id);
                  if (metadata) {
                    const syncStatus = determineSyncStatus(metadata, gcalEvent);
                    if (syncStatus === SyncStatus.PENDING || syncStatus === SyncStatus.CONFLICT) {
                      const gCalUpdated = new Date(gcalEvent.updated).getTime();
                      const roamUpdated = metadata.roamUpdated || metadata.lastSync;

                      if (gCalUpdated > roamUpdated) {
                        // GCal is newer - update the FC event and Roam block
                        console.log("GCal event is newer, updating Roam:", gcalEvent.id);
                        await applyGCalToRoamUpdate(events[existingEventIndex].id, gcalEvent, calendarConfig);
                        // Update FC event in memory
                        events[existingEventIndex] = mergeGCalDataToFCEvent(
                          events[existingEventIndex],
                          gcalEvent,
                          calendarConfig
                        );
                      }
                    }
                  }
                } else if (linkedRoamUid) {
                  // Event is linked to a Roam block but not in current FC events
                  // Check if GCal has updates
                  const metadata = getSyncMetadata(linkedRoamUid);
                  if (metadata) {
                    const syncStatus = determineSyncStatus(metadata, gcalEvent);
                    if (syncStatus === SyncStatus.PENDING || syncStatus === SyncStatus.CONFLICT) {
                      const gCalUpdated = new Date(gcalEvent.updated).getTime();
                      const roamUpdated = metadata.roamUpdated || metadata.lastSync;

                      if (gCalUpdated > roamUpdated) {
                        // GCal is newer - update the Roam block
                        console.log("GCal event is newer (linked), updating Roam:", gcalEvent.id);
                        await applyGCalToRoamUpdate(linkedRoamUid, gcalEvent, calendarConfig);
                      }
                    }
                  }
                } else {
                  // New GCal-only event (not linked to any Roam block)
                  events.push(gcalEventToFCEvent(gcalEvent, calendarConfig));
                }
              }
            }
          } catch (error) {
            console.error(`Failed to fetch events from ${calendarConfig.name}:`, error);
          }
        }
      }

      console.log("events :>> ", events);
      isDataToFilterAgain.current = true;
    }
    if (isDataToFilterAgain.current) {
      filteredEvents = filterEvents(
        events,
        tagsToDisplay,
        filterLogic,
        isInSidebar
      );
      // console.log("Filtered events to display:>> ", filteredEvents);
    }
    return filteredEvents;
  };

  const handleEventDrop = async (info) => {
    let evtIndex = events.findIndex((evt) => evt.id === info.event.id);
    events[evtIndex].date = dateToISOString(info.event.start);
    events[evtIndex].start = info.event.start;
    events[evtIndex].end = info.event.end;
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
