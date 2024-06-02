import { calendarTag, mapOfTags } from "..";
import { dateToISOString, getDistantDate } from "./dates";
import { dnpUidRegex } from "./regex";
import {
  createChildBlock,
  dnpUidToPageTitle,
  getFirstBlockUidByReferenceOnPage,
  getLinkedReferencesTrees,
  getPageNameByPageUid,
  getPageUidByPageName,
  getTreeByUid,
  isExistingNode,
  resolveReferences,
} from "./roamApi";

export const getBlocksToDisplayFromDNP = async (
  start,
  end,
  onlyCalendarTag,
  isIncludingRefs
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
        i > 0 ? true : false
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
  isRef
) => {
  // console.log("currentDate :>> ", currentDate);
  const events = [];
  const dateString = dateToISOString(currentDate);

  if (tree && tree.length) processTreeRecursively(tree, isRef ? true : false);
  return events;

  function processTreeRecursively(tree, isCalendarTree) {
    let isCalendarParent = false;
    for (let i = 0; i < tree.length; i++) {
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
              isCalendarTree
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
  isCalendarTree = true
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

  return {
    id,
    title: prefix + title,
    date,
    classNames: classNames,
    extendedProps: { eventTags: matchingTags, isRef: isRef },
    color: backgroundColorDisplayed,
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
  return arr.map((elt) => elt.trim());
};
