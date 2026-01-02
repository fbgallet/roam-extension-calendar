/**
 * SyncEventsDialog - Batch sync dialog for syncing multiple events in current view
 *
 * Features:
 * - Two separate lists: Roam blocks (export to GCal) and GCal events (import to Roam)
 * - Roam blocks rendered with Roam API
 * - Auto-select Roam events with trigger tags
 * - Separate Select All/None buttons for each list
 * - Sync/Import buttons that handle both directions
 */

import {
  Button,
  Dialog,
  Checkbox,
  Icon,
  Tooltip,
  Divider,
} from "@blueprintjs/core";
import { useState, useEffect, useRef, useMemo } from "react";
import { getEvents as getGCalEvents } from "../services/googleCalendarService";
import {
  findMatchingGCalEvents,
  linkEventToExistingGCal,
  applyImport,
} from "../services/syncService";
import { createEvent as createGCalEvent } from "../services/googleCalendarService";
import { fcEventToGCalEvent } from "../util/gcalMapping";
import {
  saveSyncMetadata,
  createSyncMetadata,
  getSyncMetadata,
} from "../models/SyncMetadata";
import { getBlockContentByUid, addTagToBlock } from "../util/roamApi";
import GoogleCalendarIconSvg from "../services/google-calendar.svg";

