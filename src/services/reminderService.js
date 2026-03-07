/**
 * ReminderService - Handles reminder storage, polling, and firing
 *
 * Reminders are stored in extension storage (not Roam blocks).
 * Polls every 60 seconds and fires reminders as BlueprintJS Toasts
 * or browser notifications depending on tab focus.
 */

import { extensionStorage } from "..";
import { getBlockContentByUid, isExistingNode } from "../util/roamApi";
import { getTimestampFromHM } from "../util/dates";
import { Toaster, Position, Intent } from "@blueprintjs/core";

const STORAGE_KEY = "fc-reminders";
const FIRED_KEY_PREFIX = "fc-reminder-fired-";

// In-memory cache
let remindersCache = null;
let pollingIntervalId = null;
let visibilityHandler = null;
let pendingNotifications = []; // queued when tab not focused and permission denied
let scheduledTimers = {}; // individual setTimeout IDs keyed by reminder ID

// Shared toaster instance
let reminderToaster = null;

const getToaster = () => {
  if (!reminderToaster) {
    reminderToaster = Toaster.create({
      position: Position.TOP,
      className: "fc-reminder-toaster",
    });
  }
  return reminderToaster;
};

// ─── CRUD ───────────────────────────────────────────────────────────

export const loadReminders = () => {
  if (remindersCache !== null) return remindersCache;
  try {
    const stored = extensionStorage.get(STORAGE_KEY);
    if (typeof stored === "string") {
      remindersCache = JSON.parse(stored);
    } else {
      remindersCache = stored || {};
    }
    return remindersCache;
  } catch (error) {
    console.error("[Reminder] Failed to load reminders:", error);
    remindersCache = {};
    return remindersCache;
  }
};

const persistReminders = () => {
  try {
    extensionStorage.set(STORAGE_KEY, JSON.stringify(remindersCache));
  } catch (error) {
    console.error("[Reminder] Failed to persist reminders:", error);
  }
};

export const saveReminder = (reminder) => {
  loadReminders();
  remindersCache[reminder.id] = reminder;
  persistReminders();
  return reminder;
};

export const deleteReminder = (reminderId) => {
  loadReminders();
  if (remindersCache[reminderId]) {
    delete remindersCache[reminderId];
    persistReminders();
    return true;
  }
  return false;
};

export const getReminder = (reminderId) => {
  loadReminders();
  return remindersCache[reminderId] || null;
};

export const getRemindersForEvent = (blockUid) => {
  loadReminders();
  return Object.values(remindersCache).filter(
    (r) => r.eventId === blockUid && !r.dismissed,
  );
};

export const getActiveReminders = () => {
  loadReminders();
  return Object.values(remindersCache).filter(
    (r) => !r.dismissed && !r.firedAt,
  );
};

export const getMissedReminders = () => {
  loadReminders();
  return Object.values(remindersCache).filter((r) => r.firedAt && !r.dismissed);
};

export const getAllReminders = () => {
  loadReminders();
  return Object.values(remindersCache).filter((r) => !r.dismissed);
};

// ─── SNOOZE / DISMISS ───────────────────────────────────────────────

export const snoozeReminder = (reminderId, durationMs) => {
  loadReminders();
  const reminder = remindersCache[reminderId];
  if (!reminder) return null;
  reminder.snoozedUntil = Date.now() + durationMs;
  reminder.firedAt = null;
  persistReminders();
  scheduleReminderTimers();
  return reminder;
};

export const dismissReminder = (reminderId) => {
  loadReminders();
  const reminder = remindersCache[reminderId];
  if (!reminder) return null;
  reminder.dismissed = true;
  persistReminders();
  return reminder;
};

// ─── REMINDER CREATION HELPERS ──────────────────────────────────────

const DELAY_MAP = {
  "Exact time": 0,
  "10 min before": 10 * 60 * 1000,
  "30 min before": 30 * 60 * 1000,
  "1 hour before": 60 * 60 * 1000,
  "1 day before": 24 * 60 * 60 * 1000,
};

