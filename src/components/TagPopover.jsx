import {
  Classes,
  Colors,
  Icon,
  EditableText,
  TextArea,
} from "@blueprintjs/core";
import { useState } from "react";
import ColorPicker from "./ColorPicker";
import { extensionStorage, mapOfTags } from "..";
import { getTrimedArrayFromList } from "../util/data";

const TagPopover = ({ aliases, tag, setTagsToDisplay, isDataToReload }) => {
  const [aliasesStr, setAliasesStr] = useState(aliases);

  return (
    <>
      {/* {aliases && aliases.length ? ( */}
      <div className="fc-tag-aliases">
        <div>
          <div>Aliases: </div>
          <EditableText
            onConfirm={async (list) => {
              const updatedPages = [tag.name].concat(
                getTrimedArrayFromList(list)
              );
              console.log("tag :>> ", tag);
              tag.updatePages(updatedPages);
              if (!tag.isTemporary) {
                if (
                  !tag.isUserDefined &&
                  tag.name !== "TODO" &&
                  tag.name !== "DONE"
                ) {
                  await extensionStorage.set(
                    `${tag.name}Tag`,
                    `${tag.pages[0]},${list}`
                  );
                }
                await extensionStorage.set(
                  "fc-tags-info",
                  JSON.stringify(
                    mapOfTags.map((item) => ({
                      name: item.name,
                      color: item.color,
                      isToDisplay: item.isToDisplay,
                      isToDisplayInSb: item.isToDisplayInSb,
                      pages: item.name === tag.name ? updatedPages : item.pages,
                    }))
                  )
                );
              }
              setTagsToDisplay((prev) => [...prev]);
              isDataToReload.current = true;
            }}
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
