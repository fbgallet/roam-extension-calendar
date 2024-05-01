import FullCalendar from "@fullcalendar/react";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import {
  getBlocksToDisplayFromDNP,
  getCalendarUidFromPage,
  insertEventOnPage,
  removeSquareBrackets,
} from "../util/data";
import { useState, useEffect, useRef } from "react";
import Event from "./Event";
import Filters from "./Filters";
import {
  createChildBlock,
  getBlockContentByUid,
  getFirstBlockUidByReferenceOnPage,
  getPageNameByPageUid,
  isExistingNode,
  resolveReferences,
} from "../util/roamApi";
import { roamDateRegex } from "../util/regex";
import EditEvent from "./EditEvent";
import NewEventDialog from "./NewEventDialog";
import { dateToISOString } from "../util/dates";

// let draggable = new Draggable(document.querySelector(".roam-app"), {
//   itemSelector: ".rm-bullet",
// });
let events = [];

const Calendar = () => {
  const [newEventDialogIsOpen, setNewEventDialogIsOpen] = useState(false);
  const [focusedPageUid, setFocusedPageUid] = useState(null);
  // const [events, setEvents] = useState([]);
  const [addedEvent, setAddedEvent] = useState(null);

  const [filters, setFilters] = useState({
    TODO: true,
    DONE: true,
    due: true,
    do: true,
    progress: true,
    important: true,
    urgent: true,
    calendar: true,
    other: true,
  });
  const isDataToReload = useRef(true);
  // const events = useRef([]);

  useEffect(() => {
    if (events.length !== 0) isDataToReload.current = false;
  }, [filters]);

  const handleSelectDays = (e) => {
    console.log("Day selected");
  };

  const handleSquareDayClick = async (info) => {
    console.log("Day clicked", info.jsEvent);
    const targetDnpUid = window.roamAlphaAPI.util.dateToPageUid(info.date);
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
      setFocusedPageUid(targetDnpUid);
      setNewEventDialogIsOpen(true);
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
        backgroundColor={info.backgroundColor}
      ></Event>
    );
  };

  const renderDayContent = (info, elt) => {
    console.log("day:", info);
    // return <EditEvent />;
  };

  const getEventsFromDNP = async (info) => {
    console.log("events :>> ", events);
    if (isDataToReload.current) {
      events = getBlocksToDisplayFromDNP(info.start, info.end, false);
    } else isDataToReload.current = true;
    // if (!events.length) return [];
    const eventsToDisplay = events.filter(
      (evt) =>
        !(evt.extendedProps?.eventTags[0] === "DONE" && !filters["DONE"]) &&
        evt.extendedProps?.eventTags?.some((tag) => filters[tag])
    );
    console.log("events to display:>> ", eventsToDisplay);

    return eventsToDisplay;
  };

  const handleEventDrop = async (info) => {
    const targetPageUid = window.roamAlphaAPI.util.dateToPageUid(
      info.event.start
    );
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
      let calendarBlockUid = await getCalendarUidFromPage(
        window.roamAlphaAPI.util.dateToPageTitle(info.event.start)
      );
      window.roamAlphaAPI.moveBlock({
        location: {
          "parent-uid": calendarBlockUid,
          order: "last",
        },
        block: { uid: info.event.id },
      });
    }
  };

  // const handleExernalDrop = (info) => {
  //   // console.log("info :>> ", info);
  //   console.log("info.draggedEl :>> ", info.draggedEl);
  //   console.log(
  //     "uid :>> ",
  //     info.draggedEl.parentElement?.nextElementSibling?.id?.slice(-9)
  //   );
  //   // console.log("info.jsEvent :>> ", info.jsEvent);
  // };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
      }}
      onDrop={async (e) => {
        e.preventDefault();
        const sourceUid = e.dataTransfer.getData("text");
        const blockContent = getBlockContentByUid(sourceUid);
        const targetDateString = e.target.parentNode.dataset["date"];
        const targetDate = new Date(targetDateString);
        const isoDate = dateToISOString(targetDate);
        let calendarBlockUid = await getCalendarUidFromPage(
          window.roamAlphaAPI.util.dateToPageTitle(targetDate)
        );
        createChildBlock(calendarBlockUid, `((${sourceUid}))`);
        events.push({
          id: sourceUid,
          title: blockContent,
          date: isoDate,
          extendedProps: { eventTags: ["calendar"], isRef: false },
          borderColor: "transparent",
          color: "none",
          classNames: ["calendar"],
        });
        isDataToReload.current = false;
        setAddedEvent(sourceUid);

        // setEvents((prev) => {
        //   const clone = [...prev];
        //   clone.push({
        //     id: sourceUid,
        //     title: blockContent,
        //     date: isoDate,
        //     extendedProps: { eventTags: ["calendar"], isRef: false },
        //     borderColor: "transparent",
        //     color: "none",
        //     classNames: ["calendar"],
        //   });
        //   return clone;
        // });
      }}
    >
      <NewEventDialog
        newEventDialogIsOpen={newEventDialogIsOpen}
        setNewEventDialogIsOpen={setNewEventDialogIsOpen}
        pageUid={focusedPageUid}
        // setEvents={setEvents}
      />
      <Filters filters={filters} setFilters={setFilters} />
      <FullCalendar
        plugins={[
          dayGridPlugin,
          timeGridPlugin,
          multiMonthPlugin,
          interactionPlugin,
        ]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay",
        }}
        firstDay={1}
        fixedWeekCount={false}
        nowIndicator={true}
        slotMinTime="06:00"
        slotMaxTime="22:00"
        navLinks={true}
        editable={true}
        selectable={true}
        droppable={true}
        // draggable={true}
        dayMaxEvents={true}
        // initialEvents={getEventsFromDNP}
        events={getEventsFromDNP}
        // events={events}
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
          // console.log("Event: ", info.event);
          // console.log("JS: ", info.jsEvent);
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
