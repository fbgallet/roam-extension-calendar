import { DateTime } from "luxon";

export const timestampRegex = /([0-9]{1,2})([:|h]([0-9]{1,2})?)?/;
export const strictTimestampRegex =
  /\b(\d{1,2})(:)(\d{1,2})(\s|\b)|\b(\d{1,2})(h)(\d{1,2})?(\s|\b)/;
export const rangeRegex =
  /[0-9]{1,2}([:|h]([0-9]{1,2})?)? ?- ?[0-9]{1,2}([:|h]([0-9]{1,2})?)?/;
export const durationRegex = /\b(\d{1,3})([m|h])(\s|\b)/;

export const getDistantDate = (date = null, shift = 1) => {
  if (!date) date = new Date();
  return new Date(date.getTime() + shift * (24 * 60 * 60 * 1000));
};

export const dateToISOString = (date) => {
  //   return date.toISOString().substr(0, 10);
  const dt = DateTime.fromJSDate(date);
  return dt.toISODate();
};

export const parseRange = (string) => {
  const matchingRange = string.match(rangeRegex);
  // console.log("matchingRange :>> ", matchingRange);
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

export const getNormalizedTimestamp = (timestamp, regex = timestampRegex) => {
  const matchingTime = timestamp.match(regex);
  if (matchingTime) {
    let shift = 0;
    if (!matchingTime[1]) shift = 4;
    // console.log("matchingTime :>> ", matchingTime);
    return {
      matchingString: matchingTime[0],
      timestamp: `${addZero(matchingTime[1 + shift])}:${
        matchingTime[3 + shift] ? addZero(matchingTime[3 + shift]) : "00"
      }`,
    };
  }
  return null;
};

export function getTimestampFromHM(h, m) {
  return addZero(h) + ":" + addZero(m);
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
