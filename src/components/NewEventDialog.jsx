import { Button, Popover, HTMLSelect, ButtonGroup } from "@blueprintjs/core";
import {
  createChildBlock,
  deleteBlock,
  deleteBlockIfNoChild,
  getPageNameByPageUid,
  getParentBlock,
  isExistingNode,
  updateBlock,
  blockHasCalendarTag,
  getBlockContentByUid,
} from "../util/roamApi";
import { useRef, useState, useEffect } from "react";
import { getCalendarUidFromPage } from "../util/data";
import { getTimestampFromHM } from "../util/dates";
import {
  isAuthenticated,
  getConnectedCalendars,
} from "../services/googleCalendarService";
import GoogleCalendarIconSvg from "../services/google-calendar.svg";

// Sync mode constants
const SYNC_MODE = {
  ROAM_ONLY: "roam-only",
  GCAL_ONLY: "gcal-only",
  SYNC_BOTH: "sync-both",
};

const NewEventDialog = ({
  newEventDialogIsOpen,
  setNewEventDialogIsOpen,
  pageUid,
  pageTitle,
  tagToInsert,
  position,
  addEvent,
  focusedTime,
  periodView,
}) => {
  const [isBlockRendering, setIsBlockRendering] = useState(false);
  const [eventUid, setEventUid] = useState(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [connectedCalendars, setConnectedCalendars] = useState([]);
  const [isGCalConnected, setIsGCalConnected] = useState(false);
  const [syncMode, setSyncMode] = useState(SYNC_MODE.ROAM_ONLY);
  const renderRef = useRef(null);
  const popoverRef = useRef(null);

  // Get the selected calendar object
  const selectedCalendar = connectedCalendars.find(
    (c) => c.id === selectedCalendarId
  );
  // Check if selected calendar is export-only (no 2-way sync available)
  const isExportOnly = selectedCalendar?.syncDirection === "export";

  // Load connected calendars when dialog opens
  useEffect(() => {
    if (newEventDialogIsOpen) {
      const authenticated = isAuthenticated();
      setIsGCalConnected(authenticated);
      if (authenticated) {
        const calendars = getConnectedCalendars().filter(
          (c) => c.syncEnabled && c.syncDirection !== "import"
        );
        setConnectedCalendars(calendars);
        // Set default calendar
        const defaultCal = calendars.find((c) => c.isDefault) || calendars[0];
        if (defaultCal) {
          setSelectedCalendarId(defaultCal.id);
        }
      }
    }
  }, [newEventDialogIsOpen]);

  // Check for Google Calendar tags - monitor block content changes
  useEffect(() => {
    if (!eventUid || connectedCalendars.length === 0 || !isBlockRendering) {
      return;
    }

    // Function to check for calendar tags
    const checkForCalendarTags = () => {
      let foundCalendar = null;
      for (const cal of connectedCalendars) {
        if (blockHasCalendarTag(eventUid, cal)) {
          foundCalendar = cal;
          break;
        }
      }

      // Only auto-enable if a calendar tag is found
      // Don't auto-disable if tag is removed (user might have manually enabled)
      if (foundCalendar) {
        setSelectedCalendarId(foundCalendar.id);
        // Set sync mode based on calendar's syncDirection
        if (foundCalendar.syncDirection === "export") {
          setSyncMode(SYNC_MODE.GCAL_ONLY);
        } else {
          setSyncMode(SYNC_MODE.SYNC_BOTH);
        }
      }
    };

    // Initial check
    checkForCalendarTags();

    // Poll every 500ms to detect tag changes as user types
    const interval = setInterval(checkForCalendarTags, 500);

    return () => clearInterval(interval);
  }, [eventUid, connectedCalendars, isBlockRendering]);

  const handleNew = async () => {
    const calendarBlockUid = await getCalendarUidFromPage(pageUid);
    if (periodView.includes("time") && focusedTime) {
      focusedTime = getTimestampFromHM(
        parseInt(focusedTime.slice(0, 2)),
        parseInt(focusedTime.slice(3, 5))
      );
    }
    let content =
      periodView.includes("time") && focusedTime ? focusedTime + " " : "";
    if (tagToInsert) {
      if (tagToInsert === "DONE" || tagToInsert === "TODO") {
        tagToInsert = `{{[[${tagToInsert}]]}} `;
        content = tagToInsert + content;
      } else {
        if (tagToInsert.includes(" ")) tagToInsert = "[[" + tagToInsert + "]]";
        tagToInsert = "#" + tagToInsert + " ";
        content += tagToInsert;
      }
    }
    const targetUid = await createChildBlock(calendarBlockUid, content);
    // setTimeout(async () => {
    await window.roamAlphaAPI.ui.components.renderBlock({
      uid: targetUid,
      el: renderRef.current,
    });

    let blockElt = renderRef.current.querySelector(".rm-block__input");
    if (blockElt) {
      const placeholder = document.createElement("span");
      placeholder.textContent =
        "Click here to start writing. Type '/' to see commands.";
      placeholder.style.color = "rgb(206, 217, 224)";
      blockElt.appendChild(placeholder);
    }
    setIsBlockRendering(true);
    setEventUid(targetUid);
    // }, 1000);
  };

  const handleClose = () => {
    const tooltip = document.querySelector(".rm-bullet__tooltip");
    if (tooltip) tooltip.remove();
  };

  const handleCancel = async () => {
    if (isBlockRendering) {
      const currentCalendarUid = getParentBlock(eventUid);
      await deleteBlock(eventUid);
      deleteBlockIfNoChild(currentCalendarUid);
    }
    setIsBlockRendering(false);
    setNewEventDialogIsOpen(false);
  };

  const handleConfirm = async () => {
    // Blur the block editor first to ensure Roam saves the current content
    // This prevents race conditions when updating the block via API
    const activeElement = document.activeElement;
    if (activeElement && renderRef.current?.contains(activeElement)) {
      activeElement.blur();
    }
    // Always wait for Roam to process any pending saves
    // This delay is needed even if blur happened, to ensure content is persisted
    await new Promise(resolve => setTimeout(resolve, 300));

    setIsBlockRendering(false);
    setNewEventDialogIsOpen(false);
    // Pass the sync mode and calendar ID
    const shouldSyncToGcal = syncMode !== SYNC_MODE.ROAM_ONLY;
    const gcalOnly = syncMode === SYNC_MODE.GCAL_ONLY;
    await addEvent(
      eventUid,
      pageUid,
      shouldSyncToGcal,
      shouldSyncToGcal ? selectedCalendarId : null,
      gcalOnly
    );
  };

  return (
    <div style={{ display: "none" }}>
      <Popover
        isOpen={newEventDialogIsOpen}
        canEscapeKeyClose={false}
        popoverClassName="fc-newevent-popover"
        ref={popoverRef}
        autoFocus={false}
        onClose={handleClose}
        minimal={true}
        onOpened={() => {
          if (popoverRef.current) {
            // Set fixed position styles for the popover
            const popoverElement = popoverRef.current.popoverElement;
            if (popoverElement) {
              if (position.x > 200) {
                if (position.x + 200 < window.innerWidth)
                  position.x = position.x - 200;
                else position.x = position.x - 400;
              }
              if (position.x < 0) position.x = 0;
              if (position.y + 250 > window.innerHeight)
                position.y = position.y - 150;
              if (position.y < 0) position.y = 0;
              popoverElement.style.position = "absolute";
              popoverElement.style.left = `${position.x}px`;
              popoverElement.style.top = `${position.y}px`;
              popoverElement.style.transform = null;
              popoverElement.style.visibility = "visible";
              handleNew();
            }
          }
        }}
        content={
          <>
            <h4>New event on {pageTitle}</h4>
            <div
              autoFocus={false}
              className="fc-renderblock"
              ref={renderRef}
            ></div>
            {isGCalConnected && connectedCalendars.length > 0 && (
              <div className="fc-gcal-sync-controls">
                {/* Calendar selector - visible when not Roam only */}
                {syncMode !== SYNC_MODE.ROAM_ONLY && (
                  <div className="fc-gcal-selector">
                    <HTMLSelect
                      value={selectedCalendarId}
                      onChange={(e) => {
                        setSelectedCalendarId(e.target.value);
                        // If switching to an export-only calendar while in sync-both mode,
                        // switch to gcal-only mode
                        const newCal = connectedCalendars.find(
                          (c) => c.id === e.target.value
                        );
                        if (
                          newCal?.syncDirection === "export" &&
                          syncMode === SYNC_MODE.SYNC_BOTH
                        ) {
                          setSyncMode(SYNC_MODE.GCAL_ONLY);
                        }
                      }}
                      minimal
                    >
                      {connectedCalendars.map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.displayName || cal.name}{" "}
                          {cal.isDefault ? "(default)" : ""}
                        </option>
                      ))}
                    </HTMLSelect>
                  </div>
                )}
                {/* Sync mode segmented control */}
                <ButtonGroup className="fc-sync-mode-buttons">
                  <Button
                    small
                    active={syncMode === SYNC_MODE.ROAM_ONLY}
                    onClick={() => setSyncMode(SYNC_MODE.ROAM_ONLY)}
                  >
                    Roam only
                  </Button>
                  <Button
                    small
                    active={syncMode === SYNC_MODE.GCAL_ONLY}
                    onClick={() => setSyncMode(SYNC_MODE.GCAL_ONLY)}
                    icon={
                      <GoogleCalendarIconSvg
                        style={{ width: "14px", height: "14px" }}
                      />
                    }
                  >
                    GCal only
                  </Button>
                  {!isExportOnly && (
                    <Button
                      small
                      active={syncMode === SYNC_MODE.SYNC_BOTH}
                      onClick={() => setSyncMode(SYNC_MODE.SYNC_BOTH)}
                      icon="refresh"
                    >
                      2-way sync
                    </Button>
                  )}
                </ButtonGroup>
              </div>
            )}
            <div>
              <Button text="Cancel" onClick={handleCancel} />
              <Button
                intent="primary"
                text={isBlockRendering ? "Confirm" : "New event"}
                onClick={
                  isBlockRendering ? () => handleConfirm() : () => handleNew()
                }
              />
            </div>
          </>
        }
      >
        <span></span>
      </Popover>
    </div>
  );
};

export default NewEventDialog;
