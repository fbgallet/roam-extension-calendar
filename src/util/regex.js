export const uidRegex = /(?<!`)\(\([^\)]{9}\)\)(?!`)/g;
export const uidInRefOrEmbedRegex =
  // /^(?:(\{\{\[?\[?(?:embed|embed-path|embed-children)\]?\]?:\s?|))\(\(([^\)]{9})\)\)/;
  /^(\{\{\[?\[?(?:embed|embed-path|embed-children)\]?\]?:\s?\(\(([^\)]{9})\)\)\s?\}\})$|^\(\(([^\)]{9})\)\)$/;
export const pageRegex = /\[\[.*\]\]/g; // very simplified, not recursive...
export const dnpUidRegex =
  /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-(19|20)\d{2}$/;
export const roamDateRegex =
  /\[\[(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s(?:1st|2nd|3rd|[4-9]th|1\d{1}th|21st|22nd|23rd|2\d{1}th|30th|31st),\s\d{4}\b)\]\]/g;
export const notNullOrCommaRegex = /^(?!\s*,*\s*$).+/;
export const alphanumRegex = /^[\p{L}\p{N}\p{Emoji}]+$/u;
export const defaultUntilDateRegex =
  /(?:^|\s)():?:?\s?(?:on|)\s?\[\[(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s(?:1st|2nd|3rd|[4-9]th|1\d{1}th|21st|22nd|23rd|2\d{1}th|30th|31st),\s\d{4}\b)\]\]/i;
export let untilDateRegex;
export const defaultStartDateRegex =
  /(?:^|(?<!\bdue\b)\s)():?:?\s?(?:on|)\s?\[\[(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s(?:1st|2nd|3rd|[4-9]th|1\d{1}th|21st|22nd|23rd|2\d{1}th|30th|31st),\s\d{4}\b)\]\]/i;
export let startDateRegex;
export const queryRegex = /\{\{query\s?:|\{\{\[\[query\]\]\s?:/;

export function customizeRegex(regex, strToInsert, position) {
  let [regexStr, flags] = regex.toString().slice(1).split("/");
  regexStr =
    regexStr.slice(0, position) + strToInsert + regexStr.slice(position);
  const updatedRegex = new RegExp(regexStr, (flags || "") + "u");
  if (regex === defaultUntilDateRegex) untilDateRegex = updatedRegex;
  else if (regex === defaultStartDateRegex) startDateRegex = updatedRegex;
}

export function escapeCharacters(str) {
  return str.replaceAll(/[.*+?^${}()|\[\]\\]/g, "\\$&");
}
