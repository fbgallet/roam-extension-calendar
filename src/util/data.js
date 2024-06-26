import { calendarTag, extensionStorage, mapOfTags } from "..";
import {
  dateToISOString,
  getDateAddingDurationToDate,
  getDistantDate,
  getDurationInMin,
  getFormatedRange,
  getNormalizedTimestamp,
  getTimestampFromHM,
  parseRange,
  strictTimestampRegex,
} from "./dates";
import { dnpUidRegex } from "./regex";
import {
  createChildBlock,
  deleteBlockIfNoChild,
  dnpUidToPageTitle,
  getBlockContentByUid,
  getFirstBlockUidByReferenceOnPage,
  getLinkedReferencesTrees,
  getPageNameByPageUid,
  getPageUidByPageName,
  getParentBlock,
  getTreeByUid,
  isExistingNode,
  resolveReferences,
  updateBlock,
} from "./roamApi";

export const getBlocksToDisplayFromDNP = async (
  start,
  end,
  onlyCalendarTag,
  isIncludingRefs,
  isTimeGrid
) => {
  // console.log("mapOfTags :>> ", mapOfTags);
  let events = [];
  for (
    let currentDate = start;
    currentDate <= end;
    currentDate = getDistantDate(currentDate, 1)
  ) {
    const dnpUid = window.roamAlphaAPI.util.dateToPageUid(currentDate);
    let pageAndRefsTrees = [];
    pageAndRefsTrees.push(getTreeByUid(dnpUid));
    if (isIncludingRefs) {
      const refTrees = getLinkedReferencesTrees(
        dnpUid,
        getPageUidByPageName("roam/memo")
      );
      pageAndRefsTrees = pageAndRefsTrees.concat(refTrees);
      // console.log("pageAndRefsTrees :>> ", pageAndRefsTrees);
    }
    for (let i = 0; i < pageAndRefsTrees.length; i++) {
      const filteredEvents = filterTreeToGetEvents(
        dnpUid,
        currentDate,
        pageAndRefsTrees[i],
        mapOfTags,
        onlyCalendarTag,
        i > 0 ? true : false,
        isTimeGrid
      );
      // console.log("filteredEvents :>> ", filteredEvents);
      if (filteredEvents.length > 0) events = events.concat(filteredEvents);
    }
  }
  // console.log("events from data.js :>> ", events);
  return events;
};

const filterTreeToGetEvents = (
  dnpUid,
  currentDate,
  tree,
  mapToInclude,
  onlyCalendarTag,
  isRef,
  isTimeGrid
) => {
  // console.log("currentDate :>> ", currentDate);
  const events = [];
  const dateString = dateToISOString(currentDate);

  if (tree && tree.length) processTreeRecursively(tree, isRef ? true : false);
  return events;

  function processTreeRecursively(tree, isCalendarTree) {
    for (let i = 0; i < tree.length; i++) {
      let isCalendarParent = false;
      if (/*!isRef && */ tree[i].refs && isReferencingDNP(tree[i].refs, dnpUid))
        continue;
      let matchingTags = getMatchingTags(
        mapToInclude,
        tree[i].refs?.map((ref) => ref.uid)
      );
      if (
        isCalendarTree ||
        (tree[i].refs?.length > 0 && matchingTags.length > 0)
      ) {
        if (!isCalendarTree && matchingTags[0].name === calendarTag.name)
          isCalendarParent = true;
        else {
          if (!isCalendarTree && onlyCalendarTag) continue;
          events.push(
            parseEventObject(
              {
                id: tree[i].uid,
                title: resolveReferences(tree[i].string),
                date: dateString,
                matchingTags: matchingTags,
                isRef: isRef,
              },
              isCalendarTree,
              isTimeGrid
            )
          );
        }
      }
      let subTree = tree[i].children;
      if (
        !isRef &&
        !isCalendarTree &&
        (!matchingTags.length ||
          !(matchingTags.includes("TODO") || matchingTags.includes("DONE"))) &&
        subTree
      ) {
        processTreeRecursively(subTree, isCalendarParent);
      }
      if (isCalendarParent && onlyCalendarTag) break;
    }
  }
};

