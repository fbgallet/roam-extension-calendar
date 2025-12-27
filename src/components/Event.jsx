import {
  Checkbox,
  Icon,
  Tooltip,
  Popover,
  Classes,
  Button,
  Tag,
  Menu,
  MenuItem,
  MenuDivider,
} from "@blueprintjs/core";
import {
  createChildBlock,
  deleteBlock,
  deleteBlockIfNoChild,
  getBlockContentByUid,
  getBlocksUidReferencedInThisBlock,
  getFlattenedContentOfParentAndFirstChildren,
  getParentBlock,
  getTreeByUid,
  updateBlock,
  addTagToBlock,
  removeGCalTagsFromBlock,
} from "../util/roamApi";
import {
  colorToDisplay,
  getCalendarUidFromPage,
  getInfosFromChildren,
  getMatchingTags,
  parseEventObject,
  replaceItemAndGetUpdatedArray,
} from "../util/data";
import { useState, useRef, useEffect } from "react";
import { getTagFromName } from "../models/EventTag";
import { calendarTag, mapOfTags } from "..";
import TagList from "./TagList";
import DeleteDialog from "./DeleteDialog";
import { getTimestampFromHM, getFormatedRange } from "../util/dates";
import {
  getConnectedCalendars,
  getConnectedTaskLists,
  isAuthenticated,
  updateEvent as updateGCalEvent,
  deleteEvent as deleteGCalEvent,
  createEvent as createGCalEvent,
  updateTask,
} from "../services/googleCalendarService";
import {
  syncTaskCompletionToGoogle,
  importTaskToRoam,
} from "../services/googleTasksService";
import { getTaskSyncMetadata } from "../models/TaskSyncMetadata";
import {
  saveSyncMetadata,
  createSyncMetadata,
  getSyncMetadata,
  updateSyncMetadata,
  deleteSyncMetadata,
} from "../models/SyncMetadata";
import { fcEventToGCalEvent, convertGCalTodoToRoam } from "../util/gcalMapping";
import { clearTasksCache } from "../services/taskService";
import {
  invalidateAllEventsCache,
  updateEventInAllCache,
} from "../services/eventCacheService";
import { parseHtmlToReact } from "../util/htmlParser";

// Google Calendar icon for unimported GCal events
import googleCalendarIcon from "../services/gcal-logo-64-white.png";
// Google Tasks icon for unimported task events
import GoogleTasksIconSvg from "../services/google-task-logo.svg";

