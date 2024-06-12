import FullCalendar from "@fullcalendar/react";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import googleCalendarPlugin from "@fullcalendar/google-calendar";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import {
  getBlocksToDisplayFromDNP,
  getCalendarUidFromPage,
  getMatchingTags,
  moveDroppedEventBlock,
  parseEventObject,
  updateEventColor,
  updateTimestampsInBlock,
} from "../util/data";
import { useState, useEffect, useRef } from "react";
import Event from "./Event";
import MultiSelectFilter from "./MultiSelectFilter";
import {
  createChildBlock,
  getBlockContentByUid,
  getBlocksUidReferencedInThisBlock,
  isExistingNode,
} from "../util/roamApi";
import NewEventDialog from "./NewEventDialog";
import { dateToISOString, eventTimeFormats } from "../util/dates";
import {
  calendarTag,
  mapOfTags,
  maxTime,
  minTime,
  timeFormat,
  timeGrid,
} from "..";
import { getTagColorFromName, getTagFromName } from "../models/EventTag";

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
  // const [events, setEvents] = useState([]);
  const [forceToReload, setForceToReload] = useState(false);
  const [position, setPosition] = useState({ x: null, y: null });

  const [filterLogic, setFilterLogic] = useState("Or");
  const [tagsToDisplay, setTagsToDisplay] = useState(
    mapOfTags.filter((tag) => tag.isToDisplay)
  );
  const [isEntireDNP, setIsEntireDNP] = useState(initialSettings.dnp);
  const [isIncludingRefs, setIsIncludingRefs] = useState(initialSettings.refs);
  const [isWEtoDisplay, setIsWEtoDisplay] = useState(initialSettings.we);
  const isDataToReload = useRef(true);
  const isDataToFilterAgain = useRef(true);
  const calendarRef = useRef(null);
  const viewRange = useRef({
    start: null,
    end: null,
  });
  const selectedDay = useRef(null);
  const periodView = useRef(periodType || initialSettings.view);

  function updateSize() {
    const calendarApi = calendarRef.current.getApi();
    calendarApi.updateSize();
    isDataToReload.current = true;
    isDataToFilterAgain.current = true;
    setForceToReload((prev) => !prev);
    let tooltip = document.querySelector(".rm-bullet__tooltip");
    if (tooltip) tooltip.remove();
    tooltip = document.querySelector(".bp3-tooltip");
    if (tooltip) tooltip.remove();
  }

  useEffect(() => {
    isDataToFilterAgain.current = true;
    if (events.length !== 0) isDataToReload.current = false;
    localStorage.setItem(
      "fc-tags-info",
      JSON.stringify(
        mapOfTags.map((tag) => ({
          name: tag.name,
          color: tag.color,
          isToDisplay: tag.isToDisplay,
        }))
      )
    );
  }, [tagsToDisplay]);

  useEffect(() => {
    isDataToReload.current = true;
    isDataToFilterAgain.current = true;
  }, [isIncludingRefs, isEntireDNP, isWEtoDisplay]);

  useEffect(() => {
    isDataToFilterAgain.current = true;
  }, [forceToReload]);

  const handleSelectDays = (e) => {
    console.log("Day selected");
  };

  const handleSquareDayClick = async (info) => {
    const targetDnpUid = window.roamAlphaAPI.util.dateToPageUid(info.date);
    const previousSelectedDay = selectedDay.current;
    selectedDay.current =
      selectedDay.current === targetDnpUid ? null : targetDnpUid;
    if (info.jsEvent.shiftKey) {
      if (!isExistingNode(targetDnpUid)) {
        await window.roamAlphaAPI.data.page.create({
          page: {
            title: window.roamAlphaAPI.util.dateToPageTitle(info.date),
            uid: targetDnpUid,
          },
        });
      }
      window.roamAlphaAPI.ui.rightSidebar.addWindow({
        window: { type: "outline", "block-uid": targetDnpUid },
      });
    } else {
      if (previousSelectedDay === targetDnpUid) {
        isDataToReload.current = false;
        isDataToFilterAgain.current = false;
        // console.log("info.jsEvent :>> ", info.jsEvent);
        setPosition({ x: info.jsEvent.clientX, y: info.jsEvent.clientY - 75 });
        setFocusedPageUid(targetDnpUid);
        setNewEventDialogIsOpen(true);
      }
    }
  };

  const renderEventContent = (info) => {
    console.log("info :>> ", info);
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
    // console.log(info.event);
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

  const addEvent = async (eventUid, pageUid) => {
    const eventContent = getBlockContentByUid(eventUid);
    const date = dateToISOString(new Date(pageUid));
    events.push(
      parseEventObject({
        id: eventUid,
        title: eventContent,
        date,
        matchingTags: getMatchingTags(
          mapOfTags,
          getBlocksUidReferencedInThisBlock(eventUid)
        ),
      })
    );
    isDataToFilterAgain.current = true;
  };

  const updateEvent = (event, updatedProperties) => {
    const index = events.findIndex((evt) => evt.id === event.id);
    for (const key in updatedProperties) {
      if (updatedProperties[key] !== undefined) {
        events[index][key] = updatedProperties[key];
        if (key !== "extendedProps") event.setProp(key, updatedProperties[key]);
        else {
          event.setExtendedProp("eventTags", updatedProperties[key].eventTags);
          event.setExtendedProp("isRef", updatedProperties[key].isRef);
        }
      }
    }
    isDataToFilterAgain.current = true;
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
      events = await getBlocksToDisplayFromDNP(
        info.start,
        info.end,
        !isEntireDNP,
        isIncludingRefs,
        periodView.current.includes("time")
      );
      isDataToFilterAgain.current = true;
    } //else isDataToReload.current = true;
    // if (!events.length) return [];
    if (isDataToFilterAgain.current) {
      const eventsToDisplay =
        filterLogic === "Or"
          ? events.filter(
              (evt) =>
                !(
                  evt.extendedProps?.eventTags[0].name === "DONE" &&
                  !tagsToDisplay.some((tag) => tag.name === "DONE")
                ) &&
                evt.extendedProps?.eventTags?.some((tag) => tag.isToDisplay)
            )
          : events.filter((evt) =>
              tagsToDisplay.every((tag) =>
                evt.extendedProps?.eventTags?.some((t) => t.name === tag.name)
              )
            );

      filteredEvents = eventsToDisplay.map((evt) => {
        // if (evt.extendedProps.eventTags.length > 1)
        evt.color =
          updateEventColor(evt.extendedProps.eventTags, tagsToDisplay) ||
          evt.color;
        return evt;
      });
      console.log("Filtered events to display:>> ", filteredEvents);
    }
    // isDataToReload.current = false;
    // isDataToFilterAgain.current = false;
    return filteredEvents;
  };

  const handleEventDrop = async (info) => {
    let evtIndex = events.findIndex((evt) => evt.id === info.event.id);
    events[evtIndex].date = dateToISOString(info.event.start);
    isDataToFilterAgain.current = true;

    // is in a timeGrid view
    if (info.view.type.includes("time")) {
      events[evtIndex].start = info.event.start;
      events[evtIndex].end = info.event.end;
      await updateTimestampsInBlock(info.event, info.oldEvent);
    }

    // if moved in the same day, doesn't need block move
    if (!info.delta.days && !info.delta.months) return;

    await moveDroppedEventBlock(info.event);
  };

  const handleExternalDrop = async (e) => {
    e.preventDefault();
    let targetUid;
    const sourceUid = e.dataTransfer.getData("text");
    const blockContent = getBlockContentByUid(sourceUid);
    const blockRefs = getBlocksUidReferencedInThisBlock(sourceUid);
    const targetDateString = e.target.parentNode.dataset["date"];
    const targetDate = new Date(targetDateString);
    const date = dateToISOString(targetDate);
    const matchingTags = getMatchingTags(tagsToDisplay, blockRefs);
    let calendarBlockUid = await getCalendarUidFromPage(
      window.roamAlphaAPI.util.dateToPageUid(targetDate)
    );
    if (e.shiftKey) {
      targetUid = sourceUid;
      await window.roamAlphaAPI.moveBlock({
        location: {
          "parent-uid": calendarBlockUid,
          order: "last",
        },
        block: { uid: sourceUid },
      });
    } else if (e.ctrlKey || e.metaKey) {
      targetUid = await createChildBlock(calendarBlockUid, `((${sourceUid}))`);
    } else {
      targetUid = await createChildBlock(calendarBlockUid, blockContent);
    }
    events.push(
      parseEventObject({
        id: targetUid,
        title: blockContent,
        date: date,
        matchingTags: matchingTags,
      })
    );
    isDataToReload.current = false;
    setForceToReload((prev) => !prev);
  };

  const handleEventResize = (info) => {
    console.log("info :>> ", info);
    updateTimestampsInBlock(info.event);
  };

  const parseGoogleCalendarEvent = (event) => {
    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      classNames: ["fc-event-gcal"],
      extendedProps: {
        eventTags: [getTagFromName("Google calendar")],
        isRef: false,
      },
      color: getTagColorFromName("Google calendar"),
      display: "block",
      editable: false,
      url: event.url,
    };
  };

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
        position={position}
        addEvent={addEvent}
      />
      <MultiSelectFilter
        tagsToDisplay={tagsToDisplay}
        setTagsToDisplay={setTagsToDisplay}
        isDataToReload={isDataToReload}
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
        isDataToFilterAgain={isDataToFilterAgain}
        isInSidebar={isInSidebar}
        initialSticky={initialSettings.sticky}
        initialMinimized={initialSettings.minimized}
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
        firstDay={1}
        weekends={isWEtoDisplay}
        fixedWeekCount={false}
        weekNumbers={true}
        nowIndicator={true}
        eventTimeFormat={eventTimeFormats[timeFormat]}
        slotLabelFormat={eventTimeFormats[timeFormat]}
        slotMinTime={minTime}
        slotMaxTime={maxTime}
        navLinks={true}
        editable={true}
        selectable={true}
        droppable={true}
        // draggable={true}
        dayMaxEvents={true}
        // initialEvents={getEventsFromDNP}
        datesSet={(info) => {
          if (periodView.current !== info.view.type) {
            periodView.current = info.view.type;
            localStorage.setItem(
              "fc-periodView" + (isInSidebar ? "-sb" : ""),
              info.view.type
            );
            if (info.view.type.includes("time"))
              setForceToReload((prev) => !prev);
          }
        }}
        // events={getEventsFromDNP}
        googleCalendarApiKey="AIzaSyALOQwUEZww3Ez721OSS1iwFZgDmZKJ7Qo"
        eventSources={[
          getEventsFromDNP,
          tagsToDisplay.find((tag) => tag.name === "Google calendar")
            ? {
                googleCalendarId: "fbgallet@gmail.com",
                eventDataTransform: parseGoogleCalendarEvent,
              }
            : null,
        ]}
        eventContent={(info, jsEvent) => renderEventContent(info, jsEvent)}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
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
