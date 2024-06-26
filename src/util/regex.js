export const uidRegex = /\(\([^\)]{9}\)\)/g;
export const pageRegex = /\[\[.*\]\]/g; // very simplified, not recursive...
export const dnpUidRegex = /(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-[0-9]{4}/;
export const roamDateRegex =
  /\[\[(January|February|March|April|May|June|July|August|September|October|November|December)\s(\d{1,2})(?:st|nd|rd|th),\s(\d{4})\]\]/g;
export const alphanumRegex = /\w/;
