import { Icon, EditableText, Button, Checkbox, InputGroup } from "@blueprintjs/core";
import { useState, useEffect } from "react";
import ColorPicker from "./ColorPicker";
import { extensionStorage, mapOfTags } from "..";
import { getTrimedArrayFromList, updateStoredTags } from "../util/data";
import DeleteDialog from "./DeleteDialog";
import GCalConfigDialog from "./GCalConfigDialog";
import {
  isAuthenticated,
  getConnectedCalendars,
  onAuthStateChange,
  updateConnectedCalendar,
} from "../services/googleCalendarService";

const TagPopover = ({
  aliases,
  tag,
  setTagsToDisplay,
  isDataToReload,
  setPopoverToOpen,
}) => {
  const [aliasesStr, setAliasesStr] = useState(aliases);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTemporaryTag, setIsTemporaryTag] = useState(tag.isTemporary);
  const [isGCalDialogOpen, setIsGCalDialogOpen] = useState(false);
  const [gCalConnected, setGCalConnected] = useState(false);
  const [connectedCalendars, setConnectedCalendars] = useState([]);

  // Check if this is the main Google Calendar tag
  const isGoogleCalendarTag = tag.name === "Google calendar";
  // Check if this is a separate GCal tag (has gCalCalendarId but not the main tag)
  const isSeparateGCalTag = tag.isGCalTag && !isGoogleCalendarTag;

  // Load Google Calendar status for GCal-related tags
  useEffect(() => {
    if (isGoogleCalendarTag || isSeparateGCalTag) {
      setGCalConnected(isAuthenticated());
      setConnectedCalendars(getConnectedCalendars());

      // Listen for auth state changes
      const unsubscribe = onAuthStateChange((authenticated) => {
        setGCalConnected(authenticated);
        if (authenticated) {
          setConnectedCalendars(getConnectedCalendars());
        }
      });

      return unsubscribe;
    }
  }, [isGoogleCalendarTag, isSeparateGCalTag]);

  const handleAddPermanentTag = async () => {
    tag.isTemporary = false;
    await updateStoredTags(mapOfTags);
    const userTagsStr = extensionStorage.get("userTags")
      ? `${extensionStorage.get("userTags")}, ${tag.name}`
      : tag.name;
    extensionStorage.set("userTags", userTagsStr);
    setIsTemporaryTag(false);
  };

  const handleDeleteTag = async () => {
    const indexOfTagToDelete = mapOfTags.findIndex((t) => t.name === tag.name);
    if (indexOfTagToDelete === -1) return;
    mapOfTags.splice(indexOfTagToDelete, 1);
    await extensionStorage.set(
      "userTags",
      extensionStorage
        .get("userTags")
        .replace(new RegExp(",?\\s?" + tag.name + "\\s?"), "")
    );
    setPopoverToOpen("");
    setTagsToDisplay((prev) => [...prev.filter((t) => t.name !== tag.name)]);
  };

  // Handle calendar enable/disable toggle in main GCal popover
  const handleCalendarToggle = (calendarId, enabled) => {
    updateConnectedCalendar(calendarId, { syncEnabled: enabled });
    setConnectedCalendars(getConnectedCalendars());

    // Update the tag's disabledCalendarIds
    if (enabled) {
      tag.disabledCalendarIds = tag.disabledCalendarIds.filter(
        (id) => id !== calendarId
      );
    } else {
      if (!tag.disabledCalendarIds.includes(calendarId)) {
        tag.disabledCalendarIds.push(calendarId);
      }
    }

    isDataToReload.current = true;
    setTagsToDisplay((prev) => [...prev]);
  };

  // Handle alias update for a grouped calendar
  const handleCalendarAliasUpdate = (calendarId, aliasString) => {
    const aliases = aliasString
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    updateConnectedCalendar(calendarId, { triggerTags: aliases });
    setConnectedCalendars(getConnectedCalendars());
  };

  // Main Google Calendar tag popover
  if (isGoogleCalendarTag) {
    // Filter to only show grouped calendars (not separate tags)
    const groupedCalendars = connectedCalendars.filter(
      (cal) => !cal.showAsSeparateTag
    );

    return (
      <div className="fc-tag-popover fc-gcal-popover">
        {/* Header with connection status and config button */}
        <div className="fc-gcal-header">
          <div className="fc-gcal-status">
            {gCalConnected && (
              <Icon
                icon="tick-circle"
                intent="success"
                size={12}
                style={{ marginRight: "6px" }}
              />
            )}
            <span style={{ fontWeight: 500 }}>Connected calendars</span>
          </div>
          <Button
            icon="cog"
            minimal
            small
            onClick={() => setIsGCalDialogOpen(true)}
            title="Configure Google Calendar"
          />
        </div>

        {!gCalConnected ? (
          <div className="fc-gcal-not-connected">
            <Icon icon="circle" size={12} style={{ marginRight: "6px" }} />
            <span>Not connected</span>
            <Button
              icon="log-in"
              small
              onClick={() => setIsGCalDialogOpen(true)}
              style={{ marginLeft: "8px" }}
            >
              Connect
            </Button>
          </div>
        ) : groupedCalendars.length === 0 ? (
          <div className="fc-gcal-no-calendars">
            <span>No calendars grouped here.</span>
            <Button
              icon="add"
              small
              minimal
              onClick={() => setIsGCalDialogOpen(true)}
            >
              Add calendar
            </Button>
          </div>
        ) : (
          <div className="fc-gcal-grouped-calendars">
            {groupedCalendars.map((cal) => (
              <GroupedCalendarItem
                key={cal.id}
                calendar={cal}
                onToggle={(enabled) => handleCalendarToggle(cal.id, enabled)}
                onAliasUpdate={(aliases) =>
                  handleCalendarAliasUpdate(cal.id, aliases)
                }
              />
            ))}
          </div>
        )}

        <GCalConfigDialog
          isOpen={isGCalDialogOpen}
          onClose={() => {
            setIsGCalDialogOpen(false);
            setConnectedCalendars(getConnectedCalendars());
          }}
        />

        <ColorPicker
          tag={tag}
          setTagsToDisplay={setTagsToDisplay}
          isDataToReload={isDataToReload}
        />
      </div>
    );
  }

  // Separate GCal tag popover
  if (isSeparateGCalTag) {
    // Find the calendar config for this tag
    const calendarConfig = connectedCalendars.find(
      (cal) => cal.id === tag.gCalCalendarId
    );

    return (
      <div className="fc-tag-popover fc-gcal-separate-popover">
        {/* Header with calendar name and config button */}
        <div className="fc-gcal-header">
          <div className="fc-gcal-calendar-name">
            <Icon icon="calendar" size={12} style={{ marginRight: "6px" }} />
            <span>{calendarConfig?.name || tag.name}</span>
          </div>
          <Button
            icon="cog"
            minimal
            small
            onClick={() => setIsGCalDialogOpen(true)}
            title="Configure Google Calendar"
          />
        </div>

        {/* Connection status */}
        <div className="fc-gcal-status-small">
          <Icon
            icon={gCalConnected ? "tick-circle" : "circle"}
            intent={gCalConnected ? "success" : "none"}
            size={12}
            style={{ marginRight: "4px" }}
          />
          <span>{gCalConnected ? "Connected" : "Not connected"}</span>
        </div>

        {/* Aliases */}
        <div className="fc-tag-aliases">
          <div>
            <div>Trigger tag aliases: </div>
            <EditableText
              onConfirm={async (list) => {
                if (calendarConfig) {
                  handleCalendarAliasUpdate(calendarConfig.id, list);
                }
                // Also update tag pages for matching
                const updatedPages = [tag.name].concat(
                  getTrimedArrayFromList(list)
                );
                tag.updatePages(updatedPages);
                await updateStoredTags(mapOfTags);
                setTagsToDisplay((prev) => [...prev]);
                isDataToReload.current = true;
              }}
              className="fc-aliases-input"
              multiline={true}
              confirmOnEnterKey={true}
              small={true}
              placeholder="Add aliases here"
              value={aliasesStr}
              onChange={(evt) => setAliasesStr(evt)}
            />
          </div>
        </div>

        <GCalConfigDialog
          isOpen={isGCalDialogOpen}
          onClose={() => {
            setIsGCalDialogOpen(false);
            setConnectedCalendars(getConnectedCalendars());
          }}
        />

        <ColorPicker
          tag={tag}
          setTagsToDisplay={setTagsToDisplay}
          isDataToReload={isDataToReload}
        />
      </div>
    );
  }

  // Regular tag popover content
  return (
    <div className="fc-tag-popover">
      <div className="fc-tag-aliases">
        <div>
          <div>Aliases: </div>
          <EditableText
            onConfirm={async (list) => {
              const updatedPages = [tag.name].concat(
                getTrimedArrayFromList(list)
              );
              tag.updatePages(updatedPages);
              if (!tag.isTemporary) {
                if (
                  !tag.isUserDefined &&
                  tag.name !== "TODO" &&
                  tag.name !== "DONE"
                ) {
                  await extensionStorage.set(
                    `${tag.name}Tag`,
                    `${tag.pages[0]}, ${list.trim()}`
                  );
                }
                await updateStoredTags(mapOfTags);
              }
              setTagsToDisplay((prev) => [...prev]);
              isDataToReload.current = true;
            }}
            className="fc-aliases-input"
            multiline={true}
            confirmOnEnterKey={true}
            small={true}
            placeholder="Add aliases here"
            value={aliasesStr}
            onChange={(evt) => {
              setAliasesStr(evt);
            }}
          />
        </div>
      </div>
      <ColorPicker
        tag={tag}
        setTagsToDisplay={setTagsToDisplay}
        isDataToReload={isDataToReload}
      />
      {tag.isUserDefined ? (
        isTemporaryTag ? (
          <div onClick={() => handleAddPermanentTag()}>
            <span>Add to user tags</span>
            <Icon icon="add" size="14" />
          </div>
        ) : (
          <div onClick={() => setIsDeleteDialogOpen(true)}>
            <span>Remove from user tags</span>
            <Icon icon="trash" size="14" />
          </div>
        )
      ) : null}
      <DeleteDialog
        title="Remove user tag"
        message={
          <p>
            Are you sure you want to remove <strong>{tag.name}</strong> from
            user tags ?
          </p>
        }
        callback={handleDeleteTag}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
      />
    </div>
  );
};