const SyncEventsDialog = ({
  isOpen,
  onClose,
  events, // All events in current view
  targetCalendar, // The calendar to sync to
  refreshCalendar,
}) => {
  const [selectedRoamEvents, setSelectedRoamEvents] = useState(new Set());
  const [selectedGCalEvents, setSelectedGCalEvents] = useState(new Set());
  const [gcalOnlyEvents, setGcalOnlyEvents] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const roamBlockRefs = useRef({});

  // Filter Roam events (syncable blocks only - not synced, not GCal-only)
  const roamEvents = useMemo(() => {
    return events.filter((evt) => {
      // Must be a Roam block (not GCal or GTask event)
      if (evt.extendedProps?.isGCalEvent || evt.extendedProps?.isGTaskEvent)
        return false;

      // Must not already be synced
      if (evt.extendedProps?.gCalId) return false;

      return true;
    });
  }, [events]);

  // Check if event has a trigger tag for the target calendar
  const hasMatchingTriggerTag = (event, calendar) => {
    if (!calendar?.triggerTags) return false;

    const eventTags = event.extendedProps?.eventTags || [];
    const eventTagNames = eventTags.map((tag) => tag.name?.toLowerCase());

    return calendar.triggerTags.some((triggerTag) =>
      eventTagNames.includes(triggerTag.toLowerCase())
    );
  };

  // Fetch GCal-only events (not synced to Roam) for current view
  useEffect(() => {
    const fetchGCalOnlyEvents = async () => {
      if (!isOpen || !targetCalendar) {
        setGcalOnlyEvents([]);
        return;
      }

      try {
        // Get date range from events in view
        if (events.length === 0) return;

        const dates = events.map((e) => new Date(e.start).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        // Fetch GCal events for this range
        const gcalEvents = await getGCalEvents(
          targetCalendar.id,
          minDate,
          maxDate
        );

        // Filter to only non-synced events
        const unsyncedGCalEvents = gcalEvents.filter((gcalEvent) => {
          // Skip cancelled events
          if (gcalEvent.status === "cancelled") return false;

          // Check if already synced to a Roam block
          // Method 1: Check if description contains Roam block link
          if (gcalEvent.description) {
            const hasRoamLink =
              /Roam block:\s*https:\/\/roamresearch\.com\/#\/app\/[^/]+\/page\/[a-zA-Z0-9_-]{9}/.test(
                gcalEvent.description
              );
            if (hasRoamLink) return false;
          }

          // Method 2: Check sync metadata (reverse lookup)
          // This is more reliable but requires iterating through all synced events
          const allSyncedMetadata = Object.values(getSyncMetadata() || {});
          const isSynced = allSyncedMetadata.some(
            (meta) => meta.gCalId === gcalEvent.id
          );
          if (isSynced) return false;

          return true;
        });

        setGcalOnlyEvents(unsyncedGCalEvents);
      } catch (error) {
        console.error("Failed to fetch GCal-only events:", error);
        setGcalOnlyEvents([]);
      }
    };

    fetchGCalOnlyEvents();
  }, [isOpen, targetCalendar, events]);

  // Auto-select Roam events with trigger tags when dialog opens
  useEffect(() => {
    if (!isOpen || !targetCalendar) {
      setSelectedRoamEvents(new Set());
      setSelectedGCalEvents(new Set());
      return;
    }

    const autoSelected = new Set();
    roamEvents.forEach((event) => {
      if (hasMatchingTriggerTag(event, targetCalendar)) {
        autoSelected.add(event.id);
      }
    });
    setSelectedRoamEvents(autoSelected);
  }, [isOpen, targetCalendar, roamEvents]); // Use roamEvents directly

  // Render Roam blocks using Roam API
  useEffect(() => {
    if (!isOpen) return;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      roamEvents.forEach((event) => {
        const container = roamBlockRefs.current[event.id];
        if (container && !container.hasChildNodes()) {
          try {
            window.roamAlphaAPI.ui.components.renderBlock({
              uid: event.id,
              el: container,
              "zoom-path?": event.isRef,
              "open?": false,
            });
          } catch (error) {
            console.error(`Failed to render Roam block ${event.id}:`, error);
            // Fallback to plain text if Roam API fails
            container.textContent = event.title;
          }
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, roamEvents]);

  const handleToggleRoamEvent = (eventId) => {
    setSelectedRoamEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const handleToggleGCalEvent = (eventId) => {
    setSelectedGCalEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const handleSelectAllRoam = () => {
    setSelectedRoamEvents(new Set(roamEvents.map((e) => e.id)));
  };

  const handleDeselectAllRoam = () => {
    setSelectedRoamEvents(new Set());
  };

  const handleSelectAllGCal = () => {
    setSelectedGCalEvents(new Set(gcalOnlyEvents.map((e) => e.id)));
  };

  const handleDeselectAllGCal = () => {
    setSelectedGCalEvents(new Set());
  };

  const handleSync = async () => {
    const totalOperations = selectedRoamEvents.size + selectedGCalEvents.size;
    if (!targetCalendar || totalOperations === 0) return;

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: totalOperations });

    let roamSynced = 0;
    let roamLinked = 0;
    let gcalImported = 0;
    let failed = 0;

    // Export Roam events to GCal
    const roamEventsToSync = roamEvents.filter((e) =>
      selectedRoamEvents.has(e.id)
    );
    for (const event of roamEventsToSync) {
      try {
        setSyncProgress((prev) => ({ ...prev, current: prev.current + 1 }));

        // Check for matching GCal events
        const matchingEvents = await findMatchingGCalEvents(
          event,
          targetCalendar.id
        );

        if (matchingEvents.length > 0) {
          // Link to first matching event
          const result = await linkEventToExistingGCal(
            event.id,
            event,
            matchingEvents[0],
            targetCalendar.id
          );

          if (result.success) {
            roamLinked++;
            // Add trigger tag to Roam block
            const tagToAdd =
              targetCalendar.triggerTags?.[0] ||
              targetCalendar.displayName ||
              "Google Calendar";
            await addTagToBlock(event.id, tagToAdd);
          } else {
            failed++;
          }
        } else {
          // Create new GCal event
          const blockContent = getBlockContentByUid(event.id);
          const fcEvent = {
            ...event,
            title: blockContent || event.title,
            start: event.start,
            end: event.end,
            extendedProps: { ...event.extendedProps },
          };

          const gcalEventData = fcEventToGCalEvent(
            fcEvent,
            targetCalendar.id,
            event.id
          );
          const createdEvent = await createGCalEvent(
            targetCalendar.id,
            gcalEventData
          );

          // Save sync metadata
          await saveSyncMetadata(
            event.id,
            createSyncMetadata({
              gCalId: createdEvent.id,
              gCalCalendarId: targetCalendar.id,
              etag: createdEvent.etag,
              gCalUpdated: createdEvent.updated,
              roamUpdated: Date.now(),
            })
          );

          roamSynced++;
          // Add trigger tag to Roam block
          const tagToAdd =
            targetCalendar.triggerTags?.[0] ||
            targetCalendar.displayName ||
            "Google Calendar";
          await addTagToBlock(event.id, tagToAdd);
        }
      } catch (error) {
        console.error(`Failed to sync Roam event ${event.id}:`, error);
        failed++;
      }
    }

    // Import GCal events to Roam
    const gcalEventsToImport = gcalOnlyEvents.filter((e) =>
      selectedGCalEvents.has(e.id)
    );
    for (const gcalEvent of gcalEventsToImport) {
      try {
        setSyncProgress((prev) => ({ ...prev, current: prev.current + 1 }));

        // Use applyImport to create Roam block from GCal event
        const result = await applyImport(gcalEvent, targetCalendar);

        if (result.success) {
          gcalImported++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to import GCal event ${gcalEvent.id}:`, error);
        failed++;
      }
    }

    console.log(
      `[Batch Sync] Complete: ${roamSynced} exported, ${roamLinked} linked, ${gcalImported} imported, ${failed} failed`
    );

    // Reset state
    setIsSyncing(false);
    setSyncProgress({ current: 0, total: 0 });
    setSelectedRoamEvents(new Set());
    setSelectedGCalEvents(new Set());

    // Refresh calendar to show synced events
    if (refreshCalendar) {
      await refreshCalendar();
    }

    onClose();
  };

  const totalSelected = selectedRoamEvents.size + selectedGCalEvents.size;
  const hasAnyEvents = roamEvents.length > 0 || gcalOnlyEvents.length > 0;

  if (!hasAnyEvents) {
    return (
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Sync Events"
        icon="cloud-upload"
        className="fc-sync-dialog"
      >
        <div className="fc-sync-dialog-content">
          <p>No syncable events found in the current view.</p>
          <p style={{ fontSize: "12px", color: "#5C7080", marginTop: "8px" }}>
            Only Roam blocks and Google Calendar events that are not already
            synced can be synced.
          </p>
        </div>
        <div className="fc-sync-dialog-footer">
          <Button text="Close" onClick={onClose} />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Sync with ${targetCalendar?.displayName || "Google Calendar"}`}
      icon="sync"
      className="fc-sync-dialog"
    >
      <div className="fc-sync-dialog-content">
        {/* Roam Events Section */}
        {roamEvents.length > 0 && (
          <>
            <div style={{ marginBottom: "12px" }}>
              <div className="fc-sync-section-header">
                <div className="fc-sync-section-title">
                  <Icon icon="export" size={14} style={{ color: "#5C7080" }} />
                  <span className="fc-sync-section-title-text">
                    Export to Google Calendar
                  </span>
                  <span className="fc-sync-section-count">
                    ({selectedRoamEvents.size} of {roamEvents.length} selected)
                  </span>
                </div>
                <div className="fc-sync-section-buttons">
                  <Button
                    minimal
                    small
                    text="Select All"
                    onClick={handleSelectAllRoam}
                  />
                  <Button
                    minimal
                    small
                    text="None"
                    onClick={handleDeselectAllRoam}
                  />
                </div>
              </div>

              <div className="fc-sync-events-list">
                {roamEvents.map((event) => {
                  const hasTriggerTag = hasMatchingTriggerTag(event, targetCalendar);
                  const hasMatchingEvent =
                    event.extendedProps?.hasMatchingGCalEvent === true;
                  const isSelected = selectedRoamEvents.has(event.id);

                  return (
                    <div
                      key={event.id}
                      className={`fc-sync-event-item ${isSelected ? "fc-selected" : ""}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleToggleRoamEvent(event.id)}
                        style={{ marginTop: "2px" }}
                      />

                      <div className="fc-sync-event-content">
                        {/* Roam block rendered by API */}
                        <div
                          ref={(el) => (roamBlockRefs.current[event.id] = el)}
                          className="fc-sync-roam-block"
                        />

                        {/* Metadata row */}
                        <div className="fc-sync-event-metadata">
                          <div className="fc-sync-event-date">
                            {event.extendedProps?.hasTime
                              ? new Date(event.start).toLocaleString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : new Date(event.start).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                  }
                                )}
                          </div>
                          {hasTriggerTag && (
                            <Tooltip content="Has trigger tag" position="top">
                              <Icon
                                icon="tag"
                                size={11}
                                style={{ color: "#0F9960" }}
                              />
                            </Tooltip>
                          )}
                          {hasMatchingEvent && (
                            <Tooltip
                              content="Matches existing GCal event"
                              position="top"
                            >
                              <Icon
                                icon="outdated"
                                size={11}
                                style={{ color: "#5C7080" }}
                              />
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Divider between sections */}
        {roamEvents.length > 0 && gcalOnlyEvents.length > 0 && (
          <Divider style={{ margin: "16px 0" }} />
        )}

        {/* GCal Events Section */}
        {gcalOnlyEvents.length > 0 && (
          <>
            <div style={{ marginBottom: "12px" }}>
              <div className="fc-sync-section-header">
                <div className="fc-sync-section-title">
                  <Icon icon="import" size={14} style={{ color: "#5C7080" }} />
                  <span className="fc-sync-section-title-text">
                    Import from Google Calendar
                  </span>
                  <span className="fc-sync-section-count">
                    ({selectedGCalEvents.size} of {gcalOnlyEvents.length}{" "}
                    selected)
                  </span>
                </div>
                <div className="fc-sync-section-buttons">
                  <Button
                    minimal
                    small
                    text="Select All"
                    onClick={handleSelectAllGCal}
                  />
                  <Button
                    minimal
                    small
                    text="None"
                    onClick={handleDeselectAllGCal}
                  />
                </div>
              </div>

              <div className="fc-sync-events-list">
                {gcalOnlyEvents.map((gcalEvent) => {
                  const eventStart =
                    gcalEvent.start?.dateTime || gcalEvent.start?.date;
                  const hasTime = !!gcalEvent.start?.dateTime;
                  const isSelected = selectedGCalEvents.has(gcalEvent.id);

                  return (
                    <div
                      key={gcalEvent.id}
                      className={`fc-sync-event-item ${isSelected ? "fc-selected" : ""}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleToggleGCalEvent(gcalEvent.id)}
                        style={{ marginTop: "2px" }}
                      />

                      <div className="fc-sync-event-content">
                        {/* GCal event title with icon */}
                        <div
                          className="fc-sync-gcal-title"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (gcalEvent.htmlLink) {
                              window.open(gcalEvent.htmlLink, "_blank");
                            }
                          }}
                        >
                          <GoogleCalendarIconSvg
                            style={{
                              width: "14px",
                              height: "14px",
                              flexShrink: 0,
                            }}
                          />
                          <span className="fc-sync-gcal-title-text">
                            {gcalEvent.summary || "(No title)"}
                          </span>
                          <Icon
                            icon="share"
                            size={10}
                            style={{ color: "#5C7080", opacity: 0.6 }}
                          />
                        </div>

                        {/* Date/time */}
                        <div className="fc-sync-event-date">
                          {hasTime
                            ? new Date(eventStart).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : new Date(eventStart).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Progress indicator */}
        {isSyncing && (
          <div className="fc-sync-progress">
            <div className="fc-sync-progress-text">
              Processing {syncProgress.current} of {syncProgress.total}...
            </div>
            <div className="fc-sync-progress-bar">
              <div
                className="fc-sync-progress-bar-fill"
                style={{
                  width: `${
                    (syncProgress.current / syncProgress.total) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fc-sync-dialog-footer">
        <div className="fc-sync-footer-summary">
          {selectedRoamEvents.size > 0 &&
            `${selectedRoamEvents.size} to export`}
          {selectedRoamEvents.size > 0 && selectedGCalEvents.size > 0 && " • "}
          {selectedGCalEvents.size > 0 &&
            `${selectedGCalEvents.size} to import`}
        </div>
        <div className="fc-sync-footer-buttons">
          <Button text="Cancel" onClick={onClose} disabled={isSyncing} />
          <Button
            intent="primary"
            text={
              totalSelected === 0
                ? "Select events to sync"
                : `Sync ${totalSelected} Event${totalSelected !== 1 ? "s" : ""}`
            }
            onClick={handleSync}
            disabled={totalSelected === 0 || isSyncing}
            icon="automatic-updates"
          />
        </div>
      </div>
    </Dialog>
  );
};

export default SyncEventsDialog;
