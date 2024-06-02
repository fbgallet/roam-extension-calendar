// import { addObserver, disconnectObserver } from "./observers";
import { Colors } from "@blueprintjs/core";

import { renderApp, unmountApp } from "./components/App";
import { EventTag, getTagFromName } from "./models/EventTag";
import { getTrimedArrayFromList } from "./util/data";

const calendarBtnElt = document.querySelector(
  "button:has(span[icon='calendar'])"
);
const storedTagsInfo = JSON.parse(localStorage.getItem("fc-tags-info"));
console.log("storedTagsInfo :>> ", storedTagsInfo);

export let mapOfTags = [];
export let calendarTag;

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
  ],
};

const updateTagPagesWithUserList = (tagName, pageList) => {
  const tag = getTagFromName(tagName);
  tag.updatePages(getTrimedArrayFromList(pageList));
};

const handleClickOnCalendarBtn = (e) => {
  e.preventDefault();
  let appWrapper;
  let inSidebar = false;
  if (e.shiftKey) {
    window.roamAlphaAPI.ui.rightSidebar.open();
    inSidebar = true;
    appWrapper = document.querySelector(".full-calendar-comp.fc-sidebar");
  } else {
    appWrapper = document.querySelector(".full-calendar-comp:not(.fc-sidebar)");
    console.log("appWrapper :>> ", appWrapper);
  }
  if (!appWrapper) {
    setTimeout(
      () => {
        renderApp(inSidebar);
      },
      inSidebar && !document.querySelector("#roam-right-sidebar-content")
        ? 250
        : 0
    );
  } else unmountApp(appWrapper);
};

const onDragStart = (event) => {
  if (
    event.srcElement.tagName === "SPAN" &&
    event.srcElement.classList[0] === "rm-bullet"
  ) {
    const sourceBlockUid =
      event.srcElement.parentElement?.nextElementSibling?.id?.slice(-9);
    event.dataTransfer.setData("text/plain", sourceBlockUid);
  }
};

const addListeners = () => {
  removeListeners();
  document.addEventListener("dragstart", onDragStart);
  calendarBtnElt.parentElement.parentElement.addEventListener(
    "contextmenu",
    (e) => {
      handleClickOnCalendarBtn(e);
    }
  );
};

const removeListeners = () => {
  document.removeEventListener("dragstart", onDragStart);
  calendarBtnElt.removeEventListener("contextmenu", (e) => {
    handleClickOnCalendarBtn(e);
  });
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
  mapOfTags.push(
    new EventTag({
      name: "important",
      color: Colors.RED3,
      ...getStoredTagInfos("important"),
      pages: getTrimedArrayFromList(extensionAPI.settings.get("importantTag")),
    })
  );
  mapOfTags.push(
    new EventTag({
      name: "do",
      color: Colors.GREEN1,
      ...getStoredTagInfos("do"),
      pages: getTrimedArrayFromList(extensionAPI.settings.get("doTag")),
    })
  );
  mapOfTags.push(
    new EventTag({
      name: "due",
      color: Colors.VIOLET3,
      ...getStoredTagInfos("due"),
      pages: getTrimedArrayFromList(extensionAPI.settings.get("dueTag")),
    })
  );
  mapOfTags.push(
    new EventTag({
      name: "doing",
      color: Colors.ORANGE3,
      ...getStoredTagInfos("doing"),
      pages: getTrimedArrayFromList(extensionAPI.settings.get("doingTag")),
    })
  );
  const userTags = extensionAPI.settings.get("userTags");
  if (userTags) updageUserTags(userTags);
  mapOfTags.push(calendarTag);
};

const updageUserTags = (list) => {
  if (!list.trim()) return;
  const defaultTags = mapOfTags.filter((tag) => !tag.isUserDefined);
  console.log("defaultTags :>> ", defaultTags);
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
  console.log("userTags :>> ", userTags);
  const indexToInsert =
    defaultTags.at(-1).name === "TODO"
      ? defaultTags.length - 1
      : defaultTags.length;
  console.log("indexToInsert :>> ", indexToInsert);
  mapOfTags = defaultTags;
  mapOfTags.splice(indexToInsert, 0, ...userTags);
  console.log("mapOfTags with user tags :>> ", mapOfTags);
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

export default {
  onload: async ({ extensionAPI }) => {
    extensionAPI.settings.panel.create(panelConfig);

    if (extensionAPI.settings.get("calendarTag") === null)
      await extensionAPI.settings.set("calendarTag", "calendar");
    calendarTag = new EventTag({
      name: extensionAPI.settings.get("calendarTag"),
      color: "transparent",
    });
    console.log("calendarTag :>> ", calendarTag);
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

    extensionAPI.ui.commandPalette.addCommand({
      label: "Full Calendar: Display/Hide in main window",
      callback: () => {
        renderApp();
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Full Calendar: Display/Hide in Sidebar",
      callback: () => {
        renderApp(true);
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