/**
 * Component for a single grouped calendar in the main Google Calendar popover
 */
const GroupedCalendarItem = ({ calendar, onToggle, onAliasUpdate }) => {
  const [aliasStr, setAliasStr] = useState(
    (calendar.triggerTags || []).join(", ")
  );
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fc-gcal-grouped-item">
      <div className="fc-gcal-grouped-header">
        <Checkbox
          checked={calendar.syncEnabled !== false}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ marginBottom: 0 }}
        />
        <span
          className="fc-gcal-grouped-name"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {calendar.name}
        </span>
        <Icon
          icon={isExpanded ? "chevron-up" : "chevron-down"}
          size={12}
          style={{ cursor: "pointer", opacity: 0.6 }}
          onClick={() => setIsExpanded(!isExpanded)}
        />
      </div>

      {isExpanded && (
        <div className="fc-gcal-grouped-details">
          <div className="fc-gcal-alias-label">Trigger aliases:</div>
          <InputGroup
            value={aliasStr}
            onChange={(e) => setAliasStr(e.target.value)}
            onBlur={() => onAliasUpdate(aliasStr)}
            placeholder="work, meetings"
            small
          />
        </div>
      )}

      {!isExpanded && calendar.triggerTags?.length > 0 && (
        <div className="fc-gcal-grouped-aliases">
          {calendar.triggerTags.map((t) => `#${t}`).join(", ")}
        </div>
      )}
    </div>
  );
};

export default TagPopover;
