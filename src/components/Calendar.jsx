import FullCalendar from "@fullcalendar/react";
import interactionPlugin, { Draggable } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import {
  getBlocksToDisplayFromDNP,
  getCalendarUidFromPage,
  getMatchingTags,
  parseEventObject,
  removeSquareBrackets,
} from "../util/data";
import { useState, useEffect, useRef } from "react";
import Event from "./Event";
import Filters from "./Filters";
import MultiSelectFilter from "./MultiSelectFilter";
import {
  createChildBlock,
  deleteBlockIfNoChild,
  getBlockContentByUid,
  getBlocksUidReferencedInThisBlock,
  getFirstBlockUidByReferenceOnPage,
  getPageNameByPageUid,
  getParentBlock,
  hasChildrenBlocks,
  isExistingNode,
  resolveReferences,
} from "../util/roamApi";
import { roamDateRegex } from "../util/regex";
import EditEvent from "./EditEvent";
import NewEventDialog from "./NewEventDialog";
import { dateToISOString } from "../util/dates";
import { calendarTag, mapOfTags } from "..";

// let draggable = new Draggable(document.querySelector(".roam-app"), {
//   itemSelector: ".rm-bullet",
// });
let events = [];

const Calendar = ({ parentElt }) => {
  const [newEventDialogIsOpen, setNewEventDialogIsOpen] = useState(false);
  const [focusedPageUid, setFocusedPageUid] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  // const [events, setEvents] = useState([]);
  const [addedEvent, setAddedEvent] = useState(null);
  const [position, setPosition] = useState({ x: null, y: null });

  const [filterLogic, setFilterLogic] = useState("Or");
  const [tagsToDisplay, setTagsToDisplay] = useState(
    mapOfTags.filter((tag) => tag.isToDisplay)
  );
  const [isEntireDNP, setIsEntireDNP] = useState(false);
  const [isIncludingRefs, setIsIncludingRefs] = useState(true);
  const [isWEtoDisplay, setIsWEtoDisplay] = useState(true);
  const isDataToReload = useRef(true);
  // const events = useRef([]);

  useEffect(() => {
    if (events.length !== 0) isDataToReload.current = false;
    localStorage.setItem(
      "fc-tags-info",
      JSON.stringify(
        mapOfTags.map((tag) => ({
          name: tag.name,
          color: tag.color,
          isToDisplay: tag.isToDisplay,
        }))
      )
    );
  }, [tagsToDisplay]);

  useEffect(() => {
    isDataToReload.current = true;
  }, [isEntireDNP]);

  const handleSelectDays = (e) => {
    console.log("Day selected");
  };

  const handleSquareDayClick = async (info) => {
    const targetDnpUid = window.roamAlphaAPI.util.dateToPageUid(info.date);
    setSelectedDay((prev) => (prev === targetDnpUid ? null : targetDnpUid));
    if (info.jsEvent.shiftKey) {
      if (!isExistingNode(targetDnpUid)) {
        await window.roamAlphaAPI.data.page.create({
          page: {
            title: window.roamAlphaAPI.util.dateToPageTitle(info.date),
            uid: targetDnpUid,
          },
        });
      }
      window.roamAlphaAPI.ui.rightSidebar.addWindow({
        window: { type: "outline", "block-uid": targetDnpUid },
      });
    } else {
      if (selectedDay === targetDnpUid) {
        setPosition({ x: info.jsEvent.offsetX, y: info.jsEvent.offsetY });
        setFocusedPageUid(targetDnpUid);
        setNewEventDialogIsOpen(true);
      }
    }
  };

  const renderEventContent = (info) => {
    let title = info.event.title;
    let hasCheckbox = false;
    let isChecked;
    if (title.includes("{{[[TODO]]}}")) {
      hasCheckbox = true;
      isChecked = false;
      title = title.replace("{{[[TODO]]}}", "");
    } else if (title.includes("{{[[DONE]]}}")) {
      hasCheckbox = true;
      isChecked = true;
      title = title.replace("{{[[DONE]]}}", "");
    }
    // console.log(info.event);
    return (
      <Event
        displayTitle={title}
        event={info.event}
        timeText={info.timeText}
        hasCheckbox={hasCheckbox}
        isChecked={isChecked}
        backgroundColor={info.backgroundColor}
      ></Event>
    );
  };

  const renderDayContent = (info, elt) => {
    console.log("day:", info);
    // return <EditEvent />;
  };

  const getEventsFromDNP = async (info) => {
    if (isDataToReload.current) {
      events = getBlocksToDisplayFromDNP(
        info.start,
        info.end,
        !isEntireDNP,
        isIncludingRefs
      );
    } else isDataToReload.current = true;
    // if (!events.length) return [];
    console.log("filterLogic in Calendar :>> ", filterLogic);
    const eventsToDisplay =
      filterLogic === "Or"
        ? events.filter(
            (evt) =>
              !(
                evt.extendedProps?.eventTags[0].name === "DONE" &&
                !tagsToDisplay.some((tag) => tag.name === "DONE")
              ) && evt.extendedProps?.eventTags?.some((tag) => tag.isToDisplay)
          )
        : events.filter((evt) =>
            tagsToDisplay.every((tag) =>
              evt.extendedProps?.eventTags?.some((t) => t.name === tag.name)
            )
          );
    console.log("events to display:>> ", eventsToDisplay);

    return eventsToDisplay;
  };

  const handleEventDrop = async (info) => {
    const targetPageUid = window.roamAlphaAPI.util.dateToPageUid(
      info.event.start
    );
    if (info.event.extendedProps.isRef) {
      let blockContent = getBlockContentByUid(info.event.id);
      let matchingDates = blockContent.match(roamDateRegex);
      const newRoamDate = window.roamAlphaAPI.util.dateToPageTitle(
        info.event.start
      );
      if (matchingDates && matchingDates.length) {
        let currentDateStr = removeSquareBrackets(matchingDates[0]);
        blockContent = blockContent.replace(currentDateStr, newRoamDate);
      } else blockContent += ` [[${newRoamDate}]]`;
      window.roamAlphaAPI.updateBlock({
        block: { uid: info.event.id, string: blockContent },
      });
      info.event.setProp("title", resolveReferences(blockContent));
    } else {
      const currentCalendarUid = getParentBlock(info.event.id);
      let calendarBlockUid = await getCalendarUidFromPage(
        window.roamAlphaAPI.util.dateToPageTitle(info.event.start)
      );
      await window.roamAlphaAPI.moveBlock({
        location: {
          "parent-uid": calendarBlockUid,
          order: "last",
        },
        block: { uid: info.event.id },
      });
      deleteBlockIfNoChild(currentCalendarUid);
    }
  };

  const handleExternalDrop = async (e) => {
    e.preventDefault();
    const sourceUid = e.dataTransfer.getData("text");
    const blockContent = getBlockContentByUid(sourceUid);
    const blockRefs = getBlocksUidReferencedInThisBlock(sourceUid);
    const targetDateString = e.target.parentNode.dataset["date"];
    const targetDate = new Date(targetDateString);
    const date = dateToISOString(targetDate);
    const matchingTags = getMatchingTags(tagsToDisplay, blockRefs);
    let calendarBlockUid = await getCalendarUidFromPage(
      window.roamAlphaAPI.util.dateToPageTitle(targetDate)
    );
    await createChildBlock(calendarBlockUid, `((${sourceUid}))`);
    events.push(
      parseEventObject({
        id: sourceUid,
        title: blockContent,
        date: date,
        matchingTags: matchingTags,
      })
    );
    isDataToReload.current = false;
    setAddedEvent(sourceUid);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
      }}
      onDrop={handleExternalDrop}
    >
      <NewEventDialog
        newEventDialogIsOpen={newEventDialogIsOpen}
        setNewEventDialogIsOpen={setNewEventDialogIsOpen}
        pageUid={focusedPageUid}
        position={position}
        // setEvents={setEvents}
      />
      {/* <Filters filters={filters} setFilters={setFilters} /> */}
      <MultiSelectFilter
        tagsToDisplay={tagsToDisplay}
        setTagsToDisplay={setTagsToDisplay}
        isDataToReload={isDataToReload}
        filterLogic={filterLogic}
        setFilterLogic={setFilterLogic}
        isEntireDNP={isEntireDNP}
        setIsEntireDNP={setIsEntireDNP}
        isIncludingRefs={isIncludingRefs}
        setIsIncludingRefs={setIsIncludingRefs}
        isWEtoDisplay={isWEtoDisplay}
        setIsWEtoDisplay={setIsWEtoDisplay}
        parentElt={parentElt}
      />
      <FullCalendar
        plugins={[
          dayGridPlugin,
          timeGridPlugin,
          multiMonthPlugin,
          interactionPlugin,
        ]}
        initialDate={"2024-04-20"}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay",
        }}
        firstDay={1}
        weekends={isWEtoDisplay}
        fixedWeekCount={false}
        nowIndicator={true}
        slotMinTime="06:00"
        slotMaxTime="22:00"
        navLinks={true}
        editable={true}
        selectable={true}
        droppable={true}
        // draggable={true}
        dayMaxEvents={true}
        // initialEvents={getEventsFromDNP}
        events={getEventsFromDNP}
        // events={events}
        // events={[
        //   { title: "My First Event", date: "2024-04-06", editable: true },
        //   {
        //     title: "My second event",
        //     start: "2024-04-08T09:30:00",
        //     end: "2024-04-08T11:00:00",
        //     // start: "2024-04-08 11:00",
        //     // end: "11:00",
        //     display: "list-item",
        //     color: "red",
        //     // allDay: false,
        //   },
        // ]}
        // eventTimeFormat={{
        //   // like '14:30:00'
        //   hour: "2-digit",
        //   minute: "2-digit",
        //   meridiem: false,
        // }}
        eventContent={(info, jsEvent) => renderEventContent(info, jsEvent)}
        eventClick={(info) => {
          // console.log("Event: ", info.event);
          // console.log("JS: ", info.jsEvent);
          if (info.jsEvent.shiftKey) {
            window.roamAlphaAPI.ui.rightSidebar.addWindow({
              window: { type: "block", "block-uid": info.event.id },
            });
          }
        }}
        eventDrop={handleEventDrop}
        dateClick={handleSquareDayClick}
        select={handleSelectDays}
        dayHeaders={true}
        viewWillUnmount={() => (isDataToReload.current = true)}
        // dayCellContent={renderDayContent}
      />
    </div>
  );
};

export default Calendar;
