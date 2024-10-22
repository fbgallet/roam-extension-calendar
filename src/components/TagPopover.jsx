import { Icon, EditableText } from "@blueprintjs/core";
import { useState } from "react";
import ColorPicker from "./ColorPicker";
import { extensionStorage, mapOfTags } from "..";
import { getTrimedArrayFromList, updateStoredTags } from "../util/data";
import DeleteDialog from "./DeleteDialog";

const TagPopover = ({
  aliases,
  tag,
  setTagsToDisplay,
  isDataToReload,
  setPopoverToOpen,
}) => {
  const [aliasesStr, setAliasesStr] = useState(aliases);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTemporaryTag, setIsTemporaryTag] = useState(tag.isTemporary);

  const handleAddPermanentTag = async () => {
    tag.isTemporary = false;
    await updateStoredTags(mapOfTags);
    const userTagsStr = extensionStorage.get("userTags")
      ? `${extensionStorage.get("userTags")}, ${tag.name}`
      : tag.name;
    extensionStorage.set("userTags", userTagsStr);
    setIsTemporaryTag(false);
  };

  const handleDeleteTag = async () => {
    const indexOfTagToDelete = mapOfTags.findIndex((t) => t.name === tag.name);
    if (indexOfTagToDelete === -1) return;
    mapOfTags.splice(indexOfTagToDelete, 1);
    // await updateStoredTags(mapOfTags);
    await extensionStorage.set(
      "userTags",
      extensionStorage
        .get("userTags")
        .replace(new RegExp(",?\\s?" + tag.name + "\\s?"), "")
    );
    setPopoverToOpen("");
    setTagsToDisplay((prev) => [...prev.filter((t) => t.name !== tag.name)]);
  };

  return (
    <div className="fc-tag-popover">
      <div className="fc-tag-aliases">
        <div>
          <div>Aliases: </div>
          <EditableText
            onConfirm={async (list) => {
              const updatedPages = [tag.name].concat(
                getTrimedArrayFromList(list)
              );
              tag.updatePages(updatedPages);
              if (!tag.isTemporary) {
                if (
                  !tag.isUserDefined &&
                  tag.name !== "TODO" &&
                  tag.name !== "DONE"
                ) {
                  await extensionStorage.set(
                    `${tag.name}Tag`,
                    `${tag.pages[0]}, ${list.trim()}`
                  );
                }
                await updateStoredTags(mapOfTags);
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
        </div>
      </div>
      <ColorPicker
        tag={tag}
        setTagsToDisplay={setTagsToDisplay}
        isDataToReload={isDataToReload}
      />
      {tag.isUserDefined ? (
        isTemporaryTag ? (
          <div onClick={() => handleAddPermanentTag()}>
            <span>Add to user tags</span>
            <Icon icon="add" size="14" />
          </div>
        ) : (
          <div onClick={() => setIsDeleteDialogOpen(true)}>
            <span>Remove from user tags</span>
            <Icon icon="trash" size="14" />
          </div>
        )
      ) : null}
      <DeleteDialog
        title="Remove user tag"
        message={
          <p>
            Are you sure you want to remove <strong>{tag.name}</strong> from
            user tags ?
          </p>
        }
        callback={handleDeleteTag}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
      />
    </div>
  );
};

export default TagPopover;
