import { Checkbox, Tooltip } from "@blueprintjs/core";
import { useEffect } from "react";

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

  return (
    <div className="full-calendar-filters">
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
      <button onClick={switchFilters}>
        {Object.values(filters).some((filter) => !filter) ? "All" : "None"}
      </button>
    </div>
  );
};

export default Filters;