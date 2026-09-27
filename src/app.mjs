import { welcomeEntrance } from "./welcome-animation.mjs";
import { visibleSummary, rangePeriod, visibleTurnover } from './market-summary.mjs';
import { periodBounds, shiftPeriodAnchor, summarizePeriod } from "./period-summary.mjs";
import { chartVolume, eventVolume, volumeTone } from "./chart-volume.mjs";
import { appendFutureBars } from "./chart-future.mjs";
import { chooseQuickMove, recentQuickMove } from "./quick-moves.mjs";
import {
  getVolumePanelHeight,
  resetVolumePanelHeight,
  saveVolumePanelHeight,
  setVolumePanelHeight,
  volumePanelBounds,
} from "./volume-layout.mjs";
import { animateEventChart } from "./event-animation.mjs";
import {
  createStarter,
  starterChoice,
  starterBars,
  STARTER_CANDLE_MINUTES,
} from "./starter.mjs";
import {
  momentPickerMarkup,
  timePickerMarkup,
  bindMomentPicker,
} from "./moment-picker.mjs";
import { assertPriceChange } from "./price-policy.mjs";
import { coinSvg, coinEditor, bindCoinEditor } from "./coin.mjs";
import { bindSignedInput } from "./signed-input.mjs";
import { nextChartPhrase } from "./chart-phrases.mjs";
import { nextDayExample, nextDayPrompt } from "./day-examples.mjs";
import { momentRun } from "./chart-context.mjs";
import { bindPanelLayout } from "./panel-layout.mjs";
import {
  CHART_STYLES,
  heikinAshi,
  hitCandle,
  candlePriceRange,
  chartIndexAtTime,
  chartTimeAtIndex,
  scalePriceRange,
  shiftPriceRange,
} from "./chart-view.mjs";
import { setHelp, hideHelp } from "./tool-help.mjs";
import {
  createJournal,
  validateJournal,
  calculate,
  localDate,
  localTime,
  compareEvents,
  shiftDate,
  round,
  percentage,
  upsertEvent,
  upsertDay,
  demoJournal,
} from "./domain.mjs";
import {
  EVENT_EXAMPLES,
  EXAMPLE_CATEGORIES,
  findExamples,
  shuffledExamples,
  entryCopy,
} from "./event-examples.mjs";
import { calendarBars, periodStart, TIMEFRAMES } from "./calendar-bars.mjs";
import { minuteOf, clockLabel } from "./intraday.mjs";
import {
  timeline,
  minuteAt,
  dateAt,
  DEFAULT_BARS,
  MAX_BARS,
  candleTitle,
  movingAverage,
} from "./timeline.mjs";
import {
  THEME_PRESETS,
  COLOR_KEYS,
  themeTokens,
  contrastRatio,
} from "./themes.mjs";
import {
  createSyncClient,
  syncAction,
  assertSyncTarget,
  getSyncMarker,
  loadSyncCredentials,
  parseSyncCredentials,
  saveSyncCredentials,
  setSyncMarker,
} from "./sync-client.mjs";
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (n) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
const signed = (n) =>
  (round(n) > 0 ? "+" : round(n) < 0 ? "−" : "") + fmt(Math.abs(n));
