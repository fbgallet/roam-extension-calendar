import { uidRegex } from "./regex";

export function getTreeByUid(uid) {
  if (uid)
    return window.roamAlphaAPI.q(`[:find (pull ?page
                       [:block/uid :block/string :block/children {:block/refs [:block/uid]} :block/order {:block/page [:block/uid]}
                          {:block/children ...} ])
                        :where [?page :block/uid "${uid}"]  ]`)[0];
  else return null;
}

export function getParentBlock(uid) {
  // This query doesn't seem to be reliable
  // let result = window.roamAlphaAPI.pull(
  //   "[:block/uid {:block/parents [:block/uid]}]",
  //   [":block/uid", uid]
  // );
  // if (result) {
  //   return result[":block/parents"].at(1)[":block/uid"];
  // } else return "";
  let result = window.roamAlphaAPI.pull(
    "[:block/uid {:block/parents [:block/uid {:block/children [:block/uid]}]}]",
    [":block/uid", uid]
  );
  if (result) {
    const directParent = result[":block/parents"].find((parent) =>
      parent[":block/children"]?.some((child) => child[":block/uid"] === uid)
    );
    return directParent[":block/uid"];
  } else return "";
}

export function hasChildrenBlocks(uid) {
  const tree = getTreeByUid(uid);
  if (!tree && !tree.length) return null;
  if (!tree[0].children) return false;
  return true;
}

export function getFirstChildrenOfReferenceByNameOnPageByUid(refName, pageUid) {
  const result = window.roamAlphaAPI.q(`[:find
    (pull ?children [:block/string :block/uid :block/refs])
  :where
    [?page :block/uid "${pageUid}"]
    [?reference :node/title "${refName}"]
    [?node :block/page ?page]
    [?node :block/refs ?reference]
    [?node :block/children ?children]
    [?children :block/parents ?node]]`);
  if (result) return result.map((child) => child[0]);
  else return null;
}

export function getFirstBlockUidByReferenceOnPage(refName, pageUid) {
  const result = window.roamAlphaAPI.q(`[:find
    (pull ?node [:block/string :block/uid])
  :where
    [?page :block/uid "${pageUid}"]
    [?reference :node/title "${refName}"]
    [?node :block/page ?page]
    [?node :block/refs ?reference]
    ]`);
  if (result.length !== 0) return result[0][0]["uid"];
  else return null;
}

export function getBlocksUidReferencedInThisBlock(uid) {
  let q = `[:find ?u 
            :where 
              [?r :block/uid "${uid}"] 
              [?r :block/refs ?x] 
              [?x :block/uid ?u] ]`;
  return window.roamAlphaAPI.q(q).map((ref) => ref[0]);
}

export async function createChildBlock(
  parentUid,
  content = "",
  order = "last",
  open = true
) {
  const uid = window.roamAlphaAPI.util.generateUID();
  await window.roamAlphaAPI.createBlock({
    location: { "parent-uid": parentUid, order: order },
    block: { string: content, uid: uid, open: open },
  });
  return uid;
}

export async function createNewPageIfNotExisting(title, uid, isDNP = false) {
  if (!isExistingNode(uid)) {
    const page = {
      title: title,
    };
    if (!isDNP) page.uid = uid;
    await window.roamAlphaAPI.data.page.create({
      page,
    });
  }
}

export function getBlockContentByUid(uid) {
  let result = window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid]);
  if (result) return result[":block/string"];
  else return "";
}

export function isExistingNode(uid) {
  let result = window.roamAlphaAPI.pull("[:db/id]", [":block/uid", uid]);
  if (result === null) return false;
  return true;
}

export function getLinkedReferencesTrees(pageUid, sourcePageUidToExclude) {
  if (!pageUid) return null;
  let result = window.roamAlphaAPI.q(
    `[:find
      (pull ?node [:block/uid :block/string :edit/time {:block/refs [:block/uid]} :block/children {:block/page [:block/uid]}
      {:block/children ...}])
  :where
    [?test-Ref :block/uid "${pageUid}"]
    [?node :block/refs ?test-Ref]
  ]`
  );
  if (sourcePageUidToExclude)
    result = result.filter((ref) => ref[0].page.uid !== sourcePageUidToExclude);
  // sorted by edit time from most recent to older
  const reverseTimeSorted = result.sort((a, b) => b[0].time - a[0].time);
  return reverseTimeSorted;
}

