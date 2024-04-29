import React from "react";
import ReactDOM from "react-dom";
import Calendar from "./Calendar";

export function renderApp() {
  const existing = document.getElementsByClassName("full-calendar-comp");
  if (existing.length !== 0) existing[0].remove();
  let parentElt = document.querySelector("#rm-log-container");
  if (!parentElt) parentElt = document.querySelector(".rm-article-wrapper");
  const root = document.createElement("div");
  root.classList.add("full-calendar-comp");
  parentElt.insertBefore(root, parentElt.firstChild);
  // parentElt.insertAdjacentHTML("afterbegin", root);

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
