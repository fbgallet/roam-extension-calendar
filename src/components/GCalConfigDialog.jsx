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

const GCalConfigDialog = ({ isOpen, onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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

  // Sync stats
  const [syncStats, setSyncStats] = useState({ eventCount: 0, todoCount: 0 });

  // Load initial state
  useEffect(() => {
    if (isOpen) {
      loadInitialState();
    }
  }, [isOpen]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((authenticated) => {
      setIsConnected(authenticated);
      if (authenticated) {
        fetchAvailableCalendars();
        fetchAvailableTaskLists();
      }
    });
    return unsubscribe;
  }, []);

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

  const fetchAvailableCalendars = async () => {
    try {
      const calendars = await listCalendars();
      setAvailableCalendars(calendars);

      // Initialize configs for any new calendars
      const existingConfigs = getConnectedCalendars();
      const existingIds = new Set(existingConfigs.map((c) => c.id));

      const newConfigs = [...existingConfigs];
      for (const cal of calendars) {
        if (!existingIds.has(cal.id)) {
          newConfigs.push({
            ...DEFAULT_CALENDAR_CONFIG,
            id: cal.id,
            name: cal.summary,
            displayName: cal.summary,
            triggerTags: [],
            syncEnabled: false, // Disabled by default
            isDefault: newConfigs.length === 0,
            backgroundColor: cal.backgroundColor || null,
          });
        } else {
          // Update backgroundColor for existing calendars
          const existingIndex = newConfigs.findIndex((c) => c.id === cal.id);
          if (existingIndex !== -1) {
            newConfigs[existingIndex].backgroundColor =
              cal.backgroundColor || null;
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
      setIsConnected(true);
      await fetchAvailableCalendars();
      await fetchAvailableTaskLists();
    } catch (err) {
      setError("Failed to connect to Google");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError("");

    try {
      await signOut();
      setIsConnected(false);
      setAvailableCalendars([]);
      setAvailableTaskLists([]);
    } catch (err) {
      setError("Failed to disconnect");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalendarConfigChange = (calendarId, updates) => {
    // Handle default calendar - only one can be default
    if (updates.isDefault === true) {
      const updatedConfigs = calendarConfigs.map((cal) => ({
        ...cal,
        isDefault: cal.id === calendarId,
      }));
      saveConnectedCalendars(updatedConfigs);
      setCalendarConfigs(updatedConfigs);
    } else {
      const updated = updateConnectedCalendar(calendarId, updates);
      setCalendarConfigs(updated);
    }
    initializeGCalTags();
  };

  const handleTasksEnabledChange = (enabled) => {
    setTasksEnabledState(enabled);
    setTasksEnabled(enabled);
    if (enabled) {
      initializeGTaskTags();
    }
  };

  const handleTaskListConfigChange = (taskListId, updates) => {
    const updated = updateConnectedTaskList(taskListId, updates);
    setTaskListConfigs(updated);
    initializeGTaskTags();
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
    }
  };

  const handleReinitializeSync = () => {
    if (
      window.confirm(
        "This will remove ALL sync metadata. Events will remain in both Roam and Google Calendar, but sync connections will be lost. Continue?"
      )
    ) {
      clearAllSyncMetadata();
      setSyncStats(getStorageStats());
      console.log("All sync metadata has been cleared");
    }
  };

  const handleUseOriginalColorsChange = (enabled) => {
    setUseOriginalColorsState(enabled);
    setUseOriginalColors(enabled);

    // When enabled, update GCal-related tag colors to use the original calendar colors
    if (enabled) {
      const calendars = getConnectedCalendars();
      let tagsUpdated = false;

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
        } else {
          // Update the main "Google calendar" tag's color
          // Use the first enabled calendar's color as the default
          const mainGCalTag = getTagFromName("Google calendar");
          if (mainGCalTag && !mainGCalTag._originalColorSet) {
            mainGCalTag.setColor(calendarConfig.backgroundColor);
            mainGCalTag._originalColorSet = true; // Only set once (first enabled calendar)
            tagsUpdated = true;
          }
        }
      }

      // Reset the flag for next time
      const mainGCalTag = getTagFromName("Google calendar");
      if (mainGCalTag) {
        delete mainGCalTag._originalColorSet;
      }

      // Persist tag colors if any were updated
      if (tagsUpdated) {
        updateStoredTags(mapOfTags);
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
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
                  style={{ color: "#5c7080", fontSize: "12px", marginLeft: "10px" }}
                >
                  (~{Math.round(syncStats.estimatedBytes / 1024)} KB)
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <Button
                  icon="trash"
                  intent="none"
                  onClick={handleCleanupPastEvents}
                  disabled={syncStats.eventCount === 0}
                >
                  Unsync past events
                </Button>
                <Button
                  icon="reset"
                  intent="danger"
                  onClick={handleReinitializeSync}
                  disabled={syncStats.eventCount === 0}
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
                "Reinitialize sync" clears all sync connections (events remain in
                both Roam and Google Calendar).
              </p>
            </Card>
          </>
        )}
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
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

  const handleTagsConfirm = () => {
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    onConfigChange(calendar.id, { triggerTags: tags });
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
          <span className="fc-name-text" title={calendar.summary}>
            {calendar.summary}
          </span>
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
