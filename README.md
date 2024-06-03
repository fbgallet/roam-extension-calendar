# Full Calendar

### A comprehensive calendar in Roam for visualizing and interacting easily with tasks and activities scattered across different Daily Note Pages.

### Open the calendar view

- `Right click` on the native calendar icon in the top bar to open Full Calendar in the main view. `Double tap` on mobile.
- `Shift + Right click` to open it in the sidebar.

The same action close the corresponding Full Calendar component. You can also use corresponding commands in Roam Command palette.

You can also select the initial date and the type of period to display (month, week, day): open the native date picker by clicking on the calendar icon, then browse to the choose date in the date picker and

- right click on a given day to open this day in Full calendar,
- right click on the week number to open the corresponding week,
- right click anywhere else to open the corresponding month.
  If you press Shift at the same time, it will be opened in the sidebar.

### Data displayed in the calendar

- The events displayed in the calendar are first children block of `#calendar` block (only the fist is taken into account), in each Daily Note Pages (DNP). This calendar tag can be customized.
- If you click on `dnp` switch in the calendar header, all blocks in the whole DNP matching the current tag filter will be displayed.
- If you click on `refs` switch in the calendar header, all blocks in linked references of your DNP matching the current tag filter will be displayed.

### Handle events

- Double click on a day square in the calendar to create a new event. Each event created will be inserted as child of `#calendar` block.
- You can drag and drop any event from one day to another.
- You can drag and drop a block from your graph into the calendar: a new event, with the block reference to the original block, will be created on the corresponding day.
- Click on an event to edit or delete it.

### Tags

- Default tags are TODO, DONE, important, do date, due date, doing
- You can specify the correspoding page title for each of them (except for TODO & DONE), and add aliases.
- You can specify yout user defined tags.
- By clicking on a tag, you can change it's color.
- By double-clicking on a tag, it will be selected as the only filter tag.
- The selected tags' state (colors and chosen tags as filters) is retained from one session to another (in the browser's memory).

### Future developments

- Events with start and end time.
- Events spanning multiple days.
- Import from Google calendar.
- Filter content with any page title
- ...

---

### For any question or suggestion, DM me on **Twitter** and follow me to be informed of updates and new extensions : [@fbgallet](https://twitter.com/fbgallet).
