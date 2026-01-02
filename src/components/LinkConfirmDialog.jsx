/**
 * LinkConfirmDialog - Dialog for confirming link to existing GCal event
 *
 * Shows when a Roam event is being synced and matching GCal event(s) are found.
 * Allows user to either link to existing event or create a new one.
 */

import { Button, Dialog, Radio, RadioGroup } from "@blueprintjs/core";
import { useState } from "react";

const LinkConfirmDialog = ({
  isOpen,
  onClose,
  matchingEvents,
  onConfirm,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleLink = () => {
    onConfirm("link", selectedIndex);
    setSelectedIndex(0); // Reset for next time
  };

  const handleCreateNew = () => {
    onConfirm("create");
    setSelectedIndex(0); // Reset for next time
  };

  if (!matchingEvents || matchingEvents.length === 0) {
    return null;
  }

  const isSingleMatch = matchingEvents.length === 1;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Link to Existing Event"
      icon="link"
      style={{ width: "500px" }}
    >
      <div className="fc-link-confirm-dialog">
        <div style={{ padding: "20px" }}>
          {isSingleMatch ? (
            <p>
              Found a matching event in Google Calendar:
              <br />
              <br />
              <strong>"{matchingEvents[0]?.summary}"</strong>
              <br />
              <em>
                {new Date(
                  matchingEvents[0]?.start?.dateTime || matchingEvents[0]?.start?.date
                ).toLocaleString()}
              </em>
              <br />
              <br />
              Would you like to link this Roam event to the existing Google Calendar event instead of creating a new one?
            </p>
          ) : (
            <>
              <p style={{ marginBottom: "12px" }}>
                Found {matchingEvents.length} matching events in Google Calendar. Select one to link:
              </p>
              <RadioGroup
                selectedValue={selectedIndex.toString()}
                onChange={(e) => setSelectedIndex(parseInt(e.currentTarget.value))}
              >
                {matchingEvents.map((match, idx) => (
                  <Radio
                    key={match.id}
                    label={`${match.summary} (${new Date(
                      match.start.dateTime || match.start.date
                    ).toLocaleString()})`}
                    value={idx.toString()}
                    style={{ marginBottom: "8px" }}
                  />
                ))}
              </RadioGroup>
            </>
          )}
        </div>
        <div
          className="fc-link-confirm-actions"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            padding: "0 20px 20px 20px",
            borderTop: "1px solid #ddd",
            paddingTop: "12px",
          }}
        >
          <Button text="Create New Instead" onClick={handleCreateNew} />
          <Button
            intent="primary"
            text={isSingleMatch ? "Link to Existing" : "Link to Selected"}
            onClick={handleLink}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default LinkConfirmDialog;
