import { mapOfTags } from "..";
import { getPageUidByPageName } from "../util/roamApi";

export class Tag {
  constructor(name, color = "none", pages = [], isToDisplay = true) {
    this.name = name;
    this.pages = pages.length ? pages : [name];
    this.uids = this.pages.map((page) => getPageUidByPageName(page));
    this.color = color;
    this.isToDisplay = isToDisplay;
  }
  setColor(color) {
    this.color = color;
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
