import { localizeUI } from "./i18n.mjs";
// Shared, DOM-free appearance contract for desktop and future mobile clients.
export const PALETTES = ["blue", "amber", "green", "graphite", "custom"];
export const COLOR_KEYS = ["accent", "up", "down", "value"];
export const THEME_PRESETS = [
  {
    id: "night",
    name: localizeUI("Полночь"),
    theme: "dark",
    palette: "amber",
    swatch: "#f7a924",
    bg: "#101114",
  },
  {
    id: "terminal",
    name: localizeUI("Ледяная"),
    theme: "dark",
    palette: "blue",
    swatch: "#85b5ff",
    bg: "#101114",
  },
  {
    id: "forest",
    name: localizeUI("Хвойная"),
    theme: "dark",
    palette: "green",
    swatch: "#56d6a0",
    bg: "#101114",
  },
  {
    id: "graphite",
    name: localizeUI("Графит"),
    theme: "dark",
    palette: "graphite",
    swatch: "#c5cbd5",
    bg: "#141518",
  },
  {
    id: "day",
    name: localizeUI("Светлая"),
    theme: "light",
    palette: "blue",
    swatch: "#3269c4",
    bg: "#edf0f5",
  },
];
export function validateAppearance(a) {
  if (a === undefined) return;
  if (!a || typeof a !== "object" || !PALETTES.includes(a.palette))
    throw new Error(localizeUI("Некорректная палитра оформления"));
  if (
    a.chartColors !== undefined &&
    !["classic", "theme", "custom"].includes(a.chartColors)
  )
    throw new Error(localizeUI("Некорректные цвета графика"));
  if (a.chartColors === "custom" && !a.colors)
    throw new Error(localizeUI("Нужны цвета собственного графика"));
  if (a.colors !== undefined) {
    if (
      !a.colors ||
      typeof a.colors !== "object" ||
      COLOR_KEYS.some(
        (k) =>
          typeof a.colors[k] !== "string" ||
          !/^#[0-9a-f]{6}$/i.test(a.colors[k]),
      )
    )
      throw new Error(localizeUI("Цвета темы должны быть в формате #RRGGBB"));
  }
  if (a.palette === "custom" && !a.colors)
    throw new Error(localizeUI("В собственной теме нужны четыре цвета"));
  if (
    a.basePalette !== undefined &&
    !PALETTES.filter((p) => p !== "custom").includes(a.basePalette)
  )
    throw new Error(localizeUI("Некорректная основа собственной темы"));
}
const dark = {
  bg: "#101114",
  surface: "#15161a",
  "surface-raised": "#202126",
  "surface-hover": "#2a2b31",
  text: "#e2e7f0",
  muted: "#99a5b9",
  faint: "#8391a7",
  line: "#303138",
  grid: "#24252b",
  accent: "#85b5ff",
  up: "#16c784",
  down: "#f6465d",
  value: "#85b5ff",
};
const light = {
  bg: "#edf0f5",
  surface: "#ffffff",
  "surface-raised": "#ffffff",
  "surface-hover": "#e9edf5",
  text: "#202b3e",
  muted: "#58677f",
  faint: "#65748b",
  line: "#d5ddea",
  grid: "#e2e8f1",
  accent: "#3269c4",
  up: "#087f66",
  down: "#bc3d58",
  value: "#3269c4",
};
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrastRatio(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function inkFor(color) {
  return contrastRatio(color, "#15161a") > contrastRatio(color, "#ffffff")
    ? "#15161a"
    : "#ffffff";
}
export function themeTokens(settings = {}, systemDark = true) {
  const mode =
    settings.theme === "system"
      ? systemDark
        ? "dark"
        : "light"
      : settings.theme || "dark";
  const tokens = { ...(mode === "light" ? light : dark) };
  const selected =
    settings.appearance?.palette || (mode === "light" ? "blue" : "amber");
  const palette =
    selected === "custom"
      ? settings.appearance?.basePalette || "blue"
      : selected;
  if (palette === "amber")
    Object.assign(
      tokens,
      mode === "dark"
        ? {
            bg: "#101114",
            surface: "#15161a",
            "surface-raised": "#202126",
            "surface-hover": "#2a2b31",
            line: "#303138",
            grid: "#24252b",
            accent: "#f7a924",
            up: "#16c784",
            down: "#f6465d",
            value: "#16c784",
          }
        : {
            accent: "#975500",
            up: "#007f53",
            down: "#c32e46",
            value: "#007f53",
          },
    );
  if (palette === "green")
    Object.assign(
      tokens,
      mode === "dark"
        ? {
            bg: "#101114",
            surface: "#15161a",
            "surface-raised": "#202126",
            "surface-hover": "#2a2b31",
            line: "#303138",
            grid: "#24252b",
            accent: "#56d6a0",
            up: "#16c784",
            down: "#f6465d",
            value: "#16c784",
          }
        : {
            accent: "#14754f",
            up: "#14754f",
            down: "#b54352",
            value: "#14754f",
          },
    );
  if (palette === "graphite")
    Object.assign(
      tokens,
      mode === "dark"
        ? {
            bg: "#141518",
            surface: "#1a1b1f",
            "surface-raised": "#24262b",
            "surface-hover": "#303238",
            line: "#35383f",
            grid: "#292b31",
            accent: "#c5cbd5",
            value: "#c5cbd5",
          }
        : { accent: "#48566c", value: "#48566c" },
    );
  if (selected === "custom" && settings.appearance?.colors)
    for (const key of COLOR_KEYS) tokens[key] = settings.appearance.colors[key];
  const chartColors =
    settings.appearance?.chartColors ??
    (selected === "custom" ? "custom" : "classic");
  if (chartColors === "classic") {
    tokens.up = mode === "light" ? "#087f66" : "#16c784";
    tokens.down = mode === "light" ? "#bc3d58" : "#f6465d";
    tokens.value = tokens.up;
  } else if (chartColors === "theme") {
    tokens.up = tokens.accent;
    tokens.value = tokens.accent;
    tokens.down =
      mode === "light" ? "#bc3d58" : palette === "blue" ? "#e695b7" : "#f6465d";
  } else if (settings.appearance?.colors) {
    for (const k of ["up", "down", "value"])
      tokens[k] = settings.appearance.colors[k];
  }
  tokens["accent-ink"] = inkFor(tokens.accent);
  tokens["value-ink"] = inkFor(tokens.value);
  tokens["up-soft"] = tokens.up + (mode === "dark" ? "18" : "12");
  tokens["down-soft"] = tokens.down + (mode === "dark" ? "18" : "12");
  return { mode, tokens };
}
