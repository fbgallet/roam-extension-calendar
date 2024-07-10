export const uidRegex = /\(\([^\)]{9}\)\)/g;
export const pageRegex = /\[\[.*\]\]/g; // very simplified, not recursive...
export const dnpUidRegex = /(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-[0-9]{4}/;
export const roamDateRegex =
  /\[\[(January|February|March|April|May|June|July|August|September|October|November|December)\s(\d{1,2})(?:st|nd|rd|th),\s(\d{4})\]\]/g;
export const notNullOrCommaRegex = /^(?!\s*,*\s*$).+/;
export const alphanumRegex = /^[\p{L}\p{N}\p{Emoji}]+$/u;
export const untilDateRegex =
  /until \[\[(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s(?:1st|2nd|3rd|[4-9]th|1\d{1}th|2\d{1}th|30th|31st),\s\d{4}\b)\]\]/i;
