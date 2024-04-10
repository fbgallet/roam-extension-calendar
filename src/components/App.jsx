import React from "react";
import ReactDOM from "react-dom";
import Calendar from "./Calendar";

export function renderApp() {
  const existing = document.getElementsByClassName("calendar");
  console.log(existing);
  if (existing.length !== 0) existing[0].remove();
  const block = document.getElementsByClassName("rm-block")[1];
  const root = document.createElement("div");
  root.classList.add("calendar");
  block.appendChild(root);

  ReactDOM.render(
    <div className="full-calendar-comp">
      <Calendar />
    </div>,
    root
  );
}
