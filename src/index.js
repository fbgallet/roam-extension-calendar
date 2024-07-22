// import { addObserver, disconnectObserver } from "./observers";
import { Colors } from "@blueprintjs/core";
import { EventTag, deleteTagByName, getTagFromName } from "./models/EventTag";
import {
  getNormalizedDisjunctionForRegex,
  getTrimedArrayFromList,
} from "./util/data";
import {
  addListeners,
  connectObservers,
  disconnectObserver,
  handleRightClickOnCalendarBtn,
  removeListeners,
} from "./util/roamDom";
import {
  customizeRegex,
  defaultStartDateRegex,
  defaultUntilDateRegex,
  escapeCharacters,
  notNullOrCommaRegex,
} from "./util/regex";

export let mapOfTags = [];
export let extensionStorage;
let storedTagsInfo;
export let calendarTag;
export let timeFormat;
export let minTime, maxTime;
export let timeGrid = {
  day: true,
  week: true,
};
const defaultStartKeywords = "date,from,start,begin,on";
const defaultEndKeywords = "until,to,end";

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
      className: "liveai-settings-largeinput",
      description: "Page title for user defined tags, separated by a comma.",
      action: {
        type: "input",
        onChange: (evt) => {
          updageUserTags(evt.target.value, Colors.GRAY1);
        },
      },
    },
    {
      id: "userStart",
      name: "Start keywords",
      description:
        "User defined keyword(s) to set a START date of an event's range, separated by a comma.",
      action: {
        type: "input",
        onChange: (evt) => {
          updateKeywordsInRangeRegex(evt.target.value, "start");
        },
      },
    },
    {
      id: "userEnd",
      name: "End keywords",
      description:
        "User defined keyword(s) to set a END date of an event's range, separated by a comma. First one will be inserted as attribute:: when resizing a day event.",
      action: {
        type: "input",
        onChange: (evt) => {
          updateKeywordsInRangeRegex(evt.target.value, "end");
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
          updateStoredView("Day", timeGrid.day);
          updateStoredView("Day", timeGrid.day, "-sb");
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
          updateStoredView("Week", timeGrid.week);
          updateStoredView("Week", timeGrid.week, "-sb");
        },
      },
    },
  ],
};

const updateStoredView = (period, isTimeGrid, suffix = "") => {
  if (
    extensionStorage.get("fc-periodView" + suffix) === `dayGrid${period}` &&
    isTimeGrid
  )
    extensionStorage.set("fc-periodView" + suffix, `timeGrid${period}`);
  else if (
    extensionStorage.get("fc-periodView" + suffix) === `timeGrid${period}` &&
    !isTimeGrid
  )
    extensionStorage.set("fc-periodView" + suffix, `dayGrid${period}`);
};

