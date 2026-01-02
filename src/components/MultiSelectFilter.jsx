import {
  Classes,
  Colors,
  HTMLSelect,
  Icon,
  MenuItem,
  Popover,
  Switch,
  Tooltip,
} from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
import { useState, useEffect, useRef } from "react";
import { calendarTag, mapOfTags } from "..";
import { useCalendarConfigVersion } from "../contexts/CalendarConfigContext";

import { unmountApp } from "./App";
import { saveViewSetting } from "../util/data";
import { EventTag } from "../models/EventTag";
import TagPopover from "./TagPopover";
import { isAuthenticated } from "../services/googleCalendarService";

const MultiSelectFilter = ({
  tagsToDisplay,
  setTagsToDisplay,
  isDataToReload,
  filterLogic,
  setFilterLogic,
  isEntireDNP,
  setIsEntireDNP,
  isIncludingRefs,
  setIsIncludingRefs,
  isWEtoDisplay,
  setIsWEtoDisplay,
  parentElt,
  updateSize,
  isDataToFilterAgain,
  isInSidebar,
  initialSticky,
  initialMinimized,
  eventsInViewRef,
  refreshCalendar,
}) => {
  const configVersion = useCalendarConfigVersion();
  const [popoverToOpen, setPopoverToOpen] = useState("");
  const [queryStr, setQueryStr] = useState("");
  const [isSticky, setIsSticky] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [availableTags, setAvailableTags] = useState([...mapOfTags]);
  const doubleClick = useRef(false);

  useEffect(() => {
    if (initialSticky) handleSticky();
    if (initialMinimized) handleMinimize();
  }, []);

  // Listen for calendar config changes and refresh available tags
  const isFirstMount = useRef(true);
  useEffect(() => {
    // Skip first mount - only react to actual config changes
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    // Update available tags list to reflect new tags from config
    setAvailableTags([...mapOfTags]);
  }, [configVersion]);

  const handleTagSelect = (tag) => {
    // if new tag
    if (!mapOfTags.find((existingTag) => existingTag.name === tag.name)) {
      mapOfTags.push(tag);
      setAvailableTags([...mapOfTags]); // Update available tags when adding new tag
      setTagsToDisplay((prev) => [...prev, tag]);
      isDataToReload.current = true;
    } else {
      if (
        !tagsToDisplay.some(
          (tagToDisplay) => tagToDisplay.pages[0] === tag.pages[0]
        )
      ) {
        tag.display(isInSidebar);
        setTagsToDisplay([...tagsToDisplay, tag]);
      } else {
        tag.hide(isInSidebar);
        setTagsToDisplay([
          ...tagsToDisplay.filter(
            (tagToDisplay) => tagToDisplay.pages[0] !== tag.pages[0]
          ),
        ]);
      }
    }
    isDataToFilterAgain.current = true;
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
            ? `under #${calendarTag.name} or in refs`
            : tag.pages.slice(1).join(", ")
        }
      />
    );
  };

  const handleClear = () => {
    tagsToDisplay.forEach((tag) => tag.hide(isInSidebar));
    setTagsToDisplay([]);
  };

  const handleAddAllTags = (e) => {
    e.stopPropagation();
    availableTags.forEach((tag) => tag.display(isInSidebar));
    setTagsToDisplay([...availableTags]);
  };

  const handleMinimize = () => {
    const calendarElt = parentElt.querySelector(".fc-filters");
    if (calendarElt.classList.contains("fc-minimized")) {
      calendarElt.classList.remove("fc-minimized");
      setIsMinimized(false);
    } else {
      calendarElt.classList.add("fc-minimized");
      setIsMinimized(true);
    }
    saveViewSetting("fc-minimized", !isMinimized, isInSidebar);
    updateSize();
  };

  const handleSticky = () => {
    const calendarElt = parentElt.querySelector(".full-calendar-comp");
    if (calendarElt.classList.contains("fc-sticky")) {
      calendarElt.classList.remove("fc-sticky");
      setIsSticky(false);
    } else {
      calendarElt.classList.add("fc-sticky");
      setIsSticky(true);
    }
    saveViewSetting("fc-sticky", !isSticky, isInSidebar);
  };

  const handleClose = () => {
    let appWrapper;
    if (parentElt.id === "right-sidebar")
      appWrapper = document.querySelector(".full-calendar-comp.fc-sidebar");
    else
      appWrapper = document.querySelector(
        ".full-calendar-comp:not(.fc-sidebar)"
      );
    unmountApp(appWrapper);
  };

  const renderTag = (tag) => {
    if (!tag.pages || !tag.pages.length) return;
    const title = tag.name === calendarTag.name ? "• not tagged" : tag.pages[0];
    const aliases = tag.pages.length > 1 ? tag.pages.slice(1).join(", ") : "";

    return (
      <Popover
        autoFocus={false}
        classNames="fc-popover"
        captureDismiss={true}
        isOpen={popoverToOpen === tag.pages[0] ? true : false}
        canEscapeKeyClose={true}
        position={"bottom"}
        popoverClassName={Classes.POPOVER_CONTENT_SIZING}
        content={
          <TagPopover
            aliases={aliases}
            tag={tag}
            tagsToDisplay={tagsToDisplay}
            setTagsToDisplay={setTagsToDisplay}
            isDataToReload={isDataToReload}
            setPopoverToOpen={setPopoverToOpen}
            eventsInViewRef={eventsInViewRef}
            refreshCalendar={refreshCalendar}
          />
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
    const tagToRemove = tagsToDisplay.find((tag) => tag.pages[0] === tagName);
    // console.log("tagToRemove :>> ", tagToRemove);
    handleTagSelect(tagToRemove);
  };

  const handleClickOnTag = (e, tag) => {
    e.stopPropagation();
    if (popoverToOpen) return;
    if (e.shiftKey && (e.metaKey || e.ctrlKey)) {
      window.roamAlphaAPI.ui.rightSidebar.addWindow({
        window: { type: "mentions", "block-uid": tag.uids[0] },
      });
      return;
    } else if (e.shiftKey) {
      window.roamAlphaAPI.ui.rightSidebar.addWindow({
        window: { type: "outline", "block-uid": tag.uids[0] },
      });
      return;
    }
    setTimeout(() => {
      if (doubleClick.current) {
        return;
      }
      const tagName = e.target.innerText;
      if (tag.color !== "transparent") setPopoverToOpen(tagName);
    }, 300);
  };

  const handleDoubleClickOnTag = (e) => {
    if (popoverToOpen) return;
    const tagName = e.target.innerText;
    e.stopPropagation();
    tagsToDisplay.forEach(
      (tag) => tag.pages[0] !== tagName && tag.hide(isInSidebar)
    );
    setTagsToDisplay([tagsToDisplay.find((tag) => tag.pages[0] === tagName)]);
    doubleClick.current = true;
    setTimeout(() => {
      doubleClick.current = false;
    }, 600);
  };

  const handleTagDrag = (e, tag) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ isTag: true, tagTitle: tag.pages[0] })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleCreateNewTag = (query) => {
    if (!query.trim()) return;
    const newTag = new EventTag({
      name: query,
      color: Colors.GRAY3,
      isUserDefined: true,
      isTemporary: true,
      isToDisplay: isInSidebar ? false : true,
      isToDisplayInSb: isInSidebar ? true : false,
    });
    return newTag;
  };

  return (
    <div className="fc-filters">
      <MultiSelect
        placeholder="Click to Multiselect"
        fill={true}
        items={availableTags}
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
                  saveViewSetting(
                    "fc-filterLogic",
                    evt.currentTarget.value,
                    isInSidebar
                  );
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
            // console.log("availableTags :>> ", availableTags);
            const tag =
              props.children === "• not tagged"
                ? calendarTag
                : availableTags.find((tag) => tag.pages[0] === props.children);
            if (!tag) return;

            // Add connection status styling to Google Calendar tags
            // Show red dot when: not authenticated OR offline (can't sync even if authenticated)
            const isGCalTag = tag.name === "Google calendar" || tag.isGCalTag;
            const canSync = isGCalTag ? (isAuthenticated() && navigator.onLine) : true;
            const gCalClassName = isGCalTag
              ? (canSync ? "fc-gcal-tag-connected" : "fc-gcal-tag-disconnected")
              : "";

            return {
              draggable: true,
              onDragStart: (e) => handleTagDrag(e, tag),
              style: {
                backgroundColor: tag.color,
                color: tag.color === "transparent" ? "revert" : null,
              },
              interactive: true,
              className: [
                tag.color === "transparent" ? "fc-tag-notag" : null,
                gCalClassName
              ].filter(Boolean).join(" "),
              onClick: (e) => handleClickOnTag(e, tag),
              onDoubleClick: handleDoubleClickOnTag,
            };
          },
        }}
        // usePortal={false}
        popoverProps={{ minimal: true, disabled: popoverToOpen }}
        itemPredicate={(query, item) => {
          if (!query.trim()) return true;
          return item.pages.some((page) =>
            page.toLowerCase().includes(query.toLowerCase())
          );
        }}
        createNewItemFromQuery={handleCreateNewTag}
        createNewItemRenderer={(query, active, handleClick) => (
          <MenuItem
            icon="add"
            text={`Add: ${query}`}
            roleStructure="listoption"
            active={active}
            onClick={handleClick}
            shouldDismissPopover={false}
          />
        )}
      />
      <div className="fc-options-section">
        <Tooltip
          hoverOpenDelay={400}
          content="Events from entire daily notes or only children of calendar tag"
        >
          <Switch
            checked={isEntireDNP}
            label="dnp"
            inline={true}
            onChange={() => {
              isDataToReload = true;
              isDataToFilterAgain.current = true;
              saveViewSetting("fc-isEntireDNP", !isEntireDNP, isInSidebar);
              setIsEntireDNP((prev) => !prev);
            }}
          />
        </Tooltip>
        <Tooltip
          hoverOpenDelay={400}
          content="Events from linked references of DNPs"
        >
          <Switch
            checked={isIncludingRefs}
            label="refs"
            inline={true}
            onChange={() => {
              isDataToReload = true;
              isDataToFilterAgain.current = true;
              saveViewSetting(
                "fc-isIncludingRefs",
                !isIncludingRefs,
                isInSidebar
              );
              setIsIncludingRefs((prev) => !prev);
            }}
          />
        </Tooltip>
        <Switch
          checked={isWEtoDisplay}
          label="we"
          inline={true}
          onChange={() => {
            isDataToReload = true;
            isDataToFilterAgain.current = true;
            saveViewSetting("fc-isWEtoDisplay", !isWEtoDisplay, isInSidebar);
            setIsWEtoDisplay((prev) => !prev);
          }}
        />
      </div>
      <div>
        <Icon
          icon={isMinimized ? "maximize" : "minimize"}
          onClick={handleMinimize}
        />
        <Icon
          icon={isSticky ? "unpin" : "pin"}
          onClick={handleSticky}
          className={isSticky ? "bp3-intent-primary" : ""}
        />
        <Icon icon="cross" onClick={handleClose} />
      </div>
    </div>
  );
};

export default MultiSelectFilter;