export const FROM_NOW_MAP = {
  "In 5 min": 5 * 60 * 1000,
  "In 10 min": 10 * 60 * 1000,
  "In 30 min": 30 * 60 * 1000,
  "In 1 hour": 60 * 60 * 1000,
  "In 1 day": 24 * 60 * 60 * 1000,
  "In 1 week": 7 * 24 * 60 * 60 * 1000,
};

export const DELAY_OPTIONS_WITH_TIME = [
  "Exact time",
  "10 min before",
  "30 min before",
  "1 hour before",
  "1 day before",
  "Custom",
];

export const DELAY_OPTIONS_WITHOUT_TIME = ["Custom"];

export const SNOOZE_OPTIONS = {
  "5 min": 5 * 60 * 1000,
  "10 min": 10 * 60 * 1000,
  "30 min": 30 * 60 * 1000,
  "1 hour": 60 * 60 * 1000,
  "1 day": 24 * 60 * 60 * 1000,
};

export const calculateRemindAt = (
  eventDate,
  eventTime,
  delayOption,
  referenceTime = null,
) => {
  if (delayOption === "Custom") return null; // caller handles custom

  // "Exact time" means remind at the event time itself (or the chosen reference time)
  const timeToUse = referenceTime || eventTime;

  let eventTimestamp;
  if (timeToUse) {
    const [h, m] = timeToUse.split(":").map(Number);
    const d = new Date(eventDate);
    d.setHours(h, m, 0, 0);
    eventTimestamp = d.getTime();
  } else {
    // All-day event: default to 9:00 AM on event day
    const d = new Date(eventDate);
    d.setHours(9, 0, 0, 0);
    eventTimestamp = d.getTime();
  }

  if (delayOption === "Exact time") return eventTimestamp;

  const delayMs = DELAY_MAP[delayOption] || 0;
  return eventTimestamp - delayMs;
};

export const createReminder = ({
  eventId,
  eventTitle,
  eventDate,
  eventTime,
  remindAt,
  source = "manual",
}) => {
  // Generate unique ID: eventId + counter
  loadReminders();
  const existingForEvent = getRemindersForEvent(eventId);
  const counter = existingForEvent.length;
  const id = `${eventId}_${counter}`;

  const reminder = {
    id,
    eventId,
    eventTitle: eventTitle || "",
    eventDate,
    eventTime: eventTime || null,
    remindAt,
    snoozedUntil: null,
    firedAt: null,
    dismissed: false,
    source,
    created: Date.now(),
  };

  // Ask for browser notification permission if not yet decided (user gesture context)
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "default"
  ) {
    Notification.requestPermission();
  }

  const saved = saveReminder(reminder);
  // Schedule a precise timer for this reminder (foreground context = works in background tabs)
  scheduleReminderTimers();
  return saved;
};

export const createReminderFromTag = (
  blockUid,
  eventDate,
  eventTime,
  title,
) => {
  const delayOption = extensionStorage.get("reminderDelay") || "10 min";
  const remindAt = calculateRemindAt(eventDate, eventTime, delayOption);
  if (!remindAt) return null;

  return createReminder({
    eventId: blockUid,
    eventTitle: title,
    eventDate,
    eventTime,
    remindAt,
    source: "tag",
  });
};

// ─── FIRING LOGIC ───────────────────────────────────────────────────

const isMultiTabGuardBlocked = (reminderId) => {
  try {
    const key = FIRED_KEY_PREFIX + reminderId;
    const lastFired = extensionStorage.get(key);
    if (lastFired && Date.now() - parseInt(lastFired) < 10000) {
      return true; // Another tab fired this within 10s
    }
  } catch (e) {
    // Ignore storage errors for guard
  }
  return false;
};

const setMultiTabGuard = (reminderId) => {
  try {
    const key = FIRED_KEY_PREFIX + reminderId;
    extensionStorage.set(key, String(Date.now()));
  } catch (e) {
    // Ignore
  }
};

