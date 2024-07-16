import { Tag } from "@blueprintjs/core";
import { getTreeByUid, removeTagsFromBlock } from "../util/roamApi";
import { calendarTag } from "..";

const TagList = ({ list, setEventTagList, isInteractive, event }) => {
  const handleOnRemove = (tag) => {
    removeTagsFromBlock(event.id, tag.pages);
    if (event.extendedProps.hasInfosInChildren) {
      const tree = getTreeByUid(event.id);
      const children = tree && tree.length ? tree[0].children : null;
      if (children) {
        children.forEach((child) => {
          removeTagsFromBlock(child.uid, tag.pages);
        });
      }
    }
    setEventTagList((prev) => {
      let updatedTags = [...prev];
      const index = updatedTags.indexOf(tag);
      updatedTags.splice(index, 1);
      if (updatedTags.length === 0) updatedTags.push(calendarTag);
      event.setExtendedProp("eventTags", updatedTags);
      return updatedTags;
    });
  };
  return (
    <div className="fc-tag-list">
      {list.map((tag) => (
        <Tag
          interactive={isInteractive}
          onRemove={isInteractive ? () => handleOnRemove(tag) : null}
          style={{
            backgroundColor: tag.color,
            color: tag.color === "transparent" ? "revert" : null,
          }}
        >
          {tag.pages[0]}
        </Tag>
      ))}
    </div>
  );
};

export default TagList;
