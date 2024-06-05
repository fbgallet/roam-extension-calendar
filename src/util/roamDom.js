export const getFocusedDateInDatepicker = (clickEvt) => {
  let periodType, firstDay;
  if (!clickEvt.target) return null;
  const datePickerElt = document.querySelector(".bp3-datepicker");
  if (!datePickerElt) return null;
  if (clickEvt.target.className === "bp3-datepicker-day-wrapper") {
    periodType = "day";
    firstDay = clickEvt.target.parentElement.ariaLabel;
  } else if (clickEvt.target.className === "DayPicker-WeekNumber") {
    periodType = "week";
    firstDay = clickEvt.target.nextElementSibling.ariaLabel;
  } else {
    periodType = "month";
    firstDay = datePickerElt.querySelector(".bp3-datepicker-day-wrapper")
      .parentElement.ariaLabel;
  }
  if (!firstDay) return null;
  return { periodType, initialDate: new Date(firstDay) };
};

export const handleLongTouch = (element, callback) => {
  let touchTimer = null;

  function onTouchStart(e) {
    touchTimer = setTimeout(() => {
      callback(element);
      setTimeout(() => {
        const datePicker = document.querySelector(".bp3-datepicker");
        if (datePicker) datePicker.parentElement.parentElement.remove();
      }, 50);
    }, 700);
  }
  function onTouchEnd(e) {
    if (touchTimer)
      if (touchTimer !== null) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
  }
  function onTouchCancel(e) {
    if (touchTimer !== null) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
  }
  if (callback) {
    element.addEventListener("touchstart", onTouchStart);
    element.addEventListener("touchend", onTouchEnd);
    element.addEventListener("touchcancel", onTouchCancel);
  } else {
    element.removeEventListener("touchstart", onTouchStart);
    element.removeEventListener("touchend", onTouchEnd);
    element.removeEventListener("touchcancel", onTouchCancel);
  }
};
