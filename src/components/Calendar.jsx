import FullCalendar from "@fullcalendar/react";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";

const Calendar = () => {
  const handleDateClick = (e) => {
    console.log(e);
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
      editable={true}
      droppable={true}
      events={[
        { title: "event 1", date: "2023-12-01" },
        { title: "event 2", date: "2023-12-02" },
      ]}
      dateClick={handleDateClick}
    />
  );
};

export default Calendar;