const formatReminderTime = (reminder) => {
  const eventDateStr = window.roamAlphaAPI.util.dateToPageTitle(
    new Date(reminder.eventDate),
  );
  const eventStr = reminder.eventTime
    ? (() => {
        const [h, m] = reminder.eventTime.split(":").map(Number);
        return `${eventDateStr} at ${getTimestampFromHM(h, m)}`;
      })()
    : eventDateStr;

  const remindAt = reminder.snoozedUntil || reminder.remindAt;
  const remindDate = new Date(remindAt);
  const remindTimeStr = getTimestampFromHM(
    remindDate.getHours(),
    remindDate.getMinutes(),
  );
  const remindDateStr = window.roamAlphaAPI.util.dateToPageTitle(remindDate);
  const remindStr =
    remindDateStr === eventDateStr
      ? remindTimeStr
      : `${remindDateStr} at ${remindTimeStr}`;

  return `${eventStr} (reminder: ${remindStr})`;
};

const refreshTitle = (reminder) => {
  if (isExistingNode(reminder.eventId)) {
    const content = getBlockContentByUid(reminder.eventId);
    if (content) {
      reminder.eventTitle =
        content.length > 60 ? content.substring(0, 57) + "..." : content;
    }
  }
};

export const fireReminder = (reminder) => {
  if (isMultiTabGuardBlocked(reminder.id)) return;
  setMultiTabGuard(reminder.id);

  // Update title from block if still exists
  refreshTitle(reminder);

  // Mark as fired
  reminder.firedAt = Date.now();
  saveReminder(reminder);

  console.log(
    "[Reminder] fireReminder:",
    reminder.eventTitle,
    "| visibilityState:", document.visibilityState,
    "| hasFocus:", document.hasFocus(),
    "| Notification.permission:", typeof Notification !== "undefined" ? Notification.permission : "N/A",
  );

  if (document.visibilityState === "visible" && document.hasFocus()) {
    showReminderToast(reminder);
  } else {
    showBrowserNotification(reminder);
  }
};

const ReminderToastMessage = ({ reminder, timeStr, onAccept, onSnooze, onReschedule, onCancel }) => {
  const React = require("react");
  const { useRef, useEffect } = React;
  const renderRef = useRef(null);

  useEffect(() => {
    const el = renderRef.current;
    if (!el) return;
    const blockString = `${getBlockContentByUid(reminder.eventId)}`;
    window.roamAlphaAPI.ui.components.renderString({ el, string: blockString });
    return () => {
      try {
        el.innerHTML = "";
      } catch (e) {}
    };
  }, [reminder.eventId]);

  const handleClick = (e) => {
    if (e.shiftKey) {
      window.roamAlphaAPI.ui.rightSidebar.addWindow({
        window: { type: "block", "block-uid": reminder.eventId },
      });
    } else {
      window.roamAlphaAPI.ui.mainWindow.openBlock({
        block: { uid: reminder.eventId },
      });
    }
  };

  const btnStyle = {
    marginRight: 6,
    marginTop: 6,
    padding: "2px 8px",
    fontSize: "12px",
    cursor: "pointer",
    borderRadius: 3,
    border: "1px solid rgba(255,255,255,0.4)",
    background: "rgba(255,255,255,0.15)",
    color: "inherit",
  };

  return React.createElement(
    "div",
    null,
    React.createElement(
      "div",
      { style: { cursor: "pointer" }, onClick: handleClick },
      React.createElement("div", {
        ref: renderRef,
        style: { fontWeight: 500, marginBottom: 2 },
      }),
      React.createElement(
        "div",
        { style: { fontSize: "12px", opacity: 0.85 } },
        timeStr,
      ),
    ),
    React.createElement(
      "div",
      { style: { marginTop: 6 } },
      React.createElement(
        "button",
        {
          style: btnStyle,
          onClick: (e) => { e.stopPropagation(); onAccept(); },
          title: "Mark as done and remove this reminder",
        },
        "Accept",
      ),
      React.createElement(
        "button",
        {
          style: btnStyle,
          onClick: (e) => { e.stopPropagation(); onSnooze(); },
          title: "Remind me again in 10 minutes",
        },
        "Snooze 10 min",
      ),
      React.createElement(
        "button",
        {
          style: btnStyle,
          onClick: (e) => { e.stopPropagation(); onReschedule(); },
          title: "Pick a new time for this reminder",
        },
        "Reschedule",
      ),
      React.createElement(
        "button",
        {
          style: btnStyle,
          onClick: (e) => { e.stopPropagation(); onCancel(); },
          title: "Close this notification — reminder stays as Missed",
        },
        "Cancel",
      ),
    ),
  );
};

