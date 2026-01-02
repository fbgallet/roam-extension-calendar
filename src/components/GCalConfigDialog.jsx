import {
  Button,
  Callout,
  Card,
  Classes,
  Dialog,
  FormGroup,
  HTMLSelect,
  Icon,
  InputGroup,
  Spinner,
  Switch,
  Toaster,
  Position,
  Intent,
} from "@blueprintjs/core";
import { useState, useEffect } from "react";
import {
  authenticate,
  signOut,
  isAuthenticated,
  listCalendars,
  listTaskLists,
  getConnectedCalendars,
  saveConnectedCalendars,
  updateConnectedCalendar,
  getSyncInterval,
  setSyncInterval,
  getTasksEnabled,
  setTasksEnabled,
  getConnectedTaskLists,
  updateConnectedTaskList,
  initializeTaskListConfigs,
  getUseOriginalColors,
  setUseOriginalColors,
  getCheckboxFormat,
  setCheckboxFormat,
  getAutoTokenRefresh,
  setAutoTokenRefresh,
  DEFAULT_CALENDAR_CONFIG,
  DEFAULT_TASK_LIST_CONFIG,
  onAuthStateChange,
} from "../services/googleCalendarService";
import { initializeGCalTags, initializeGTaskTags, mapOfTags } from "../index";
import { getTagFromName } from "../models/EventTag";
import { updateStoredTags } from "../util/data";
import {
  getStorageStats,
  cleanupAllPastMetadata,
  clearAllSyncMetadata,
} from "../models/SyncMetadata";
import {
  deduplicateAllEvents,
  resetDeduplicationCooldown,
} from "../services/deduplicationService";
import { getEvents as getGCalEvents } from "../services/googleCalendarService";
import { invalidateAllEventsCache } from "../services/eventCacheService";

