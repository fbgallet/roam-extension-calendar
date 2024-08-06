## v.4 (August 6th, 2024) Multi-day events

### Updates

- **multi-day events**, fully supported
- better support of direct children informations (tags + dates)
- user tags can now have aliases and be deleted
- temporary tags can be added to permanent user tags
- a timestamp is automatically inserted when creating an event in a timegrid view
- option to display subtasks as distinct events
- option to sort events in alphanumeric order or according to blocks order

### Fixes

- **important**: changing `#calendar` tag in the settings was not properly taken into account
- resizing an event in week or day view was not properly updating the timestamp in the block (since v.3)
- the filter bar no longer worked after clicking on "not tagged"
- events consisting of a single block ref or embed are displayed as block ref or embed in the event popover

## v.3 (July 18th, 2024) IMPORTANT fixes

### Fixes

- MAJOR FIX: creating a new event (or dragging one) on a DNP not yet existing was not creating DNP properly (see Roam Slack #general channel for infos)
- support CJK text in user defined tags in settings
- pinned calendar background was transparent in vanilla Roam theme
- queries (mistakenly taken for events) are now being ignored
- other small fixes

### Updates

- support multiple days events (not fully documented yet)
- informations (tags, dates) in the direct children of an event are taken into account
- handle events consisting of a single block reference or an embed

## v.2 (June 15th, 2024) small fixes

- fixed an issue with checkboxes in events