const showReminderToast = (reminder) => {
  const toaster = getToaster();
  const timeStr = formatReminderTime(reminder);
  const React = require("react");

  // We need the toast key to dismiss it programmatically from action buttons
  let toastKey;

  const close = () => {
    if (toastKey) toaster.dismiss(toastKey);
  };

  const message = React.createElement(ReminderToastMessage, {
    reminder,
    timeStr,
    onAccept: () => {
      dismissReminder(reminder.id);
      close();
    },
    onSnooze: () => {
      snoozeReminder(reminder.id, SNOOZE_OPTIONS["10 min"]);
      close();
    },
    onReschedule: () => {
      close();
      const ReactDOM = require("react-dom");
      const ReminderDialog = require("../components/ReminderDialog").default;
      const container = document.createElement("div");
      container.id = "fc-reminder-reschedule-portal";
      document.body.appendChild(container);
      const cleanup = () => {
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
      };
      const DialogWrapper = () => {
        const [isOpen, setIsOpen] = React.useState(true);
        return React.createElement(ReminderDialog, {
          isOpen,
          setIsOpen: (val) => {
            setIsOpen(val);
            if (!val) setTimeout(cleanup, 100);
          },
          blockUid: reminder.eventId,
          eventTitle: reminder.eventTitle,
          eventDate: reminder.eventDate,
          eventTime: reminder.eventTime,
          existingReminder: reminder,
          onSave: () => {},
          onDelete: () => {},
        });
      };
      ReactDOM.render(React.createElement(DialogWrapper), container);
    },
    onCancel: close,
  });

  toastKey = toaster.show({
    message,
    intent: Intent.PRIMARY,
    icon: "notifications",
    timeout: -1,
    // ✕ button = Cancel: toast closes, reminder stays as Missed (no state change)
  });
};

const _showBrowserNotificationGranted = (reminder) => {
  const timeStr = formatReminderTime(reminder);
  const title = `Reminder: ${reminder.eventTitle}`;

  const onFocus = () => {
    window.removeEventListener("focus", onFocus);
    showReminderToast(reminder);
  };

  try {
    const notification = new Notification(title, {
      body: timeStr,
      icon: "https://roamresearch.com/favicon.ico",
    });
    console.log("[Reminder] Browser notification created, permission:", Notification.permission);

    notification.onclick = () => {
      // Remove the focus listener to avoid showing toast twice
      window.removeEventListener("focus", onFocus);
      window.focus();
      notification.close();
      showReminderToast(reminder);
    };
  } catch (e) {
    console.log("[Reminder] Notification constructor failed:", e);
    pendingNotifications.push(reminder);
    return;
  }

  // If tab becomes focused (without clicking notification), show toast
  window.addEventListener("focus", onFocus);
};

const showBrowserNotification = (reminder) => {
  if (typeof Notification === "undefined") {
    // Browser doesn't support notifications, queue for toast
    pendingNotifications.push(reminder);
    return;
  }

  if (Notification.permission === "granted") {
    _showBrowserNotificationGranted(reminder);
  } else if (Notification.permission === "default") {
    // Request permission immediately and show if granted, else queue for toast
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        _showBrowserNotificationGranted(reminder);
      } else {
        pendingNotifications.push(reminder);
      }
    });
  } else {
    // Denied: queue for toast when tab is focused
    pendingNotifications.push(reminder);
  }
};

export const requestNotificationPermission = async () => {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return await Notification.requestPermission();
};

// ─── POLLING ────────────────────────────────────────────────────────

export const checkAndFireReminders = () => {
  const now = Date.now();
  loadReminders();

  for (const reminder of Object.values(remindersCache)) {
    if (reminder.dismissed) continue;
    if (reminder.firedAt) continue; // already fired and not snoozed

    const effectiveTime = reminder.snoozedUntil || reminder.remindAt;
    if (effectiveTime <= now) {
      fireReminder(reminder);
    }
  }
};

