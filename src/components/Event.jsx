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
  getBlockContentByUid,
  getBlocksUidReferencedInThisBlock,
  getParentBlock,
  getTreeByUid,
  updateBlock,
} from "../util/roamApi";
import {
  colorToDisplay,
  getInfosFromChildren,
  getMatchingTags,
  parseEventObject,
  replaceItemAndGetUpdatedArray,
} from "../util/data";
import { useState, useRef } from "react";
import { getTagFromName } from "../models/EventTag";
import { calendarTag, mapOfTags } from "..";
import TagList from "./TagList";

const Event = ({
  displayTitle,
  event,
  timeText,
  hasCheckbox,
  isChecked,
  tagsToDisplay,
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
  const initialContent = useRef(null);

  const handleDeleteEvent = async () => {
    const currentCalendarUid = getParentBlock(event.id);
    await deleteBlock(event.id);
    deleteBlockIfNoChild(currentCalendarUid);
    deleteEvent(event);
    setIsDeleteDialogOpen(false);
    setPopoverIsOpen(false);
    setIsExisting(false);
  };

  // const updateFCEvent = () => {

  // }

  const handleClose = async () => {
    const updatedContent = getBlockContentByUid(event.id);
    let matchingTags = getMatchingTags(
      tagsToDisplay,
      getBlocksUidReferencedInThisBlock(event.id)
    );
    if (initialContent.current && initialContent.current !== updatedContent) {
      if (event.extendedProps.hasInfosInChildren) {
        const tree = getTreeByUid(event.id);
        const children = tree && tree.length ? tree[0].children : null;
        if (children) {
          const childrenInfos = getInfosFromChildren(children);
          console.log("childrenInfos :>> ", childrenInfos);
          matchingTags = matchingTags.concat(childrenInfos.tags);
        }
      }
      const updatedEvent = parseEventObject({
        title: updatedContent,
        matchingTags,
        isRef: event.extendedProps.isRef,
        hasTime: event.extendedProps.hasTime,
        hasInfosInChildren: event.extendedProps.hasInfosInChildren,
        untilUid: event.extendedProps.untilUid,
      });
      await updateEvent(event, updatedEvent);
      initialContent.current = null;
    }
    setTimeout(() => {
      const tooltip = document.querySelector(".rm-bullet__tooltip");
      if (tooltip) tooltip.remove();
    }, 200);
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
            {eventTagList && eventTagList[0].name !== calendarTag.name ? (
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
      onOpening={(e) => {
        window.roamAlphaAPI.ui.components.renderBlock({
          uid: event.id,
          el: popoverRef.current,
          "zoom-path?": event.extendedProps.isRef,
          "open?": false,
        });
        initialContent.current = getBlockContentByUid(event.id);
      }}
    >
      <div
        className="fc-event-content"
        onClick={(e) => {
          if (eventTagList && eventTagList[0].name === "Google calendar") {
            window.open(event.url, "_blank");
            return;
          }
          if (e.target.parentElement.className.includes("bp3-checkbox")) return;
          if (e.nativeEvent.shiftKey) return;
          // e.stopPropagation();
          setPopoverIsOpen((prev) => !prev);
        }}
      >
        {hasCheckbox && (
          <Checkbox
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
              {eventTagList && eventTagList[0].name !== calendarTag.name ? (
                <TagList list={eventTagList} isInteractive={false} />
              ) : null}
            </>
          }
          popoverClassName="fc-event-tooltip"
        >
          <span>
            {timeText && event.extendedProps.hasTime ? <b>{timeText} </b> : ""}
            {displayTitle}
          </span>
        </Tooltip>
      </div>
    </Popover>
  ) : null;
};

export default Event;
