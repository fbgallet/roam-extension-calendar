/**
 * Google Calendar Service
 * Handles authentication, token management, and API interactions
 */

import { extensionStorage } from "..";
import { encryptToken, decryptToken, migrateToken } from "../util/tokenEncryption";
import { generateCSRFToken, storeCSRFToken, validateCSRFToken, clearExpiredCSRFTokens } from "../util/csrfProtection";

const CLIENT_ID =
  "743270704845-jvqg91e6bk03jbnu1qcdnrh9r3ohgact.apps.googleusercontent.com";
const DISCOVERY_DOCS = [
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
  "https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest",
];
const SCOPES =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/tasks";
const BACKEND_URL =
  "https://site--roam-calendar-auth-backend--2bhrm4wg9nqn.code.run";

// Service state
let gapiInitialized = false;
let tokenClient = null;
let authStateListeners = [];
let tokenRefreshInterval = null;

/**
 * Storage keys for GCal data
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: "gcal-access-token",
  REFRESH_TOKEN: "gcal-refresh-token",
  TOKEN_EXPIRY: "gcal-token-expiry",
  CONNECTED_CALENDARS: "gcal-connected-calendars",
  AUTO_SYNC: "gcal-auto-sync",
  SYNC_INTERVAL: "gcal-sync-interval",
  USE_ORIGINAL_COLORS: "gcal-use-original-colors",
  CHECKBOX_FORMAT: "gcal-checkbox-format",
  // Google Tasks storage keys
  TASKS_ENABLED: "gtasks-enabled",
  CONNECTED_TASK_LISTS: "gtasks-connected-lists",
};

/**
 * Secure token storage helpers
 * These wrap extensionStorage to automatically encrypt/decrypt tokens
 */
const setToken = async (key, token) => {
  if (!token) {
    extensionStorage.set(key, null);
    return;
  }
  const encrypted = await encryptToken(token);
  extensionStorage.set(key, encrypted);
};

const getToken = async (key) => {
  const stored = extensionStorage.get(key);
  if (!stored) return null;

  // Attempt to migrate old unencrypted tokens
  const migrated = await migrateToken(stored);
  if (migrated !== stored) {
    // Token was migrated, save the encrypted version
    extensionStorage.set(key, migrated);
  }

  return await decryptToken(migrated);
};

/**
 * Default calendar configuration
 * Note: tag color is managed in fc-tags-info for the associated tag
 * backgroundColor stores the original Google Calendar color for optional use
 */
export const DEFAULT_CALENDAR_CONFIG = {
  id: "",
  name: "", // Original Google Calendar name
  displayName: "", // Custom display name (used as tag name if showAsSeparateTag)
  triggerTags: [], // Alias trigger tags only (displayName is the implicit primary tag)
  showAsSeparateTag: false, // If true, appears as separate tag in MultiSelect
  isDefault: true,
  syncEnabled: true,
  syncDirection: "both",
  lastSyncTime: 0,
  backgroundColor: null, // Original Google Calendar color (hex)
};

/**
 * Default task list configuration
 */
export const DEFAULT_TASK_LIST_CONFIG = {
  id: "",
  name: "", // Original Google Task List name
  displayName: "", // Custom display name (used as tag name if showAsSeparateTag)
  triggerTags: [], // First one defaults to list name, rest are aliases
  showAsSeparateTag: false, // If true, appears as separate tag in MultiSelect
  syncEnabled: true,
  lastSyncTime: 0,
};

/**
 * Load Google API scripts dynamically
 */
const loadGoogleScripts = async () => {
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      // Check if script already loaded
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
    });
  };

  await loadScript("https://apis.google.com/js/api.js");
  await loadScript("https://accounts.google.com/gsi/client");
};

/**
 * Initialize the GAPI client
 */
const initGapiClient = async () => {
  if (gapiInitialized) return;

  await new Promise((resolve) => {
    window.gapi.load("client", resolve);
  });

  await window.gapi.client.init({
    discoveryDocs: DISCOVERY_DOCS,
  });

  gapiInitialized = true;
};

/**
 * Initialize the token client for OAuth (fallback mode)
 */
