import { Checkbox, Tooltip } from "@blueprintjs/core";
import { useState } from "react";

const Filters = ({ filters, setFilters }) => {
  console.log("filters :>> ", filters);

  const handleCheck = (filter) => {
    setFilters((prev) => {
      const clone = { ...prev };
      clone[filter] = !clone[filter];
      return clone;
    });
  };

  return (
    <div className="full-calendar-filters">
      <Checkbox checked={filters.TODO} onChange={() => handleCheck("TODO")}>
        TODO
      </Checkbox>
      <Checkbox checked={filters.DONE} onChange={() => handleCheck("DONE")}>
        DONE
      </Checkbox>
    </div>
  );
};

export default Filters;
