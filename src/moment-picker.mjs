const pad = (n) => String(n).padStart(2, "0");
export const daysInMonth = (year, month) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();
export function clampDate(year, month, day) {
  return `${year}-${pad(month)}-${pad(Math.min(day, daysInMonth(year, month)))}`;
}
export function momentPickerMarkup() {
  return `<div class="date-picker" hidden><label>Дата<input type="date" name="pickDate" min="1900-01-01" max="2200-12-31" aria-label="Дата события"></label></div>`;
}
export const timePickerMarkup = () =>
  `<div class="time-picker" hidden><span class="time-picker-title">Время</span><input type="hidden" name="pickTime"><section class="time-editor" role="group" aria-label="Выбор времени"><div class="time-readout"><div><span>ВЫБРАНО</span><strong><i data-time-readout="hour">00</i><b>:</b><i data-time-readout="minute">00</i></strong></div><span class="time-period" data-time-period>ночь</span></div><div class="time-editor-heading"><span>ЧАС</span><span>00—23</span></div><div class="time-hour-grid" role="group" aria-label="Выбери час">${Array.from({ length: 24 }, (_, hour) => `<button type="button" data-time-hour="${pad(hour)}" aria-pressed="false">${pad(hour)}</button>`).join("")}</div><div class="time-editor-heading time-minute-heading"><span>МИНУТА</span><span data-time-minute-label>00</span></div><input class="time-minute-range" type="range" name="pickMinute" min="0" max="59" step="1" value="0" aria-label="Точная минута"><div class="time-minute-ticks"><span>00</span><span>15</span><span>30</span><span>45</span><span>59</span></div><div class="time-minute-shortcuts" role="group" aria-label="Частые минуты">${["00", "15", "30", "45"].map((minute) => `<button type="button" data-time-minute="${minute}" aria-pressed="false">${minute}</button>`).join("")}</div></section></div>`;
export function bindMomentPicker(form) {
  const el = form.elements;
  const sync = () => {
    el.pickDate.value = el.date.value;
    const [hour = "00", minute = "00"] = (el.time.value || "00:00").split(":");
    el.pickTime.value = `${hour}:${minute}`;
    el.pickMinute.value = String(Number(minute));
    form.querySelector('[data-time-readout="hour"]').textContent = hour;
    form.querySelector('[data-time-readout="minute"]').textContent = minute;
    form.querySelector("[data-time-minute-label]").textContent = minute;
    form.querySelector("[data-time-period]").textContent =
      Number(hour) < 5 ? "ночь" : Number(hour) < 12 ? "утро" : Number(hour) < 18 ? "день" : "вечер";
    form.querySelectorAll("[data-time-hour]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.timeHour === hour));
    });
    form.querySelectorAll("[data-time-minute]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.timeMinute === minute));
    });
  };
  el.pickDate.onchange = () => {
    if (!el.pickDate.value || !el.pickDate.validity.valid) return;
    el.date.value = el.pickDate.value;
    el.date.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const setTime = (hour, minute) => {
    el.time.value = `${pad(Number(hour))}:${pad(Number(minute))}`;
    el.time.dispatchEvent(new Event("change", { bubbles: true }));
    sync();
  };
  form.querySelectorAll("[data-time-hour]").forEach((button) => {
    button.onclick = () => setTime(button.dataset.timeHour, el.pickMinute.value);
  });
  form.querySelectorAll("[data-time-minute]").forEach((button) => {
    button.onclick = () => {
      const [hour] = el.pickTime.value.split(":");
      setTime(hour, button.dataset.timeMinute);
    };
  });
  el.pickMinute.oninput = () => {
    const [hour] = el.pickTime.value.split(":");
    setTime(hour, el.pickMinute.value);
  };
  sync();
  return sync;
}
