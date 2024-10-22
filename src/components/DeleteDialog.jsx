import { Button, Dialog } from "@blueprintjs/core";
import { useState } from "react";

const DeleteDialog = ({
  title,
  message,
  callback,
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
}) => {
  const handleClose = () => {
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <Dialog
        className="fc-delete-dialog"
        title={title}
        icon="trash"
        isOpen={isDeleteDialogOpen}
        canOutsideClickClose={true}
        onClose={() => handleClose()}
      >
        {message}
        <div>
          <Button
            text="Cancel"
            onClick={() => {
              console.log("cancel click :>> ");
              handleClose();
            }}
          />
          <Button
            intent="danger"
            text="Delete"
            onClick={() => {
              callback();
              handleClose();
            }}
          />
        </div>
      </Dialog>
    </>
  );
};

export default DeleteDialog;
