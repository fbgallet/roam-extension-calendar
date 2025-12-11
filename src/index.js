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
  notNullOrCommaRegex,
} from "./util/regex";
import { initGoogleCalendarService, getConnectedCalendars } from "./services/googleCalendarService";

export let mapOfTags = [];
export let extensionStorage;
let storedTagsInfo;
export let calendarTag;
export let firstDay;
export let timeFormat;
export let minTime, maxTime;
export let timeGrid = {
  day: true,
  week: true,
};
export let displayTime;
export let rangeEndAttribute;
export let eventsOrder;
export let isSubtaskToDisplay;
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
            ...getStoredTagInfos(extensionStorage.get("calendarTag")),
            color: "transparent",
            isToUpdate: true,
          });
          const index = mapOfTags.findIndex(
            (tag) => tag.color === "transparent"
          );
          if (index > -1) {
            mapOfTags.splice(index, 1, calendarTag);
          } else mapOfTags.push(calendarTag);
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
      id: "eventsOrder",
      name: "Events order",
      description: "In year and month views, sort events in each day by:",
      action: {
        type: "select",
        items: ["alphanumeric content", "block position"],
        onChange: (sel) => {
          eventsOrder = sel;
        },
      },
    },
    {
      id: "displaySubtasks",
      name: "Display subtasks",
      description: "Display each subtask as an event:",
      action: {
        type: "switch",
        onChange: () => {
          isSubtaskToDisplay = !isSubtaskToDisplay;
        },
      },
    },
    {
      id: "firstDay",
      name: "First day of week",
      description: "Set the first day of week: Monday or Sunday.",
      action: {
        type: "select",
        items: ["Monday", "Sunday"],
        onChange: (sel) => {
          firstDay = sel;
        },
      },
    },
    {
      id: "timeFormat",
      name: "Time format",
      description:
        "How timestamps and ranges are displayed in the calendar & inserted in blocks (regardless of the input format)",
      action: {
        type: "select",
        items: ["14:00", "2:00pm", "2pm"],
        onChange: (sel) => {
          setTimeFormat(sel);
        },
      },
    },
    {
      id: "displayTime",
      name: "Display time in events",
      description:
        "Display begin/end time in events title in the timegrid view (redundant):",
      action: {
        type: "switch",
        onChange: () => {
          displayTime = !displayTime;
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
  if (type === "end") rangeEndAttribute = normalizedList.split("|")[0];
  customizeRegex(
    type === "start" ? defaultStartDateRegex : defaultUntilDateRegex,
    normalizedList,
    type === "start" ? 21 : 9
  );
};

const initializeMapOfTags = () => {
  if (userTags) updageUserTags(userTags);
  console.log("mapOfTags :>> ", mapOfTags);
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
  mapOfTags.push(
    new EventTag({
      name: "Google calendar",
      color: Colors.GRAY3,
      ...getStoredTagInfos("Google calendar"),
    })
  );
  const userTags = extensionStorage.get("userTags");
  if (notNullOrCommaRegex.test(userTags)) updageUserTags(userTags);
  const calendarTagName = extensionStorage.get("calendarTag");
  if (notNullOrCommaRegex.test(calendarTagName)) {
    calendarTag = new EventTag({
      name: calendarTagName,
      color: "transparent",
      isPageCreationToForce: true,
      ...getStoredTagInfos(calendarTagName),
      pages: [calendarTagName],
    });
    mapOfTags.push(calendarTag);
  }
  // mapOfTags.push(calendarTag);
  console.log("mapOfTags :>> ", mapOfTags);
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
        pages: matchingTag.pages,
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

// Initialize EventTags for connected Google Calendars
// - Calendars with showAsSeparateTag: false are grouped under the main "Google Calendar" tag
// - Calendars with showAsSeparateTag: true get their own EventTag with displayName as the tag name
export const initializeGCalTags = () => {
  const connectedCalendars = getConnectedCalendars();
  if (!connectedCalendars || !connectedCalendars.length) return;

  // Get the main "Google Calendar" tag
  const mainGCalTag = getTagFromName("Google calendar");
  if (!mainGCalTag) {
    console.warn("Main 'Google calendar' tag not found");
    return;
  }

  // Initialize arrays for the main tag
  mainGCalTag.gCalCalendarIds = [];
  mainGCalTag.disabledCalendarIds = [];

  for (const calendarConfig of connectedCalendars) {
    if (calendarConfig.showAsSeparateTag) {
      // Calendar has its own separate tag
      const tagName = calendarConfig.displayName || calendarConfig.name;
      let existingTag = getTagFromName(tagName);

      if (!existingTag) {
        // Create new EventTag for this separate GCal calendar
        const gcalTag = new EventTag({
          name: tagName,
          color: Colors.GRAY3, // Default color, will be updated from fc-tags-info
          ...getStoredTagInfos(tagName),
          isGCalTag: true,
          gCalCalendarId: calendarConfig.id,
          isToDisplay: true,
          isToDisplayInSb: true,
        });
        mapOfTags.push(gcalTag);
        console.log(`Created separate EventTag for GCal calendar: ${tagName}`);
      } else {
        // Update existing tag with GCal properties
        existingTag.gCalCalendarId = calendarConfig.id;
        existingTag.isGCalTag = true;
        console.log(`Updated separate EventTag for GCal calendar: ${tagName}`);
      }
    } else {
      // Calendar is grouped under main "Google Calendar" tag
      mainGCalTag.gCalCalendarIds.push(calendarConfig.id);

      // Track disabled calendars
      if (!calendarConfig.syncEnabled) {
        mainGCalTag.disabledCalendarIds.push(calendarConfig.id);
      }

      console.log(`Grouped calendar under main GCal tag: ${calendarConfig.name}`);
    }
  }

  console.log(`Main GCal tag now has ${mainGCalTag.gCalCalendarIds.length} grouped calendars`);
};

// clean calendarTag data, solve conflict from v.4 or from quit just after setting change
const cleanCalendarTagStore = (currentValue, storedValue) => {
  if (storedValue === currentValue) return; // it's OK
  extensionStorage.set(
    "fc-tags-info",
    JSON.stringify(
      mapOfTags.map((tag) => ({
        name: tag.color === "transparent" ? currentValue : tag.name,
        color: tag.color,
        isToDisplay: tag.isToDisplay,
        isToDisplayInSb: tag.isToDisplayInSb,
        pages: tag.pages,
      }))
    )
  );
};

export default {
  onload: async ({ extensionAPI }) => {
    extensionStorage = extensionAPI.settings;
    storedTagsInfo = JSON.parse(extensionStorage.get("fc-tags-info"));
    // console.log("storedTagsInfo :>> ", storedTagsInfo);
    if (!extensionStorage.get("calendarTag"))
      await extensionStorage.set("calendarTag", "calendar");
    // calendarTag = new EventTag({
    //   name: extensionStorage.get("calendarTag"),
    //   color: "transparent",
    //   isPageCreationToForce: true,
    // });
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
    if (extensionStorage.get("firstDay") === null)
      await extensionStorage.set("firstDay", "Monday");
    firstDay = extensionStorage.get("firstDay");
    if (extensionStorage.get("timeFormat") === null)
      await extensionStorage.set("timeFormat", "14:00");
    setTimeFormat(extensionStorage.get("timeFormat"));
    if (extensionStorage.get("displayTime") === null)
      await extensionStorage.set("displayTime", false);
    displayTime = extensionStorage.get("displayTime");
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
    if (extensionStorage.get("eventsOrder") === null)
      await extensionStorage.set("eventsOrder", "alphanumeric content");
    eventsOrder = extensionStorage.get("eventsOrder");
    if (extensionStorage.get("displaySubtasks") === null)
      await extensionStorage.set("displaySubtasks", false);
    isSubtaskToDisplay = extensionStorage.get("displaySubtasks");

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

    if (storedTagsInfo && storedTagsInfo.length)
      cleanCalendarTagStore(
        extensionStorage.get("calendarTag"),
        storedTagsInfo.find((tag) => tag.color === "transparent")
      );

    setTimeout(() => {
      connectObservers();
      addListeners();
    }, 500);

    // Initialize Google Calendar service (attempt silent auth if previously connected)
    initGoogleCalendarService()
      .then((authenticated) => {
        if (authenticated) {
          console.log("Google Calendar: Restored previous session");
          // Initialize EventTags for connected calendars
          initializeGCalTags();
        } else {
          console.log("Google Calendar: Not authenticated (connect via Google Calendar tag)");
        }
      })
      .catch((error) => {
        console.error("Google Calendar initialization error:", error);
      });

    console.log("Full Calendar extension loaded.");
    //return;
  },
  onunload: () => {
    disconnectObserver();
    removeListeners();

    console.log("Full Calendar extension unloaded");
  },
};
