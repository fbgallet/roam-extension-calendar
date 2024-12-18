# Full Calendar

### A comprehensive calendar to handle your tasks and have an overview of events or any tagged content in your Daily Note Pages.

🆕 New in v.5:

- drag&drop event tags to create new event
- 12h-format support
- modifier key when dragging a block into the calendar is now consistent with native Roam behavior (Alt key to reference, no key to move)

🆕 New in v.4:

- **Multi-day events** full support, see 'Events with date attributes' section below
- user tags have now aliases and can be easily added/removed
- options to display substaks and sort events by alpanumeric order (default) or block order
- a lot of small fixes: see [changelog here for more details on updates and fixes](https://github.com/fbgallet/roam-extension-calendar/blob/main/CHANGELOG.md)

![Full calendar gif demo 1](https://github.com/fbgallet/roam-extension-calendar/assets/74436347/81e22cb5-9d4c-45c9-9f6f-36160d7e7631)

## Open the calendar view

- Click on the native calendar icon, then on `Toggle Full Calendar` button, under the datepicker (only way to open it on mobile), to open it at the top of the main view, or `Shift + Click` to open it in the right sidebar,
- or `Right click` on the native calendar icon, or `Shift + Right click` to open Full Calendar in the right sidebar.

The same action close the corresponding Full Calendar component. You can also use `Display/Hide in [main window or sidebar]` commands in Roam Command palette.

The calendar will automatically fill the entire height of the window, but you can scroll down to see the page content and navigate between pages without losing sight of the calendar.

By clicking on the 'pin' icon, the calendar will occupy 50% of the page height. Then it can be resized, and will remain displayed at the top of the page as you scroll down.

You can also select the initial date and the type of period to display (month, week, day): open the native datepicker by clicking on the calendar icon, then browse to the choosen date in the datepicker and

- right click on a given day to open this day in Full calendar,
- right click on the week number to open the corresponding week,
- right click anywhere else to open the corresponding month.

If you press Shift at the same time, it will be opened in the sidebar.

## Events and tasks displayed in the calendar

By default, the events and tasks displayed in the calendar are the first children block of `#calendar` block (nb: only its first mention is taken into account), in each Daily Notes Pages (DNP). This calendar tag can be customized.

⚠️ All blocks with a date defined as a start or end date or any other specific tag, in its content or in its direct children, will always be considered as a calendar event and be displayed (if matching filter tags), regardless of the state of the options below, and whether it is a reference or anywhere on a DNP. See **'Events with date attributes'** section for more informations.

In the calendar header, you have the following options:

- switch `dnp` on to display all blocks in the whole DNP matching the current tag filter, switch it off to display only events under `#calendar` (and events with date attributes)

  ⚠️ Be aware that enabling this option requires processing significantly more data with each loading or refresh of the calendar, which may slightly slow down its display, especially if you have a lot of data in your DNPs !

- switch `refs` on/off to display/hide all blocks in linked references of your DNP matching the current tag filter (referenced events defined by a date attribute are not affected). These events are distinguished by a dashed line along the bottom edge.
- switch `we` on/off to display/hide week-end days.

**All the view settings are automatically saved and automatically reloaded upon the next opening, separately for the main page and the sidebar.**

## Handle events

- `Click` on an event to edit or delete it.
  - You can remove some of its tags by clicking on the corresponding tag right cross, the corresponding tag will also be removed from the block content.
  - Events from DNP linked references are rendered with their path.
- `Double click` (or select, the click later) on a day square in the calendar to create a new event. Each event created will be inserted as child of `#calendar` block.
- You can `drag and drop` any event from one day to another.
- Lengthen or shorten any event in month or year view to extend the event over several days. Date attributes will automaticaly be added or updated in the direct children.
- Direct children of block event are taken into account. All mentionned tags will be added to the event and mentionned date will change the event span or display it on multiple days. See **'Events with date attributes'** section.
- You can drag and drop a block from your graph into the calendar (updated in v.5):
  - simple `drag and drop` to move: the original block will be moved as child of the calendar tag in the corresponding DNP
  - press `Alt/Option` or `Control` to reference: a block reference to the the original block will be created
  - press `Shift` to move: a copy of the original block will be inserted as child of the calendar tag and a corresponding event will be created
- In timegrid views (week or day), events with a timestamp can be
  - `drag and drop` to move them to another time slot
  - lengthen or shorten by placing the cursor at the top or bottom of the event to drag its start time or end time to a new schedule.

## Handle events with timestamp and duration

If the block contain a timestamp, the corresponding event will automatically have a start time and, by default, one-hour duration. A timestamp can be in 24h or 12h format (🆕 new in v.5), e.g. `14:00`, `14h`, `9:05`, `9:5`, `9h05`, `2:00pm`, `2pm`, `9:05 PM`, etc. (only `:` and `h` are supported as separator between hours and minutes).

To define a duration you can:

- add another timestamp with `-` serator, to define a range. E.g.: `14:00 - 15:30`
- add a duration in minutes or hours, in the following format: `90m`, `2h`.The duration has to be placed after the timestamp in the block.

In the settings, you can change how timestamps are displayed in the calendar and inserted in blocks.

## Events with date attributes (🆕 new in v.4)

Using "date attribute" is a way to define a block as a calendar event (it will always be displayed in the calendar if matching filter tags), anywhere in your graph. The term "attribute" designates a broader category than roam `attributes::`, as it can also refer to `#tags`, `[[page mentions]]`, or specific keywords to defined a given type of date:

- **Event range**:

  - you can define start and end date for multi-day events using keywords before the date, directly in the event block, or in its direct children blocks. Start date is optional in DNP since the start date will be the corresping day by default.
  - The default **start** keywords are `date`, `from`, `start`, `begin`, `on`. They can be directly followed by a Roam date, separated by a space, eventually following one or two colon. E.g., using `start` keyword, all the following ways of writing will work:
    - `start [[August 5th, 2024]]`
    - `start: [[August 5th, 2024]]`
    - `start:: [[August 5th, 2024]]`
    - `start on [[August 5th, 2024]]`
  - The default **end** keywords are `until`, `to`, `end`. `due` or `due date` will also automatically be interpreted as end date.
  - You can customize these keywords. The first one will be automatically inserted in a direct child block if you change a day event to a multi-day event with the mouse. (`until:: [[date]]`)

- Tags can be used to define additional dates in a directh children block. It will create a reference to the same event on the given date (e.g.: `do:: [[July 17th, 2024]]`). You can create multiple references of the same event, in different direct children blocks. They are all linked to the same event (if you check it to DONE, all of its instances are automatically checked).

Here is an example of an event with date attributes and tags in direct children:

```
- {{[[TODO]]}} Some multi-day task
    - start: [[August 2nd, 2024]]
    - end: [[August 5th, 2024]]
    - #important
    - deadline:: [[August 7th, 2024]] !!!

```

![Full Calendar Multi-day demo](https://github.com/user-attachments/assets/d292eb38-1e4b-4d1e-9a4a-406b87039192)

## Tags

- Default tags are TODO, DONE, important, do date, due date, doing.
- You can specify the correspoding page title for each of them (except for TODO & DONE), and add aliases, in the settings or directly in the filter bar, by clicking on a tag.
- You can add your own tags, in extension settings or directly in the filter input (type some page title and press on "Add: <your tag>"). With this latest method, it will be a temporary tag. Temporary tag will be removed from the tag list if you refresh your Roam graph, unless you set it as a permanent user tag by clicking on + icon in the tag popover (see next bullet point).
- By clicking on a tag, you can change it's color and its aliases. User tags can also be removed and temporary user tags be added to permanent user tags.
- By double-clicking on a tag, it will be selected as the only filter tag.
- By clicking on the right cross (or star), all tags will be unselected (or selected)
- You can change the logic: by defaylt ('Or' logic) all the events containing at least one of the tags will be displayed. For more precision, if you want to display only events that contain all the selected tags (e.g. important AND due date), choose the 'And' logic.
- (🆕 New in v.5) You can drag & drop a tag to the calendar grid to instantly create a new event including this tag.

**The selected tags' state (colors and choosen tags as filters) is retained from one session to another, and separately for the main page and the sidebar concerning the choosen tags.**

## Future developments

- Recursive events
- Import from Google calendar and Outlook
- Notifications
- ...

## Support my work

This extension represents a significant amount of work. If you want to encourage me to develop further and enhance it, you can [buy me a coffee ☕ here](https://buymeacoffee.com/fbgallet). Thanks in advance for your support! 🙏

---

### For any question or suggestion, DM me on **Twitter** and follow me to be informed of updates and new extensions : [@fbgallet](https://twitter.com/fbgallet).

Please report any issue [here](https://github.com/fbgallet/roam-extension-calendar/issues).
