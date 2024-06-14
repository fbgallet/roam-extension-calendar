import { mapOfTags } from "..";
import { getPageUidByPageName } from "../util/roamApi";

export class EventTag {
  constructor({
    name,
    color = "none",
    pages = [],
    isToDisplay = true,
    isToDisplayInSb = true,
    isUserDefined = false,
    isTemporary = false,
  }) {
    this.name = name;
    this.pages = pages.length ? pages : [name];
    this.updateUids();
    this.color = color;
    this.isToDisplay = isToDisplay;
    this.isToDisplayInSb = isToDisplayInSb;
    this.isUserDefined = isUserDefined;
    this.isTemporary = isTemporary;
  }
  setColor(color) {
    this.color = color;
  }
  updatePages(pages) {
    this.pages = pages.length ? pages : [this.name];
    this.updateUids();
  }
  updateUids() {
    this.uids = this.pages.map((page) => getPageUidByPageName(page));
  }
  display(inSidebar) {
    this["isToDisplay" + (inSidebar ? "InSb" : "")] = true;
  }
  hide(inSidebar) {
    this["isToDisplay" + (inSidebar ? "InSb" : "")] = false;
  }
}

export function getTagFromName(name) {
  return mapOfTags.find((tag) => tag.name === name);
}

export function getTagColorFromName(name) {
  const tag = getTagFromName(name);
  return tag.color;
}

export function deleteTagByName(name) {
  const tagIndex = mapOfTags.findIndex((tag) => tag.name === name);
  if (tagIndex === -1) return mapOfTags;
  const clone = [...mapOfTags];
  clone.splice(tagIndex, 1);
  return clone;
}
