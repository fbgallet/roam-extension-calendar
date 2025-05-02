import React, { useState, useEffect } from "react";
import CalendarList from "./CalendarList";
import EventsList from "./EventsList";
import AddEventForm from "./AddEventForm";
import { extensionStorage } from "..";
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
      let token = extensionStorage.get("googleCalToken");
      if (!token) {
        token = google.accounts.oauth2.initTokenClient({
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
        });
      }
      setTokenClient(token);
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
      setEvents(await getGcalEvents(calendarId));
    } catch (err) {
      setError("Erreur lors de la récupération des événements");
    }
  };
  const addEvent = async (event) => {};
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
              console.log("id :>> ", id);
              extensionStorage.set("googleCalendarId", id);
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

export const getGcalEvents = async (calendarId, min, max) => {
  const now = new Date();
  const response = await window.gapi.client.calendar.events.list({
    calendarId: calendarId,
    timeMin: min || now,
    timeMax: max || now,
    showDeleted: false,
    singleEvents: true,
    orderBy: "startTime",
  });
  console.log("response.result.items :>> ", response?.result?.items);
  return response?.result?.items;
};

export const addGcalEvent = async (calendarId, event) => {
  console.log("event :>> ", event);
  const gCalEvent = {
    summary: event.title,
    // description: event.description,
    start: {
      date: event.start,
      // dateTime: event.start, //+ ":00",
      //timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      date: event.end,
      // dateTime: event.end, // + ":00",
      // timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };
  console.log("gCalEvent :>> ", gCalEvent);
  try {
    const newEvent = await window.gapi.client.calendar.events.insert({
      calendarId: calendarId,
      resource: gCalEvent,
    });
    console.log("newEvent :>> ", newEvent);
    return newEvent;
    // listEvents(calendarId);
  } catch (err) {
    console.log("Erreur lors de l'ajout de l'événement:", err);
  }
};