export const getMatchingTags = (mapOfTags, refUidArray) => {
  if (!refUidArray) return [];
  if (refUidArray.includes(calendarTag.uids[0])) return [calendarTag];
  return mapOfTags.filter(({ uids }) =>
    refUidArray.some((uid) => uids.includes(uid))
  );
};

export const parseEventObject = (
  { id, title, date, matchingTags, isRef = false },
  isCalendarTree = true,
  isTimeGrid = true
) => {
  let prefix = "";
  if (isCalendarTree && !matchingTags.length) {
    matchingTags.push(calendarTag);
    prefix = "• ";
  }
  let classNames = matchingTags.length
    ? matchingTags.map((tag) => tag.name.replace(" ", "_"))
    : [];
  if (isRef) {
    if (classNames.length) classNames.push("fc-event-ref");
    else classNames = ["fc-event-ref"];
  }
  const backgroundColorDisplayed = colorToDisplay(matchingTags);

  let hasTime = false;
  let range, endDate;
  if (isTimeGrid) {
    let parsedRange = parseRange(title);
    if (parsedRange) {
      range = parsedRange.range;
      title = title.replace(parsedRange.matchingString, "");
      hasTime = true;
    } else {
      let parsedTime = getNormalizedTimestamp(title, strictTimestampRegex);
      if (parsedTime) {
        hasTime = true;
        range = { start: parsedTime.timestamp };
        title = title.replace(parsedTime.matchingString, "");
        let duration = getDurationInMin(title);
        if (duration) {
          endDate = getDateAddingDurationToDate(
            new Date(`${date}T${range.start}`),
            duration
          );
        }
      }
    }
  }

  return {
    id,
    title: prefix + title,
    // date,
    start: hasTime ? `${date}T${range.start}` : date,
    end:
      hasTime && (range.end || endDate)
        ? endDate || `${date}T${range.end}`
        : null,
    classNames: classNames,
    extendedProps: { eventTags: matchingTags, isRef: isRef },
    color: backgroundColorDisplayed,
    display: "block",
    textColor:
      // matchingTags.length && matchingTags[0].color === "transparent"
      backgroundColorDisplayed === "transparent" ? "revert" : null,
  };
};

export const colorToDisplay = (tags) => {
  if (tags[0].name === "TODO" && tags.length > 1) return tags[1].color;
  else return tags[0].color;
};

export const updateEventColor = (eventTags, tagsToDisplay) => {
  let foundColor = null;
  for (let i = 0; i < eventTags.length; i++) {
    if (tagsToDisplay.find((tag) => tag.name === eventTags[i].name)) {
      if (i !== 0 || eventTags[i].name !== "TODO") return eventTags[i].color;
      foundColor = eventTags[i].color;
    }
  }
  return foundColor;
};

const isReferencingDNP = (refs, dnpUid) => {
  dnpUidRegex.lastIndex = 0;
  return refs.some((ref) => ref.uid !== dnpUid && dnpUidRegex.test(ref.uid));
};

export const replaceItemAndGetUpdatedArray = (
  array,
  itemToReplace,
  newItem,
  key
) => {
  const indexOfItemToReplace = key
    ? array.findIndex((item) => item.name === itemToReplace.name)
    : array.indexOf(itemToReplace);
  // console.log("indexOfItemToReplace :>> ", indexOfItemToReplace);
  if (indexOfItemToReplace === -1) return array;
  array.splice(indexOfItemToReplace, 1, newItem);
  return array;
};

export const removeSquareBrackets = (str) => {
  return str.replace("[[", "").replace("]]", "");
};

export const getCalendarUidFromPage = async (targetPageUid) => {
  if (!isExistingNode(targetPageUid)) {
    await window.roamAlphaAPI.data.page.create({
      page: {
        title: dnpUidToPageTitle(targetPageUid),
        uid: targetPageUid,
      },
    });
  }
  let targetBlockUid = getFirstBlockUidByReferenceOnPage(
    "calendar",
    targetPageUid
  );
  if (!targetBlockUid)
    targetBlockUid = await createChildBlock(targetPageUid, "#calendar");
  return targetBlockUid;
};

export const getTrimedArrayFromList = (list) => {
  if (!list.trim()) return [];
  const arr = list.split(",");
  return arr.map((elt) => elt.trim()).filter((elt) => elt.length > 0);
};

