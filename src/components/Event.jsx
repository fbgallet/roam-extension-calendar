import { Checkbox, Tooltip, Popover, Classes, Tag } from "@blueprintjs/core";
import { updateBlock } from "../util/roamApi";
import { getTagColor, replaceItemAndGetUpdatedArray } from "../util/data";
import { useState, useRef } from "react";
import { getTagColorFromName, getTagFromName } from "../models/EventTag";
import { calendarTag } from "..";
import TagList from "./TagList";

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
    <Popover
      isOpen={popoverIsOpen}
      onInteraction={(e) => !e && setPopoverIsOpen(e)}
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
          <TagList list={event.extendedProps.eventTags} isInteractive={true} />
        </div>
      }
      usePortal={true}
    >
      <div
        className="fc-event-content"
        onClick={(e) => {
          if (e.target.parentElement.className.includes("bp3-checkbox")) return;
          setPopoverIsOpen((prev) => !prev);
        }}
      >
        <div
          style={{
            display: timeText ? "inline" : "none",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: backgroundColor,
          }}
        ></div>
        {hasCheckbox && (
          <Checkbox
            // label={null}
            checked={isChecked}
            onClick={(e) => {}}
            onChange={(e) => {
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
                  getTagFromName("DONE"),
                  getTagFromName("TODO"),
                  "name"
                );
                console.log("updatedTags :>> ", updatedTags);
                event.setProp("color", updatedTags[0].color);
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
                  getTagFromName("TODO"),
                  getTagFromName("DONE"),
                  "name"
                );
                console.log("updatedTags :>> ", updatedTags);
                event.setProp("color", updatedTags[0].color);
              }
              event.setProp("title", updatedTitle);
              event.setProp("classNames", updatedClassNames);
              event.setExtendedProp("eventTags", updatedTags);
              console.log("event :>> ", event);
              updateBlock(event.id, updatedTitle);
            }}
          />
        )}
        <Tooltip
          position={"auto-start"}
          hoverOpenDelay={500}
          isOpen={popoverIsOpen ? false : null}
          content={
            <>
              <p>{event.title}</p>
              {event.extendedProps.eventTags[0].name !== calendarTag.name ? (
                <TagList
                  list={event.extendedProps.eventTags}
                  isInteractive={false}
                />
              ) : null}
            </>
          }
          popoverClassName="fc-event-tooltip"
        >
          <span>
            {timeText ? <b>{timeText} </b> : ""}
            {displayTitle}
          </span>
        </Tooltip>
      </div>
    </Popover>
    // </Tooltip>
  );
};

// {window.roamAlphaAPI.ui.components.renderBlock({
//   uid: event.id,
//   el: popoverRef.current,
// })}

export default Event;
