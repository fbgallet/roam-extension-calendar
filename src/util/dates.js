import { DateTime } from "luxon";
import { timeFormat } from "..";

export const eventTimeFormats = {
  long: {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  },
  medium: {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    meridiem: "short",
  },
  short: {
    hour: "numeric",
    minute: "2-digit",
    omitZeroMinute: true,
    meridiem: "short",
  },
};

export const timestampRegex = /([0-9]{1,2})([:|h]([0-9]{1,2})?)?/;
export const strictTimestampRegex =
  /\b(\d{1,2}):(\d{1,2})(?:\s?|\b)((?:PM|pm|AM|am|))(?:\s|\b)|\b(\d{1,2})((?:PM|pm|AM|am))(?:\s|\b)|\b(\d{1,2})h(\d{1,2})?(\s|\b)/;
export const rangeRegex =
  /[0-9]{1,2}([:|h]([0-9]{1,2})?)? ?(?:PM|pm|AM|am)? ?- ?[0-9]{1,2}([:|h]([0-9]{1,2})?)? ?(?:PM|pm|AM|am)?/;
export const durationRegex = /\b(\d{1,3})([m|h])(\s|\b)/;

export const getDistantDate = (date = null, shift = 1) => {
  if (!date) date = new Date();
  return new Date(date.getTime() + shift * (24 * 60 * 60 * 1000));
};

export const dateToISOString = (date, withUTC) => {
  //   return date.toISOString().substr(0, 10);
  const dt = DateTime.fromJSDate(date);
  return dt.toISODate() + (withUTC ? "T00:00:00Z" : "");
};

export const getDateFromDnpUid = (dnpUid) => {
  const parts = dnpUid.split("-");
  return new Date(parts[2], parts[0] - 1, parts[1]);
};

export const parseRange = (string) => {
  const matchingRange = string.match(rangeRegex);
  if (matchingRange) {
    const timestamps = matchingRange[0].split("-").map((t) => t.trim());
    return {
      matchingString: matchingRange[0],
      range: {
        start: getNormalizedTimestamp(timestamps[0]).timestamp,
        end: getNormalizedTimestamp(timestamps[1]).timestamp,
      },
    };
  }
  return null;
};

export const getNormalizedTimestamp = (str, regex = strictTimestampRegex) => {
  const matchingTime = str.match(regex);
  if (matchingTime) {
    let shift = 0;
    if (!matchingTime[1]) {
      shift = 3;
      if (!matchingTime[4]) shift = 5;
    }
    if (
      (matchingTime[3] && matchingTime[3].toLowerCase().includes("p")) ||
      (matchingTime[5] && matchingTime[5].toLowerCase().includes("p"))
    ) {
      matchingTime[1 + shift] = (
        parseInt(matchingTime[1 + shift]) + 12
      ).toString();
    }

    return {
      matchingString: matchingTime[0],
      timestamp: `${addZero(matchingTime[1 + shift])}:${
        !isNaN(matchingTime[2 + shift])
          ? addZero(matchingTime[2 + shift])
          : "00"
      }`,
    };
  }
  return null;
};

export function getTimestampFromHM(h, m) {
  if (h === 0 && m === 0) return "0:00";
  let timestamp = h;
  let period = "";
  if (timeFormat !== "long") {
    if (h > 11) {
      period = "pm";
      timestamp = h !== 12 ? h - 12 : h;
    } else period = "am";
  }
  if (timeFormat !== "short" || m !== 0) {
    timestamp += ":" + addZero(m);
  }
  timestamp += period;
  return timestamp;
}

export const addZero = (i) => {
  if (isNaN(i) && i.charAt(0) === "0") return i;
  let nb = parseInt(i);
  if (nb < 10) {
    nb = "0" + nb;
  }
  return nb;
};

export const getFormatedRange = (start, end) => {
  return start + " - " + end;
};

export const getDurationInMin = (string) => {
  const matchingDuration = string.match(durationRegex);
  if (matchingDuration) {
    let factor = matchingDuration[2] === "h" ? 60 : 1;
    return parseInt(matchingDuration[1]) * factor;
  }
  return null;
};

export const getDateAddingDurationToDate = (initialDate, duration) => {
  return new Date(initialDate.getTime() + duration * 60000);
};

export const addDaysToDate = (initialDate, days) => {
  return initialDate.setDate(initialDate.getDate() + days);
};

export const getDayOfYear = (date) => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date - startOfYear;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay) + 1;
  return dayOfYear;
};
