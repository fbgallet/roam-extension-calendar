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
  Tag,
} from "@blueprintjs/core";
import { useState, useEffect } from "react";
import {
  authenticate,
  signOut,
  isAuthenticated,
  listCalendars,
  getConnectedCalendars,
  addConnectedCalendar,
  updateConnectedCalendar,
  removeConnectedCalendar,
  getSyncInterval,
  setSyncInterval,
  DEFAULT_CALENDAR_CONFIG,
  onAuthStateChange,
} from "../services/googleCalendarService";
import { initializeGCalTags } from "../index";

const GCalConfigDialog = ({ isOpen, onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableCalendars, setAvailableCalendars] = useState([]);
  const [connectedCalendars, setConnectedCalendars] = useState([]);
  const [syncInterval, setSyncIntervalState] = useState(null);
  const [showAddCalendar, setShowAddCalendar] = useState(false);

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

      const connected = getConnectedCalendars();
      setConnectedCalendars(connected);

      setSyncIntervalState(getSyncInterval());

      if (authenticated) {
        await fetchAvailableCalendars();
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
    } catch (err) {
      console.error("Failed to fetch calendars:", err);
      setError("Failed to fetch calendars from Google");
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError("");

    try {
      await authenticate();
      setIsConnected(true);
      await fetchAvailableCalendars();
    } catch (err) {
      setError("Failed to connect to Google Calendar");
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
    } catch (err) {
      setError("Failed to disconnect");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCalendar = (googleCalendar) => {
    const newCalendar = {
      ...DEFAULT_CALENDAR_CONFIG,
      id: googleCalendar.id,
      name: googleCalendar.summary,
      displayName: googleCalendar.summary, // Default displayName to calendar name
      triggerTags: [], // No alias tags by default
      showAsSeparateTag: false, // Grouped under main "Google Calendar" tag by default
      isDefault: connectedCalendars.length === 0,
    };

    const updated = addConnectedCalendar(newCalendar);
    setConnectedCalendars(updated);
    setShowAddCalendar(false);
    // Reinitialize tags to reflect the new calendar
    initializeGCalTags();
  };

  const handleRemoveCalendar = (calendarId) => {
    const updated = removeConnectedCalendar(calendarId);
    setConnectedCalendars(updated);
    // Reinitialize tags to remove the deleted calendar
    initializeGCalTags();
  };

  const handleUpdateCalendar = (calendarId, updates) => {
    const updated = updateConnectedCalendar(calendarId, updates);
    setConnectedCalendars(updated);
    // Reinitialize tags to reflect the changes immediately
    initializeGCalTags();
  };

  const handleSyncIntervalChange = (value) => {
    const interval = value === "manual" ? null : parseInt(value);
    setSyncIntervalState(interval);
    setSyncInterval(interval);
  };

  // Get calendars that are not yet connected
  const unconnectedCalendars = availableCalendars.filter(
    (cal) => !connectedCalendars.some((cc) => cc.id === cal.id)
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Google Calendar Configuration"
      icon="calendar"
      className="fc-gcal-config-dialog"
      style={{ width: "550px" }}
    >
      <div className={Classes.DIALOG_BODY}>
        {isLoading && (
          <div className="fc-gcal-loading">
            <Spinner size={30} />
          </div>
        )}

        {error && (
          <Callout intent="danger" icon="error" style={{ marginBottom: "15px" }}>
            {error}
          </Callout>
        )}

        {/* Connection Status */}
        <Card style={{ marginBottom: "15px" }}>
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
            {/* Connected Calendars */}
            <h4 style={{ marginBottom: "10px" }}>Connected Calendars</h4>

            {connectedCalendars.length === 0 ? (
              <Callout intent="primary" icon="info-sign" style={{ marginBottom: "15px" }}>
                No calendars connected yet. Add a calendar to start syncing.
              </Callout>
            ) : (
              <div className="fc-gcal-calendar-list">
                {connectedCalendars.map((cal) => (
                  <ConnectedCalendarCard
                    key={cal.id}
                    calendar={cal}
                    onUpdate={(updates) => handleUpdateCalendar(cal.id, updates)}
                    onRemove={() => handleRemoveCalendar(cal.id)}
                  />
                ))}
              </div>
            )}

            {/* Add Calendar Button/Dropdown */}
            {unconnectedCalendars.length > 0 && (
              <div style={{ marginBottom: "15px" }}>
                {showAddCalendar ? (
                  <Card>
                    <h5>Select a calendar to add:</h5>
                    <div className="fc-gcal-available-calendars">
                      {unconnectedCalendars.map((cal) => (
                        <div
                          key={cal.id}
                          className="fc-gcal-available-calendar-item"
                          onClick={() => handleAddCalendar(cal)}
                        >
                          <span
                            className="fc-gcal-color-dot"
                            style={{ backgroundColor: cal.backgroundColor }}
                          />
                          {cal.summary}
                        </div>
                      ))}
                    </div>
                    <Button
                      minimal
                      icon="cross"
                      onClick={() => setShowAddCalendar(false)}
                      style={{ marginTop: "10px" }}
                    >
                      Cancel
                    </Button>
                  </Card>
                ) : (
                  <Button
                    icon="add"
                    onClick={() => setShowAddCalendar(true)}
                    outlined
                  >
                    Add Calendar
                  </Button>
                )}
              </div>
            )}

            {/* Sync Settings */}
            <h4 style={{ marginBottom: "10px", marginTop: "20px" }}>
              Sync Settings
            </h4>
            <Card>
              <FormGroup
                label="Check for updates"
                helperText="How often to check Google Calendar for updates"
              >
                <HTMLSelect
                  value={syncInterval === null ? "manual" : syncInterval.toString()}
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
 * Card component for a single connected calendar
 */
const ConnectedCalendarCard = ({ calendar, onUpdate, onRemove }) => {
  const [tagsStr, setTagsStr] = useState((calendar.triggerTags || []).join(", "));
  const [displayName, setDisplayName] = useState(calendar.displayName || calendar.name);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTagsChange = (value) => {
    setTagsStr(value);
  };

  const handleTagsConfirm = () => {
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    onUpdate({ triggerTags: tags });
  };

  const handleDisplayNameConfirm = () => {
    if (displayName.trim()) {
      onUpdate({ displayName: displayName.trim() });
    }
  };

  const handleShowAsSeparateTagChange = (checked) => {
    onUpdate({ showAsSeparateTag: checked });
  };

  return (
    <Card className="fc-gcal-calendar-card" style={{ marginBottom: "10px" }}>
      <div className="fc-gcal-calendar-header">
        <div className="fc-gcal-calendar-title">
          <Icon icon="calendar" size={12} style={{ marginRight: "6px", opacity: 0.6 }} />
          <strong>{calendar.name}</strong>
          {calendar.isDefault && (
            <Tag minimal intent="primary" style={{ marginLeft: "8px" }}>
              Default
            </Tag>
          )}
          {calendar.showAsSeparateTag && (
            <Tag minimal intent="success" style={{ marginLeft: "4px" }}>
              Separate Tag
            </Tag>
          )}
        </div>
        <div>
          <Button
            minimal
            small
            icon={isExpanded ? "chevron-up" : "chevron-down"}
            onClick={() => setIsExpanded(!isExpanded)}
          />
          <Button
            minimal
            small
            icon="trash"
            intent="danger"
            onClick={onRemove}
          />
        </div>
      </div>

      {/* Show current tag info in collapsed state */}
      {!isExpanded && (calendar.triggerTags?.length > 0 || calendar.showAsSeparateTag) && (
        <div className="fc-gcal-calendar-tags">
          {calendar.showAsSeparateTag && (
            <>
              <span className="fc-gcal-label">Tag: </span>
              <Tag minimal intent="success" style={{ marginRight: "4px" }}>
                #{calendar.displayName || calendar.name}
              </Tag>
            </>
          )}
          {calendar.triggerTags?.length > 0 && (
            <>
              <span className="fc-gcal-label">{calendar.showAsSeparateTag ? "Aliases: " : "Trigger aliases: "}</span>
              {calendar.triggerTags.map((tag) => (
                <Tag key={tag} minimal style={{ marginRight: "4px" }}>
                  #{tag}
                </Tag>
              ))}
            </>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="fc-gcal-calendar-details">
          {/* Show as Separate Tag toggle */}
          <Switch
            checked={calendar.showAsSeparateTag || false}
            label="Show as separate Tag in filter"
            onChange={(e) => handleShowAsSeparateTagChange(e.target.checked)}
            style={{ marginBottom: "10px" }}
          />

          {/* Display Name - only shown when showAsSeparateTag is enabled */}
          {calendar.showAsSeparateTag && (
            <FormGroup
              label="Display name (Tag name)"
              helperText="This name will be used as the main tag for this calendar"
            >
              <InputGroup
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={handleDisplayNameConfirm}
                placeholder={calendar.name}
              />
            </FormGroup>
          )}

          <FormGroup
            label="Trigger tag aliases"
            helperText={
              calendar.showAsSeparateTag
                ? "Additional tags that also route events to this calendar (comma-separated)"
                : "Tags that identify events for this calendar (comma-separated)"
            }
          >
            <InputGroup
              value={tagsStr}
              onChange={(e) => handleTagsChange(e.target.value)}
              onBlur={handleTagsConfirm}
              placeholder="work, meetings"
            />
          </FormGroup>

          <FormGroup label="Sync Direction">
            <HTMLSelect
              value={calendar.syncDirection}
              onChange={(e) => onUpdate({ syncDirection: e.target.value })}
              options={[
                { value: "both", label: "Both directions" },
                { value: "import", label: "Import only (GCal → Roam)" },
                { value: "export", label: "Export only (Roam → GCal)" },
              ]}
            />
          </FormGroup>

          <Switch
            checked={calendar.isDefault}
            label="Default calendar"
            onChange={(e) => onUpdate({ isDefault: e.target.checked })}
          />

          <Switch
            checked={calendar.syncEnabled}
            label="Sync enabled"
            onChange={(e) => onUpdate({ syncEnabled: e.target.checked })}
          />
        </div>
      )}
    </Card>
  );
};

export default GCalConfigDialog;