const pct = (n) => (n === null ? "—" : signed(n) + "%");
const direction = (n) => (n > 0 ? "positive" : n < 0 ? "negative" : "neutral");
const fullDate = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).replace(/ г\.$/u, "\u00a0г.");
const shortDate = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    {
      plus: '<path d="M12 5v14M5 12h14"/>',
      chart:
        '<path d="M5 11v9m0-6h0M12 4v14M19 2v11"/><path d="M3 13h4v4H3zm7-6h4v7h-4zm7-3h4v5h-4z"/>',
      book: '<path d="M4 3h13a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm0 14h16M8 7h7M8 11h5"/>',
      settings:
        '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--surface)"/><circle cx="15" cy="17" r="3" fill="var(--surface)"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
      moon: '<path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10z"/>',
      arrow: '<path d="M5 16 16 5M6 5h10v10"/>',
      left: '<path d="m14 6-6 6 6 6"/>',
      right: '<path d="m10 6 6 6-6 6"/>',
      edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-4-4L5 15z"/>',
      trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
      download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
      upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',
      lock: '<rect x="6" y="10" width="12" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      folder: '<path d="M3 6h7l2 3h9v11H3z"/>',
      minus: '<path d="M5 12h14"/>',
      spark:
        '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
      up: '<path d="m6 14 6-6 6 6"/>',
      down: '<path d="m6 10 6 6 6-6"/>',
      "market-up": '<path d="M3 18h3v3H3zm5-5h3v8H8zm5-4h3v12h-3z" fill="currentColor" stroke="none"/><path d="m4 12 5-5 4 2 6-6m-5 0h5v5"/>',
      "market-down": '<path d="M3 3h3v18H3zm5 5h3v13H8zm5 5h3v8h-3z" fill="currentColor" stroke="none"/><path d="m4 7 5 5 4-2 6 6m-5 0h5v-5"/>',
    }[name] || ""
  }</svg>`;
let pendingEventAnimation = null;
let animationFrame = null;
let wheelFrame = null;
let wheelDelta = 0;
let wheelPan = false;
let priceWheelFrame = null;
let priceWheelDelta = 0;
let priceWheelAnchor = 0.5;
let wheelRemainder = 0;
let wheelLastDraw = 0;
let journal = null,
  personal = null,
  demo = false,
  blocked = false,
  busy = false,
  view = "chart",
  span = 45,
  end = localDate(),
  selected = localDate(),
  hover = null,
  hoverCardSide = null,
  lastChartPointerX = null,
  pinned = false,
  readingCard = false,
  candles = [],
  visible = [],
  chartObserver,
  hoverTimer,
  toastTimer,
  drag = null,
  dragFrame = null,
  priceDrag = null,
  priceDragFrame = null,
  pendingImport = null;
let interval = 1440,
  intradayCount = 168 * 60,
  intradayEnd = null;
const noteDrafts = new Map();
const noteSelection = new Map();
const noteDay = () => noteSelection.get(journal?.id) ?? localDate();
function chooseDay(date) {
  selected = date;
  noteSelection.set(journal.id, date);
  refreshNoteHelp();
}
let visualBars = [],
  averageValues = [];
let averageLength = 14;
let averagePeriods = [14];
let disposePanelLayout;
let autoRange = true;
let autoLayout = true;
let manualPriceRange = null;
let groupMoments = true;
try {
  groupMoments = localStorage.getItem("vyshe-moment-selection") !== "single";
} catch {}
let observations = [];
const toolHistory = new Map();
function rememberTools() {
  const history = toolHistory.get(journal.id) ?? [];
  history.push({ items: structuredClone(drawings()), magnet, hideDrawings });
  if (history.length > 100) history.shift();
  toolHistory.set(journal.id, history);
}
function undoToolAction() {
  if (drawStart) {
    drawStart = null;
    drawChart();
    return;
  }
  const state = toolHistory.get(journal.id)?.pop();
  if (!state) return;
  chartDrawings.set(journal.id, state.items);
  magnet = state.magnet;
  hideDrawings = state.hideDrawings;
  drawTool = null;
  render();
}
const averageColors = {
  7: "var(--ma-7)",
  14: "var(--ma-14)",
  28: "var(--ma-28)",
};
try {
  const stored = Number(localStorage.getItem("vyshe-average-length"));
  if ([7, 14, 28].includes(stored)) averageLength = stored;
  const periods = JSON.parse(localStorage.getItem("vyshe-average-periods"));
  averagePeriods = Array.isArray(periods)
    ? [...new Set(periods.filter((n) => [7, 14, 28].includes(n)))]
    : [averageLength];
  if (!averagePeriods.length) averagePeriods = [averageLength];
} catch {}

const chartDrawings = new Map();
let drawTool = null,
  drawStart = null,
  magnet = true,
  hideDrawings = false;
const drawings = () => {
  if (!chartDrawings.has(journal.id)) chartDrawings.set(journal.id, []);
  return chartDrawings.get(journal.id);
};
const barTime = (c) => c.to ?? minuteAt(c.endDate ?? c.date, 1440);

let showAverage = false,
  showBase = false,
  percentAxis = false,
  measuring = false,
  measureStart = null,
  measureEnd = null;
const nowMinute = () => minuteAt(localDate(), minuteOf(localTime()) + 1);
const chartHorizon = () =>
  observations.reduce((end, e) => Math.max(end, e.at + 1), nowMinute());
const axisText = (n) =>
  percentAxis
    ? pct(percentage(n - journal.settings.initial, journal.settings.initial))
    : fmt(n);
function resetViewport() {
  autoRange = true;
  autoLayout = true;
  manualPriceRange = null;
  intradayEnd = null;
  measuring = false;
  intradayCount = (DEFAULT_BARS[interval] ?? 90) * interval;
  span =
    interval > 1440
      ? Math.max(
          Math.ceil((interval / 1440) * 8),
          Math.min(
            3650,
            daysBetween(candles[0]?.date ?? localDate(), localDate()) + 1,
          ),
        )
      : (journal?.settings.chartDensity ?? 45);
  end = localDate();
  drawStart = null;
  drawTool = null;
  measureStart = measureEnd = null;
}
if (!window.desktop && window.__TAURI__) await import("./tauri-bridge.mjs");
if (!window.desktop) await import("./mobile-bridge.mjs");
const api = window.desktop;
const syncClient = createSyncClient({ validate: validateJournal });
const startDraft = {
  name: "LIFEUSDT",
  initial: "100",
  theme: "dark",
  appearance: { palette: "amber", chartColors: "classic" },
};
try {
  const saved = JSON.parse(localStorage.getItem("vyshe-last-appearance"));
  if (saved && ["dark", "light", "system"].includes(saved.theme)) {
    themeTokens(saved, false);
    Object.assign(startDraft, saved);
  }
} catch {}
let previewSettings = null;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 5000);
}
function theme() {
  const settings = previewSettings ?? journal?.settings ?? startDraft;
  if (!previewSettings && !demo) {
    const appearance = { theme: settings.theme, appearance: structuredClone(settings.appearance), reducedMotion: !!settings.reducedMotion };
    Object.assign(startDraft, appearance);
    try { localStorage.setItem("vyshe-last-appearance", JSON.stringify(appearance)); } catch {}
  }
  const { mode, tokens } = themeTokens(
    settings,
    matchMedia("(prefers-color-scheme: dark)").matches,
  );
  document.documentElement.dataset.theme = mode;
  for (const [key, value] of Object.entries(tokens))
    document.documentElement.style.setProperty("--" + key, value);
  document.documentElement.classList.toggle(
    "reduce-motion",
    !!settings.reducedMotion,
  );
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", theme);
function clearFocus() {
  readingCard = false;
  if ($("#selection-status"))
    $("#selection-status").textContent =
      "Наведись на свечу · объём = сумма изменений по модулю";
  hover = null;
  hoverCardSide = null;
  lastChartPointerX = null;
  pinned = false;
  document.body.classList.remove("focus-mode");
  $("#hover-card")?.remove();
  $("#focus-candle")?.replaceChildren();
  $("#chart")?.removeAttribute("aria-activedescendant");
  clearTimeout(hoverTimer);
  hoverTimer = null;
}
function modal(content, { explicitClose = false, enterConfirm = null } = {}) {
  clearFocus();
  $("dialog")?.close();
  const previous = document.activeElement;
  $("#modal-root").innerHTML =
    `<dialog class="modal"><button class="icon-button modal-close" aria-label="Закрыть">${icon("close")}</button>${content}</dialog>`;
  const dialog = $("dialog");
  dialog.showModal();
  if (enterConfirm) {
    const confirm = dialog.querySelector(enterConfirm);
    if (confirm) {
      confirm.setAttribute("aria-keyshortcuts", "Enter");
      confirm.title = "Enter — подтвердить";
      dialog.addEventListener("keydown", (event) => {
        if (
          event.key !== "Enter" ||
          event.repeat ||
          event.isComposing ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.target.closest("textarea,[contenteditable=true]") ||
          confirm.disabled
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        confirm.click();
      });
    }
  }
  if (explicitClose)
    dialog.addEventListener("cancel", (e) => e.preventDefault());
  dialog.querySelector(".modal-close").onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    dialog.remove();
    previous?.focus();
  });
  let backdropPress = false;
  const outside = (e) => {
    const r = dialog.getBoundingClientRect();
    return (
      e.target === dialog &&
      (e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom)
    );
  };
  dialog.addEventListener("pointerdown", (e) => {
    backdropPress = outside(e);
  });
  dialog.addEventListener("click", (e) => {
    if (!explicitClose && backdropPress && outside(e)) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
  return dialog;
}
function closeModal() {
  $("dialog")?.close();
}
let saveQueue = Promise.resolve(),
  pendingSaves = 0,
  contentEpoch = 0;
api.beforeClose?.(async () => {
  let pending;
  do { pending = saveQueue; await pending; } while (pending !== saveQueue);
});
function commit(next, { replace = false } = {}) {
  const updater = typeof next === "function",
    epoch = contentEpoch;
  const graphId = journal?.id,
    inDemo = demo;
  pendingSaves++;
  busy = true;
  const task = saveQueue.then(async () => {
    if (
      journal?.id !== graphId ||
      demo !== inDemo ||
      (!updater && epoch !== contentEpoch)
    )
      throw new Error("Дневник изменился. Повтори сохранение.");
    const candidate = updater
      ? next(structuredClone(journal))
      : structuredClone(next);
    // Appearance saves may precede a form submit. Keep their latest persisted values.
    if (!updater && !replace && journal) {
      candidate.settings.theme = journal.settings.theme;
      if (journal.settings.appearance)
        candidate.settings.appearance = structuredClone(
          journal.settings.appearance,
        );
      else delete candidate.settings.appearance;
    }
    validateJournal(candidate);
    if (!replace) assertPriceChange(journal, candidate);
    journal = inDemo
      ? candidate
      : await api.save(candidate, journal?.revision ?? 0, replace);
    if (!inDemo) personal = journal;
    if (!updater) contentEpoch++;
    blocked = false;
    theme();
    return true;
  });
  saveQueue = task.catch(() => {});
  return task.finally(() => {
    busy = --pendingSaves > 0;
  });
}
let chartStyle = "candles",
  ledgerView = "events",
  favoriteLimit = 30,
  summaryPeriod = "week",
  summaryAnchor = null,
  expandedChart = false;
function header() {
  return `<header class="topbar ambient"><a class="brand" href="#" aria-label="High. — главный экран"><img src="../assets/icon.svg" alt=""><span>High<span class="brand-dot">.</span></span></a><span class="product-label">личная траектория</span><nav aria-label="Основная навигация"><button id="home-button" class="nav-item ${view === "home" ? "active" : ""}">Меню</button><button data-view="chart" class="nav-item ${view === "chart" ? "active" : ""}">${icon("chart", 16)}График</button><button data-view="journal" class="nav-item ${view === "journal" ? "active" : ""}">${icon("book", 16)}Дневник</button></nav><div class="header-actions">${demo ? '<span class="demo-badge">ДЕМО · ПРИМЕР</span><button id="exit-demo" class="secondary demo-return">← Вернуться</button>' : `<span class="local-indicator"><i></i> Локально</span>`}<button id="updates" class="icon-button update-button" title="Обновления" aria-label="Обновления">${icon("download", 20)}</button><button id="settings" class="icon-button" title="Настройки" aria-label="Настройки">${icon("settings", 18)}</button></div></header>`;
}
function marketSummaryMarkup(bars) {
  const summary = visibleSummary(bars);
  const period = rangePeriod(summary.minutes);
  return `<div><span>Макс. за ${period}</span><strong data-visible-max>${summary.max === null ? "—" : fmt(summary.max)}</strong></div><div><span>Мин. за ${period}</span><strong data-visible-min>${summary.min === null ? "—" : fmt(summary.min)}</strong></div><div title="Сумма изменений по модулю на видимом участке графика"><span>Оборот за ${period}</span><strong data-turnover>${fmt(visibleTurnover(bars))}</strong></div>`;
}
function updateMarketSummary(bars) {
  const element = document.querySelector('.market-summary');
  if (element) element.innerHTML = marketSummaryMarkup(bars);
}
function terminalOverview(value, delta, progress) {
  return `<section class="overview ambient"><div class="instrument"><span class="instrument-coin" tabindex="0" role="button" aria-label="Изменить монетку графика">${journal.settings.coin ? coinSvg(journal.settings.name, journal.settings.coin) : `<span class="coin-placeholder">+</span>`}</span><div><div class="eyebrow">ГРАФИК ЖИЗНИ</div><h1>${esc(journal.settings.name)}</h1></div></div><div class="quote-price"><div class="value-row"><span class="main-value ${direction(delta)}">${fmt(value)}</span></div><p class="overview-caption"><span class="overview-change ${direction(delta)}">${signed(delta)} / ${pct(progress)}</span> за всё время</p></div><div class="market-metrics market-summary">${marketSummaryMarkup(view === "chart" ? [] : candles)}</div><div class="overview-right"><div class="entry-actions"><button class="quick-move-button quick-move-down" id="quick-move-down" aria-label="Добавить событие снижения" title="Снижение">${icon("market-down", 18)}</button><button class="quick-move-button quick-move-up" id="quick-move-up" aria-label="Добавить событие роста" title="Рост">${icon("market-up", 18)}</button>${journal.settings.experimentalRandom ? `<button class="secondary" id="random-event" title="Добавить тестовый день: шесть событий, каждый следующий день — на сутки раньше">${icon("spark", 16)} Случайное</button>` : ""}<button class="primary" id="add-event">${icon("plus", 17)} Добавить событие</button></div><span class="entry-shortcut">Ctrl + N</span></div></section>`;
}
let renderedView = null,
  renderedGraph = null,
  chartPhrase = "";
function render() {
  if (
    journal &&
    view === "chart" &&
    (renderedView !== "chart" || renderedGraph !== journal.id)
  ) {
    let previous = chartPhrase;
    try {
      previous = localStorage.getItem("vyshe-chart-phrase") || previous;
    } catch {}
    chartPhrase = nextChartPhrase(previous);
    try {
      localStorage.setItem("vyshe-chart-phrase", chartPhrase);
    } catch {}
  }
  renderedView = journal ? view : null;
  renderedGraph = journal?.id;
  disposePanelLayout?.();
  hideHelp();
  document.querySelector("#chart-style-menu")?.remove();
  document.querySelector("#drawing-menu")?.remove();
  document.body.dataset.view = view;
  chartObserver?.disconnect();
  clearFocus();
  if (!journal) {
    onboarding();
    return;
  }
  clearFocus();
  chartObserver?.disconnect();
  if (view === "home") {
    renderHome();
    return;
  }
  candles = calculate(journal);
  observations = candles.flatMap((d) =>
    d.events.map((e) => ({
      ...e,
      date: d.date,
      at: minuteAt(d.date, minuteOf(e.time)),
    })),
  );
  if (journal.settings.initial === 0) percentAxis = false;
  theme();
  const value = candles.at(-1)?.close ?? journal.settings.initial,
    delta = round(value - journal.settings.initial),
    progress = percentage(delta, journal.settings.initial);
  document.body.classList.toggle(
    "chart-expanded",
    expandedChart && view === "chart",
  );
  $("#app").innerHTML =
    `<div class="shell">${header()}<main>${terminalOverview(value, delta, progress)}${view === "chart" ? chartLayout() : journalLayout()}<footer class="ambient"><span class="footer-quote"><b>//</b> ${esc(chartPhrase)}</span><span><i class="status-dot"></i> ${demo ? "Демонстрация · записи не сохраняются" : "График жизни"} <b class="footer-version">High<span class="brand-dot">.</span> __APP_VERSION__</b></span></footer></main></div>`;
  bindShell();
  if (view === "chart") {
    intervalControls();
    drawChart();
    bindChart();
    renderDay();
    renderLedger();
    bindTerminalTools();
    bindChartHelp();
    disposePanelLayout = bindPanelLayout();
    setHelp(
      $("#panel-resizer"),
      "Размер ленты и графика",
      "Перетяни границу вверх или вниз. Двойной щелчок или Home — исходный размер; стрелки — изменение с клавиатуры.",
    );
    const observedChart = $("#chart");
    chartObserver = new ResizeObserver(() => {
      if ($("#chart") !== observedChart) return;
      if (
        geometry?.width === Math.max(400, $("#chart").clientWidth) &&
        geometry?.height === Math.max(160, $("#chart").clientHeight)
      )
        return;
      const selectedIndex = pinned ? hover : null;
      clearFocus();
      drawChart();
      if (selectedIndex !== null && visible.length)
        selectHover(selectedIndex, true);
    });
    chartObserver.observe($("#chart"));
  } else bindJournal();
}
function chartLayout() {
  const markup = `<section class="workspace"><div class="chart-panel"><div class="chart-toolbar ambient"><div class="chart-label"><span class="section-prefix">#</span> Траектория <span class="chart-subtitle">каждая свеча — часть пути</span></div><div class="chart-toolbar-actions"><button id="group-moments" class="text-button" aria-pressed="${groupMoments}">Промежутки · ${groupMoments ? "все" : "1"}</button><span class="chart-subtitle">Колесо — масштаб · Shift+перетаскивание — по вертикали</span></div></div><div class="chart-summary ambient"><span id="range-label"></span><span id="range-change"></span></div><div class="plot-body"><div class="chart-rail ambient"><button id="rail-focus" class="rail-button" aria-label="Выбор свечи" aria-pressed="${!drawTool && !measuring}">⌖</button><button data-chart-style="candles" class="rail-button ${chartStyle !== "line" ? "active" : ""}" aria-label="Свечной график" title="Свечи">${icon("chart", 18)}<span class="style-caret">›</span></button><button data-chart-style="line" class="rail-button ${chartStyle === "line" ? "active" : ""}" aria-label="Линейный график" title="Линия"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 17 5-5 4 3 8-11"/></svg></button><span class="rail-separator"></span>${[
    ["level", "─", "Горизонтальный уровень · нажми на нужную высоту"],
    ["trend", "╱", "Линия тренда · выбери две точки"],
    ["magnet", "∩", "Магнит · привязка к ближайшей цене свечи"],
    ["hide", "◉", "Показать или скрыть линии"],
    ["undo", "↶", "Удалить последнюю линию"],
    ["date", "↦", "Перейти к дате"],
  ]
    .map(
      ([tool, glyph, label]) => {
        const tooltip = tool === "trend"
          ? ""
          : ` title="${label}${tool === "level" ? " · линии остаются до закрытия приложения" : ""}"`;
        return `<button id="rail-${tool}" class="rail-button" aria-label="${label}"${tooltip}>${glyph}</button>`;
      },
    )
    .join(
      "",
    )}<span class="rail-separator"></span><button id="rail-note" class="rail-button" title="Описать выбранный день" aria-label="Описать выбранный день">${icon("edit", 17)}</button><button id="rail-expand" class="rail-button rail-bottom" aria-pressed="${expandedChart}" title="Развернуть график" aria-label="Развернуть график">${expandedChart ? "⊟" : "⛶"}</button></div><div id="chart" tabindex="0" role="application" aria-label="График жизни. Стрелки выбирают свечу, Enter выбирает день, P закрепляет, Escape снимает выделение. Перетаскивание сдвигает график по времени и цене; Shift+перетаскивание двигает шкалу даже при активном инструменте; Ctrl+колесо над графиком меняет вертикальный масштаб."><canvas id="chart-canvas" aria-hidden="true" hidden></canvas><svg id="chart-svg" aria-hidden="true"></svg><div class="chart-watermark" aria-hidden="true"><b>High<span class="brand-dot">.</span></b><span>личная траектория</span></div><div id="chart-empty" class="chart-empty" hidden></div><div id="short-history" hidden></div></div></div><div class="chart-bottom ambient"><div class="legend"><span><i class="legend-up"></i> Рост</span><span><i class="legend-down"></i> Спад</span><span><i class="legend-gap"></i> Без записей</span></div><div class="chart-controls"><button id="previous" class="icon-button small" aria-label="Предыдущий период">${icon("left", 15)}</button><button id="today" class="text-button">Сегодня</button><button id="auto-range" class="text-button">Авто</button><button id="next" class="icon-button small" aria-label="Следующий период">${icon("right", 15)}</button><span class="control-divider"></span><button id="zoom-out" class="icon-button small" aria-label="Уменьшить масштаб">${icon("minus", 15)}</button><button id="zoom-in" class="icon-button small" aria-label="Увеличить масштаб">${icon("plus", 15)}</button></div></div><div class="chart-hint ambient"><span class="hint-key">⌖</span> ЛКМ — выбрать день · ПКМ — закрепить <span>Колесо над шкалой — вертикальный масштаб · перетаскивание — график</span></div></div><div id="side-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Изменить ширину графика"></div><aside class="day-panel ambient" id="day-panel"></aside><div id="panel-resizer" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="Изменить высоту ленты"><span></span><span id="panel-corner" aria-hidden="true"></span></div><section class="activity-panel ambient" aria-label="Лента записей"><div class="activity-heading"><div class="activity-tabs"><button data-ledger="events" class="${ledgerView === "events" ? "active" : ""}">Последние события</button><button data-ledger="notes" class="${ledgerView === "notes" ? "active" : ""}">Заметки дня</button><button data-ledger="favorites" class="${ledgerView === "favorites" ? "active" : ""}">Избранное</button><button data-ledger="summary" class="${ledgerView === "summary" ? "active" : ""}">Сводка</button></div><button id="ledger-position" class="text-button"></button><button id="open-full-journal" class="text-button"><span>Весь дневник</span>${icon("right", 13)}</button></div><div id="activity-content"></div></section></section>`;
  return markup.replace(
    '<svg id="chart-svg" aria-hidden="true"></svg>',
    '$&<div id="volume-resizer" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="Изменить высоту области объёма" title="Перетащи, чтобы изменить высоту объёма" hidden><span></span></div>',
  );
}
function renderLedger() {
  if (!$("#activity-content")) return;
  if (ledgerView === "summary") {
    const anchor = summaryAnchor ?? selected;
    const { start, end } = periodBounds(anchor, summaryPeriod);
    const summary = summarizePeriod(candles, start, end);
    const periodLabel =
      summaryPeriod === "week"
        ? `${new Date(`${start}T12:00:00`).toLocaleDateString("ru", { day: "numeric", month: "short" })} — ${new Date(`${end}T12:00:00`).toLocaleDateString("ru", { day: "numeric", month: "short" })}`
        : new Date(`${start}T12:00:00`).toLocaleDateString("ru", { month: "long", year: "numeric" });
    const nextAnchor = shiftPeriodAnchor(anchor, summaryPeriod, 1);
    const canAdvance = periodBounds(nextAnchor, summaryPeriod).start <= localDate();
    const highlights = summary.highlights.length
      ? summary.highlights
          .map(
            (event) =>
              `<li><span><small>${shortDate(event.date)} · ${esc(event.time ?? "")}</small>${esc(event.text || "Без описания")}</span><strong class="${direction(event.delta)}">${signed(event.delta)}</strong></li>`,
          )
          .join("")
      : '<li class="muted">В этом периоде пока нет событий.</li>';
    const notes = summary.notes.length
      ? summary.notes
          .slice()
          .reverse()
          .slice(0, 4)
          .map(
            (day) =>
              `<li><span><small>${shortDate(day.date)}${day.title ? ` · ${esc(day.title)}` : ""}</small>${esc(day.note || "")}</span></li>`,
          )
          .join("")
      : '<li class="muted">Заметок за этот период нет.</li>';
    $("#activity-content").innerHTML =
      `<div class="period-summary"><div class="period-summary-toolbar"><div class="period-summary-switch"><button class="icon-button small" id="summary-prev" aria-label="Предыдущий период">${icon("left", 14)}</button><button data-summary-period="week" class="${summaryPeriod === "week" ? "active" : ""}">Неделя</button><button data-summary-period="month" class="${summaryPeriod === "month" ? "active" : ""}">Месяц</button><button class="icon-button small" id="summary-next" aria-label="Следующий период" ${canAdvance ? "" : "disabled"}>${icon("right", 14)}</button></div><strong>${esc(periodLabel)}</strong></div><div class="period-summary-stats"><div><span>Итог</span><strong class="${direction(summary.delta)}">${signed(summary.delta)} <small>(${pct(summary.percent)})</small></strong></div><div><span>События</span><strong>${summary.eventCount}</strong></div><div><span>Оборот</span><strong>${fmt(summary.turnover)}</strong></div></div><div class="period-summary-columns"><section><h3>Самые заметные события</h3><ul>${highlights}</ul></section><section><h3>Заметки</h3><ul>${notes}</ul></section></div></div>`;
    $("#summary-prev").onclick = () => {
      summaryAnchor = shiftPeriodAnchor(anchor, summaryPeriod, -1);
      renderLedger();
    };
    $("#summary-next").onclick = () => {
      if (!canAdvance) return;
      summaryAnchor = nextAnchor;
      renderLedger();
    };
    document.querySelectorAll("[data-summary-period]").forEach((button) => {
      button.onclick = () => {
        summaryPeriod = button.dataset.summaryPeriod;
        renderLedger();
      };
    });
    bindLedgerControls();
    return;
  }
  if (ledgerView === "favorites") {
    const favoriteDates = (journal.settings.favoriteDays ?? [])
      .slice()
      .sort((a, b) => b.localeCompare(a));
    const items = favoriteDates
      .slice(0, favoriteLimit)
      .map((date) => {
        const day = candles.find((row) => row.date === date) ?? dayData(date);
        const description = day.title || day.note || `${day.events.length} событий`;
        return `<div class="favorite-day-row"><button class="favorite-day-open" data-activity-date="${date}"><span><strong>${fullDate(date)}</strong><small>${esc(description)}</small></span><strong class="${direction(day.delta)}">${signed(day.delta)}</strong></button><button class="icon-button small favorite-day-toggle active" data-favorite-remove="${date}" aria-label="Убрать день ${date} из избранного" title="Убрать из избранного" aria-pressed="true">★</button></div>`;
      })
      .join("");
    $("#activity-content").innerHTML = items
      ? `<div class="favorite-days">${items}</div>${favoriteDates.length > favoriteLimit ? '<button id="favorite-load-more" class="secondary favorite-load-more">Показать ещё</button>' : ""}`
      : '<div class="activity-empty"><span>☆</span> Отмечай звёздочкой важные дни — они появятся здесь.</div>';
    $("#favorite-load-more")?.addEventListener("click", () => {
      favoriteLimit += 30;
      renderLedger();
    });
    bindActivityDates();
    document.querySelectorAll("[data-favorite-remove]").forEach((button) => {
      button.onclick = () => toggleFavoriteDay(button.dataset.favoriteRemove);
    });
    bindLedgerControls();
    return;
  }
  const rows =
    ledgerView === "events"
      ? candles
          .slice()
          .reverse()
          .flatMap((d) =>
            d.events
              .slice()
              .reverse()
              .map((e) => ({ ...e, date: d.date })),
          )
          .slice(0, 30)
      : candles
          .filter((d) => d.title || d.note)
          .slice()
          .reverse()
          .slice(0, 30);
  if (ledgerView === "notes") {
    const day = dayData(selected),
      draftKey = journal.id + ":" + selected;
    $("#activity-content").innerHTML =
      `<form id="quick-note" class="quick-note"><label><span>${fullDate(selected)}</span><textarea name="note" rows="2" maxlength="12000" placeholder="Что хочется сохранить об этом дне?">${esc(noteDrafts.get(draftKey) ?? day.note ?? "")}</textarea></label><div><button class="primary" type="submit">Сохранить заметку</button><button class="text-button" type="button" id="note-details">Название и подробности</button><span role="status" id="note-status"></span></div></form>`;
    $("#quick-note textarea").oninput = (e) =>
      noteDrafts.set(draftKey, e.target.value);
    $("#quick-note").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.currentTarget,
        b = f.querySelector("[type=submit]"),
        status = f.querySelector("#note-status");
      const text = f.elements.note.value.trim();
      b.disabled = true;
      f.elements.note.readOnly = true;
      try {
        await commit(
          upsertDay(journal, {
            date: day.date,
            title: day.title ?? "",
            note: text,
          }),
        );
        if (noteDrafts.get(draftKey)?.trim() === text)
          noteDrafts.delete(draftKey);
        candles = calculate(journal);
        observations = candles.flatMap((d) =>
          d.events.map((e) => ({
            ...e,
            date: d.date,
            at: minuteAt(d.date, minuteOf(e.time)),
          })),
        );
        if ($("#day-panel")) renderDay();
        status.textContent = "Сохранено";
      } catch (error) {
        status.textContent = error.message;
      } finally {
        b.disabled = false;
        f.elements.note.readOnly = false;
      }
    };
    $("#note-details").onclick = () => dayForm(selected);
  } else
    $("#activity-content").innerHTML = rows.length
      ? `<table class="activity-table"><thead><tr><th>Дата / время</th><th>${ledgerView === "events" ? "Событие" : "Описание дня"}</th><th>Изменение</th><th>Значение</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${shortDate(r.date)}<span>${r.time ?? ""}</span></td><td><button data-activity-date="${r.date}" title="Открыть день">${esc(r.text ?? r.title ?? "Без названия") || "Без названия"}</button>${ledgerView === "notes" ? `<small>${esc(r.note)}</small>` : ""}</td><td class="${direction(r.delta)}">${signed(r.delta)} <small>(${pct(r.percent)})</small></td><td>${fmt(r.after ?? r.close)}</td></tr>`).join("")}</tbody></table>`
      : `<div class="activity-empty"><span>[ пока пусто ]</span> ${ledgerView === "events" ? "Первое событие станет началом твоей истории." : "Опиши день — здесь появится его история."}</div>`;
  bindActivityDates();
  bindLedgerControls();
}
function bindActivityDates() {
  document.querySelectorAll("[data-activity-date]").forEach(
    (button) =>
      (button.onclick = () => {
        chooseDay(button.dataset.activityDate);
        autoRange = false;
        manualPriceRange = null;
        autoLayout = false;
        end = selected;
        intradayEnd = Math.min(chartHorizon(), minuteAt(shiftDate(selected, 1)));
        render();
      }),
  );
}
function bindLedgerControls() {
  document.querySelectorAll("[data-ledger]").forEach(
    (b) =>
      (b.onclick = () => {
        ledgerView = b.dataset.ledger;
        if (ledgerView === "summary") summaryAnchor = selected;
        document
          .querySelectorAll("[data-ledger]")
          .forEach((x) => x.classList.toggle("active", x === b));
        renderLedger();
      }),
  );
  $("#open-full-journal").onclick = () => {
    view = "journal";
    render();
  };
}
function openDrawingMenu(anchor) {
  hideHelp();
  if ($("#drawing-menu")) return;
  const menu = document.createElement("div");
  menu.id = "drawing-menu";
  menu.className = "chart-style-menu";
  menu.role = "menu";
  menu.setAttribute("aria-label", "Линии на графике");
  menu.innerHTML =
    "<strong>Линии</strong>" +
    [
      [
        "trend",
        "Линия тренда",
        "Соединяет две точки и показывает направление движения.",
      ],
      [
        "arrow",
        "Стрелка",
        "Проводит линию от первой точки ко второй и отмечает направление.",
      ],
      [
        "vertical",
        "Вертикальная линия",
        "Одним нажатием отмечает выбранное время по высоте графика.",
      ],
    ]
      .map(([id, title, description]) =>
        `<button role="menuitem" data-drawing-option="${id}"><span>${title}</span><small>${description}</small></button>`,
      )
      .join("");
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left =
    Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, r.right + 10)) +
    "px";
  menu.style.top =
    Math.max(8, Math.min(innerHeight - menu.offsetHeight - 8, r.top)) + "px";
  let timer;
  anchor.onpointerleave = () => {
    timer = setTimeout(() => menu.remove(), 180);
  };
  menu.onpointerenter = () => clearTimeout(timer);
  menu.onpointerleave = () => {
    timer = setTimeout(() => menu.remove(), 180);
  };
  menu.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        clearTimeout(timer);
        drawTool = b.dataset.drawingOption;
        drawStart = null;
        measuring = false;
        measureStart = measureEnd = null;
        hideDrawings = false;
        render();
      }),
  );
  menu.onkeydown = (e) => {
    if (["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      const buttons = [...menu.querySelectorAll("button")];
      const i = buttons.indexOf(document.activeElement);
      buttons[
        (i +
          (e.key === "ArrowDown" ? 1 : buttons.length - 1) +
          buttons.length) %
          buttons.length
      ].focus();
    }
    if (e.key === "Escape") {
      menu.remove();
      anchor.focus();
    }
  };
}
function bindTerminalTools() {
  $("#rail-focus").onclick = () => {
    drawTool = null;
    drawStart = null;
    measuring = false;
    render();
    $("#chart").focus();
  };
  for (const tool of ["level"]) {
    const b = $("#rail-" + tool);
    b.setAttribute("aria-pressed", String(drawTool === tool));
    b.onclick = () => {
      drawTool = drawTool === tool ? null : tool;
      drawStart = null;
      measuring = false;
      measureStart = measureEnd = null;
      hideDrawings = false;
      render();
    };
  }
  $("#rail-trend").onclick = () => {
    openDrawingMenu($("#rail-trend"));
    $("#drawing-menu button")?.focus();
  };
  $("#rail-trend").onpointerenter = () => openDrawingMenu($("#rail-trend"));
  $("#rail-trend").setAttribute("aria-haspopup", "menu");
  $("#rail-trend").setAttribute(
    "aria-pressed",
    String(["trend", "arrow", "vertical"].includes(drawTool)),
  );
  $("#rail-magnet").setAttribute("aria-pressed", String(magnet));
  $("#rail-magnet").onclick = () => {
    rememberTools();
    magnet = !magnet;
    render();
  };
  $("#rail-hide").setAttribute("aria-pressed", String(hideDrawings));
  $("#rail-hide").onclick = () => {
    rememberTools();
    hideDrawings = !hideDrawings;
    render();
  };
  $("#rail-undo").disabled = !drawings().length && !drawStart;
  $("#rail-undo").onclick = () => {
    if (drawStart) drawStart = null;
    else {
      rememberTools();
      drawings().pop();
    }
    render();
  };
  $("#rail-date").onclick = goToDate;

  $("#rail-note").onclick = () => dayForm(noteDay());
  $("#rail-expand").onclick = () => {
    expandedChart = !expandedChart;
    render();
  };
  document.querySelectorAll("[data-chart-style]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.chartStyle === "candles") {
          openStyleMenu(b);
          $("#chart-style-menu button")?.focus();
          return;
        }
        chartStyle = b.dataset.chartStyle;
        render();
      }),
  );
}
function refreshNoteHelp() {
  setHelp(
    $("#rail-note"),
    "Название и заметка · " + fullDate(noteDay()),
    "Открыть запись за этот день. Другой день можно выбрать кликом по свече или в календаре справа. Если день не выбирал, откроется сегодня.",
  );
}
function bindChartHelp() {
  const help = {
    "rail-focus": [
      "Выбор свечи",
      "Наведи на тело или тонкую тень свечи, чтобы увидеть запись. ПКМ закрепляет карточку. Пустую область можно перетаскивать для просмотра истории.",
    ],
    "rail-level": [
      "Горизонтальный уровень",
      "Нажми на нужную высоту графика — появится линия для сравнения значений. Esc отменяет инструмент. Разметка остаётся до закрытия приложения.",
    ],
    "rail-magnet": [
      "Магнит",
      "При рисовании точка прилипает к ближайшему началу, итогу или краю свечи. Выключи, чтобы поставить её на любой высоте.",
    ],
    "rail-hide": [
      hideDrawings ? "Показать разметку" : "Скрыть разметку",
      "Временно прячет нарисованные уровни и линии тренда. Повторное нажатие возвращает их.",
    ],
    "rail-undo": [
      "Удалить последнюю линию",
      "Убирает последний нарисованный уровень или линию тренда. Если выбираешь вторую точку, отменяет первую.",
    ],
    "rail-date": [
      "Перейти к дате",
      "Выбери день — график переместится к нему. Длительность свечи и масштаб останутся прежними.",
    ],
    "rail-expand": [
      expandedChart ? "Вернуть обычный размер" : "Развернуть график",
      "Расширяет график, скрывая боковую панель и ленту. Нажми ещё раз, чтобы вернуть их.",
    ],
    "show-average": [
      "MA · средняя",
      `Средние линии сглаживают колебания. 7 — быстрее реагирует, 28 — плавнее. Включай несколько чисел одновременно. MA скрывает и возвращает выбранные линии.`,
    ],
    "show-base": [
      "База · точка отсчёта",
      "Показывает начальный уровень, если он попадает в видимую шкалу. Масштаб свечей не меняется; процентная шкала помогает сравнить результат со стартом.",
    ],
    "percent-axis": [
      "Процентная шкала",
      journal.settings.initial === 0
        ? "Для процентов нужна ненулевая точка отсчёта. Сейчас начальное значение равно нулю."
        : "Показывает справа рост или спад в процентах от начального значения вместо абсолютных значений. Повторное нажатие возвращает числа.",
    ],
    "measure-tool": [
      "Измерить участок",
      "Нажми возле первой свечи, затем возле второй. Увидишь разницу значений, процент и прошедшее время. Esc завершает измерение.",
    ],
    previous: [
      "Раньше по истории",
      "Сдвигает видимый участок к более ранним датам. Длительность свечи не меняется.",
    ],
    next: [
      "Позже по истории",
      "Сдвигает видимый участок к более поздним датам, максимум до сегодняшнего дня.",
    ],
    today: [
      "Вернуться к сегодняшнему дню",
      "Переносит график к текущему моменту и выбирает сегодняшний день справа. Твой масштаб сохраняется.",
    ],
    "auto-range": [
      "Авто · диапазон значений",
      "Авто подбирает диапазон по свечам. Перетаскивай область графика или шкалу справа, чтобы сдвинуть значения вверх и вниз. Колесо над шкалой справа (или Ctrl+колесо над графиком) меняет вертикальный масштаб. Shift+перетаскивание сдвигает вид, даже если выбран инструмент рисования. Авто вернёт подстройку по свечам.",
    ],
    "zoom-in": [
      "Приблизить",
      "Свечи становятся крупнее, в окне остаётся меньше времени. То же самое можно сделать колесом мыши.",
    ],
    "zoom-out": [
      "Отдалить",
      "Свечи становятся мельче, видно больше истории. «Авто» вернёт стандартный масштаб.",
    ],
  };
  for (const [id, args] of Object.entries(help)) setHelp($("#" + id), ...args);
  for (const b of document.querySelectorAll("[data-average]"))
    setHelp(
      b,
      "Средняя за " + b.dataset.average + " свечей",
      "Включить или скрыть эту линию независимо от остальных. 7 — жёлтая, 14 — голубая, 28 — фиолетовая. Чем больше число, тем плавнее линия.",
    );
  for (const b of document.querySelectorAll("[data-interval]"))
    setHelp(
      b,
      "Одна свеча — " +
        TIMEFRAMES.find((x) => x[0] === Number(b.dataset.interval))[2],
      "Объединяет записи за этот промежуток. Повторное нажатие возвращает стандартное приближение.",
    );
  const styleButton = document.querySelector('[data-chart-style="candles"]');
  styleButton.removeAttribute("title");
  styleButton.setAttribute(
    "aria-label",
    "Вид графика · " + CHART_STYLES.find((x) => x[0] === chartStyle)[1],
  );
  styleButton.setAttribute("aria-haspopup", "menu");
  styleButton.onpointerenter = () => openStyleMenu(styleButton);
  setHelp(
    document.querySelector('[data-chart-style="line"]'),
    "Линейный график",
    "Соединяет итоговые значения свечей. Другие виды доступны при наведении на кнопку свечей выше.",
  );
  setHelp(
    $("#rhythm-toggle")?.parentElement,
    "Плавный ритм",
    "Мягкие колебания между записями. Точные значения событий сохраняются.",
  );
  refreshNoteHelp();
}
function openStyleMenu(anchor) {
  hideHelp();
  if ($("#chart-style-menu")) return;
  const menu = document.createElement("div");
  menu.id = "chart-style-menu";
  menu.className = "chart-style-menu";
  menu.role = "menu";
  menu.setAttribute("aria-label", "Вид графика");
  menu.innerHTML =
    "<strong>Вид графика</strong>" +
    CHART_STYLES.filter(([id]) => id !== "line")
      .map(
        ([id, name, description]) =>
          `<button role="menuitemradio" aria-checked="${chartStyle === id}" data-style-option="${id}"><span>${name}</span><small>${description}</small></button>`,
      )
      .join("");
  document.body.append(menu);
  anchor.setAttribute("aria-expanded", "true");
  const r = anchor.getBoundingClientRect();
  menu.style.left =
    Math.min(innerWidth - menu.offsetWidth - 8, r.right + 10) + "px";
  menu.style.top =
    Math.max(8, Math.min(innerHeight - menu.offsetHeight - 8, r.top)) + "px";
  let timer;
  const close = () => {
    clearTimeout(timer);
    menu.remove();
    anchor.setAttribute("aria-expanded", "false");
  };
  anchor.onpointerleave = () => {
    timer = setTimeout(close, 180);
  };
  menu.onpointerenter = () => clearTimeout(timer);
  menu.onpointerleave = () => {
    timer = setTimeout(close, 180);
  };
  menu.onkeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      anchor.focus();
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = [...menu.querySelectorAll("button")];
      const n = items.indexOf(document.activeElement);
      items[
        (n + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length
      ].focus();
    }
  };
  menu.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        chartStyle = b.dataset.styleOption;
        drawStart = null;
        close();
        render();
      }),
  );
}
function bindShell() {
  const coinButton = $(".instrument-coin");
  if (coinButton) {
    coinButton.onclick = () => coinForm();
    coinButton.onkeydown = (e) => {
      if (["Enter", " "].includes(e.key)) {
        e.preventDefault();
        coinForm();
      }
    };
  }
  if ($(".instrument-coin"))
    setHelp(
      $(".instrument-coin"),
      "Монетка графика",
      "Нажми, чтобы изменить цвет, символ, буквы и ободок этой монетки.",
    );
  document.querySelectorAll("button[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.view;
        render();
      }),
  );
  $(".brand").onclick = (e) => {
    e.preventDefault();
    view = "chart";
    render();
  };
  if ($("#add-event")) $("#add-event").onclick = () => eventForm();
  if ($("#random-event")) $("#random-event").onclick = randomEvent;
  if ($("#quick-move-down"))
    $("#quick-move-down").onclick = () => recordQuickMove("down");
  if ($("#quick-move-up"))
    $("#quick-move-up").onclick = () => recordQuickMove("up");
  $("#home-button").onclick = openHome;
  $("#settings").onclick = settingsForm;
  $("#updates").onclick = updatesForm;
  api
    .updateState()
    .then((s) =>
      $("#updates")?.classList.toggle(
        "update-ready",
        ["available", "downloaded"].includes(s.state),
      ),
    );
  $("#exit-demo")?.addEventListener("click", async () => {
    await saveQueue;
    demo = false;
    journal = personal;
    selected = localDate();
    span = journal?.settings.chartDensity ?? 45;
    end = localDate();
    render();
  });
  $("#day-note")?.addEventListener("click", () => dayForm(selected));
}
function boundaries() {
  const earliest = candles[0]?.date ?? localDate(),
    latest = candles.at(-1)?.date ?? localDate();
  return { earliest, latest: latest > localDate() ? latest : localDate() };
}
function maxPanEnd() {
  if (interval < 1440)
    return chartHorizon() + Math.max(interval * 8, intradayCount * 3);
  const bars = span || journal?.settings.chartDensity || 45;
  const daysPerBar = Math.max(1, Math.round(interval / 1440));
  return shiftDate(boundaries().latest, Math.max(14, bars * daysPerBar * 3));
}
function daysBetween(a, b) {
  return Math.round(
    (new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000,
  );
}
function intervalControls() {
  const toolbar = document.createElement("div");
  toolbar.className = "interval-toolbar ambient";
  toolbar.innerHTML = `<div class="interval-selector" aria-label="Длительность одной свечи"><span>Интервал</span>${TIMEFRAMES.map(
    ([n, label, description]) =>
      `<button title="Одна свеча — ${description}" data-interval="${n}" class="${interval === n ? "active" : ""}" aria-pressed="${interval === n}">${label}</button>`,
  ).join(
    "",
  )}</div><label class="rhythm-switch" title="Мягкие визуальные колебания между реальными записями. Не меняют значения и итоги."><input id="rhythm-toggle" type="checkbox" ${journal.settings.interpolate ? "checked" : ""}> Плавный ритм</label>`;
  $(".chart-toolbar").after(toolbar);
  toolbar.querySelectorAll("[data-interval]").forEach(
    (b) =>
      (b.onclick = () => {
        interval = Number(b.dataset.interval);
        resetViewport();
        render();
      }),
  );
  $("#rhythm-toggle").onchange = async (e) => {
    try {
      const next = structuredClone(journal);
      next.settings.interpolate = e.target.checked;
      await commit(next);
      view = "chart";
      render();
      coinForm(true);
    } catch (error) {
      toast(error.message);
      e.target.checked = !e.target.checked;
    }
  };
  if (interval < 1440) {
    $(".chart-hint").innerHTML =
      `${icon("spark", 13)} ${journal.settings.interpolate ? "Плавный ритм · колебания между записями" : "Только реальные изменения · без интерполяции"}`;
  } else {
    $("#rhythm-toggle").disabled = true;
  }
  const controls = document.createElement("div");
  controls.className = "analysis-tools ambient";
  controls.innerHTML = `<div class="average-switch" role="group" aria-label="Средняя линия"><button id="show-average" aria-pressed="${showAverage}">MA</button>${[7, 14, 28].map((n) => `<button data-average="${n}" style="--average-color:${averageColors[n]}" aria-pressed="${showAverage && averagePeriods.includes(n)}">${n}</button>`).join("")}</div><button id="show-base" aria-pressed="${showBase}" title="Линия начального значения">База</button><button id="percent-axis" aria-pressed="${percentAxis}" title="Изменение относительно начального значения">%</button><button id="measure-tool" aria-pressed="${measuring}" title="Выбери две свечи, чтобы измерить участок">↔ Измерить</button><button id="show-volume" aria-pressed="${journal.settings.showVolume !== false}" title="Сумма изменений по модулю в каждой свече">Объём</button><output id="measure-output" aria-live="polite"></output><output id="drawing-status" aria-live="polite">${drawTool ? (drawTool === "vertical" ? "Выбери время на графике" : drawTool === "level" ? "Выбери высоту уровня" : drawStart ? "Выбери вторую точку" : "Выбери начало линии") + " · Esc — отмена · линии на время сеанса" : ""}</output>`;
  const legend = $(".chart-bottom .legend");
  $(".chart-hint").replaceChildren();
  const status = document.createElement("span");
  status.id = "selection-status";
  status.textContent = "Наведись на свечу · объём = сумма изменений по модулю";
  $(".chart-hint").append(status, legend);
  $(".chart-bottom").prepend(controls);
  $("#show-volume").onclick = async () => {
    try {
      const next = structuredClone(journal);
      next.settings.showVolume = next.settings.showVolume === false;
      await commit(next);
      render();
    } catch (e) {
      toast(e.message);
    }
  };
  document.querySelectorAll("[data-average]").forEach(
    (b) =>
      (b.onclick = () => {
        averageLength = Number(b.dataset.average);
        if (!showAverage) {
          averagePeriods = [averageLength];
          showAverage = true;
        } else if (averagePeriods.includes(averageLength)) {
          const remaining = averagePeriods.filter((n) => n !== averageLength);
          if (remaining.length) averagePeriods = remaining;
          else showAverage = false;
        } else
          averagePeriods = [...averagePeriods, averageLength].sort(
            (a, b) => a - b,
          );
        try {
          localStorage.setItem(
            "vyshe-average-periods",
            JSON.stringify(averagePeriods),
          );
          localStorage.setItem("vyshe-average-length", String(averageLength));
        } catch {}
        render();
      }),
  );
  $("#show-average").onclick = () => {
    showAverage = !showAverage;
    render();
  };
  $("#show-base").onclick = () => {
    showBase = !showBase;
    render();
  };
  $("#percent-axis").disabled = journal.settings.initial === 0;
  $("#percent-axis").onclick = () => {
    percentAxis = !percentAxis;
    render();
  };
  $("#measure-tool").onclick = () => {
    drawTool = null;
    drawStart = null;
    measuring = !measuring;
    measureStart = measureEnd = null;
    render();
  };
}
function windowRange() {
  const b = boundaries();
  if (autoLayout && interval >= 1440) {
    const start = shiftDate(localDate(), -span + 1);
    return { start: start < b.earliest ? b.earliest : start, end: localDate() };
  }
  if (span === 0)
    return { start: shiftDate(b.earliest, -2), end: shiftDate(b.latest, 2) };
  const latestPanEnd = maxPanEnd();
  const safeEnd = end < b.earliest
    ? b.earliest
    : end > latestPanEnd
      ? latestPanEnd
      : end;
  end = safeEnd;
  return { start: shiftDate(end, -span + 1), end };
}
let geometry;
function disableAutoRange() {
  if (!autoRange) return;
  manualPriceRange = geometry
    ? { low: geometry.low, high: geometry.high }
    : visualBars.length
      ? candlePriceRange(visualBars)
      : null;
  autoRange = false;
}

function drawChart() {
  if (!$("#chart")) return;
  const range = windowRange();
  $("#auto-range")?.setAttribute("aria-pressed", String(autoRange));
  $("#chart").dataset.style = chartStyle;
  if (interval >= 1440)
    visible = calendarBars(
      candles,
      journal.settings.initial,
      range.start,
      range.end,
      interval,
    );
  else {
    const earliest = minuteAt(candles[0]?.date ?? localDate());
    intradayEnd = Math.min(
      maxPanEnd(),
      Math.max(earliest + 1, intradayEnd ?? chartHorizon()),
    );
    const viewportStart = intradayEnd - intradayCount;
    visible = timeline(
      candles,
      journal.settings.initial,
      interval,
      viewportStart,
      intradayEnd,
      journal.settings.interpolate,
      chartHorizon(),
      journal.settings.rhythmStrength ?? 4,
    );
    visible = appendFutureBars(
      visible,
      viewportStart,
      intradayEnd,
      chartHorizon(),
      interval,
      candles.at(-1)?.close ?? journal.settings.initial,
    );
  }
  if (interval < 1440) {
    const starter = starterBars(
      journal,
      interval,
      intradayEnd - intradayCount,
      intradayEnd,
    );
    visible = [...starter, ...visible];
  }
  prepareChartView(range);
  $("#short-history").hidden = true;
  const hasEvents = journal.events.some((e) => !e.deletedAt);
  const hasStarter = visible.some((c) => c.starter);
  if ($("#next"))
    $("#next").disabled = interval < 1440 ? intradayEnd >= maxPanEnd() : end >= maxPanEnd();
  const emptyDay = interval < 1440 && !visible.length;
  const empty = $("#chart-empty");
  empty.hidden = (hasEvents || hasStarter) && !emptyDay;
  if ((!hasEvents && !hasStarter) || emptyDay) {
    clearFocus();
    visible = [];
    $("#volume-resizer").hidden = true;
    $("#chart-canvas").hidden = true;
    updateMarketSummary(visible);
    geometry = null;
    $("#chart-svg").replaceChildren();
    $("#range-label").textContent =
      interval >= 1440
        ? "Твоя история начинается с первой записи"
        : fullDate(selected);
    $("#range-change").textContent = "Нет событий";
    empty.innerHTML = `<div class="empty-symbol">${icon("chart", 30)}</div><h2>${hasEvents ? "В этом периоде пока нет событий" : "Здесь начинается твой путь"}</h2><p>Добавь реальный момент.<br>График появится после записи.</p><button class="primary" id="first-event">${icon("plus", 17)} ${hasEvents ? "Добавить событие" : "Первое событие"}</button>`;
    $("#first-event").onclick = (e) => {
      e.stopPropagation();
      eventForm(null, interval >= 1440 ? localDate() : selected);
    };
    return;
  }
  updateMarketSummary(visible);
  const width = Math.max(400, $("#chart").clientWidth),
    height = Math.max(260, $("#chart").clientHeight),
    left = 24,
    right = 76,
    top = 24,
    showVolume = journal.settings.showVolume !== false,
    volumePanelHeight = showVolume ? getVolumePanelHeight(height) : 0,
    volumeBase = height - 38,
    volumeTop = volumeBase - volumePanelHeight,
    bottom = showVolume ? 48 + volumePanelHeight : 42,
    pw = width - left - right,
    ph = height - top - bottom;
  const fittedRange = candlePriceRange(visualBars);
  if (autoRange) manualPriceRange = null;
  else if (!manualPriceRange) manualPriceRange = fittedRange;
  const { low, high } = autoRange ? fittedRange : manualPriceRange;
  const y = (n) => top + ((high - n) / (high - low)) * ph,
    futureSlots = 4,
    step = autoLayout
      ? Math.min(32, pw / (visible.length + futureSlots))
      : pw / (visible.length + futureSlots),
    candleLeft = left + pw - step * (visible.length + futureSlots),
    x = (i) => candleLeft + (i + 0.5) * step,
    bw = Math.max(1, Math.min(24, Math.floor(step * 0.84)));
  geometry = {
    width,
    height,
    left,
    right,
    top,
    bottom,
    volumePanelHeight,
    volumeBase,
    volumeTop,
    futureSlots,
    pw,
    ph,
    low,
    high,
    times: visible.map(barTime),
    y,
    x,
    step,
    candleLeft,
    bw,
  };
  $("#chart").dataset.scale = autoRange ? "auto" : "manual";
  const volumeHandle = $("#volume-resizer");
  if (volumeHandle) {
    volumeHandle.hidden = !showVolume;
    if (showVolume) {
      const { min, max } = volumePanelBounds(height);
      volumeHandle.style.top = `${volumeTop}px`;
      volumeHandle.setAttribute("aria-valuenow", volumePanelHeight);
      volumeHandle.setAttribute("aria-valuemin", min);
      volumeHandle.setAttribute("aria-valuemax", max);
    }
  }
  const denseCanvas = visible.length > 500;
  const canvasCandles = denseCanvas && !["line", "baseline"].includes(chartStyle);
  const svg = $("#chart-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  let grid = "",
    labels = "";
  for (let i = 0; i < 6; i++) {
    const val = low + ((high - low) * i) / 5,
      yy = y(val);
    grid += `<line x1="${left}" x2="${width - right}" y1="${yy}" y2="${yy}" class="grid-line"/>${Math.abs(yy - y(visible.at(-1).close)) > 22 ? `<text x="${width - right + 16}" y="${yy + 4}" class="axis-label">${axisText(val)}</text>` : ""}`;
  }
  const labelInterval = Math.max(1, Math.ceil(115 / step));
  visible.forEach((c, i) => {
    if (i % labelInterval === 0) {
      grid += `<line x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${height - bottom}" class="grid-line vertical-grid"/>`;
      labels += `<text x="${Math.max(left + 58, Math.min(width - right - 58, x(i)))}" y="${height - 13}" text-anchor="middle" class="axis-label time-axis-label">${c.intraday ? (visible[0].date === visible.at(-1).date ? c.time : shortDate(c.date) + " " + c.time) : calendarAxisLabel(c.date)}</text>`;
    }
  });
  const candleBody =
    denseCanvas || ["line", "baseline"].includes(chartStyle)
      ? ""
      : visible.map((c, i) => candleMarkup(c, i)).join("");
  const needsLinePath = ["baseline", "line"].includes(chartStyle);
  const linePath = needsLinePath
    ? visible.map((c, i) => `${i ? "L" : "M"}${x(i)} ${y(c.close)}`).join(" ")
    : "";
  const baselineY =
    top + ph * (1 - (journal.settings.baselineLevel ?? 50) / 100);
  const baselinePath = chartStyle === "baseline"
    ? `${linePath} L${x(visible.length - 1)} ${baselineY} L${x(0)} ${baselineY} Z`
    : "";
  const baselineBody = chartStyle === "baseline"
    ? `<defs><clipPath id="above-base"><rect x="${left}" y="${top}" width="${pw}" height="${baselineY - top}"/></clipPath><clipPath id="below-base"><rect x="${left}" y="${baselineY}" width="${pw}" height="${height - bottom - baselineY}"/></clipPath></defs>${["up", "down"].map((color, i) => `<g clip-path="url(#${i ? "below" : "above"}-base)"><path d="${baselinePath}" fill="var(--${color})" opacity=".15"/><path d="${linePath}" fill="none" stroke="var(--${color})" stroke-width="2"/></g>`).join("")}<line x1="${left}" x2="${width - right}" y1="${baselineY}" y2="${baselineY}" class="base-line"/><text x="${left + 8}" y="${baselineY - 7}" class="axis-label">Опора ${axisText(high - ((baselineY - top) / ph) * (high - low))}</text>`
    : "";
  const candleElevation =
    !denseCanvas && chartStyle === "candles"
      ? candleElevationMarkup(visible)
      : "";
  const body =
    chartStyle === "baseline"
      ? baselineBody
      : chartStyle === "line"
        ? `<path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linejoin="round"/><path d="${linePath} L${x(visible.length - 1)} ${height - bottom} L${x(0)} ${height - bottom} Z" fill="var(--accent)" opacity=".04"/>`
        : candleBody;
  const volumes = chartVolume(
    visible,
    Math.max(16, volumePanelHeight - 30),
  );
  const volumeMarkup = denseCanvas
    ? ""
    : volumes
    .map((v, i) => {
      const center = x(i),
        baseline = volumeBase,
        half = Math.max(1, bw / 2);
      return `<rect data-volume-count="${v.count}" data-volume-value="${v.value}" data-decorative="${v.decorative}" x="${center - half}" y="${baseline - v.height}" width="${half * 2}" height="${v.height}" fill="var(--${volumeTone(v.value, visible[i].close - visible[i].open)})" opacity="${v.decorative ? 0.12 : 0.48}"/>`;
    })
    .join("");
  const volumeBody =
    !showVolume
      ? ""
      : `<g id="volume-layer"><line x1="${left}" x2="${width - right}" y1="${volumeTop}" y2="${volumeTop}" class="grid-line"/><text x="${left + 6}" y="${volumeTop + 15}" class="axis-label">Объём</text><title>Объём — сумма изменений по модулю. Фон и переходы между событиями декоративные, в оборот не входят.</title>${volumeMarkup}</g>`;
  const last = visible.at(-1),
    lineY = y(last.close);
  const filterDef = candleElevation
    ? '<filter id="candle-elevation-blur" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.6"/></filter>'
    : "";
  const elevationLayer = candleElevation
    ? `<g clip-path="url(#price-plot)" pointer-events="none" opacity=".16" filter="url(#candle-elevation-blur)">${candleElevation}</g>`
    : "";
  svg.innerHTML = `<defs><clipPath id="price-plot"><rect x="${left}" y="${top}" width="${pw}" height="${ph}"/></clipPath>${filterDef}</defs><g class="chart-muted">${grid}${labels}${showBase && journal.settings.initial >= low && journal.settings.initial <= high ? `<line x1="${left}" x2="${width - right}" y1="${y(journal.settings.initial)}" y2="${y(journal.settings.initial)}" class="base-line"/>` : ""}<line x1="${left}" x2="${width - right}" y1="${lineY}" y2="${lineY}" class="current-line"/>${elevationLayer}<g clip-path="url(#price-plot)">${body}</g>${volumeBody}${showAverage ? `<g clip-path="url(#price-plot)">${averageMarkup()}</g>` : ""}<rect x="${width - right + 5}" y="${lineY - 13}" width="70" height="26" rx="5" class="value-tag"/><text x="${width - right + 40}" y="${lineY + 4}" text-anchor="middle" class="value-tag-text">${axisText(last.close)}</text></g><g id="drawing-layer"></g><g id="focus-candle"></g><g id="measure-layer"></g>`;
  const chartCanvas = $("#chart-canvas");
  chartCanvas.hidden = !denseCanvas;
  if (denseCanvas)
    drawDenseChartCanvas(chartCanvas, visible, volumes, canvasCandles);
  // Measure the rendered labels: clamping alone can make neighboring labels collide.
  let lastLabelRight = left - 10;
  for (const label of svg.querySelectorAll(".time-axis-label")) {
    let box = label.getBBox();
    const shift =
      Math.max(0, left - box.x) -
      Math.max(0, box.x + box.width - (width - right));
    label.setAttribute("x", Number(label.getAttribute("x")) + shift);
    box = label.getBBox();
    if (box.x < lastLabelRight + 10) label.remove();
    else lastLabelRight = box.x + box.width;
  }
  if (pendingEventAnimation) {
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      animationFrame = requestAnimationFrame(() => {
        const pending = pendingEventAnimation;
        pendingEventAnimation = null;
        if (pending?.graphId === journal?.id && $("#chart") && geometry)
          animateEventChart(
            $("#chart"),
            visible,
            geometry,
            pending.id,
            journal.settings,
          );
      });
    });
  }
  const shortHistory = $("#short-history");
  if (
    autoLayout &&
    interval !== 15 &&
    visible.length < 7 &&
    candleLeft - left > 380
  ) {
    shortHistory.hidden = false;
    shortHistory.innerHTML = `<strong>Свечей в истории: ${visible.length}</strong><p>Интервал ${TIMEFRAMES.find((t) => t[0] === interval)[1]} объединяет записи.<br>Больше подробностей — на интервале 15 минут.</p><button id="detail-days" class="secondary">Показать 15 минут →</button>`;
    $("#detail-days").onclick = () => {
      interval = 15;
      resetViewport();
      render();
    };
  }
  let starterBanner = $("#starter-banner");
  if (!starterBanner) {
    starterBanner = document.createElement("div");
    starterBanner.id = "starter-banner";
    $(".activity-tabs").after(starterBanner);
  }
  starterBanner.hidden = !journal.settings.starter?.remaining;
  starterBanner.innerHTML = `◇ Стартовый ритм · ${journal.settings.starter?.remaining ?? 0}/30 <button class="text-button" id="starter-add">Добавить свой момент +</button><button class="text-button" id="starter-hide">Скрыть стартовый ритм</button>`;
  $("#starter-add").onclick = () => eventForm();
  $("#starter-hide").onclick = async () => {
    try {
      const next = structuredClone(journal);
      next.settings.starter.remaining = 0;
      await commit(next);
      render();
    } catch (e) {
      toast(e.message);
    }
  };
  drawMeasurement();
  drawAnnotations();
  $("#range-label").textContent = visible[0].intraday
    ? `${shortDate(visible[0].date)} ${visible[0].time} — ${shortDate(last.date)} ${last.endTime}`
    : `${visible[0].date.slice(0, 4) === last.date.slice(0, 4) ? shortDate(visible[0].date) : fullDate(visible[0].date)} — ${fullDate(last.endDate ?? last.date)}`;
  const delta = visible[0].intraday
    ? round(visible.reduce((sum, c) => sum + c.realDelta, 0))
    : round(last.close - visible[0].open);
  const periodBase = visible[0].intraday
    ? (visible.flatMap((c) => c.events)[0]?.before ?? visible[0].open)
    : visible[0].open;
  $("#range-change").innerHTML =
    `<span class="${direction(delta)}">${signed(delta)} <span class="muted">(${pct(percentage(delta, periodBase))})</span></span> <span class="muted">${visible[0].intraday ? "по записям" : "за период"}</span>`;
}
function goToDate() {
  const d = modal(
    `<h2>Перейти к дате</h2><p class="muted">Перемести график к нужному дню, сохранив длительность свечи.</p><form id="goto-date-form"><label>Дата<input type="date" name="date" min="1900-01-01" max="${localDate()}" value="${selected}" required></label><button class="primary" type="submit">Перейти</button></form>`,
  );
  d.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    chooseDay(e.currentTarget.elements.date.value);
    autoRange = false;
    manualPriceRange = null;
    autoLayout = false;
    end = selected;
    intradayEnd = Math.min(chartHorizon(), minuteAt(shiftDate(selected, 1)));
    measureStart = measureEnd = null;
    drawStart = null;
    d.close();
    render();
  };
}
function drawAnnotations() {
  const layer = $("#drawing-layer");
  if (!layer || !geometry || hideDrawings || !visible.length) return;
  const { left, top, pw, ph, x, y, step } = geometry;
  const px = (time) =>
    x(chartIndexAtTime(geometry.times, time, interval));
  layer.innerHTML = `<defs><marker id="trend-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="none" stroke="var(--accent)"/></marker><clipPath id="drawing-clip"><rect x="${left}" y="${top}" width="${pw}" height="${ph}"/></clipPath></defs><g clip-path="url(#drawing-clip)">${drawings()
    .map((d) =>
      d.type === "vertical"
        ? `<line class="drawn-vertical" x1="${px(d.time)}" x2="${px(d.time)}" y1="${top}" y2="${top + ph}" stroke="var(--accent)" stroke-width="1.5"/>`
        : d.type === "level"
          ? `<g class="drawn-level"><line x1="${left}" x2="${left + pw}" y1="${y(d.value)}" y2="${y(d.value)}" stroke="var(--accent)" stroke-dasharray="7 4"/><text x="${left + 8}" y="${y(d.value) - 7}" fill="var(--accent)" font-size="12">Уровень ${axisText(d.value)}</text></g>`
          : `<line class="drawn-trend" data-drawing-type="${d.type}" marker-end="${d.type === "arrow" ? "url(#trend-arrow)" : "none"}" x1="${px(d.a.time)}" y1="${y(d.a.value)}" x2="${px(d.b.time)}" y2="${y(d.b.value)}" stroke="var(--accent)" stroke-width="1.5"/>`,
    )
    .join(
      "",
    )}${drawStart ? `<circle cx="${px(drawStart.time)}" cy="${y(drawStart.value)}" r="4" fill="var(--accent)"/>` : ""}</g>`;
}
function calendarAxisLabel(date) {
  const acrossYears =
    visible[0]?.date.slice(0, 4) !== visible.at(-1)?.date.slice(0, 4);
  return new Date(date + "T12:00:00").toLocaleDateString(
    "ru-RU",
    interval === 525600
      ? { year: "numeric" }
      : interval >= 43200
        ? { month: "short", year: "numeric" }
        : {
            day: "numeric",
            month: "short",
            ...(acrossYears ? { year: "numeric" } : {}),
          },
  );
}
function prepareChartView(range) {
  if (!visible.length) {
    visualBars = [];
    averageValues = [];
    return;
  }
  let prefix = [];
  const warmup = chartStyle === "heikin" ? 96 : 28;
  if (chartStyle === "heikin" || showAverage) {
    if (interval >= 1440)
      prefix = calendarBars(
        candles,
        journal.settings.initial,
        shiftDate(visible[0].date, -Math.ceil((interval / 1440) * warmup)),
        shiftDate(visible[0].date, -1),
        interval,
      );
    else
      prefix = timeline(
        candles,
        journal.settings.initial,
        interval,
        visible[0].from - warmup * interval,
        visible[0].from,
        journal.settings.interpolate,
        nowMinute(),
        journal.settings.rhythmStrength ?? 4,
      );
  }
  const raw = [...prefix, ...visible];
  const display = chartStyle === "heikin" ? heikinAshi(raw) : raw;
  visualBars = display.slice(prefix.length);
  if (!showAverage) {
    averageValues = {};
    return;
  }
  const firstDate = periodStart(candles[0]?.date ?? localDate(), interval);
  const firstObserved = display.findIndex(
    (c) => (c.endDate ?? c.date) >= firstDate,
  );
  averageValues = Object.fromEntries(
    averagePeriods.map((n) => [
      n,
      (firstObserved < 0
        ? display.map(() => null)
        : [
            ...Array(firstObserved).fill(null),
            ...movingAverage(display.slice(firstObserved), n),
          ]
      ).slice(prefix.length),
    ]),
  );
}
function averageMarkup() {
  return averagePeriods
    .map((n) => {
      const points = averageValues[n]
        .map((v, i) =>
          v === null ? null : `${geometry.x(i)},${geometry.y(v)}`,
        )
        .filter(Boolean);
      return points.length
        ? `<polyline class="average-line" data-average-period="${n}" points="${points.join(" ")}" fill="none" stroke="${averageColors[n]}" stroke-width="1.6"/>`
        : "";
    })
    .join("");
}
function drawMeasurement() {
  const layer = $("#measure-layer"),
    output = $("#measure-output");
  if (!layer || !output || !geometry) return;
  layer.innerHTML = "";
  if (!measuring || measureStart === null) {
    output.textContent = measuring ? "Выбери первую свечу" : "";
    return;
  }
  const a = visualBars[measureStart],
    b = visualBars[measureEnd ?? measureStart];
  if (!a || !b) return;
  const x1 = geometry.x(measureStart),
    x2 = geometry.x(measureEnd ?? measureStart),
    y1 = geometry.y(a.close),
    y2 = geometry.y(b.close);
  layer.innerHTML = `<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.max(2, Math.abs(x2 - x1))}" height="${Math.max(2, Math.abs(y2 - y1))}" fill="var(--accent)" opacity=".14"/><path d="M${x1} ${y1}L${x2} ${y2}" stroke="var(--accent)" stroke-width="2"/><circle cx="${x1}" cy="${y1}" r="4" fill="var(--accent)"/>`;
  const delta = round(b.close - a.close),
    minutes = Math.abs(barTime(b) - barTime(a));
  output.textContent =
    measureEnd === null
      ? "Теперь выбери вторую свечу"
      : `${signed(delta)} (${pct(percentage(delta, a.close))}) · ${Math.abs(measureEnd - measureStart)} свечей · ${minutes >= 1440 ? (minutes / 1440).toFixed(1) + " д" : Math.round((minutes / 60) * 10) / 10 + " ч"}`;
}
function drawDenseChartCanvas(canvas, bars, volumes, drawCandles) {
  const { width, height, left, top, pw, ph, x, y, step } = geometry;
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.ceil(width * pixelRatio);
  const pixelHeight = Math.ceil(height * pixelRatio);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  const colors = getComputedStyle($("#chart"));
  const token = (name, fallback) => colors.getPropertyValue(name).trim() || fallback;
  const up = token("--up", "#19b77a");
  const down = token("--down", "#ed4968");
  const muted = token("--muted", "#8290a0");
  const surface = token("--surface", "#15171d");
  const byColumn = new Map();

  if (drawCandles) {
    context.save();
    context.beginPath();
    context.rect(left, top, geometry.pw, geometry.ph);
    context.clip();
    for (let i = 0; i < bars.length; i++) {
      const candle = visualBars[i] ?? bars[i];
      const column = Math.floor(x(i) * pixelRatio);
      let bucket = byColumn.get(column);
      if (!bucket) {
        bucket = {
          open: candle.open,
          close: candle.close,
          high: candle.high,
          low: candle.low,
          previousClose: visualBars[i - 1]?.close ?? candle.open,
          active: Boolean(candle.recorded || candle.synthetic),
          soft: Boolean(candle.intraday && !candle.recorded),
        };
        byColumn.set(column, bucket);
      } else {
        bucket.close = candle.close;
        bucket.high = Math.max(bucket.high, candle.high);
        bucket.low = Math.min(bucket.low, candle.low);
        bucket.active ||= Boolean(candle.recorded || candle.synthetic);
        bucket.soft &&= Boolean(candle.intraday && !candle.recorded);
      }
    }

    const paths = new Map();
    const bodies = [];
    const lineWidth = 1 / pixelRatio;
    const bodyWidth = Math.min(1 / pixelRatio, Math.max(0.55 / pixelRatio, step * 0.82));
    const addPath = (color, alpha, column, bucket) => {
      const key = `${color}|${alpha}`;
      let path = paths.get(key);
      if (!path) {
        path = { color, alpha, segments: [] };
        paths.set(key, path);
      }
      path.segments.push([column, bucket]);
    };
    for (const [column, bucket] of byColumn) {
      const center = (column + 0.5) / pixelRatio;
      if (!bucket.active) {
        addPath(muted, 0.3, column, bucket);
        continue;
      }
      const delta = chartStyle === "hollow"
        ? bucket.close - bucket.previousClose
        : bucket.close - bucket.open;
      const color = delta > 0 ? up : delta < 0 ? down : muted;
      addPath(color, bucket.soft ? 0.75 : 1, column, bucket);
      if (chartStyle !== "bars")
        bodies.push({ center, bucket, color, hollow: chartStyle === "hollow" && delta > 0 });
    }
    for (const path of paths.values()) {
      context.beginPath();
      for (const [column, bucket] of path.segments) {
        const center = (column + 0.5) / pixelRatio;
        if (!bucket.active) {
          const gapWidth = Math.min(4, Math.max(1 / pixelRatio, step * 0.8));
          context.moveTo(center - gapWidth / 2, y(bucket.close));
          context.lineTo(center + gapWidth / 2, y(bucket.close));
        } else if (chartStyle === "bars") {
          const half = bodyWidth / 2;
          context.moveTo(center, y(bucket.high));
          context.lineTo(center, y(bucket.low));
          context.moveTo(center - half, y(bucket.open));
          context.lineTo(center, y(bucket.open));
          context.moveTo(center, y(bucket.close));
          context.lineTo(center + half, y(bucket.close));
        } else {
          context.moveTo(center, y(bucket.high));
          context.lineTo(center, y(bucket.low));
        }
      }
      context.strokeStyle = path.color;
      context.globalAlpha = path.alpha;
      context.lineWidth = lineWidth;
      context.stroke();
    }
    context.globalAlpha = 1;
    for (const body of bodies) {
      const top = Math.min(y(body.bucket.open), y(body.bucket.close));
      const bodyHeight = Math.max(2, Math.abs(y(body.bucket.close) - y(body.bucket.open)));
      const left = body.center - bodyWidth / 2;
      context.fillStyle = body.hollow ? surface : body.color;
      context.fillRect(left, top, bodyWidth, bodyHeight);
      if (body.hollow) {
        context.strokeStyle = body.color;
        context.lineWidth = lineWidth;
        context.strokeRect(left, top, bodyWidth, bodyHeight);
      }
    }
    context.restore();
  }

  if (journal.settings.showVolume === false) return;
  const volumeColumns = new Map();
  let peak = 0;
  for (let i = 0; i < volumes.length; i++) {
    const column = Math.floor(x(i) * pixelRatio);
    let bucket = volumeColumns.get(column);
    if (!bucket) {
      bucket = { value: 0, height: 0, direction: 0 };
      volumeColumns.set(column, bucket);
    }
    bucket.value += volumes[i].value;
    bucket.height = Math.max(bucket.height, volumes[i].height);
    bucket.direction += bars[i].close - bars[i].open;
    peak = Math.max(peak, bucket.value);
  }
  const base = height - 38;
  const columnWidth = 1 / pixelRatio;
  for (const [column, bucket] of volumeColumns) {
    const real = bucket.value > 0;
    const barHeight = real ? (bucket.value / peak) * 70 * 0.68 : bucket.height;
    context.fillStyle = token(`--${volumeTone(bucket.value, bucket.direction)}`, muted);
    context.globalAlpha = real ? 0.48 : 0.12;
    context.fillRect((column + 0.5) / pixelRatio - columnWidth / 2, base - barHeight, columnWidth, barHeight);
  }
  context.globalAlpha = 1;
}
function candleElevationMarkup(bars) {
  const lifts = new Map();
  for (let i = 0; i < bars.length; i++) {
    const candle = bars[i];
    if (!candle.recorded || !candle.events?.length) continue;
    const amount = eventVolume(candle.events);
    if (!amount) continue;
    let net = candle.events.reduce((sum, event) => sum + (event.deletedAt ? 0 : event.delta), 0);
    if (!net) {
      const strongest = candle.events.filter(event => !event.deletedAt).reduce((best, event) =>
        !best || Math.abs(event.delta) > Math.abs(best.delta) ? event : best, null);
      net = strongest?.delta ?? 0;
    }
    const direction = Math.sign(net);
    if (!direction) continue;
    for (const distance of [1, 2, 3]) {
      const weight = [0, .12, .055, .02][distance];
      for (const neighborIndex of [i - distance, i + distance]) {
        if (neighborIndex < 0 || neighborIndex >= bars.length) continue;
        const height = amount * weight;
        const previous = lifts.get(neighborIndex);
        if (!previous || height > previous.height)
          lifts.set(neighborIndex, { height, direction });
      }
    }
  }
  return [...lifts.entries()].map(([i, lift]) => {
    const candle = visualBars[i] ?? bars[i];
    const from = candle.close;
    const to = from + lift.direction * lift.height;
    const y1 = geometry.y(from), y2 = geometry.y(to);
    const width = Math.max(2, Math.min(geometry.step * 1.15, geometry.bw * 1.7));
    return `<rect x="${geometry.x(i) - width / 2}" y="${Math.min(y1, y2)}" width="${width}" height="${Math.max(2, Math.abs(y2 - y1))}" rx="1" fill="var(--${lift.direction > 0 ? "up" : "down"})"/>`;
  }).join("");
}
function candleMarkup(real, i, focus = false) {
  const c = visualBars[i] ?? real;
  const { x, y, bw } = geometry,
    xx = x(i),
    bodyY = Math.min(y(c.open), y(c.close)),
    h = Math.max(2, Math.abs(y(c.close) - y(c.open)));
  const delta =
    chartStyle === "hollow"
      ? c.close - (visualBars[i - 1]?.close ?? c.open)
      : c.close - c.open;
  const color =
    delta > 0 ? "var(--up)" : delta < 0 ? "var(--down)" : "var(--muted)";
  if (["line", "baseline"].includes(chartStyle) && focus)
    return `<circle cx="${xx}" cy="${y(c.close)}" r="4" fill="var(--accent)"/>`;
  if (!c.recorded && !c.synthetic)
    return `<path class="${focus ? "focused-candle" : "gap-candle"}" data-future="${!!c.future}" d="M${xx - Math.min(2, bw / 2)} ${y(c.close)}h${Math.min(4, bw)}" stroke="var(--muted)" opacity="${focus ? 1 : 0.3}"/>`;
  const marks =
    chartStyle === "bars"
      ? `<path class="ohlc-bar" d="M${xx} ${y(c.high)}V${y(c.low)}M${xx - bw / 2} ${y(c.open)}H${xx}M${xx} ${y(c.close)}H${xx + bw / 2}" stroke="${color}" stroke-width="1.5" fill="none"/>`
      : `<line x1="${xx}" x2="${xx}" y1="${y(c.high)}" y2="${y(c.low)}" stroke="${color}"/><rect class="candle-body" x="${xx - bw / 2}" y="${bodyY}" width="${bw}" height="${h}" fill="${chartStyle === "hollow" && c.close >= c.open ? "var(--surface)" : color}" stroke="${color}" stroke-width="1"/>`;
  return `<g class="${focus ? "focused-candle" : "chart-candle"}" style="--candle-color:${c.close >= c.open ? "var(--up)" : "var(--down)"}" data-candle-index="${i}" data-recorded="${!!c.recorded}" data-synthetic="${!!c.synthetic}" data-future="${!!c.future}" opacity="${c.intraday && !c.recorded && !focus ? 0.75 : 1}">${marks}</g>`;
}
function candleAtPointer(e) {
  const r = $("#chart").getBoundingClientRect();
  return hitCandle(
    visualBars,
    geometry,
    chartStyle,
    ((e.clientX - r.left) * geometry.width) / r.width,
    ((e.clientY - r.top) * geometry.height) / r.height,
    12,
    groupMoments,
  );
}
function selectHover(index, lock = false, horizontalTravel = 0) {
  if (!visible.length) return;
  index = Math.max(0, Math.min(visible.length - 1, index));
  const scroll =
    hover === index ? ($("#hover-card .hover-scroll")?.scrollTop ?? 0) : 0;
  hover = index;
  if ($("#selection-status"))
    $("#selection-status").textContent =
      `${visible[index].intraday ? visible[index].time : shortDate(visible[index].date)} · ${visible[index].events.length} событий${visible[index].recorded ? "" : " · рисунок не меняет итог; объём декоративный"}`;
  pinned = lock;
  clearTimeout(hoverTimer);
  const c = visible[index],
    { x, y, height, top, width, right, bw } = geometry;
  if (horizontalTravel > 0) hoverCardSide = "left";
  else if (horizontalTravel < 0) hoverCardSide = "right";
  else if (!hoverCardSide)
    hoverCardSide = x(index) > width * 0.5 ? "left" : "right";
  const display = visualBars[index] ?? c;
  const [firstMoment, lastMoment] = groupMoments
    ? momentRun(visible, index)
    : [index, index];
  const selectedCandles = Array.from(
    { length: lastMoment - firstMoment + 1 },
    (_, j) => candleMarkup(visible[firstMoment + j], firstMoment + j, true),
  ).join("");
  $("#focus-candle").innerHTML =
    `<line x1="${x(index)}" x2="${x(index)}" y1="${top}" y2="${height - 35}" class="crosshair"/><line x1="${geometry.left}" x2="${width - right}" y1="${y(display.close)}" y2="${y(display.close)}" class="crosshair"/><rect class="focus-band" x="${Math.max(geometry.left, x(firstMoment) - geometry.step / 2)}" y="${top}" width="${geometry.step * (lastMoment - firstMoment + 1)}" height="${height - top - 38}" fill="var(--accent)" fill-opacity=".035" stroke="var(--accent)" stroke-opacity=".14" stroke-width=".75" rx="8"/>${selectedCandles}<rect x="${Math.max(geometry.left, Math.min(width - right - 78, x(index) - 39))}" y="${height - 29}" width="78" height="24" rx="3" fill="var(--surface-raised)" stroke="var(--line)"/><text x="${Math.max(geometry.left + 39, Math.min(width - right - 39, x(index)))}" y="${height - 13}" text-anchor="middle" class="focus-axis-label">${c.intraday ? c.time : calendarAxisLabel(c.date)}</text>`;
  document.body.classList.toggle("focus-mode", pinned || readingCard);
  let card = $("#hover-card");
  if (!card) {
    card = document.createElement("div");
    card.id = "hover-card";
    card.className = "hover-card";
    card.setAttribute("role", "region");
    card.setAttribute("aria-live", "polite");
    card.setAttribute("aria-label", "Описание выбранного дня");
    $("#chart").append(card);

    card.onmouseleave = () => {
      if (!pinned) {
        readingCard = false;
        card.classList.remove("reading-card");
        document.body.classList.remove("focus-mode");
        hoverTimer = setTimeout(clearFocus, 230);
      }
    };
  }
  card.classList.toggle(
    "moment-card",
    Boolean(c.intraday && !c.recorded && groupMoments),
  );
  const cw = Math.min(pinned ? 304 : 252, width - 30),
    maxCardLeft = Math.max(12, width - cw - 12),
    preferredCardLeft =
      hoverCardSide === "left" ? x(index) - cw - 14 : x(index) + 14,
    cx = Math.max(12, Math.min(maxCardLeft, preferredCardLeft));
  card.style.width = cw + "px";
  card.style.left = cx + "px";
  card.style.top = "22px";
  card.dataset.dockSide = hoverCardSide;
  card.style.maxHeight =
    Math.max(
      180,
      Math.min(pinned ? 480 : 218, innerHeight - $("#chart").getBoundingClientRect().top - 42),
    ) + "px";
  card.innerHTML = `<div class="hover-top"><span>${c.aggregate ? shortDate(c.date) + " — " + fullDate(c.endDate) : fullDate(c.date)}</span><span>${pinned ? "ЗАКРЕПЛЕНО" : c.aggregate ? "ТВОЙ ПЕРИОД" : "ТВОЙ ДЕНЬ"}</span></div><h3>${esc(candleTitle(c))}</h3><div class="hover-delta ${direction(c.delta)}">${signed(c.delta)} <small>(${pct(c.percent)})</small></div>${c.percent === null ? '<p class="micro">Процент не определён: начальное значение равно нулю.</p>' : ""}${c.note ? `<p class="hover-note">${esc(c.note)}</p>` : ""}<div class="hover-events">${c.events.map((e) => `<div><span>${c.aggregate ? shortDate(e.date) + " · " : ""}${esc(e.text)}</span><strong class="${direction(e.delta)}">${signed(e.delta)} <small>(${pct(e.percent)})</small></strong></div>`).join("") || `<p class="muted">${c.recorded ? "День сохранён без событий." : "В этот день пока нет записей."}</p>`}</div><div class="hover-ohlc"><span>Начало <b>${fmt(c.open)}</b></span><span>Итог <b>${fmt(c.close)}</b></span><span>Мин. <b>${fmt(c.low)}</b></span><span>Макс. <b>${fmt(c.high)}</b></span></div><button id="open-hover-day" class="text-button">Открыть день ${icon("right", 13)}</button>`;
  if (chartStyle === "heikin") {
    const explanation = document.createElement("p");
    explanation.className = "interpolation-note";
    explanation.textContent =
      "Heikin Ashi сглаживает рисунок свечей. Здесь показаны реальные значения и события.";
    card.querySelector("h3").after(explanation);
  }
  if (c.intraday) {
    card.querySelector(".hover-top").innerHTML =
      `<span>${shortDate(c.date)} · ${c.time}–${c.endTime}</span><span>${pinned ? "ЗАКРЕПЛЕНО" : "ВНУТРИ ДНЯ"}</span>`;
    if (!c.recorded)
      card.querySelector("h3").textContent = c.synthetic
        ? "Промежутки"
        : "Без новых событий";
    if (c.recorded) {
      const actualPercent = percentage(
        c.realDelta,
        c.events[0]?.before ?? c.open,
      );
      card.querySelector(".hover-delta").className =
        "hover-delta " + direction(c.realDelta);
      card.querySelector(".hover-delta").innerHTML =
        `${signed(c.realDelta)} <small>(${pct(actualPercent)})</small>`;
    }
    if (c.synthetic && !c.recorded) {
      const note = document.createElement("p");
      note.className = "interpolation-note";
      note.textContent =
        "Визуальная интерполяция. Эти колебания не меняют итог дня.";
      card.querySelector(".hover-delta").after(note);
    }
  }
  if (c.intraday && !c.recorded) {
    let lo = 0,
      hi = observations.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (observations[mid].at < c.from) lo = mid + 1;
      else hi = mid;
    }
    const previous = observations[lo - 1],
      next = observations[lo];
    const context = document.createElement("div");
    context.className = "moment-context";
    context.innerHTML = `<p><b>Предыдущее событие</b><br>${previous ? `${shortDate(previous.date)} ${previous.time} · ${esc(previous.text)}` : "Начало истории"}</p><p><b>Следующее событие</b><br>${next ? `${shortDate(next.date)} ${next.time} · ${esc(next.text)}` : "Пока не записано"}</p>`;
    card.querySelector(".hover-events").replaceChildren(context);
    if (groupMoments) {
      const first = visible[firstMoment],
        last = visible[lastMoment];
      card.querySelector("h3").textContent = "Промежутки · весь участок";
      card.querySelector(".hover-top span").textContent =
        `${previous ? shortDate(previous.date) + " " + previous.time : "Начало"} — ${next ? shortDate(next.date) + " " + next.time : "сейчас"}`;
      card
        .querySelector(".hover-delta")
        .insertAdjacentHTML(
          "beforebegin",
          `<p class="visual-label">ВИЗУАЛЬНАЯ СВЕЧА · ${c.time}–${c.endTime}</p>`,
        );
      card.querySelector(".hover-ohlc").innerHTML =
        `<span>Начало <b>${fmt(first.open)}</b></span><span>Итог <b>${fmt(last.close)}</b></span><span>Свечей <b>${lastMoment - firstMoment + 1}</b></span>`;
    }
  }
  if (c.starter) {
    card.querySelector("h3").textContent = "Стартовый ритм";
    card.querySelector(".interpolation-note").textContent =
      "Временный рисунок, не событие. Новая запись убирает одну стартовую свечу. Итог не меняется.";
    card.querySelector(".hover-events").innerHTML = "";
  }
  const pinButton = document.createElement("button");
  pinButton.id = "pin-hover";
  pinButton.className = "text-button";
  pinButton.textContent = pinned
    ? "Открепить карточку"
    : "Закрепить карточку · ПКМ";
  pinButton.onclick = (e) => {
    e.stopPropagation();
    selectHover(index, !pinned);
  };
  pinButton.textContent = pinned ? "Открепить" : "Закрепить";
  card.classList.toggle("reading-card", pinned);
  card.querySelector(".hover-top span:last-child").replaceWith(pinButton);
  const body = document.createElement("div");
  body.className = "hover-scroll";
  body.tabIndex = 0;
  for (const child of [...card.children]) {
    if (!child.matches(".hover-top,.hover-ohlc,#open-hover-day"))
      body.append(child);
  }
  card.querySelector(".hover-top").after(body);
  body.scrollTop = scroll;
  pinButton.setAttribute("aria-pressed", String(pinned));
  $("#open-hover-day").onclick = (e) => {
    e.stopPropagation();
    chooseDay(c.endDate ?? c.date);
    clearFocus();
    renderDay();
    renderLedger();
    openDayDetails(c.endDate ?? c.date);
  };
}
function openDayDetails(date) {
  const day = dayData(date);
  const dialog = modal(
    `<div class="modal-eyebrow">${fullDate(date)}</div><h2>${esc(day.title || "События дня")}</h2>${day.note ? `<p class="day-detail-note">${esc(day.note)}</p>` : ""}${dayTotalMarkup(day)}<div class="day-detail-events">${eventRows(day) || "<p>В этот день нет событий.</p>"}</div><div class="form-footer"><button id="detail-note" class="secondary">Описание дня</button><button id="detail-add" class="primary">Добавить событие</button></div>`,
  );
  dialog.classList.add("day-detail-modal");
  bindEventActions(dialog);
  dialog.querySelector("#detail-note").onclick = () => dayForm(date);
  dialog.querySelector("#detail-add").onclick = () => eventForm(null, date);
}
function pan(amount) {
  autoLayout = false;
  clearFocus();
  if (interval < 1440) {
    intradayEnd = Math.min(maxPanEnd(),
      (intradayEnd ?? nowMinute()) +
      Math.sign(amount) *
        Math.max(
          interval,
          Math.round((intradayCount * 0.6) / interval) * interval,
        ));
    measureStart = measureEnd = null;
    drawChart();
    return;
  }
  if (span === 0) span = journal?.settings.chartDensity ?? 45;
  const shifted = shiftDate(end, amount);
  end = shifted > maxPanEnd() ? maxPanEnd() : shifted;
  measureStart = measureEnd = null;
  drawChart();
}
function updateDraggedChart() {
  dragFrame = null;
  if (!drag) return;
  const deltaX = drag.clientX - drag.x;
  const deltaY = drag.clientY - drag.y;
  const barShift = Math.round((drag.clientX - drag.x) / drag.step);
  let timelineChanged = false;
  if (barShift !== drag.lastShift) {
    drag.lastShift = barShift;
    if (interval < 1440) {
      const earliest = minuteAt(candles[0]?.date ?? localDate());
      const target = Math.min(
        maxPanEnd(),
        Math.max(earliest + 1, drag.intradayEnd - barShift * interval),
      );
      if (target !== intradayEnd) {
        intradayEnd = target;
        timelineChanged = true;
      }
    } else {
      if (span === 0) span = Math.min(3650, visible.length);
      const shifted = shiftDate(
        drag.end,
        -barShift * Math.round(interval / 1440),
      );
      const bounds = boundaries();
      const target = shifted < bounds.earliest
        ? bounds.earliest
        : shifted > maxPanEnd()
          ? maxPanEnd()
          : shifted;
      if (target !== end) {
        end = target;
        timelineChanged = true;
      }
    }
  }
  const verticalIntent =
    drag.pricePanning ||
    (Math.abs(deltaY) > 10 && Math.abs(deltaY) >= Math.abs(deltaX) * 0.65);
  const canPanVertically = !autoRange;
  if (!timelineChanged && !(verticalIntent && canPanVertically)) return;
  if (verticalIntent && canPanVertically) {
    drag.pricePanning = true;
    manualPriceRange = shiftPriceRange(
      drag.priceOrigin,
      deltaY,
      drag.plotHeight,
    );
  }
  autoLayout = false;
  measureStart = measureEnd = null;
  drawChart();
}
function updateDraggedPriceRange() {
  priceDragFrame = null;
  if (!priceDrag || !geometry || autoRange) return;
  manualPriceRange = shiftPriceRange(
    priceDrag.origin,
    priceDrag.currentY - priceDrag.y,
    priceDrag.plotHeight,
  );
  drawChart();
}
function updatePriceWheelScale() {
  priceWheelFrame = null;
  if (!geometry || !priceWheelDelta) return;
  const delta = priceWheelDelta;
  priceWheelDelta = 0;
  if (autoRange) return;
  disableAutoRange();
  manualPriceRange = scalePriceRange(
    manualPriceRange ?? { low: geometry.low, high: geometry.high },
    Math.pow(1.2, delta / 100),
    priceWheelAnchor,
  );
  drawChart();
}
function zoom(factor) {
  autoLayout = false;
  clearFocus();
  measureStart = measureEnd = null;
  if (interval < 1440) {
    intradayCount = Math.max(
      interval * 7,
      Math.min(
        interval * MAX_BARS,
        Math.round((intradayCount * factor) / interval) * interval,
      ),
    );
    drawChart();
    return;
  }
  const current = span || visible.length;
  span = Math.max(
    Math.ceil((interval / 1440) * 3),
    Math.min(36500, Math.round(current * factor)),
  );
  drawChart();
}
function flushChartWheel(timestamp) {
  if (timestamp - wheelLastDraw < 40) {
    wheelFrame = requestAnimationFrame(flushChartWheel);
    return;
  }
  const delta = wheelDelta;
  const shouldPan = wheelPan;
  wheelDelta = 0;
  wheelPan = false;
  if (!delta) {
    wheelFrame = null;
    return;
  }
  if (shouldPan) {
    wheelRemainder = 0;
    wheelLastDraw = timestamp;
    wheelFrame = null;
    pan(Math.sign(delta) * 3);
    return;
  }
  wheelRemainder += delta;
  const notches = Math.trunc(wheelRemainder / 100);
  if (!notches) {
    wheelFrame = null;
    return;
  }
  wheelRemainder -= notches * 100;
  wheelLastDraw = timestamp;
  wheelFrame = null;
  zoom(Math.pow(1.2, notches));
}
function bindChart() {
  $("#previous").onclick = () =>
    pan(-Math.max(1, Math.round((span || 30) * 0.6)) * Math.max(1, Math.round(interval / 1440)));
  $("#next").onclick = () => pan(Math.max(1, Math.round((span || 30) * 0.6)) * Math.max(1, Math.round(interval / 1440)));
  $("#today").onclick = () => {
    autoLayout = false;
    measureStart = measureEnd = null;
    end = localDate();
    chooseDay(localDate());
    intradayEnd = Math.min(chartHorizon(), minuteAt(shiftDate(selected, 1)));
    if (span === 0) span = journal?.settings.chartDensity ?? 45;
    render();
  };
  $("#auto-range").onclick = () => {
    if (autoRange) {
      disableAutoRange();
      drawChart();
    } else {
      autoRange = true;
      manualPriceRange = null;
      drawChart();
    }
  };
  $("#zoom-in").onclick = () => zoom(0.65);
  $("#zoom-out").onclick = () => zoom(1.5);
  $("#group-moments").onclick = () => {
    groupMoments = !groupMoments;
    try {
      localStorage.setItem(
        "vyshe-moment-selection",
        groupMoments ? "group" : "single",
      );
    } catch {}
    render();
  };
  setHelp(
    $("#group-moments"),
    "Промежутки",
    "Включи, чтобы подсвечивать весь промежуток без новых событий. Выключи для выбора одной свечи. В карточке показаны соседние реальные записи.",
  );
  const chart = $("#chart");
  const beginChartDrag = (e) => {
    const hit = candleAtPointer(e);
    clearFocus();
    drag = {
      x: e.clientX,
      y: e.clientY,
      end,
      intradayEnd,
      step: geometry.step,
      clientX: e.clientX,
      clientY: e.clientY,
      priceOrigin: { low: geometry.low, high: geometry.high },
      plotHeight: geometry.ph,
      lastShift: 0,
      moved: false,
      hit,
    };
    chart.setPointerCapture(e.pointerId);
  };
  const volumeHandle = $("#volume-resizer");
  let volumeResize = null,
    volumeResizeFrame = null,
    volumeResizeY = 0;
  const applyVolumeResize = (clientY) => {
    if (!volumeResize || !geometry) return;
    setVolumePanelHeight(
      volumeResize.height + volumeResize.y - clientY,
      geometry.height,
    );
    drawChart();
  };
  const finishVolumeResize = (clientY) => {
    if (!volumeResize) return;
    if (volumeResizeFrame !== null) cancelAnimationFrame(volumeResizeFrame);
    volumeResizeFrame = null;
    applyVolumeResize(clientY ?? volumeResizeY);
    volumeResize = null;
    saveVolumePanelHeight();
    document.body.classList.remove("volume-resizing");
  };
  volumeHandle.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (e.button !== 0 || volumeHandle.hidden || !geometry) return;
    e.preventDefault();
    volumeResize = {
      y: e.clientY,
      height: geometry.volumePanelHeight,
    };
    volumeResizeY = e.clientY;
    volumeHandle.setPointerCapture(e.pointerId);
    document.body.classList.add("volume-resizing");
  });
  volumeHandle.addEventListener("pointermove", (e) => {
    e.stopPropagation();
    if (!volumeResize) return;
    volumeResizeY = e.clientY;
    if (volumeResizeFrame !== null) return;
    volumeResizeFrame = requestAnimationFrame(() => {
      volumeResizeFrame = null;
      applyVolumeResize(volumeResizeY);
    });
  });
  volumeHandle.addEventListener("pointerup", (e) => {
    e.stopPropagation();
    finishVolumeResize(e.clientY);
  });
  volumeHandle.addEventListener("pointercancel", (e) => {
    e.stopPropagation();
    finishVolumeResize(volumeResizeY);
  });
  volumeHandle.addEventListener("lostpointercapture", () => {
    if (volumeResize) finishVolumeResize(volumeResizeY);
  });
  volumeHandle.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetVolumePanelHeight();
    drawChart();
  });
  volumeHandle.addEventListener("keydown", (e) => {
    if (!geometry) return;
    const { max } = volumePanelBounds(geometry.height);
    let next = getVolumePanelHeight(geometry.height);
    if (e.key === "Home") next = resetVolumePanelHeight();
    else if (e.key === "End") next = max;
    else if (e.key === "ArrowUp") next += e.shiftKey ? 32 : 12;
    else if (e.key === "ArrowDown") next -= e.shiftKey ? 32 : 12;
    else return;
    e.preventDefault();
    e.stopPropagation();
    setVolumePanelHeight(next, geometry.height);
    saveVolumePanelHeight();
    drawChart();
  });
  chart.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".hover-card") || drawTool || measuring) return;
    const index = candleAtPointer(e);
    if (index === null) return;
    e.preventDefault();
    selectHover(index, !(pinned && hover === index));
  });
  chart.addEventListener("pointermove", (e) => {
    if (!visible.length || !geometry) return;
    const bounds = chart.getBoundingClientRect();
    const pointerX = ((e.clientX - bounds.left) * geometry.width) / bounds.width;
    const pointerY = ((e.clientY - bounds.top) * geometry.height) / bounds.height;
    const inPlot =
      pointerX >= geometry.left &&
      pointerX <= geometry.width - geometry.right &&
      pointerY >= geometry.top &&
      pointerY <= geometry.height - geometry.bottom;
    chart.classList.toggle(
      "price-axis-ready",
      !autoRange &&
      !drawTool &&
        !measuring &&
        pointerX >= geometry.width - geometry.right &&
        pointerX <= geometry.width &&
        pointerY >= geometry.top &&
        pointerY <= geometry.height - geometry.bottom,
    );
    chart.classList.toggle("price-pan-ready", e.shiftKey && inPlot);
    const horizontalTravel =
      lastChartPointerX === null ? 0 : e.clientX - lastChartPointerX;
    lastChartPointerX = e.clientX;
    if (e.target.closest(".hover-card,.chart-empty")) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
      return;
    }
    if (priceDrag) {
      priceDrag.currentY = e.clientY;
      if (priceDragFrame === null)
        priceDragFrame = requestAnimationFrame(updateDraggedPriceRange);
      return;
    }
    if (drag) {
      drag.clientX = e.clientX;
      drag.clientY = e.clientY;
      if (
        Math.abs(drag.clientX - drag.x) > 6 ||
        Math.abs(drag.clientY - drag.y) > 6
      ) {
        drag.moved = true;
        if (dragFrame === null) dragFrame = requestAnimationFrame(updateDraggedChart);
      }
      return;
    }
    if (measuring || drawTool || pinned || readingCard || !visible.length)
      return;
    const index = candleAtPointer(e);
    if (index === null) {
      if (hover !== null && !hoverTimer)
        hoverTimer = setTimeout(clearFocus, 700);
      return;
    }
    clearTimeout(hoverTimer);
    hoverTimer = null;
    if (index !== hover) selectHover(index, false, horizontalTravel);
  });
  chart.addEventListener("pointerleave", () => {
    lastChartPointerX = null;
    if (!priceDrag) chart.classList.remove("price-axis-ready");
    if (!pinned && !drag) hoverTimer = setTimeout(clearFocus, 450);
  });
  chart.addEventListener("pointerdown", (e) => {
    if (!visible.length || !geometry) return;
    if ((e.button !== 0 && e.button !== 1) || e.target.closest(".hover-card,.chart-empty")) return;
    const r = chart.getBoundingClientRect();
    const xx = ((e.clientX - r.left) * geometry.width) / r.width;
    const yy = ((e.clientY - r.top) * geometry.height) / r.height;
    const inPlot =
      xx >= geometry.left &&
      xx <= geometry.width - geometry.right &&
      yy >= geometry.top &&
      yy <= geometry.height - geometry.bottom;
    if (inPlot && (e.button === 1 || (e.button === 0 && e.shiftKey))) {
      e.preventDefault();
      if (autoRange) {
        beginChartDrag(e);
        return;
      }
      clearFocus();
      priceDrag = {
        y: e.clientY,
        currentY: e.clientY,
        origin: { low: geometry.low, high: geometry.high },
        plotHeight: geometry.ph,
      };
      chart.classList.add("price-axis-dragging", "price-pan-dragging");
      chart.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    if (
      !drawTool &&
      !measuring &&
      xx >= geometry.width - geometry.right &&
      xx <= geometry.width &&
      yy >= geometry.top &&
      yy <= geometry.height - geometry.bottom
    ) {
      e.preventDefault();
      clearFocus();
      priceDrag = {
        y: e.clientY,
        currentY: e.clientY,
        origin: { low: geometry.low, high: geometry.high },
        plotHeight: geometry.ph,
      };
      chart.classList.add("price-axis-dragging");
      chart.setPointerCapture(e.pointerId);
      return;
    }
    if (drawTool) {
      if (
        xx < geometry.left ||
        xx > geometry.width - geometry.right ||
        yy < geometry.top ||
        yy > geometry.height - geometry.bottom
      )
        return;
      const index = (xx - geometry.candleLeft) / geometry.step - 0.5;
      const nearest = Math.round(index);
      let value =
        geometry.high -
        ((yy - geometry.top) / geometry.ph) * (geometry.high - geometry.low);
      if (magnet && nearest >= 0 && nearest < visualBars.length) {
        const bar = visualBars[nearest];
        value = [bar.open, bar.high, bar.low, bar.close].reduce((a, b) =>
          Math.abs(a - value) <= Math.abs(b - value) ? a : b,
        );
      }
      const point = {
        time: chartTimeAtIndex(geometry.times, index, interval),
        value,
      };
      if (drawTool === "level" || drawTool === "vertical") {
        rememberTools();
        drawings().push({ type: drawTool, value, time: point.time });
      } else if (!drawStart) {
        drawStart = point;
        render();
        return;
      } else {
        if (point.time === drawStart.time) {
          toast("Выбери другую свечу для второй точки");
          return;
        }
        rememberTools();
        drawings().push({ type: drawTool, a: drawStart, b: point });
      }
      drawTool = null;
      drawStart = null;
      render();
      return;
    }
    if (measuring) {
      const i = candleAtPointer(e);
      if (i === null) return;
      clearFocus();
      if (measureStart === null || measureEnd !== null) {
        measureStart = i;
        measureEnd = null;
      } else measureEnd = i;
      drawMeasurement();
      return;
    }
    beginChartDrag(e);
  });
  chart.addEventListener("pointerup", (e) => {
    if (priceDrag) {
      priceDrag.currentY = e.clientY;
      if (priceDragFrame !== null) cancelAnimationFrame(priceDragFrame);
      updateDraggedPriceRange();
      priceDrag = null;
      chart.classList.remove("price-axis-dragging", "price-axis-ready", "price-pan-dragging", "price-pan-ready");
      if (chart.hasPointerCapture(e.pointerId))
        chart.releasePointerCapture(e.pointerId);
      return;
    }
    if (!drag) return;
    drag.clientX = e.clientX;
    drag.clientY = e.clientY;
    drag.moved ||=
      Math.abs(drag.clientX - drag.x) > 6 ||
      Math.abs(drag.clientY - drag.y) > 6;
    if (dragFrame !== null) cancelAnimationFrame(dragFrame);
    updateDraggedChart();
    const moved = drag.moved,
      startHit = drag.hit;
    drag = null;
    chart.releasePointerCapture(e.pointerId);
    if (!moved && candles.length) {
      const idx = candleAtPointer(e);
      if (idx === null || idx !== startHit) {
        clearFocus();
        return;
      }
      selectHover(idx, false);
      chooseDay(visible[idx].endDate ?? visible[idx].date);
      renderDay();
      renderLedger();
    }
  });
  chart.addEventListener("pointercancel", () => {
    if (priceDrag) {
      if (priceDragFrame !== null) cancelAnimationFrame(priceDragFrame);
      updateDraggedPriceRange();
      priceDrag = null;
      chart.classList.remove("price-axis-dragging", "price-axis-ready", "price-pan-dragging", "price-pan-ready");
    }
    if (dragFrame !== null) cancelAnimationFrame(dragFrame);
    dragFrame = null;
    drag = null;
    clearFocus();
  });
  chart.addEventListener(
    "wheel",
    (e) => {
      if (e.target.closest(".hover-card")) return;
      if (geometry) {
        const bounds = chart.getBoundingClientRect();
        const pointerX = ((e.clientX - bounds.left) * geometry.width) / bounds.width;
        const pointerY = ((e.clientY - bounds.top) * geometry.height) / bounds.height;
        const overPlotHeight =
          pointerY >= geometry.top &&
          pointerY <= geometry.height - geometry.bottom;
        const overPriceScale =
          pointerX >= geometry.width - geometry.right && pointerX <= geometry.width;
        if (overPlotHeight && (overPriceScale || e.ctrlKey)) {
          e.preventDefault();
          if (autoRange) {
            priceWheelDelta = 0;
            return;
          }
          const pixelDelta = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? chart.clientHeight : 1);
          priceWheelDelta = Math.max(-1000, Math.min(1000, priceWheelDelta + pixelDelta));
          priceWheelAnchor = Math.max(0, Math.min(1, (pointerY - geometry.top) / geometry.ph));
          if (priceWheelFrame === null)
            priceWheelFrame = requestAnimationFrame(updatePriceWheelScale);
          return;
        }
      }
      e.preventDefault();
      const pixelDelta = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? chart.clientHeight : 1);
      wheelDelta = Math.max(-500, Math.min(500, wheelDelta + pixelDelta));
      wheelPan ||= e.shiftKey;
      if (wheelFrame !== null) return;
      wheelFrame = requestAnimationFrame(flushChartWheel);
    },
    { passive: false },
  );
  chart.addEventListener("keydown", (e) => {
    if (e.target !== chart || !visible.length || !geometry) return;
    let index = hover ?? visible.length - 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.key === "ArrowLeft" ? -1 : 1;
      selectHover(index + step, false, step);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectHover(index, false);
      chooseDay(visible[hover].endDate ?? visible[hover].date);
      renderDay();
      renderLedger();
    } else if (e.key.toLowerCase() === "p" || e.key.toLowerCase() === "з") {
      e.preventDefault();
      selectHover(index, !pinned);
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoom(0.7);
    } else if (e.key === "-") {
      e.preventDefault();
      zoom(1.4);
    }
  });
}
function dayData(date) {
  const existing = candles.find((c) => c.date === date);
  if (existing) return existing;
  let value = journal.settings.initial;
  for (const c of candles) {
    if (c.date > date) break;
    value = c.close;
  }
  return {
    date,
    recorded: false,
    events: [],
    title: "",
    note: "",
    open: value,
    close: value,
    delta: 0,
    percent: percentage(0, value),
  };
}
const dayPromptByDate = new Map();
function dailyPromptFor(date) {
  if (!dayPromptByDate.has(date)) {
    dayPromptByDate.set(date, nextDayPrompt());
    if (dayPromptByDate.size > 180)
      dayPromptByDate.delete(dayPromptByDate.keys().next().value);
  }
  return dayPromptByDate.get(date);
}
function eventRows(day, editable = true) {
  const chronological = journal.settings.eventOrder === "time";
  const rows = chronological
    ? day.events
    : [...day.events].sort(
        (a, b) =>
          (b.quickMove?.lastAt ?? b.createdAt).localeCompare(
            a.quickMove?.lastAt ?? a.createdAt,
          ) || b.order - a.order,
      );
  return rows
    .map(
      (e, index) =>
        `<div class="event-row" data-event-id="${e.id}"><span class="event-dot ${direction(e.delta)}">${e.delta >= 0 ? "+" : "−"}</span><div class="event-content">${eventTitleMarkup(e)}<span class="event-time">${esc(e.time ?? "12:00")}</span><span class="event-amount ${direction(e.delta)}"><span class="event-points">${signed(e.delta)}</span><span class="event-percent">(${pct(e.percent)})</span></span>${e.percent === null ? '<span class="micro">База 0: процент не определён</span>' : ""}${editable ? `<div class="event-actions"><button class="text-button" data-edit="${e.id}">Изменить</button>${chronological ? `<button class="icon-button tiny" data-move="${e.id}" data-step="-1" aria-label="Переместить событие выше, обменять время с предыдущим" ${index === 0 ? "disabled" : ""}>${icon("up", 13)}</button><button class="icon-button tiny" data-move="${e.id}" data-step="1" aria-label="Переместить событие ниже, обменять время со следующим" ${index === day.events.length - 1 ? "disabled" : ""}>${icon("down", 13)}</button>` : ""}<button class="icon-button tiny danger-text" data-delete="${e.id}" aria-label="Удалить событие">${icon("trash", 13)}</button></div>` : ""}</div></div>`,
    )
    .join("");
}
function eventTitleMarkup(event) {
  if (!event.quickMove) return `<p>${esc(event.text)}</p>`;
  const count = event.quickMove.count;
  const suffix = ` (x${count})`;
  const title = event.text.endsWith(suffix)
    ? event.text.slice(0, -suffix.length)
    : event.text;
  return `<p class="quick-move-title">${esc(title)} <span class="quick-move-counter" aria-label="x${count}" aria-live="polite" aria-atomic="true">(x<span class="quick-move-count-value" data-count="${count}">${count}</span>)</span></p>`;
}
function dayTotalMarkup(day) {
  return `<div class="day-total"><span>Итог дня</span><strong class="${direction(day.delta)}"><span class="day-total-change">${signed(day.delta)}</span> <small>(<span class="day-total-percent">${pct(day.percent)}</span>)</small></strong></div>`;
}
function animateNumberText(element, fromText, toText, move = "up") {
  if (!element || fromText === toText) return;
  const reduced =
    journal?.settings.reducedMotion ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    element.textContent = toText;
    return;
  }
  const track = document.createElement("span");
  track.className = `number-roll-track roll-${move === "down" ? "down" : "up"}`;
  track.setAttribute("aria-hidden", "true");
  const values = move === "down" ? [toText, fromText] : [fromText, toText];
  for (const value of values) {
    const item = document.createElement("span");
    item.textContent = value;
    track.append(item);
  }
  const oldLabel = element.getAttribute("aria-label");
  element.classList.add("number-rolling");
  element.setAttribute("aria-label", toText);
  element.replaceChildren(track);
  requestAnimationFrame(() => track.classList.add("rolling"));
  window.setTimeout(() => {
    if (!track.isConnected) return;
    element.textContent = toText;
    element.classList.remove("number-rolling");
    if (oldLabel === null) element.removeAttribute("aria-label");
    else element.setAttribute("aria-label", oldLabel);
  }, 500);
}
function animateQuickMoveChange(eventId, fromCount, toCount, move) {
  const row = [...document.querySelectorAll(".event-row[data-event-id]")].find(
    (item) => item.dataset.eventId === eventId,
  );
  if (!row) return;
  const title = row.querySelector(".quick-move-title");
  const counter = row.querySelector(".quick-move-count-value");
  if (
    journal?.settings.reducedMotion ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  )
    return;
  title?.animate(
    [
      { opacity: 0.45, transform: "translateY(3px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 220, easing: "ease-out" },
  );
  if (counter) {
    counter.dataset.count = String(toCount);
    animateNumberText(counter, String(fromCount), String(toCount), move);
  }
}
function renderDay() {
  if (!$("#day-panel")) return;
  const d = dayData(selected);
  const isFavorite = (journal.settings.favoriteDays ?? []).includes(selected);
  $("#day-panel").innerHTML =
    `<div class="day-heading"><span class="eyebrow"><b class="section-prefix">//</b> ${selected === localDate() ? "СЕГОДНЯ" : "ВЫБРАННЫЙ ДЕНЬ"}</span><div class="day-heading-actions"><button class="icon-button small favorite-day-toggle ${isFavorite ? "active" : ""}" id="favorite-day" aria-label="${isFavorite ? "Убрать день из избранного" : "Добавить день в избранное"}" title="${isFavorite ? "В избранном" : "Добавить в избранное"}" aria-pressed="${isFavorite}">${isFavorite ? "★" : "☆"}</button><button class="icon-button small" id="edit-day" aria-label="Редактировать описание дня">${icon("edit", 16)}</button></div></div><label class="date-picker-label"><input id="selected-date" type="date" min="1900-01-01" max="${localDate()}" value="${selected}" aria-label="Выбрать день"></label><h2>${esc(d.title || "Каким был твой день?")}</h2><p class="day-description ${d.note ? "" : "muted"}">${esc(d.note || dailyPromptFor(selected))}</p>${dayTotalMarkup(d)}<div class="events-heading"><span>СОБЫТИЯ</span><span>${d.events.length.toString().padStart(2, "0")}</span></div><div class="day-events">${eventRows(d) || '<div class="no-events">Небольшой шаг, важная встреча<br>или просто момент для себя.</div>'}</div><button class="add-day-event" id="add-selected">${icon("plus", 16)} Добавить событие</button>`;
  $("#favorite-day").onclick = () => toggleFavoriteDay(selected);
  $("#edit-day").onclick = () => dayForm(selected);
  setHelp(
    $("#edit-day"),
    "Название и заметка · " + fullDate(selected),
    "Открыть описание дня, который указан в календаре под этой кнопкой.",
  );
  $("#selected-date").onchange = (e) => {
    if (!e.target.value) return;
    chooseDay(e.target.value);
    intradayEnd = Math.min(chartHorizon(), minuteAt(shiftDate(selected, 1)));
    clearFocus();
    if (interval < 1440) render();
    else {
      renderDay();
      renderLedger();
    }
  };
  $("#add-selected").onclick = () => eventForm(null, selected);
  bindEventActions($("#day-panel"));
}
async function toggleFavoriteDay(date) {
  try {
    await commit((current) => {
      const favorites = new Set(current.settings.favoriteDays ?? []);
      if (favorites.has(date)) favorites.delete(date);
      else favorites.add(date);
      current.settings.favoriteDays = [...favorites].sort();
      return current;
    });
    if ($("#day-panel")) renderDay();
    if ($("#activity-content")) renderLedger();
  } catch (error) {
    toast(error.message);
  }
}
function journalLayout() {
  const list = candles.slice().reverse();
  return `<section class="journal-panel ambient"><div class="journal-heading"><div><h2>Дни, из которых ты состоишь</h2><p>${list.length} дней с записями · вся твоя история</p></div><input id="journal-search" type="search" placeholder="Найти событие или день…" aria-label="Поиск по дневнику"></div><div id="journal-list"></div><button class="secondary" id="load-more" hidden>Показать ещё</button></section>`;
}
let journalLimit = 30;
function bindJournal() {
  journalLimit = 30;
  const search = $("#journal-search");
  search.oninput = () => {
    journalLimit = 30;
    renderJournalList();
  };
  $("#load-more").onclick = () => {
    journalLimit += 30;
    renderJournalList();
  };
  renderJournalList();
}
function renderJournalList() {
  const query = $("#journal-search").value.toLocaleLowerCase("ru");
  const days = candles
    .slice()
    .reverse()
    .filter((d) =>
      [d.date, d.title, d.note, ...d.events.map((e) => e.text)]
        .join(" ")
        .toLocaleLowerCase("ru")
        .includes(query),
    );
  $("#journal-list").innerHTML =
    days
      .slice(0, journalLimit)
      .map(
        (d) =>
          `<article class="journal-day"><div class="journal-date"><span>${new Date(d.date + "T12:00:00").getDate()}</span><small>${new Date(d.date + "T12:00:00").toLocaleDateString("ru", { month: "short", year: "numeric" })}</small></div><div class="journal-copy"><div class="journal-title"><h3>${esc(d.title || "Ещё один день твоей истории")}</h3><strong class="${direction(d.delta)}">${signed(d.delta)} <small>(${pct(d.percent)})</small></strong></div>${d.note ? `<p>${esc(d.note)}</p>` : ""}<div class="journal-event-list">${d.events.map((e) => `<div><span>${esc(e.text)}</span><strong class="${direction(e.delta)}">${signed(e.delta)} <small>(${pct(e.percent)})</small></strong></div>`).join("") || '<span class="muted">Заметка без событий</span>'}</div><button class="text-button" data-open-day="${d.date}">Открыть день ${icon("right", 13)}</button></div></article>`,
      )
      .join("") ||
    `<div class="empty-journal"><h3>${query ? "Ничего не нашлось" : "История ещё впереди"}</h3><p>${query ? "Попробуй другие слова." : "Добавь первое событие или опиши сегодняшний день."}</p></div>`;
  $("#load-more").hidden = days.length <= journalLimit;
  document.querySelectorAll("[data-open-day]").forEach(
    (b) =>
      (b.onclick = () => {
        chooseDay(b.dataset.openDay);
        autoRange = false;
        manualPriceRange = null;
        autoLayout = false;
        end = selected;
        view = "chart";
        render();
      }),
  );
}
function bindEventActions(root) {
  root
    .querySelectorAll("[data-edit]")
    .forEach((b) => (b.onclick = () => eventForm(b.dataset.edit)));
  root
    .querySelectorAll("[data-delete]")
    .forEach((b) => (b.onclick = () => deleteEvent(b.dataset.delete)));
  root.querySelectorAll("[data-move]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          const next = structuredClone(journal),
            event = next.events.find((e) => e.id === b.dataset.move),
            list = next.events
              .filter((e) => !e.deletedAt && e.date === event.date)
              .sort(compareEvents),
            idx = list.indexOf(event),
            other = list[idx + Number(b.dataset.step)];
          if (!other) return;
          [event.order, other.order] = [other.order, event.order];
          [event.time, other.time] = [other.time, event.time];
          event.updatedAt = other.updatedAt = new Date().toISOString();
          await commit(next);
          render();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
}
async function openHome() {
  await saveQueue;
  if (demo) {
    demo = false;
    journal = personal;
  }
  view = "home";
  render();
}
async function renderHome() {
  theme();
  const graphId = journal?.id;
  $("#app").innerHTML =
    `<div class="shell">${header()}<main class="home-screen"><p class="muted">Открываю твои графики…</p></main></div>`;
  bindShell();
  try {
    const graphs = await api.graphs();
    if (view !== "home" || journal?.id !== graphId) return;
    $(".home-screen").innerHTML =
      `<div class="home-heading"><div><span class="eyebrow">ТВОЁ ПРОСТРАНСТВО</span><h1>Мои графики</h1><p>Отдельные истории в одном месте.</p></div><button class="primary" id="new-graph">${icon("plus", 17)} Новый график</button></div><div class="graph-library">${graphs.map((g) => `<article class="graph-card ${g.active ? "current-graph" : ""}"><details class="graph-actions"><summary aria-label="Действия с графиком ${esc(g.name)}">${icon("settings", 18)}</summary><button class="text-button" data-edit-graph="${esc(g.id)}">Настройки</button><button class="danger" data-delete-graph="${esc(g.id)}">Удалить график</button></details><span class="eyebrow">${g.active ? "ТЕКУЩИЙ ГРАФИК" : "ГРАФИК ЖИЗНИ"}</span><h2>${esc(g.name)}</h2><p>${g.events} событий · начало ${fmt(g.initial)}</p><button class="secondary" data-open-graph="${esc(g.id)}">${g.active ? "Продолжить" : "Открыть"} ${icon("arrow", 15)}</button></article>`).join("")}</div><div class="home-tools"><div><h3>Посмотреть пример</h3><p>Демонстрационный график не меняет твои записи.</p><button class="secondary" id="home-demo">Открыть демо</button></div><div class="archive-entry"><h3>Недавно удалённые</h3><p>Графики можно восстановить в течение 30 дней.</p><button class="secondary" id="open-trash">Открыть архив</button></div></div>`;
    document
      .querySelectorAll("[data-delete-graph]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            deleteGraphForm(
              graphs.find((g) => g.id === b.dataset.deleteGraph),
            )),
      );
    document.querySelectorAll("[data-edit-graph]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await saveQueue;
            busy = true;
            journal = personal = await api.openGraph(b.dataset.editGraph);
            contentEpoch++;
            resetViewport();
            await renderHome();
            coinForm();
          } catch (e) {
            toast(e.message);
          } finally {
            busy = pendingSaves > 0;
          }
        }),
    );
    $("#new-graph").onclick = newGraphForm;
    $("#home-demo").onclick = startDemo;
    $("#open-trash").onclick = trashForm;
    document.querySelectorAll("[data-open-graph]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          try {
            await saveQueue;
            busy = true;
            journal = personal = await api.openGraph(b.dataset.openGraph);
            contentEpoch++;
            resetViewport();
            selected = end = localDate();
            interval = journal.settings.starter?.remaining
              ? STARTER_CANDLE_MINUTES
              : 1440;
            span = journal?.settings.chartDensity ?? 45;
            view = "chart";
            render();
          } catch (error) {
            toast(error.message);
            b.disabled = false;
          } finally {
            busy = pendingSaves > 0;
          }
        }),
    );
  } catch (error) {
    toast(error.message);
  }
}
function deleteGraphForm(graph) {
  modal(
    `<div class="modal-eyebrow">МОИ ГРАФИКИ</div><h2>Удалить «${esc(graph.name)}»?</h2><p class="modal-description">${graph.events} событий будут убраны вместе с графиком. График останется в архиве на 30 дней. До истечения срока его можно восстановить из меню.</p><p class="form-error" role="alert"></p><div class="form-footer"><button class="secondary" id="keep-graph">Оставить</button><button class="danger" id="confirm-delete-graph">Удалить график</button></div>`,
    { enterConfirm: "#confirm-delete-graph" },
  );
  $("#keep-graph").onclick = closeModal;
  $("#confirm-delete-graph").onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      await saveQueue;
      busy = true;
      journal = personal = await api.deleteGraph(graph.id);
      contentEpoch++;
      clearFocus();
      closeModal();
      resetViewport();
      view = "home";
      render();
      toast("График удалён. Копия сохранена.");
    } catch (e) {
      $(".form-error").textContent = e.message;
      $("#confirm-delete-graph").disabled = false;
    } finally {
      busy = pendingSaves > 0;
    }
  };
}
async function applicationForm(first = false) {
  const prefs = await api.preferences();
  const d = modal(
    `<div class="modal-eyebrow">${first ? "ПЕРВЫЙ ЗАПУСК" : "ПРИЛОЖЕНИЕ"}</div><h2>Как запускать High.</h2><p class="modal-description">Дневники и темы сохраняются на этом устройстве. Эти настройки можно изменить позже.</p><form id="application-form"><label class="check-row"><input name="autoStart" type="checkbox" ${prefs.autoStart ? "checked" : ""}> ${prefs.platform === "win32" ? "Запускать вместе с Windows" : "Запускать при входе в систему"}</label><label class="check-row" id="first-run-tray-row" ${prefs.autoStart ? "" : "hidden"}><input name="tray" type="checkbox" ${prefs.autoStart && prefs.tray ? "checked" : ""}> При автозапуске открывать в трее</label><p class="micro">Обычный запуск из ярлыка всегда открывает полное окно.</p>${prefs.platform === "darwin" ? `<input name="shortcut" type="hidden" value="false">` : `<label class="check-row"><input name="shortcut" type="checkbox"> Создать ярлык на рабочем столе</label>`}<label class="check-row" ${prefs.portable ? "hidden" : ""}><input name="autoUpdates" type="checkbox" ${prefs.autoUpdates ? "checked" : ""}> Проверять обновления автоматически</label><p class="micro">Дневник работает без сети. Интернет нужен только для проверки обновлений и синхронизации по твоему запросу. Обновление устанавливается после твоего подтверждения.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full-width">${first ? "Продолжить" : "Сохранить"}</button></form>`,
  );
  const form = d.querySelector("form");
  form.elements.tray.disabled = !form.elements.autoStart.checked;
  form.elements.autoStart.onchange = () => {
    const enabled = form.elements.autoStart.checked;
    d.querySelector("#first-run-tray-row").hidden = !enabled;
    form.elements.tray.disabled = !enabled;
    if (!enabled) form.elements.tray.checked = false;
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const b = form.querySelector("[type=submit]");
    b.disabled = true;
    try {
      await api.configure(
        Object.fromEntries(
          ["autoStart", "tray", "shortcut", "autoUpdates"].map((k) => [
            k,
            k === "tray"
              ? form.elements.autoStart.checked && form.elements.tray.checked
              : form.elements[k].checked,
          ]),
        ),
      );
      closeModal();
    } catch (e) {
      form.querySelector(".form-error").textContent = e.message;
      b.disabled = false;
    }
  };
}
async function updatesForm() {
  const d = modal(
    `<div class="modal-eyebrow" data-current-version>High. __APP_VERSION__</div><h2>Обновления</h2><p id="update-status" role="status">Проверяю состояние…</p><div class="update-actions"><button class="secondary" id="check-update">Проверить обновления</button><button class="primary" id="get-update" hidden>Загрузить</button></div><h3>История версий</h3><div id="release-history"></div><button class="text-button" id="application-settings">Настройки запуска и трея</button>`,
  );
  const paint = (state) => {
    if (!d.isConnected) return;
    if (state.version)
      d.querySelector("[data-current-version]").textContent = `High. ${state.version}`;
    d.querySelector("#update-status").textContent = state.message;
    d.querySelector("#release-history").innerHTML = state.history
      .map(
        (r) =>
          `<article class="release-row"><b>${esc(r.version)}</b><p>${esc(r.notes)}</p></article>`,
      )
      .join("") || '<p class="release-history-empty">История версий пока недоступна.</p>';
    d.querySelector("#check-update").disabled = [
      "checking",
      "downloading",
    ].includes(state.state);
    const get = d.querySelector("#get-update");
    get.hidden = !["available", "downloaded"].includes(state.state);
    get.textContent =
      state.state === "downloaded"
        ? "Перезапустить и обновить"
        : "Загрузить обновление";
    get.onclick = async () => {
      get.disabled = true;
      if (state.state === "downloaded") {
        await saveQueue;
        await api.installUpdate();
      } else {
        paint(await api.downloadUpdate());
        get.disabled = false;
      }
    };
    $("#updates")?.classList.toggle(
      "update-ready",
      ["available", "downloaded"].includes(state.state),
    );
  };
  paint(await api.updateState());
  d.querySelector("#check-update").onclick = async () =>
    paint(await api.checkUpdate());
  d.querySelector("#application-settings").onclick = () => {
    closeModal();
    settingsForm("application");
  };
  const timer = setInterval(async () => {
    if (d.open) paint(await api.updateState());
  }, 700);
  d.addEventListener("close", () => clearInterval(timer), { once: true });
}
async function trashForm() {
  const d = modal(
    `<h2>Недавно удалённые</h2><p class="modal-description">Восстановление доступно 30 дней после удаления.</p><div id="trash-list">Открываю архив…</div><p class="form-error" role="alert"></p>`,
  );
  try {
    const items = await api.trash();
    d.querySelector("#trash-list").innerHTML = items.length
      ? items
          .map(
            (g) =>
              `<article class="trash-row"><div><b>${esc(g.name)}</b><p>${g.events} событий · до ${fullDate(g.expiresAt.slice(0, 10))}</p></div><button class="secondary" data-restore="${esc(g.id)}">Восстановить</button></article>`,
          )
          .join("")
      : `<p class="micro">Архив пуст.</p>`;
    d.querySelectorAll("[data-restore]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          try {
            await saveQueue;
            journal = personal = await api.restoreGraph(b.dataset.restore);
            contentEpoch++;
            view = "chart";
            interval = 15;
            resetViewport();
            closeModal();
            render();
            toast("График восстановлен");
          } catch (e) {
            d.querySelector(".form-error").textContent = e.message;
            b.disabled = false;
          }
        }),
    );
  } catch (e) {
    d.querySelector(".form-error").textContent = e.message;
  }
}
function coinForm(welcome = false) {
  const d = modal(
    `<div class="modal-eyebrow">${welcome ? "ГРАФИК ГОТОВ" : "ЛИЧНЫЙ ЗНАК"}</div><h2>${welcome ? "Настроим монетку?" : "Монетка графика"}</h2><p class="modal-description">${welcome ? "Твой график уже открыт. Выбери знак сейчас или вернись к нему позже." : "Цвет и символ сохранятся для этого графика."}</p><form id="coin-form"><input type="hidden" name="name" value="${esc(journal.settings.name)}">${coinEditor()}<p class="form-error" role="alert"></p><div class="form-footer"><button type="button" class="secondary" id="coin-later">Позже</button><button class="primary" type="submit">Сохранить монетку</button></div></form>`,
  );
  d.classList.add("coin-modal");
  const form = d.querySelector("form"),
    read = bindCoinEditor(form, journal.settings.coin);
  d.querySelector("#coin-later").onclick = closeModal;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const b = form.querySelector("[type=submit]");
    b.disabled = true;
    try {
      const next = structuredClone(journal);
      next.settings.coin = read();
      await commit(next);
      closeModal();
      render();
    } catch (e) {
      form.querySelector(".form-error").textContent = e.message;
      b.disabled = false;
    }
  };
}
function newGraphForm() {
  const d = modal(
    `<div class="modal-eyebrow">НОВАЯ ИСТОРИЯ</div><h2>Создать график</h2><p class="modal-description">Предыдущие графики останутся в меню.</p><form id="new-graph-form"><label>Название<input name="name" maxlength="80" value="LIFEUSDT" required></label><label>Начальное значение<input name="initial" type="number" min="-1000000000" max="1000000000" step="0.01" value="100" inputmode="decimal" required></label>${starterChoice()}<p class="form-error" role="alert"></p><button class="primary full-width" type="submit">Создать график</button></form>`,
  );
  const f = d.querySelector("form");

  f.onsubmit = async (e) => {
    e.preventDefault();
    const button = f.querySelector("button.primary");
    button.disabled = true;
    try {
      await saveQueue;
      const next = createJournal(
        f.elements.name.value.trim(),
        Number(f.elements.initial.value),
        journal?.settings.theme ?? "dark",
      );
      if (journal?.settings.appearance)
        next.settings.appearance = structuredClone(journal.settings.appearance);

      if (f.elements.starterMode.value === "visual")
        next.settings.starter = createStarter();
      validateJournal(next);
      busy = true;
      journal = personal = await api.createGraph(next);
      contentEpoch++;
      resetViewport();
      selected = end = localDate();
      interval =
        f.elements.starterMode.value === "visual"
          ? STARTER_CANDLE_MINUTES
          : 15;
      resetViewport();
      span = journal?.settings.chartDensity ?? 45;
      view = "chart";
      closeModal();
      render();
      coinForm(true);
    } catch (error) {
      f.querySelector(".form-error").textContent = error.message;
      button.disabled = false;
    } finally {
      busy = pendingSaves > 0;
    }
  };
}
function resetGraph(testOnly) {
  const targets = journal.events.filter(
    (e) => !e.deletedAt && (!testOnly || e.test),
  );
  const days = testOnly ? [] : journal.days.filter((d) => !d.deletedAt);
  if (!targets.length && !days.length) {
    toast("Нет записей для очистки");
    return;
  }
  const d = modal(
    `<div class="modal-eyebrow">${esc(journal.settings.name)}</div><h2>${testOnly ? "Убрать тестовые события?" : "Начать этот график заново?"}</h2><p class="modal-description">Будет убрано ${targets.length} событий и ${days.length} заметок. Название, начальное значение и другие графики сохранятся. Предыдущее состояние останется в резервной копии.</p><div class="form-footer"><button class="secondary" id="cancel-reset">Отмена</button><button class="danger" id="confirm-reset">${testOnly ? "Убрать тестовые" : "Очистить график"}</button></div>`,
    { enterConfirm: "#confirm-reset" },
  );
  $("#cancel-reset").onclick = () => d.close();
  $("#confirm-reset").onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      await saveQueue;
      const next = structuredClone(journal);
      const now = new Date().toISOString();
      for (const r of [...next.events, ...(testOnly ? [] : next.days)])
        if (!r.deletedAt && (!testOnly || r.test))
          r.deletedAt = r.updatedAt = now;
      await commit(next);
      closeModal();
      render();
      toast("График очищен");
    } catch (error) {
      toast(error.message);
      e.target.disabled = false;
    }
  };
}
async function randomEvent(e) {
  const button = e.currentTarget;
  button.disabled = true;
  try {
    await saveQueue;
    const testDates = journal.events
      .filter((e) => e.test && !e.deletedAt)
      .map((e) => e.date)
      .sort();
    const date = shiftDate(
      testDates[0] && testDates[0] < localDate() ? testDates[0] : localDate(),
      -1,
    );
    if (date < "1900-01-01")
      throw new Error("Достигнуто начало допустимой истории");
    let next = journal;
    const size = Math.max(
      1,
      Math.min(250, Math.abs(journal.settings.initial) * 0.008),
    );
    const drift = (Math.random() - 0.45) * size;
    for (let slot = 0; slot < 6; slot++) {
      const time = clockLabel(
        slot * 240 + 30 + Math.floor(Math.random() * 150),
      );
      const delta = round(drift + (Math.random() - 0.48) * size * 2);
      const example =
        EVENT_EXAMPLES[Math.floor(Math.random() * EVENT_EXAMPLES.length)].text;
      next = upsertEvent(next, {
        text: "Тест · " + example,
        date,
        time,
        unit: "points",
        delta,
        test: true,
      });
    }
    await commit(next);
    selected = date;
    autoRange = false;
    manualPriceRange = null;
    autoLayout = false;
    end = localDate();
    intradayEnd = Math.min(
      nowMinute(),
      minuteAt(shiftDate(testDates.at(-1) ?? date, 1)),
    );
    if (interval >= 1440) {
      end = testDates.at(-1) ?? date;
      span = Math.min(
        3650,
        Math.max(
          Math.ceil((interval / 1440) * 8),
          30,
          daysBetween(date, end) + 1,
        ),
      );
      if (daysBetween(date, end) >= span) end = shiftDate(date, span - 1);
    } else {
      // Keep the newly generated day visible as the test history grows backwards.
      intradayCount = Math.min(
        interval * MAX_BARS,
        Math.max(
          intradayCount,
          Math.ceil((intradayEnd - minuteAt(date)) / interval) * interval,
        ),
      );
      intradayEnd = Math.min(intradayEnd, minuteAt(date) + intradayCount);
    }
    render();
    toast("Тестовый день: " + shortDate(date) + " · 6 событий");
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
}
async function recordQuickMove(direction) {
  const clickedAt = new Date();
  const date = localDate(clickedAt);
  const time = localTime(clickedAt);
  let eventId = null;
  let choice = null;
  let previousCount = 0;
  let count = 1;
  let valueFrom = 0;
  let valueTo = 0;
  let dayDeltaFrom = 0;
  let dayDeltaTo = 0;
  let dayPercentFrom = null;
  let dayPercentTo = null;
  let eventDeltaFrom = 0;
  let eventDeltaTo = 0;
  try {
    await commit((current) => {
      const currentCandles = calculate(current);
      const currentValue = currentCandles.at(-1)?.close ?? current.settings.initial;
      valueFrom = currentValue;
      const previousDay = currentCandles.find((day) => day.date === date);
      dayDeltaFrom = previousDay?.delta ?? 0;
      dayPercentFrom = previousDay?.percent ?? percentage(0, currentValue);
      const change = round((Math.abs(currentValue) * 0.2) / 100);
      if (!change)
        throw new Error(
          "При таком значении шаг 0,2% меньше минимального шага графика 0,01.",
        );
      const previous = recentQuickMove(
        current.events,
        direction,
        date,
        clickedAt.getTime(),
      );
      previousCount = previous?.quickMove.count ?? 0;
      count = previousCount + 1;
      const previousChange = previous
        ? (currentCandles
            .find((day) => day.date === date)
            ?.events.find((event) => event.id === previous.id)?.delta ??
          previous.delta)
        : 0;
      eventDeltaFrom = previousChange;
      choice = chooseQuickMove(
        direction,
        count,
        Math.random,
        previous?.quickMove.variant ?? -1,
      );
      const next = upsertEvent(current, {
        text: choice.text,
        date,
        time,
        delta: round(previousChange + (direction === "up" ? change : -change)),
        unit: "points",
        quickMove: {
          direction,
          count,
          stage: choice.stage,
          variant: choice.variant,
          lastAt: clickedAt.toISOString(),
        },
      }, previous?.id);
      const event = next.events.find((item) => item.id === (previous?.id ?? next.events.at(-1)?.id));
      if (!event) throw new Error("Не удалось обновить быстрое событие.");
      eventId = event.id;
      eventDeltaTo = event.delta;
      event.order =
        next.events.reduce(
          (max, item) =>
            !item.deletedAt && item.date === date && item.id !== event.id
              ? Math.max(max, item.order)
              : max,
          -1,
        ) + 1;
      const nextCandles = calculate(next);
      valueTo = nextCandles.at(-1)?.close ?? next.settings.initial;
      const nextDay = nextCandles.find((day) => day.date === date);
      dayDeltaTo = nextDay?.delta ?? 0;
      dayPercentTo = nextDay?.percent ?? percentage(0, valueTo);
      return next;
    });
    pendingEventAnimation =
      view === "chart" && eventId ? { graphId: journal.id, id: eventId } : null;
    if (journal.settings.followEvent !== false) {
      resetViewport();
      autoRange = false;
      manualPriceRange = null;
      autoLayout = true;
      chooseDay(date);
      end = date;
      intradayEnd = minuteAt(date, minuteOf(time) + 1);
    }
    render();
    animateQuickMoveChange(eventId, previousCount, count, direction);
    animateNumberText($(".quote-price .main-value"), fmt(valueFrom), fmt(valueTo), direction);
    const initial = journal.settings.initial;
    const overallDeltaFrom = round(valueFrom - initial);
    const overallDeltaTo = round(valueTo - initial);
    animateNumberText(
      $(".quote-price .overview-change"),
      `${signed(overallDeltaFrom)} / ${pct(percentage(overallDeltaFrom, initial))}`,
      `${signed(overallDeltaTo)} / ${pct(percentage(overallDeltaTo, initial))}`,
      direction,
    );
    if (selected === date) {
      animateNumberText($("#day-panel .day-total-change"), signed(dayDeltaFrom), signed(dayDeltaTo), direction);
      animateNumberText($("#day-panel .day-total-percent"), pct(dayPercentFrom), pct(dayPercentTo), direction);
    }
    const eventRow = [...document.querySelectorAll("#day-panel .event-row[data-event-id]")].find(
      (row) => row.dataset.eventId === eventId,
    );
    animateNumberText(
      eventRow?.querySelector(".event-points"),
      signed(eventDeltaFrom),
      signed(eventDeltaTo),
      direction,
    );
    toast(choice.text);
  } catch (error) {
    toast(error.message);
  }
}
function eventForm(id = null, date = localDate()) {
  const existing = id ? journal.events.find((e) => e.id === id) : null;
  date = existing?.date ?? date;
  const copy = entryCopy();
  let dateMode = !existing && date === localDate() ? "today" : "custom";
  let timeMode = existing || date !== localDate() ? "custom" : "now";
  let futureKey = "",
    futureClicks = 0;
  let lastDate = date,
    lastTime = existing?.time ?? localTime();
  const d = modal(
    `<div class="modal-eyebrow">МОМЕНТ, КОТОРЫЙ ИМЕЕТ ЗНАЧЕНИЕ</div><h2>${existing ? "Изменить событие" : "Что произошло?"}</h2><p class="modal-description">${esc(copy.phrase)}</p><form id="event-form"><label>Событие (необязательно)<textarea name="text" placeholder="Например, ${esc(copy.example.charAt(0).toLowerCase() + copy.example.slice(1))}" maxlength="4000" rows="2">${esc(existing?.text || "")}</textarea></label>
    <details class="event-examples"><summary>Ещё идеи · 500 примеров</summary><label class="example-search-label">Найти пример<input id="example-search" type="search" placeholder="Например: друзья, зарплата, собака"></label><div class="example-categories">${["Все", ...EXAMPLE_CATEGORIES].map((c) => `<button type="button" data-example-category="${esc(c)}" aria-pressed="${c === "Все"}">${esc(c)}</button>`).join("")}</div><div class="example-results"></div><p class="micro">Выбери идею — перейдём сразу к изменению.</p></details>
    <label>Изменение</label><div class="event-amount-input"><div class="sign-switch" role="group" aria-label="Направление события"><button type="button" data-delta-sign="1" aria-label="Плюс — рост">+</button><button type="button" data-delta-sign="-1" aria-label="Минус — спад">−</button></div><input name="delta" aria-label="Изменение" type="text" inputmode="decimal" autocomplete="off" value="${existing?.delta ?? 5}" required><input type="hidden" name="unit" value="points"><div class="unit-switch" role="group" aria-label="Единица изменения"><button type="button" data-unit="points" aria-pressed="true">Число</button><button type="button" data-unit="percent" aria-pressed="false">Проценты %</button></div></div><div class="impact-preview" id="impact-preview"></div>
    <label>Когда произошло</label><div class="moment-switch" role="group" aria-label="Время события"><button type="button" data-event-time="now">Сейчас · ${localTime()}</button><button type="button" data-event-time="custom">Другая дата и время</button></div><div class="moment-fields">${momentPickerMarkup()}${timePickerMarkup()}</div><input name="date" type="hidden" value="${date}"><input name="time" type="hidden" value="${lastTime}">
    <p class="micro event-hint">${esc(copy.hint)}</p><p class="form-error" role="alert"></p><div class="form-footer"><button type="submit" class="primary full-width">${existing ? "Сохранить изменения" : "Добавить событие"} ${icon("arrow", 17)}</button></div></form>`,
    { explicitClose: true },
  );
  d.classList.add("event-modal");
  const form = $("#event-form");
  const moveAmountTextToDescription = (text) => {
    const description = form.elements.text;
    description.focus();
    const end = description.value.length;
    description.setSelectionRange(end, end);
    description.setRangeText(text, end, end, "end");
    description.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const readAmount = bindSignedInput(form, {
    onInvalidText: moveAmountTextToDescription,
  });
  const syncPicker = bindMomentPicker(form);
  const preview = () => {
    const date = form.elements.date.value,
      time = form.elements.time.value,
      input = (() => {
        try {
          return readAmount();
        } catch {
          return NaN;
        }
      })();
    if (!Number.isFinite(input)) {
      $("#impact-preview").textContent = "Введи число для расчёта результата";
      return;
    }
    try {
      const tmp = upsertEvent(
        journal,
        { date, time, text: "Предпросмотр", delta: 0 },
        id,
      );
      const candidate =
        tmp.events.find((e) => e.id === id) ?? tmp.events.at(-1);
      const item = calculate(tmp)
        .find((d) => d.date === date)
        ?.events.find((e) => e.id === candidate.id);
      const base = item?.before ?? 0;
      candidate.delta = input;
      candidate.unit = form.elements.unit.value;
      assertPriceChange(journal, tmp);
      const delta =
        form.elements.unit.value === "percent"
          ? round((Math.abs(base) * input) / 100)
          : input;
      $("#impact-preview").innerHTML =
        `<span>Результат записи</span><strong class="${direction(delta)}">${signed(delta)} <small>(${pct(percentage(delta, base))})</small></strong>`;
    } catch (error) {
      $("#impact-preview").textContent = error.message.includes("0,01")
        ? "Запись уводит значение ниже минимума 0,01. Уменьши спад."
        : error.message;
    }
  };
  const syncMoment = () => {
    const today = localDate();
    form.elements.date.max = today;
    if (dateMode === "today") form.elements.date.value = today;
    if (timeMode === "now") form.elements.time.value = localTime();
    form.querySelector(".date-picker").hidden = timeMode !== "custom";
    form.querySelector(".time-picker").hidden = timeMode !== "custom";
    syncPicker();
    d.querySelector('[data-event-time="now"]').textContent =
      "Сейчас · " + localTime();
    d.querySelectorAll("[data-event-date]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.eventDate === dateMode)),
    );
    d.querySelectorAll("[data-event-time]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.eventTime === timeMode)),
    );
  };
  d.querySelectorAll("[data-event-time]").forEach(
    (b) =>
      (b.onclick = () => {
        timeMode = b.dataset.eventTime;
        dateMode = timeMode === "custom" ? "custom" : "today";
        futureClicks = 0;
        syncMoment();
        preview();
      }),
  );
  form.elements.date.onchange = () => {
    if (!form.elements.date.value) form.elements.date.value = lastDate;
    else lastDate = form.elements.date.value;
    dateMode = "custom";
    syncMoment();
    preview();
  };
  form.elements.time.onchange = () => {
    if (!form.elements.time.value) form.elements.time.value = lastTime;
    else lastTime = form.elements.time.value;
    preview();
  };
  d.querySelectorAll("[data-unit]").forEach(
    (b) =>
      (b.onclick = () => {
        form.elements.unit.value = b.dataset.unit;
        d.querySelectorAll("[data-unit]").forEach((other) =>
          other.setAttribute("aria-pressed", String(other === b)),
        );
        preview();
      }),
  );
  const useExample = (text) => {
    form.elements.text.value = text;
    form.elements.text.dispatchEvent(new Event("input", { bubbles: true }));
    d.querySelector(".event-examples").open = false;
    requestAnimationFrame(() => {
      form.elements.delta.scrollIntoView({ behavior: "smooth", block: "center" });
      form.elements.delta.focus({ preventScroll: true });
    });
  };
  let exampleCategory = "Все",
    exampleOrder = EVENT_EXAMPLES;
  d.querySelector(".event-examples").ontoggle = (e) => {
    if (e.currentTarget.open) {
      exampleOrder = shuffledExamples(Math.random, copy.example);
      showExamples();
    }
  };
  const showExamples = () => {
    const entries = findExamples(
      $("#example-search").value,
      exampleCategory,
      exampleOrder,
    );
    d.querySelector(".example-results").innerHTML =
      entries
        .map((e) => `<button type="button">${esc(e.text)}</button>`)
        .join("") ||
      '<p class="micro">Попробуй другое слово или категорию.</p>';
    d.querySelectorAll(".example-results button").forEach(
      (b, i) => (b.onclick = () => useExample(entries[i].text)),
    );
  };
  $("#example-search").oninput = showExamples;
  $("#example-search").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      showExamples();
    }
  };
  d.querySelectorAll("[data-example-category]").forEach(
    (b) =>
      (b.onclick = () => {
        exampleCategory = b.dataset.exampleCategory;
        d.querySelectorAll("[data-example-category]").forEach((other) =>
          other.setAttribute("aria-pressed", String(other === b)),
        );
        showExamples();
      }),
  );
  form.elements.unit.value = existing?.unit ?? "points";
  d.querySelectorAll("[data-unit]").forEach((b) =>
    b.setAttribute(
      "aria-pressed",
      String(b.dataset.unit === form.elements.unit.value),
    ),
  );
  form.addEventListener("input", () => {
    futureClicks = 0;
    form.querySelector(".form-error").textContent = "";
    preview();
  });
  syncMoment();
  showExamples();
  preview();
  const timeTicker = setInterval(() => {
    if (d.open) {
      syncMoment();
      preview();
    }
  }, 15000);
  d.addEventListener("close", () => clearInterval(timeTicker), { once: true });
  form.elements.text.focus();
  form.onsubmit = async (e) => {
    e.preventDefault();
    syncMoment();
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      const fields = {
        text: form.elements.text.value.trim() || "Без описания",
        date: form.elements.date.value,
        time: form.elements.time.value,
        delta: readAmount(),
      };
      fields.unit = form.elements.unit.value;
      const key = JSON.stringify(fields);
      if (key !== futureKey) {
        futureKey = key;
        futureClicks = 0;
      }
      if (
        fields.date > localDate() ||
        (fields.date === localDate() && fields.time > localTime())
      ) {
        futureClicks++;
        if (futureClicks < 3)
          throw new Error(
            futureClicks === 1
              ? "Это будущее. Обычно записи добавляют за сегодня или прошлые дни. Если дата верна, нажми «Добавить» ещё два раза."
              : "Дата всё ещё в будущем. Нажми ещё один раз, чтобы сохранить эту запись.",
          );
      }
      const next = upsertEvent(journal, fields, id);
      await commit(next);
      pendingEventAnimation =
        view === "chart"
          ? { graphId: journal.id, id: existing?.id ?? next.events.at(-1).id }
          : null;
      if (journal.settings.followEvent !== false) {
        resetViewport();
        autoRange = false;
        manualPriceRange = null;
        autoLayout = true;
        chooseDay(fields.date);
        end = fields.date;
        intradayEnd = minuteAt(fields.date, minuteOf(fields.time) + 1);
      }
      closeModal();
      render();
      toast(
        existing
          ? "Событие обновлено. График пересчитан."
          : "Ещё один момент в твоей истории",
      );
    } catch (error) {
      form.querySelector(".form-error").textContent = error.message;
      button.disabled = false;
    }
  };
}
function dayForm(date = localDate()) {
  const day = dayData(date);
  const dayPrompt = nextDayPrompt();
  dayPromptByDate.set(date, dayPrompt);
  const d = modal(
    `<div class="modal-eyebrow">${fullDate(date)}</div><h2>Дай этому дню имя</h2><p class="modal-description">${esc(dayPrompt)}</p><form id="day-form"><label>Название дня<input name="title" maxlength="120" placeholder="Например, ${esc(nextDayExample())}" value="${esc(day.title)}"></label><label>Описание<textarea name="note" maxlength="12000" rows="6" placeholder="Что хочется запомнить?">${esc(noteDrafts.get(journal.id + ":" + date) ?? day.note)}</textarea></label><p class="form-error" role="alert"></p><div class="form-footer"><button type="button" class="secondary" id="cancel-form">Отмена</button><button class="primary" type="submit">Сохранить день ${icon("check", 17)}</button></div></form>`,
  );
  $("#cancel-form").onclick = () => d.close();
  $("#day-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      await commit(
        upsertDay(journal, {
          date,
          title: form.elements.title.value.trim(),
          note: form.elements.note.value.trim(),
        }),
      );
      noteDrafts.delete(journal.id + ":" + date);
      closeModal();
      render();
      toast("День сохранён");
    } catch (error) {
      form.querySelector(".form-error").textContent = error.message;
      button.disabled = false;
    }
  };
}
function deleteEvent(id) {
  const event = journal.events.find((e) => e.id === id);
  modal(
    `<div class="modal-eyebrow">ИЗМЕНЕНИЕ ИСТОРИИ</div><h2>Удалить событие?</h2><p class="modal-description">«${esc(event.text)}»</p><p class="muted">Этот и все следующие дни будут пересчитаны. Предыдущее состояние останется в резервной копии.</p><div class="form-footer"><button class="secondary" id="keep-event">Оставить</button><button class="danger" id="confirm-delete">Удалить</button></div>`,
    { enterConfirm: "#confirm-delete" },
  );
  $("#keep-event").onclick = closeModal;
  $("#confirm-delete").onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      const next = structuredClone(journal),
        record = next.events.find((e) => e.id === id);
      record.deletedAt = record.updatedAt = new Date().toISOString();
      await commit(next);
      closeModal();
      render();
      toast("Событие удалено");
    } catch (e) {
      toast(e.message);
      closeModal();
    }
  };
}
function syncChoiceDialog(title, description, choices) {
  return new Promise((resolve) => {
    const dialog = modal(
      `<div class="modal-eyebrow">СИНХРОНИЗАЦИЯ</div><h2>${esc(title)}</h2><p class="modal-description">${esc(description)}</p><div class="sync-choice-list">${choices.map((choice) => `<button type="button" class="${choice.primary ? "primary" : "secondary"}" data-sync-choice="${esc(choice.value)}">${esc(choice.label)}</button>`).join("")}</div>`,
    );
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      if (dialog.open) dialog.close();
    };
    dialog.querySelectorAll("[data-sync-choice]").forEach((button) => {
      button.onclick = () => finish(button.dataset.syncChoice);
    });
    dialog.addEventListener("close", () => finish(null), { once: true });
  });
}

