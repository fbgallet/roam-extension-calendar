/**
 * ConflictDialog - Dialog for resolving sync conflicts between Roam and Google Calendar
 */

import { Button, Dialog, Icon, Card, Callout } from "@blueprintjs/core";

const ConflictDialog = ({
  isOpen,
  onClose,
  conflicts,
  onResolve,
}) => {
  if (!conflicts || conflicts.length === 0) return null;

  const currentConflict = conflicts[0];
  const { roamUid, gCalEvent, metadata, calendarConfig } = currentConflict;

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const gcalStart = gCalEvent.start.dateTime || gCalEvent.start.date;
  const gcalEnd = gCalEvent.end?.dateTime || gCalEvent.end?.date;
  const isAllDay = !gCalEvent.start.dateTime;

  return (
    <Dialog
      className="fc-conflict-dialog"
      title="Sync Conflict Detected"
      icon="warning-sign"
      isOpen={isOpen}
      canOutsideClickClose={false}
      onClose={onClose}
    >
      <div className="fc-conflict-content">
        <Callout intent="warning" icon="info-sign">
          This event was modified in both Roam and Google Calendar since the last sync.
          Choose which version to keep.
        </Callout>

        <div className="fc-conflict-versions">
          <Card className="fc-conflict-version fc-conflict-roam">
            <div className="fc-conflict-header">
              <Icon icon="document" />
              <h4>Roam Version</h4>
            </div>
            <div className="fc-conflict-details">
              <p className="fc-conflict-label">Block UID:</p>
              <p className="fc-conflict-value">{roamUid}</p>
              <p className="fc-conflict-label">Last Modified:</p>
              <p className="fc-conflict-value">
                {metadata.roamUpdated
                  ? formatDateTime(new Date(metadata.roamUpdated))
                  : "Unknown"}
              </p>
            </div>
            <Button
              intent="primary"
              icon="tick"
              text="Keep Roam Version"
              onClick={() => onResolve(currentConflict, "roam")}
              fill
            />
          </Card>

          <Card className="fc-conflict-version fc-conflict-gcal">
            <div className="fc-conflict-header">
              <Icon icon="calendar" />
              <h4>Google Calendar Version</h4>
            </div>
            <div className="fc-conflict-details">
              <p className="fc-conflict-label">Title:</p>
              <p className="fc-conflict-value">{gCalEvent.summary || "(No title)"}</p>
              <p className="fc-conflict-label">When:</p>
              <p className="fc-conflict-value">
                {isAllDay
                  ? new Date(gcalStart).toLocaleDateString()
                  : formatDateTime(gcalStart)}
                {gcalEnd && !isAllDay && (
                  <>
                    {" - "}
                    {new Date(gcalEnd).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </>
                )}
              </p>
              <p className="fc-conflict-label">Last Modified:</p>
              <p className="fc-conflict-value">{formatDateTime(gCalEvent.updated)}</p>
              {gCalEvent.description && (
                <>
                  <p className="fc-conflict-label">Description:</p>
                  <p className="fc-conflict-value fc-conflict-description">
                    {gCalEvent.description}
                  </p>
                </>
              )}
            </div>
            <Button
              intent="primary"
              icon="tick"
              text="Keep Google Calendar Version"
              onClick={() => onResolve(currentConflict, "gcal")}
              fill
            />
          </Card>
        </div>

        <div className="fc-conflict-actions">
          <Button
            minimal
            icon="duplicate"
            text="Keep Both (create duplicate in Roam)"
            onClick={() => onResolve(currentConflict, "both")}
          />
          <Button
            minimal
            text="Skip"
            onClick={onClose}
          />
        </div>

        {conflicts.length > 1 && (
          <p className="fc-conflict-remaining">
            {conflicts.length - 1} more conflict{conflicts.length > 2 ? "s" : ""} remaining
          </p>
        )}
      </div>
    </Dialog>
  );
};

export default ConflictDialog;
