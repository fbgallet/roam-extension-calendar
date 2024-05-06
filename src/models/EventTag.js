import { mapOfTags } from "..";
import { getPageUidByPageName } from "../util/roamApi";

export class EventTag {
  constructor({
    name,
    color = "none",
    pages = [],
    isToDisplay = true,
    isUserDefined = false,
  }) {
    this.name = name;
    this.pages = pages.length ? pages : [name];
    this.updateUids();
    this.color = color;
    this.isToDisplay = isToDisplay;
    this.isUserDefined = isUserDefined;
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
  display() {
    this.isToDisplay = true;
  }
  hide() {
    this.isToDisplay = false;
  }
}

export function getTagFromName(name) {
  return mapOfTags.find((tag) => tag.name === name);
}

export function getTagColorFromName(name) {
  const tag = getTagFromName(name);
  return tag.color;
}
