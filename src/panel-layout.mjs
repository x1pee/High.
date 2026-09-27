import { localizeUI } from "./i18n.mjs";
const KEY = "vyshe-panel-layout";
let sideWidth = 310;
let height = 220,
  above = false;
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (Number.isFinite(saved?.height))
    height = Math.max(130, Math.min(420, saved.height));
  above = saved?.above === true;
  if (Number.isFinite(saved?.sideWidth))
    sideWidth = Math.max(240, Math.min(520, saved.sideWidth));
} catch {}
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ height, above, sideWidth }));
  } catch {}
};

export function bindPanelLayout() {
  const workspace = document.querySelector(".workspace");
  const separator = document.querySelector("#panel-resizer");
  const side = document.querySelector("#side-resizer");
  const toggle = document.querySelector("#ledger-position");
  if (!workspace || !separator || !toggle) return;
  let drag = null;
  const maximum = () =>
    Math.max(130, Math.min(420, workspace.clientHeight - 365));
  const maxWidth = () =>
    Math.max(240, Math.min(520, workspace.clientWidth - 540));
  const apply = () => {
    const actual = Math.min(height, maximum());
    workspace.classList.toggle("activity-above", above);
    workspace.style.setProperty("--activity-height", actual + "px");
    workspace.style.setProperty(
      "--day-width",
      Math.min(sideWidth, maxWidth()) + "px",
    );
    side?.setAttribute(
      "aria-valuenow",
      Math.round(Math.min(sideWidth, maxWidth())),
    );
    side?.setAttribute("aria-valuemin", "240");
    side?.setAttribute("aria-valuemax", Math.round(maxWidth()));
    separator.setAttribute("aria-valuenow", Math.round(actual));
    separator.setAttribute("aria-valuemin", "130");
    separator.setAttribute("aria-valuemax", Math.round(maximum()));
    toggle.textContent = above ? localizeUI("↓ Снизу") : localizeUI("↑ Сверху");
    toggle.setAttribute(
      "aria-label",
      above ? localizeUI("Переместить ленту под график") : localizeUI("Переместить ленту над графиком"),
    );
  };
  apply();
  const observer = new ResizeObserver(apply);
  observer.observe(workspace);
  toggle.onclick = () => {
    above = !above;
    save();
    apply();
  };
  for (const handle of [separator, side].filter(Boolean)) {
    handle.onpointerdown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      drag = {
        x: e.clientX,
        y: e.clientY,
        height: Math.min(height, maximum()),
        width: Math.min(sideWidth, maxWidth()),
        vertical: handle === separator,
        horizontal: handle === side || e.target.id === "panel-corner",
      };
      handle.setPointerCapture(e.pointerId);
    };
    handle.onpointermove = (e) => {
      if (!drag) return;
      if (drag.vertical)
        height = Math.max(
          130,
          Math.min(
            maximum(),
            drag.height + (above ? 1 : -1) * (e.clientY - drag.y),
          ),
        );
      if (drag.horizontal)
        sideWidth = Math.max(
          240,
          Math.min(maxWidth(), drag.width - (e.clientX - drag.x)),
        );
      apply();
    };
    handle.onpointerup = () => {
      drag = null;
      save();
    };
    handle.onpointercancel = handle.onlostpointercapture = () => {
      drag = null;
    };
  }
  if (side) {
    side.ondblclick = () => {
      sideWidth = 310;
      save();
      apply();
    };
    side.onkeydown = (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) return;
      e.preventDefault();
      sideWidth =
        e.key === "Home"
          ? 310
          : Math.max(
              240,
              Math.min(
                maxWidth(),
                sideWidth + (e.key === "ArrowLeft" ? 20 : -20),
              ),
            );
      save();
      apply();
    };
  }
  separator.ondblclick = () => {
    height = 220;
    sideWidth = 310;
    save();
    apply();
  };
  separator.onkeydown = (e) => {
    if (!["ArrowUp", "ArrowDown", "Home"].includes(e.key)) return;
    e.preventDefault();
    height =
      e.key === "Home"
        ? 220
        : Math.max(
            130,
            Math.min(
              maximum(),
              height + (e.key === "ArrowUp" ? -20 : 20) * (above ? 1 : -1),
            ),
          );
    save();
    apply();
  };
  return () => observer.disconnect();
}