const initTokenClient = () => {
  if (tokenClient) return tokenClient;

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse.error !== undefined) {
        console.error("Auth error:", tokenResponse);
        notifyAuthStateChange(false);
        return;
      }
      // Store the token (fallback mode - no refresh token)
      const expiryTime = Date.now() + tokenResponse.expires_in * 1000;
      extensionStorage.set(
        STORAGE_KEYS.ACCESS_TOKEN,
        tokenResponse.access_token
      );
      extensionStorage.set(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime);
      notifyAuthStateChange(true);
    },
  });

  return tokenClient;
};

/**
 * Check if backend is available
 */
const isBackendAvailable = async () => {
  try {
    console.log(
      `[Auth] Checking backend availability at ${BACKEND_URL}/health`
    );
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    const isAvailable = response.ok;
    console.log(
      `[Auth] Backend ${isAvailable ? "✓ AVAILABLE" : "✗ UNAVAILABLE"}`
    );
    return isAvailable;
  } catch (error) {
    console.warn(`[Auth] ✗ Backend not reachable: ${error.message}`);
    console.warn("[Auth] → Will use fallback session-based authentication");
    return false;
  }
};

/**
 * Get authorization code from Google (for backend flow)
 * Includes CSRF protection via state parameter
 */
const getAuthorizationCode = () => {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services not loaded"));
      return;
    }

    // Generate CSRF protection state token
    const csrfState = generateCSRFToken();
    storeCSRFToken(csrfState);

    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      ux_mode: "popup",
      state: csrfState, // Add CSRF state parameter
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        // Validate CSRF state token
        if (!response.state || !validateCSRFToken(response.state)) {
          reject(new Error("CSRF validation failed - possible attack detected"));
          console.error("[Auth] CSRF validation failed!");
          return;
        }

        console.log("[Auth] ✓ CSRF validation passed");
        resolve(response.code);
      },
    });

    client.requestCode();
  });
};

/**
 * Notify all listeners of auth state change
 */
const notifyAuthStateChange = (isAuthenticated) => {
  authStateListeners.forEach((listener) => listener(isAuthenticated));
};

/**
 * Initialize Google Calendar service
 * Should be called on extension load
 */
export const initGoogleCalendarService = async () => {
  try {
    await loadGoogleScripts();
    await initGapiClient();
    initTokenClient();

    // Try to restore existing session
    const savedToken = extensionStorage.get(STORAGE_KEYS.ACCESS_TOKEN);
    const tokenExpiry = extensionStorage.get(STORAGE_KEYS.TOKEN_EXPIRY);
    const refreshToken = extensionStorage.get(STORAGE_KEYS.REFRESH_TOKEN);

    if (savedToken && tokenExpiry && Date.now() < tokenExpiry) {
      // Token still valid, set it
      window.gapi.client.setToken({ access_token: savedToken });
      notifyAuthStateChange(true);

      // Start monitoring if we have a refresh token
      if (refreshToken) {
        startTokenRefreshMonitoring();
      }

      return true;
    } else if (savedToken) {
      // Token expired, try silent refresh
      const refreshed = await silentRefresh();

      // Start monitoring if refresh was successful and we have a refresh token
      if (refreshed && refreshToken) {
        startTokenRefreshMonitoring();
      }

      return refreshed;
    }

    return false;
  } catch (error) {
    console.error("Failed to initialize Google Calendar service:", error);
    return false;
  }
};

/**
 * Try to silently refresh the authentication
 * Primary: Use refresh token via backend
 * Fallback: Use GIS silent refresh (requires active Google session)
 */
