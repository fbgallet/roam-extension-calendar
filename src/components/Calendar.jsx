import FullCalendar from "@fullcalendar/react";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import { Checkbox, Tooltip } from "@blueprintjs/core";
import { getBlocksToDisplayFromDNP } from "../util/data";
import { useState } from "react";
import { updateBlock } from "../util/roamApi";

console.log("fullCalendar cmpt", FullCalendar);

const Calendar = () => {
  // const [events, setEvents] = useState([]);

  // console.log("events // :>> ", events);

  const handleDayClick = (e) => {
    console.log("Day clicked", e);
  };

  const renderEventContent = (info) => {
    console.log("Rendering event:", info);
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
    return (
      <Tooltip content={info.event.title}>
        {hasCheckbox ? (
          <Checkbox
            checked={isChecked}
            onChange={(e) => {
              e.stopPropagation();
              const updatedTitle = isChecked
                ? info.event.title.replace("{{[[DONE]]}}", "{{[[TODO]]}}")
                : info.event.title.replace("{{[[TODO]]}}", "{{[[DONE]]}}");
              info.event.setProp("title", updatedTitle);
              updateBlock(info.event.id, updatedTitle);
              // setEvents((prev) => {
              //   let clone = [...prev];
              //   const event = clone.find((elt) => elt.id === info.event.id);
              //   console.log("event.title :>> ", event.title);
              //   return clone;
              // });
              // console.log("is checked ?", e);
            }}
          >
            {title}
          </Checkbox>
        ) : (
          info.event.title
        )}
      </Tooltip>
    );
  };

  const getEventsFromDNP = async (info) => {
    // console.log("events function infos:", info);
    const dnpEvents = getBlocksToDisplayFromDNP(info.start, info.end);
    console.log("events in Calendar :>> ", dnpEvents);
    // setEvents(dnpEvents);
    return dnpEvents;
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
      // eventClick={(info) => {
      //   console.log("Event: ", info.event);
      //   console.log("JS: ", info.jsEvent);
      //   console.log("View: ", info.view);
      //   window.roamAlphaAPI.ui.components.renderBlock({
      //     uid: "zNLBAJtII",
      //     el: info.jsEvent.target,
      //   });
      // }}
      eventDrop={handleEventDrop}
      select={handleDayClick}
    />
  );
};

export default Calendar;
