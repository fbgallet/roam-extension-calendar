import { Button, Popover } from "@blueprintjs/core";
import {
  createChildBlock,
  deleteBlock,
  deleteBlockIfNoChild,
  getPageNameByPageUid,
  getParentBlock,
  isExistingNode,
  updateBlock,
} from "../util/roamApi";
import { useRef, useState } from "react";
import { getCalendarUidFromPage } from "../util/data";
import { getTimestampFromHM } from "../util/dates";

const NewEventDialog = ({
  newEventDialogIsOpen,
  setNewEventDialogIsOpen,
  pageUid,
  pageTitle,
  tagToInsert,
  position,
  addEvent,
  focusedTime,
  periodView,
}) => {
  const [isBlockRendering, setIsBlockRendering] = useState(false);
  const [eventUid, setEventUid] = useState(null);
  const renderRef = useRef(null);
  const popoverRef = useRef(null);

  const handleNew = async () => {
    const calendarBlockUid = await getCalendarUidFromPage(pageUid);
    if (periodView.includes("time") && focusedTime) {
      focusedTime = getTimestampFromHM(
        parseInt(focusedTime.slice(0, 2)),
        parseInt(focusedTime.slice(3, 5))
      );
    }
    let content =
      periodView.includes("time") && focusedTime ? focusedTime + " " : "";
    if (tagToInsert) {
      if (tagToInsert === "DONE" || tagToInsert === "TODO") {
        tagToInsert = `{{[[${tagToInsert}]]}} `;
        content = tagToInsert + content;
      } else {
        if (tagToInsert.includes(" ")) tagToInsert = "[[" + tagToInsert + "]]";
        tagToInsert = "#" + tagToInsert + " ";
        content += tagToInsert;
      }
    }
    const targetUid = await createChildBlock(calendarBlockUid, content);
    // setTimeout(async () => {
    await window.roamAlphaAPI.ui.components.renderBlock({
      uid: targetUid,
      el: renderRef.current,
    });

    let blockElt = renderRef.current.querySelector(".rm-block__input");
    if (blockElt) {
      const placeholder = document.createElement("span");
      placeholder.textContent =
        "Click here to start writing. Type '/' to see commands.";
      placeholder.style.color = "rgb(206, 217, 224)";
      blockElt.appendChild(placeholder);
    }
    setIsBlockRendering(true);
    setEventUid(targetUid);
    // }, 1000);
  };

  const handleClose = () => {
    const tooltip = document.querySelector(".rm-bullet__tooltip");
    if (tooltip) tooltip.remove();
  };

  const handleCancel = async () => {
    if (isBlockRendering) {
      const currentCalendarUid = getParentBlock(eventUid);
      await deleteBlock(eventUid);
      deleteBlockIfNoChild(currentCalendarUid);
    }
    setIsBlockRendering(false);
    setNewEventDialogIsOpen(false);
  };

  const handleConfirm = async () => {
    setIsBlockRendering(false);
    setNewEventDialogIsOpen(false);
    await addEvent(eventUid, pageUid);
  };

  const handleSync = async () => {
    setIsBlockRendering(false);
    setNewEventDialogIsOpen(false);
    await addEvent(eventUid, pageUid, true);
  };

  return (
    <div style={{ display: "none" }}>
      <Popover
        isOpen={newEventDialogIsOpen}
        canEscapeKeyClose={false}
        popoverClassName="fc-newevent-popover"
        ref={popoverRef}
        autoFocus={false}
        onClose={handleClose}
        minimal={true}
        onOpened={() => {
          if (popoverRef.current) {
            // Set fixed position styles for the popover
            const popoverElement = popoverRef.current.popoverElement;
            if (popoverElement) {
              if (position.x > 200) {
                if (position.x + 200 < window.innerWidth)
                  position.x = position.x - 200;
                else position.x = position.x - 400;
              }
              if (position.x < 0) position.x = 0;
              if (position.y + 150 > window.innerHeight)
                position.y = position.y - 150;
              if (position.y < 0) position.y = 0;
              popoverElement.style.position = "absolute";
              popoverElement.style.left = `${position.x}px`;
              popoverElement.style.top = `${position.y}px`;
              popoverElement.style.transform = null;
              popoverElement.style.visibility = "visible";
              handleNew();
            }
          }
        }}
        content={
          <>
            <h4>New event on {pageTitle}</h4>
            <div
              autoFocus={false}
              className="fc-renderblock"
              ref={renderRef}
            ></div>
            <div>
              <Button text="Cancel" onClick={handleCancel} />
              <Button
                intent="primary"
                text={isBlockRendering ? "Confirm" : "New event"}
                onClick={
                  isBlockRendering ? () => handleConfirm() : () => handleNew()
                }
              />
              <Button
                intent="primary"
                text={"Confirm & sync to GCal"}
                onClick={() => handleSync()}
              />
            </div>
          </>
        }
      >
        <span></span>
      </Popover>
    </div>
  );
};

export default NewEventDialog;
