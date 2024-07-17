import { calendarTag, extensionStorage, mapOfTags } from "..";
import {
  addDaysToDate,
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
import {
  dnpUidRegex,
  queryRegex,
  roamDateRegex,
  startDateRegex,
  untilDateRegex,
} from "./regex";
import {
  createChildBlock,
  deleteBlock,
  deleteBlockIfNoChild,
  dnpUidToPageTitle,
  getBlockContentByUid,
  getBlocksUidReferencedInThisBlock,
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

let eventsRefs = [];

export const getBlocksToDisplayFromDNP = async (
  start,
  end,
  onlyCalendarTag,
  isIncludingRefs,
  isTimeGrid
) => {
  // console.log("mapOfTags :>> ", mapOfTags);
  let events = [];
  eventsRefs = [];
  for (
    let currentDate = start;
    currentDate <= end;
    currentDate = getDistantDate(currentDate, 1)
  ) {
    const dnpUid = window.roamAlphaAPI.util.dateToPageUid(currentDate);
    let pageAndRefsTrees = [];
    pageAndRefsTrees.push(getTreeByUid(dnpUid));
    if (dnpUid === "07-03-2024" || dnpUid === "07-07-2024") {
      console.log("currentDate :>> ", currentDate);
      console.log("dnpUid :>> ", dnpUid);
      console.log("getTreeByUid(dnpUid) :>> ", getTreeByUid(dnpUid));
    }
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
      let currentUid = tree[i].uid;
      let subTree = tree[i].children;
      let startUid;
      if (isRef) {
        // console.log("currentUid :>> ", currentUid);
        // console.log("eventsRefs :>> ", eventsRefs);
        console.log("tree[i].string :>> ", tree[i].string);
      }
      if (
        (!isCalendarTree &&
          isRef && // shouldn't be !isRef  ?????
          tree[i].refs &&
          isReferencingDNP(tree[i].refs, dnpUid)) ||
        eventsRefs.includes(currentUid)
      )
        continue;
      let title = tree[i].string;
      if (title) {
        const matchingQuery = title.match(queryRegex);
        if (matchingQuery) continue;
      }
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
          let untilDate, untilUid, childInfos;
          if (isCalendarTree || isRef) {
            let until = getBoundaryDate(title);
            if (isRef) {
              let start = getBoundaryDate(title, "start");
              console.log("start :>> ", start);
              if (start) {
                const parentUid = getParentBlock(currentUid);
                const referencedInParent = parentUid
                  ? getBlocksUidReferencedInThisBlock(parentUid)
                  : null;
                const parentMatchingTags = getMatchingTags(
                  mapToInclude,
                  referencedInParent
                );
                if (!matchingTags.length && parentMatchingTags.length) {
                  // eventsRefs.push(currentUid);
                  startUid = currentUid;
                  currentUid = parentUid;
                  title = getBlockContentByUid(parentUid);
                  const parentTree = getTreeByUid(parentUid);
                  subTree = parentTree[0].children;
                  matchingTags = parentMatchingTags;
                }
              }
            }
            if ((isCalendarTree && subTree) || (isRef && subTree)) {
              childInfos = getInfosFromChildren(subTree);
              if (childInfos) {
                until = childInfos.until;
                // avoid duplicates
                const tagsSet = new Set([...matchingTags, ...childInfos.tags]);
                matchingTags = Array.from(tagsSet);
                if (childInfos.eventRefs.length) {
                  childInfos.eventRefs.forEach((childRef) => {
                    eventsRefs.push(childRef.uid);
                    let refMatchingTags = [...matchingTags];
                    if (
                      matchingTags.some(
                        (tag) => tag.name === "TODO" || tag.name === "DONE"
                      )
                    ) {
                      refMatchingTags.splice(1, 0, ...childRef.tags);
                    } else refMatchingTags = childRef.tags.concat(matchingTags);

                    events.push(
                      parseEventObject(
                        {
                          id: currentUid,
                          title: resolveReferences(title),
                          date: window.roamAlphaAPI.util.pageTitleToDate(
                            removeSquareBrackets(childRef.date)
                          ),
                          untilDate: null,
                          matchingTags: refMatchingTags,
                          isRef: true,
                          hasInfosInChildren: true,
                          refSourceUid: childRef.uid,
                        },
                        isCalendarTree,
                        isTimeGrid
                      )
                    );
                  });
                }
              }
            }
            if (until) {
              if (isRef) {
                if (dateString === dateToISOString(until.date)) continue;
              }
              title = title.replace(until.matchingStr, "").trim();
              untilDate = addDaysToDate(until.date, 1);
              untilUid = until.uid || null;
            }
          }
          events.push(
            parseEventObject(
              {
                id: currentUid,
                title: resolveReferences(title),
                date: dateString,
                startUid,
                untilDate,
                untilUid,
                matchingTags,
                isRef,
                hasInfosInChildren: childInfos ? true : false,
              },
              isCalendarTree,
              isTimeGrid
            )
          );
        }
      }
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

export const getInfosFromChildren = (children, mapToInclude = mapOfTags) => {
  // console.log("children :>> ", children);
  let hasInfosToReturn = false;
  let infos = {
    until: null,
    tags: [],
    eventRefs: [],
  };
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child.refs) continue;
    const childMatchingTags = getMatchingTags(
      mapToInclude,
      child.refs.map((ref) => ref.uid)
    );
    const childMatchingDate = child.string.match(roamDateRegex);
    // console.log("childMatchingTags :>> ", childMatchingTags);
    if (childMatchingDate) {
      hasInfosToReturn = true;
      const start = getBoundaryDate(child.string, "start");
      if (start) continue;
      const until = getBoundaryDate(child.string);
      // console.log("until :>> ", until);
      if (until) {
        infos.until = until;
        infos.until.uid = child.uid;
        infos.tags = infos.tags.concat(childMatchingTags);
      } else {
        infos.eventRefs.push({
          date: childMatchingDate[0],
          tags: childMatchingTags,
          uid: child.uid,
        });
      }
    } else if (childMatchingTags.length) {
      hasInfosToReturn = true;
      infos.tags = infos.tags.concat(childMatchingTags);
    }
  }
  // console.log("infos :>> ", infos);
  return hasInfosToReturn ? infos : null;
};

