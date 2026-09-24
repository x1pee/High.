let owner = null;
let pointer = null;
export function hideHelp() {
  document.querySelector("#tool-tip")?.remove();
  owner?.removeAttribute("aria-describedby");
  owner = null;
}
export function setHelp(element, title, text) {
  if (!element) return;
  element.removeAttribute("title");
  element.dataset.tipTitle = title;
  element.dataset.tip = text;
  element.setAttribute("aria-label", title);
}
function showHelp(element) {
  hideHelp();
  if (!element || !element.isConnected) return;
  owner = element;
  const box = document.createElement("div");
  box.id = "tool-tip";
  box.className = "tool-tip";
  box.role = "tooltip";
  const title = document.createElement("strong"),
    text = document.createElement("span");
  title.textContent = element.dataset.tipTitle;
  text.textContent = element.dataset.tip;
  box.append(title, text);
  document.body.append(box);
  element.setAttribute("aria-describedby", box.id);
  const r = element.getBoundingClientRect(),
    b = box.getBoundingClientRect();
  let x = element.closest(".chart-rail") ? r.right + 12 : r.left;
  let y = element.closest(".chart-rail") ? r.top : r.top - b.height - 10;
  if (y < 8) y = r.bottom + 10;
  box.style.left = Math.max(8, Math.min(innerWidth - b.width - 8, x)) + "px";
  box.style.top = Math.max(8, Math.min(innerHeight - b.height - 8, y)) + "px";
}
document.addEventListener("pointerover", (e) => {
  pointer = { x: e.clientX, y: e.clientY };
  const target = e.target.closest("[data-tip]");
  if (target && target !== owner) showHelp(target);
});
document.addEventListener("pointermove", (e) => {
  pointer = { x: e.clientX, y: e.clientY };
  const target = e.target.closest("[data-tip]");
  if (target && target !== owner) showHelp(target);
});
document.addEventListener("pointerout", (e) => {
  if (owner && !owner.contains(e.relatedTarget)) hideHelp();
});
document.addEventListener("focusin", (e) =>
  showHelp(e.target.closest("[data-tip]")),
);
document.addEventListener("focusout", hideHelp);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideHelp();
});
document.addEventListener("pointerdown", hideHelp);
document.addEventListener("scroll", () => {
  const target = pointer && document.elementFromPoint(pointer.x, pointer.y)?.closest("[data-tip]");
  if (target) showHelp(target);
  else hideHelp();
}, true);
window.addEventListener("resize", hideHelp);
