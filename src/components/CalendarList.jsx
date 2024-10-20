import React from "react";
function CalendarList({ calendars, onSelectCalendar }) {
  return (
    <div id="calendar-list">
      <h2>Vos calendriers:</h2>
      {calendars.map((calendar) => (
        <button key={calendar.id} onClick={() => onSelectCalendar(calendar.id)}>
          {calendar.summary}
        </button>
      ))}
    </div>
  );
}
export default CalendarList;
