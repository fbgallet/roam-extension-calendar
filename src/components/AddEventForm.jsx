import React, { useState } from "react";
function AddEventForm({ onAddEvent }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [description, setDescription] = useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    const event = {
      summary: title,
      description: description,
      start: {
        dateTime: start + ":00",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: end + ":00",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
    onAddEvent(event);
  };
  return (
    <div id="add-event-form">
      <h2>Ajouter un événement</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de l'événement"
          required
        />
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
        />
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          required
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optionnel)"
        />
        <input type="submit" value="Ajouter l'événement" />
      </form>
    </div>
  );
}
export default AddEventForm;