const updateTagPagesWithUserList = (tagName, pageList) => {
  if (!notNullOrCommaRegex.test(pageList)) {
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

const updateKeywordsInRangeRegex = (list, type) => {
  let normalizedList = getNormalizedDisjunctionForRegex(list);
  if (!normalizedList.replaceAll("|").trim().length)
    normalizedList =
      type === "start"
        ? getNormalizedDisjunctionForRegex(defaultStartKeywords)
        : getNormalizedDisjunctionForRegex(defaultEndKeywords);
  customizeRegex(
    type === "start" ? defaultStartDateRegex : defaultUntilDateRegex,
    normalizedList,
    type === "start" ? 15 : 3
  );
};

const initializeMapOfTags = () => {
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
  let tagPagesList = extensionStorage.get("importantTag");
  if (notNullOrCommaRegex.test(tagPagesList))
    mapOfTags.push(
      new EventTag({
        name: "important",
        color: Colors.RED3,
        ...getStoredTagInfos("important"),
        pages: getTrimedArrayFromList(tagPagesList),
      })
    );
  tagPagesList = extensionStorage.get("doTag");
  if (notNullOrCommaRegex.test(tagPagesList))
    mapOfTags.push(
      new EventTag({
        name: "do",
        color: Colors.GREEN1,
        ...getStoredTagInfos("do"),
        pages: getTrimedArrayFromList(tagPagesList),
      })
    );
  tagPagesList = extensionStorage.get("dueTag");
  if (notNullOrCommaRegex.test(tagPagesList))
    mapOfTags.push(
      new EventTag({
        name: "due",
        color: Colors.VIOLET3,
        ...getStoredTagInfos("due"),
        pages: getTrimedArrayFromList(tagPagesList),
      })
    );
  tagPagesList = extensionStorage.get("doingTag");
  if (notNullOrCommaRegex.test(tagPagesList))
    mapOfTags.push(
      new EventTag({
        name: "doing",
        color: Colors.ORANGE3,
        ...getStoredTagInfos("doing"),
        pages: getTrimedArrayFromList(tagPagesList),
      })
    );
  // mapOfTags.push(
  //   new EventTag({
  //     name: "Google calendar",
  //     color: Colors.GRAY5,
  //     ...getStoredTagInfos("Google calendar"),
  //   })
  // );
  const userTags = extensionStorage.get("userTags");
  if (notNullOrCommaRegex.test(userTags)) updageUserTags(userTags);
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
    ? {
        color: matchingTag.color,
        isToDisplay: matchingTag.isToDisplay,
        isToDisplayInSb: matchingTag.isToDisplayInSb,
      }
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
    extensionStorage = extensionAPI.settings;
    storedTagsInfo = JSON.parse(extensionStorage.get("fc-tags-info"));

    if (extensionStorage.get("calendarTag") === null)
      await extensionStorage.set("calendarTag", "calendar");
    calendarTag = new EventTag({
      name: extensionStorage.get("calendarTag"),
      color: "transparent",
    });
    // console.log("calendarTag :>> ", calendarTag);
    if (extensionStorage.get("importantTag") === null)
      await extensionStorage.set("importantTag", "important");
    if (extensionStorage.get("doingTag") === null)
      await extensionStorage.set("doingTag", "doing");
    if (extensionStorage.get("doTag") === null)
      await extensionStorage.set("doTag", "do date");
    if (extensionStorage.get("dueTag") === null)
      await extensionStorage.set("dueTag", "due date");
    if (extensionStorage.get("userTags") === null)
      await extensionStorage.set("userTags", "");
    if (!extensionStorage.get("userStart"))
      await extensionStorage.set("userStart", defaultStartKeywords);
    updateKeywordsInRangeRegex(extensionStorage.get("userStart"), "start");
    if (!extensionStorage.get("userEnd"))
      await extensionStorage.set("userEnd", defaultEndKeywords);
    updateKeywordsInRangeRegex(extensionStorage.get("userEnd"), "end");
    if (extensionStorage.get("timeFormat") === null)
      await extensionStorage.set("timeFormat", "14:00");
    setTimeFormat(extensionStorage.get("timeFormat"));
    if (extensionStorage.get("minTime") === null)
      await extensionStorage.set("minTime", "07:00");
    minTime = extensionStorage.get("minTime");
    if (extensionStorage.get("maxTime") === null)
      await extensionStorage.set("maxTime", "21:00");
    maxTime = extensionStorage.get("maxTime");
    if (extensionStorage.get("dayTimegrid") === null)
      await extensionStorage.set("dayTimegrid", true);
    timeGrid.day = extensionStorage.get("dayTimegrid");
    if (extensionStorage.get("weekTimegrid") === null)
      await extensionStorage.set("weekTimegrid", true);
    timeGrid.week = extensionStorage.get("weekTimegrid");

    extensionStorage.panel.create(panelConfig);

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

    initializeMapOfTags();
    setTimeout(() => {
      connectObservers();
      addListeners();
    }, 500);

    console.log("Full Calendar extension loaded.");
    //return;
  },
  onunload: () => {
    disconnectObserver();
    removeListeners();

    console.log("Full Calendar extension unloaded");
  },
};
