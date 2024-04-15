import { dateToISOString, getDistantDate } from "./dates";
import {
  getLinkedReferencesTrees,
  getPageUidByPageName,
  getTreeByUid,
} from "./roamApi";

const dnpUidRegex = /(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-[0-9]{4}/;

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
    default:
      return "grey";
  }
};

const tagsTitle = [
  "DONE",
  "important",
  "urgent",
  "in progress",
  "due",
  "scheduled",
  "TODO",
];
const mapOfTags = tagsTitle.map((tag) => {
  return {
    uid: getPageUidByPageName(tag),
    title: tag,
    color: getTagColor(tag),
  };
});

export const getBlocksToDisplayFromDNP = (start, end, toInclude = "TODO") => {
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
  isRef
) => {
  // console.log("currentDate :>> ", currentDate);
  const events = [];
  let dateString;

  if (tree && tree.length) processTreeRecursively(tree);
  return events;

  function processTreeRecursively(tree) {
    for (let i = 0; i < tree.length; i++) {
      if (tree[i].refs && isReferencingDNP(tree[i].refs, dnpUid)) continue;
      const matchingRefs = getMatchingTags(
        mapToInclude,
        tree[i].refs?.map((ref) => ref.uid)
      );
      // console.log("matchingRefs :>> ", matchingRefs);
      if (tree[i].refs?.length > 0 && matchingRefs.length > 0) {
        dateString = dateString || dateToISOString(currentDate);
        events.push({
          id: tree[i].uid,
          title: tree[i].string,
          date: dateString,
          classNames: matchingRefs.map((ref) => ref.replace(" ", "_")),
          extendedProps: { eventTags: matchingRefs, isRef: isRef },
          color: matchingRefs.length
            ? mapOfTags.find((tag) => tag.title === matchingRefs[0]).color
            : undefined,
          borderColor: isRef ? "red" : "transparent",
        });
      }
      let subTree = tree[i].children;
      if (
        (!matchingRefs.length ||
          !(matchingRefs.includes("TODO") || matchingRefs.includes("DONE"))) &&
        subTree
      ) {
        processTreeRecursively(subTree);
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
  return refs.some((ref) => ref.uid !== dnpUid && ref.uid.match(dnpUidRegex));
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
