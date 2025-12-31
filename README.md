# Full Calendar

### A comprehensive calendar interface, supporting Google Calendar two-way sync, to handle your tasks and have an overview of events or any tagged content in your Daily Note Pages or Google Calendars.

🆕 New in v.6 (January 2026):

- Complete support of **Google calendar** import, export or two-way sync (see [section below](https://github.com/fbgallet/roam-extension-calendar?tab=readme-ov-file#google-calendar-support) for detailed instructions)
- a lot of fixes

See [changelog here for more details on updates and fixes](https://github.com/fbgallet/roam-extension-calendar/blob/main/CHANGELOG.md)

![Demo FC](https://github.com/user-attachments/assets/58b75071-def5-48f2-83fc-e9e9384a24ff)

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

By default, the events and tasks displayed in the calendar are the first children block of `#calendar` block (nb: only its first mention is taken into account), in each Daily Notes Pages (DNP). This calendar tag can be customized. If you have connected your Google calendar account (see [section below](https://github.com/fbgallet/roam-extension-calendar?tab=readme-ov-file#google-calendar-support)), the events of your selected calendar will also appear with a Google calendar icon, and two-way synced events with a sync icon. You can also connect your Google Task lists.

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

If the block contains a timestamp, the corresponding event will automatically have a start time and, by default, one-hour duration. A timestamp can be in 24h or 12h format (🆕 new in v.5), e.g. `14:00`, `14h`, `9:05`, `9:5`, `9h05`, `2:00pm`, `2pm`, `9:05 PM`, etc. (only `:` and `h` are supported as separator between hours and minutes).

To define a duration you can:

- add another timestamp with `-` serator, to define a range. E.g.: `14:00 - 15:30`
- add a duration in minutes or hours, in the following format: `90m`, `2h`.The duration has to be placed after the timestamp in the block.

In the settings, you can change how timestamps are displayed in the calendar and inserted in blocks.

## Events with date attributes

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

## Google Calendar support

By connecting a Google account to Full Calendar (see configuration below), you can:

- **view all events from multiple Google calendars** in Full Calendar, with access to rich description, location, attendees and file attachments, including recurring events,
- **sync on demand** any event Google calendar event to your Roam graph. It's a two-way sync for event title, status and of course date and time. Description, attendees, location and attachments will be imported as children blocks (but not synced),
- **create new event** and sync the corresponding block with a Google calendar or create it only on Google calendar side (no Roam block) and display it as non-synced event in Full Calendar

#### Choose to sync or export to a Google calendar when creating a new event:

<img width="350" height="210" alt="image" src="https://github.com/user-attachments/assets/5f1bb77a-20ac-4161-bd0e-fe76c1509163" />

#### Example of Google calendar event (not synced):

<img width="348" height="310" alt="image" src="https://github.com/user-attachments/assets/96c22308-d7c3-473a-8219-f3d45e4e0b85" />

#### Exemple of synced event (directly editable in Roam):

<img width="360" height="475" alt="image" src="https://github.com/user-attachments/assets/6fc50a15-0962-4639-9bc0-febbddd9c181" />

Thanks to this integration, you can create events on your smartphone with the calendar app of your choice and see or update them in Roam, while benefiting from Google Calendar's reminder features. Or you can quickly create events in Roam and sync them instantly with your other calendar app on mobile or any device!

Any event created in Full Calendar can be easily synced with a given Google Calendar. Or you can use command palette or block context menu command `Full Calendar: Sync to default Google calendar" to sync any block, provided that it is on a daily note or mentions one, or that it mentions a start and/or end in its child blocks.

You have also basic control on events displayed from Google Calendar but not imported/sync to Roam. You can:

- move/expand them to change their date/time
- check/uncheck them if they include `[ ] / [x]` or `[[TODO]] / [[DONE]]` at the beginning of their title,
- delete them (with confirmation dialog)

The current month and any subsequent month that has been viewed are stored in cache (browser local storage) for instant display and for offline display. A warning message will be displayed in the event popover when you are offline (since the Google calendar event is possibily not up-to-date).

NB: synced events are automatically unsynced when they are older than 90 days, unless they contain a TODO

### Configuration

Connect a Google account by opening the Google Calendar configuration dialog in the Full calendar settings or by clicking on the "Google Calendar" tag in the filter bar, and click the gear icon, then "Connect". A popup window should open, prompting you to choose your Google account (if it doesn't open, popup blocking is enabled in your browser; an icon should appear in the address bar to grant your browser permission). Full Calendar's privacy policy is detailed [here](https://www.the-thought-experimenter.com/roam-extensions/full-calendar/privacy) and the code of the backend is open source (see [here](https://github.com/fbgallet/roam-calendar--auth-backend)). No personal data is stored on a remote server, only a token is used for automatic reconnexion and encrypted to be stored locally. Your event data is only temporarily saved in the browser's local storage to ensure faster display (you can clean cache on demand in the Google Calendar settings dialog).

If the connection was successful, it will show "✅ Connected to google" at the top of the dialog box. And in the calendar filter bar a green dot 🟢 will be displayed. The dot will be red 🔴 in case of disconnection (or when you are offline, for example). It can be sometimes necessary to reconnect your Google account if the connection token has expired.

Once connected, the list of your calendars appears. Select a default calendar and customize the tags and aliases. The first tag will be automatically inserted into a block that you synchronize or will trigger synchronization if you insert it yourself. By default, an enabled calendar can be synced both way, but you can limit to only import (view only its events, not synced to any block) or export (create a new events on this calendar, but never sync it with any block.

A calendar can be used as a "separate" tag (from the main Google calendar tag) to facilitate selective display or sorting or to assign it a specific color. By default, all calendars will be linked to the Google calendar tag

You can use calendar colors as they are defined in Google calendar (with a wide palette) or use the more limited palette specific to Full Calendar.

You can choose the default format for checkboxes in Google Calendar events: in other words, how `{{[[TODO]]}}` and `{{[[DONE]]}}` will appear (and how they can be manually set or updated from a Google calendar event). Either in standard Markdown format `[ ] / [x]`, or in Roam page format without the curly braces: `[[TODO]] / DONE`.

## If you want to support my work

If you want to encourage me to develop further and enhance Full Calendar extension, you can [buy me a coffee ☕ here](https://buymeacoffee.com/fbgallet) or [sponsor me on Github](https://github.com/sponsors/fbgallet). Thanks in advance for your support! 🙏

For any question or suggestion, DM me on **X/Twitter** and follow me to be informed of updates and new extensions : [@fbgallet](https://x.com/fbgallet), or on Bluesky: [@fbgallet.bsky.social](https://bsky.app/profile/fbgallet.bsky.social)

Please report any issue [here](https://github.com/fbgallet/roam-extension-calendar/issues).
