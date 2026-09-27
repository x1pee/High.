import { localizeUI } from "./i18n.mjs";
export function parseSignedInput(text, sign = 1) {
  const raw = text.trim().replaceAll("−", "-").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(raw))
    throw new Error(localizeUI("Введи число: не более двух знаков после запятой."));
  const magnitude = Math.abs(Number(raw));
  if (!Number.isFinite(magnitude) || magnitude > 10000000)
    throw new Error(localizeUI("Максимальный вес события — 10 000 000."));
  const nextSign =
    magnitude === 0
      ? 1
      : raw.startsWith("-")
        ? -1
        : raw.startsWith("+")
          ? 1
          : sign;
  return { value: magnitude === 0 ? 0 : nextSign * magnitude, sign: nextSign };
}
export function bindSignedInput(form, { onInvalidText } = {}) {
  const input = form.elements.delta;
  const editable = (text) => /^[+−-]?\d*(?:[.,]\d{0,2})?$/.test(text);
  let accepted = input.value;
  input.inputMode = "decimal";
  input.enterKeyHint = "done";

  // Let the event form hand off naturally when someone keeps typing after
  // finishing the numeric change, without eating valid decimal/sign input.
  if (typeof onInvalidText === "function")
    input.addEventListener("keydown", (e) => {
      if (
        e.defaultPrevented ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        e.key.length !== 1 ||
        /^[0-9+−.,-]$/.test(e.key)
      )
        return;
      e.preventDefault();
      onInvalidText(e.key);
    });

  input.addEventListener("beforeinput", (e) => {
    const inserted = e.data ?? e.dataTransfer?.getData("text/plain");
    if (!inserted || e.isComposing || !e.inputType.startsWith("insert")) return;
    const next =
      input.value.slice(0, input.selectionStart) +
      inserted +
      input.value.slice(input.selectionEnd);
    if (!editable(next)) {
      e.preventDefault();
      onInvalidText?.(inserted);
    }
  });
  let sign = Number(input.value) < 0 ? -1 : 1;
  const paint = () =>
    form
      .querySelectorAll("[data-delta-sign]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(Number(b.dataset.deltaSign) === sign),
        ),
      );
  const read = () => {
    // The editable text is the source of truth. Deleting '-' means positive.
    const parsed = parseSignedInput(input.value, 1);
    sign = parsed.sign;
    paint();
    return parsed.value;
  };
  const set = (n) => {
    sign = n < 0 || Object.is(n, -0) ? -1 : 1;
    input.value = Object.is(n, -0) ? "-0" : String(n);
    paint();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  input.value = String(Number(input.value));
  input.addEventListener("input", () => {
    if (!editable(input.value)) {
      input.value = accepted;
      return;
    }
    accepted = input.value;
    try {
      read();
      // Keep '-0' while editing: removing its sign turns a typed -0.2 into +0.2.
      if (/^[−-]/.test(input.value)) { sign = -1; paint(); }
    } catch {
      sign = /^[−-]/.test(input.value.trim()) ? -1 : 1;
      paint();
    }
  });
  for (const b of form.querySelectorAll("[data-delta-sign]"))
    b.onclick = () => {
      try {
        set(Math.abs(read()) * Number(b.dataset.deltaSign));
      } catch {
        sign = Number(b.dataset.deltaSign);
        input.value = sign < 0 ? "-" : "";
        accepted = input.value;
        paint();
      }
      input.focus();
    };
  input.addEventListener("keydown", (e) => {
    if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    try {
      set(Math.round((read() + (e.key === "ArrowUp" ? 1 : -1)) * 100) / 100);
    } catch {}
  });
  paint();
  return read;
}
