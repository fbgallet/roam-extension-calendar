import { Checkbox, Icon, Tooltip, Popover, Classes, Button, Tag } from "@blueprintjs/core";
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
} from "../util/roamApi";
import {
  colorToDisplay,
  getCalendarUidFromPage,
  getInfosFromChildren,
  getMatchingTags,
  parseEventObject,
  replaceItemAndGetUpdatedArray,
} from "../util/data";
import { useState, useRef } from "react";
import { getTagFromName } from "../models/EventTag";
import { calendarTag, mapOfTags } from "..";
import TagList from "./TagList";
import DeleteDialog from "./DeleteDialog";
import { getTimestampFromHM, getFormatedRange } from "../util/dates";
import { getConnectedCalendars, isAuthenticated, updateEvent as updateGCalEvent } from "../services/googleCalendarService";
import { saveSyncMetadata, createSyncMetadata, getSyncMetadata, updateSyncMetadata } from "../models/SyncMetadata";
import { fcEventToGCalEvent } from "../util/gcalMapping";

// Google Calendar icon for unimported GCal events
import googleCalendarIcon from "../services/gcal-logo-64-white.png";

const Event = ({
  displayTitle,
  event,
  timeText,
  hasCheckbox,
  isChecked,
  tagsToDisplay,
  deleteEvent,
  updateEvent,
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
  const isGCalEvent = event.extendedProps?.isGCalEvent ||
    (eventTagList && eventTagList[0]?.name === "Google calendar");

  // Check if this Roam event is synced to GCal
  const isSyncedToGCal = !isGCalEvent && (
    event.extendedProps?.gCalId ||
    getSyncMetadata(event.id)?.gCalId
  );

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

      // Add title
      content += event.title || "(No title)";

      // Add trigger tag from calendar config
      const calendarId = event.extendedProps?.gCalCalendarId;
      const connectedCalendars = getConnectedCalendars();
      const calendarConfig = connectedCalendars.find((c) => c.id === calendarId);
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
        description = description.replace(/\n*---\n*Roam block:.*$/s, "").trim();
        if (description) {
          await createChildBlock(newBlockUid, description);
        }
      }

      // Handle multi-day all-day events with start::/end:: child blocks
      if (newBlockUid && event.end) {
        const endDate = new Date(event.end);
        // For all-day events, GCal end is exclusive (day after last day)
        const isMultiDay =
          !event.extendedProps?.hasTime &&
          endDate.getTime() - eventStart.getTime() > 24 * 60 * 60 * 1000;

        if (isMultiDay) {
          const startDateStr =
            window.roamAlphaAPI.util.dateToPageTitle(eventStart);
          // GCal end date is exclusive, so subtract one day
          const endDateExclusive = new Date(endDate);
          endDateExclusive.setDate(endDateExclusive.getDate() - 1);
          const endDateStr =
            window.roamAlphaAPI.util.dateToPageTitle(endDateExclusive);

          await createChildBlock(newBlockUid, `start:: [[${startDateStr}]]`);
          await createChildBlock(newBlockUid, `end:: [[${endDateStr}]]`);
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

      // Close popover and show success
      setPopoverIsOpen(false);
      console.log("Imported GCal event to Roam:", newBlockUid);
    } catch (error) {
      console.error("Failed to import event to Roam:", error);
    }
  };

  const handleClose = async () => {
    // Skip Roam-specific close handling for GCal events
    if (isGCalEvent) return;

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
            const gcalEventData = fcEventToGCalEvent(fcEvent, metadata.gCalCalendarId, event.id);
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
          {isGCalEvent ? (
            // Google Calendar event details
            <div className="fc-gcal-event-details">
              <h4>{event.title}</h4>
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
              {event.extendedProps?.description && (
                <div className="fc-gcal-description">
                  <p>{event.extendedProps.description}</p>
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
                      ` +${event.extendedProps.gCalEventData.attendees.length - 3} more`}
                  </span>
                </div>
              )}
              {event.extendedProps?.gCalEventData?.recurrence && (
                <div className="fc-gcal-recurrence">
                  <Icon icon="repeat" size={12} />
                  <span>Recurring event</span>
                </div>
              )}
              {/* Show original calendar name */}
              {event.extendedProps?.gCalCalendarName && (
                <div className="fc-gcal-calendar-source">
                  <Icon icon="calendar" size={12} />
                  <span>{event.extendedProps.gCalCalendarName}</span>
                </div>
              )}
              <div className="fc-gcal-actions">
                {event.extendedProps?.gCalEventData?.htmlLink && (
                  <Button
                    small
                    icon="share"
                    onClick={() =>
                      window.open(event.extendedProps.gCalEventData.htmlLink, "_blank")
                    }
                  >
                    Open in Google Calendar
                  </Button>
                )}
                <Button
                  small
                  icon="import"
                  intent="primary"
                  onClick={handleImportToRoam}
                >
                  Import to Roam
                </Button>
              </div>
              <div className="fc-gcal-tag">
                <Tag minimal>{eventTagList?.[0]?.name || "Google Calendar"}</Tag>
              </div>
            </div>
          ) : (
            // Regular Roam event
            <>
              <div ref={popoverRef}></div>
              <div>
                {isSyncedToGCal && (
                  <div className="fc-sync-status">
                    <Icon icon="automatic-updates" size={12} />
                    <span>Synced to Google Calendar</span>
                  </div>
                )}
                {eventTagList && eventTagList[0].name !== calendarTag.name ? (
                  <TagList
                    list={eventTagList}
                    setEventTagList={setEventTagList}
                    isInteractive={true}
                    event={event}
                  />
                ) : null}
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
        // Skip Roam block rendering for GCal events
        if (isGCalEvent) return;

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
        {hasCheckbox && (
          <Checkbox
            checked={isChecked}
            // onClick={(e) => {}}
            onChange={async (e) => {
              if (e.nativeEvent.shiftKey) return;
              e.stopPropagation();
              let updatedTitle, updatedClassNames, updatedTags;
              if (isChecked) {
                updatedTitle = event.title.replace(
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
                updatedTitle = event.title.replace(
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
                  eventTags: updatedTags,
                  isRef: event.extendedProps.isRef,
                },
              });
            }}
          />
        )}
        <Tooltip
          position={"auto-start"}
          hoverOpenDelay={500}
          isOpen={popoverIsOpen ? false : null}
          content={
            <>
              <p>{event.title}</p>
              {isGCalEvent && event.extendedProps?.gCalCalendarName && (
                <div className="fc-gcal-calendar-hint">
                  <img src={googleCalendarIcon} alt="" className="fc-gcal-icon-small" />
                  <span>{event.extendedProps.gCalCalendarName}</span>
                </div>
              )}
              {isSyncedToGCal && (
                <div className="fc-sync-status">
                  <Icon icon="automatic-updates" size={12} />
                  <span>Synced to Google Calendar</span>
                </div>
              )}
              {eventTagList && eventTagList[0].name !== calendarTag.name ? (
                <TagList list={eventTagList} isInteractive={false} />
              ) : null}
            </>
          }
          popoverClassName="fc-event-tooltip"
        >
          <span>
            {isGCalEvent && (
              <img src={googleCalendarIcon} alt="" className="fc-gcal-icon-inline" />
            )}
            {isSyncedToGCal && (
              <Icon icon="automatic-updates" size={10} style={{ marginRight: 4, opacity: 0.7 }} />
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
