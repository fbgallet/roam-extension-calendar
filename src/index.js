// import { addObserver, disconnectObserver } from "./observers";
import { Colors } from "@blueprintjs/core";
import { EventTag, deleteTagByName, getTagFromName } from "./models/EventTag";
import { getTrimedArrayFromList } from "./util/data";
import {
  handleClickOnCalendarBtn,
  handleRightClickOnCalendarBtn,
  onDragStart,
} from "./util/roamDom";

export const calendarBtnElt = document.querySelector(
  "button:has(span[icon='calendar'])"
)?.parentElement?.parentElement;
const storedTagsInfo = JSON.parse(localStorage.getItem("fc-tags-info"));
// console.log("storedTagsInfo :>> ", storedTagsInfo);

export let mapOfTags = [];
export let calendarTag;
export let timeFormat;
export let minTime, maxTime;
export let timeGrid = {
  day: true,
  week: true,
};

const panelConfig = {
  tabTitle: "Calendar",
  settings: [
    {
      id: "calendarTag",
      name: "Calendar tag",
      description:
        "Tag used as parent block to gather calendar events at the same place in each DNP. Default is 'calendar'",
      action: {
        type: "input",
        onChange: (evt) => {
          calendarTag = new EventTag({
            name: evt.target.value,
            color: "transparent",
          });
        },
      },
    },
    {
      id: "importantTag",
      name: "Important",
      description:
        "Page title for important event and aliases separated by a comma. E.g.: important,urgent",
      action: {
        type: "input",
        onChange: (evt) => {
          updateTagPagesWithUserList("important", evt.target.value);
        },
      },
    },
    {
      id: "doTag",
      name: "Do date",
      description:
        "Page title for event with do date and aliases separated by a comma.",
      action: {
        type: "input",
        onChange: (evt) => {
          updateTagPagesWithUserList("do", evt.target.value);
        },
      },
    },
    {
      id: "dueTag",
      name: "Due date",
      description:
        "Page title for event with due date and aliases separated by a comma.",
      action: {
        type: "input",
        onChange: (evt) => {
          updateTagPagesWithUserList("due", evt.target.value);
        },
      },
    },
    {
      id: "doingTag",
      name: "Doing",
      description:
        "Page title for ongoing, unfinished tasks and aliases separated by a comma.",
      action: {
        type: "input",
        onChange: (evt) => {
          updateTagPagesWithUserList("doing", evt.target.value);
        },
      },
    },
    {
      id: "userTags",
      name: "User defined tags",
      description: "Page title for user defined tags, separated by a comma.",
      action: {
        type: "input",
        onChange: (evt) => {
          updageUserTags(evt.target.value, Colors.GRAY1);
        },
      },
    },
    {
      id: "timeFormat",
      name: "Time format output",
      description:
        "How timestamps and ranges are displayed in the calendar (regardless of the input format)",
      action: {
        type: "select",
        items: ["14:00", "2:00pm", "2pm"],
        onChange: (sel) => {
          setTimeFormat(sel);
        },
      },
    },
    {
      id: "minTime",
      name: "Start time",
      description: "Start of the displayed time range in week- and day-views:",
      action: {
        type: "select",
        items: [
          "00:00",
          "01:00",
          "02:00",
          "03:00",
          "04:00",
          "05:00",
          "06:00",
          "07:00",
          "08:00",
        ],
        onChange: (sel) => {
          minTime = sel;
        },
      },
    },
    {
      id: "maxTime",
      name: "End time",
      description:
        "End of the displayed time range in week- and day-views (corresponding time slot is excluded):",
      action: {
        type: "select",
        items: ["18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00"],
        onChange: (sel) => {
          maxTime = sel;
        },
      },
    },
    {
      id: "dayTimegrid",
      name: "Daily time grid",
      description: "Display events on day-view in a time grid:",
      action: {
        type: "switch",
        onChange: () => {
          timeGrid.day = !timeGrid.day;
          updateLocalStorageView("Day", timeGrid.day);
          updateLocalStorageView("Day", timeGrid.day, "-sb");
        },
      },
    },
    {
      id: "weekTimegrid",
      name: "Weekly time grid",
      description: "Display events on week-view in a time grid:",
      action: {
        type: "switch",
        onChange: () => {
          timeGrid.week = !timeGrid.week;
          updateLocalStorageView("Week", timeGrid.week);
          updateLocalStorageView("Week", timeGrid.week, "-sb");
        },
      },
    },
  ],
};

