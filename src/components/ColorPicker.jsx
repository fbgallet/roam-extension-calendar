import { Button, MenuItem, Colors } from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";
import { useState } from "react";
import { mapOfTags } from "..";
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
  const [queryStr, setQueryStr] = useState("");
  const [selectedColor, setSelectedColor] = useState(
    COLORS_LIST.find((color) => color.value === tag.color) || tag.color
  );

  const handleColorSelect = (color) => {
    console.log(color);
    tag.setColor(color.value);
    setSelectedColor([color]);
    setTagsToDisplay((prev) => [...prev]);
    isDataToReload.current = true;
    localStorage.setItem(
      "fc-tags-info",
      JSON.stringify(
        mapOfTags.map((tag) => ({ name: tag.name, color: tag.color }))
      )
    );
  };

  const renderFilm = (color, { handleClick, modifiers }) => {
    if (!modifiers.matchesPredicate) return null;
    return (
      <MenuItem
        roleStructure="listoption"
        key={color.title}
        // icon={
        //   selectedColor.find((f) => f.title === color.title)
        //     ? "small-tick"
        //     : null
        // }
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

  const handleClear = () => {
    setSelectedColor([]);
  };

  const renderTag = (color) => color.title;

  const handleTagRemove = (title) => {
    const filmToRemove = selectedColor.filter((film) => color.title === title);
    handleColorSelect(filmToRemove[0]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "row", gap: "5px" }}>
      <Select
        items={COLORS_LIST}
        itemRenderer={renderFilm}
        noResults={<MenuItem disabled text="No results." />}
        onItemSelect={handleColorSelect}
        tagRenderer={renderTag}
        selectedItems={selectedColor}
        onClear={handleClear}
        query={queryStr}
        onQueryChange={(q) => {
          setQueryStr(q);
        }}
        tagInputProps={{
          onRemove: handleTagRemove,
          tagProps: {
            interactive: true,
            onClick: (e) => {
              e.stopPropagation();
            },
          },
        }}
        popoverProps={{ minimal: true }}
        itemPredicate={(query, item) => {
          if (!query.trim()) return true;
          return item.title.toLowerCase().includes(query.toLowerCase());
        }}
        createNewItemFromQuery={(query) => {
          return { rank: 0, title: query };
        }}
        createNewItemPosition={"last"}
        createNewItemRenderer={(query, active, handleClick) => (
          <MenuItem
            icon="add"
            text={`Create ${query}`}
            roleStructure="listoption"
            active={active}
            onClick={handleClick}
            shouldDismissPopover={false}
          />
        )}
      >
        <Button
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
          placeholder="Select a film"
        />
      </Select>
    </div>
  );
}

export default ColorPicker;
