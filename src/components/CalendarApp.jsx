import React, { useState, useEffect } from "react";
import CalendarList from "./CalendarList";
import EventsList from "./EventsList";
import AddEventForm from "./AddEventForm";
const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar";
function CalendarApp({ apiKey, clientId }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState("primary");
  const [error, setError] = useState("");
  const [tokenClient, setTokenClient] = useState(null);
  useEffect(() => {
    const initializeGapiClient = async () => {
      await new Promise((resolve) => {
        window.gapi.load("client", resolve);
      });
      await window.gapi.client.init({
        apiKey,
        discoveryDocs: [DISCOVERY_DOC],
      });
      setTokenClient(
        google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: (tokenResponse) => {
            if (tokenResponse.error !== undefined) {
              setError("Erreur d'authentification.");
              console.error(tokenResponse);
              return;
            }
            setIsAuthorized(true);
            listCalendars();
          },
        })
      );
    };
    initializeGapiClient().catch((err) => {
      console.error("Erreur d'initialisation de l'API Google:", err);
      setError("Erreur d'initialisation de l'API Google");
    });
  }, [apiKey, clientId]);
  const handleAuthClick = () => {
    tokenClient.requestAccessToken();
  };
  const handleSignoutClick = () => {
    const token = window.gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        window.gapi.client.setToken("");
        setIsAuthorized(false);
        setCalendars([]);
        setEvents([]);
        setError("");
      });
    }
  };
  const listCalendars = async () => {
    try {
      const response = await window.gapi.client.calendar.calendarList.list();
      setCalendars(response.result.items);
    } catch (err) {
      setError("Erreur lors de la récupération des calendriers");
    }
  };
  const listEvents = async (calendarId) => {
    try {
      const now = new Date();
      const response = await window.gapi.client.calendar.events.list({
        calendarId: calendarId,
        timeMin: now.toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 10,
        orderBy: "startTime",
      });
      setEvents(response.result.items);
    } catch (err) {
      setError("Erreur lors de la récupération des événements");
    }
  };
  const addEvent = async (event) => {
    try {
      await window.gapi.client.calendar.events.insert({
        calendarId: selectedCalendarId,
        resource: event,
      });
      setError("Événement ajouté avec succès!");
      listEvents(selectedCalendarId);
    } catch (err) {
      setError("Erreur lors de l'ajout de l'événement");
    }
  };
  return (
    <div>
      {!isAuthorized ? (
        <button onClick={handleAuthClick}>Autoriser</button>
      ) : (
        <>
          <button onClick={handleSignoutClick}>Déconnexion</button>
          <CalendarList
            calendars={calendars}
            onSelectCalendar={(id) => {
              setSelectedCalendarId(id);
              listEvents(id);
            }}
          />
          <EventsList events={events} />
          <AddEventForm onAddEvent={addEvent} />
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
export default CalendarApp;