export const silentRefresh = async () => {
  const refreshToken = extensionStorage.get(STORAGE_KEYS.REFRESH_TOKEN);

  // Try backend refresh if we have a refresh token
  if (refreshToken) {
    try {
      console.log("[Auth] 🔄 Refreshing token via backend...");
      const response = await fetch(`${BACKEND_URL}/oauth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const tokens = await response.json();
        const expiryTime = Date.now() + tokens.expires_in * 1000;
        extensionStorage.set(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
        extensionStorage.set(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime);
        window.gapi.client.setToken({ access_token: tokens.access_token });
        notifyAuthStateChange(true);
        console.log("[Auth] ✅ Token refreshed successfully via backend");
        return true;
      } else {
        console.warn("[Auth] ✗ Backend refresh failed, trying fallback");
      }
    } catch (error) {
      console.warn(`[Auth] ✗ Backend refresh error: ${error.message}`);
      console.warn("[Auth] → Trying fallback silent refresh");
    }
  }

  // Fallback to GIS silent refresh
  console.log(
    "[Auth] 🔄 Attempting fallback silent refresh (requires active Google session)..."
  );
  return new Promise((resolve) => {
    if (!tokenClient) {
      initTokenClient();
    }

    tokenClient.callback = (tokenResponse) => {
      if (tokenResponse.error !== undefined) {
        console.warn(
          "[Auth] ✗ Silent refresh failed - user needs to re-authenticate"
        );
        resolve(false);
        return;
      }
      const expiryTime = Date.now() + tokenResponse.expires_in * 1000;
      extensionStorage.set(
        STORAGE_KEYS.ACCESS_TOKEN,
        tokenResponse.access_token
      );
      extensionStorage.set(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime);
      notifyAuthStateChange(true);
      console.log("[Auth] ✅ Fallback silent refresh successful");
      resolve(true);
    };

    try {
      tokenClient.requestAccessToken({ prompt: "none" });
    } catch (error) {
      console.warn(`[Auth] ✗ Silent refresh not available: ${error.message}`);
      resolve(false);
    }
  });
};

/**
 * Start monitoring token expiry and proactively refresh
 * Checks every 10 minutes and refreshes if token expires within 15 minutes
 */
const startTokenRefreshMonitoring = () => {
  // Clear any existing interval
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
  }

  // Check token every 10 minutes
  tokenRefreshInterval = setInterval(async () => {
    const tokenExpiry = extensionStorage.get(STORAGE_KEYS.TOKEN_EXPIRY);
    const refreshToken = extensionStorage.get(STORAGE_KEYS.REFRESH_TOKEN);

    // Only monitor if we have a refresh token (backend auth)
    if (!refreshToken || !tokenExpiry) {
      return;
    }

    // Refresh if token expires within 15 minutes
    const fifteenMinutes = 15 * 60 * 1000;
    if (Date.now() > tokenExpiry - fifteenMinutes) {
      console.log("[Auth] 🔄 Proactive token refresh (expires soon)");
      try {
        await silentRefresh();
      } catch (error) {
        console.error("[Auth] ✗ Proactive refresh failed:", error);
      }
    }
  }, 10 * 60 * 1000); // Check every 10 minutes

  console.log("[Auth] ✓ Token refresh monitoring started");
};

/**
 * Stop monitoring token expiry
 */
export const stopTokenRefreshMonitoring = () => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
    console.log("[Auth] Token refresh monitoring stopped");
  }
};

/**
 * Check if user is currently authenticated
 */
export const isAuthenticated = () => {
  const token = window.gapi?.client?.getToken();
  const savedToken = extensionStorage.get(STORAGE_KEYS.ACCESS_TOKEN);
  const tokenExpiry = extensionStorage.get(STORAGE_KEYS.TOKEN_EXPIRY);

  return (token?.access_token || savedToken) && Date.now() < (tokenExpiry || 0);
};

/**
 * Check if Google Calendar is currently connected and accessible
 * Returns connection status object
 */
export const getConnectionStatus = async () => {
  // Check if authenticated
  if (!isAuthenticated()) {
    return {
      isConnected: false,
      isOffline: false,
      reason: 'not_authenticated',
      message: 'Google Calendar not connected'
    };
  }

  // Check if we're online
  if (!navigator.onLine) {
    return {
      isConnected: false,
      isOffline: true,
      reason: 'offline',
      message: 'You are offline'
    };
  }

  // Try a lightweight API call to verify connection
  try {
    await getAccessToken(); // This will refresh token if needed
    return {
      isConnected: true,
      isOffline: false,
      reason: null,
      message: 'Connected'
    };
  } catch (error) {
    return {
      isConnected: false,
      isOffline: true, // Assume network issue if auth check fails
      reason: 'api_error',
      message: 'Google Calendar connection failed'
    };
  }
};

/**
 * Request user authentication
 * Primary: Use authorization code flow with backend (gets refresh token)
 * Fallback: Use GIS token client (session-based only)
 */
export const authenticate = async () => {
  // First check if we already have a refresh token - try silent refresh
  const refreshToken = extensionStorage.get(STORAGE_KEYS.REFRESH_TOKEN);
  if (refreshToken) {
    console.log(
      "[Auth] 🔄 Refresh token found - attempting silent authentication..."
    );
    const refreshed = await silentRefresh();
    if (refreshed) {
      console.log(
        "[Auth] ✅ Successfully authenticated using existing refresh token"
      );
      startTokenRefreshMonitoring();
      return { access_token: extensionStorage.get(STORAGE_KEYS.ACCESS_TOKEN) };
    } else {
      console.warn(
        "[Auth] ✗ Silent refresh failed - refresh token may be invalid"
      );
      console.log("[Auth] → Proceeding with full authentication flow");
    }
  }

  // Try backend flow first
  const backendAvailable = await isBackendAvailable();

  if (backendAvailable) {
    try {
      console.log(
        "[Auth] 🔐 Using BACKEND OAuth flow (persistent authentication)"
      );
      console.log(
        "[Auth] → This will provide a refresh token for permanent access"
      );

      // Step 1: Get authorization code from Google
      console.log(
        "[Auth] Step 1/3: Requesting authorization code from Google..."
      );
      const code = await getAuthorizationCode();
      console.log("[Auth] ✓ Authorization code received");

      // Step 2: Exchange code for tokens via backend
      console.log("[Auth] Step 2/3: Exchanging code for tokens via backend...");
      const response = await fetch(`${BACKEND_URL}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          redirect_uri: "postmessage",
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Token exchange failed");
      }

      const tokens = await response.json();
      console.log("[Auth] ✓ Tokens received from backend");

      // Step 3: Store tokens (including refresh token!)
      console.log("[Auth] Step 3/3: Storing tokens...");
      const expiryTime = Date.now() + tokens.expires_in * 1000;
      extensionStorage.set(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
      extensionStorage.set(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
      extensionStorage.set(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime);

      // Set token in GAPI
      window.gapi.client.setToken({ access_token: tokens.access_token });

      notifyAuthStateChange(true);

      // Start proactive token refresh monitoring
      startTokenRefreshMonitoring();

      console.log("[Auth] ✅ SUCCESS - Backend authentication complete!");
      console.log("[Auth] → Refresh token stored - permanent access enabled");
      console.log("[Auth] → Token will auto-refresh every ~1 hour");
      return tokens;
    } catch (error) {
      console.error("[Auth] ✗ Backend authentication failed:", error.message);
      console.warn("[Auth] → Falling back to session-based authentication");
    }
  }

  // Fallback to session-based authentication
  console.log("[Auth] 🔓 Using FALLBACK session-based authentication");
  console.log("[Auth] → No refresh token - will need re-auth after ~1 hour");
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      initTokenClient();
    }

    tokenClient.callback = (tokenResponse) => {
      if (tokenResponse.error !== undefined) {
        console.error(
          "[Auth] ✗ Fallback authentication failed:",
          tokenResponse.error
        );
        reject(new Error(tokenResponse.error));
        return;
      }
      // Store the token (no refresh token in fallback mode)
      const expiryTime = Date.now() + tokenResponse.expires_in * 1000;
      extensionStorage.set(
        STORAGE_KEYS.ACCESS_TOKEN,
        tokenResponse.access_token
      );
      extensionStorage.set(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime);
      notifyAuthStateChange(true);
      console.log("[Auth] ✅ Fallback authentication successful");
      console.log("[Auth] ⚠️  Session-based only - token expires in ~1 hour");
      resolve(tokenResponse);
    };

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
};

/**
 * Sign out and revoke access
 */
export const signOut = async () => {
  const token = extensionStorage.get(STORAGE_KEYS.ACCESS_TOKEN);

  if (token) {
    try {
      // Revoke the token
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: "POST",
      });
    } catch (error) {
      console.error("Error revoking token:", error);
    }

    window.gapi?.client?.setToken("");
  }

  // Stop token refresh monitoring
  stopTokenRefreshMonitoring();

  // Clear all stored auth data
  extensionStorage.set(STORAGE_KEYS.ACCESS_TOKEN, null);
  extensionStorage.set(STORAGE_KEYS.REFRESH_TOKEN, null);
  extensionStorage.set(STORAGE_KEYS.TOKEN_EXPIRY, null);
  // Keep calendar configs but mark as disconnected

  notifyAuthStateChange(false);
};