export function getFlattenedContentOfParentAndFirstChildren(uid) {
  let flattenedContent = getBlockContentByUid(uid);
  let children = getOrderedDirectChildren(uid);
  if (children)
    children.forEach((child) => {
      flattenedContent += "\n" + child.string;
    });
  return flattenedContent;
}

function getOrderedDirectChildren(uid) {
  if (!uid) return null;
  let result = window.roamAlphaAPI.q(`[:find (pull ?page
                      [:block/uid :block/string :block/children :block/order
                         {:block/children  ...} ])
                       :where [?page :block/uid "${uid}"] ]`)[0][0];
  if (!result.children) {
    return null;
  }
  return result.children
    .sort((a, b) => a.order - b.order)
    .map((block) => ({ string: block.string, uid: block.uid }));
}

export function getPageNameByPageUid(uid) {
  let r = window.roamAlphaAPI.data.pull("[:node/title]", [":block/uid", uid]);
  if (r != null) return r[":node/title"];
  else return undefined;
}

export function getPageUidByPageName(title) {
  let r = window.roamAlphaAPI.data.pull("[:block/uid]", [":node/title", title]);
  if (r != null) return r[":block/uid"];
  else return null;
}

export async function updateBlock(uid, content) {
  await window.roamAlphaAPI.updateBlock({
    block: { uid: uid, string: content },
  });
}

export async function deleteBlock(targetUid) {
  await window.roamAlphaAPI.deleteBlock({ block: { uid: targetUid } });
}
export async function deleteBlockIfNoChild(targetUid) {
  const hasChildren = hasChildrenBlocks(targetUid);
  if (!hasChildren) await deleteBlock(targetUid);
}

export function processNotesInTree(tree, callback, callbackArgs) {
  //  tree = tree.sort((a, b) => a.order - b.order);
  for (let i = 0; i < tree.length; i++) {
    let content = tree[i].string;
    callback(callbackArgs);
    let subTree = tree[i].children;
    if (subTree) {
      processNotesInTree(subTree, callback);
    }
  }
}

export const resolveReferences = (content, refsArray = [], once = false) => {
  uidRegex.lastIndex = 0;
  if (uidRegex.test(content)) {
    uidRegex.lastIndex = 0;
    let matches = content.matchAll(uidRegex);
    for (const match of matches) {
      let refUid = match[0].slice(2, -2);
      // prevent infinite loop !
      let isNewRef = !refsArray.includes(refUid);
      refsArray.push(refUid);
      let resolvedRef = getBlockContentByUid(refUid);
      uidRegex.lastIndex = 0;
      if (uidRegex.test(resolvedRef) && isNewRef && !once)
        resolvedRef = resolveReferences(resolvedRef, refsArray);
      content = content.replace(match, resolvedRef);
    }
  }
  return content;
};

export const removeTagsFromBlock = (blockUid, tagArray = []) => {
  let blockContent = getBlockContentByUid(blockUid);
  let isRemoved = false;
  if (tagArray.length) {
    tagArray.forEach((tag) => {
      const thisTagRegex = new RegExp(`#${tag}|#?\\[\\[${tag}\\]\\]|${tag}::`);
      thisTagRegex.lastIndex = 0;
      let tagMention = blockContent.match(thisTagRegex);
      if (tagMention) {
        tagMention = tagMention[0];
        if (tagMention === "[[DONE]]" || tagMention === "[[TODO]]")
          tagMention = `{{${tagMention}}}`;
        blockContent = blockContent.replace(tagMention, "").trim();
        isRemoved = true;
      }
    });
  }
  if (isRemoved) updateBlock(blockUid, blockContent);
};

export const dnpUidToPageTitle = (dnpUid) => {
  const dateArray = dnpUid.split("-");
  const year = parseInt(dateArray[2]);
  const month = parseInt(dateArray[0]) - 1; // Les mois sont indexés de 0 à 11 en JavaScript
  const day = parseInt(dateArray[1]);
  const date = new Date(year, month, day);

  return window.roamAlphaAPI.util.dateToPageTitle(date);
};
