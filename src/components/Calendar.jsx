import FullCalendar from "@fullcalendar/react";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
// import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import {
  getBlocksToDisplayFromDNP,
  getCalendarUidFromPage,
  getMatchingTags,
  parseEventObject,
  removeSquareBrackets,
  updateEventColor,
} from "../util/data";
import { useState, useEffect, useRef } from "react";
import Event from "./Event";
import MultiSelectFilter from "./MultiSelectFilter";
import {
  createChildBlock,
  deleteBlockIfNoChild,
  getBlockContentByUid,
  getBlocksUidReferencedInThisBlock,
  getParentBlock,
  isExistingNode,
  resolveReferences,
} from "../util/roamApi";
import { roamDateRegex } from "../util/regex";
import NewEventDialog from "./NewEventDialog";
import { dateToISOString } from "../util/dates";
import { calendarTag, mapOfTags } from "..";

// let draggable = new Draggable(document.querySelector(".roam-app"), {
//   itemSelector: ".rm-bullet",
// });
let events = [];
let filteredEvents = [];

const Calendar = ({ parentElt }) => {
  const [newEventDialogIsOpen, setNewEventDialogIsOpen] = useState(false);
  const [focusedPageUid, setFocusedPageUid] = useState(null);
  // const [events, setEvents] = useState([]);
  const [addedEvent, setAddedEvent] = useState(null);
  const [position, setPosition] = useState({ x: null, y: null });

  const [filterLogic, setFilterLogic] = useState("Or");
  const [tagsToDisplay, setTagsToDisplay] = useState(
    mapOfTags.filter((tag) => tag.isToDisplay)
  );
  const [isEntireDNP, setIsEntireDNP] = useState(false);
  const [isIncludingRefs, setIsIncludingRefs] = useState(true);
  const [isWEtoDisplay, setIsWEtoDisplay] = useState(true);
  const isDataToReload = useRef(true);
  const isDataToFilterAgain = useRef(true);
  const calendarRef = useRef(null);
  const startDate = useRef(null);
  const selectedDay = useRef(null);

  function updateSize() {
    const calendarApi = calendarRef.current.getApi();
    calendarApi.updateSize();
    let tooltip = document.querySelector(".rm-bullet__tooltip");
    if (tooltip) tooltip.remove();
    tooltip = document.querySelector(".bp3-tooltip");
    if (tooltip) tooltip.remove();
  }
  // const events = useRef([]);

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
  }, [isEntireDNP, isWEtoDisplay]);

  const handleSelectDays = (e) => {
    console.log("Day selected");
  };

  const handleSquareDayClick = async (info) => {
    const targetDnpUid = window.roamAlphaAPI.util.dateToPageUid(info.date);
    console.log("targetDnpUid :>> ", targetDnpUid);
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
        console.log("info.jsEvent :>> ", info.jsEvent);
        setPosition({ x: info.jsEvent.clientX, y: info.jsEvent.clientY - 75 });
        setFocusedPageUid(targetDnpUid);
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
    const index = events.findIndex((evt) => evt.id === event.id);
    const temp = { ...events[index] };
    for (const key in updatedProperties) {
      events[index][key] = updatedProperties[key];
    }
    isDataToFilterAgain.current = true;
  };

  const deleteEvent = (event) => {
    const index = events.findIndex((evt) => evt.id === event.id);
    events.splice(index, 1);
    isDataToFilterAgain.current = true;
  };

  const renderDayContent = (info, elt) => {
    console.log("day:", info);
    // return <EditEvent />;
  };

  const getEventsFromDNP = async (info) => {
    if (
      startDate.current &&
      startDate.current.getDate() !== info.start.getDate()
    ) {
      isDataToReload.current = true;
      isDataToFilterAgain.current = true;
    }
    startDate.current = info.start;
    if (isDataToReload.current) {
      events = await getBlocksToDisplayFromDNP(
        info.start,
        info.end,
        !isEntireDNP,
        isIncludingRefs
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
      // console.log("Filtered events to display:>> ", filteredEvents);
    }
    // isDataToReload.current = false;
    // isDataToFilterAgain.current = false;
    return filteredEvents;
  };

  const handleEventDrop = async (info) => {
    let evtIndex = events.findIndex((evt) => evt.id === info.event.id);
    events[evtIndex].date = dateToISOString(info.event.start);
    isDataToFilterAgain.current = true;
    if (info.event.extendedProps.isRef) {
      let blockContent = getBlockContentByUid(info.event.id);
      let matchingDates = blockContent.match(roamDateRegex);
      const newRoamDate = window.roamAlphaAPI.util.dateToPageTitle(
        info.event.start
      );
      if (matchingDates && matchingDates.length) {
        let currentDateStr = removeSquareBrackets(matchingDates[0]);
        blockContent = blockContent.replace(currentDateStr, newRoamDate);
      } else blockContent += ` [[${newRoamDate}]]`;
      window.roamAlphaAPI.updateBlock({
        block: { uid: info.event.id, string: blockContent },
      });
      info.event.setProp("title", resolveReferences(blockContent));
    } else {
      const currentCalendarUid = getParentBlock(info.event.id);
      let calendarBlockUid = await getCalendarUidFromPage(
        window.roamAlphaAPI.util.dateToPageUid(info.event.start)
      );
      await window.roamAlphaAPI.moveBlock({
        location: {
          "parent-uid": calendarBlockUid,
          order: "last",
        },
        block: { uid: info.event.id },
      });
      deleteBlockIfNoChild(currentCalendarUid);
    }
  };

  const handleExternalDrop = async (e) => {
    e.preventDefault();
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
    await createChildBlock(calendarBlockUid, `((${sourceUid}))`);
    events.push(
      parseEventObject({
        id: sourceUid,
        title: blockContent,
        date: date,
        matchingTags: matchingTags,
      })
    );
    isDataToReload.current = false;
    setAddedEvent(sourceUid);
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
      />
      <FullCalendar
        plugins={[
          dayGridPlugin,
          // timeGridPlugin,
          multiMonthPlugin,
          interactionPlugin,
        ]}
        ref={calendarRef}
        // aspectRatio={1.35}
        // contentHeight={"auto"}
        customButtons={{
          refreshButton: {
            text: "↻", // 🔄
            click: updateSize,
          },
        }}
        height={"90%"}
        expandRows={true}
        multiMonthMinWidth={440}
        // multiMonthMaxColumns={2}
        // initialDate={"2024-04-20"}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today refreshButton",
          center: "title",
          right: "multiMonthYear,dayGridMonth,dayGridWeek,dayGridDay",
        }}
        firstDay={1}
        weekends={isWEtoDisplay}
        fixedWeekCount={false}
        weekNumbers={true}
        // nowIndicator={true}
        // slotMinTime="06:00"
        // slotMaxTime="22:00"
        navLinks={true}
        editable={true}
        selectable={true}
        droppable={true}
        // draggable={true}
        dayMaxEvents={true}
        // initialEvents={getEventsFromDNP}
        events={getEventsFromDNP}
        // events={[
        //   { title: "My First Event", date: "2024-04-06", editable: true },
        //   {
        //     title: "My second event",
        //     start: "2024-04-08T09:30:00",
        //     end: "2024-04-08T11:00:00",
        //     // start: "2024-04-08 11:00",
        //     // end: "11:00",
        //     display: "list-item",
        //     color: "red",
        //     // allDay: false,
        //   },
        // ]}
        // eventTimeFormat={{
        //   // like '14:30:00'
        //   hour: "2-digit",
        //   minute: "2-digit",
        //   meridiem: false,
        // }}
        eventContent={(info, jsEvent) => renderEventContent(info, jsEvent)}
        eventClick={(info) => {
          if (info.jsEvent.shiftKey) {
            window.roamAlphaAPI.ui.rightSidebar.addWindow({
              window: { type: "block", "block-uid": info.event.id },
            });
          }
        }}
        eventDrop={handleEventDrop}
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
