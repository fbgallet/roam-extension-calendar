import { renderApp, unmountApp } from "../components/App";

let runningCount = 0;

export const getCalendarButtonElt = () => {
  return document.querySelector("button:has(span[icon='calendar'])")
    ?.parentElement?.parentElement;
};

export const getFocusedDateInDatepicker = (clickEvt) => {
  let periodType, firstDay;
  if (!clickEvt.target) return null;
  const datePickerElt = document.querySelector(".bp3-datepicker");
  if (!datePickerElt) return null;
  if (clickEvt.target.className === "bp3-datepicker-day-wrapper") {
    periodType = "dayGridDay";
    firstDay = clickEvt.target.parentElement.ariaLabel;
  } else if (clickEvt.target.className === "DayPicker-WeekNumber") {
    periodType = "dayGridWeek";
    firstDay = clickEvt.target.nextElementSibling.ariaLabel;
  } else {
    periodType = "dayGridMonth";
    firstDay = datePickerElt.querySelector(".bp3-datepicker-day-wrapper")
      .parentElement.ariaLabel;
  }
  if (!firstDay) return null;
  return { periodType, initialDate: new Date(firstDay) };
};

export const handleRightClickOnCalendarBtn = (e, isCommand, timeout = 0) => {
  !isCommand && e.preventDefault();
  !isCommand && e.stopPropagation();
  setTimeout(() => {
    runningCount++;
    if (runningCount > 1) {
      runningCount = 0;
      return;
    }
    let appWrapper;
    let inSidebar = false;
    const periodFromDatepicker = isCommand
      ? null
      : getFocusedDateInDatepicker(e);
    if (e && e.shiftKey) {
      window.roamAlphaAPI.ui.rightSidebar.open();
      inSidebar = true;
      appWrapper = document.querySelector(".full-calendar-comp.fc-sidebar");
    } else {
      const parentElt = document.querySelector(".rm-article-wrapper");
      if (parentElt)
        appWrapper = parentElt.querySelector(".full-calendar-comp");
    }
    if (!appWrapper || periodFromDatepicker) {
      setTimeout(
        () => {
          if (appWrapper && periodFromDatepicker) unmountApp(appWrapper);
          renderApp(inSidebar, periodFromDatepicker);
        },
        inSidebar && !document.querySelector("#roam-right-sidebar-content")
          ? 250
          : 0
      );
    } else {
      setTimeout(
        () => {
          unmountApp(appWrapper);
        },
        inSidebar && !document.querySelector("#roam-right-sidebar-content")
          ? 250
          : 100
      );
    }
    const datePickerElt = document.querySelector(".bp3-datepicker");
    const buttonElt = getCalendarButtonElt();
    if (datePickerElt)
      simulateClick(buttonElt, window.roamAlphaAPI.platform.isTouchDevice);
    setTimeout(() => {
      runningCount = 0;
    }, 500);
  }, timeout);
};

export const onDragStart = (event) => {
  if (
    event.srcElement.tagName === "SPAN" &&
    event.srcElement.classList[0] === "rm-bullet"
  ) {
    const sourceBlockUid =
      event.srcElement.parentElement?.nextElementSibling?.id?.slice(-9);
    event.dataTransfer.setData("text/plain", sourceBlockUid);
  }
};

function simulateClick(el, isTouch) {
  const options = {
    bubbles: true,
    cancelable: true,
    view: window,
    target: el,
    which: 1,
    button: 0,
  };
  if (!isTouch) {
    el.dispatchEvent(new MouseEvent("mousedown", options));
    el.dispatchEvent(new MouseEvent("mouseup", options));
    // el.dispatchEvent(new MouseEvent("click", options));
  } else {
    el.dispatchEvent(new MouseEvent("touchstart", options));
    el.dispatchEvent(new MouseEvent("touchend", options));
  }
}

export const addListeners = () => {
  removeListeners();
  const calendarBtnElt = getCalendarButtonElt();
  document.addEventListener("dragstart", onDragStart);
  calendarBtnElt.addEventListener("contextmenu", (e) => {
    handleRightClickOnCalendarBtn(e);
  });
};

export const removeListeners = () => {
  const calendarBtnElt = getCalendarButtonElt();
  document.removeEventListener("dragstart", onDragStart);
  calendarBtnElt.removeEventListener("contextmenu", (e) => {
    handleRightClickOnCalendarBtn(e);
  });
};

let runners = {
  observers: [],
};

export function connectObservers() {
  addObserver(
    document.querySelector(".rm-topbar"),
    onCalendarClick,
    {
      childList: true,
      subtree: true,
    },
    "calendar"
  );
}

function addObserver(element, callback, options, name) {
  let myObserver = new MutationObserver(callback);
  myObserver.observe(element, options);

  runners[name] = [myObserver];
}
export function disconnectObserver(name) {
  if (runners[name])
    for (let index = 0; index < runners[name].length; index++) {
      const element = runners[name][index];
      element.disconnect();
    }
}

function onCalendarClick(mutation) {
  setTimeout(() => {
    if (
      mutation[0].target?.className === "bp3-datepicker-caption" &&
      mutation[0].addedNodes[0]?.className === "bp3-datepicker-caption-measure"
    ) {
      setTimeout(() => {
        let fcButton = document.querySelector(".fc-open-button");
        if (!fcButton) {
          fcButton = document.createElement("div");
          fcButton.classList.add("fc-open-button");
          fcButton.innerText = "Open Full Calendar";
          fcButton.setAttribute("title", "Click + shift to open in sidebar");
          const datePickerElt = document.querySelector(".bp3-datepicker");
          if (!datePickerElt) return;
          datePickerElt.appendChild(fcButton);
          fcButton.addEventListener(
            "click",
            (e) => handleRightClickOnCalendarBtn(e, true, 50),
            {
              once: true,
            }
          );
          if (window.roamAlphaAPI.platform.isTouchDevice) {
            fcButton.addEventListener(
              "touchend",
              (e) => handleRightClickOnCalendarBtn(e, true, 100),
              {
                once: true,
              }
            );
          }
        }
      }, 100);
    } else if (
      mutation[0].nextSibling?.className === "rm-topbar__spacer-sm" ||
      (mutation[0].removedNodes[0]?.className === "rm-topbar__spacer-sm" &&
        mutation[0].previousSibling === null)
    ) {
      addListeners();
    }
  }, 50);
}
