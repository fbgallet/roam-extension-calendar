import { Checkbox, Tooltip } from "@blueprintjs/core";
import { updateBlock } from "../util/roamApi";
import { replaceItemAndGetUpdatedArray } from "../util/data";

const Event = ({ displayTitle, event, hasCheckbox, isChecked }) => {
  return (
    <Tooltip content={event.title}>
      {hasCheckbox ? (
        <Checkbox
          checked={isChecked}
          onChange={(e) => {
            // console.log("EVENT :>> ", event);
            if (e.nativeEvent.shiftKey) return;
            e.stopPropagation();
            let updatedTitle, updatedClassNames, updatedTags;
            if (isChecked) {
              event.setProp("color", "blue");
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
                [...event.extendedProps.eventTags],
                "DONE",
                "TODO"
              );
            } else {
              event.setProp("color", "lightgrey");
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
                [...event.extendedProps.eventTags],
                "TODO",
                "DONE"
              );
            }
            event.setProp("title", updatedTitle);
            event.setProp("classNames", updatedClassNames);
            event.setExtendedProp("eventTags", updatedTags);
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
