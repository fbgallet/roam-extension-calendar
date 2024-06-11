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

export const handleRightClickOnCalendarBtn = (e, isCommand) => {
  !isCommand && e.preventDefault();
  !isCommand && e.stopPropagation();
  let appWrapper;
  let inSidebar = false;
  const periodFromDatepicker = isCommand ? null : getFocusedDateInDatepicker(e);
  if (e && e.shiftKey) {
    window.roamAlphaAPI.ui.rightSidebar.open();
    inSidebar = true;
    appWrapper = document.querySelector(".full-calendar-comp.fc-sidebar");
  } else {
    const parentElt = document.querySelector(".rm-article-wrapper");
    if (parentElt) appWrapper = parentElt.querySelector(".full-calendar-comp");
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
  if (datePickerElt) datePickerElt.parentElement.parentElement.remove();
};

export const handleClickOnCalendarBtn = (e) => {
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
        (e) => handleRightClickOnCalendarBtn(e, true),
        {
          once: true,
        }
      );
      if (window.roamAlphaAPI.platform.isTouchDevice) {
        fcButton.addEventListener(
          "touchend",
          (e) => handleRightClickOnCalendarBtn(e, true),
          {
            once: true,
          }
        );
      }
    }
  }, 100);
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
