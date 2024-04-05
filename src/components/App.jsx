import React from "react";
import ReactDOM from "react-dom";
import FullCalendar from "@fullcalendar/react";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";

export function renderApp() {
  const existing = document.getElementsByClassName("calendar");
  console.log(existing);
  if (existing.length !== 0) existing[0].remove();
  const block = document.getElementsByClassName("rm-block")[1];
  const root = document.createElement("div");
  root.classList.add("calendar");
  block.appendChild(root);

  ReactDOM.render(
    <FullCalendar
      plugins={[dayGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridDay,dayGridWeek,dayGridMonth",
      }}
      firstDay={1}
      editable={true}
      droppable={true}
      events={[
        { title: "event 1", date: "2023-12-01" },
        { title: "event 2", date: "2023-12-02" },
      ]}
    />,
    root
  );

  // let calendar = new Calendar(root, {
  //   plugins: [dayGridPlugin, interactionPlugin],
  //   droppable: true,
  //   drop: function (info) {
  //     console.log(info.draggedEl);
  //   },
  //   initialView: "dayGridMonth",
  //   headerToolbar: {
  //     left: "prev,next today",
  //     center: "title",
  //     right: "dayGridDay,dayGridWeek,dayGridMonth",
  //   },
  // });
}