export const saveViewSetting = (setting, value, isInSidebar) => {
  const sidebarSuffix = isInSidebar ? "-sb" : "";
  extensionStorage.set(setting + sidebarSuffix, value);
};

export const moveDroppedEventBlock = async (event) => {
  if (event.extendedProps.isRef) {
    let blockContent = getBlockContentByUid(event.id);
    let matchingDates = blockContent.match(roamDateRegex);
    const newRoamDate = window.roamAlphaAPI.util.dateToPageTitle(event.start);
    if (matchingDates && matchingDates.length) {
      let currentDateStr = removeSquareBrackets(matchingDates[0]);
      blockContent = blockContent.replace(currentDateStr, newRoamDate);
    } else blockContent += ` [[${newRoamDate}]]`;
    await window.roamAlphaAPI.updateBlock({
      block: { uid: event.id, string: blockContent },
    });
    event.setProp("title", resolveReferences(blockContent));
  } else {
    const currentCalendarUid = getParentBlock(event.id);
    let calendarBlockUid = await getCalendarUidFromPage(
      window.roamAlphaAPI.util.dateToPageUid(event.start)
    );
    await window.roamAlphaAPI.moveBlock({
      location: {
        "parent-uid": calendarBlockUid,
        order: "last",
      },
      block: { uid: event.id },
    });
    deleteBlockIfNoChild(currentCalendarUid);
  }
};

export const updateTimestampsInBlock = async (event, oldEvent) => {
  const startTimestamp = getTimestampFromHM(
    event.start.getHours(),
    event.start.getMinutes()
  );
  // console.log("start timestamp", startTimestamp);
  let endTimestamp;
  let hasTimestamp = true;
  let initialRange, newRange, hasDuration;
  let blockContent = getBlockContentByUid(event.id);
  if (event.end || oldEvent.end) {
    if (event.end)
      endTimestamp = getTimestampFromHM(
        event.end.getHours(),
        event.end.getMinutes()
      );
    initialRange = parseRange(blockContent);
    if (initialRange) {
      initialRange = initialRange.matchingString.trim();
      // console.log("initialRange :>> ", initialRange);
      newRange = getFormatedRange(startTimestamp, endTimestamp);
    }
    // if range is defined by a start time + duration
    else {
      hasDuration = true;
    }
  }
  if ((!event.end && !oldEvent.end) || hasDuration) {
    initialRange = getNormalizedTimestamp(blockContent, strictTimestampRegex);
    if (initialRange) {
      initialRange = initialRange.matchingString.trim();
    } else hasTimestamp = false;
    // console.log("initialRange :>> ", initialRange);
    newRange = event.end
      ? getFormatedRange(startTimestamp, endTimestamp)
      : startTimestamp;
  }
  if (hasTimestamp) {
    if (startTimestamp === "0:00") {
      newRange = "";
      initialRange += " ";
    }
    blockContent = blockContent.replace(initialRange, newRange);
  } else {
    const shift =
      blockContent.includes("{{[[TODO]]}}") ||
      blockContent.includes("{{[[DONE]]}}")
        ? 13
        : 0;
    blockContent = shift
      ? blockContent.substring(0, shift) +
        newRange +
        " " +
        blockContent.substring(shift)
      : newRange + " " + blockContent;
  }
  await updateBlock(event.id, blockContent);
};

export const filterEvents = (
  events,
  tagsToDisplay,
  filterLogic,
  isInSidebar
) => {
  const eventsToDisplay =
    filterLogic === "Or"
      ? events.filter(
          (evt) =>
            !(
              evt.extendedProps?.eventTags[0].name === "DONE" &&
              !tagsToDisplay.some((tag) => tag.name === "DONE")
            ) &&
            evt.extendedProps?.eventTags?.some(
              (tag) => tag["isToDisplay" + (isInSidebar ? "InSb" : "")]
            )
        )
      : events.filter((evt) =>
          tagsToDisplay.every((tag) =>
            evt.extendedProps?.eventTags?.some((t) => t.name === tag.name)
          )
        );

  return eventsToDisplay.map((evt) => {
    // if (evt.extendedProps.eventTags.length > 1)
    evt.color =
      updateEventColor(evt.extendedProps.eventTags, tagsToDisplay) || evt.color;
    return evt;
  });
};
