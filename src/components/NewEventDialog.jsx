import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  Popover,
  Modifiers,
} from "@blueprintjs/core";
import {
  createChildBlock,
  deleteBlock,
  getPageNameByPageUid,
  getPageUidByPageName,
} from "../util/roamApi";
import { useRef, useState } from "react";
import { getCalendarUidFromPage } from "../util/data";

const NewEventDialog = ({
  newEventDialogIsOpen,
  setNewEventDialogIsOpen,
  pageUid,
  setEvents,
  position,
}) => {
  const [isBlockRendering, setIsBlockRendering] = useState(false);
  const [eventUid, setEventUid] = useState(null);
  const renderRef = useRef(null);
  const popoverRef = useRef(null);

  const handleNew = async () => {
    setIsBlockRendering(true);
    const calendarBlockUid = await getCalendarUidFromPage(
      getPageNameByPageUid(pageUid)
    );
    const targetUid = createChildBlock(calendarBlockUid);
    setEventUid(targetUid);
    setTimeout(async () => {
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
    }, 100);
  };

  const handleCancel = () => {
    if (isBlockRendering) deleteBlock(eventUid);
    setIsBlockRendering(false);
    setNewEventDialogIsOpen(false);
  };

  const handleConfirm = () => {
    // setEvents(prev => {
    //   const clone = [...prev];
    //       clone.push({
    //         id: targetUid,
    //         title: blockContent,
    //         date: isoDate,
    //         extendedProps: { eventTags: ["calendar"], isRef: false },
    //         borderColor: "transparent",
    //         color: "none",
    //         classNames: ["calendar"],
    //       });
    //       return clone;}
    //   )
    setIsBlockRendering(false);
    setNewEventDialogIsOpen(false);
  };

  const pageTitle = getPageNameByPageUid(pageUid);

  return (
    <div style={{ display: "none" }}>
      <Popover
        isOpen={newEventDialogIsOpen}
        canEscapeKeyClose={false}
        popoverClassName="fc-newevent-popover"
        ref={popoverRef}
        autoFocus={false}
        // onClose={handleClose}
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
            <h4>New event on {getPageNameByPageUid(pageUid)}</h4>
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
