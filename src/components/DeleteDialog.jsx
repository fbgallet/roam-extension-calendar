import { Button, Dialog } from "@blueprintjs/core";

const DeleteDialog = ({
  title,
  message,
  callback,
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
}) => {
  return (
    <>
      <Dialog
        className="fc-delete-dialog"
        title={title}
        icon="trash"
        isOpen={isDeleteDialogOpen}
        canOutsideClickClose={true}
        onClose={() => setIsDeleteDialogOpen(false)}
      >
        {message}
        <div>
          <Button text="Cancel" onClick={() => setIsDeleteDialogOpen(false)} />
          <Button
            intent="danger"
            text="Delete"
            onClick={() => {
              callback();
              setIsDeleteDialogOpen(false);
            }}
          />
        </div>
      </Dialog>
    </>
  );
};

export default DeleteDialog;
