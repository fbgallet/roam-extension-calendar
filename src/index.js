// import { addObserver, disconnectObserver } from "./observers";

import { preventDefault } from "@fullcalendar/core/internal";
import { renderApp, unmountApp } from "./components/App";

const calendarBtnElt = document.querySelector(
  "button:has(span[icon='calendar'])"
);

const panelConfig = {
  tabTitle: "Calendar",
  settings: [
    // INPUT example
    // {
    //   id: "footnotesHeader",
    //   name: "Footnotes header",
    //   description: "Text inserted as the parent block of footnotes:",
    //   action: {
    //     type: "input",
    //     onChange: (evt) => {
    //       //   footnotesTag = evt.target.value;
    //     },
    //   },
    // },
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

export default {
  onload: async ({ extensionAPI }) => {
    extensionAPI.settings.panel.create(panelConfig);

    // get settings from setting panel
    // if (extensionAPI.settings.get("footnotesHeader") === null)
    //   extensionAPI.settings.set("footnotesHeader", "#footnotes");
    // footnotesTag = await extensionAPI.settings.get("footnotesHeader");

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
