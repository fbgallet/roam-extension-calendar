import React from "react";
import ReactDOM from "react-dom";
import Calendar from "./Calendar";

export function renderApp(inSidebar) {
  let root, parentElt;
  root = document.createElement("div");
  // const existing = document.getElementsByClassName("full-calendar-comp");
  // if (existing.length !== 0) existing[0].remove();
  if (inSidebar) {
    parentElt = document.querySelector("#roam-right-sidebar-content");
    parentElt.parentElement.insertBefore(root, parentElt);
    root.classList.add("fc-sidebar");
  } else {
    parentElt = document.querySelector("#rm-log-container");
    if (!parentElt) parentElt = document.querySelector(".rm-article-wrapper");
    parentElt.insertBefore(root, parentElt.firstChild);
  }
  root.classList.add("full-calendar-comp");

  ReactDOM.render(
    <div>
      <Calendar />
    </div>,
    root
  );
}

export function unmountApp(appWrapper) {
  if (appWrapper) ReactDOM.unmountComponentAtNode(appWrapper);
  appWrapper.remove();
}
