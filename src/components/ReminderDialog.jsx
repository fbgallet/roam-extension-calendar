import {
  Button,
  Dialog,
  Radio,
  Icon,
  HTMLSelect,
} from "@blueprintjs/core";
import { DateInput, TimePicker, TimePrecision } from "@blueprintjs/datetime";
import "@blueprintjs/datetime/lib/css/blueprint-datetime.css";
import { useState, useEffect, useMemo } from "react";
import { getTimestampFromHM } from "../util/dates";
import {
  createReminder,
  calculateRemindAt,
  deleteReminder,
  saveReminder,
  DELAY_OPTIONS_WITH_TIME,
  requestNotificationPermission,
} from "../services/reminderService";

const FROM_NOW_UNITS = [
  { label: "min", ms: 60 * 1000 },
  { label: "hour", ms: 60 * 60 * 1000 },
  { label: "day", ms: 24 * 60 * 60 * 1000 },
  { label: "week", ms: 7 * 24 * 60 * 60 * 1000 },
];

const formatDateDisplay = (date) =>
  date ? date.toLocaleDateString([], { year: "numeric", month: "2-digit", day: "2-digit" }) : "";

const parseDateInput = (str) => {
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

const ReminderDialog = ({
  isOpen,
  setIsOpen,
  blockUid,
  eventTitle,
  eventDate,
  eventTime,
  eventEndTime,
  eventDueTime,
  parsedDelay,
  existingReminder,
  onSave,
  onDelete,
}) => {
  const availableTimes = useMemo(() => {
    const times = [];
    if (eventTime) times.push({ label: `Start (${eventTime})`, value: eventTime, key: "start" });
    if (eventEndTime && eventEndTime !== eventTime)
      times.push({ label: `End (${eventEndTime})`, value: eventEndTime, key: "end" });
    if (eventDueTime && eventDueTime !== eventTime && eventDueTime !== eventEndTime)
      times.push({ label: `Due (${eventDueTime})`, value: eventDueTime, key: "due" });
    return times;
  }, [eventTime, eventEndTime, eventDueTime]);

  const getDefaultRefTime = () => {
    if (availableTimes.length === 0) return null;
    if (availableTimes.length === 1) return availableTimes[0].value;
    if (eventDate && eventTime) {
      const now = new Date();
      const [h, m] = eventTime.split(":").map(Number);
      const startDate = new Date(eventDate);
      startDate.setHours(h, m, 0, 0);
      if (startDate < now)
        return availableTimes.length > 1 ? availableTimes[1].value : availableTimes[0].value;
    }
    return availableTimes[0].value;
  };

  const hasTime = availableTimes.length > 0;

  const [selectedDelay, setSelectedDelay] = useState(hasTime ? "Exact time" : "from_now");
  const [referenceTime, setReferenceTime] = useState(getDefaultRefTime());
  const [fromNowAmount, setFromNowAmount] = useState(10);
  const [fromNowUnit, setFromNowUnit] = useState("min");
  const [customDateTime, setCustomDateTime] = useState(null);

  const getFromNowMs = () => {
    const unitMs = FROM_NOW_UNITS.find((u) => u.label === fromNowUnit)?.ms ?? 60000;
    return (fromNowAmount || 1) * unitMs;
  };

  const previewTime = useMemo(() => {
    if (selectedDelay === "custom") return customDateTime || null;
    if (selectedDelay === "from_now") return new Date(Date.now() + getFromNowMs());
    const ts = calculateRemindAt(eventDate, referenceTime || eventTime, selectedDelay, referenceTime);
    return ts ? new Date(ts) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDelay, customDateTime, fromNowAmount, fromNowUnit, eventDate, eventTime, referenceTime]);

  useEffect(() => {
    if (!isOpen) return;

    if (existingReminder) {
      const remindAt = existingReminder.snoozedUntil || existingReminder.remindAt;
      let matched = false;
      if (hasTime) {
        const refTime = getDefaultRefTime();
        for (const option of DELAY_OPTIONS_WITH_TIME) {
          if (option === "Custom") continue;
          const calc = calculateRemindAt(eventDate, refTime || eventTime, option, refTime);
          if (calc && Math.abs(calc - remindAt) < 60000) {
            setSelectedDelay(option);
            setReferenceTime(refTime);
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        setSelectedDelay("custom");
        setCustomDateTime(new Date(remindAt));
      }
    } else if (parsedDelay) {
      const refTime = getDefaultRefTime();
      setReferenceTime(refTime);
      if (parsedDelay.fromNow) {
        const bestUnit = [...FROM_NOW_UNITS].reverse().find(
          (u) => parsedDelay.delayMs >= u.ms && parsedDelay.delayMs % u.ms === 0
        ) || FROM_NOW_UNITS[0];
        setFromNowAmount(parsedDelay.delayMs / bestUnit.ms);
        setFromNowUnit(bestUnit.label);
        setSelectedDelay("from_now");
      } else {
        const refT = refTime || eventTime;
        if (refT && eventDate) {
          const [h, m] = refT.split(":").map(Number);
          const d = new Date(eventDate);
          d.setHours(h, m, 0, 0);
          setCustomDateTime(new Date(d.getTime() - parsedDelay.delayMs));
        } else {
          const d = eventDate ? new Date(eventDate) : new Date();
          d.setHours(9, 0, 0, 0);
          setCustomDateTime(d);
        }
        setSelectedDelay("custom");
      }
    } else {
      setSelectedDelay(hasTime ? "Exact time" : "from_now");
      setReferenceTime(getDefaultRefTime());
      const d = eventDate ? new Date(eventDate) : new Date();
      d.setHours(9, 0, 0, 0);
      setCustomDateTime(d);
    }
  }, [isOpen, eventTime, eventDate]);

  const formatPreview = (date) => {
    if (!date) return "";
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    const timeStr = getTimestampFromHM(date.getHours(), date.getMinutes());
    if (isToday) return `Today at ${timeStr}`;
    return `${date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at ${timeStr}`;
  };

  const handleSave = async () => {
    let remindAt;
    if (selectedDelay === "custom") {
      if (!customDateTime) return;
      remindAt = customDateTime.getTime();
    } else if (selectedDelay === "from_now") {
      remindAt = Date.now() + getFromNowMs();
    } else {
      remindAt = calculateRemindAt(eventDate, referenceTime || eventTime, selectedDelay, referenceTime);
    }
    if (!remindAt) return;

    await requestNotificationPermission();

    let reminder;
    if (existingReminder) {
      existingReminder.remindAt = remindAt;
      existingReminder.snoozedUntil = null;
      existingReminder.firedAt = null;
      existingReminder.dismissed = false;
      reminder = saveReminder(existingReminder);
    } else {
      reminder = createReminder({
        eventId: blockUid,
        eventTitle: eventTitle || "",
        eventDate,
        eventTime: referenceTime || eventTime,
        remindAt,
        source: "manual",
      });
    }

    if (onSave) onSave(reminder);
    setIsOpen(false);
  };

  const handleDelete = () => {
    if (existingReminder) {
      deleteReminder(existingReminder.id);
      if (onDelete) onDelete();
    }
    setIsOpen(false);
  };

  return (
    <Dialog
      className="fc-reminder-dialog"
      title={existingReminder ? "Edit Reminder" : "Set Reminder"}
      icon="notifications"
      isOpen={isOpen}
      canOutsideClickClose={true}
      onClose={() => setIsOpen(false)}
    >
      <div className="fc-reminder-dialog-body">
        {eventTitle && (
          <div className="fc-reminder-event-header">
            <Icon icon="calendar" size={14} />
            <span>{eventTitle.length > 70 ? eventTitle.substring(0, 67) + "..." : eventTitle}</span>
          </div>
        )}

        {parsedDelay && !existingReminder && (
          <div className="fc-reminder-parsed-hint">
            <Icon icon="automatic-updates" size={12} />
            <span>
              From block: <strong>{parsedDelay.raw}</strong>
              {" — "}
              {parsedDelay.fromNow ? "from now" : "before event"}
            </span>
          </div>
        )}

        {availableTimes.length > 1 && selectedDelay !== "from_now" && selectedDelay !== "custom" && (
          <div className="fc-reminder-ref-time">
            <span className="fc-reminder-ref-label">Based on:</span>
            <HTMLSelect
              value={referenceTime}
              onChange={(e) => setReferenceTime(e.target.value)}
              minimal
              small
            >
              {availableTimes.map((t) => (
                <option key={t.key} value={t.value}>{t.label}</option>
              ))}
            </HTMLSelect>
          </div>
        )}

        <div className="fc-reminder-options">
          {hasTime && (
            <>
              <div className="fc-reminder-group-label">Before event</div>
              {DELAY_OPTIONS_WITH_TIME.filter((o) => o !== "Custom").map((option) => (
                <Radio
                  key={option}
                  name="fc-reminder"
                  value={option}
                  checked={selectedDelay === option}
                  onChange={() => setSelectedDelay(option)}
                  label={option === "Exact time" ? `At event time (${referenceTime || eventTime})` : option}
                />
              ))}
              <div className="fc-reminder-group-label fc-reminder-group-label--second">From now</div>
            </>
          )}

          <Radio
            name="fc-reminder"
            value="from_now"
            checked={selectedDelay === "from_now"}
            onChange={() => setSelectedDelay("from_now")}
            labelElement={
              <span className="fc-reminder-from-now-row" onClick={() => setSelectedDelay("from_now")}>
                In&nbsp;
                <input
                  type="number"
                  min="1"
                  value={fromNowAmount}
                  onClick={(e) => { e.stopPropagation(); setSelectedDelay("from_now"); }}
                  onChange={(e) => {
                    setFromNowAmount(Math.max(1, parseInt(e.target.value) || 1));
                    setSelectedDelay("from_now");
                  }}
                  className="fc-reminder-amount-input"
                />
                <HTMLSelect
                  value={fromNowUnit}
                  onClick={(e) => { e.stopPropagation(); setSelectedDelay("from_now"); }}
                  onChange={(e) => {
                    const unit = e.target.value;
                    setFromNowUnit(unit);
                    setFromNowAmount(unit === "min" ? 10 : 1);
                    setSelectedDelay("from_now");
                  }}
                  minimal
                  small
                >
                  {FROM_NOW_UNITS.map((u) => (
                    <option key={u.label} value={u.label}>
                      {fromNowAmount === 1 ? u.label : u.label + "s"}
                    </option>
                  ))}
                </HTMLSelect>
              </span>
            }
          />

          <Radio
            name="fc-reminder"
            value="custom"
            checked={selectedDelay === "custom"}
            onChange={() => setSelectedDelay("custom")}
            label="Custom date & time"
          />
        </div>

        {selectedDelay === "custom" && (
          <div className="fc-reminder-custom-time">
            <DateInput
              value={customDateTime}
              onChange={(d) => {
                if (!d) return;
                const next = new Date(customDateTime || d);
                next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                setCustomDateTime(next);
              }}
              formatDate={formatDateDisplay}
              parseDate={parseDateInput}
              placeholder="Date"
              popoverProps={{ minimal: true }}
              inputProps={{ small: true }}
            />
            <TimePicker
              value={customDateTime || new Date()}
              onChange={(d) => {
                const next = new Date(customDateTime || new Date());
                next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                setCustomDateTime(next);
              }}
              precision={TimePrecision.MINUTE}
              showArrowButtons={false}
            />
          </div>
        )}

        {previewTime && (
          <div className="fc-reminder-preview">
            <Icon icon="time" size={12} />
            <span>{formatPreview(previewTime)}</span>
          </div>
        )}
      </div>

      <div className="fc-reminder-dialog-footer">
        {existingReminder && (
          <Button intent="danger" text="Remove" icon="trash" small minimal onClick={handleDelete} />
        )}
        <div className="fc-reminder-dialog-buttons">
          <Button text="Cancel" small onClick={() => setIsOpen(false)} />
          <Button intent="primary" text="Save" icon="notifications" small onClick={handleSave} />
        </div>
      </div>
    </Dialog>
  );
};

export default ReminderDialog;