// Schedule individual setTimeout for each upcoming reminder.
// Timers set from a foreground context will fire even when the tab becomes hidden,
// unlike setInterval callbacks which Chrome throttles in background tabs.
const scheduleReminderTimers = () => {
  // Clear existing timers
  for (const id of Object.values(scheduledTimers)) {
    clearTimeout(id);
  }
  scheduledTimers = {};

  const now = Date.now();
  loadReminders();

  for (const reminder of Object.values(remindersCache)) {
    if (reminder.dismissed) continue;
    if (reminder.firedAt) continue;

    const effectiveTime = reminder.snoozedUntil || reminder.remindAt;
    const delay = effectiveTime - now;

    if (delay <= 0) {
      // Already due — fire immediately
      fireReminder(reminder);
    } else if (delay < 24 * 60 * 60 * 1000) {
      // Schedule if within 24h (avoid very long timeouts)
      scheduledTimers[reminder.id] = setTimeout(() => {
        delete scheduledTimers[reminder.id];
        const r = getReminder(reminder.id);
        if (r && !r.dismissed && !r.firedAt) {
          fireReminder(r);
        }
      }, delay);
    }
  }
};

export const startReminderPolling = () => {
  if (pollingIntervalId) return;

  // Schedule precise timers for each reminder (works in background tabs)
  scheduleReminderTimers();

  // Keep setInterval as a fallback for reminders > 24h away or newly created
  pollingIntervalId = setInterval(() => {
    checkAndFireReminders();
    scheduleReminderTimers();
  }, 60 * 1000);

  // Request browser notification permission if there are any active reminders
  const active = getActiveReminders();
  if (active.length > 0) {
    requestNotificationPermission();
  }

  // Handle pending notifications when tab becomes visible or focused
  const flushPendingNotifications = () => {
    if (
      document.visibilityState === "visible" &&
      pendingNotifications.length > 0
    ) {
      const toShow = [...pendingNotifications];
      pendingNotifications = [];
      for (const reminder of toShow) {
        showReminderToast(reminder);
      }
    }
  };
  visibilityHandler = flushPendingNotifications;
  document.addEventListener("visibilitychange", visibilityHandler);
  window.addEventListener("focus", visibilityHandler);
};

export const stopReminderPolling = () => {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
  // Clear scheduled timers
  for (const id of Object.values(scheduledTimers)) {
    clearTimeout(id);
  }
  scheduledTimers = {};

  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    window.removeEventListener("focus", visibilityHandler);
    visibilityHandler = null;
  }
  // Clear cached data
  remindersCache = null;
  reminderToaster = null;
};

// ─── CLEANUP ────────────────────────────────────────────────────────

export const cleanupOldReminders = (daysThreshold = 30) => {
  loadReminders();
  const threshold = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;
  let removedCount = 0;

  for (const [id, reminder] of Object.entries(remindersCache)) {
    if (
      reminder.dismissed &&
      reminder.firedAt &&
      reminder.firedAt < threshold
    ) {
      delete remindersCache[id];
      // Also clean up multi-tab guard keys
      try {
        extensionStorage.set(FIRED_KEY_PREFIX + id, null);
      } catch (e) {}
      removedCount++;
    }
  }

  if (removedCount > 0) {
    persistReminders();
    console.log(`[Reminder] Cleaned up ${removedCount} old reminders`);
  }
  return { removedCount };
};

// ─── DELAY PARSER ───────────────────────────────────────────────────

const _unitToMs = (unit) => {
  if (!unit) return 60000; // default: minutes
  const u = unit.toLowerCase();
  if (/^s(ec(ond)?s?)?$/.test(u)) return 1000;
  if (/^m(in(ute)?s?)?$/.test(u)) return 60000;
  if (/^h(r?s?|our?s?)?$/.test(u)) return 3600000;
  if (/^d(ay?s?)?$/.test(u)) return 86400000;
  if (/^w(k?s?|eek?s?)?$/.test(u)) return 604800000;
  return null;
};

const NUM = "(\\d+(?:[.,]\\d+)?)";
const UNIT =
  "(min(?:utes?)?|h(?:r?s?|ours?)?|d(?:ays?)?|w(?:k?s?|eeks?)?|s(?:ec(?:ond)?s?)?)";
const OPT_UNIT = UNIT + "?";

