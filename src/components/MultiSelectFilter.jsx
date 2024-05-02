import { Checkbox, MenuItem, Tooltip } from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
import { useState, useEffect } from "react";
import { mapOfTags } from "..";

const MultiSelectFilter = ({ tagsToDisplay, setTagsToDisplay }) => {
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

  const renderTag = (tag) => tag.pages[0];

  const handleTagRemove = (name) => {
    const tagToRemove = tagsToDisplay.filter((tag) => tag.pages[0] === name);
    handleTagSelect(tagToRemove[0]);
  };

  const handleClickOnTag = (e) => {
    e.stopPropagation();
    if (e.metaKey) {
      tagsToDisplay.forEach(
        (tag) => tag.pages[0] !== e.target.innerText && tag.hide()
      );
      setTagsToDisplay([
        tagsToDisplay.find((tag) => tag.pages[0] === e.target.innerText),
      ]);
    }
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
          tagProps: {
            interactive: true,
            onClick: handleClickOnTag,
          },
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
