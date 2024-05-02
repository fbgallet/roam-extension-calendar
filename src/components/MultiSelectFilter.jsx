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
    if (!tagsToDisplay.some((tagToDisplay) => tagToDisplay.name === tag.name)) {
      tag.display();
      setTagsToDisplay([...tagsToDisplay, tag]);
    } else {
      tag.hide();
      setTagsToDisplay(
        tagsToDisplay.filter((tagToDisplay) => tagToDisplay.name !== tag.name)
      );
    }
  };
  const renderTagInList = (Tag, { handleClick, modifiers }) => {
    if (!modifiers.matchesPredicate) return null;
    return (
      <MenuItem
        key={Tag.name}
        text={Tag.name}
        onClick={handleClick}
        active={modifiers.active}
      />
    );
  };

  const handleClear = () => {
    setTagsToDisplay([]);
  };

  const renderTag = (tag) => tag.name;

  const handleTagRemove = (name) => {
    const tagToRemove = tagsToDisplay.filter((tag) => tag.name === name);
    handleTagSelect(tagToRemove[0]);
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
          onRemove: (e) => handleTagRemove(e),
        }}
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