/**
 * Parses a reminder delay expression from block content.
 * Returns { delayMs, fromNow } where:
 *   fromNow=true  → remind at now + delayMs  (+5, +5min, in 5min, for 2h)
 *   fromNow=false → remind delayMs BEFORE event time  (-5min, 5min before, 10 before)
 * Returns null if no expression found.
 */
export const parseDelayFromContent = (content) => {
  if (!content) return null;
  const s = content;

  // "in X [unit]" or "for X [unit]" → from now
  let m = s.match(new RegExp(`(?:in|for)\\s+${NUM}\\s*${OPT_UNIT}`, "i"));
  if (m) {
    const ms = parseFloat(m[1].replace(",", ".")) * (_unitToMs(m[2]) ?? 60000);
    if (ms > 0) return { delayMs: Math.round(ms), fromNow: true, raw: m[0] };
  }

  // "+X [unit]" → from now
  m = s.match(new RegExp(`\\+${NUM}\\s*${OPT_UNIT}`, "i"));
  if (m) {
    const ms = parseFloat(m[1].replace(",", ".")) * (_unitToMs(m[2]) ?? 60000);
    if (ms > 0) return { delayMs: Math.round(ms), fromNow: true, raw: m[0] };
  }

  // "-X unit" → before event
  m = s.match(new RegExp(`-${NUM}\\s*${UNIT}`, "i"));
  if (m) {
    const ms = parseFloat(m[1].replace(",", ".")) * (_unitToMs(m[2]) ?? 60000);
    if (ms > 0) return { delayMs: Math.round(ms), fromNow: false, raw: m[0] };
  }

  // "X [unit] before" → before event
  m = s.match(new RegExp(`${NUM}\\s*${OPT_UNIT}\\s+before`, "i"));
  if (m) {
    const ms = parseFloat(m[1].replace(",", ".")) * (_unitToMs(m[2]) ?? 60000);
    if (ms > 0) return { delayMs: Math.round(ms), fromNow: false, raw: m[0] };
  }

  return null;
};

// ─── SLASH COMMAND SUPPORT ──────────────────────────────────────────

export const showReminderDialogForBlock = (blockUid) => {
  const React = require("react");
  const ReactDOM = require("react-dom");
  const ReminderDialog = require("../components/ReminderDialog").default;

  const content = getBlockContentByUid(blockUid) || "";

  // Try to parse date from block content or parent DNP
  let eventDate = "";
  let eventTime = null;

  // Try to get date from parent page (DNP format: MM-DD-YYYY)
  try {
    const parentUid = window.roamAlphaAPI.q(
      `[:find ?uid . :where [?b :block/uid "${blockUid}"] [?b :block/page ?p] [?p :block/uid ?uid]]`,
    );
    if (parentUid) {
      const parts = parentUid.split("-");
      if (parts.length === 3 && parts[2].length === 4) {
        eventDate = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
      }
    }
  } catch (e) {}

  // Parse time from block content
  const {
    parseRange,
    getNormalizedTimestamp,
    strictTimestampRegex,
  } = require("../util/dates");
  const parsedRange = parseRange(content);
  if (parsedRange) {
    eventTime = parsedRange.range.start;
  } else {
    const parsedTime = getNormalizedTimestamp(content, strictTimestampRegex);
    if (parsedTime) eventTime = parsedTime.timestamp;
  }

  // Parse delay expression from block content
  const parsedDelay = parseDelayFromContent(content);

  // Create container and render dialog
  const container = document.createElement("div");
  container.id = "fc-reminder-dialog-portal";
  document.body.appendChild(container);

  const cleanup = () => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  };

  const DialogWrapper = () => {
    const [isOpen, setIsOpen] = React.useState(true);
    return React.createElement(ReminderDialog, {
      isOpen,
      setIsOpen: (val) => {
        setIsOpen(val);
        if (!val) setTimeout(cleanup, 100);
      },
      blockUid,
      eventTitle: content,
      eventDate,
      eventTime,
      parsedDelay,
      existingReminder: getRemindersForEvent(blockUid)[0] || null,
      onSave: () => {},
      onDelete: () => {},
    });
  };

  ReactDOM.render(React.createElement(DialogWrapper), container);
};
