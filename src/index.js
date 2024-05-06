// import { addObserver, disconnectObserver } from "./observers";
import { Colors } from "@blueprintjs/core";

import { preventDefault } from "@fullcalendar/core/internal";
import { renderApp, unmountApp } from "./components/App";
import { EventTag, getTagFromName } from "./models/EventTag";
import { getTrimedArrayFromList } from "./util/data";

const calendarBtnElt = document.querySelector(
  "button:has(span[icon='calendar'])"
);

export let mapOfTags = [];
// let importantPages = ["important", "Important"];
// let doPages = ["do", "do date", "scheduled"];
// let duePages = ["due date", "deadline"];

const panelConfig = {
  tabTitle: "Calendar",
  settings: [
    {
      id: "importantTag",
      name: "Important",
      description:
        "Page reference for important event and aliases separated by a comma. E.g.: important,urgent",
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
        "Page reference for event with do date and aliases separated by a comma.",
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
        "Page reference for event with due date and aliases separated by a comma.",
      action: {
        type: "input",
        onChange: (evt) => {
          updateTagPagesWithUserList("due", evt.target.value);
        },
      },
    },
    {
      id: "userTags",
      name: "User defined tags",
      description:
        "Page references for user defined tags, separated by a comma.",
      action: {
        type: "input",
        onChange: (evt) => {
          updageUserTags(evt.target.value, Colors.GRAY1);
        },
      },
    },

    // SWITCH example
    // {
    //   id: "insertLine",
    //   name: "Insert a line above footnotes header",
    //   description:
    //     "Insert a block drawing a line just above the footnotes header, at the bottom of the page:",
    //   action: {
    //     type: "switch",
    //     onChange: (evt) => {
    //       // insertLineBeforeFootnotes = !insertLineBeforeFootnotes;
    //     },
    //   },
    // },
    // SELECT example
    // {
    //   id: "hotkeys",
    //   name: "Hotkeys",
    //   description: "Hotkeys to insert/delete footnote",
    //   action: {
    //     type: "select",
    //     items: ["Ctrl + Alt + F", "Ctrl + Shift + F"],
    //     onChange: (evt) => {
    //       // secondHotkey = getHotkeys(evt);
    //     },
    //   },
    // },
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
  mapOfTags.push(new EventTag({ name: "DONE", color: Colors.GRAY5 }));
  mapOfTags.push(
    new EventTag({
      name: "important",
      color: Colors.RED3,
      pages: getTrimedArrayFromList(extensionAPI.settings.get("importantTag")),
    })
  );
  mapOfTags.push(
    new EventTag({
      name: "do",
      color: Colors.ORANGE4,
      pages: getTrimedArrayFromList(extensionAPI.settings.get("doTag")),
    })
  );
  mapOfTags.push(
    new EventTag({
      name: "due",
      color: Colors.VIOLET2,
      pages: getTrimedArrayFromList(extensionAPI.settings.get("dueTag")),
    })
  );
  const userTags = extensionAPI.settings.get("userTags");
  if (userTags) updageUserTags(userTags, Colors.GRAY1);
  mapOfTags.push(new EventTag({ name: "TODO", color: Colors.BLUE2 }));
};

const updageUserTags = (list, color) => {
  if (!list.trim()) return;
  const defaultTags = mapOfTags.filter((tag) => !tag.isUserDefined);
  console.log("defaultTags :>> ", defaultTags);
  const userTagsNameArr = getTrimedArrayFromList(list);
  const userTags = userTagsNameArr.map(
    (tagName) =>
      new EventTag({
        name: tagName,
        color: color,
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

export default {
  onload: async ({ extensionAPI }) => {
    extensionAPI.settings.panel.create(panelConfig);

    // get settings from setting panel
    if (extensionAPI.settings.get("importantTag") === null)
      await extensionAPI.settings.set("importantTag", "important");
    // footnotesTag = extensionAPI.settings.get("footnotesHeader");
    if (extensionAPI.settings.get("doTag") === null)
      await extensionAPI.settings.set("doTag", "do");
    if (extensionAPI.settings.get("dueTag") === null)
      await extensionAPI.settings.set("dueTag", "due");
    if (extensionAPI.settings.get("userTags") === null)
      await extensionAPI.settings.set("userTags", "");

    extensionAPI.ui.commandPalette.addCommand({
      label: "Insert calendar",
      callback: () => {
        // let startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
        // if (startUid) insertFootNote(startUid);
        renderApp();
      },
    });

    // Add command to block context menu
    // roamAlphaAPI.ui.blockContextMenu.addCommand({
    //   label: "Color Highlighter: Remove color tags",
    //   "display-conditional": (e) => e["block-string"].includes("#c:"),
    //   callback: (e) => removeHighlightsFromBlock(e["block-uid"], removeOption),
    // });

    // Add SmartBlock command
    // const insertCmd = {
    //   text: "INSERTFOOTNOTE",
    //   help: "Insert automatically numbered footnote (requires the Footnotes extension)",
    //   handler: (context) => () => {
    //     noteInline = null;
    //     currentPos = new position();
    //     currentPos.s = context.currentContent.length;
    //     currentPos.e = currentPos.s;
    //     insertOrRemoveFootnote(context.targetUid);
    //     return "";
    //   },
    // };
    // if (window.roamjs?.extension?.smartblocks) {
    //   window.roamjs.extension.smartblocks.registerCommand(insertCmd);
    // } else {
    //   document.body.addEventListener(`roamjs:smartblocks:loaded`, () => {
    //     window.roamjs?.extension.smartblocks &&
    //       window.roamjs.extension.smartblocks.registerCommand(insertCmd);
    //   });
    // }

    // addObserver();

    addListeners();
    initializeMapOfTags(extensionAPI);
    console.log("mapOfTags :>> ", mapOfTags);

    console.log("Extension loaded.");
    //return;
  },
  onunload: () => {
    // disconnectObserver();

    // roamAlphaAPI.ui.blockContextMenu.removeCommand({
    //   label: "Color Highlighter: Remove color tags",
    // });
    removeListeners();

    console.log("Extension unloaded");
  },
};
