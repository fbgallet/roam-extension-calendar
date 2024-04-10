import FullCalendar from "@fullcalendar/react";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import { getBlocksToDisplayFromDNP } from "../util/data";
import { useState, useEffect, useRef } from "react";
import Event from "./Event";
import Filters from "./Filters";

const Calendar = () => {
  const [filters, setFilters] = useState({
    TODO: true,
    DONE: true,
    due: true,
    do: true,
    progress: true,
    important: true,
    urgent: true,
    other: true,
  });
  const isDataToReload = useRef(true);
  const events = useRef([]);

  console.log("events // :>> ", events.current);

  useEffect(() => {
    if (events.current.length !== 0) isDataToReload.current = false;
  }, [filters]);

  const handleDayClick = (e) => {
    console.log("Day clicked", e);
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
    // info.event.setProp("color", "red");
    return (
      <Event
        displayTitle={title}
        event={info.event}
        hasCheckbox={hasCheckbox}
        isChecked={isChecked}
      ></Event>
    );
  };

  const getEventsFromDNP = async (info) => {
    console.log("events.current :>> ", events.current);
    if (isDataToReload.current)
      events.current = getBlocksToDisplayFromDNP(info.start, info.end);
    else isDataToReload.current = true;
    const eventsToDisplay = events.current.filter((evt) =>
      evt.extendedProps?.eventTags?.some((tag) => filters[tag])
    );
    console.log("events to display:>> ", eventsToDisplay);

    return eventsToDisplay;
  };

  const handleEventDrop = (info) => {
    window.roamAlphaAPI.moveBlock({
      location: {
        "parent-uid": window.roamAlphaAPI.util.dateToPageUid(info.event.start),
        order: "last",
      },
      block: { uid: info.event.id },
    });
  };

  return (
    <>
      <Filters filters={filters} setFilters={setFilters} />
      <FullCalendar
        plugins={[dayGridPlugin, multiMonthPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "multiMonthYear,dayGridMonth,dayGridWeek,dayGridDay",
        }}
        firstDay={1}
        navLinks={true}
        editable={true}
        selectable={true}
        droppable={true}
        dayMaxEvents={true}
        events={getEventsFromDNP}
        // initialEvents={getEventsFromDNP}
        // events={events}
        // eventSources={[
        //   [
        //     { title: "My First Event", date: "2024-04-06", editable: true },
        //     {
        //       title:
        //         "My second event with a very very very long title, will it be shortened ?",
        //       date: "2024-04-08",
        //       display: "list-item",
        //     },
        //     {
        //       title: "My third event",
        //       date: "2024-04-08",
        //       display: "list-item",
        //     },
        //     {
        //       title: "My event 4",
        //       date: "2024-04-08",
        //       display: "list-item",
        //     },
        //   ],
        //   getEventsFromDNP,
        // ]}
        eventContent={(info, jsEvent) => renderEventContent(info, jsEvent)}
        eventClick={(info) => {
          // console.log("Event: ", info.event);
          // console.log("JS: ", info.jsEvent);
          if (info.jsEvent.shiftKey) {
            window.roamAlphaAPI.ui.rightSidebar.addWindow({
              window: { type: "block", "block-uid": info.event.id },
            });
          }
          // console.log("View: ", info.view);
          // window.roamAlphaAPI.ui.components.renderBlock({
          //   uid: "zNLBAJtII",
          //   el: info.jsEvent.target,
          // });
        }}
        eventDrop={handleEventDrop}
        select={handleDayClick}
      />
    </>
  );
};

export default Calendar;
