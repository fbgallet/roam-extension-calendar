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
} from "../util/roamApi";
import NewEventDialog from "./NewEventDialog";
import { dateToISOString, eventTimeFormats, getDayOfYear } from "../util/dates";
import {
  eventsOrder,
  extensionStorage,
  firstDay,
  mapOfTags,
  maxTime,
  minTime,
  timeFormat,
  timeGrid,
} from "..";
import {
  getTagColorFromName,
  getTagFromName,
  refreshTagsUids,
} from "../models/EventTag";
import GoogleCal from "./GoogleCal";

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

  const handleSquareDayClick = async (info) => {
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
      if (previousSelectedDay === targetDnpUid) {
        createNewPageIfNotExisting(dnpTitle, targetDnpUid, true);
        isDataToReload.current = false;
        isDataToFilterAgain.current = false;
        // console.log("info.jsEvent :>> ", info.jsEvent);
        setPosition({ x: info.jsEvent.clientX, y: info.jsEvent.clientY - 75 });
        setFocusedPageUid(targetDnpUid);
        setFocusedPageTitle(dnpTitle);
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
      const begin = performance.now();
      events = await getBlocksToDisplayFromDNP(
        info.start,
        info.end,
        !isEntireDNP,
        isIncludingRefs,
        periodView.current.includes("time")
      );
      const end = performance.now();

      console.log("Events loading time: ", end - begin);
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
    isDataToFilterAgain.current = true;

    if (!info.event.extendedProps.refSourceUid) {
      // is in a timeGrid view
      if (info.view.type.includes("time")) {
        events[evtIndex].start = info.event.start;
        events[evtIndex].end = info.event.end;
        await updateTimestampsInBlock(info.event, info.oldEvent);
      }
      // if moved in the same day, doesn't need block move
      if (!info.delta.days && !info.delta.months) return;

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
        return;
      }
    }

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

  const handleEventResize = async (info) => {
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
  };

  const parseGoogleCalendarEvent = (event) => {
    console.log("event :>> ", event);
    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      classNames: ["fc-event-gcal"],
      extendedProps: {
        // eventTags: [getTagFromName("Google calendar")],
        isRef: false,
      },
      color: "grey", //getTagColorFromName("Google calendar"),
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
        pageTitle={focusedPageTitle}
        position={position}
        addEvent={addEvent}
        focusedTime={focusedTime}
        periodView={periodView.current}
      />
      {/* <GoogleCal /> */}
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
          // tagsToDisplay.find((tag) => tag.name === "Google calendar")
          //   ? {
          //       googleCalendarId: "fbgallet@gmail.com",
          //       eventDataTransform: parseGoogleCalendarEvent,
          //     }
          //   : null,
          {
            googleCalendarId: "fbgallet@gmail.com",
            eventDataTransform: parseGoogleCalendarEvent,
          },
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