const updateLocalStorageView = (period, isTimeGrid, suffix = "") => {
  if (
    localStorage.getItem("fc-periodView" + suffix) === `dayGrid${period}` &&
    isTimeGrid
  )
    localStorage.setItem("fc-periodView" + suffix, `timeGrid${period}`);
  else if (
    localStorage.getItem("fc-periodView" + suffix) === `timeGrid${period}` &&
    !isTimeGrid
  )
    localStorage.setItem("fc-periodView" + suffix, `dayGrid${period}`);
};

const updateTagPagesWithUserList = (tagName, pageList) => {
  if (!pageList.replace(",", "").trim()) {
    mapOfTags = deleteTagByName(tagName);
    return;
  }
  const tag = getTagFromName(tagName);
  if (!tag) {
    mapOfTags.push(
      new EventTag({
        name: tagName,
        ...getStoredTagInfos(tagName),
        pages: getTrimedArrayFromList(pageList),
      })
    );
  } else tag.updatePages(getTrimedArrayFromList(pageList));
};

const addListeners = () => {
  removeListeners();
  document.addEventListener("dragstart", onDragStart);
  calendarBtnElt.addEventListener("contextmenu", (e) => {
    handleRightClickOnCalendarBtn(e);
  });
  calendarBtnElt.addEventListener("click", handleClickOnCalendarBtn);
  if (window.roamAlphaAPI.platform.isTouchDevice)
    calendarBtnElt.addEventListener("touchend", handleClickOnCalendarBtn);
};

const removeListeners = () => {
  document.removeEventListener("dragstart", onDragStart);
  calendarBtnElt.removeEventListener("contextmenu", (e) => {
    handleRightClickOnCalendarBtn(e);
  });
  calendarBtnElt.removeEventListener("click", handleClickOnCalendarBtn);
  if (window.roamAlphaAPI.platform.isTouchDevice)
    calendarBtnElt.addEventListener("touchend", handleClickOnCalendarBtn);
};

const initializeMapOfTags = (extensionAPI) => {
  if (userTags) updageUserTags(userTags);
  mapOfTags.push(
    new EventTag({
      name: "TODO",
      color: Colors.BLUE3,
      ...getStoredTagInfos("TODO"),
    })
  );
  mapOfTags.push(
    new EventTag({
      name: "DONE",
      color: Colors.GRAY5,
      ...getStoredTagInfos("DONE"),
    })
  );
  let tagPagesList = extensionAPI.settings.get("importantTag");
  if (tagPagesList.trim())
    mapOfTags.push(
      new EventTag({
        name: "important",
        color: Colors.RED3,
        ...getStoredTagInfos("important"),
        pages: getTrimedArrayFromList(tagPagesList),
      })
    );
  tagPagesList = extensionAPI.settings.get("doTag");
  if (tagPagesList.trim())
    mapOfTags.push(
      new EventTag({
        name: "do",
        color: Colors.GREEN1,
        ...getStoredTagInfos("do"),
        pages: getTrimedArrayFromList(tagPagesList),
      })
    );
  tagPagesList = extensionAPI.settings.get("dueTag");
  if (tagPagesList.trim())
    mapOfTags.push(
      new EventTag({
        name: "due",
        color: Colors.VIOLET3,
        ...getStoredTagInfos("due"),
        pages: getTrimedArrayFromList(tagPagesList),
      })
    );
  tagPagesList = extensionAPI.settings.get("doingTag");
  if (tagPagesList.trim())
    mapOfTags.push(
      new EventTag({
        name: "doing",
        color: Colors.ORANGE3,
        ...getStoredTagInfos("doing"),
        pages: getTrimedArrayFromList(tagPagesList),
      })
    );
  const userTags = extensionAPI.settings.get("userTags");
  if (userTags) updageUserTags(userTags);
  mapOfTags.push(calendarTag);
};

