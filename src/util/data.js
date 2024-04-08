import { dateToISOString, getDistantDate } from "./dates";
import { getPageUidByPageName, getTreeByUid } from "./roamApi";

export const getBlocksToDisplayFromDNP = (start, end) => {
  let events = [];
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
      const filteredEvents = filterTreeToGetEvents(currentDate, dnpTree, [
        "TODO",
      ]);
      console.log("filteredEvents :>> ", filteredEvents);
      if (filteredEvents.length > 0) events = events.concat(filteredEvents);
    }
  }
  console.log("events :>> ", events);
  return events;
};

const filterTreeToGetEvents = (currentDate, tree, toInclude) => {
  console.log("currentDate :>> ", currentDate);
  const events = [];
  let dateString;
  const uidsToInclude = toInclude.map((title) => getPageUidByPageName(title));
  processTreeRecursively(tree, uidsToInclude);
  return events;

  function processTreeRecursively(tree, toInclude) {
    for (let i = 0; i < tree.length; i++) {
      if (
        tree[i].refs?.length > 0 &&
        hasCommonElement(
          tree[i].refs.map((ref) => ref.uid),
          toInclude
        )
      ) {
        dateString = dateString || dateToISOString(currentDate);
        events.push({
          id: tree[i].uid,
          title: tree[i].string,
          date: dateString,
        });
      }
      let subTree = tree[i].children;
      if (subTree) {
        processTreeRecursively(subTree, toInclude);
      }
    }
  }
};

const hasCommonElement = (arr1, arr2) => {
  return arr1.some((item) => arr2.includes(item));
};
