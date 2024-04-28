import { Button, Dialog, DialogBody, DialogFooter } from "@blueprintjs/core";
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
}) => {
  const [isBlockRendering, setIsBlockRendering] = useState(false);
  const [eventUid, setEventUid] = useState(null);
  const renderRef = useRef(null);

  const handleNew = async () => {
    setIsBlockRendering(true);
    const calendarBlockUid = await getCalendarUidFromPage(
      getPageNameByPageUid(pageUid)
    );
    const targetUid = createChildBlock(calendarBlockUid);
    setEventUid(targetUid);
    setTimeout(() => {
      window.roamAlphaAPI.ui.components.renderBlock({
        uid: targetUid,
        el: renderRef.current,
      });
    }, 100);
  };

  const handleClose = () => {
    if (isBlockRendering) deleteBlock(eventUid);
    setNewEventDialogIsOpen(false);
  };
  const pageTitle = getPageNameByPageUid(pageUid);

  return (
    <Dialog
      isOpen={newEventDialogIsOpen}
      title={pageTitle}
      hasBackdrop={false}
      onClose={handleClose}
      usePortal={false}
    >
      <p ref={renderRef}>Do you want to create a new event ?</p>
      <Button
        // intent="primary"
        text="Cancel"
        onClick={handleClose}
        style={{ width: "60px" }}
      />
      <Button
        intent="primary"
        text={isBlockRendering ? "Confirm" : "New event"}
        onClick={handleNew}
        style={{ width: "60px" }}
      />
      {/* <DialogBody> */}
      {/* </DialogBody> */}
      {/* <DialogFooter actions={<Button intent="primary" text="Close" />} /> */}
    </Dialog>
  );
};

export default NewEventDialog;
