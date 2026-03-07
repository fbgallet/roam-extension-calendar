import {
  Icon,
  Popover,
  Button,
  Menu,
  MenuItem,
  Tooltip,
} from "@blueprintjs/core";
import { useState, useEffect, useCallback, useRef } from "react";
import { extensionStorage } from "..";
import { getBlockContentByUid, isExistingNode } from "../util/roamApi";
import { getTimestampFromHM } from "../util/dates";
import {
  getActiveReminders,
  getMissedReminders,
  snoozeReminder,
  dismissReminder,
  deleteReminder,
  SNOOZE_OPTIONS,
} from "../services/reminderService";
import ReminderDialog from "./ReminderDialog";

const InlineBlockPopover = ({ blockUid, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !blockUid) return;
    window.roamAlphaAPI.ui.components.renderBlock({
      uid: blockUid,
      el,
      "open?": false,
    });
    return () => {
      try {
        el.innerHTML = "";
      } catch (e) {}
    };
  }, [blockUid]);

  return (
    <div className="fc-inline-block-popover">
      <div className="fc-inline-block-popover-content" ref={ref} />
      <div className="fc-inline-block-popover-actions">
        <Tooltip
          content="Open in right sidebar"
          position="top"
          hoverOpenDelay={300}
        >
          <Button
            small
            minimal
            icon="panel-stats"
            onClick={() => {
              window.roamAlphaAPI.ui.rightSidebar.addWindow({
                window: { type: "outline", "block-uid": blockUid },
              });
              onClose();
            }}
          />
        </Tooltip>
        <Button small minimal icon="cross" onClick={onClose} />
      </div>
    </div>
  );
};

const BlockString = window.roamAlphaAPI.ui.react.BlockString;

const RoamBlockTitle = ({ blockUid, fallback, eventsInViewRef }) => {
  const [inlineOpen, setInlineOpen] = useState(false);
  const content = isExistingNode(blockUid)
    ? getBlockContentByUid(blockUid)
    : null;

  const isEventInView = () => {
    const events = eventsInViewRef?.current || [];
    return events.some((evt) => {
      const event = evt.event || evt;
      return event.id === blockUid;
    });
  };

  const handleClick = (e) => {
    if (!blockUid) return;
    if (e.shiftKey) {
      e.preventDefault();
      window.roamAlphaAPI.ui.rightSidebar.addWindow({
        window: { type: "outline", "block-uid": blockUid },
      });
      return;
    }
    if (isEventInView()) {
      document.dispatchEvent(
        new CustomEvent("fc-open-event-popover", {
          detail: { eventId: blockUid },
        }),
      );
    } else {
      setInlineOpen(true);
    }
  };

  return (
    <Popover
      isOpen={inlineOpen}
      onClose={() => setInlineOpen(false)}
      position="right"
      minimal
      content={
        inlineOpen ? (
          <InlineBlockPopover
            blockUid={blockUid}
            onClose={() => setInlineOpen(false)}
          />
        ) : (
          <span />
        )
      }
    >
      <span
        className="fc-reminder-overview-item-title"
        style={{ cursor: blockUid ? "pointer" : "default" }}
        onClick={blockUid ? handleClick : undefined}
      >
        {content ? <BlockString string={content} /> : fallback || blockUid}
      </span>
    </Popover>
  );
};