/**
 * Add listener for authentication state changes
 */
export const onAuthStateChange = (callback) => {
  authStateListeners.push(callback);
  // Return unsubscribe function
  return () => {
    authStateListeners = authStateListeners.filter((cb) => cb !== callback);
  };
};

/**
 * Get access token, refreshing if needed
 */
export const getAccessToken = async () => {
  const tokenExpiry = extensionStorage.get(STORAGE_KEYS.TOKEN_EXPIRY);

  // Check if token is about to expire (within 5 minutes)
  if (tokenExpiry && Date.now() > tokenExpiry - 5 * 60 * 1000) {
    const refreshed = await silentRefresh();
    if (!refreshed) {
      throw new Error("Token expired and refresh failed");
    }
  }

  const token = extensionStorage.get(STORAGE_KEYS.ACCESS_TOKEN);
  if (!token) {
    throw new Error("No access token available");
  }

  // Ensure gapi.client has the token set
  if (window.gapi?.client) {
    window.gapi.client.setToken({ access_token: token });
  }

  return token;
};

// ============================================
// Calendar API Methods
// ============================================

/**
 * List all calendars accessible by the user
 */
export const listCalendars = async () => {
  try {
    await getAccessToken(); // Ensure valid token
    const response = await window.gapi.client.calendar.calendarList.list();
    return response.result.items || [];
  } catch (error) {
    console.error("Error listing calendars:", error);
    throw error;
  }
};

