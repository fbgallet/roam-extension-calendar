import { formatDate } from "@fullcalendar/core";
import { DateTime } from "luxon";

export const getDistantDate = (date = null, shift = 1) => {
  if (!date) date = new Date();
  return new Date(date.getTime() + shift * (24 * 60 * 60 * 1000));
};

export const dateToISOString = (date) => {
  //   return date.toISOString().substr(0, 10);
  const dt = DateTime.fromJSDate(date);
  return dt.toISODate();
};