export const parseEventObject = (
  {
    id,
    title,
    date,
    untilDate,
    matchingTags,
    isRef = false,
    hasInfosInChildren,
    untilUid,
    startUid,
    refSourceUid,
  },
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
    end: untilDate
      ? dateToISOString(new Date(untilDate))
      : hasTime && (range.end || endDate)
      ? endDate || `${date}T${range.end}`
      : null,
    classNames: classNames,
    extendedProps: {
      eventTags: matchingTags,
      isRef: isRef,
      hasTime,
      hasInfosInChildren,
      startUid,
      untilUid,
      refSourceUid,
    },
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
    let targetUid = event.extendedProps.refSourceUid || event.id;
    let blockContent = getBlockContentByUid(targetUid);
    let matchingDates = blockContent.match(roamDateRegex);
    const newRoamDate = window.roamAlphaAPI.util.dateToPageTitle(event.start);
    if (matchingDates && matchingDates.length) {
      let currentDateStr = removeSquareBrackets(matchingDates[0]);
      blockContent = blockContent.replace(currentDateStr, newRoamDate);
    } else blockContent += ` [[${newRoamDate}]]`;
    await window.roamAlphaAPI.updateBlock({
      block: { uid: targetUid, string: blockContent },
    });
    if (!event.extendedProps.refSourceUid)
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

const getBoundaryDate = (str, boundaryType = "until") => {
  const boundaryRegex =
    boundaryType === "until" ? untilDateRegex : startDateRegex;
  let date = null;
  const matchingBoundaryDate = str.match(boundaryRegex);
  console.log("matchingBoundaryDate :>> ", matchingBoundaryDate);
  if (matchingBoundaryDate && matchingBoundaryDate.length) {
    const boundaryDateStr = matchingBoundaryDate[2];
    date = window.roamAlphaAPI.util.pageTitleToDate(boundaryDateStr);
    return {
      matchingStr: matchingBoundaryDate[0],
      dateStr: boundaryDateStr,
      date,
    };
  }
  return null;
};

export const updateUntilDate = async (event, isToAddIfAbsent = true) => {
  const untilBlockUid = event.extendedProps.untilUid || event.id;
  let blockContent = getBlockContentByUid(untilBlockUid);
  const untilDate = event.end;
  const untilDateExcluding = addDaysToDate(untilDate, -1);
  const untilDateStr = window.roamAlphaAPI.util.dateToPageTitle(
    new Date(untilDateExcluding)
  );
  const until = getBoundaryDate(blockContent);
  if (until) {
    blockContent =
      untilDateStr !==
      window.roamAlphaAPI.util.dateToPageTitle(new Date(event.start))
        ? blockContent.replace(until.dateStr, untilDateStr)
        : blockContent.replace(until.matchingStr, "").trim();
  } else if (isToAddIfAbsent) {
    // blockContent += `\nuntil [[${untilDateStr}]]`;
    const childUid = await createChildBlock(
      event.id,
      `until: [[${untilDateStr}]]`,
      "first"
    );
    event.setExtendedProp("untilUid", childUid);
  }
  if (!blockContent.trim() && event.extendedProps.untilUid !== event.id) {
    deleteBlock(untilBlockUid);
  } else await updateBlock(untilBlockUid, blockContent);
};

export const updateStartDate = async (event) => {
  let blockContent = getBlockContentByUid(event.extendedProps.startUid);
  const startDate = event.start;
  const startDateStr = window.roamAlphaAPI.util.dateToPageTitle(
    new Date(startDate)
  );
  const start = getBoundaryDate(blockContent, "start");
  if (start) {
    blockContent = blockContent.replace(start.dateStr, startDateStr);
    await updateBlock(event.extendedProps.startUid, blockContent);
  }
};