/**
 * Get events from a specific calendar
 * @param {string} calendarId - Calendar ID
 * @param {Date|string} timeMin - Start of date range
 * @param {Date|string} timeMax - End of date range
 * @param {object} options - Additional options
 */
export const getEvents = async (calendarId, timeMin, timeMax, options = {}) => {
  try {
    await getAccessToken();

    const params = {
      calendarId,
      timeMin: timeMin instanceof Date ? timeMin.toISOString() : timeMin,
      timeMax: timeMax instanceof Date ? timeMax.toISOString() : timeMax,
      showDeleted: options.showDeleted || false,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: options.maxResults || 250,
      // Request all relevant fields including description, colorId, and attachments
      fields:
        "items(id,summary,description,location,start,end,htmlLink,etag,updated,creator,organizer,attendees,recurrence,recurringEventId,status,colorId,attachments)",
    };

    // For incremental sync
    if (options.updatedMin) {
      params.updatedMin =
        options.updatedMin instanceof Date
          ? options.updatedMin.toISOString()
          : options.updatedMin;
    }

    const response = await window.gapi.client.calendar.events.list(params);
    return response.result.items || [];
  } catch (error) {
    console.error("Error fetching events:", error);
    throw error;
  }
};

/**
 * Create a new event in Google Calendar
 * @param {string} calendarId - Calendar ID
 * @param {object} event - Event data
 */
export const createEvent = async (calendarId, event) => {
  try {
    await getAccessToken();

    const response = await window.gapi.client.calendar.events.insert({
      calendarId,
      resource: event,
    });

    return response.result;
  } catch (error) {
    console.error("Error creating event:", error);
    throw error;
  }
};

/**
 * Update an existing event in Google Calendar
 * @param {string} calendarId - Calendar ID
 * @param {string} eventId - Event ID
 * @param {object} event - Updated event data
 */
export const updateEvent = async (calendarId, eventId, event) => {
  try {
    await getAccessToken();

    const response = await window.gapi.client.calendar.events.update({
      calendarId,
      eventId,
      resource: event,
    });

    return response.result;
  } catch (error) {
    console.error("Error updating event:", error);
    throw error;
  }
};

/**
 * Delete an event from Google Calendar
 * @param {string} calendarId - Calendar ID
 * @param {string} eventId - Event ID
 */