async function replaceWithRemote(remote, credentials, snapshot) {
  await saveQueue;
  if (demo) throw new Error("Сначала вернись к личному графику");
  assertSyncTarget(journal, snapshot);
  await commit(remote.journal, { replace: true });
  const saved = journal;
  end = selected = localDate();
  span = saved.settings.chartDensity ?? 45;
  setSyncMarker(credentials.accountId, saved.id, {
    serverRevision: remote.revision,
    localRevision: saved.revision,
  });
  closeModal();
  render();
  return `Загружена облачная версия «${saved.settings.name}». Текущая локальная версия сохранена отдельно.`;
}

async function writeLocalToRemote(credentials, snapshot, baseRevision) {
  const result = await syncClient.writeJournal(credentials, snapshot, baseRevision);
  setSyncMarker(credentials.accountId, snapshot.id, {
    serverRevision: result.revision,
    localRevision: snapshot.revision,
  });
  return `«${snapshot.settings.name}» синхронизирован. Облачная версия ${result.revision}.`;
}

async function syncJournalNow() {
  await saveQueue;
  if (!journal || demo) throw new Error("Сначала открой личный график");
  const credentials = loadSyncCredentials();
  if (!credentials) throw new Error("Сначала подключи файл сопряжения");

  const snapshot = structuredClone(journal);
  const graphs = await syncClient.listGraphs(credentials);
  const matching = graphs.find((graph) => graph.graphId === snapshot.id);

  if (matching) {
    const remote = await syncClient.readJournal(credentials, snapshot.id);
    if (!remote) throw new Error("Облачный график изменился. Повтори синхронизацию.");
    if (remote.journal.id !== snapshot.id)
      throw new Error("ID облачного дневника не совпадает с его содержимым");

    if (JSON.stringify(remote.journal) === JSON.stringify(snapshot)) {
      setSyncMarker(credentials.accountId, snapshot.id, {
        serverRevision: remote.revision,
        localRevision: snapshot.revision,
      });
      return "Этот график уже совпадает с облачной копией.";
    }

    const marker = getSyncMarker(credentials.accountId, snapshot.id);
    const action = syncAction(snapshot, remote, marker);
    if (action === "unchanged") return "Этот график уже синхронизирован.";
    if (action === "download")
      return replaceWithRemote(remote, credentials, snapshot);
    if (action === "upload")
      return writeLocalToRemote(credentials, snapshot, remote.revision);

    const choice = await syncChoiceDialog(
      "На устройствах разные версии",
      `Локальная версия «${snapshot.settings.name}» и облачная версия ${remote.revision} расходятся. Выбери, какую оставить.`,
      [
        { value: "local", label: "Загрузить эту версию в облако", primary: true },
        { value: "cloud", label: "Восстановить версию из облака" },
      ],
    );
    if (choice === "local")
      return writeLocalToRemote(credentials, snapshot, remote.revision);
    if (choice === "cloud") return replaceWithRemote(remote, credentials, snapshot);
    return "Синхронизация отменена.";
  }

  if (!graphs.length) {
    const choice = await syncChoiceDialog(
      "Загрузить дневник в облако?",
      `На сервер будет отправлен зашифрованный график «${snapshot.settings.name}» с ${snapshot.events.filter((event) => !event.deletedAt).length} событиями. Локальная копия останется на устройстве.`,
      [
        { value: "upload", label: "Загрузить зашифрованную копию", primary: true },
        { value: "cancel", label: "Пока не загружать" },
      ],
    );
    if (choice !== "upload") return "Первая загрузка отменена.";
    return writeLocalToRemote(credentials, snapshot, 0);
  }

  const candidates = (await Promise.all(
    graphs.slice(0, 8).map(async (graph) => {
      const remote = await syncClient.readJournal(credentials, graph.graphId);
      return remote ? { ...remote, graphId: graph.graphId } : null;
    }),
  )).filter(Boolean);
  if (!candidates.length)
    throw new Error("Не удалось прочитать облачные графики. Проверь подключение.");
  const choice = await syncChoiceDialog(
    "Выбери график для сопряжения",
    `На сервере есть графики, которых нет на этом устройстве. Можно загрузить один из них сюда — текущий график останется в локальной истории — или добавить текущий график в облако отдельно.${graphs.length > 8 ? " Показаны последние восемь." : ""}`,
    [
      ...candidates.map((remote) => ({
        value: `cloud:${remote.graphId}`,
        label: `Скачать «${remote.journal.settings.name}» · ${remote.journal.events.filter((event) => !event.deletedAt).length} событий`,
      })),
      { value: "upload", label: "Загрузить текущий отдельным графиком", primary: true },
    ],
  );
  if (choice === "upload") return writeLocalToRemote(credentials, snapshot, 0);
  if (choice?.startsWith("cloud:")) {
    const remote = candidates.find((item) => `cloud:${item.graphId}` === choice);
    if (remote) return replaceWithRemote(remote, credentials, snapshot);
  }
  return "Синхронизация отменена.";
}