const updageUserTags = (list) => {
  if (!list.trim()) return;
  const defaultTags = mapOfTags.filter((tag) => !tag.isUserDefined);
  // console.log("defaultTags :>> ", defaultTags);
  const userTagsNameArr = getTrimedArrayFromList(list);
  const userTags = userTagsNameArr.map(
    (tagName) =>
      new EventTag({
        name: tagName,
        // color: getStoredTagColor(tagName) || Colors.GRAY3,
        color: Colors.GRAY3,
        ...getStoredTagInfos(tagName),
        isUserDefined: true,
      })
  );
  // console.log("userTags :>> ", userTags);
  const indexToInsert =
    defaultTags.at(-1).name === "TODO"
      ? defaultTags.length - 1
      : defaultTags.length;
  mapOfTags = defaultTags;
  mapOfTags.splice(indexToInsert, 0, ...userTags);
  // console.log("mapOfTags with user tags :>> ", mapOfTags);
};

// const getStoredTagColor = (tagName) => {
//   if (!storedTagsInfo) return null;
//   const matchingTag = storedTagsInfo.find((tag) => tagName === tag.name);
//   return matchingTag?.color;
// };

const getStoredTagInfos = (tagName) => {
  if (!storedTagsInfo) return null;
  const matchingTag = storedTagsInfo.find((tag) => tagName === tag.name);
  return matchingTag
    ? { color: matchingTag.color, isToDisplay: matchingTag.isToDisplay }
    : null;
};

const setTimeFormat = (example) => {
  switch (example) {
    case "14:00":
      timeFormat = "long";
      break;
    case "2:00pm":
      timeFormat = "medium";
      break;
    case "2pm":
      timeFormat = "short";
      break;
  }
};

export default {
  onload: async ({ extensionAPI }) => {
    extensionAPI.settings.panel.create(panelConfig);

    if (extensionAPI.settings.get("calendarTag") === null)
      await extensionAPI.settings.set("calendarTag", "calendar");
    calendarTag = new EventTag({
      name: extensionAPI.settings.get("calendarTag"),
      color: "transparent",
    });
    // console.log("calendarTag :>> ", calendarTag);
    if (extensionAPI.settings.get("importantTag") === null)
      await extensionAPI.settings.set("importantTag", "important");
    if (extensionAPI.settings.get("doingTag") === null)
      await extensionAPI.settings.set("doingTag", "doing");
    if (extensionAPI.settings.get("doTag") === null)
      await extensionAPI.settings.set("doTag", "do");
    if (extensionAPI.settings.get("dueTag") === null)
      await extensionAPI.settings.set("dueTag", "due");
    if (extensionAPI.settings.get("userTags") === null)
      await extensionAPI.settings.set("userTags", "");
    if (extensionAPI.settings.get("timeFormat") === null)
      await extensionAPI.settings.set("timeFormat", "14:00");
    setTimeFormat(extensionAPI.settings.get("timeFormat"));
    if (extensionAPI.settings.get("minTime") === null)
      await extensionAPI.settings.set("minTime", "07:00");
    minTime = extensionAPI.settings.get("minTime");
    if (extensionAPI.settings.get("maxTime") === null)
      await extensionAPI.settings.set("maxTime", "21:00");
    maxTime = extensionAPI.settings.get("maxTime");
    if (extensionAPI.settings.get("dayTimegrid") === null)
      await extensionAPI.settings.set("dayTimegrid", true);
    console.log("dayGrid", extensionAPI.settings.get("dayTimegrid"));
    timeGrid.day = extensionAPI.settings.get("dayTimegrid");
    if (extensionAPI.settings.get("weekTimegrid") === null)
      await extensionAPI.settings.set("weekTimegrid", true);
    timeGrid.week = extensionAPI.settings.get("weekTimegrid");

    extensionAPI.ui.commandPalette.addCommand({
      label: "Full Calendar: Display/Hide in main window",
      callback: () => {
        handleRightClickOnCalendarBtn(null, true);
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Full Calendar: Display/Hide in Sidebar",
      callback: () => {
        handleRightClickOnCalendarBtn({ shiftKey: true }, true);
      },
    });

    // addObserver();

    addListeners();
    initializeMapOfTags(extensionAPI);
    // console.log("mapOfTags :>> ", mapOfTags);

    console.log("Full Calendar extension loaded.");
    //return;
  },
  onunload: () => {
    // disconnectObserver();

    removeListeners();

    console.log("Full Calendar extension unloaded");
  },
};
