import { mapOfTags } from "..";
import { getPageUidByPageName } from "../util/roamApi";

export class Tag {
  constructor(name, color = "none", pages = []) {
    this.name = name;
    this.pages = pages.length ? pages : [name];
    this.uids = this.pages.map((page) => getPageUidByPageName(page));
    this.color = color;
  }
  setColor(color) {
    this.color = color;
  }
}

export function getTagFromName(name) {
  return mapOfTags.find((tag) => tag.name === name);
}

export function getTagColorFromName(name) {
  const tag = getTagFromName(name);
  return tag.color;
}