const Event = ({
  displayTitle,
  event,
  timeText,
  hasCheckbox,
  isChecked,
  tagsToDisplay,
  deleteEvent,
  updateEvent,
  refreshCalendar,
}) => {
  const [eventTagList, setEventTagList] = useState(
    event.extendedProps.eventTags
  );
  const [popoverIsOpen, setPopoverIsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isExisting, setIsExisting] = useState(true);
  const popoverRef = useRef(null);
  const initialContent = useRef(null);

  // Check if this is a Google Calendar event
  // Only use the isGCalEvent flag set by gcalEventToFCEvent
  // Don't check tag names, as Roam events with trigger tags will have "Google calendar" tag
  const isGCalEvent = event.extendedProps?.isGCalEvent === true;

  // Check if this is a Google Task event (not imported to Roam)
  const isGTaskEvent = event.extendedProps?.isGTaskEvent === true;

  // Check if this Roam event is synced to GCal
  const isSyncedToGCal =
    !isGCalEvent &&
    !isGTaskEvent &&
    (event.extendedProps?.gCalId || getSyncMetadata(event.id)?.gCalId);

  // Check if this is a Google Task (has _taskData from enrichment - old pattern for calendar-based tasks)
  const isGoogleTask = !!event.extendedProps?._taskData;
  const taskData = event.extendedProps?._taskData;
  const [taskCompleted, setTaskCompleted] = useState(
    taskData?.status === "completed"
  );
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);

  // Sync taskCompleted state when taskData changes (e.g., after refetch)
  useEffect(() => {
    if (taskData) {
      setTaskCompleted(taskData.status === "completed");
    }
  }, [taskData?.status]);

  // Handler to toggle task completion status (for calendar-based tasks)
  const handleTaskToggle = async (e) => {
    e.stopPropagation();
    if (!taskData || isUpdatingTask) return;

    setIsUpdatingTask(true);
    const newStatus = taskCompleted ? "needsAction" : "completed";

    try {
      await updateTask(taskData.taskListId, taskData.taskId, {
        status: newStatus,
      });

      setTaskCompleted(!taskCompleted);
      // Clear the tasks cache so next fetch gets fresh data
      clearTasksCache();
      console.log(`[Tasks] Task "${event.title}" marked as ${newStatus}`);
    } catch (error) {
      console.error("[Tasks] Failed to update task status:", error);
    } finally {
      setIsUpdatingTask(false);
    }
  };

  // Handler to toggle non-imported Google Task completion status
  const handleGTaskEventToggle = async (e) => {
    e.stopPropagation();
    if (isUpdatingTask) return;

    const gTaskData = event.extendedProps?.gTaskData;
    const taskListId = event.extendedProps?.gTaskListId;
    if (!gTaskData || !taskListId) return;

    setIsUpdatingTask(true);
    const currentStatus = gTaskData.status;
    const newStatus =
      currentStatus === "completed" ? "needsAction" : "completed";

    try {
      await updateTask(taskListId, gTaskData.id, {
        status: newStatus,
      });

      // Update the event's gTaskData in place
      event.extendedProps.gTaskData.status = newStatus;

      // Clear the tasks cache so next fetch gets fresh data
      clearTasksCache();
      console.log(
        `[Tasks] Non-imported task "${event.title}" marked as ${newStatus}`
      );

      // Force a re-render by toggling the state
      setTaskCompleted(newStatus === "completed");
    } catch (error) {
      console.error("[Tasks] Failed to update task status:", error);
    } finally {
      setIsUpdatingTask(false);
    }
  };

  // Detect if non-synced GCal event has TODO/DONE markers
  const hasGCalTodoMarker =
    isGCalEvent &&
    !isGoogleTask &&
    (event.title.match(/^\[\[TODO\]\]/) ||
      event.title.match(/^\[\s*\]/) ||
      event.title.match(/^\[\[DONE\]\]/) ||
      event.title.match(/^\[x\]/));

  // For non-synced GCal events, only show checkbox if title has markers
  const showGCalCheckbox = isGCalEvent && !isGoogleTask && hasGCalTodoMarker;

  const [gCalTodoCompleted, setGCalTodoCompleted] = useState(
    event.title.match(/^\[\[DONE\]\]/) || event.title.match(/^\[x\]/)
  );

  // Handler to toggle non-synced GCal event TODO/DONE status
  const handleGCalTodoToggle = async (e) => {
    e.stopPropagation();
    if (isUpdatingTask) return;

    const gCalId = event.extendedProps?.gCalId;
    const gCalCalendarId = event.extendedProps?.gCalCalendarId;
    if (!gCalId || !gCalCalendarId) return;

    setIsUpdatingTask(true);
    const newCompleted = !gCalTodoCompleted;

    try {
      // Update the event title in Google Calendar
      // Respect the original format: [ ] <=> [x] and [[TODO]] <=> [[DONE]]
      let newTitle = event.title;
      if (newCompleted) {
        // Mark as done - preserve format
        if (newTitle.match(/^\[\[TODO\]\]/)) {
          newTitle = newTitle.replace(/^\[\[TODO\]\]\s*/, "[[DONE]] ");
        } else if (newTitle.match(/^\[\s*\]/)) {
          newTitle = newTitle.replace(/^\[\s*\]\s*/, "[x] ");
        }
      } else {
        // Mark as todo - preserve format
        if (newTitle.match(/^\[\[DONE\]\]/)) {
          newTitle = newTitle.replace(/^\[\[DONE\]\]\s*/, "[[TODO]] ");
        } else if (newTitle.match(/^\[x\]/)) {
          newTitle = newTitle.replace(/^\[x\]\s*/, "[ ] ");
        }
      }

      // Build the complete event update object with required fields
      const isAllDay = event.allDay || !event.extendedProps?.hasTime;
      const updateData = {
        summary: newTitle,
      };

      // Add start and end times (required by Google Calendar API)
      if (isAllDay) {
        // All-day event - end date is exclusive in Google Calendar
        const startDate = new Date(event.start);
        // Get the date string in local timezone format (YYYY-MM-DD)
        const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

        // For all-day events, if there's no end or end equals start, set end to next day
        let endDateStr;
        if (!event.end) {
          // No end date - single day event, end should be next day
          const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        } else {
          const endDate = new Date(event.end);
          const endDateStrTmp = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

          // Check if it's a single-day event (start and end are same day)
          if (startDateStr === endDateStrTmp) {
            // Single day event - end should be next day
            const nextDay = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
            endDateStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
          } else {
            endDateStr = endDateStrTmp;
          }
        }

        updateData.start = {
          date: startDateStr,
        };
        updateData.end = {
          date: endDateStr,
        };
      } else {
        // Timed event
        const startDate = new Date(event.start);
        const endDate = event.end
          ? new Date(event.end)
          : new Date(startDate.getTime() + 60 * 60 * 1000);
        updateData.start = {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        updateData.end = {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      await updateGCalEvent(gCalCalendarId, gCalId, updateData);

      // Update event tags based on new completion state
      const updatedTags = [...eventTagList];
      const todoTag = getTagFromName("TODO");
      const doneTag = getTagFromName("DONE");

      // Remove both TODO and DONE tags first
      const filteredTags = updatedTags.filter(
        (tag) => tag.name !== "TODO" && tag.name !== "DONE"
      );

      // Add the appropriate tag based on completion state
      if (newCompleted && doneTag) {
        filteredTags.push(doneTag);
      } else if (!newCompleted && todoTag) {
        filteredTags.push(todoTag);
      }

      // Update local event using the updateEvent function
      updateEvent(event, {
        title: newTitle,
        extendedProps: {
          ...event.extendedProps,
          eventTags: filteredTags,
        },
      });

      setEventTagList(filteredTags);
      setGCalTodoCompleted(newCompleted);

      // Invalidate cache to refresh on next load
      invalidateAllEventsCache();
      console.log(
        `[GCal] Non-synced event "${newTitle}" marked as ${
          newCompleted ? "done" : "todo"
        }`
      );
    } catch (error) {
      console.error("[GCal] Failed to update event TODO/DONE status:", error);
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleDeleteEvent = async () => {
    const currentCalendarUid = getParentBlock(event.id);
    await deleteBlock(event.id);
    deleteBlockIfNoChild(currentCalendarUid);
    deleteEvent(event);
    setIsDeleteDialogOpen(false);
    setPopoverIsOpen(false);
    setIsExisting(false);
  };

  const handleImportToRoam = async () => {
    try {
      // Handle Google Task import
      if (isGTaskEvent) {
        const task = event.extendedProps.gTaskData;
        const taskListId = event.extendedProps.gTaskListId;
        const connectedTaskLists = getConnectedTaskLists();
        const listConfig = connectedTaskLists.find((l) => l.id === taskListId);

        if (!task || !listConfig) {
          console.error("Missing task data or list config for import");
          return;
        }

        const newBlockUid = await importTaskToRoam(task, listConfig);
        if (newBlockUid) {
          // Invalidate cache and refresh calendar to convert to synced task
          invalidateAllEventsCache();
          setPopoverIsOpen(false);
          console.log("Imported Google Task to Roam:", newBlockUid);

          // Trigger immediate calendar refresh
          if (refreshCalendar) {
            await refreshCalendar();
          }
        }
        return;
      }

      // Handle Google Calendar event import
      const eventStart = new Date(event.start);
      const dnpUid = window.roamAlphaAPI.util.dateToPageUid(eventStart);

      // Build the block content
      let content = "";

      // Add time if it's a timed event (using user's timeFormat setting)
      if (event.extendedProps?.hasTime) {
        const startTimestamp = getTimestampFromHM(
          eventStart.getHours(),
          eventStart.getMinutes()
        );

        if (event.end) {
          const endDate = new Date(event.end);
          const endTimestamp = getTimestampFromHM(
            endDate.getHours(),
            endDate.getMinutes()
          );
          content += getFormatedRange(startTimestamp, endTimestamp) + " ";
        } else {
          content += startTimestamp + " ";
        }
      }

      // Add title (convert TODO/DONE markers to Roam format)
      let title = event.title || "(No title)";
      title = convertGCalTodoToRoam(title);
      content += title;

      // Add trigger tag from calendar config
      const calendarId = event.extendedProps?.gCalCalendarId;
      const connectedCalendars = getConnectedCalendars();
      const calendarConfig = connectedCalendars.find(
        (c) => c.id === calendarId
      );
      if (calendarConfig?.triggerTags?.[0]) {
        const tag = calendarConfig.triggerTags[0];
        content += tag.includes(" ") ? ` #[[${tag}]]` : ` #${tag}`;
      }

      // Create the block under #calendar tag in the DNP
      const calendarBlockUid = await getCalendarUidFromPage(dnpUid);
      const newBlockUid = await createChildBlock(calendarBlockUid, content);

      // Add description as child block if present
      if (newBlockUid && event.extendedProps?.description) {
        let description = event.extendedProps.description
          .replace(/<[^>]*>/g, "") // Remove HTML tags
          .replace(/&nbsp;/g, " ")
          .trim();
        // Filter out any existing Roam link from GCal description
        description = description
          .replace(/\n*---\n*Roam block:.*$/s, "")
          .trim();
        if (description) {
          await createChildBlock(newBlockUid, description);
        }
      }

      // Handle multi-day all-day events with until:: child block
      if (newBlockUid && event.end) {
        const endDate = new Date(event.end);
        // For all-day events, GCal end is exclusive (day after last day)
        const isMultiDay =
          !event.extendedProps?.hasTime &&
          endDate.getTime() - eventStart.getTime() > 24 * 60 * 60 * 1000;

        if (isMultiDay) {
          // GCal end date is exclusive, so subtract one day to get the actual last day
          const endDateExclusive = new Date(endDate);
          endDateExclusive.setDate(endDateExclusive.getDate() - 1);
          const endDateStr =
            window.roamAlphaAPI.util.dateToPageTitle(endDateExclusive);

          // Only add until:: child (not start::) because block is already on start date
          await createChildBlock(newBlockUid, `until:: [[${endDateStr}]]`);
        }
      }

      // Save sync metadata
      if (newBlockUid && event.extendedProps?.gCalId) {
        await saveSyncMetadata(
          newBlockUid,
          createSyncMetadata({
            gCalId: event.extendedProps.gCalId,
            gCalCalendarId: calendarId,
            etag: event.extendedProps.gCalEtag,
            gCalUpdated: event.extendedProps.gCalUpdated,
            roamUpdated: Date.now(),
          })
        );
      }

      // Invalidate cache and refresh calendar to convert to synced event
      invalidateAllEventsCache();

      // Close popover and show success
      setPopoverIsOpen(false);
      console.log("Imported GCal event to Roam:", newBlockUid);

      // Trigger immediate calendar refresh
      if (refreshCalendar) {
        await refreshCalendar();
      }
    } catch (error) {
      console.error("Failed to import event to Roam:", error);
    }
  };

  // Get sync metadata for synced events
  const getSyncedCalendarInfo = () => {
    const metadata = getSyncMetadata(event.id);
    if (!metadata) return null;
    const connectedCalendars = getConnectedCalendars();
    const calendar = connectedCalendars.find(
      (c) => c.id === metadata.gCalCalendarId
    );
    return { metadata, calendar };
  };

  // Get the synced GCal event data (location, htmlLink, etc.) for synced Roam events
  const syncedGCalData = isSyncedToGCal
    ? event.extendedProps?.gCalEventData
    : null;

  // Get description and filter out Roam block link and block references section
  const getSyncedDescription = () => {
    if (!isSyncedToGCal || !event.extendedProps?.description) return null;

    let description = event.extendedProps.description;

    // Convert HTML breaks to newlines for regex matching, but preserve other HTML
    description = description.replace(/<br\s*\/?>/gi, "\n");

    // Remove the Roam block link section (e.g., "---\nRoam block: https://...")
    description = description.replace(/\n*---\s*\nRoam block:.*$/s, "").trim();

    // Remove the block references section (e.g., "---\nBlock references:\n((uid)) = ...")
    description = description
      .replace(/\n*---\s*\nBlock references:[\s\S]*?(?=\n---|\n*$)/s, "")
      .trim();

    if (!description) return null;

    // Convert newlines back to <br> tags for HTML parsing
    description = description.replace(/\n/g, "<br>");

    // Parse HTML description to React elements
    return parseHtmlToReact(description);
  };

  // Open synced event in Google Calendar
  const handleOpenInGCal = () => {
    const syncInfo = getSyncedCalendarInfo();
    if (syncInfo?.metadata?.gCalId) {
      // Construct Google Calendar event URL
      const gCalUrl = `https://calendar.google.com/calendar/event?eid=${btoa(
        syncInfo.metadata.gCalId + " " + syncInfo.metadata.gCalCalendarId
      )}`;
      window.open(gCalUrl, "_blank");
    }
    setPopoverIsOpen(false);
  };

  // Unsync event (remove metadata, keep Roam block)
  const handleUnsync = async () => {
    try {
      await deleteSyncMetadata(event.id);

      // Remove GCal trigger tags from Roam block
      const connectedCalendars = getConnectedCalendars();
      await removeGCalTagsFromBlock(event.id, connectedCalendars);

      // Update event to remove sync status
      updateEvent(event, {
        extendedProps: {
          ...event.extendedProps,
          gCalId: null,
          gCalCalendarId: null,
          syncStatus: null,
        },
      });
      console.log("Event unsynced from Google Calendar");
      setPopoverIsOpen(false);
    } catch (error) {
      console.error("Failed to unsync event:", error);
    }
  };

  // Unsync and delete the Google Calendar event
  const handleUnsyncAndDelete = async () => {
    try {
      const metadata = getSyncMetadata(event.id);
      if (metadata?.gCalId) {
        await deleteGCalEvent(metadata.gCalCalendarId, metadata.gCalId);
        console.log("Deleted event from Google Calendar:", metadata.gCalId);
      }
      await deleteSyncMetadata(event.id);

      // Remove GCal trigger tags from Roam block
      const connectedCalendars = getConnectedCalendars();
      await removeGCalTagsFromBlock(event.id, connectedCalendars);

      // Update event to remove sync status
      updateEvent(event, {
        extendedProps: {
          ...event.extendedProps,
          gCalId: null,
          gCalCalendarId: null,
          syncStatus: null,
        },
      });
      console.log("Event unsynced and deleted from Google Calendar");
      setPopoverIsOpen(false);
    } catch (error) {
      console.error("Failed to unsync and delete event:", error);
    }
  };

  // Sync a non-synced event to a specific Google Calendar
  const handleSyncToCalendar = async (targetCalendar) => {
    if (!targetCalendar || !isAuthenticated()) return;

    try {
      // Get the actual block content for the title
      const blockContent = getBlockContentByUid(event.id);

      // Create the GCal event with the actual block content as title
      const fcEvent = {
        ...event,
        title: blockContent || event.title,
        start: event.start,
        end: event.end,
        extendedProps: { ...event.extendedProps },
      };
      const gcalEventData = fcEventToGCalEvent(
        fcEvent,
        targetCalendar.id,
        event.id
      );
      const createdEvent = await createGCalEvent(
        targetCalendar.id,
        gcalEventData
      );

      // Save sync metadata
      await saveSyncMetadata(
        event.id,
        createSyncMetadata({
          gCalId: createdEvent.id,
          gCalCalendarId: targetCalendar.id,
          etag: createdEvent.etag,
          gCalUpdated: createdEvent.updated,
          roamUpdated: Date.now(),
        })
      );

      // Add trigger tag to Roam block if not already present
      const tagToAdd =
        targetCalendar.triggerTags?.[0] ||
        targetCalendar.displayName ||
        "Google Calendar";
      await addTagToBlock(event.id, tagToAdd);

      // Update event with sync info and GCal data
      const updatedEvent = {
        ...event,
        extendedProps: {
          ...event.extendedProps,
          gCalId: createdEvent.id,
          gCalCalendarId: targetCalendar.id,
          gCalEtag: createdEvent.etag,
          gCalUpdated: createdEvent.updated,
          description: createdEvent.description || "",
          location: createdEvent.location || "",
          attachments: createdEvent.attachments || [],
          syncStatus: "synced",
          gCalEventData: {
            htmlLink: createdEvent.htmlLink,
            creator: createdEvent.creator,
            organizer: createdEvent.organizer,
            attendees: createdEvent.attendees,
            recurrence: createdEvent.recurrence,
            recurringEventId: createdEvent.recurringEventId,
            status: createdEvent.status,
          },
        },
      };

      updateEvent(event, updatedEvent);

      // Also update in cache to persist the data
      updateEventInAllCache(updatedEvent);

      console.log("Event synced to Google Calendar:", createdEvent.id);
      setPopoverIsOpen(false);
    } catch (error) {
      console.error("Failed to sync event to Google Calendar:", error);
    }
  };

  // Get available calendars for syncing (excluding import-only calendars)
  const getAvailableCalendarsForSync = () => {
    if (!isAuthenticated()) return [];
    const connectedCalendars = getConnectedCalendars();
    return connectedCalendars.filter(
      (c) => c.syncEnabled && c.syncDirection !== "import"
    );
  };

  const handleClose = async () => {
    // Skip Roam-specific close handling for GCal/GTask events
    if (isGCalEvent || isGTaskEvent) return;

    const updatedContent = event.extendedProps.hasInfosInChildren
      ? getFlattenedContentOfParentAndFirstChildren(event.id)
      : getBlockContentByUid(event.id);
    let matchingTags = getMatchingTags(
      tagsToDisplay,
      getBlocksUidReferencedInThisBlock(event.id)
    );
    if (initialContent.current && initialContent.current !== updatedContent) {
      if (event.extendedProps.hasInfosInChildren) {
        const tree = getTreeByUid(event.id);
        const children = tree && tree.length ? tree[0].children : null;
        if (children) {
          const childrenInfos = getInfosFromChildren(children);
          matchingTags = matchingTags.concat(childrenInfos.tags);
        }
      }
      const updatedEvent = parseEventObject({
        title: updatedContent,
        matchingTags,
        isRef: event.extendedProps.isRef,
        hasTime: event.extendedProps.hasTime,
        // hasInfosInChildren: event.extendedProps.hasInfosInChildren,
        // untilUid: event.extendedProps.untilUid,
      });
      updateEvent(event, updatedEvent);
      initialContent.current = null;

      // Sync changes to Google Calendar if this event is synced
      if (isSyncedToGCal && isAuthenticated()) {
        const metadata = getSyncMetadata(event.id);
        if (metadata?.gCalId) {
          try {
            // Preserve the original event's start/end dates properly
            const fcEvent = {
              ...event,
              title: updatedContent,
              start: event.start,
              end: event.end,
              extendedProps: { ...event.extendedProps },
            };
            const gcalEventData = fcEventToGCalEvent(
              fcEvent,
              metadata.gCalCalendarId,
              event.id
            );
            const result = await updateGCalEvent(
              metadata.gCalCalendarId,
              metadata.gCalId,
              gcalEventData
            );
            await updateSyncMetadata(event.id, {
              gCalUpdated: result.updated,
              etag: result.etag,
              roamUpdated: Date.now(),
              lastSync: Date.now(),
            });
            console.log("Synced event update to GCal:", result.id);
          } catch (error) {
            console.error("Failed to sync event update to GCal:", error);
          }
        }
      }
    }
    setTimeout(() => {
      const tooltip = document.querySelector(".rm-bullet__tooltip");
      if (tooltip) tooltip.remove();
    }, 200);
  };

  return isExisting ? (
    <Popover
      isOpen={popoverIsOpen}
      autoFocus={false}
      onInteraction={(e) => !e && setPopoverIsOpen(e)}
      position="bottom"
      popoverClassName={Classes.POPOVER_CONTENT_SIZING}
      content={
        <div className={"fc-event-popover popover" + event.id}>
          <Icon
            icon="small-cross"
            onClick={() => setPopoverIsOpen((prev) => !prev)}
          />
          {isGCalEvent || isGTaskEvent ? (
            // Google Calendar/Task event details
            <div className="fc-gcal-event-details">
              <div className="fc-gcal-title-row">
                {(isGoogleTask || isGTaskEvent || showGCalCheckbox) && (
                  <Checkbox
                    checked={
                      taskCompleted ||
                      (isGTaskEvent &&
                        event.extendedProps?.gTaskData?.status ===
                          "completed") ||
                      (showGCalCheckbox && gCalTodoCompleted)
                    }
                    disabled={isUpdatingTask}
                    onChange={
                      isGTaskEvent
                        ? handleGTaskEventToggle
                        : showGCalCheckbox
                        ? handleGCalTodoToggle
                        : handleTaskToggle
                    }
                    className="fc-task-checkbox"
                  />
                )}
                <h4
                  className={
                    taskCompleted || (hasGCalTodoMarker && gCalTodoCompleted)
                      ? "fc-task-completed"
                      : ""
                  }
                >
                  {event.title
                    .replace(/\{\{\[\[(TODO|DONE)\]\]\}\}\s*/g, "")
                    .replace(/^\[\[TODO\]\]\s*/, "")
                    .replace(/^\[\[DONE\]\]\s*/, "")
                    .replace(/^\[\s*\]\s*/, "")
                    .replace(/^\[x\]\s*/, "")}
                </h4>
              </div>
              {isGoogleTask && (
                <div className="fc-gcal-task-indicator">
                  <Icon icon="tick" size={12} />
                  <span>Google Task</span>
                  {taskData?.taskListTitle && (
                    <span className="fc-task-list-name">
                      {" "}
                      ({taskData.taskListTitle})
                    </span>
                  )}
                </div>
              )}
              {isGTaskEvent && (
                <div className="fc-gcal-task-indicator">
                  <Icon icon="tick" size={12} />
                  <span>Google Task</span>
                  {event.extendedProps?.gTaskData && (
                    <span className="fc-task-list-name">
                      {" "}
                      (
                      {event.extendedProps.gTaskData.taskListTitle ||
                        "Task List"}
                      )
                    </span>
                  )}
                </div>
              )}
              <div className="fc-gcal-time">
                <Icon icon="time" size={12} />
                <span>
                  {event.extendedProps?.hasTime ? (
                    <>
                      {new Date(event.start).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {event.end && (
                        <>
                          {" - "}
                          {new Date(event.end).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      )}
                    </>
                  ) : (
                    // All-day event - just show date
                    new Date(event.start).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  )}
                </span>
              </div>
              {event.extendedProps?.location && (
                <div className="fc-gcal-location">
                  <Icon icon="map-marker" size={12} />
                  <span>{event.extendedProps.location}</span>
                </div>
              )}
              {event.extendedProps?.gCalEventData?.attendees?.length > 0 && (
                <div className="fc-gcal-attendees">
                  <Icon icon="people" size={12} />
                  <span>
                    {event.extendedProps.gCalEventData.attendees
                      .slice(0, 3)
                      .map((a) => a.displayName || a.email)
                      .join(", ")}
                    {event.extendedProps.gCalEventData.attendees.length > 3 &&
                      ` +${
                        event.extendedProps.gCalEventData.attendees.length - 3
                      } more`}
                  </span>
                </div>
              )}
              {event.extendedProps?.description && (
                <div className="fc-gcal-description">
                  {parseHtmlToReact(event.extendedProps.description)}
                </div>
              )}
              {/* Attachments if available */}
              {event.extendedProps?.attachments?.length > 0 && (
                <div className="fc-gcal-attachments">
                  <div className="fc-gcal-attachments-header">
                    <Icon icon="paperclip" size={12} />
                    <span>
                      Attachments ({event.extendedProps.attachments.length})
                    </span>
                  </div>
                  <ul className="fc-gcal-attachments-list">
                    {event.extendedProps.attachments.map(
                      (attachment, index) => (
                        <li key={index}>
                          <a
                            href={attachment.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {attachment.iconLink && (
                              <img
                                src={attachment.iconLink}
                                alt=""
                                className="fc-attachment-icon"
                              />
                            )}
                            <span className="fc-attachment-title">
                              {attachment.title || "Untitled"}
                            </span>
                          </a>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
              {event.extendedProps?.gCalEventData?.recurrence && (
                <div className="fc-gcal-recurrence">
                  <Icon icon="repeat" size={12} />
                  <span>Recurring event</span>
                </div>
              )}
              {/* Show original calendar/task list name */}
              {event.extendedProps?.gCalCalendarName && (
                <div className="fc-gcal-calendar-source">
                  <img
                    src={googleCalendarIcon}
                    alt=""
                    className="fc-gcal-icon-small"
                  />
                  <span>{event.extendedProps.gCalCalendarName}</span>
                </div>
              )}
              <div className="fc-gcal-actions">
                {event.extendedProps?.gCalEventData?.htmlLink && (
                  <Button
                    small
                    icon="share"
                    onClick={() =>
                      window.open(
                        event.extendedProps.gCalEventData.htmlLink,
                        "_blank"
                      )
                    }
                  >
                    Open in Google Calendar
                  </Button>
                )}
                <Button
                  small
                  icon="automatic-updates"
                  intent="primary"
                  onClick={handleImportToRoam}
                >
                  Sync to Roam block
                </Button>
              </div>
              <div className="fc-gcal-tag">
                <Tag minimal>
                  {eventTagList?.[0]?.name ||
                    (isGTaskEvent ? "Google Tasks" : "Google Calendar")}
                </Tag>
              </div>
            </div>
          ) : (
            // Regular Roam event
            <>
              <div ref={popoverRef}></div>

              {/* Show calendar info for synced events */}
              {isSyncedToGCal && (
                <div className="fc-synced-event-info">
                  {/* Calendar name - clickable to open in GCal */}
                  {getSyncedCalendarInfo()?.calendar?.displayName && (
                    <Tooltip content="View in Google Calendar" position="top">
                      <div
                        className="fc-gcal-calendar-source fc-gcal-calendar-source-clickable"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Use htmlLink if available, otherwise construct URL from metadata
                          if (syncedGCalData?.htmlLink) {
                            window.open(syncedGCalData.htmlLink, "_blank");
                          } else {
                            const syncInfo = getSyncedCalendarInfo();
                            if (syncInfo?.metadata?.gCalId) {
                              const gCalUrl = `https://calendar.google.com/calendar/event?eid=${btoa(
                                syncInfo.metadata.gCalId +
                                  " " +
                                  syncInfo.metadata.gCalCalendarId
                              )}`;
                              window.open(gCalUrl, "_blank");
                            }
                          }
                        }}
                      >
                        <img
                          src={googleCalendarIcon}
                          alt=""
                          className="fc-gcal-icon-small"
                        />
                        <span>
                          {getSyncedCalendarInfo().calendar.displayName}
                        </span>
                      </div>
                    </Tooltip>
                  )}

                  {/* Location if available */}
                  {event.extendedProps?.location && (
                    <div className="fc-gcal-location">
                      <Icon icon="map-marker" size={12} />
                      <span>{event.extendedProps.location}</span>
                    </div>
                  )}

                  {/* Attendees if available */}
                  {event.extendedProps?.gCalEventData?.attendees?.length >
                    0 && (
                    <div className="fc-gcal-attendees">
                      <Icon icon="people" size={12} />
                      <span>
                        {event.extendedProps.gCalEventData.attendees
                          .slice(0, 3)
                          .map((a) => a.displayName || a.email)
                          .join(", ")}
                        {event.extendedProps.gCalEventData.attendees.length >
                          3 &&
                          ` +${
                            event.extendedProps.gCalEventData.attendees.length -
                            3
                          } more`}
                      </span>
                    </div>
                  )}

                  {/* Description if available (filtered and HTML parsed) */}
                  {getSyncedDescription() && (
                    <div className="fc-gcal-description">
                      {getSyncedDescription()}
                    </div>
                  )}

                  {/* Attachments if available */}
                  {event.extendedProps?.attachments?.length > 0 && (
                    <div className="fc-gcal-attachments">
                      <div className="fc-gcal-attachments-header">
                        <Icon icon="paperclip" size={12} />
                        <span>
                          Attachments ({event.extendedProps.attachments.length})
                        </span>
                      </div>
                      <ul className="fc-gcal-attachments-list">
                        {event.extendedProps.attachments.map(
                          (attachment, index) => (
                            <li key={index}>
                              <a
                                href={attachment.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {attachment.iconLink && (
                                  <img
                                    src={attachment.iconLink}
                                    alt=""
                                    className="fc-attachment-icon"
                                  />
                                )}
                                <span className="fc-attachment-title">
                                  {attachment.title || "Untitled"}
                                </span>
                              </a>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="fc-roam-event-actions">
                {eventTagList && eventTagList[0].name !== calendarTag.name ? (
                  <TagList
                    list={
                      isSyncedToGCal
                        ? eventTagList.filter(
                            (tag) => tag.name !== "Google calendar"
                          )
                        : eventTagList
                    }
                    setEventTagList={setEventTagList}
                    isInteractive={true}
                    event={event}
                  />
                ) : null}
                {isSyncedToGCal ? (
                  // Synced event - show sync status with menu
                  <Popover
                    position="bottom"
                    minimal
                    content={
                      <Menu>
                        <MenuItem
                          icon="share"
                          text="Open in Google Calendar"
                          onClick={handleOpenInGCal}
                        />
                        <MenuDivider />
                        <MenuItem
                          icon="disable"
                          text="Unsync (keep GCal event)"
                          onClick={handleUnsync}
                        />
                        <MenuItem
                          icon="trash"
                          text="Unsync and delete GCal event"
                          intent="danger"
                          onClick={handleUnsyncAndDelete}
                        />
                      </Menu>
                    }
                  >
                    <div className="fc-sync-status fc-sync-status-clickable">
                      <Icon icon="automatic-updates" size={12} />
                      <span>Synced to</span>
                      <img
                        src={googleCalendarIcon}
                        alt=""
                        className="fc-gcal-icon-small"
                      />
                      <Icon icon="chevron-down" size={10} />
                    </div>
                  </Popover>
                ) : (
                  // Non-synced event - show sync options in three-dot menu if authenticated
                  isAuthenticated() &&
                  getAvailableCalendarsForSync().length > 0 && (
                    <Popover
                      position="bottom"
                      minimal
                      content={
                        <Menu>
                          <MenuItem
                            icon={
                              <img
                                src={googleCalendarIcon}
                                alt=""
                                className="fc-gcal-icon-menu"
                              />
                            }
                            text="Sync to Google Calendar"
                          >
                            {getAvailableCalendarsForSync().map((calendar) => (
                              <MenuItem
                                key={calendar.id}
                                text={calendar.displayName || calendar.name}
                                onClick={() => handleSyncToCalendar(calendar)}
                              />
                            ))}
                          </MenuItem>
                        </Menu>
                      }
                    >
                      <Icon
                        icon="more"
                        size={12}
                        className="fc-event-more-menu"
                      />
                    </Popover>
                  )
                )}
                <Icon
                  icon="trash"
                  size="12"
                  onClick={() => setIsDeleteDialogOpen(true)}
                />
                <DeleteDialog
                  title="Delete event"
                  message={<p>Are you sure you want to delete this event ?</p>}
                  callback={handleDeleteEvent}
                  isDeleteDialogOpen={isDeleteDialogOpen}
                  setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                />
              </div>
            </>
          )}
        </div>
      }
      onClose={handleClose}
      usePortal={true}
      onOpening={(e) => {
        // Skip Roam block rendering for GCal/GTask events
        if (isGCalEvent || isGTaskEvent) return;

        window.roamAlphaAPI.ui.components.renderBlock({
          uid: event.id,
          el: popoverRef.current,
          "zoom-path?": event.extendedProps.isRef,
          "open?": false,
        });
        if (event.extendedProps.hasInfosInChildren) {
          initialContent.current = getFlattenedContentOfParentAndFirstChildren(
            event.id
          );
        } else initialContent.current = getBlockContentByUid(event.id);
      }}
    >
      <div
        className="fc-event-content"
        onClick={(e) => {
          if (e.target.parentElement.className.includes("bp3-checkbox")) return;
          if (e.nativeEvent.shiftKey) return;
          // e.stopPropagation();
          setPopoverIsOpen((prev) => !prev);
        }}
      >
        {hasCheckbox && !isGCalEvent && !isGTaskEvent && (
          <Checkbox
            checked={isChecked}
            // onClick={(e) => {}}
            onChange={async (e) => {
              if (e.nativeEvent.shiftKey) return;
              e.stopPropagation();
              let updatedTitle, updatedClassNames, updatedTags;
              const newCompletedState = !isChecked;

              // CRITICAL: Read actual Roam block content (not event.title which has markers stripped)
              const currentBlockContent = getBlockContentByUid(event.id);

              if (isChecked) {
                updatedTitle = currentBlockContent.replace(
                  "{{[[DONE]]}}",
                  "{{[[TODO]]}}"
                );
                updatedClassNames = replaceItemAndGetUpdatedArray(
                  [...event.classNames],
                  "DONE",
                  "TODO"
                );
                updatedTags = replaceItemAndGetUpdatedArray(
                  [...eventTagList],
                  getTagFromName("DONE"),
                  getTagFromName("TODO"),
                  "name"
                );
              } else {
                updatedTitle = currentBlockContent.replace(
                  "{{[[TODO]]}}",
                  "{{[[DONE]]}}"
                );
                updatedClassNames = replaceItemAndGetUpdatedArray(
                  [...event.classNames],
                  "TODO",
                  "DONE"
                );
                updatedTags = replaceItemAndGetUpdatedArray(
                  [...eventTagList],
                  getTagFromName("TODO"),
                  getTagFromName("DONE"),
                  "name"
                );
              }
              const updatedColor = colorToDisplay(updatedTags);
              await updateBlock(event.id, updatedTitle);
              updateEvent(event, {
                title: updatedTitle,
                classNames: updatedClassNames,
                color: updatedColor,
                extendedProps: {
                  ...event.extendedProps, // Preserve all existing extended props (gCalId, etc.)
                  eventTags: updatedTags,
                },
              });

              // Sync to Google Tasks if this is a synced task
              const taskMetadata = getTaskSyncMetadata(event.id);
              if (taskMetadata) {
                try {
                  await syncTaskCompletionToGoogle(event.id, newCompletedState);
                  console.log(
                    `[Tasks] Synced TODO/DONE toggle to Google Tasks: ${
                      newCompletedState ? "completed" : "needsAction"
                    }`
                  );
                } catch (error) {
                  console.error(
                    "[Tasks] Failed to sync TODO/DONE to Google Tasks:",
                    error
                  );
                }
              }

              // Sync to Google Calendar if this event is synced to GCal
              if (isSyncedToGCal && isAuthenticated()) {
                const metadata = getSyncMetadata(event.id);
                if (metadata?.gCalId) {
                  try {
                    // Create updated FC event with new title
                    const fcEvent = {
                      ...event,
                      title: updatedTitle,
                      start: event.start,
                      end: event.end,
                      extendedProps: { ...event.extendedProps },
                    };
                    const gcalEventData = fcEventToGCalEvent(
                      fcEvent,
                      metadata.gCalCalendarId,
                      event.id
                    );
                    const result = await updateGCalEvent(
                      metadata.gCalCalendarId,
                      metadata.gCalId,
                      gcalEventData
                    );
                    await updateSyncMetadata(event.id, {
                      gCalUpdated: result.updated,
                      etag: result.etag,
                      roamUpdated: Date.now(),
                      lastSync: Date.now(),
                    });
                    console.log(
                      `[GCal] Synced TODO/DONE toggle to Google Calendar: ${
                        newCompletedState ? "[[DONE]]" : "[[TODO]]"
                      }`
                    );
                  } catch (error) {
                    console.error(
                      "[GCal] Failed to sync TODO/DONE to Google Calendar:",
                      error
                    );
                  }
                }
              }

              // Update the event in cache instead of invalidating all cache
              updateEventInAllCache({
                ...event,
                title: updatedTitle,
                classNames: updatedClassNames,
                color: updatedColor,
                extendedProps: {
                  ...event.extendedProps,
                  eventTags: updatedTags,
                },
              });
              // Don't call refreshCalendar() here - it would invalidate the cache we just updated
              // The event is already updated in the UI via updateEvent() above
            }}
          />
        )}
        {/* Inline checkbox for Google Tasks (calendar-based) */}
        {isGoogleTask && (
          <Checkbox
            checked={taskCompleted}
            disabled={isUpdatingTask}
            onChange={handleTaskToggle}
            className="fc-task-checkbox-inline"
          />
        )}
        {/* Inline checkbox for non-imported Google Task events */}
        {isGTaskEvent && (
          <Checkbox
            checked={event.extendedProps?.gTaskData?.status === "completed"}
            disabled={isUpdatingTask}
            onChange={handleGTaskEventToggle}
            className="fc-task-checkbox-inline"
          />
        )}
        {/* Inline checkbox for non-synced GCal events */}
        {showGCalCheckbox && (
          <Checkbox
            checked={gCalTodoCompleted}
            disabled={isUpdatingTask}
            onChange={handleGCalTodoToggle}
            className="fc-task-checkbox-inline"
          />
        )}
        <Tooltip
          position={"auto-start"}
          hoverOpenDelay={500}
          isOpen={popoverIsOpen ? false : null}
          content={
            <>
              <p className={taskCompleted ? "fc-task-completed" : ""}>
                {displayTitle}
              </p>
              {isGoogleTask && (
                <div className="fc-gcal-task-indicator">
                  <Icon icon="tick" size={12} />
                  <span>Google Task</span>
                  {taskData?.taskListTitle && (
                    <span className="fc-task-list-name">
                      {" "}
                      • {taskData.taskListTitle}
                    </span>
                  )}
                </div>
              )}
              {isGCalEvent && event.extendedProps?.gCalCalendarName && (
                <div className="fc-gcal-calendar-hint">
                  <img
                    src={googleCalendarIcon}
                    alt=""
                    className="fc-gcal-icon-small"
                  />
                  <span>{event.extendedProps.gCalCalendarName}</span>
                </div>
              )}
              {isGTaskEvent && event.extendedProps?.gTaskListName && (
                <div className="fc-gcal-calendar-hint">
                  <GoogleTasksIconSvg
                    className="fc-gcal-icon-small"
                    style={{ width: "16px", height: "16px" }}
                  />
                  <span>{event.extendedProps.gTaskListName}</span>
                </div>
              )}
              {isSyncedToGCal && (
                <div className="fc-sync-status">
                  <Icon icon="automatic-updates" size={12} />
                  <span>Synced to Google Calendar</span>
                </div>
              )}
              {eventTagList && eventTagList[0].name !== calendarTag.name ? (
                <TagList
                  list={
                    isSyncedToGCal
                      ? eventTagList.filter(
                          (tag) => tag.name !== "Google calendar"
                        )
                      : eventTagList
                  }
                  isInteractive={false}
                />
              ) : null}
            </>
          }
          popoverClassName="fc-event-tooltip"
        >
          <span className={taskCompleted ? "fc-task-completed" : ""}>
            {isGCalEvent && (
              <img
                src={googleCalendarIcon}
                alt=""
                className="fc-gcal-icon-inline"
              />
            )}
            {isGTaskEvent && (
              <GoogleTasksIconSvg
                className="fc-gcal-icon-inline"
                style={{ width: "12px", height: "12px", marginRight: "4px" }}
              />
            )}
            {isSyncedToGCal && (
              <Icon
                icon="automatic-updates"
                size={10}
                style={{ marginRight: 4, opacity: 0.7 }}
              />
            )}
            {timeText && event.extendedProps.hasTime ? <b>{timeText} </b> : ""}
            {displayTitle}
          </span>
        </Tooltip>
      </div>
    </Popover>
  ) : null;
};

export default Event;
