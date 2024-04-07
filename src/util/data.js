import { getPageUidByPageName, getTreeByUid } from "./roamApi";

export const getBlocksToDisplayFromDNP = () => {
  const dnpTree = getTreeByUid("04-05-2024");
  const events = filterTreeToGetEvents(dnpTree, ["TODO"]);
  console.log("events :>> ", events);
  return events;
};

const filterTreeToGetEvents = (tree, toInclude) => {
  const events = [];
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
      )
        events.push({
          id: tree[i].uid,
          title: tree[i].string,
          date: "2024-04-05",
        });
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
