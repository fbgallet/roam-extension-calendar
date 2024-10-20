import React, { useState, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import CalendarApp from "./CalendarApp";

const CLIENT_ID =
  "743270704845-amll1jrommrq6h2t7lr14puv4jvuje6i.apps.googleusercontent.com";
const API_KEY = process.env.googleCalendarApiKey;
function GoogleCal() {
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = () =>
          reject(new Error(`Erreur de chargement du script: ${src}`));
        document.body.appendChild(script);
      });
    };
    const loadGoogleAPIs = async () => {
      try {
        await loadScript("https://apis.google.com/js/api.js");
        await loadScript("https://accounts.google.com/gsi/client");
        setScriptsLoaded(true);
      } catch (error) {
        console.error(error);
      }
    };
    loadGoogleAPIs();
  }, []);
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <div className="App">
        <div className="container">
          <h1>Mes Événements Google Calendar</h1>
          {scriptsLoaded ? (
            <CalendarApp apiKey={API_KEY} clientId={CLIENT_ID} />
          ) : (
            <p>Chargement des scripts Google...</p>
          )}
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
export default GoogleCal;
