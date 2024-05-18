import { Checkbox, Tooltip, Popover, Classes } from "@blueprintjs/core";
import { updateBlock } from "../util/roamApi";
import { getTagColor, replaceItemAndGetUpdatedArray } from "../util/data";
import { useState, useRef } from "react";
import { getTagColorFromName } from "../models/EventTag";

const Event = ({
  displayTitle,
  event,
  timeText,
  hasCheckbox,
  isChecked,
  backgroundColor,
}) => {
  const [popoverIsOpen, setPopoverIsOpen] = useState(false);
  const popoverRef = useRef(null);

  return (
    <Tooltip content={event.title}>
      {hasCheckbox ? (
        <Checkbox
          checked={isChecked}
          onChange={(e) => {
            // console.log("EVENT :>> ", event);
            if (e.nativeEvent.shiftKey) return;
            e.stopPropagation();
            let updatedTitle, updatedClassNames, updatedTags;
            if (isChecked) {
              updatedTitle = event.title.replace(
                "{{[[DONE]]}}",
                "{{[[TODO]]}}"
              );
              updatedClassNames = replaceItemAndGetUpdatedArray(
                [...event.classNames],
                "DONE",
                "TODO"
              );
              updatedTags = replaceItemAndGetUpdatedArray(
                [...event.extendedProps.eventTags],
                "DONE",
                "TODO"
              );
              event.setProp("color", getTagColorFromName(updatedTags[0]));
            } else {
              updatedTitle = event.title.replace(
                "{{[[TODO]]}}",
                "{{[[DONE]]}}"
              );
              updatedClassNames = replaceItemAndGetUpdatedArray(
                [...event.classNames],
                "TODO",
                "DONE"
              );
              updatedTags = replaceItemAndGetUpdatedArray(
                [...event.extendedProps.eventTags],
                "TODO",
                "DONE"
              );
              event.setProp("color", getTagColorFromName(updatedTags[0]));
            }
            event.setProp("title", updatedTitle);
            event.setProp("classNames", updatedClassNames);
            event.setExtendedProp("eventTags", updatedTags);
            console.log("event :>> ", event);
            updateBlock(event.id, updatedTitle);
          }}
        >
          {displayTitle}
        </Checkbox>
      ) : (
        <Popover
          isOpen={popoverIsOpen}
          position={"bottom"}
          popoverClassName={Classes.POPOVER_CONTENT_SIZING}
          content={
            <div class={"fc-event-popover popover" + event.id}>
              <span onClick={() => setPopoverIsOpen((prev) => !prev)}>x</span>
              <div ref={popoverRef}>
                {event.title}
                <button
                  onClick={() => {
                    window.roamAlphaAPI.ui.components.renderBlock({
                      uid: event.id,
                      el: popoverRef.current,
                    });
                  }}
                >
                  🖋️
                </button>
              </div>
            </div>
          }
          usePortal={true}
        >
          <div
            className="fc-event-content"
            onClick={() => setPopoverIsOpen((prev) => !prev)}
          >
            <div
              // style={roundStyle}
              style={{
                display: timeText ? "inline" : "none",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: backgroundColor,
              }}
            ></div>
            <div>
              {timeText ? <b>{timeText} </b> : ""}
              {event.title}
            </div>
          </div>
        </Popover>
      )}
    </Tooltip>
  );
};

// {window.roamAlphaAPI.ui.components.renderBlock({
//   uid: event.id,
//   el: popoverRef.current,
// })}

export default Event;
