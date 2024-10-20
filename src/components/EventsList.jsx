import React from "react";
function EventsList({ events }) {
  return (
    <div id="events-list">
      <h2>Prochains événements:</h2>
      {events.length === 0 ? (
        <p>Aucun événement trouvé.</p>
      ) : (
        events.map((event) => (
          <div key={event.id}>
            <strong>{event.summary}</strong>
            <br />
            Date:{" "}
            {new Date(
              event.start.dateTime || event.start.date
            ).toLocaleString()}
          </div>
        ))
      )}
    </div>
  );
}
export default EventsList;
