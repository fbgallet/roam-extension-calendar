import { Checkbox, Tooltip } from "@blueprintjs/core";
import { updateBlock } from "../util/roamApi";

const Event = ({ displayTitle, event, hasCheckbox, isChecked }) => {
  return (
    <Tooltip content={event.title}>
      {hasCheckbox ? (
        <Checkbox
          checked={isChecked}
          onChange={(e) => {
            if (e.nativeEvent.shiftKey) return;
            e.stopPropagation();
            let updatedTitle, updatedClassNames, updatedTags;
            if (isChecked) {
              event.setProp("color", "blue");
              updatedTitle = event.title.replace(
                "{{[[DONE]]}}",
                "{{[[TODO]]}}"
              );
              updatedTags = event.extendedProps.eventTags.splice(
                event.extendedProps.eventTags.indexOf("DONE"),
                1,
                "TODO"
              );
            } else {
              event.setProp("color", "grey");
              updatedTitle = event.title.replace(
                "{{[[TODO]]}}",
                "{{[[DONE]]}}"
              );
              updatedTags = event.extendedProps.eventTags.splice(
                event.extendedProps.eventTags.indexOf("DONE"),
                1,
                "TODO"
              );
            }
            event.setProp("title", updatedTitle);
            event.setProp("eventTags", updatedTags);
            console.log("event :>> ", event);
            updateBlock(event.id, updatedTitle);
          }}
        >
          {displayTitle}
        </Checkbox>
      ) : (
        event.title
      )}
    </Tooltip>
  );
};

export default Event;
