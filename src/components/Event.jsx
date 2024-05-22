import {
  Checkbox,
  Icon,
  Tooltip,
  Popover,
  Classes,
  Tag,
} from "@blueprintjs/core";
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
  const [eventTagList, setEventTagList] = useState(
    event.extendedProps.eventTags
  );
  const [popoverIsOpen, setPopoverIsOpen] = useState(false);
  const popoverRef = useRef(null);

  /* {event.title}
<button
              onClick={() => {
                window.roamAlphaAPI.ui.components.renderBlock({
                  uid: event.id,
                  el: popoverRef.current,
                });
              }}
             */

  return (
    <Popover
      isOpen={popoverIsOpen}
      autoFocus={false}
      onInteraction={(e) => !e && setPopoverIsOpen(e)}
      position="bottom"
      popoverClassName={Classes.POPOVER_CONTENT_SIZING}
      content={
        <div class={"fc-event-popover popover" + event.id}>
          <Icon
            icon="small-cross"
            onClick={() => setPopoverIsOpen((prev) => !prev)}
          />
          <div ref={popoverRef}></div>
          {eventTagList[0].name !== calendarTag.name ? (
            <TagList
              list={eventTagList}
              setEventTagList={setEventTagList}
              isInteractive={true}
              event={event}
            />
          ) : null}
        </div>
      }
      usePortal={true}
      onOpening={(e) =>
        window.roamAlphaAPI.ui.components.renderBlock({
          uid: event.id,
          el: popoverRef.current,
        })
      }
    >
      <div
        className="fc-event-content"
        onClick={(e) => {
          if (e.target.parentElement.className.includes("bp3-checkbox")) return;
          if (e.nativeEvent.shiftKey) return;
          // e.stopPropagation();
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
            // onClick={(e) => {}}
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
                  [...eventTagList],
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
                  [...eventTagList],
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
              {eventTagList[0].name !== calendarTag.name ? (
                <TagList list={eventTagList} isInteractive={false} />
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