const ReminderOverviewPopover = ({ eventsInViewRef }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [overdueEvents, setOverdueEvents] = useState([]);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [missedReminders, setMissedReminders] = useState([]);
  const [editingReminder, setEditingReminder] = useState(null);

  const dueTagName = extensionStorage.get("dueTag") || "due date";

  const refreshData = useCallback(() => {
    // Overdue: events with TODO or due tag, before today, not DONE
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const events = eventsInViewRef?.current || [];

    const overdue = events.filter((evt) => {
      const event = evt.event || evt;
      const start = event.start || (event.startStr && new Date(event.startStr));
      if (!start || start >= todayStart) return false;

      const tags = event.extendedProps?.eventTags || [];
      const classNames = event.classNames || [];
      const hasTodo =
        classNames.includes("TODO") || tags.some((t) => t.name === "TODO");
      const hasDue = tags.some(
        (t) => t.name === "due" || t.pages?.includes(dueTagName),
      );
      const isDone =
        classNames.includes("DONE") || tags.some((t) => t.name === "DONE");

      return (hasTodo || hasDue) && !isDone;
    });

    setOverdueEvents(overdue);

    // Reminders
    setUpcomingReminders(
      getActiveReminders().sort((a, b) => a.remindAt - b.remindAt),
    );
    setMissedReminders(getMissedReminders());
  }, [eventsInViewRef, dueTagName]);

  // Refresh on mount and periodically (slower when closed, faster when open)
  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, isOpen ? 30000 : 60000);
    return () => clearInterval(interval);
  }, [isOpen, refreshData]);

  // Re-run once after mount to pick up events loaded by FullCalendar
  useEffect(() => {
    const t = setTimeout(refreshData, 2000);
    return () => clearTimeout(t);
  }, []);

  const totalCount = overdueEvents.length + missedReminders.length;

  const handleSnooze = (reminderId, durationMs) => {
    snoozeReminder(reminderId, durationMs);
    refreshData();
  };

  const handleDismiss = (reminderId) => {
    dismissReminder(reminderId);
    refreshData();
  };

  const handleDeleteReminder = (reminderId) => {
    deleteReminder(reminderId);
    refreshData();
  };

  const formatTime = (timestamp) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    const time = getTimestampFromHM(d.getHours(), d.getMinutes());
    if (isToday) return `Today ${time}`;
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
  };

  const getEventTitle = (evt) => {
    const event = evt.event || evt;
    return event.title || "";
  };

  const getEventDate = (evt) => {
    const event = evt.event || evt;
    const start = event.start || (event.startStr && new Date(event.startStr));
    if (!start) return "";
    return start.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <>
      <Popover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        position="bottom-left"
        minimal
        content={
          <div className="fc-reminder-overview">
            {/* Missed Reminders */}
            {missedReminders.length > 0 && (
              <div className="fc-reminder-overview-section">
                <h5>Missed Reminders</h5>
                {missedReminders.map((r) => (
                  <div key={r.id} className="fc-reminder-overview-item">
                    <RoamBlockTitle
                      blockUid={r.eventId}
                      fallback={r.eventTitle}
                      eventsInViewRef={eventsInViewRef}
                    />
                    <div className="fc-reminder-overview-item-actions">
                      <Popover
                        minimal
                        position="bottom"
                        content={
                          <Menu>
                            {Object.entries(SNOOZE_OPTIONS).map(
                              ([label, ms]) => (
                                <MenuItem
                                  key={label}
                                  text={label}
                                  onClick={() => handleSnooze(r.id, ms)}
                                />
                              ),
                            )}
                          </Menu>
                        }
                      >
                        <Button small minimal icon="time" title="Snooze" />
                      </Popover>
                      <Button
                        small
                        minimal
                        icon="cross"
                        title="Dismiss"
                        onClick={() => handleDismiss(r.id)}
                      />
                      <span className="fc-reminder-overview-item-time">
                        {formatTime(r.remindAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Overdue Events */}
            {overdueEvents.length > 0 && (
              <div className="fc-reminder-overview-section">
                <h5>Overdue (in current view)</h5>
                {overdueEvents.map((evt, i) => {
                  const event = evt.event || evt;
                  const uid = event.id;
                  return (
                    <div key={i} className="fc-reminder-overview-item">
                      <Icon icon="warning-sign" size={12} intent="warning" />
                      <RoamBlockTitle
                        blockUid={uid}
                        fallback={getEventTitle(evt)}
                        eventsInViewRef={eventsInViewRef}
                      />
                      <div className="fc-reminder-overview-item-actions">
                        <span className="fc-reminder-overview-item-time">
                          {getEventDate(evt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upcoming Reminders */}
            {upcomingReminders.length > 0 && (
              <div className="fc-reminder-overview-section">
                <h5>Upcoming Reminders</h5>
                {upcomingReminders.map((r) => (
                  <div key={r.id} className="fc-reminder-overview-item">
                    <RoamBlockTitle
                      blockUid={r.eventId}
                      fallback={r.eventTitle}
                      eventsInViewRef={eventsInViewRef}
                    />
                    <div className="fc-reminder-overview-item-actions">
                      <Button
                        small
                        minimal
                        icon="edit"
                        title="Edit"
                        onClick={() => setEditingReminder(r)}
                      />
                      <Button
                        small
                        minimal
                        icon="trash"
                        title="Remove"
                        onClick={() => handleDeleteReminder(r.id)}
                      />
                      <span className="fc-reminder-overview-item-time">
                        {formatTime(r.remindAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalCount === 0 && upcomingReminders.length === 0 && (
              <div className="fc-reminder-overview-empty">
                No reminders or overdue events
              </div>
            )}
          </div>
        }
      >
        <div className="fc-reminder-bell" onClick={() => setIsOpen(!isOpen)}>
          <Icon
            icon="notifications"
            size={16}
            intent={totalCount > 0 ? "warning" : "none"}
          />
          {totalCount > 0 && (
            <span className="fc-reminder-badge">{totalCount}</span>
          )}
        </div>
      </Popover>
      {editingReminder && (
        <ReminderDialog
          isOpen={true}
          setIsOpen={(val) => {
            if (!val) setEditingReminder(null);
          }}
          blockUid={editingReminder.eventId}
          eventTitle={editingReminder.eventTitle}
          eventDate={editingReminder.eventDate}
          eventTime={editingReminder.eventTime}
          existingReminder={editingReminder}
          onSave={() => {
            refreshData();
            setEditingReminder(null);
          }}
          onDelete={() => {
            refreshData();
            setEditingReminder(null);
          }}
        />
      )}
    </>
  );
};

export default ReminderOverviewPopover;
