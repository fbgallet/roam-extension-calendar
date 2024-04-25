import { dateToISOString, getDistantDate } from "./dates";
import { dnpUidRegex } from "./regex";
import {
  getFirstChildrenOfReferenceByNameOnPageByUid,
  getLinkedReferencesTrees,
  getPageUidByPageName,
  getTreeByUid,
  resolveReferences,
} from "./roamApi";

// new Map(tagsTitle.map((tag) => [getPageUidByPageName(tag), tag]));

export const getTagColor = (title) => {
  switch (title) {
    case "TODO":
      return "blue";
    case "DONE":
      return "lightgrey";
    case "doing":
    case "in progress":
      return "organge";
    case "important":
    case "urgent":
      return "red";
    case "due":
    case "due date":
    case "deadline":
      return "purple";
    case "do date":
    case "scheduled":
      return "green";
    case "calendar":
      return "none";
    default:
      return "grey";
  }
};

const tagsTitle = [
  "DONE",
  "important",
  "urgent",
  "in progress",
  "due date",
  "do date",
  "scheduled",
  "calendar",
  "TODO",
];
const mapOfTags = tagsTitle.map((tag) => {
  return {
    uid: getPageUidByPageName(tag),
    title: tag,
    color: getTagColor(tag),
  };
});

export const getBlocksToDisplayFromDNP = (start, end, onlyCalendarTag) => {
  console.log("mapOfTags :>> ", mapOfTags);
  let events = [];
  for (
    let currentDate = start;
    currentDate <= end;
    currentDate = getDistantDate(currentDate, 1)
  ) {
    const dnpUid = window.roamAlphaAPI.util.dateToPageUid(currentDate);
    let pageAndRefsTrees = [];
    pageAndRefsTrees.push(getTreeByUid(dnpUid));
    const refTrees = getLinkedReferencesTrees(dnpUid);
    pageAndRefsTrees = pageAndRefsTrees.concat(refTrees);
    // console.log("pageAndRefsTrees :>> ", pageAndRefsTrees);
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
  // console.log("events :>> ", events);
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

  if (tree && tree.length) processTreeRecursively(tree);
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
        if (!isCalendarTree && matchingTags[0] === "calendar")
          isCalendarParent = true;
        else {
          if (!isCalendarTree && onlyCalendarTag) continue;
          if (isCalendarTree) matchingTags.push("calendar");
          // dateString = dateString || dateToISOString(currentDate);
          events.push({
            id: tree[i].uid,
            title: resolveReferences(tree[i].string),
            date: dateString,
            classNames: matchingTags.length
              ? matchingTags.map((tag) => tag.replace(" ", "_"))
              : "",
            eventDisplay:
              matchingTags.length === 1 && matchingTags[0] === "calendar"
                ? "list-item"
                : "block",
            extendedProps: { eventTags: matchingTags, isRef: isRef },
            color: matchingTags.length
              ? mapOfTags.find((tag) => tag.title === matchingTags[0]).color
              : undefined,
            borderColor: isRef ? "red" : "transparent",
          });
        }
      }
      let subTree = tree[i].children;
      if (
        !isCalendarTree &&
        (!matchingTags.length ||
          !(matchingTags.includes("TODO") || matchingTags.includes("DONE"))) &&
        subTree
      ) {
        processTreeRecursively(subTree, isCalendarParent);
      }
    }
  }
};

const getMatchingTags = (mapOfTags, refUidArray) => {
  if (!refUidArray) return [];
  return mapOfTags
    .filter(({ uid }) => refUidArray.includes(uid))
    .map(({ title }) => title);
};

const isReferencingDNP = (refs, dnpUid) => {
  dnpUidRegex.lastIndex = 0;
  return refs.some((ref) => ref.uid !== dnpUid && dnpUidRegex.test(ref.uid));
};

export const replaceItemAndGetUpdatedArray = (
  array,
  itemToReplace,
  newItem
) => {
  const indexOfItemToReplace = array.indexOf(itemToReplace);
  if (indexOfItemToReplace === -1) return array;
  if (itemToReplace === "TODO") {
    array.pop();
    array.unshift("DONE");
    return array;
  } else if (itemToReplace === "DONE") {
    array.shift();
    array.push("TODO");
    return array;
  } else return array.splice(indexOfItemToReplace, 1, newItem);
};

// const hasCommonElement = (arr1, arr2) => {
//   return arr1.some((item) => arr2.includes(item));
// };

export const removeSquareBrackets = (str) => {
  return str.replace("[[", "").replace("]]", "");
};
