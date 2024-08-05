import {
  calendarTag,
  eventsOrder,
  extensionStorage,
  isSubtaskToDisplay,
  mapOfTags,
  rangeEndAttribute,
} from "..";
import {
  addDaysToDate,
  dateToISOString,
  getDateAddingDurationToDate,
  getDateFromDnpUid,
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
  escapeCharacters,
  queryRegex,
  roamDateRegex,
  startDateRegex,
  uidInRefOrEmbedRegex,
  untilDateRegex,
} from "./regex";
import {
  createChildBlock,
  createNewPageIfNotExisting,
  deleteBlock,
  deleteBlockIfNoChild,
  dnpUidToPageTitle,
  getBlockContentByUid,
  getBlocksUidReferencedInThisBlock,
  getFirstBlockUidByReferenceOnPage,
  getLinkedReferencesTrees,
  getPageUidByPageName,
  getParentBlock,
  getTreeByUid,
  resolveReferences,
  updateBlock,
} from "./roamApi";

let eventsRefs = [];
let possibleDuplicateEvents = [];

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
  possibleDuplicateEvents = [];
  for (
    let currentDate = start;
    currentDate <= end;
    currentDate = getDistantDate(currentDate, 1)
  ) {
    const dnpUid = window.roamAlphaAPI.util.dateToPageUid(currentDate);
    const dnpTree = getTreeByUid(dnpUid);
    let pageAndRefsTrees = [];
    pageAndRefsTrees.push(
      !dnpTree || (dnpTree && !dnpTree[0].children) ? [] : dnpTree[0].children
    );
    // if (isIncludingRefs) {
    const refTrees = getLinkedReferencesTrees(
      dnpUid,
      getPageUidByPageName("roam/memo")
    );
    pageAndRefsTrees = pageAndRefsTrees.concat(refTrees);
    for (let i = 0; i < pageAndRefsTrees.length; i++) {
      const filteredEvents = filterTreeToGetEvents(
        dnpUid,
        currentDate,
        pageAndRefsTrees[i],
        mapOfTags,
        onlyCalendarTag,
        i > 0 ? true : false,
        isTimeGrid,
        isIncludingRefs
      );
      // console.log("filteredEvents :>> ", filteredEvents);
      if (filteredEvents.length > 0) events = events.concat(filteredEvents);
    }
  }
  // console.log("events from data.js :>> ", events);

  for (let i = 0; i < possibleDuplicateEvents.length; i++) {
    const duplicateEvent = events.findIndex(
      (event) =>
        event.id === possibleDuplicateEvents[i].id &&
        event.start === possibleDuplicateEvents[i].start &&
        !event.extendedProps.hasInfosInChildren
    );
    if (duplicateEvent !== -1) events.splice(duplicateEvent, 1);
  }
  return events;
};

