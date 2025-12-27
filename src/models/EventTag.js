import { mapOfTags } from "..";
import {
  createNewPageIfNotExisting,
  getPageUidByPageName,
} from "../util/roamApi";

export class EventTag {
  constructor({
    name,
    color = "none",
    pages = [],
    isToDisplay = true,
    isToDisplayInSb = true,
    isUserDefined = false,
    isTemporary = false,
    isPageCreationToForce = false,
    isToUpdate = false,
    // Google Calendar specific properties
    gCalCalendarId = null,
    isGCalTag = false,
    // For main "Google Calendar" tag: list of grouped calendar IDs
    gCalCalendarIds = [],
    // For main "Google Calendar" tag: calendars disabled by user in popover
    disabledCalendarIds = [],
    // Google Tasks specific properties
    gTaskListId = null,
    isGTaskTag = false,
    // For main "Google Tasks" tag: list of grouped task list IDs
    gTaskListIds = [],
    // For main "Google Tasks" tag: task lists disabled by user in popover
    disabledTaskListIds = [],
  }) {
    this.name = name;
    this.pages = pages.length ? pages : [name];
    this.updateUids(isPageCreationToForce);
    this.color = color;
    this.isToDisplay = isToDisplay;
    this.isToDisplayInSb = isToDisplayInSb;
    this.isUserDefined = isUserDefined;
    this.isTemporary = isTemporary;
    this.isToUpdate = isToUpdate;
    // Google Calendar properties
    this.gCalCalendarId = gCalCalendarId;
    this.isGCalTag = isGCalTag;
    // For main "Google Calendar" tag
    this.gCalCalendarIds = gCalCalendarIds;
    this.disabledCalendarIds = disabledCalendarIds;
    // Google Tasks properties
    this.gTaskListId = gTaskListId;
    this.isGTaskTag = isGTaskTag;
    // For main "Google Tasks" tag
    this.gTaskListIds = gTaskListIds;
    this.disabledTaskListIds = disabledTaskListIds;
  }
  setColor(color) {
    this.color = color;
  }
  updatePages(pages) {
    this.pages = pages.length ? pages : [this.name];
    this.updateUids();
  }
  updateUids(isPageCreationToForce) {
    this.uids = this.pages.map((page) => getPageUidByPageName(page));
    if (isPageCreationToForce) {
      for (let i = 0; i < this.uids.length; i++) {
        if (!this.uids[i]) {
          const newUid = window.roamAlphaAPI.util.generateUID();
          createNewPageIfNotExisting(this.pages[i], newUid);
          this.uids[i] = newUid;
        }
      }
    }
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
  if (tagIndex === -1) return;
  mapOfTags.splice(tagIndex, 1);
}

export function refreshTagsUids() {
  mapOfTags.forEach((tag) => {
    if (tag.uids.some((uid) => uid === null)) tag.updateUids();
  });
}

/**
 * Find a tag by its associated Google Calendar ID
 */
export function getTagByGCalCalendarId(calendarId) {
  return mapOfTags.find((tag) => tag.gCalCalendarId === calendarId);
}

/**
 * Get all tags that are associated with Google Calendar
 */
export function getGCalTags() {
  return mapOfTags.filter((tag) => tag.isGCalTag);
}

/**
 * Find a tag by its associated Google Task List ID
 */
export function getTagByGTaskListId(taskListId) {
  return mapOfTags.find((tag) => tag.gTaskListId === taskListId);
}

/**
 * Get all tags that are associated with Google Tasks
 */
export function getGTaskTags() {
  return mapOfTags.filter((tag) => tag.isGTaskTag);
}
