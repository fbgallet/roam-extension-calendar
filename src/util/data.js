import { dateToISOString, getDistantDate } from "./dates";
import { getPageUidByPageName, getTreeByUid } from "./roamApi";

// new Map(tagsTitle.map((tag) => [getPageUidByPageName(tag), tag]));

const getTagColor = (title) => {
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
    const dnpTree = getTreeByUid(
      window.roamAlphaAPI.util.dateToPageUid(currentDate)
    );
    // console.log(window.roamAlphaAPI.util.dateToPageUid(currentDate), dnpTree);
    if (dnpTree) {
      const filteredEvents = filterTreeToGetEvents(
        currentDate,
        dnpTree,
        mapOfTags
      );
      // console.log("filteredEvents :>> ", filteredEvents);
      if (filteredEvents.length > 0) events = events.concat(filteredEvents);
    }
  }
  // console.log("events :>> ", events);
  return events;
};

const filterTreeToGetEvents = (currentDate, tree, mapToInclude) => {
  // console.log("currentDate :>> ", currentDate);
  const events = [];
  let dateString;

  processTreeRecursively(tree);
  return events;

  function processTreeRecursively(tree) {
    for (let i = 0; i < tree.length; i++) {
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
          extendedProps: { eventTags: matchingRefs },
          color: matchingRefs.length
            ? mapOfTags.find((tag) => tag.title === matchingRefs[0]).color
            : undefined,
        });
      }
      let subTree = tree[i].children;
      if (subTree) {
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

export const replaceItemAndGetUpdatedArray = (
  array,
  itemToReplace,
  newItem
) => {
  const indexOfItemToReplace = array.indexOf(itemToReplace);
  if (indexOfItemToReplace === -1) return array;
  return array.splice(indexOfItemToReplace, 1, newItem);
};

// const hasCommonElement = (arr1, arr2) => {
//   return arr1.some((item) => arr2.includes(item));
// };
