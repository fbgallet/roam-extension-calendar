import { Button, MenuItem, Colors } from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";
import { useState } from "react";
import { extensionStorage, mapOfTags } from "..";
const COLORS_LIST = [
  { title: "light Red", value: Colors.RED5 },
  { title: "medium Red", value: Colors.RED3 },
  { title: "dark Red", value: Colors.RED1 },
  { title: "light Blue", value: Colors.BLUE5 },
  { title: "medium Blue", value: Colors.BLUE3 },
  { title: "dark Blue", value: Colors.BLUE1 },
  { title: "light Green", value: Colors.GREEN5 },
  { title: "medium Green", value: Colors.GREEN3 },
  { title: "dark Green", value: Colors.GREEN1 },
  { title: "light Orange", value: Colors.ORANGE5 },
  { title: "medium Orange", value: Colors.ORANGE3 },
  { title: "dark Orange", value: Colors.ORANGE1 },
  { title: "light Violet", value: Colors.VIOLET5 },
  { title: "medium Violet", value: Colors.VIOLET3 },
  { title: "dark Violet", value: Colors.VIOLET1 },
  { title: "light Gray", value: Colors.GRAY5 },
  { title: "medium Gray", value: Colors.GRAY3 },
  { title: "dark Gray", value: Colors.GRAY1 },
];

function ColorPicker({ tag, setTagsToDisplay, isDataToReload }) {
  const [selectedColor, setSelectedColor] = useState(
    COLORS_LIST.find((color) => color.value === tag.color) || tag.color
  );

  const handleColorSelect = (color) => {
    tag.setColor(color.value);
    setSelectedColor([color]);
    setTagsToDisplay((prev) => [...prev]);
    isDataToReload.current = true;
    extensionStorage.set(
      "fc-tags-info",
      JSON.stringify(
        mapOfTags.map((tag) => ({
          name: tag.name,
          color: tag.color,
          isToDisplay: tag.isToDisplay,
          isToDisplayInSb: tag.isToDisplayInSb,
        }))
      )
    );
  };

  const renderColor = (color, { handleClick, modifiers }) => {
    if (!modifiers.matchesPredicate) return null;
    return (
      <MenuItem
        roleStructure="listoption"
        key={color.title}
        text={`${color.title}`}
        onClick={handleClick}
        active={modifiers.active}
        labelElement={
          <div
            style={{ background: color.value, width: "1.5em", height: "1.5em" }}
          ></div>
        }
      />
    );
  };

  const renderTag = (color, a, b, c) => {
    console.log(a, b, c);
    return color.title;
  };

  return (
    <div style={{ display: "flex", flexDirection: "row", gap: "5px" }}>
      <Select
        items={COLORS_LIST}
        itemRenderer={renderColor}
        noResults={<MenuItem disabled text="No matching color" />}
        onItemSelect={handleColorSelect}
        tagRenderer={renderTag}
        selectedItems={selectedColor}
        menuProps={{
          small: true,
        }}
        inputProps={{
          small: true,
        }}
        popoverProps={{ minimal: true }}
        itemPredicate={(query, item) => {
          if (!query.trim()) return true;
          return item.title.toLowerCase().includes(query.toLowerCase());
        }}
      >
        <Button
          minimal={true}
          text={
            selectedColor?.title ? (
              <div style={{ display: "flex", gap: "10px" }}>
                <div>{selectedColor.title}</div>
                <div
                  style={{
                    background: selectedColor.value,
                    width: "1.5em",
                    height: "1.5em",
                  }}
                ></div>
              </div>
            ) : (
              "Color"
            )
          }
          rightIcon="double-caret-vertical"
          placeholder="Select a color"
        />
      </Select>
    </div>
  );
}

export default ColorPicker;
