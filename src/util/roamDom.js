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
