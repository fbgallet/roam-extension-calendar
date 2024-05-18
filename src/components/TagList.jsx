import { Tag } from "@blueprintjs/core";

const TagList = ({ list, isInteractive }) => {
  const handleOnRemove = (e) => {
    console.log("e :>> ", e);
  };

  return (
    <div className="fc-tag-list">
      {list.map((tag) => (
        <Tag
          interactive={isInteractive}
          onRemove={isInteractive ? handleOnRemove : null}
          style={{
            backgroundColor: tag.color,
            color: tag.color === "transparent" ? "revert" : null,
          }}
        >
          {tag.name}
        </Tag>
      ))}
    </div>
  );
};

export default TagList;