export const deleteEvent = async (calendarId, eventId) => {
  try {
    await getAccessToken();

    await window.gapi.client.calendar.events.delete({
      calendarId,
      eventId,
    });

    return true;
  } catch (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
};

/**
 * Get a single event by ID
 * @param {string} calendarId - Calendar ID
 * @param {string} eventId - Event ID
 */
export const getEvent = async (calendarId, eventId) => {
  try {
    await getAccessToken();

    const response = await window.gapi.client.calendar.events.get({
      calendarId,
      eventId,
    });

    return response.result;
  } catch (error) {
    console.error("Error getting event:", error);
    throw error;
  }
};

// ============================================
// Google Tasks API Methods
// ============================================

/**
 * List all task lists for the user
 * @returns {array} Array of task list objects
 */
export const listTaskLists = async () => {
  try {
    await getAccessToken();
    const response = await window.gapi.client.tasks.tasklists.list({
      maxResults: 100,
    });
    return response.result.items || [];
  } catch (error) {
    console.error("Error listing task lists:", error);
    throw error;
  }
};

/**
 * Get tasks from a specific task list
 * @param {string} taskListId - Task list ID (use "@default" for default list)
 * @param {object} options - Query options
 * @param {Date|string} options.dueMin - Minimum due date
 * @param {Date|string} options.dueMax - Maximum due date
 * @param {boolean} options.showCompleted - Include completed tasks
 * @param {boolean} options.showHidden - Include hidden tasks
 * @returns {array} Array of task objects
 */
export const getTasks = async (taskListId, options = {}) => {
  try {
    await getAccessToken();

    const params = {
      tasklist: taskListId,
      maxResults: 100,
      showCompleted: options.showCompleted ?? true,
      showHidden: options.showHidden ?? false,
    };

    // Note: Tasks API uses RFC 3339 format for dates
    if (options.dueMin) {
      params.dueMin =
        options.dueMin instanceof Date
          ? options.dueMin.toISOString()
          : options.dueMin;
    }
    if (options.dueMax) {
      params.dueMax =
        options.dueMax instanceof Date
          ? options.dueMax.toISOString()
          : options.dueMax;
    }

    const response = await window.gapi.client.tasks.tasks.list(params);
    return response.result.items || [];
  } catch (error) {
    console.error("Error fetching tasks:", error);
    throw error;
  }
};

/**
 * Get a single task by ID
 * @param {string} taskListId - Task list ID
 * @param {string} taskId - Task ID
 * @returns {object} Task object
 */
export const getTask = async (taskListId, taskId) => {
  try {
    await getAccessToken();

    const response = await window.gapi.client.tasks.tasks.get({
      tasklist: taskListId,
      task: taskId,
    });

    return response.result;
  } catch (error) {
    console.error("Error getting task:", error);
    throw error;
  }
};

/**
 * Update a task's status (complete/incomplete)
 * @param {string} taskListId - Task list ID
 * @param {string} taskId - Task ID
 * @param {object} updates - Task updates (e.g., { status: "completed" })
 * @returns {object} Updated task object
 */
export const updateTask = async (taskListId, taskId, updates) => {
  try {
    await getAccessToken();

    // First get the current task to preserve other fields
    const currentTask = await getTask(taskListId, taskId);

    const updatedTask = {
      ...currentTask,
      ...updates,
    };

    // If marking as completed, set the completed timestamp
    if (updates.status === "completed" && !updatedTask.completed) {
      updatedTask.completed = new Date().toISOString();
    }
    // If marking as incomplete, remove the completed timestamp
    if (updates.status === "needsAction") {
      delete updatedTask.completed;
    }

    const response = await window.gapi.client.tasks.tasks.update({
      tasklist: taskListId,
      task: taskId,
      resource: updatedTask,
    });

    return response.result;
  } catch (error) {
    console.error("Error updating task:", error);
    throw error;
  }
};

/**
 * Fetch all tasks from all task lists within a date range
 * @param {Date} timeMin - Start of date range
 * @param {Date} timeMax - End of date range
 * @returns {array} Array of all tasks with their taskListId
 */
export const fetchAllTasks = async (timeMin, timeMax) => {
  try {
    const taskLists = await listTaskLists();
    const allTasks = [];

    for (const taskList of taskLists) {
      const tasks = await getTasks(taskList.id, {
        dueMin: timeMin,
        dueMax: timeMax,
        showCompleted: true,
      });

      // Add taskListId to each task for reference
      for (const task of tasks) {
        allTasks.push({
          ...task,
          taskListId: taskList.id,
          taskListTitle: taskList.title,
        });
      }
    }

    return allTasks;
  } catch (error) {
    console.error("Error fetching all tasks:", error);
    return [];
  }
};

// ============================================
// Connected Calendars Management
// ============================================

/**
 * Get connected calendars configuration
 */
export const getConnectedCalendars = () => {
  const calendars = extensionStorage.get(STORAGE_KEYS.CONNECTED_CALENDARS);
  if (!calendars) return [];

  const parsedCalendars = JSON.parse(calendars);

  // Ensure all calendars have the new properties (migration for existing users)
  return parsedCalendars.map((cal) => ({
    ...DEFAULT_CALENDAR_CONFIG,
    ...cal,
    // Ensure showAsSeparateTag defaults to false if not set
    showAsSeparateTag: cal.showAsSeparateTag ?? false,
  }));
};

/**
 * Save connected calendars configuration
 */
export const saveConnectedCalendars = (calendars) => {
  extensionStorage.set(
    STORAGE_KEYS.CONNECTED_CALENDARS,
    JSON.stringify(calendars)
  );
};

/**
 * Add a new connected calendar
 */
export const addConnectedCalendar = (calendarConfig) => {
  const calendars = getConnectedCalendars();
  // Ensure only one default
  if (calendarConfig.isDefault) {
    calendars.forEach((cal) => (cal.isDefault = false));
  }
  calendars.push({ ...DEFAULT_CALENDAR_CONFIG, ...calendarConfig });
  saveConnectedCalendars(calendars);
  return calendars;
};

/**
 * Update a connected calendar configuration
 */
export const updateConnectedCalendar = (calendarId, updates) => {
  const calendars = getConnectedCalendars();
  const index = calendars.findIndex((cal) => cal.id === calendarId);
  if (index !== -1) {
    // Ensure only one default
    if (updates.isDefault) {
      calendars.forEach((cal) => (cal.isDefault = false));
    }
    calendars[index] = { ...calendars[index], ...updates };
    saveConnectedCalendars(calendars);
  }
  return calendars;
};

/**
 * Remove a connected calendar
 */
export const removeConnectedCalendar = (calendarId) => {
  const calendars = getConnectedCalendars().filter(
    (cal) => cal.id !== calendarId
  );
  saveConnectedCalendars(calendars);
  return calendars;
};

/**
 * Find calendar by trigger tag or displayName
 * Checks displayName first (primary tag), then triggerTags (aliases)
 */
export const findCalendarByTag = (tagName) => {
  const calendars = getConnectedCalendars();
  const lowerTagName = tagName.toLowerCase();
  return calendars.find((cal) => {
    // Check displayName (primary tag for separate tags)
    if (cal.displayName && cal.displayName.toLowerCase() === lowerTagName) {
      return true;
    }
    // Check trigger tags (aliases)
    return cal.triggerTags.some((tag) => tag.toLowerCase() === lowerTagName);
  });
};

/**
 * Get default calendar
 */
export const getDefaultCalendar = () => {
  const calendars = getConnectedCalendars();
  return calendars.find((cal) => cal.isDefault) || calendars[0] || null;
};

// ============================================
// Sync Settings
// ============================================

/**
 * Get auto-sync setting
 */
export const getAutoSyncSetting = () => {
  return extensionStorage.get(STORAGE_KEYS.AUTO_SYNC) || "never";
};

/**
 * Set auto-sync setting
 */
export const setAutoSyncSetting = (value) => {
  extensionStorage.set(STORAGE_KEYS.AUTO_SYNC, value);
};

/**
 * Get sync interval in minutes
 */
export const getSyncInterval = () => {
  return extensionStorage.get(STORAGE_KEYS.SYNC_INTERVAL) || null;
};

/**
 * Set sync interval in minutes
 */
export const setSyncInterval = (minutes) => {
  extensionStorage.set(STORAGE_KEYS.SYNC_INTERVAL, minutes);
};

/**
 * Get whether to use original Google Calendar colors
 */
export const getUseOriginalColors = () => {
  return extensionStorage.get(STORAGE_KEYS.USE_ORIGINAL_COLORS) ?? false;
};

/**
 * Set whether to use original Google Calendar colors
 */
export const setUseOriginalColors = (enabled) => {
  extensionStorage.set(STORAGE_KEYS.USE_ORIGINAL_COLORS, enabled);
};

/**
 * Get checkbox format preference for Roam checkboxes
 * Returns "bracket" for [ ]/[x] or "roam" for [[TODO]]/[[DONE]]
 * Default is "roam"
 */
export const getCheckboxFormat = () => {
  return extensionStorage.get(STORAGE_KEYS.CHECKBOX_FORMAT) ?? "roam";
};

/**
 * Set checkbox format preference for Roam checkboxes
 */
export const setCheckboxFormat = (format) => {
  extensionStorage.set(STORAGE_KEYS.CHECKBOX_FORMAT, format);
};

// ============================================
// Connected Task Lists Management
// ============================================

/**
 * Check if Google Tasks integration is enabled
 */
export const getTasksEnabled = () => {
  return extensionStorage.get(STORAGE_KEYS.TASKS_ENABLED) ?? false;
};

/**
 * Enable or disable Google Tasks integration
 */
export const setTasksEnabled = (enabled) => {
  extensionStorage.set(STORAGE_KEYS.TASKS_ENABLED, enabled);
};

/**
 * Get connected task lists configuration
 */
export const getConnectedTaskLists = () => {
  const taskLists = extensionStorage.get(STORAGE_KEYS.CONNECTED_TASK_LISTS);
  if (!taskLists) return [];

  const parsedLists = JSON.parse(taskLists);

  // Ensure all task lists have the default properties
  return parsedLists.map((list) => ({
    ...DEFAULT_TASK_LIST_CONFIG,
    ...list,
    showAsSeparateTag: list.showAsSeparateTag ?? false,
  }));
};

/**
 * Save connected task lists configuration
 */
export const saveConnectedTaskLists = (taskLists) => {
  extensionStorage.set(
    STORAGE_KEYS.CONNECTED_TASK_LISTS,
    JSON.stringify(taskLists)
  );
};

/**
 * Update a connected task list configuration
 */
export const updateConnectedTaskList = (taskListId, updates) => {
  const taskLists = getConnectedTaskLists();
  const index = taskLists.findIndex((list) => list.id === taskListId);
  if (index !== -1) {
    taskLists[index] = { ...taskLists[index], ...updates };
    saveConnectedTaskLists(taskLists);
  }
  return taskLists;
};

/**
 * Initialize task list configs from available Google Task Lists
 * Creates default config for each list that doesn't have one
 */
export const initializeTaskListConfigs = (availableLists) => {
  const existingConfigs = getConnectedTaskLists();
  const existingIds = new Set(existingConfigs.map((c) => c.id));

  const newConfigs = [...existingConfigs];

  for (const list of availableLists) {
    if (!existingIds.has(list.id)) {
      newConfigs.push({
        ...DEFAULT_TASK_LIST_CONFIG,
        id: list.id,
        name: list.title,
        displayName: list.title,
        triggerTags: [list.title.toLowerCase()],
        syncEnabled: false, // Disabled by default - user must enable
      });
    }
  }

  // Remove configs for lists that no longer exist
  const availableIds = new Set(availableLists.map((l) => l.id));
  const filteredConfigs = newConfigs.filter((c) => availableIds.has(c.id));

  saveConnectedTaskLists(filteredConfigs);
  return filteredConfigs;
};

/**
 * Find task list by trigger tag or displayName
 */
export const findTaskListByTag = (tagName) => {
  const taskLists = getConnectedTaskLists();
  const lowerTagName = tagName.toLowerCase();
  return taskLists.find((list) => {
    // Check displayName (primary tag for separate tags)
    if (list.displayName && list.displayName.toLowerCase() === lowerTagName) {
      return true;
    }
    // Check trigger tags
    return list.triggerTags.some((tag) => tag.toLowerCase() === lowerTagName);
  });
};

export default {
  initGoogleCalendarService,
  isAuthenticated,
  getConnectionStatus,
  authenticate,
  signOut,
  silentRefresh,
  onAuthStateChange,
  getAccessToken,
  listCalendars,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEvent,
  // Google Tasks API
  listTaskLists,
  getTasks,
  getTask,
  updateTask,
  fetchAllTasks,
  // Connected Calendars
  getConnectedCalendars,
  saveConnectedCalendars,
  addConnectedCalendar,
  updateConnectedCalendar,
  removeConnectedCalendar,
  findCalendarByTag,
  getDefaultCalendar,
  getAutoSyncSetting,
  setAutoSyncSetting,
  getSyncInterval,
  setSyncInterval,
  getUseOriginalColors,
  setUseOriginalColors,
  getCheckboxFormat,
  setCheckboxFormat,
  // Connected Task Lists
  getTasksEnabled,
  setTasksEnabled,
  getConnectedTaskLists,
  saveConnectedTaskLists,
  updateConnectedTaskList,
  initializeTaskListConfigs,
  findTaskListByTag,
  // Constants
  STORAGE_KEYS,
  DEFAULT_CALENDAR_CONFIG,
  DEFAULT_TASK_LIST_CONFIG,
};
