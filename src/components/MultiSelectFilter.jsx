import {
  Checkbox,
  Classes,
  Colors,
  Icon,
  MenuItem,
  Popover,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
import { useState, useEffect } from "react";
import { mapOfTags } from "..";
import { TOOLTIP } from "@blueprintjs/core/lib/esm/common/classes";
import { EventTag } from "../models/EventTag";
import ColorPicker from "./ColorPicker";

const MultiSelectFilter = ({
  tagsToDisplay,
  setTagsToDisplay,
  isDataToReload,
}) => {
  const [popoverToOpen, setPopoverToOpen] = useState("");
  const [queryStr, setQueryStr] = useState("");
  const [isMultiSelectDisabled, setIsMultiSelectDisabled] = useState(false);
  // useEffect(() => {
  //   console.log("filter changed");
  // }, []);

  //   const switchFilters = () => {
  //     const switchTo = Object.values(filters).some((filter) => !filter)
  //       ? true
  //       : false;
  //     setFilters((prev) => {
  //       const clone = { ...prev };
  //       for (let key in clone) {
  //         clone[key] = switchTo;
  //       }
  //       console.log("clone :>> ", clone);
  //       return clone;
  //     });
  //   };

  console.log("query change in Multi", queryStr);

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
        text={tag.pages[0]}
        onClick={handleClick}
        // onDoubleClick={(e) => console.log(e)}
        active={modifiers.active}
        icon={
          tagsToDisplay.find((t) => t.pages[0] === tag.pages[0])
            ? "small-tick"
            : null
        }
        label={tag.pages.slice(1).join(", ")}
      />
    );
  };

  // const handleClear = () => {
  //   setTagsToDisplay([]);
  // };

  const renderTag = (tag) => {
    const title = tag.pages[0];
    const aliases = tag.pages.slice(1).join(", ");
    return (
      <Popover
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
    const tagName = props.children;
    // console.log(tagName);
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
    <div className="full-calendar-filters">
      <MultiSelect
        placeholder="Click to Multiselect"
        items={mapOfTags}
        menuProps={{
          className: "fc-filter-menu",
        }}
        itemRenderer={renderTagInList}
        noResults={<MenuItem disabled text="No corresponding tag" />}
        onItemSelect={handleTagSelect}
        tagRenderer={renderTag}
        selectedItems={tagsToDisplay}
        // onClear={handleClear}
        query={queryStr}
        onQueryChange={(q, e) => {
          console.log("query change in Multi", q);
          setQueryStr(q);
        }}
        inputProps={{
          leftIcon: "tag",
        }}
        tagInputProps={{
          onRemove: handleTagRemove,
          tagProps: ({ props }) => {
            // console.log("props :>> ", props);
            // console.log("mapOfTags :>> ", mapOfTags);
            const tag = mapOfTags.find(
              (tag) => tag.pages[0] === props.children
            );
            // console.log("tag :>> ", tag);
            if (!tag) return;
            return {
              style: { backgroundColor: tag.color },
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
      <button onClick={handleSticky}>📌</button>
      {/* <button onClick={() => setPopoverIsOpen((prev) => !prev)}>Open</button>
      <EditEvent popoverIsOpen={popoverIsOpen} /> */}
    </div>
  );
};

export default MultiSelectFilter;
