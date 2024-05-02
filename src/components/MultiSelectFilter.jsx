import {
  Checkbox,
  Classes,
  Colors,
  HTMLSelect,
  MenuItem,
  Popover,
  Tooltip,
} from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
import { useState, useEffect } from "react";
import { mapOfTags } from "..";
import { TOOLTIP } from "@blueprintjs/core/lib/esm/common/classes";

const MultiSelectFilter = ({
  tagsToDisplay,
  setTagsToDisplay,
  isDataToReload,
}) => {
  const [popoverToOpen, setPopoverToOpen] = useState("");
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

  const handleClear = () => {
    setTagsToDisplay([]);
  };

  const renderTag = (tag) => {
    const title = tag.pages[0];
    const aliases = tag.pages.slice(1).join(", ");
    return (
      <Popover
        isOpen={popoverToOpen === tag.pages[0] ? true : false}
        canEscapeKeyClose={true}
        position={"bottom"}
        popoverClassName={Classes.POPOVER_CONTENT_SIZING}
        content={
          <>
            {aliases.length ? <p>Aliases: {aliases}</p> : null}
            <label htmlFor="tagColorsSelect">Change color </label>
            <HTMLSelect
              name="colors"
              id="tagColorsSelect"
              options={["red", "blue", "yellow"]}
              onChange={(e) => {
                tag.setColor(e.currentTarget.value);
                setTagsToDisplay((prev) => [...prev]);
                isDataToReload.current = true;
              }}
              value={tag.color}
            ></HTMLSelect>
          </>
        }
        usePortal={true}
        onClose={() => setPopoverToOpen("")}
      >
        {title}
      </Popover>
    );
  };

  const handleTagRemove = ({ props }) => {
    const tagName = props.children;
    console.log(tagName);
    const tagToRemove = tagsToDisplay.find((tag) => tag.pages[0] === tagName);
    console.log("tagToRemove :>> ", tagToRemove);
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
      <b>Filter events: </b>
      <MultiSelect
        placeholder="Click to Multiselect"
        items={mapOfTags}
        itemRenderer={renderTagInList}
        noResults={<MenuItem disabled text="No corresponding tag" />}
        onItemSelect={handleTagSelect}
        tagRenderer={renderTag}
        selectedItems={tagsToDisplay}
        onClear={handleClear}
        tagInputProps={{
          onRemove: handleTagRemove,
          tagProps: ({ props }) => {
            const tag = mapOfTags.find(
              (tag) => tag.pages[0] === props.children
            );
            return {
              style: { backgroundColor: tag.color },
              interactive: true,
              onClick: handleClickOnTag,
              onDoubleClick: handleDoubleClickOnTag,
            };
          },
          //   {
          //     interactive: true,
          //     onClick: handleClickOnTag,
          //     onDoubleClick: handleDoubleClickOnTag,
          //   },
        }}
        popoverProps={{ minimal: true }}
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