function settingsForm(initialTab = "appearance") {
  const draft = structuredClone(previewSettings ?? journal.settings);
  let customBase =
    draft.appearance?.basePalette ??
    (draft.appearance?.palette === "custom"
      ? "blue"
      : (draft.appearance?.palette ??
        (draft.theme === "light" ? "blue" : "amber")));
  const initialTokens = themeTokens(
    draft,
    matchMedia("(prefers-color-scheme: dark)").matches,
  ).tokens;
  let customColors = {
    ...Object.fromEntries(COLOR_KEYS.map((k) => [k, initialTokens[k]])),
  };
  const dialog = modal(`
    <div class="modal-eyebrow">ТВОЁ ПРОСТРАНСТВО</div><h2>Настройки</h2>
    <div class="settings-tabs" role="tablist" aria-label="Раздел настроек">
      <button type="button" role="tab" aria-selected="true" data-settings-tab="appearance">Оформление</button>
      <button type="button" role="tab" aria-selected="false" data-settings-tab="general">График и монетка</button>
      <button type="button" role="tab" aria-selected="false" data-settings-tab="data">Мои данные</button>
      <button type="button" role="tab" aria-selected="false" data-settings-tab="application">Приложение</button>
      <button type="button" role="tab" aria-selected="false" data-settings-tab="experimental">Эксперименты</button>
    </div>
    <form id="settings-form" novalidate>
      <section data-settings-panel="appearance" role="tabpanel" aria-label="Оформление">
        <div class="theme-presets">${THEME_PRESETS.map((p) => `<button type="button" class="theme-preset" data-preset="${p.id}" aria-pressed="false"><span class="preset-art" style="--swatch:${p.swatch};--sample-bg:${p.bg}"><i></i><i></i><i></i><i></i><i></i></span><span>${p.name}</span></button>`).join("")}<button type="button" class="theme-preset" data-preset="custom" aria-pressed="false"><span class="preset-art custom-art">＋</span><span>Своя тема</span></button></div>
        <div class="chart-color-mode"><label>Цвета графика и цифр<select name="chartColors"><option value="classic">Классические · зелёный рост, красный спад</option><option value="theme">В цвет выбранной темы</option><option value="custom">Свои цвета графика</option></select></label><button type="button" id="custom-from-theme" class="secondary">Своя тема на основе этой →</button></div><p class="micro">По умолчанию свечи роста и значение зелёные. «В цвет темы» меняет их вместе с темой. Цвет личной монетки выбирается отдельно.</p>
        <label class="theme-base">Основа<select name="theme"><option value="dark">Тёмная</option><option value="light">Светлая</option><option value="system">Как в системе</option></select></label>
        <div id="custom-colors" class="custom-colors" hidden>${COLOR_KEYS.map((k, i) => `<label>${["Кнопки и акценты", "Рост", "Падение", "Значение графика"][i]}<span><input type="color" name="color-${k}" value="${customColors[k]}" aria-label="${["Цвет кнопок", "Цвет роста", "Цвет падения", "Цвет значения"][i]}"><output data-color-output="${k}">${customColors[k]}</output></span></label>`).join("")}</div>
        <div class="theme-preview" aria-label="Предпросмотр темы"><div class="preview-heading"><span>ТВОЙ ГРАФИК <small>ПРЕДПРОСМОТР</small></span><strong>1 025 </strong></div><div class="preview-body"><svg viewBox="0 0 300 90" aria-hidden="true"><path d="M0 25H300M0 60H300" stroke="var(--grid)"/>${[56, 48, 57, 36, 24, 35, 18, 9].map((y, i) => `<g stroke="var(--${i === 2 || i === 5 ? "down" : "up"})" fill="var(--${i === 2 || i === 5 ? "down" : "up"})"><path d="M${20 + i * 36} ${y - 8}v34"/><rect x="${17 + i * 36}" y="${y}" width="6" height="18"/></g>`).join("")}</svg><div><span class="positive">+25 (+2,5%)</span><span class="negative">−5 (−0,5%)</span><button type="button" class="primary" id="preview-event">＋ Событие</button></div></div></div>
        <p id="theme-contrast" class="micro" role="status"></p>
        <p class="preview-caption" role="status">Оформление сохраняется автоматически.</p>
      </section>
      <section data-settings-panel="general" role="tabpanel" aria-label="Дневник" hidden>
        <label>Название графика<input name="name" maxlength="80" required value="${esc(journal.settings.name)}"></label>
        ${coinEditor()}<label>Начальное значение<input name="initial" type="number" step="0.01" min="-1000000000" max="1000000000" required value="${journal.settings.initial}"></label>

        <label class="checkbox-label"><input type="checkbox" name="followEvent" ${journal.settings.followEvent !== false ? "checked" : ""}> После записи перейти к её дню</label>
        <p class="micro">Выключи, чтобы сохранять выбранный день и положение графика.</p>
        <label class="checkbox-label"><input type="checkbox" name="liveChart" ${journal.settings.liveChart !== false ? "checked" : ""}> Двигать график вместе со временем</label>
        <p class="micro">Только у правого края истории. Просмотр прошлых дней остаётся на месте.</p>
        <label>Порядок событий в списке<select name="eventOrder"><option value="newest">Новые записи сверху</option><option value="time">По времени события</option></select></label>
        <p class="micro">«Новые записи сверху» — последняя добавленная запись будет первой, даже если она за утро. «По времени» — от утра к вечеру; стрелки меняют порядок и время. Расчёт графика всегда идёт по времени события.</p><label>Дневной график при сбросе масштаба (Авто)<select name="chartDensity"><option value="45">45 дней · подробнее</option><option value="90">90 дней</option><option value="180">180 дней · обзор</option></select></label>
        <p class="micro">Кнопка «Авто» показывает последние 45, 90 или 180 дней и подбирает высоту по видимым значениям.</p><label>Колебания между событиями<select name="rhythmStrength"><option value="1">Спокойные</option><option value="4">Выразительные</option><option value="8">Живые</option></select></label><p class="micro">Меняется только визуальный ритм, вес записей остаётся твоим.</p><label>Граница цветов на базовом графике<select name="baselineLevel"><option value="25">25% высоты графика</option><option value="50">50% · середина</option><option value="75">75% высоты графика</option></select></label>
        <p class="micro">Только для вида «Базовая линия»: выше этой границы линия окрашена в цвет роста, ниже — спада. 50% располагает границу посередине окна.</p><p class="micro">Минимальное значение — 0,01. Старые отрицательные записи можно исправить; они не изменяются автоматически.</p>
        <label class="checkbox-label"><input type="checkbox" name="eventAnimation" ${journal.settings.eventAnimation !== false ? "checked" : ""}> Анимация после записи</label><p class="micro">Короткое построение свечей до добавленного момента. Итог и время событий остаются точными.</p><label class="checkbox-label"><input type="checkbox" name="motion" ${journal.settings.reducedMotion ? "checked" : ""}> Уменьшить анимацию</label>
      </section>
      <section data-settings-panel="application" role="tabpanel" aria-label="Приложение" hidden>
        <h3>Запуск и обновления</h3>
        <label class="checkbox-label"><input type="checkbox" name="appAutoStart"> <span id="app-auto-start-label">Запускать при входе в систему</span></label>
        <div id="app-tray-setting" hidden><label class="checkbox-label"><input type="checkbox" name="appTray"> При автозапуске открывать в трее</label><p class="micro">Только запуск вместе с системой уходит в трей. Если открыть High. вручную, появится полное окно.</p></div>
        <label class="checkbox-label"><input type="checkbox" name="appAutoUpdates"> Проверять обновления автоматически</label>
        <p class="micro">Дневник работает без сети. Интернет нужен только для проверки обновлений и синхронизации по твоему запросу. Перед установкой обновления появится запрос.</p>
        <div id="app-shortcut-setting"><button type="button" class="secondary" id="make-desktop-shortcut">Создать ярлык на рабочем столе</button><span id="desktop-shortcut-status" class="micro" role="status"></span></div>
        <p id="application-settings-status" class="preview-caption" role="status">Загружаю настройки приложения…</p>
        <button type="submit" class="primary full-width" id="save-application-settings" disabled>Сохранить настройки приложения</button>
      </section>
      <section data-settings-panel="experimental" role="tabpanel" aria-label="Эксперименты" hidden>
        <h3>Экспериментальные настройки</h3>
        <label class="checkbox-label"><input type="checkbox" name="experimentalRandom" ${draft.experimentalRandom ? "checked" : ""}> Показывать кнопку «Случайное»</label>
        <p class="micro">Кнопка добавляет на график тестовые события за несколько дней. Включай её, когда хочешь посмотреть пример случайного движения.</p>
      </section>
      <p class="form-error" role="alert"></p><div class="settings-save" hidden><button type="button" class="secondary" id="cancel-settings">Отмена</button><button type="submit" class="primary">Сохранить настройки</button></div>
    </form>
    <section data-settings-panel="data" role="tabpanel" aria-label="Мои данные" class="settings-data" hidden><h3>Твоя история принадлежит тебе</h3><p>Данные хранятся локально. Перед изменениями создаётся резервная копия; доступны 30 последних состояний.</p><div class="data-buttons"><button id="export" class="secondary" ${demo ? "disabled" : ""}>${icon("download", 16)} Экспорт</button><button id="import" class="secondary" ${demo ? "disabled" : ""}>${icon("upload", 16)} Импорт</button><button id="backups" class="icon-button" aria-label="Открыть резервные копии" title="Открыть резервные копии" ${demo ? "disabled" : ""}>${icon("folder", 18)}</button></div><p class="micro">JSON включает записи, заметки и оформление.<br>Формат подходит для переноса между устройствами; синхронизация выполняется вручную и только после выбора файла сопряжения.</p><p class="micro">Даты записей сохраняются при смене часового пояса.<br>Часовой пояс дневника: ${esc(journal.settings.timeZone)}.</p><button id="demo-from-settings" class="text-button">Посмотреть демонстрационный график ${icon("right", 13)}</button></section>`);
  dialog.classList.add("appearance-modal");
  const form = $("#settings-form");
  const dataPanel = dialog.querySelector('[data-settings-panel="data"]');
  dataPanel.insertAdjacentHTML(
    "beforeend",
    `<section class="sync-panel" aria-label="Синхронизация между устройствами"><h3>Синхронизация между устройствами</h3><p>Выбери файл сопряжения на каждом устройстве. Дневник шифруется на устройстве перед отправкой; для первой загрузки потребуется подтверждение.</p><div class="sync-actions"><button type="button" class="secondary" id="sync-connect" ${demo ? "disabled" : ""}>Выбрать файл сопряжения</button><button type="button" class="primary" id="sync-now" ${demo ? "disabled" : ""}>Синхронизировать сейчас</button><input type="file" id="sync-credentials-file" accept=".json,application/json" hidden></div><p id="sync-status" role="status" aria-live="polite"></p></section>`,
  );
  const syncConnect = dialog.querySelector("#sync-connect"),
    syncNow = dialog.querySelector("#sync-now"),
    syncFile = dialog.querySelector("#sync-credentials-file"),
    syncStatus = dialog.querySelector("#sync-status");
  const paintSyncStatus = () => {
    const credentials = loadSyncCredentials();
    syncNow.disabled = demo || !credentials;
    syncStatus.textContent = credentials
      ? "Файл сопряжения сохранён на этом устройстве. Для второго устройства используй тот же файл."
      : "Сначала выбери cloudflare/local-credentials.json. Дневник пока остаётся только на этом устройстве.";
  };
  paintSyncStatus();
  syncConnect.onclick = () => {
    syncFile.value = "";
    syncFile.click();
  };
  syncFile.onchange = async () => {
    const file = syncFile.files?.[0];
    if (!file) return;
    try {
      if (file.size > 16 * 1024)
        throw new Error("Файл сопряжения неожиданно большой");
      const credentials = parseSyncCredentials(await file.text());
      saveSyncCredentials(credentials);
      paintSyncStatus();
      try {
        const graphs = await syncClient.listGraphs(credentials);
        syncStatus.textContent = `Файл принят. На сервере найдено графиков: ${graphs.length}. Нажми «Синхронизировать сейчас», когда будешь готов.`;
      } catch (error) {
        syncStatus.textContent = `Файл сохранён, сервер пока недоступен: ${error.message}`;
      }
      toast("Файл сопряжения сохранён на этом устройстве");
    } catch (error) {
      syncStatus.textContent = "Не удалось подключить файл: " + error.message;
      toast(syncStatus.textContent);
    }
  };
  syncNow.onclick = async () => {
    syncNow.disabled = true;
    syncStatus.textContent = "Проверяю облачную копию…";
    try {
      const message = await syncJournalNow();
      if (syncStatus.isConnected) syncStatus.textContent = message;
      toast(message);
    } catch (error) {
      if (syncStatus.isConnected)
        syncStatus.textContent = "Не удалось синхронизировать: " + error.message;
      toast("Не удалось синхронизировать: " + error.message);
    } finally {
      if (syncNow.isConnected) syncNow.disabled = demo || !loadSyncCredentials();
    }
  };
  let activeSettingsTab = "appearance",
    applicationPreferences = null;
  const appSettingsStatus = dialog.querySelector("#application-settings-status"),
    traySetting = dialog.querySelector("#app-tray-setting"),
    trayInput = form.elements.appTray,
    shortcutButton = dialog.querySelector("#make-desktop-shortcut");
  const updateTraySetting = () => {
    const enabled = form.elements.appAutoStart.checked;
    traySetting.hidden = !enabled;
    trayInput.disabled = !enabled;
    if (!enabled) trayInput.checked = false;
  };
  form.elements.appAutoStart.onchange = updateTraySetting;
  const paintApplicationPreferences = (prefs) => {
    applicationPreferences = prefs;
    form.elements.appAutoStart.checked = !!prefs.autoStart;
    form.elements.appTray.checked = !!prefs.autoStart && !!prefs.tray;
    form.elements.appAutoUpdates.checked = !!prefs.autoUpdates;
    updateTraySetting();
    const mobile = prefs.platform === "mobile";
    dialog.querySelector("#app-auto-start-label").textContent =
      prefs.platform === "win32"
        ? "Запускать вместе с Windows"
        : "Запускать при входе в систему";
    for (const name of ["appAutoStart", "appAutoUpdates"])
      (form.elements[name].closest("label")).hidden = mobile || (name === "appAutoUpdates" && prefs.portable);
    traySetting.hidden = mobile || !prefs.autoStart;
    trayInput.disabled = mobile || !prefs.autoStart;
    const shortcutSupported = ["win32", "linux"].includes(prefs.platform);
    dialog.querySelector("#app-shortcut-setting").hidden = !shortcutSupported;
    shortcutButton.disabled = !shortcutSupported || !!prefs.desktopShortcutMatches;
    shortcutButton.textContent = prefs.desktopShortcutMatches
      ? "Ярлык на рабочем столе уже создан"
      : prefs.desktopShortcutExists
        ? "Обновить существующий ярлык"
        : "Создать ярлык на рабочем столе";
    dialog.querySelector("#desktop-shortcut-status").textContent =
      prefs.desktopShortcutMatches
        ? ""
        : prefs.desktopShortcutExists
          ? "Ярлык обновится на месте и откроет эту установку."
          : "Если ярлык уже есть, второй не создаётся.";
    dialog.querySelector("#save-application-settings").disabled = false;
    dialog.querySelector("#save-application-settings").hidden = mobile;
    appSettingsStatus.textContent = mobile
      ? "На телефоне запуск и обновления управляются системой и магазином приложений."
      : prefs.portable
        ? "Версия без установки. Если переместишь EXE, открой его один раз — включённый автозапуск обновит путь. Дневник остаётся в AppData. Обновление пока выполняется заменой EXE."
        : "Настройки запуска сохранены на этом устройстве.";
  };
  void api.preferences()
    .then(paintApplicationPreferences)
    .catch((error) => {
      appSettingsStatus.textContent = "Не удалось прочитать настройки: " + error.message;
    });
  shortcutButton.onclick = async () => {
    if (!applicationPreferences || shortcutButton.disabled) return;
    shortcutButton.disabled = true;
    try {
      await api.configure({
        autoStart: !!applicationPreferences.autoStart,
        tray: !!applicationPreferences.autoStart && !!applicationPreferences.tray,
        autoUpdates: !!applicationPreferences.autoUpdates,
        shortcut: true,
      });
      paintApplicationPreferences(await api.preferences());
      toast("Ярлык создан на рабочем столе");
    } catch (error) {
      shortcutButton.disabled = false;
      appSettingsStatus.textContent = "Не удалось создать ярлык: " + error.message;
    }
  };
  form.elements.theme.value = draft.theme;
  form.elements.eventOrder.value = draft.eventOrder ?? "newest";
  form.elements.chartDensity.value = String(draft.chartDensity ?? 45);
  form.elements.baselineLevel.value = String(draft.baselineLevel ?? 50);
  form.elements.rhythmStrength.value = String(draft.rhythmStrength ?? 4);
  let appearanceSequence = 0;
  const updatePreview = (save = false) => {
    draft.theme = form.elements.theme.value;
    previewSettings = draft;
    theme();
    const palette =
      draft.appearance?.palette ?? (draft.theme === "light" ? "blue" : "amber");
    dialog.querySelectorAll("[data-preset]").forEach((button) => {
      const preset = THEME_PRESETS.find((p) => p.id === button.dataset.preset);
      const active = preset
        ? preset.palette === palette && preset.theme === draft.theme
        : palette === "custom";
      button.setAttribute("aria-pressed", String(active));
    });
    const chartMode =
      draft.appearance?.chartColors ??
      (palette === "custom" ? "custom" : "classic");
    form.elements.chartColors.value = chartMode;
    $("#custom-colors").hidden = palette !== "custom" && chartMode !== "custom";
    form.elements["color-accent"].closest("label").hidden =
      palette !== "custom";
    const { tokens } = themeTokens(
      draft,
      matchMedia("(prefers-color-scheme: dark)").matches,
    );
    const poor = COLOR_KEYS.filter(
      (k) => contrastRatio(tokens[k], tokens.surface) < 3,
    );
    $("#theme-contrast").textContent = poor.length
      ? "Некоторые цвета сливаются с фоном — попробуй сделать их светлее или темнее."
      : "";
    if (save) {
      const sequence = ++appearanceSequence;
      const chosen = {
        theme: draft.theme,
        appearance: structuredClone(draft.appearance ?? { palette }),
      };
      const caption = dialog.querySelector(".preview-caption");
      caption.textContent = "Сохраняю оформление…";
      commit((next) => {
        Object.assign(next.settings, chosen);
        return next;
      })
        .then(() => {
          if (sequence === appearanceSequence)
            caption.textContent = demo
              ? "Тема применена в демо"
              : "Оформление сохранено автоматически";
        })
        .catch((error) => {
          if (sequence === appearanceSequence) {
            Object.assign(draft, structuredClone(journal.settings));
            theme();
            caption.textContent = "Не удалось сохранить: " + error.message;
            toast(caption.textContent);
          }
        });
    }
  };
  dialog.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.onclick = () => {
      activeSettingsTab = button.dataset.settingsTab;
      dialog
        .querySelectorAll("[data-settings-tab]")
        .forEach((b) => b.setAttribute("aria-selected", String(b === button)));
      dialog
        .querySelectorAll("[data-settings-panel]")
        .forEach(
          (panel) =>
            (panel.hidden =
              panel.dataset.settingsPanel !== button.dataset.settingsTab),
        );
      form.hidden = button.dataset.settingsTab === "data";
      dialog.querySelector(".settings-save").hidden =
        !["general", "experimental"].includes(button.dataset.settingsTab);
    };
  });
  dialog.querySelectorAll("[data-preset]").forEach((button) => {
    button.onclick = () => {
      const preset = THEME_PRESETS.find((p) => p.id === button.dataset.preset);
      if (preset) {
        customBase = preset.palette;
        draft.theme = preset.theme;
        draft.appearance = {
          palette: preset.palette,
          chartColors: form.elements.chartColors.value || "classic",
        };
        if (draft.appearance.chartColors === "custom")
          draft.appearance.colors = { ...customColors };
        form.elements.theme.value = preset.theme;
        const { tokens } = themeTokens(draft);
        customColors = Object.fromEntries(
          COLOR_KEYS.map((k) => [k, tokens[k]]),
        );
        COLOR_KEYS.forEach((k) => {
          form.elements["color-" + k].value = customColors[k];
          $("[data-color-output=" + k + "]").textContent = customColors[k];
        });
      } else
        draft.appearance = {
          palette: "custom",
          basePalette: customBase,
          colors: { ...customColors },
          chartColors: "custom",
        };
      updatePreview(true);
    };
  });
  $("#custom-from-theme").onclick = () => {
    const current = themeTokens(draft).tokens;
    customColors = Object.fromEntries(COLOR_KEYS.map((k) => [k, current[k]]));
    COLOR_KEYS.forEach((k) => {
      form.elements["color-" + k].value = customColors[k];
      $("[data-color-output=" + k + "]").textContent = customColors[k];
    });
    draft.appearance = {
      palette: "custom",
      basePalette: customBase,
      chartColors: "custom",
      colors: { ...customColors },
    };
    updatePreview(true);
  };
  form.elements.chartColors.onchange = () => {
    const mode = form.elements.chartColors.value;
    const palette =
      draft.appearance?.palette ?? (draft.theme === "light" ? "blue" : "amber");
    if (mode === "custom") {
      const current = themeTokens(draft).tokens;
      customColors = Object.fromEntries(COLOR_KEYS.map((k) => [k, current[k]]));
      COLOR_KEYS.forEach((k) => {
        form.elements["color-" + k].value = customColors[k];
        $("[data-color-output=" + k + "]").textContent = customColors[k];
      });
    }
    draft.appearance = {
      ...draft.appearance,
      palette,
      chartColors: mode,
      ...(mode === "custom" ? { colors: { ...customColors } } : {}),
    };
    updatePreview(true);
  };
  form.elements.theme.onchange = () => updatePreview(true);
  COLOR_KEYS.forEach((k) => {
    form.elements["color-" + k].oninput = (e) => {
      customColors[k] = e.target.value;
      draft.appearance = {
        ...draft.appearance,
        palette:
          k === "accent" ? "custom" : (draft.appearance?.palette ?? customBase),
        basePalette: customBase,
        chartColors: "custom",
        colors: { ...customColors },
      };
      $("[data-color-output=" + k + "]").textContent = e.target.value;
      updatePreview(true);
    };
  });
  $("#preview-event").onclick = () =>
    toast("Это пример кнопки в выбранной теме");
  $("#cancel-settings").onclick = closeModal;
  dialog.addEventListener("close", async () => {
    await saveQueue;
    if (previewSettings === draft) {
      previewSettings = null;
      theme();
      if (!$("dialog")) render();
    }
  });
  const readCoin = bindCoinEditor(form, draft.coin);
  updatePreview();
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (activeSettingsTab === "application") {
      const button = dialog.querySelector("#save-application-settings");
      button.disabled = true;
      try {
        await api.configure({
          autoStart: form.elements.appAutoStart.checked,
          tray:
            form.elements.appAutoStart.checked && form.elements.appTray.checked,
          autoUpdates: form.elements.appAutoUpdates.checked,
          shortcut: false,
        });
        paintApplicationPreferences(await api.preferences());
        toast("Настройки приложения сохранены");
      } catch (error) {
        appSettingsStatus.textContent = "Не удалось сохранить: " + error.message;
        button.disabled = false;
      }
      return;
    }
    const button = dialog.querySelector(".settings-save [type=submit]");
    button.disabled = true;
    try {
      const next = structuredClone(journal);
      if (!form.elements.initial.value.trim())
        throw new Error("Укажи начальное значение");
      Object.assign(next.settings, draft, {
        name: form.elements.name.value.trim(),
        initial: Number(form.elements.initial.value),
        reducedMotion: form.elements.motion.checked,
        eventAnimation: form.elements.eventAnimation.checked,
        experimentalRandom: form.elements.experimentalRandom.checked,
        coin: readCoin(),
        followEvent: form.elements.followEvent.checked,
        liveChart: form.elements.liveChart.checked,
        eventOrder: form.elements.eventOrder.value,
        chartDensity: Number(form.elements.chartDensity.value),
        baselineLevel: Number(form.elements.baselineLevel.value),
        rhythmStrength: Number(form.elements.rhythmStrength.value),
      });
      await commit(next);
      previewSettings = null;
      closeModal();
      render();
      toast("Настройки сохранены");
    } catch (error) {
      form.querySelector(".form-error").textContent = error.message;
      button.disabled = false;
    }
  };
  $("#export").onclick = async () => {
    try {
      if (await api.export()) toast("Дневник экспортирован");
    } catch (e) {
      toast("Не удалось экспортировать: " + e.message);
    }
  };
  $("#import").onclick = importFile;
  $("#backups").onclick = async () => {
    try {
      const err = await api.backups();
      if (err) toast(err);
    } catch (e) {
      toast(e.message);
    }
  };
  $("#demo-from-settings").onclick = () => {
    previewSettings = null;
    closeModal();
    startDemo();
  };
  if (initialTab === "general")
    dialog.querySelector('[data-settings-tab="general"]').click();
  if (initialTab === "application")
    dialog.querySelector('[data-settings-tab="application"]').click();
}
async function importFile() {
  try {
    pendingImport = await api.import();
    if (!pendingImport) return;
    const c = calculate(pendingImport);
    modal(
      `<div class="modal-eyebrow">ФАЙЛ ПРОВЕРЕН</div><h2>Восстановить дневник?</h2><p class="modal-description"><strong>${esc(pendingImport.settings.name)}</strong><br>${c.length} дней · ${pendingImport.events.filter((e) => !e.deletedAt).length} событий</p><p class="muted">Этот дневник заменит текущий. Его предыдущее состояние будет сохранено в резервной копии.</p><div class="form-footer"><button id="cancel-import" class="secondary">Отмена</button><button id="confirm-import" class="primary">Восстановить</button></div>`,
      { enterConfirm: "#confirm-import" },
    );
    $("#cancel-import").onclick = () => {
      pendingImport = null;
      closeModal();
    };
    $("#confirm-import").onclick = async (e) => {
      e.currentTarget.disabled = true;
      try {
        await commit(pendingImport, { replace: true });
        pendingImport = null;
        closeModal();
        end = localDate();
        selected = localDate();
        render();
        toast("Дневник восстановлен");
      } catch (error) {
        toast(error.message);
        closeModal();
      }
    };
  } catch (e) {
    toast("Импорт отменён: " + e.message);
  }
}
async function startDemo() {
  await saveQueue;
  if (!demo) personal = journal;
  demo = true;
  const appearanceSource = journal?.settings ?? startDraft;
  journal = demoJournal();
  journal.settings.theme = appearanceSource.theme;
  if (appearanceSource.appearance)
    journal.settings.appearance = structuredClone(appearanceSource.appearance);
  selected = localDate();
  span =
    interval > 1440
      ? Math.max(
          Math.ceil((interval / 1440) * 8),
          Math.min(
            3650,
            daysBetween(candles[0]?.date ?? localDate(), localDate()) + 1,
          ),
        )
      : (journal?.settings.chartDensity ?? 45);
  end = localDate();
  drawStart = null;
  view = "chart";
  render();
}
function onboarding() {
  theme();
  $("#app").innerHTML =
    `<div class="onboarding"><div class="onboarding-story"><a class="brand" href="#"><img src="../assets/icon.svg" alt=""><span>High<span class="brand-dot">.</span></span></a><div class="story-content"><span class="eyebrow">НЕ ИДЕАЛЬНАЯ ЛИНИЯ. ТВОЯ ИСТОРИЯ.</span><h1>Жизнь идёт<br>своим <em>ритмом.</em></h1><p>У неё есть взлёты, паузы и откаты.<br>Замечай их. Записывай важное.<br>И смотри на свой путь целиком.</p><svg class="welcome-chart" viewBox="0 0 540 210" fill="none" aria-hidden="true"><path d="M0 170H540M0 110H540M0 50H540" stroke="currentColor" opacity=".08"/>${[
      145, 130, 139, 118, 96, 108, 82, 66, 77, 49, 38, 20,
    ]
      .map((y, i) => {
        const down = [2, 5, 8].includes(i);
        return `<g fill="${down ? "var(--down)" : "var(--up)"}" stroke="${down ? "var(--down)" : "var(--up)"}"><path d="M${22 + i * 44} ${y - 13}v68"/><rect x="${18 + i * 44}" y="${y}" width="8" height="${down ? 22 : 34}" rx="0"/></g>`;
      })
      .join(
        "",
      )}</svg><p class="welcome-quote">Одна красная свеча<br>не отменяет весь твой рост.</p></div><span class="welcome-foot">ЛИЧНОЕ ПРОСТРАНСТВО ДЛЯ ТВОЕГО ПУТИ</span></div><div class="onboarding-form"><div class="onboarding-form-inner"><span class="step-label">НАЧАЛО ИСТОРИИ / 01</span><h2>${blocked ? "Вернём твою историю" : "С какой точки начнём?"}</h2><p class="modal-description">Ты сам решаешь, какой вес имеют события.<br>Здесь нет чужих оценок и правильных цифр.</p>${blocked ? '<p class="form-error">Основной файл повреждён. Импортируй резервную копию, чтобы продолжить.</p>' : `<form id="start-form"><label>Название твоего графика<input name="name" value="${esc(startDraft.name)}" maxlength="80" required></label><label>Начальное значение<input name="initial" type="number" value="${esc(startDraft.initial)}" min="-1000000000" max="1000000000" step="0.01" required></label><p class="micro">Это точка отсчёта, а не оценка тебя.</p>${starterChoice()}<label>Оформление</label><div class="start-themes">${THEME_PRESETS.map((t) => `<label><input type="radio" name="preset" value="${t.id}" ${t.palette === startDraft.appearance.palette && t.theme === startDraft.theme ? "checked" : ""}><span data-preset="${t.id}" style="--swatch:${t.swatch}">${t.name}</span></label>`).join("")}</div><p class="micro">Свою тему и цвета свечей можно настроить после создания.</p><p class="form-error" role="alert"></p><button type="submit" class="primary full-width">Начать свой путь ${icon("arrow", 18)}</button></form>`}<button class="demo-link" id="start-demo">Сначала посмотреть, как это выглядит ${icon("right", 14)}</button><button class="text-button import-start" id="start-import">${icon("upload", 14)} У меня уже есть дневник</button><p class="privacy-note">${icon("lock", 14)} Без регистрации. Только для тебя. Работает без интернета. Сеть нужна только для проверки обновлений и синхронизации по твоему запросу.</p></div></div></div>`;
  const startForm = $("#start-form");

  const rememberStart = (event) => {
    if (!startForm) return;

    startDraft.name = startForm.elements.name.value;
    startDraft.initial = startForm.elements.initial.value;
    const preset = THEME_PRESETS.find(
      (t) => t.id === startForm.elements.preset.value,
    );
    if (preset && event?.target?.name === "preset") {
      startDraft.theme = preset.theme;
      startDraft.appearance = { palette: preset.palette, chartColors: "classic" };
    }
    theme();
  };
  startForm?.addEventListener("input", rememberStart);
  startForm?.addEventListener("change", rememberStart);
  $("#start-demo").onclick = () => {
    rememberStart();
    startDemo();
  };
  $("#start-import").onclick = importFile;
  const archiveButton = document.createElement("button");
  archiveButton.className = "text-button import-start";
  archiveButton.textContent = "Восстановить удалённый график";
  archiveButton.onclick = trashForm;
  $("#start-import").after(archiveButton);
  $("#start-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      b = f.querySelector("[type=submit]");
    b.disabled = true;
    try {
      const next = createJournal(
        f.elements.name.value.trim(),
        Number(f.elements.initial.value),
        startDraft.theme,
      );
      next.settings.appearance = structuredClone(startDraft.appearance);
      if (f.elements.starterMode.value === "visual")
        next.settings.starter = createStarter();
      interval =
        f.elements.starterMode.value === "visual"
          ? STARTER_CANDLE_MINUTES
          : 15;
      resetViewport();
      await commit(next);
      view = "chart";
      render();
      coinForm(true);
    } catch (error) {
      f.querySelector(".form-error").textContent = error.message;
      b.disabled = false;
    }
  });
}
document.addEventListener("keydown", (e) => {
  if (
    (e.ctrlKey || e.metaKey) &&
    !e.shiftKey &&
    ["z", "я"].includes(e.key.toLowerCase()) &&
    $("#chart") &&
    !$("dialog") &&
    !e.target.closest("input,textarea,[contenteditable=true]")
  ) {
    e.preventDefault();
    undoToolAction();
    return;
  }
  if (e.key === "Escape") {
    $("#chart-style-menu")?.remove();
    $("#drawing-menu")?.remove();
    document
      .querySelector('[data-chart-style="candles"]')
      ?.setAttribute("aria-expanded", "false");
    clearFocus();
    const hadDrawing = drawTool || drawStart;
    drawTool = null;
    drawStart = null;
    measuring = false;
    measureStart = measureEnd = null;
    if (hadDrawing && $("#chart")) render();
    drawMeasurement();
    $("#measure-tool")?.setAttribute("aria-pressed", "false");
  }
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key.toLowerCase() === "n" &&
    journal &&
    !$("dialog")
  ) {
    e.preventDefault();
    eventForm();
  }
});
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest("#drawing-menu,#rail-trend"))
    $("#drawing-menu")?.remove();
  if (!e.target.closest('#chart-style-menu,[data-chart-style="candles"]')) {
    $("#chart-style-menu")?.remove();
    document
      .querySelector('[data-chart-style="candles"]')
      ?.setAttribute("aria-expanded", "false");
  }
  if (hover !== null && !e.target.closest("#chart")) clearFocus();
});
$("#minimize").onclick = () => api?.minimize();
$("#maximize").onclick = () => api?.maximize();
$("#close").onclick = () => {
  if (busy) {
    toast("Завершаю сохранение…");
    return;
  }
  api?.close();
};
window.addEventListener("beforeunload", (e) => {
  if (busy) {
    e.preventDefault();
    e.returnValue = "Идёт сохранение";
  }
});
try {
  if (!api)
    throw new Error("Запустите приложение через High.exe или npm start.");
  const result = await api.load();
  journal = personal = result.journal;
  blocked = !!result.blocked;
  if (journal?.settings.starter?.remaining) {
    interval = 15;
    resetViewport();
  }
  span = journal?.settings.chartDensity ?? 45;
  render();
  welcomeEntrance($("#app"));
  if (result.notice) toast(result.notice);
  if (!(await api.preferences()).initialized) applicationForm(true);
} catch (e) {
  $("#app").innerHTML =
    `<div class="fatal"><h1>Не удалось открыть дневник</h1><p>${esc(e.message)}</p></div>`;
}

let clockSeen = nowMinute();
function tickLiveChart() {
  const now = nowMinute(),
    previous = clockSeen;
  if (now === previous) return;
  if (!journal || view !== "chart" || journal.settings.liveChart === false) {
    clockSeen = now;
    return;
  }
  if (
    document.hidden ||
    busy ||
    drag ||
    pinned ||
    hover !== null ||
    drawTool ||
    measuring ||
    $("dialog[open]")
  )
    return;
  clockSeen = now;
  if (selected > localDate() || (intradayEnd !== null && intradayEnd > now + 1))
    return;
  if (interval < 1440 && (intradayEnd === null || intradayEnd >= previous)) {
    intradayEnd = now;
    drawChart();
  } else if (interval >= 1440 && end === dateAt(previous - 1)) {
    end = localDate();
    drawChart();
  }
}
setInterval(tickLiveChart, 1000);
document.addEventListener("visibilitychange", tickLiveChart);
