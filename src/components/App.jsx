import React from "react";
import ReactDOM from "react-dom";
import Calendar from "./Calendar";
import { calendarTag, extensionStorage, mapOfTags } from "..";

export function renderApp(inSidebar, periodFromDatepicker) {
  let root, parentElt;
  root = document.createElement("div");
  if (inSidebar) {
    parentElt = document.querySelector("#roam-right-sidebar-content");
    parentElt.parentElement.insertBefore(root, parentElt);
    parentElt = parentElt.parentElement;
    const existing = parentElt.querySelector(".full-calendar-comp");
    if (existing) {
      existing.remove();
    }
    root.classList.add("fc-sidebar");
  } else {
    // parentElt = document.querySelector("#rm-log-container");
    parentElt = document.querySelector(".rm-article-wrapper");
    const existing = parentElt.querySelector(".full-calendar-comp");
    if (existing) {
      existing.remove();
    }
    parentElt.insertBefore(root, parentElt.firstChild);
  }
  root.classList.add("full-calendar-comp");
  const calendarElt = parentElt.querySelector(".full-calendar-comp");
  if (!inSidebar) calendarElt.scrollIntoView();
  const sidebarSuffix = inSidebar ? "-sb" : "";
  const initialSettings = {
    logic: extensionStorage.get("fc-filterLogic" + sidebarSuffix),
    dnp: extensionStorage.get("fc-isEntireDNP" + sidebarSuffix),
    refs: extensionStorage.get("fc-isIncludingRefs" + sidebarSuffix),
    we: extensionStorage.get("fc-isWEtoDisplay" + sidebarSuffix),
    view:
      extensionStorage.get("fc-periodView" + sidebarSuffix) || "dayGridMonth",
    minimized: extensionStorage.get("fc-minimized" + sidebarSuffix),
    sticky: extensionStorage.get("fc-sticky" + sidebarSuffix),
  };

  if (!calendarTag.uids[0]) calendarTag.updateUids(true);

  // update stored data about calendarTag after a change in settings
  const updatedTagIndex = mapOfTags.findIndex((tag) => tag.isToUpdate);
  if (updatedTagIndex > -1) {
    mapOfTags[updatedTagIndex].isToUpdate = false;
    extensionStorage.set(
      "fc-tags-info",
      JSON.stringify(
        mapOfTags.map((tag) => ({
          name: tag.name,
          color: tag.color,
          isToDisplay: tag.isToDisplay,
          isToDisplayInSb: tag.isToDisplayInSb,
        }))
      )
    );
  }

  ReactDOM.render(
    <Calendar
      parentElt={parentElt}
      isInSidebar={inSidebar}
      initialSettings={initialSettings}
      {...periodFromDatepicker}
    />,
    root
  );
}

export function unmountApp(appWrapper) {
  if (appWrapper) ReactDOM.unmountComponentAtNode(appWrapper);
  appWrapper.remove();
}
