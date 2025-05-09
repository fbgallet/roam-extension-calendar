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
import {
  getTagColorFromName,
  getTagFromName,
  refreshTagsUids,
} from "../models/EventTag";
import GoogleCal from "./GoogleCal";
import { addGcalEvent, getGcalEvents } from "./CalendarApp";
// import { cl } from "@fullcalendar/core/internal-common";

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

  const addEvent = async (eventUid, pageUid, isGcal) => {
    const eventContent = getBlockContentByUid(eventUid);
    const currentDate = new Date(pageUid);
    const dateStr = dateToISOString(currentDate);
    let gCalEvent;
    const gCalId = await extensionStorage.get("googleCalendarId");
    if (isGcal && gCalId) {
      gCalEvent = await addGcalEvent(gCalId, {
        title: eventContent,
        start: dateStr,
        end: dateToISOString(
          new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
        ), //
      });
      console.log("gCalEvent :>> ", gCalEvent);
      console.log("gCalEvent.result.id :>> ", gCalEvent?.result?.id);
    }
    events.push(
      parseEventObject({
        id: eventUid,
        title: eventContent,
        date: dateStr,
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
      // GCal refresh

      const gCalId = await extensionStorage.get("googleCalendarId");

      if (gCalId) {
        const gEvents = await getGcalEvents(
          gCalId,
          dateToISOString(info.start, true),
          dateToISOString(info.end, true)
        );
        console.log("gEvents :>> ", gEvents);
        gEvents &&
          gEvents.length &&
          gEvents.forEach((evt) => {
            events.push({
              id: evt.id,
              title: evt.summary,
              start: evt.start.dateTime || evt.start.date,
              end: evt.end.dateTime || evt.end.date,
              classNames: ["fc-event-gcal"],
              extendedProps: {
                eventTags: [getTagFromName("Google calendar")],
                isRef: false,
                gCalId: evt.id,
                description: evt.description,
              },
              color: getTagColorFromName("Google calendar"),
              display: "block",
              editable: false,
              url: evt.htmlLink,
            });
          });
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
      <GoogleCal />
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
        slotMaxTime={maxTime === "00:00" ? "23:59" : max}
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
