import FullCalendar from "@fullcalendar/react";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import { Tooltip } from "@blueprintjs/core";
import { getBlocksToDisplayFromDNP } from "../util/data";

console.log("fullCalendar cmpt", FullCalendar);

const Calendar = () => {
  const handleDayClick = (e) => {
    console.log("Day clicked", e);
  };

  const renderEventContent = (info) => {
    return <Tooltip content={info.event.title}>{info.event.title}</Tooltip>;
  };

  const getEventsFromDNP = (info) => {
    console.log("events function infos:", info);
    const events = getBlocksToDisplayFromDNP();
    console.log("events in Calendar :>> ", events);
    return events;
  };

  return (
    <FullCalendar
      plugins={[dayGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridDay,dayGridWeek,dayGridMonth",
      }}
      firstDay={1}
      navLinks={true}
      editable={true}
      selectable={true}
      droppable={true}
      dayMaxEvents={true}
      events={getEventsFromDNP}
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
        console.log("Event: ", info.event);
        console.log("JS: ", info.jsEvent);
        console.log("View: ", info.view);
        window.roamAlphaAPI.ui.components.renderBlock({
          uid: "zNLBAJtII",
          el: info.jsEvent.target,
        });
      }}
      select={handleDayClick}
    />
  );
};

export default Calendar;
