import {
  Button,
  Checkbox,
  Classes,
  Colors,
  HTMLSelect,
  Icon,
  MenuItem,
  Popover,
  Switch,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
import { useState, useEffect } from "react";
import { calendarTag, mapOfTags } from "..";
import { TOOLTIP } from "@blueprintjs/core/lib/esm/common/classes";
import { EventTag } from "../models/EventTag";
import ColorPicker from "./ColorPicker";

const MultiSelectFilter = ({
  tagsToDisplay,
  setTagsToDisplay,
  isDataToReload,
  filterLogic,
  setFilterLogic,
  isEntireDNP,
  setIsEntireDNP,
}) => {
  const [popoverToOpen, setPopoverToOpen] = useState("");
  const [queryStr, setQueryStr] = useState("");

  const handleSticky = () => {
    const calendarElt = document.querySelector(".full-calendar-comp");
    calendarElt.classList.add("fc-sticky");
  };

  const handleTagSelect = (tag) => {
    if (
      !tagsToDisplay.some(
        (tagToDisplay) => tagToDisplay.pages[0] === tag.pages[0]
      )
    ) {
      tag.display();
      setTagsToDisplay([...tagsToDisplay, tag]);
    } else {
      tag.hide();
      setTagsToDisplay(
        tagsToDisplay.filter(
          (tagToDisplay) => tagToDisplay.pages[0] !== tag.pages[0]
        )
      );
    }
    setQueryStr("");
  };

  const renderTagInList = (tag, { handleClick, modifiers }) => {
    if (!modifiers.matchesPredicate) return null;
    return (
      <MenuItem
        style={{ minWidth: "300px" }}
        key={tag.pages[0]}
        text={tag.name === calendarTag.name ? "• not tagged" : tag.pages[0]}
        onClick={handleClick}
        // onDoubleClick={(e) => console.log(e)}
        active={modifiers.active}
        icon={
          tagsToDisplay.find((t) => t.pages[0] === tag.pages[0])
            ? "small-tick"
            : null
        }
        label={
          tag.name === calendarTag.name
            ? `children of #${calendarTag.name}`
            : tag.pages.slice(1).join(", ")
        }
      />
    );
  };

  const handleClear = () => {
    tagsToDisplay.forEach((tag) => tag.hide());
    setTagsToDisplay([]);
  };
  const handleAddAllTags = (e) => {
    e.stopPropagation();
    mapOfTags.forEach((tag) => tag.display());
    setTagsToDisplay([...mapOfTags]);
  };

  const renderTag = (tag) => {
    const title = tag.name === calendarTag.name ? "• not tagged" : tag.pages[0];
    const aliases = tag.pages.slice(1).join(", ");
    return (
      <Popover
        // autoFocus={false}
        className="fc-popover"
        captureDismiss={true}
        isOpen={popoverToOpen === tag.pages[0] ? true : false}
        canEscapeKeyClose={true}
        position={"bottom"}
        popoverClassName={Classes.POPOVER_CONTENT_SIZING}
        content={
          <>
            {aliases.length ? <p>Aliases: {aliases}</p> : null}
            <ColorPicker
              tag={tag}
              setTagsToDisplay={setTagsToDisplay}
              isDataToReload={isDataToReload}
            />
          </>
        }
        usePortal={true}
        onClose={() => {
          setQueryStr("");
          setPopoverToOpen("");
        }}
      >
        {title}
      </Popover>
    );
  };

  const handleTagRemove = ({ props }) => {
    const tagName =
      props.children === "• not tagged" ? calendarTag.name : props.children;
    console.log(tagName);
    const tagToRemove = tagsToDisplay.find((tag) => tag.pages[0] === tagName);
    // console.log("tagToRemove :>> ", tagToRemove);
    handleTagSelect(tagToRemove);
  };

  const handleClickOnTag = (e) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey) {
      const tagName = e.target.innerText;
      setPopoverToOpen(tagName);
    }
  };

  const handleDoubleClickOnTag = (e) => {
    const tagName = e.target.innerText;
    e.stopPropagation();
    tagsToDisplay.forEach((tag) => tag.pages[0] !== tagName && tag.hide());
    setTagsToDisplay([tagsToDisplay.find((tag) => tag.pages[0] === tagName)]);
  };

  return (
    <div className="fc-filters">
      <MultiSelect
        placeholder="Click to Multiselect"
        fill={true}
        items={mapOfTags}
        menuProps={{
          className: "fc-filter-menu",
        }}
        itemRenderer={renderTagInList}
        noResults={<MenuItem disabled text="No corresponding tag" />}
        onItemSelect={handleTagSelect}
        tagRenderer={renderTag}
        selectedItems={tagsToDisplay}
        query={queryStr}
        onQueryChange={(q, e) => {
          setQueryStr(q);
        }}
        inputProps={{
          leftIcon: "tag",
        }}
        tagInputProps={{
          onRemove: handleTagRemove,
          leftIcon: "filter",
          rightElement: (
            <>
              <HTMLSelect
                value={filterLogic}
                iconName={"caret-down"}
                options={["Or", "And"]}
                minimal={true}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onChange={(evt) => {
                  setFilterLogic(evt.currentTarget.value);
                }}
              />
              {tagsToDisplay.length > 0 ? (
                <Icon icon="small-cross" onClick={handleClear} />
              ) : (
                <Icon icon="asterisk" onClick={handleAddAllTags} />
              )}
            </>
          ),
          tagProps: ({ props }) => {
            // console.log("props :>> ", props);
            // console.log("mapOfTags :>> ", mapOfTags);
            const tag =
              props.children === "• not tagged"
                ? calendarTag
                : mapOfTags.find((tag) => tag.pages[0] === props.children);
            if (!tag) return;
            return {
              style: {
                backgroundColor: tag.color,
                color: tag.color === "transparent" ? "revert" : null,
              },
              interactive: true,
              onClick: handleClickOnTag,
              onDoubleClick: handleDoubleClickOnTag,
            };
          },
        }}
        // usePortal={false}
        popoverProps={{ minimal: true, disabled: popoverToOpen.length > 0 }}
        itemPredicate={(query, item) => {
          if (!query.trim()) return true;
          return item.pages.some((page) =>
            page.toLowerCase().includes(query.toLowerCase())
          );
        }}
        // createNewItemFromQuery={(query) => {
        //   const newTag = new EventTag(query);
        //   // mapOfTags.push(newTag);
        //   return newTag;
        // }}
        // // createNewItemPosition={"last"}
        // createNewItemRenderer={(query, active, handleClick) => (
        //   <MenuItem
        //     icon="add"
        //     text={`Create ${query}`}
        //     roleStructure="listoption"
        //     active={active}
        //     onClick={handleClick}
        //     shouldDismissPopover={false}
        //   />
        // )}
      />
      {/* <button onClick={switchFilters}>
        {Object.values(filters).some((filter) => !filter) ? "All" : "None"}
      </button> */}
      <Tooltip
        hoverOpenDelay={400}
        content="Events from entire daily notes or only children of calendar tag"
      >
        <Switch
          checked={isEntireDNP}
          label="dnp"
          inline={true}
          onChange={() => {
            setIsEntireDNP((prev) => !prev);
          }}
        />
      </Tooltip>
      <button onClick={handleSticky}>📌</button>
      {/* <button onClick={() => setPopoverIsOpen((prev) => !prev)}>Open</button>
      <EditEvent popoverIsOpen={popoverIsOpen} /> */}
    </div>
  );
};

export default MultiSelectFilter;
