import React from "react";
import ReactDOM from "react-dom";
import Calendar from "./Calendar";

export function renderApp(inSidebar) {
  let root, parentElt;
  root = document.createElement("div");
  if (inSidebar) {
    parentElt = document.querySelector("#roam-right-sidebar-content");
    parentElt.parentElement.insertBefore(root, parentElt);
    const existing = parentElt.getElementsByClassName("full-calendar-comp");
    if (existing.length !== 0) existing[0].remove();
    root.classList.add("fc-sidebar");
  } else {
    parentElt = document.querySelector("#rm-log-container");
    if (!parentElt) parentElt = document.querySelector(".rm-article-wrapper");
    const existing = parentElt.getElementsByClassName("full-calendar-comp");
    if (existing.length !== 0) existing[0].remove();
    parentElt.insertBefore(root, parentElt.firstChild);
  }
  root.classList.add("full-calendar-comp");

  ReactDOM.render(<Calendar />, root);
}

export function unmountApp(appWrapper) {
  if (appWrapper) ReactDOM.unmountComponentAtNode(appWrapper);
  appWrapper.remove();
}
