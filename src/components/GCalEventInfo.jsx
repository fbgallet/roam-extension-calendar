/**
 * GCalEventInfo - Reusable component to display Google Calendar event information
 * Used for synced events and matched-but-unsynced events
 */

import { Icon, Tooltip } from "@blueprintjs/core";
import { parseHtmlToReact } from "../util/htmlParser";
import GoogleCalendarIconSvg from "../services/google-calendar.svg";

const GCalEventInfo = ({
  calendarName,
  location,
  attendees,
  description,
  attachments,
  htmlLink,
  showClickableCalendar = false,
  onCalendarClick,
}) => {
  return (
    <div className="fc-gcal-event-info">
      {/* Calendar name */}
      <Tooltip content="View in Google Calendar" position="top">
        {calendarName && (
          <div
            className={
              showClickableCalendar
                ? "fc-gcal-calendar-source fc-gcal-calendar-source-clickable"
                : "fc-gcal-calendar-source"
            }
            onClick={showClickableCalendar ? onCalendarClick : undefined}
            style={showClickableCalendar ? { cursor: "pointer" } : undefined}
          >
            <GoogleCalendarIconSvg
              className="fc-gcal-icon-small"
              style={{ width: "16px", height: "16px" }}
            />
            <span>{calendarName}</span>
          </div>
        )}
      </Tooltip>

      {/* Location */}
      {location && (
        <div className="fc-gcal-location">
          <Icon icon="map-marker" size={12} />
          <span>{location}</span>
        </div>
      )}

      {/* Attendees */}
      {attendees && attendees.length > 0 && (
        <div className="fc-gcal-attendees">
          <Icon icon="people" size={12} />
          <span>
            {attendees
              .slice(0, 3)
              .map((a) => a.displayName || a.email)
              .join(", ")}
            {attendees.length > 3 && ` +${attendees.length - 3} more`}
          </span>
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="fc-gcal-description">
          {typeof description === "string"
            ? parseHtmlToReact(description)
            : description}
        </div>
      )}

      {/* Attachments */}
      {attachments && attachments.length > 0 && (
        <div className="fc-gcal-attachments">
          <div className="fc-gcal-attachments-header">
            <Icon icon="paperclip" size={12} />
            <span>Attachments ({attachments.length})</span>
          </div>
          <ul className="fc-gcal-attachments-list">
            {attachments.map((attachment, index) => (
              <li key={index}>
                <a
                  href={attachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {attachment.iconLink && (
                    <img
                      src={attachment.iconLink}
                      alt=""
                      className="fc-attachment-icon"
                    />
                  )}
                  <span className="fc-attachment-title">
                    {attachment.title || "Untitled"}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GCalEventInfo;
