import {
  Classes,
  Colors,
  Icon,
  EditableText,
  TextArea,
} from "@blueprintjs/core";
import { useState } from "react";
import ColorPicker from "./ColorPicker";

const TagPopover = ({ aliases, tag, setTagsToDisplay, isDataToReload }) => {
  const [aliasesStr, setAliasesStr] = useState(aliases);

  return (
    <>
      {/* {aliases && aliases.length ? ( */}
      <div className="fc-tag-aliases">
        <div>
          <div>Aliases: </div>
          <EditableText
            // isEditing={false}
            onConfirm={(evt) =>
              tag.updatePages(
                [tag.name].concat(evt.split(",").map((alias) => alias.trim()))
              )
            }
            className="fc-aliases-input"
            multiline={true}
            confirmOnEnterKey={true}
            small={true}
            placeholder="Add aliases here"
            value={aliasesStr}
            onChange={(evt) => {
              setAliasesStr(evt);
            }}
          />
          {/* <Icon icon="add" onClick={() => console.log("add alias")} /> */}
        </div>
      </div>
      {/* ) : (
        <div>No aliases</div>
      )} */}

      <ColorPicker
        tag={tag}
        setTagsToDisplay={setTagsToDisplay}
        isDataToReload={isDataToReload}
      />
    </>
  );
};

export default TagPopover;
