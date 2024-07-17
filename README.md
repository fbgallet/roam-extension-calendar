# Full Calendar

### A comprehensive calendar to get an overview of your tasks and activities spread over numerous Daily Notes Pages.

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

In the calendar header, you have the following options:

- switch `dnp` on to display all blocks in the whole DNP matching the current tag filter, switch it off to display only events under `#calendar`.
- switch `refs` on/off to display/hide all blocks in linked references of your DNP matching the current tag filter. These events are distinguished by a dashed line along the bottom edge.
- switch `we` on/off to display/hide week-end days.

**All the view settings are automatically saved and automatically reloaded upon the next opening, separately for the main page and the sidebar.**

## Handle events

- `Click` on an event to edit or delete it.
  - You can remove some of its tags by clicking on the corresponding tag right cross, the corresponding tag will also be removed from the block content.
  - Events from DNP linked references are rendered with their path.
- `Double click` (or select, the click later) on a day square in the calendar to create a new event. Each event created will be inserted as child of `#calendar` block.
- You can `drag and drop` any event from one day to another.
- Lengthen or shorten any event in month or year view to extend the event over several days.
- First children of block event are taken into account:

  - all mentionned tags will be added to the event
  - dates (eventually with tags) will create a reference to the same event on the given date (e.g.: `due:: [[July 17th, 2024]]`)
  - you can define start and end date for events spanning multiple days (start is optional since the daily note where the event is created define the start date)
    - `start: [[date]]` or `begin:` or `from:`, with one, two or no colon
    - `end: [[date]]` or `to:` or `until:`

- You can drag and drop a block from your graph into the calendar:
  - simple `drag and drop` to copy: a copy of the original block will be inserted as child of the calendar tag and a corresponding event will be created
  - press `Shift` to move: the original block will be moved as child of the calendar tag in the corresponding DNP
  - press `Control` or `Command` to reference: a block reference to the the original block will be created
- In timegrid views (week or day), events with a timestamp can be
  - `drag and drop` to move them to another time slot
  - lengthen or shorten by placing the cursor at the top or bottom of the event to drag its start time or end time to a new schedule.

## Handle events with timestamp and duration

If the block contain a timestamp, the corresponding event will automatically have a start time and, by default, one-hour duration. A timestamp has to be in 24h format, e.g. `14:00`, `14h`, `9:05`, `9:5`, `9h05`, etc. (only `:` and `h` are supported as separator between hours and minutes).

To define a duration you can:

- add another timestamp with `-` serator, to define a range. E.g.: `14:00 - 15:30`
- add a duration in minutes or hours, in the following format: `90m`, `2h`.The duration has to be placed after the timestamp in the block.

In the settings, you can change how timestamps are displayed in the calendar, including choosing a 12-hour display. However, currently, the input entry must be in 24-hour format.

## Tags

- Default tags are TODO, DONE, important, do date, due date, doing
- You can specify the correspoding page title for each of them (except for TODO & DONE), and add aliases.
- You can specify your own tags, permanently in the extension settings, temporary directly in the filter input (type some page title and press on "Add: <your tag>"). Temporary tag will be removed from the tag list if you refresh your Roam graph.
- By clicking on a tag, you can change it's color.
- By double-clicking on a tag, it will be selected as the only filter tag.
- By clicking on the right cross (or star), all tags will be unselected (or selected)
- You can change the logic: by defaylt ('Or' logic) all the events containing at least one of the tags will be displayed. For more precision, if you want to display only events that contain all the selected tags (e.g. important AND due date), choose the 'And' logic.

**The selected tags' state (colors and choosen tags as filters) is retained from one session to another, and separately for the main page and the sidebar concerning the choosen tags.**

## Future developments

- Events spanning multiple days
- Recursive events
- Import from Google calendar.
- Notifications
- ...

## Support my work

This extension represents a significant amount of work. If you want to encourage me to develop further and enhance it, you can [buy me a coffee ☕ here](https://buymeacoffee.com/fbgallet). Thanks in advance for your support! 🙏

---

### For any question or suggestion, DM me on **Twitter** and follow me to be informed of updates and new extensions : [@fbgallet](https://twitter.com/fbgallet).

Please report any issue [here](https://github.com/fbgallet/roam-extension-calendar/issues).
