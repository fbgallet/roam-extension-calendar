# Full Calendar

### A comprehensive calendar to get an overview of your tasks and activities spread over numerous Daily Notes Pages.

![Full calendar gif demo 1](https://github.com/fbgallet/roam-extension-calendar/assets/74436347/81e22cb5-9d4c-45c9-9f6f-36160d7e7631)

## Open the calendar view

- `Right click` on the native calendar icon in the top bar to open Full Calendar at the top of the main view, or just click on the calendar icon, then on `Open Full Calendar` button, under the datepicker. You can also `Long press` on mobile.
- `Shift + Right click` on calendar icon or on 'Open Full calendar' button to open it in the sidebar.

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
- You can drag and drop a block from your graph into the calendar:
  - simple `drag and drop` to copy: a copy of the original block will be inserted as child of the calendar tag and a corresponding event will be created
  - press `Shift` to move: the original block will be moved as child of the calendar tag in the corresponding DNP
  - press `Control` or `Command` to reference: a block reference to the the original block will be created

## Tags

- Default tags are TODO, DONE, important, do date, due date, doing
- You can specify the correspoding page title for each of them (except for TODO & DONE), and add aliases.
- You can specify your own tags.
- By clicking on a tag, you can change it's color.
- By double-clicking on a tag, it will be selected as the only filter tag.
- By clicking on the right cross (or star), all tags will be unselected (or selected)
- You can change the logic: by defaylt ('Or' logic) all the events containing at least one of the tags will be displayed. For more precision, if you want to display only events that contain all the selected tags (e.g. important AND due date), choose the 'And' logic.

**The selected tags' state (colors and chosen tags as filters) is retained from one session to another (in the browser's memory).**

## Future developments

- Events with start and end time.
- Events spanning multiple days.
- Import from Google calendar.
- Filter content with any page title
- ...

If you want to encourage me to develop further and enhance this extension, you can [buy me a coffee ☕ here](https://buymeacoffee.com/fbgallet). Thanks in advance for your support! 🙏

---

### For any question or suggestion, DM me on **Twitter** and follow me to be informed of updates and new extensions : [@fbgallet](https://twitter.com/fbgallet).