const filterTreeToGetEvents = (
  dnpUid,
  currentDate,
  tree,
  mapToInclude,
  onlyCalendarTag,
  isRef,
  isTimeGrid,
  isIncludingRefs
) => {
  // console.log("currentDate :>> ", currentDate);
  const events = [];
  const dateString = dateToISOString(currentDate);

  if (tree && tree.length) processTreeRecursively(tree, isRef ? true : false);
  return events;

  function processTreeRecursively(
    tree,
    isCalendarTree,
    isChildOfEvent = false,
    level = ""
  ) {
    if (eventsOrder === "block position" && tree[0].order)
      tree = tree.sort((a, b) => a.order - b.order);
    for (let i = 0; i < tree.length; i++) {
      let blockLevel = level + i.toString();
      let isCalendarParent = false;
      let block = {
        uid: tree[i].uid,
        title: tree[i].string || "",
        refs: tree[i].refs?.map((ref) => ref.uid),
        tree: tree[i].children,
      };
      let startUid; // true if the block contains only a block ref or embed
      let isInlineRef, containerBlockUid;
      let hasCrucialDate; // a "crucial date" is (date+tag) in a child => event will be displayed even if 'dnp' or 'refs' are off
      let hasEventInBlock = false; // if there is an event in a given blocks, all its children are ignored
      let childInfos, isTask;

      if (isDuplicateEvent(isCalendarTree, block)) {
        continue;
      }

      // substitue original block to ref if current block contains only ref or embed
      // concerns only blocks under #calendar tag
      if (isCalendarTree && block.title) {
        const matchingRef = block.title.trim().match(uidInRefOrEmbedRegex);
        if (matchingRef) {
          containerBlockUid = block.uid;
          ({ isInlineRef, block } = getReferencedBlockValues(
            matchingRef,
            block
          ));
        }
      }

      let matchingTags = getMatchingTags(mapToInclude, block.refs);

      // let until = getBoundaryDate(block.title);

      if (isCalendarTree || matchingTags.length) {
        if (isContainingQuery(block.title)) continue;
        if (!isCalendarTree && matchingTags[0].name === calendarTag.name)
          isCalendarParent = true;
        else {
          if (!isCalendarTree && !isRef && onlyCalendarTag) continue;

          let untilDate, untilUid, startDNP;

          if (
            // isSubtaskToDisplay &&
            matchingTags.some(
              (tag) => tag.name === "TODO" || tag.name === "DONE"
            )
          )
            isTask = true;

          if (!isChildOfEvent || isTask) {
            if (isCalendarTree || isRef) {
              let until = getBoundaryDate(block.title);
              isRef &&
                !isTask &&
                ({ block, matchingTags, startUid, startDNP, hasCrucialDate } =
                  substitueParentBlockValuesIfCrucialDate({
                    block,
                    matchingTags,
                    until,
                  }));

              if (block.tree && !isTask) {
                childInfos = getInfosFromChildren(block.tree);
                if (childInfos) {
                  if (!isRef && childInfos.start) continue;
                  if (isRef && !startDNP && until) continue; // ????
                  until = childInfos.until;
                  // avoid duplicates
                  matchingTags = Array.from(
                    new Set([...matchingTags, ...childInfos.tags])
                  );
                  createEventRefsFromChildren(
                    block,
                    childInfos,
                    matchingTags,
                    isCalendarTree,
                    blockLevel
                  );
                }
              }
              if (until) {
                if (
                  isRef &&
                  (!startDNP || childInfos?.start) &&
                  dateString === dateToISOString(until.date)
                )
                  continue;
                // block.title = block.title.replace(until.matchingStr, "").trim();
                untilDate = addDaysToDate(until.date, 1);
                untilUid = until.uid || null;
              }
            }
            hasEventInBlock = true;
            if (!isRef || isIncludingRefs || hasCrucialDate) {
              events.push(
                parseEventObject(
                  {
                    id: containerBlockUid || block.uid,
                    title: resolveReferences(block.title),
                    date: startDNP || dateString,
                    startUid,
                    untilDate,
                    untilUid,
                    matchingTags,
                    isRef: isRef && !startDNP,
                    hasInfosInChildren: childInfos ? true : false,
                    hasCrucialDate: hasCrucialDate,
                    isInlineRef,
                    level: blockLevel,
                  },
                  isCalendarTree,
                  isTimeGrid
                )
              );
            }
          }
        }
      }
      if (
        //(isSubtaskToDisplay || !hasEventInBlock) &&
        !(hasEventInBlock && !isSubtaskToDisplay) &&
        !isRef &&
        // (isSubtaskToDisplay || !matchingTags.length) &&
        // !isCalendarTree &&
        // (!matchingTags.length ||
        //   !(matchingTags.includes("TODO") || matchingTags.includes("DONE"))) &&
        block.tree
      ) {
        //   console.log("block.title (RECURSIV process) :>> ", block.title);
        processTreeRecursively(
          block.tree,
          isCalendarParent || (isSubtaskToDisplay && isCalendarTree),
          hasEventInBlock || childInfos || isChildOfEvent || hasCrucialDate
            ? true
            : false,
          blockLevel + "."
        );
      }
      if (isCalendarParent && onlyCalendarTag) break;
    }
  }

  function isDuplicateEvent(isCalendarTree, block) {
    // console.log("eventsRefs :>> ", eventsRefs);
    // console.log("block.uid :>> ", block.uid);
    if (
      (!isCalendarTree &&
        isRef &&
        isReferencingDNP(block.refs, dnpUid) &&
        block.refs) ||
      eventsRefs.includes(block.uid)
    )
      return true;
    return false;
  }

  function getReferencedBlockValues(matchingRef, { uid, title, tree, refs }) {
    if (matchingRef) {
      uid = matchingRef[2] || matchingRef[3];
      refs = getBlocksUidReferencedInThisBlock(uid);
      // if embed:
      if (matchingRef[2]) {
        title = getBlockContentByUid(uid);
        const embedTree = getTreeByUid(uid);
        if (embedTree && embedTree[0].children) tree = embedTree[0].children;
      }
    }
    return { isInlineRef: true, block: { uid, title, tree, refs } };
  }

  function isContainingQuery(title) {
    const matchingQuery = title.match(queryRegex);
    if (matchingQuery) return true;
    return false;
  }

  function substitueParentBlockValuesIfCrucialDate({
    block,
    matchingTags,
    until,
  }) {
    let startDNP, startUid, hasCrucialDate;

    let start = getBoundaryDate(block.title, "start");
    if (
      start ||
      until ||
      (matchingTags.length && roamDateRegex.test(block.title))
    ) {
      const parentUid = getParentBlock(block.uid);
      if (parentUid) {
        const referencedInParent = parentUid
          ? getBlocksUidReferencedInThisBlock(parentUid)
          : null;
        const parentMatchingTags = getMatchingTags(
          mapToInclude,
          referencedInParent
        );
        if (parentMatchingTags.length) {
          hasCrucialDate = true;
          if (
            (start || until) &&
            !matchingTags.length &&
            parentMatchingTags.length
          ) {
            // eventsRefs.push(parentUid);
            if (start) startUid = block.uid;
            block.uid = parentUid;
            const parentTree = getTreeByUid(parentUid);
            block.tree = parentTree[0].children;
            matchingTags = parentMatchingTags;
            if (until && isRef) {
              if (block.tree && isInDNP(block.tree[0].page.uid)) {
                const dnpUid = block.tree[0].page.uid;
                startDNP = dateToISOString(getDateFromDnpUid(dnpUid));
                possibleDuplicateEvents.push({
                  id: block.uid,
                  start: startDNP,
                });
              }
            }
          } else {
            // TODO add parent tags ?
          }
          block.title = getBlockContentByUid(parentUid);
          block.uid = parentUid;
        } else if (start || until) {
          hasCrucialDate = true;
          if (start)
            block.title = block.title.replace(start.matchingStr, "").trim();
          if (until)
            block.title = block.title.replace(until.matchingStr, "").trim();
        }
      }
    }
    return {
      block,
      matchingTags,
      startUid,
      startDNP,
      hasCrucialDate,
    };
  }

  function createEventRefsFromChildren(
    block,
    childInfos,
    matchingTags,
    isCalendarTree,
    level
  ) {
    if (childInfos.eventRefs.length) {
      childInfos.eventRefs.forEach((childRef) => {
        let hasCrucialDateRef;
        eventsRefs.push(childRef.uid);
        if (childRef.tags && childRef.date) {
          hasCrucialDateRef = true;
        }
        let refMatchingTags = [...matchingTags];
        if (
          matchingTags.some((tag) => tag.name === "TODO" || tag.name === "DONE")
        ) {
          refMatchingTags.splice(1, 0, ...childRef.tags);
        } else refMatchingTags = childRef.tags.concat(matchingTags);

        if (!isRef || isIncludingRefs || hasCrucialDateRef)
          events.push(
            parseEventObject(
              {
                id: block.uid,
                title: resolveReferences(block.title),
                date: window.roamAlphaAPI.util.pageTitleToDate(
                  removeSquareBrackets(childRef.date)
                ),
                untilDate: null,
                matchingTags: refMatchingTags,
                isRef: true,
                hasInfosInChildren: true,
                hasCrucialDate: hasCrucialDateRef,
                refSourceUid: childRef.uid,
                level,
              },
              isCalendarTree,
              isTimeGrid
            )
          );
      });
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
  let hasInfosToReturn = false;
  let infos = {
    start: null,
    until: null,
    tags: [],
    eventRefs: [],
  };
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child.refs) continue;
    const childMatchingTags = getMatchingTags(
      mapToInclude.filter((tag) => tag.name !== "TODO" && tag.name !== "DONE"),
      child.refs.map((ref) => ref.uid)
    );
    const childMatchingDate = child.string.match(roamDateRegex);
    if (childMatchingDate) {
      eventsRefs.push(child.uid);

      hasInfosToReturn = true;
      const start = getBoundaryDate(child.string, "start");
      if (start) {
        infos.start = true;
        continue;
      }
      const until = getBoundaryDate(child.string);
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
    hasCrucialDate,
    untilUid,
    startUid,
    refSourceUid,
    level,
  },
  isCalendarTree = true,
  isTimeGrid = true
) => {
  let prefix = "";
  let classNames = [];
  if (isCalendarTree && !matchingTags.length) {
    matchingTags.push(calendarTag);
    prefix = "• ";
    classNames = ["fc-event-notag"];
  } else if (matchingTags.length) {
    classNames = matchingTags.map((tag) => tag.name.replace(" ", "_"));
  }
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
      hasCrucialDate,
      startUid,
      untilUid,
      refSourceUid,
      level,
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
  if (!refs || !refs.length) return false;
  return refs.some((ref) => ref.uid !== dnpUid && dnpUidRegex.test(ref.uid));
};

const isInDNP = (pageUid) => {
  return dnpUidRegex.test(pageUid);
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
  await createNewPageIfNotExisting(
    dnpUidToPageTitle(targetPageUid),
    targetPageUid,
    true
  );
  let targetBlockUid = getFirstBlockUidByReferenceOnPage(
    calendarTag.name,
    targetPageUid
  );
  if (!targetBlockUid)
    targetBlockUid = await createChildBlock(
      targetPageUid,
      calendarTag.name.includes(" ")
        ? `#[[${calendarTag.name}]]`
        : `#${calendarTag.name}`
    );
  return targetBlockUid;
};

export const getTrimedArrayFromList = (list) => {
  if (!list.trim()) return [];
  const arr = list.split(",");
  return arr.map((elt) => elt.trim()).filter((elt) => elt.length > 0);
};

export const getNormalizedDisjunctionForRegex = (list) => {
  const trimedArray = getTrimedArrayFromList(list);
  return trimedArray.map((elt) => escapeCharacters(elt)).join("|");
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

  if (oldEvent.allDay && !event.allDay) {
    event.setExtendedProp("hasTime", true);
  }
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
      `${rangeEndAttribute}:: [[${untilDateStr}]]`,
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

export const updateStoredTags = async (tags) => {
  await extensionStorage.set(
    "fc-tags-info",
    JSON.stringify(
      tags
        .filter((tag) => !tag.isTemporary)
        .map((tag) => ({
          name: tag.name,
          color: tag.color,
          isToDisplay: tag.isToDisplay,
          isToDisplayInSb: tag.isToDisplayInSb,
          pages: tag.pages,
        }))
    )
  );
};
