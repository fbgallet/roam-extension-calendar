import {
  Button,
  Checkbox,
  Dialog,
  Icon,
  Tooltip,
  Popover,
  Classes,
} from "@blueprintjs/core";
import {
  deleteBlock,
  deleteBlockIfNoChild,
  getParentBlock,
  updateBlock,
} from "../util/roamApi";
import { colorToDisplay, replaceItemAndGetUpdatedArray } from "../util/data";
import { useState, useRef } from "react";
import { getTagFromName } from "../models/EventTag";
import { calendarTag } from "..";
import TagList from "./TagList";

const Event = ({
  displayTitle,
  event,
  timeText,
  hasCheckbox,
  isChecked,
  tagsToDisplay,
  backgroundColor,
  deleteEvent,
  updateEvent,
}) => {
  const [eventTagList, setEventTagList] = useState(
    event.extendedProps.eventTags
  );
  const [popoverIsOpen, setPopoverIsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isExisting, setIsExisting] = useState(true);
  const popoverRef = useRef(null);

  console.log("event :>> ", event);

  const handleDeleteEvent = async () => {
    const currentCalendarUid = getParentBlock(event.id);
    await deleteBlock(event.id);
    deleteBlockIfNoChild(currentCalendarUid);
    deleteEvent(event);
    setIsDeleteDialogOpen(false);
    setPopoverIsOpen(false);
    setIsExisting(false);
  };

  const handleClose = () => {
    const tooltip = document.querySelector(".rm-bullet__tooltip");
    if (tooltip) tooltip.remove();
  };

  return isExisting ? (
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
          <div>
            {eventTagList[0].name !== calendarTag.name ? (
              <TagList
                list={eventTagList}
                setEventTagList={setEventTagList}
                isInteractive={true}
                event={event}
              />
            ) : null}
            <Icon
              icon="trash"
              size="12"
              onClick={() => setIsDeleteDialogOpen(true)}
            />
            <Dialog
              className="fc-delete-dialog"
              title="Delete event"
              icon="trash"
              isOpen={isDeleteDialogOpen}
              canOutsideClickClose={true}
              onClose={() => setIsDeleteDialogOpen(false)}
            >
              <p>Are you sure you want to delete this event ?</p>
              <div>
                <Button
                  text="Cancel"
                  onClick={() => setIsDeleteDialogOpen(false)}
                />
                <Button
                  intent="danger"
                  text="Delete"
                  onClick={handleDeleteEvent}
                />
              </div>
            </Dialog>
          </div>
        </div>
      }
      onClose={handleClose}
      usePortal={true}
      onOpening={(e) =>
        window.roamAlphaAPI.ui.components.renderBlock({
          uid: event.id,
          el: popoverRef.current,
          "zoom-path?": event.extendedProps.isRef,
          "open?": false,
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
        // style={{
        //   display: timeText ? "inline" : "none",
        //   width: "10px",
        //   height: "10px",
        //   borderRadius: "50%",
        //   backgroundColor: colorToDisplay(eventTagList),
        // }}
      >
        {hasCheckbox && (
          <Checkbox
            // label={null}
            checked={isChecked}
            // onClick={(e) => {}}
            onChange={(e) => {
              console.log("isChecked before:>> ", event.title, isChecked);
              console.log("event.classNames :>> ", event.classNames);
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
              }
              console.log("updatedTags :>> ", updatedTags);
              console.log("updatedClassNames :>> ", updatedClassNames);
              const updatedColor = colorToDisplay(updatedTags);
              updateEvent(event, {
                title: updatedTitle,
                classNames: updatedClassNames,
                color: updatedColor,
                extendedProps: {
                  eventTags: updatedTags,
                  isRef: event.extendedProps.isRef,
                },
              });
              event.setProp("color", updatedColor);
              event.setProp("title", updatedTitle);
              event.setProp("classNames", updatedClassNames);
              event.setExtendedProp("eventTags", updatedTags);
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
  ) : null;
  // </Tooltip>
};

// {window.roamAlphaAPI.ui.components.renderBlock({
//   uid: event.id,
//   el: popoverRef.current,
// })}

export default Event;
