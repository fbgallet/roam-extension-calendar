import { Button, Dialog, DialogBody, DialogFooter } from "@blueprintjs/core";

const NewEventDialog = ({ newEventDialogIsOpen, setNewEventDialogIsOpen }) => {
  const handleClose = () => {
    setNewEventDialogIsOpen(false);
  };

  return (
    <Dialog
      isOpen={newEventDialogIsOpen}
      title="Informational dialog"
      onClose={handleClose}
    >
      <p>Do you want to create a new event ?</p>
      <Button intent="primary" text="Close" onClick={handleClose} />
      {/* <DialogBody> 
       </DialogBody> */}
      {/* <DialogFooter actions={<Button intent="primary" text="Close" />} /> */}
    </Dialog>
  );
};

export default NewEventDialog;
