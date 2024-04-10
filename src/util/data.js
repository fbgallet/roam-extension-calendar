import { dateToISOString, getDistantDate } from "./dates";
import { getPageUidByPageName, getTreeByUid } from "./roamApi";

const tagsTitle = ["important 📌", "due", "TODO", "DONE"];
const mapOfTags = new Map(
  tagsTitle.map((tag) => [getPageUidByPageName(tag), tag])
);

export const getBlocksToDisplayFromDNP = (start, end, toInclude = "TODO") => {
  console.log("mapOfTags :>> ", mapOfTags);
  let events = [];
  // const mapToInclude = toInclude.map((title) => {
  //   return { title, uid: getPageUidByPageName(title) };
  // });
  // const uidsToInclude = mapToInclude.map((ref) => ref.uid);
  //   const currentDnp = window.roamAlphaAPI.util.dateToPageUid(start);
  //   const endDnp = window.roamAlphaAPI.util.dateToPageUid(end);
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
      console.log("filteredEvents :>> ", filteredEvents);
      if (filteredEvents.length > 0) events = events.concat(filteredEvents);
    }
  }
  console.log("events :>> ", events);
  return events;
};

const filterTreeToGetEvents = (currentDate, tree, mapToInclude) => {
  console.log("currentDate :>> ", currentDate);
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
      console.log("matchingRefs :>> ", matchingRefs);
      if (
        tree[i].refs?.length > 0 &&
        matchingRefs.length > 0
        // hasCommonElement(
        //   tree[i].refs.map((ref) => ref.uid),
        //   uidsToInclude
        // )
      ) {
        dateString = dateString || dateToISOString(currentDate);
        events.push({
          id: tree[i].uid,
          title: tree[i].string,
          date: dateString,
          className: matchingRefs.join(",").replace(" ", "_"),
          extendedProps: { eventTags: matchingRefs },
          color:
            matchingRefs.length && matchingRefs[0] === "TODO"
              ? "blue"
              : matchingRefs[0] === "DONE"
              ? "grey"
              : "red",
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
  return Array.from(mapOfTags.entries())
    .filter(([uid]) => refUidArray.includes(uid))
    .map(([uid, tag]) => tag);
};

const hasCommonElement = (arr1, arr2) => {
  return arr1.some((item) => arr2.includes(item));
};
