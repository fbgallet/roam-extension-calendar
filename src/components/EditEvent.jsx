import {
  Button,
  Classes,
  Checkbox,
  Popover,
  Tooltip,
  Portal,
} from "@blueprintjs/core";

const EditEvent = ({ popoverIsOpen }) => {
  return (
    <Popover
      isOpen={popoverIsOpen}
      position={"bottom"}
      popoverClassName={Classes.POPOVER_CONTENT_SIZING}
      content={
        <div>
          <h5>Popover title</h5>
          <p>...</p>
        </div>
      }
      usePortal={true}
    >
      <button>Test</button>
    </Popover>
  );
};

export default EditEvent;
