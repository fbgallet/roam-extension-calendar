import { Checkbox, Tooltip } from "@blueprintjs/core";
import { useState, useEffect } from "react";

const Filters = ({ filters, setFilters }) => {
  // useEffect(() => {
  //   console.log("filter changed");
  // }, []);

  const handleCheck = (filter) => {
    setFilters((prev) => {
      const clone = { ...prev };
      clone[filter] = !clone[filter];
      return clone;
    });
  };

  const switchFilters = () => {
    const switchTo = Object.values(filters).some((filter) => !filter)
      ? true
      : false;
    setFilters((prev) => {
      const clone = { ...prev };
      for (let key in clone) {
        clone[key] = switchTo;
      }
      console.log("clone :>> ", clone);
      return clone;
    });
  };

  const handleSticky = () => {
    const calendarElt = document.querySelector(".full-calendar-comp");
    calendarElt.classList.add("fc-sticky");
  };

  return (
    <div className="fc-filters">
      <b>Filter events: </b>
      <Checkbox checked={filters.TODO} onChange={() => handleCheck("TODO")}>
        TODO
      </Checkbox>
      <Checkbox checked={filters.DONE} onChange={() => handleCheck("DONE")}>
        DONE
      </Checkbox>
      <Checkbox
        checked={filters.important}
        onChange={() => handleCheck("important")}
      >
        Important
      </Checkbox>
      <Checkbox checked={filters.due} onChange={() => handleCheck("due")}>
        Due date
      </Checkbox>
      <Checkbox checked={filters.do} onChange={() => handleCheck("do")}>
        Do date
      </Checkbox>
      <button onClick={switchFilters}>
        {Object.values(filters).some((filter) => !filter) ? "All" : "None"}
      </button>
      <button onClick={handleSticky}>📌</button>
      {/* <button onClick={() => setPopoverIsOpen((prev) => !prev)}>Open</button>
      <EditEvent popoverIsOpen={popoverIsOpen} /> */}
    </div>
  );
};

export default Filters;