const GCalConfigDialog = ({ isOpen, onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [configChanged, setConfigChanged] = useState(false);

  // Toast helper
  const showToast = (message, intent = Intent.PRIMARY) => {
    const toaster = Toaster.create({ position: Position.TOP });
    toaster.show({ message, intent, timeout: 3000 });
  };

  // Calendars
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [calendarConfigs, setCalendarConfigs] = useState([]);

  // Task Lists
  const [tasksEnabled, setTasksEnabledState] = useState(false);
  const [availableTaskLists, setAvailableTaskLists] = useState([]);
  const [taskListConfigs, setTaskListConfigs] = useState([]);

  // Sync settings
  const [syncInterval, setSyncIntervalState] = useState(null);
  const [useOriginalColors, setUseOriginalColorsState] = useState(false);
  const [checkboxFormat, setCheckboxFormatState] = useState("roam");
  const [autoTokenRefresh, setAutoTokenRefreshState] = useState(true);

  // Deduplication preview
  const [dedupPreview, setDedupPreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Sync stats
  const [syncStats, setSyncStats] = useState({ eventCount: 0, todoCount: 0 });

  // Confirmation dialogs
  const [confirmReinitSync, setConfirmReinitSync] = useState(false);
  const [confirmClearCache, setConfirmClearCache] = useState(false);

  // Load initial state
  useEffect(() => {
    if (isOpen) {
      loadInitialState();
    }
  }, [isOpen]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (authenticated) => {
      setIsConnected(authenticated);
      if (authenticated) {
        // Mark as changed since connecting affects the calendar
        setConfigChanged(true);
        // Only fetch if dialog is open to avoid unnecessary API calls
        if (isOpen) {
          try {
            // Small delay to ensure GAPI client token is synchronized
            await new Promise((resolve) => setTimeout(resolve, 500));
            await fetchAvailableCalendars();
            await fetchAvailableTaskLists();
          } finally {
            setIsLoading(false);
          }
        }
      }
    });
    return unsubscribe;
  }, [isOpen]);

  const loadInitialState = async () => {
    setIsLoading(true);
    setError("");

    try {
      const authenticated = isAuthenticated();
      setIsConnected(authenticated);

      // Load calendar configs
      const calConfigs = getConnectedCalendars();
      setCalendarConfigs(calConfigs);

      // Load task list configs
      setTasksEnabledState(getTasksEnabled());
      const taskConfigs = getConnectedTaskLists();
      setTaskListConfigs(taskConfigs);

      setSyncIntervalState(getSyncInterval());
      setUseOriginalColorsState(getUseOriginalColors());
      setCheckboxFormatState(getCheckboxFormat());
      setAutoTokenRefreshState(getAutoTokenRefresh());

      // Load sync stats
      setSyncStats(getStorageStats());

      if (authenticated) {
        await fetchAvailableCalendars();
        await fetchAvailableTaskLists();
      }
    } catch (err) {
      setError("Failed to load configuration");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableCalendars = async (retryCount = 0) => {
    try {
      const calendars = await listCalendars();

      // Log calendar details for debugging
      // console.log("=== Google Calendars Data ===");
      // calendars.forEach((cal) => {
      //   console.log(`Calendar: "${cal.summaryOverride || cal.summary}"`);
      //   console.log(`  - id: ${cal.id}`);
      //   console.log(`  - summary: ${cal.summary}`);
      //   console.log(
      //     `  - summaryOverride: ${cal.summaryOverride || "(not set)"}`
      //   );
      //   console.log(`  - description: ${cal.description || "(not set)"}`);
      //   console.log(`  - owner: ${cal.owner?.email || "(not set)"}`);
      //   console.log(`  - backgroundColor: ${cal.backgroundColor}`);
      //   console.log(`  - primary: ${cal.primary || false}`);
      //   console.log("---");
      // });

      // Get user email from primary calendar
      const primaryCalendar = calendars.find((cal) => cal.primary);
      if (primaryCalendar) {
        setUserEmail(primaryCalendar.id);
      }

      setAvailableCalendars(calendars);
      setError(""); // Clear any previous errors

      // Initialize configs for any new calendars
      const existingConfigs = getConnectedCalendars();
      const existingIds = new Set(existingConfigs.map((c) => c.id));

      const newConfigs = [...existingConfigs];
      for (const cal of calendars) {
        if (!existingIds.has(cal.id)) {
          // Use summaryOverride if available (user's custom name), otherwise use summary (original name)
          const displayName = cal.summaryOverride || cal.summary;
          newConfigs.push({
            ...DEFAULT_CALENDAR_CONFIG,
            id: cal.id,
            name: cal.summary, // Store original name
            displayName: displayName, // Store user's display name
            triggerTags: [],
            syncEnabled: false, // Disabled by default
            isDefault: newConfigs.length === 0,
            backgroundColor: cal.backgroundColor || null,
          });
        } else {
          // Update backgroundColor and name for existing calendars
          // Preserve user's custom displayName if it exists
          const existingIndex = newConfigs.findIndex((c) => c.id === cal.id);
          if (existingIndex !== -1) {
            newConfigs[existingIndex].backgroundColor =
              cal.backgroundColor || null;
            newConfigs[existingIndex].name = cal.summary; // Update original name from Google
            // Only update displayName if it wasn't customized by the user
            // (i.e., if it still matches the old name or doesn't exist)
            if (
              !newConfigs[existingIndex].displayName ||
              newConfigs[existingIndex].displayName ===
                newConfigs[existingIndex].name
            ) {
              newConfigs[existingIndex].displayName =
                cal.summaryOverride || cal.summary;
            }
          }
        }
      }

      // Remove configs for calendars that no longer exist
      const availableIds = new Set(calendars.map((c) => c.id));
      const filteredConfigs = newConfigs.filter((c) => availableIds.has(c.id));

      saveConnectedCalendars(filteredConfigs);
      setCalendarConfigs(filteredConfigs);
    } catch (err) {
      console.error("Failed to fetch calendars:", err);

      // Retry up to 2 times with exponential backoff (after fresh auth, token might not be ready)
      if (retryCount < 2) {
        const delay = (retryCount + 1) * 1000; // 1s, then 2s
        console.log(
          `Retrying calendar fetch in ${delay}ms... (attempt ${
            retryCount + 1
          }/2)`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchAvailableCalendars(retryCount + 1);
      }

      setError("Failed to fetch calendars from Google");
    }
  };

  const fetchAvailableTaskLists = async () => {
    try {
      const taskLists = await listTaskLists();
      setAvailableTaskLists(taskLists);

      // Initialize task list configs
      const updatedConfigs = initializeTaskListConfigs(taskLists);
      setTaskListConfigs(updatedConfigs);
    } catch (err) {
      console.error("Failed to fetch task lists:", err);
      // Don't show error for task lists - they may not have permission yet
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError("");

    try {
      await authenticate();
      // The onAuthStateChange listener will handle fetching calendars and stopping the spinner
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      // Check if the error might be due to popup blocking
      const errorMessage = err?.message || "";
      if (errorMessage.includes("popup") || errorMessage.includes("blocked")) {
        setError(
          "Connection failed. Please check if your browser is blocking popups (look for an icon in the address bar)."
        );
      } else {
        setError(
          "Failed to connect to Google. If you don't see a popup window, please check if your browser is blocking popups."
        );
      }
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError("");

    try {
      await signOut();
      setIsConnected(false);
      setUserEmail("");
      setAvailableCalendars([]);
      setAvailableTaskLists([]);
      setConfigChanged(true);
    } catch (err) {
      setError("Failed to disconnect");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalendarConfigChange = (calendarId, updates) => {
    setConfigChanged(true);

    let finalConfigs;

    // Handle default calendar - only one can be default
    if (updates.isDefault === true) {
      finalConfigs = calendarConfigs.map((cal) => ({
        ...cal,
        isDefault: cal.id === calendarId,
      }));
      saveConnectedCalendars(finalConfigs);
      setCalendarConfigs(finalConfigs);
    } else {
      const updated = updateConnectedCalendar(calendarId, updates);

      // If syncEnabled is being changed, check if we need to auto-set default
      if (updates.hasOwnProperty('syncEnabled')) {
        const enabledCalendars = updated.filter(cal => cal.syncEnabled);

        // If only one calendar is enabled, automatically set it as default
        if (enabledCalendars.length === 1) {
          finalConfigs = updated.map((cal) => ({
            ...cal,
            isDefault: cal.syncEnabled,
          }));
          saveConnectedCalendars(finalConfigs);
          setCalendarConfigs(finalConfigs);
        } else {
          finalConfigs = updated;
          setCalendarConfigs(updated);
        }
      } else {
        finalConfigs = updated;
        setCalendarConfigs(updated);
      }
    }
    // Pass calendars directly to avoid async storage timing issues
    initializeGCalTags(finalConfigs);
  };

  const handleTasksEnabledChange = (enabled) => {
    setConfigChanged(true);
    setTasksEnabledState(enabled);
    setTasksEnabled(enabled);
    if (enabled) {
      // Pass current task list configs directly
      initializeGTaskTags(taskListConfigs);
    }
  };

  const handleTaskListConfigChange = (taskListId, updates) => {
    setConfigChanged(true);
    const updated = updateConnectedTaskList(taskListId, updates);
    setTaskListConfigs(updated);
    // Pass updated task lists directly to avoid async storage timing issues
    initializeGTaskTags(updated);
  };

  const handleSyncIntervalChange = (value) => {
    const interval = value === "manual" ? null : parseInt(value);
    setSyncIntervalState(interval);
    setSyncInterval(interval);
  };

  const handleCleanupPastEvents = () => {
    const result = cleanupAllPastMetadata();
    setSyncStats(getStorageStats());
    if (result.removedCount > 0) {
      console.log(`Cleaned up ${result.removedCount} past event sync entries`);
      showToast(`Cleaned up ${result.removedCount} past event sync entries`, Intent.SUCCESS);
    } else {
      showToast("No past events to clean up", Intent.PRIMARY);
    }
  };

  const handleReinitializeSync = () => {
    setConfirmReinitSync(true);
  };

  const handleConfirmReinitializeSync = () => {
    clearAllSyncMetadata();
    setSyncStats(getStorageStats());
    console.log("All sync metadata has been cleared");
    showToast("All sync metadata has been cleared", Intent.SUCCESS);
    setConfirmReinitSync(false);
  };

  // Scan for duplicates and show preview
  const handleScanForDuplicates = async () => {
    setIsScanning(true);
    try {
      const duplicatesToRemove = [];
      let totalScanned = 0;

      // Get date range - check available cache to determine range
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      const calendarNames = [];
      const connectedCalendars = calendarConfigs;

      for (const calendar of connectedCalendars) {
        if (!calendar.syncEnabled) continue;

        calendarNames.push(calendar.displayName || calendar.name);

        console.log(`[Dedup] Scanning calendar: ${calendar.displayName || calendar.name}`);

        try {
          // Fetch events for this calendar
          const events = await getGCalEvents(calendar.id, startDate, endDate);

          if (!events || events.length === 0) {
            console.log(`[Dedup] No events found in ${calendar.displayName || calendar.name}`);
            continue;
          }

          totalScanned += events.length;

          // Find duplicates without removing them
          const processedIds = new Set();

          for (const targetEvent of events) {
            if (processedIds.has(targetEvent.id)) continue;
            processedIds.add(targetEvent.id);

            // Import deduplication functions inline to find duplicates
            const { findDuplicatesForEvent, getDuplicatesToRemove, isEventSyncedToRoam } = await import("../services/deduplicationService");

            const duplicates = findDuplicatesForEvent(targetEvent, events);
            if (duplicates.length === 0) continue;

            const targetIsSynced = isEventSyncedToRoam(targetEvent);
            const toRemove = getDuplicatesToRemove(targetEvent, duplicates, targetIsSynced);

            // Mark as processed
            toRemove.forEach((evt) => processedIds.add(evt.id));

            // Collect for preview
            toRemove.forEach((evt) => {
              duplicatesToRemove.push({
                event: evt,
                calendar: calendar.displayName || calendar.name,
                calendarId: calendar.id,
                keptEvent: targetEvent.summary,
                keptEventIsSynced: targetIsSynced,
              });
            });
          }
        } catch (error) {
          console.error(`[Dedup] Error scanning calendar ${calendar.name}:`, error);
        }
      }

      setDedupPreview({
        duplicates: duplicatesToRemove,
        dateRange: {
          start: startDate,
          end: endDate,
        },
        calendars: calendarNames,
        totalScanned,
      });
    } catch (error) {
      console.error("[Dedup] Failed to scan for duplicates:", error);
      showToast(`Failed to scan for duplicates: ${error.message}`, Intent.DANGER);
    } finally {
      setIsScanning(false);
    }
  };

  // Actually remove duplicates after preview confirmation
  const handleConfirmRemoveDuplicates = async () => {
    if (!dedupPreview) return;

    setIsLoading(true);
    try {
      let totalRemoved = 0;
      const errors = [];

      // Group duplicates by calendar
      const byCalendar = new Map();
      for (const dup of dedupPreview.duplicates) {
        if (!byCalendar.has(dup.calendarId)) {
          byCalendar.set(dup.calendarId, []);
        }
        byCalendar.get(dup.calendarId).push(dup.event);
      }

      // Remove duplicates calendar by calendar
      for (const [calendarId, events] of byCalendar) {
        try {
          const { removeDuplicateEvents } = await import("../services/deduplicationService");
          const result = await removeDuplicateEvents(calendarId, events);
          totalRemoved += result.removed;

          if (result.failed > 0) {
            const calendar = calendarConfigs.find((c) => c.id === calendarId);
            errors.push(`${calendar?.displayName || calendar?.name || calendarId}: ${result.failed} failed`);
          }
        } catch (error) {
          console.error(`[Dedup] Error removing duplicates from ${calendarId}:`, error);
          errors.push(`${calendarId}: ${error.message}`);
        }
      }

      // Reset cooldown and invalidate cache
      resetDeduplicationCooldown();
      invalidateAllEventsCache();

      // Show results
      console.log(`[Dedup] ✅ Removed ${totalRemoved} duplicates`);

      if (errors.length > 0) {
        showToast(
          `Removed ${totalRemoved} duplicates but ${errors.length} error(s) occurred`,
          Intent.WARNING
        );
      } else {
        showToast(`Removed ${totalRemoved} duplicate events`, Intent.SUCCESS);
      }

      // Close preview
      setDedupPreview(null);
    } catch (error) {
      console.error("[Dedup] Failed to remove duplicates:", error);
      showToast(`Failed to remove duplicates: ${error.message}`, Intent.DANGER);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear cache
  const handleClearCache = () => {
    setConfirmClearCache(true);
  };

  const handleConfirmClearCache = () => {
    try {
      invalidateAllEventsCache();
      console.log("[Cache] Cleared all cached events");
      showToast("Cache cleared successfully", Intent.SUCCESS);
      setConfirmClearCache(false);
    } catch (error) {
      console.error("[Cache] Failed to clear cache:", error);
      showToast(`Failed to clear cache: ${error.message}`, Intent.DANGER);
      setConfirmClearCache(false);
    }
  };

  const handleUseOriginalColorsChange = (enabled) => {
    setConfigChanged(true);
    setUseOriginalColorsState(enabled);
    setUseOriginalColors(enabled);

    // When enabled, update GCal-related tag colors to use the original calendar colors
    if (enabled) {
      const calendars = getConnectedCalendars();
      let tagsUpdated = false;
      let defaultCalendarColor = null;

      for (const calendarConfig of calendars) {
        if (!calendarConfig.syncEnabled || !calendarConfig.backgroundColor)
          continue;

        if (calendarConfig.showAsSeparateTag) {
          // Update the separate tag's color
          const tagName = calendarConfig.displayName || calendarConfig.name;
          const tag = getTagFromName(tagName);
          if (tag) {
            tag.setColor(calendarConfig.backgroundColor);
            tagsUpdated = true;
          }
        } else if (calendarConfig.isDefault) {
          // Store the default calendar's color for the main tag
          defaultCalendarColor = calendarConfig.backgroundColor;
        }
      }

      // Update the main "Google calendar" tag's color with the default calendar's color
      if (defaultCalendarColor) {
        const mainGCalTag = getTagFromName("Google calendar");
        if (mainGCalTag) {
          mainGCalTag.setColor(defaultCalendarColor);
          tagsUpdated = true;
        }
      }

      // Persist tag colors if any were updated
      if (tagsUpdated) {
        updateStoredTags(mapOfTags);
      }
    }
  };

  const handleCheckboxFormatChange = (format) => {
    setCheckboxFormatState(format);
    setCheckboxFormat(format);
  };

  const handleAutoTokenRefreshChange = (enabled) => {
    setAutoTokenRefreshState(enabled);
    setAutoTokenRefresh(enabled);

    if (enabled) {
      showToast("Auto token refresh enabled. Connection will be maintained automatically.", Intent.SUCCESS);
    } else {
      showToast("Auto token refresh disabled. You may need to reconnect after 1 hour of inactivity.", Intent.WARNING);
    }
  };

  const handleClose = () => {
    // Always pass options object, with shouldRemountCalendar flag
    onClose({ shouldRemountCalendar: configChanged });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Google Integration"
      icon="cloud"
      className="fc-gcal-config-dialog"
      style={{ width: "750px" }}
    >
      <div className={Classes.DIALOG_BODY}>
        {isLoading && (
          <div className="fc-gcal-loading">
            <Spinner size={30} />
          </div>
        )}

        {error && (
          <Callout
            intent="danger"
            icon="error"
            style={{ marginBottom: "15px" }}
          >
            {error}
          </Callout>
        )}

        {/* Connection Status */}
        <Card style={{ marginBottom: "20px" }}>
          <div className="fc-gcal-connection-status">
            <div>
              <Icon
                icon={isConnected ? "tick-circle" : "circle"}
                intent={isConnected ? "success" : "none"}
                style={{ marginRight: "8px" }}
              />
              <strong>
                {isConnected ? "Connected to Google" : "Not connected"}
                {isConnected && userEmail && (
                  <span style={{ fontWeight: "normal", color: "#5c7080" }}>
                    {" "}
                    ({userEmail})
                  </span>
                )}
              </strong>
            </div>
            <Button
              intent={isConnected ? "none" : "primary"}
              onClick={isConnected ? handleDisconnect : handleConnect}
              disabled={isLoading}
              icon={isConnected ? "log-out" : "log-in"}
            >
              {isConnected ? "Disconnect" : "Connect to Google"}
            </Button>
          </div>
        </Card>

        {isConnected && (
          <>
            {/* CALENDARS SECTION */}
            <h4 style={{ marginBottom: "12px" }}>Calendars</h4>
            <CalendarsTable
              calendars={availableCalendars}
              configs={calendarConfigs}
              onConfigChange={handleCalendarConfigChange}
            />

            <FormGroup
              label="Use original colors"
              helperText="Display events with their original Google Calendar colors. Disable to use the color picker."
              inline
              style={{ marginTop: "15px" }}
            >
              <Switch
                checked={useOriginalColors}
                onChange={(e) =>
                  handleUseOriginalColorsChange(e.target.checked)
                }
                style={{ marginBottom: 0 }}
              />
            </FormGroup>

            <FormGroup
              label="Checkbox format"
              helperText="Choose the checkbox format to use in Google Calendar event titles when syncing with Roam."
              inline
              style={{ marginTop: "15px" }}
            >
              <HTMLSelect
                value={checkboxFormat}
                onChange={(e) => handleCheckboxFormatChange(e.target.value)}
                options={[
                  { value: "roam", label: "[[TODO]]/[[DONE]]" },
                  { value: "bracket", label: "[ ]/[x]" },
                ]}
              />
            </FormGroup>

            {/* TASK LISTS SECTION */}
            <div style={{ marginTop: "30px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <h4 style={{ margin: 0 }}>Task Lists</h4>
                <Switch
                  checked={tasksEnabled}
                  onChange={(e) => handleTasksEnabledChange(e.target.checked)}
                  style={{ marginLeft: "15px", marginBottom: 0 }}
                  label="Enable Tasks"
                />
              </div>

              <div
                style={{
                  opacity: tasksEnabled ? 1 : 0.4,
                  pointerEvents: tasksEnabled ? "auto" : "none",
                }}
              >
                <Callout
                  intent="warning"
                  icon="warning-sign"
                  style={{ marginBottom: "15px" }}
                >
                  <strong>Note:</strong> Recurring tasks are not supported by
                  the Google Tasks API. Only the initial task instance will be
                  displayed. For recurring items, use recurring events in Google
                  Calendar instead.
                </Callout>
                <TaskListsTable
                  taskLists={availableTaskLists}
                  configs={taskListConfigs}
                  onConfigChange={handleTaskListConfigChange}
                />
              </div>
            </div>

            {/* SYNC SETTINGS */}
            <h4 style={{ marginBottom: "10px", marginTop: "30px" }}>
              Sync Settings
            </h4>
            <Card>
              <FormGroup
                label="Check for updates"
                helperText="How often to check Google for updates"
                inline
              >
                <HTMLSelect
                  value={
                    syncInterval === null ? "manual" : syncInterval.toString()
                  }
                  onChange={(e) => handleSyncIntervalChange(e.target.value)}
                  options={[
                    { value: "manual", label: "Manual only" },
                    { value: "5", label: "Every 5 minutes" },
                    { value: "15", label: "Every 15 minutes" },
                    { value: "30", label: "Every 30 minutes" },
                  ]}
                />
              </FormGroup>

              <FormGroup
                label="Auto-refresh connection"
                helperText="Automatically maintain Google Calendar connection. Disable if you experience unwanted popups."
                inline
                style={{ marginTop: "15px" }}
              >
                <Switch
                  checked={autoTokenRefresh}
                  onChange={(e) =>
                    handleAutoTokenRefreshChange(e.target.checked)
                  }
                  style={{ marginBottom: 0 }}
                />
              </FormGroup>
            </Card>

            {/* SYNC DATA MANAGEMENT */}
            <h4 style={{ marginBottom: "10px", marginTop: "30px" }}>
              Sync Data
            </h4>
            <Card>
              <div style={{ marginBottom: "15px" }}>
                <strong>Synced events: </strong>
                {syncStats.eventCount}
                {syncStats.todoCount > 0 && (
                  <span style={{ color: "#5c7080" }}>
                    {" "}
                    ({syncStats.todoCount} pending TODOs)
                  </span>
                )}
                <span
                  style={{
                    color: "#5c7080",
                    fontSize: "12px",
                    marginLeft: "10px",
                  }}
                >
                  (~{Math.round(syncStats.estimatedBytes / 1024)} KB)
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Button
                  icon="trash"
                  intent="none"
                  onClick={handleCleanupPastEvents}
                  disabled={syncStats.eventCount === 0}
                  small
                >
                  Unsync past events
                </Button>
                <Button
                  icon="duplicate"
                  intent="warning"
                  onClick={handleScanForDuplicates}
                  disabled={isScanning || !isConnected}
                  loading={isScanning}
                  small
                >
                  {isScanning ? "Scanning..." : "Remove duplicates"}
                </Button>
                <Button
                  icon="reset"
                  intent="danger"
                  onClick={handleReinitializeSync}
                  disabled={syncStats.eventCount === 0}
                  small
                >
                  Reinitialize sync
                </Button>
              </div>
              <p
                style={{
                  fontSize: "12px",
                  color: "#5c7080",
                  marginTop: "10px",
                  marginBottom: 0,
                }}
              >
                "Unsync past events" removes sync data for completed events.
                "Remove duplicates" scans for and removes duplicate Google Calendar events.
                "Reinitialize sync" clears all sync connections.
              </p>
            </Card>

            {/* MAINTENANCE */}
            <h4 style={{ marginBottom: "10px", marginTop: "30px" }}>
              Maintenance
            </h4>
            <Card>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Button
                  icon="clean"
                  intent="none"
                  onClick={handleClearCache}
                  small
                >
                  Clear cache
                </Button>
              </div>
              <p
                style={{
                  fontSize: "12px",
                  color: "#5c7080",
                  marginTop: "10px",
                  marginBottom: 0,
                }}
              >
                "Clear cache" removes local cached event data. Your Roam blocks and Google Calendar events will NOT be affected. The calendar will reload more slowly on the next view until the cache rebuilds.
              </p>
            </Card>
          </>
        )}
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={handleClose}>Close</Button>
        </div>
      </div>

      {/* Deduplication Preview Dialog */}
      {dedupPreview && (
        <Dialog
          isOpen={true}
          onClose={() => setDedupPreview(null)}
          title="Duplicate Events Found"
          style={{ width: "600px", maxHeight: "80vh" }}
        >
          <div className={Classes.DIALOG_BODY} style={{ overflowY: "auto" }}>
            <Callout intent="warning" icon="warning-sign" style={{ marginBottom: "15px" }}>
              <strong>Warning:</strong> This will permanently delete {dedupPreview.duplicates.length} duplicate event(s) from Google Calendar.
              <div style={{ marginTop: "8px", fontSize: "12px" }}>
                <strong>Date range scanned:</strong>{" "}
                {dedupPreview.dateRange.start.toLocaleDateString()} to{" "}
                {dedupPreview.dateRange.end.toLocaleDateString()}
                <br />
                <strong>Calendars:</strong> {dedupPreview.calendars.join(", ")}
                <br />
                <strong>Total events scanned:</strong> {dedupPreview.totalScanned}
              </div>
            </Callout>

            {dedupPreview.duplicates.length === 0 ? (
              <Callout intent="success" icon="tick">
                No duplicates found! Your calendars are clean.
              </Callout>
            ) : (
              <>
                <p style={{ marginBottom: "10px", fontWeight: "bold" }}>
                  Events to be deleted ({dedupPreview.duplicates.length}):
                </p>
                <div
                  style={{
                    maxHeight: "400px",
                    overflowY: "auto",
                    border: "1px solid #ddd",
                    borderRadius: "3px",
                  }}
                >
                  {dedupPreview.duplicates.map((dup, index) => (
                    <Card
                      key={index}
                      style={{
                        margin: "8px",
                        padding: "10px",
                        backgroundColor: "#fff9e6",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "start", gap: "8px" }}>
                        <Icon icon="trash" intent="warning" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                            {dup.event.summary}
                          </div>
                          <div style={{ fontSize: "12px", color: "#5c7080" }}>
                            {new Date(dup.event.start?.dateTime || dup.event.start?.date).toLocaleString()}
                          </div>
                          <div style={{ fontSize: "11px", color: "#738694", marginTop: "4px" }}>
                            <strong>Calendar:</strong> {dup.calendar}
                            <br />
                            <strong>Keeping:</strong> "{dup.keptEvent}"
                            {dup.keptEventIsSynced && (
                              <span style={{ color: "#0f9960" }}> (synced to Roam)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={Classes.DIALOG_FOOTER}>
            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
              <Button onClick={() => setDedupPreview(null)}>Cancel</Button>
              {dedupPreview.duplicates.length > 0 && (
                <Button
                  intent="danger"
                  onClick={handleConfirmRemoveDuplicates}
                  disabled={isLoading}
                  loading={isLoading}
                >
                  {isLoading ? "Deleting..." : `Delete ${dedupPreview.duplicates.length} Duplicate(s)`}
                </Button>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {/* Reinitialize Sync Confirmation Dialog */}
      <Dialog
        isOpen={confirmReinitSync}
        onClose={() => setConfirmReinitSync(false)}
        title="Reinitialize Sync?"
        icon="warning-sign"
        style={{ width: "500px" }}
      >
        <div className={Classes.DIALOG_BODY}>
          <Callout intent="warning" icon="warning-sign">
            <p>
              This will remove <strong>ALL</strong> sync metadata.
            </p>
            <p>
              Events will remain in both Roam and Google Calendar, but sync
              connections will be lost. You'll need to resync events manually.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>This action cannot be undone.</strong>
            </p>
          </Callout>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={() => setConfirmReinitSync(false)}>Cancel</Button>
            <Button
              intent="danger"
              onClick={handleConfirmReinitializeSync}
            >
              Reinitialize Sync
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Clear Cache Confirmation Dialog */}
      <Dialog
        isOpen={confirmClearCache}
        onClose={() => setConfirmClearCache(false)}
        title="Clear Cache?"
        icon="clean"
        style={{ width: "500px" }}
      >
        <div className={Classes.DIALOG_BODY}>
          <Callout intent="primary" icon="info-sign">
            <p>
              This will clear all cached event data from local storage.
            </p>
            <p>
              Your Roam blocks and Google Calendar events will <strong>NOT</strong> be affected.
            </p>
            <p style={{ marginBottom: 0 }}>
              The calendar will reload more slowly on the next view until the cache rebuilds.
            </p>
          </Callout>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={() => setConfirmClearCache(false)}>Cancel</Button>
            <Button
              intent="primary"
              onClick={handleConfirmClearCache}
            >
              Clear Cache
            </Button>
          </div>
        </div>
      </Dialog>
    </Dialog>
  );
};

/**
 * Table component for calendars configuration
 */
const CalendarsTable = ({ calendars, configs, onConfigChange }) => {
  // Merge calendars with their configs
  const rows = calendars.map((cal) => {
    const config = configs.find((c) => c.id === cal.id) || {
      ...DEFAULT_CALENDAR_CONFIG,
      id: cal.id,
      name: cal.summary,
    };
    return { ...cal, config };
  });

  // Sort calendars: enabled ones first, then disabled ones, then alphabetically
  rows.sort((a, b) => {
    // Sort by enabled status
    if (a.config.syncEnabled && !b.config.syncEnabled) return -1;
    if (!a.config.syncEnabled && b.config.syncEnabled) return 1;

    // Then sort alphabetically by name
    const nameA = a.summaryOverride || a.summary;
    const nameB = b.summaryOverride || b.summary;
    return nameA.localeCompare(nameB);
  });

  if (rows.length === 0) {
    return (
      <Callout intent="primary" icon="info-sign">
        No calendars found. Make sure you have calendars in your Google account.
      </Callout>
    );
  }

  return (
    <div className="fc-config-table-wrapper">
      <table className="fc-config-table">
        <thead>
          <tr>
            <th style={{ width: "55px" }}>Enable</th>
            <th style={{ width: "160px" }}>Name</th>
            <th style={{ width: "140px" }}>Tags</th>
            <th style={{ width: "55px" }}>Default</th>
            <th style={{ width: "75px" }}>Separate</th>
            <th style={{ width: "110px" }}>Sync</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <CalendarRow
              key={row.id}
              calendar={row}
              config={row.config}
              onConfigChange={onConfigChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Single row in the calendars table
 */
const CalendarRow = ({ calendar, config, onConfigChange }) => {
  const [tagsStr, setTagsStr] = useState((config.triggerTags || []).join(", "));
  const [displayName, setDisplayName] = useState(
    config.displayName || config.name || calendar.summary
  );
  const [isEditingName, setIsEditingName] = useState(false);

  // Update displayName when config changes
  useEffect(() => {
    setDisplayName(config.displayName || config.name || calendar.summary);
  }, [config.displayName, config.name, calendar.summary]);

  const handleTagsConfirm = () => {
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    onConfigChange(calendar.id, { triggerTags: tags });
  };

  const handleNameConfirm = () => {
    setIsEditingName(false);
    const trimmedName = displayName.trim();
    if (trimmedName && trimmedName !== config.displayName) {
      onConfigChange(calendar.id, { displayName: trimmedName });
    } else if (!trimmedName) {
      // Reset to original if empty
      const fallbackName = config.name || calendar.summary;
      setDisplayName(fallbackName);
      onConfigChange(calendar.id, { displayName: fallbackName });
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter") {
      handleNameConfirm();
    } else if (e.key === "Escape") {
      setDisplayName(config.displayName || config.name || calendar.summary);
      setIsEditingName(false);
    }
  };

  return (
    <tr className={config.syncEnabled ? "" : "fc-row-disabled"}>
      <td>
        <Switch
          checked={config.syncEnabled}
          onChange={(e) =>
            onConfigChange(calendar.id, { syncEnabled: e.target.checked })
          }
          style={{ marginBottom: 0 }}
        />
      </td>
      <td>
        <div className="fc-cell-name">
          <span
            className="fc-color-dot"
            style={{ backgroundColor: calendar.backgroundColor }}
          />
          {isEditingName ? (
            <InputGroup
              small
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={handleNameConfirm}
              onKeyDown={handleNameKeyDown}
              autoFocus
              className="fc-name-input"
              style={{ width: "100%" }}
            />
          ) : (
            <span
              className="fc-name-text"
              title={`ID: ${calendar.id}\nClick to edit display name`}
              onClick={() => setIsEditingName(true)}
              style={{ cursor: "text" }}
            >
              {config.displayName || config.name || calendar.summary}
            </span>
          )}
        </div>
      </td>
      <td>
        <InputGroup
          small
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
          onBlur={handleTagsConfirm}
          placeholder="tag1, tag2"
          disabled={!config.syncEnabled}
          className="fc-tags-input"
        />
      </td>
      <td>
        <Switch
          checked={config.isDefault || false}
          onChange={(e) =>
            onConfigChange(calendar.id, { isDefault: e.target.checked })
          }
          disabled={!config.syncEnabled}
          style={{ marginBottom: 0 }}
        />
      </td>
      <td>
        <Switch
          checked={config.showAsSeparateTag || false}
          onChange={(e) =>
            onConfigChange(calendar.id, { showAsSeparateTag: e.target.checked })
          }
          disabled={!config.syncEnabled}
          style={{ marginBottom: 0 }}
        />
      </td>
      <td>
        <HTMLSelect
          small
          value={config.syncDirection || "both"}
          onChange={(e) =>
            onConfigChange(calendar.id, { syncDirection: e.target.value })
          }
          disabled={!config.syncEnabled}
          options={[
            { value: "both", label: "Both" },
            { value: "import", label: "Import" },
            { value: "export", label: "Export" },
          ]}
          className="fc-sync-select"
        />
      </td>
    </tr>
  );
};

/**
 * Table component for task lists configuration
 */
const TaskListsTable = ({ taskLists, configs, onConfigChange }) => {
  // Merge task lists with their configs
  const rows = taskLists.map((list) => {
    const config = configs.find((c) => c.id === list.id) || {
      ...DEFAULT_TASK_LIST_CONFIG,
      id: list.id,
      name: list.title,
    };
    return { ...list, config };
  });

  if (rows.length === 0) {
    return (
      <Callout intent="primary" icon="info-sign">
        No task lists found. Make sure you have task lists in Google Tasks.
      </Callout>
    );
  }

  return (
    <div className="fc-config-table-wrapper">
      <table className="fc-config-table">
        <thead>
          <tr>
            <th style={{ width: "55px" }}>Enable</th>
            <th style={{ width: "180px" }}>Name</th>
            <th style={{ width: "180px" }}>Tags</th>
            <th style={{ width: "75px" }}>Separate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TaskListRow
              key={row.id}
              taskList={row}
              config={row.config}
              onConfigChange={onConfigChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Single row in the task lists table
 */
const TaskListRow = ({ taskList, config, onConfigChange }) => {
  const [tagsStr, setTagsStr] = useState((config.triggerTags || []).join(", "));

  const handleTagsConfirm = () => {
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    onConfigChange(taskList.id, { triggerTags: tags });
  };

  return (
    <tr className={config.syncEnabled ? "" : "fc-row-disabled"}>
      <td>
        <Switch
          checked={config.syncEnabled}
          onChange={(e) =>
            onConfigChange(taskList.id, { syncEnabled: e.target.checked })
          }
          style={{ marginBottom: 0 }}
        />
      </td>
      <td>
        <div className="fc-cell-name">
          <Icon
            icon="tick"
            size={12}
            style={{ marginRight: "6px", opacity: 0.5 }}
          />
          <span className="fc-name-text" title={taskList.title}>
            {taskList.title}
          </span>
        </div>
      </td>
      <td>
        <InputGroup
          small
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
          onBlur={handleTagsConfirm}
          placeholder={taskList.title.toLowerCase()}
          disabled={!config.syncEnabled}
          className="fc-tags-input"
        />
      </td>
      <td>
        <Switch
          checked={config.showAsSeparateTag || false}
          onChange={(e) =>
            onConfigChange(taskList.id, { showAsSeparateTag: e.target.checked })
          }
          disabled={!config.syncEnabled}
          style={{ marginBottom: 0 }}
        />
      </td>
    </tr>
  );
};

export default GCalConfigDialog;
