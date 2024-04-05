var runners = {
  menuItems: [],
  observers: [],
};
export var refs = [];
// export var counters = [];

export function connectObservers(logPage = null) {
  if (autocompleteCount || isOn)
    addObserver(
      document.getElementsByClassName("roam-app")[0],
      onBlockUpdate,
      {
        childList: true,
        subtree: true,
      },
      "tags"
    );
  if (isOn)
    addObserver(
      document.getElementById("right-sidebar"),
      onSidebarOpen,
      {
        childList: true,
        subtree: false,
      },
      "sidebar"
    );
  if (logPage) {
    addObserver(
      document.getElementsByClassName("roam-log-container")[0],
      onNewPageInDailyLog,
      {
        childList: true,
        subtree: false,
      },
      "logs"
    );
  }
}

function addObserver(element, callback, options, name) {
  let myObserver = new MutationObserver(callback);
  myObserver.observe(element, options);

  runners[name] = [myObserver];
}
export function disconnectObserver(name) {
  if (runners[name])
    for (let index = 0; index < runners[name].length; index++) {
      const element = runners[name][index];
      element.disconnect();
    }
}

function onSidebarOpen(mutation) {
  setTimeout(() => {
    for (let i = 0; i < mutation.length; i++) {
      if (mutation[i].addedNodes.length > 0) {
        if (
          mutation[i].addedNodes[0].className != "rm-resize-handle" &&
          mutation[i].addedNodes[0].id === "roam-right-sidebar-content" &&
          mutation[i].addedNodes[0].innerText !=
            "Shift-click bidirectional links, blocks, or block references to open them here."
        ) {
          insertSupAfterRefs(mutation[i].target);
          return;
        }
      }
    }
  }, 50);
}

function onNewPageInDailyLog(mutation) {
  setTimeout(() => {
    insertSupAfterRefs();
  }, 50);
}

function onBlockUpdate(mutation) {
  if (isOn) {
    if (
      (mutation[0].target.closest(".roam-sidebar-container") &&
        mutation[0].target.className === "ref-count-extension") ||
      // mutations in code block
      mutation[0].target.className.includes("cm-")
    )
      return;
    //console.log(mutation);
    for (let i = 0; i < mutation.length; i++) {
      if (
        mutation[i].addedNodes.length > 0 &&
        mutation[i].target.localName != "span" &&
        mutation[i].target.localName != "textarea"
      ) {
        if (mutation[0].addedNodes[0]?.classList?.contains("rm-block")) {
          // console.log("blocks expanded");
          // console.log(mutation);
          // insertSupAfterRefs(mutation[0].target);
          // .target contains all children blocks, no need to process all mutations.addedNodes
          insertSupAfterRefs(mutation[i].addedNodes[0]);
          return;
        } else if (
          mutation[i].addedNodes[0]?.classList?.contains("rm-block__input")
        ) {
          // console.log("block updated");
          // insertSupAfterRefs(mutation[i].target);
          //return;
        } else if (
          mutation[i].addedNodes[0]?.classList?.contains("rm-mentions") ||
          mutation[i].addedNodes[0]?.parentElement?.className ===
            "rm-ref-page-view"
        ) {
          // console.log("In Linked refs");
          // insertSupAfterRefs(mutation[i].target);
          /*let elt = mutation[i].target.querySelectorAll(
            ".roam-block-container"
          );
          elt.forEach((node) => {
            // insertSupAfterRefs(node);
          });
          return;*/
        } else if (
          //console.log("In right sidebar");
          mutation[i].addedNodes[0]?.parentElement?.className ===
          "sidebar-content"
        ) {
          // insertSupAfterRefs(mutation[i].addedNodes[0]);
          return;
        } else if (mutation[i].target.className === "rm-sidebar-window") {
          // insertSupAfterRefs(mutation[i].target);
          return;
        }
      }
    }
  }
}

export function addListeners() {
  window.addEventListener("popstate", onPageLoad);
}

export function removeListeners() {
  window.removeEventListener("popstate", onPageLoad);
}

export function onPageLoad(e) {
  disconnectObserver("tags");
  disconnectObserver("sidebar");
  disconnectObserver("logs");
  refs.length = 0;
  setTimeout(() => {
    // insertSupAfterRefs();
  }, 50);
  setTimeout(() => {
    let logPage = document.querySelector(".roam-log-container");
    connectObservers(logPage);
  }, 500);
}
