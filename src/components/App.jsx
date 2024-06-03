import React from "react";
import ReactDOM from "react-dom";
import Calendar from "./Calendar";

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

  ReactDOM.render(
    <Calendar parentElt={parentElt} {...periodFromDatepicker} />,
    root
  );
}

export function unmountApp(appWrapper) {
  if (appWrapper) ReactDOM.unmountComponentAtNode(appWrapper);
  appWrapper.remove();
}
