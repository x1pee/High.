const STORAGE_KEY = "high-volume-panel-height";

export const DEFAULT_VOLUME_PANEL_HEIGHT = 100;
export const MIN_VOLUME_PANEL_HEIGHT = 56;
const MAX_VOLUME_PANEL_HEIGHT = 280;
const MIN_PRICE_PLOT_HEIGHT = 120;
const CHART_FIXED_HEIGHT = 72;

let preferredHeight = DEFAULT_VOLUME_PANEL_HEIGHT;
try {
  const saved = Number(globalThis.localStorage?.getItem(STORAGE_KEY));
  if (Number.isFinite(saved) && saved > 0) preferredHeight = saved;
} catch {}

export function volumePanelBounds(chartHeight) {
  return {
    min: MIN_VOLUME_PANEL_HEIGHT,
    max: Math.max(
      MIN_VOLUME_PANEL_HEIGHT,
      Math.min(
        MAX_VOLUME_PANEL_HEIGHT,
        Math.floor(chartHeight - CHART_FIXED_HEIGHT - MIN_PRICE_PLOT_HEIGHT),
      ),
    ),
  };
}

export function getVolumePanelHeight(chartHeight) {
  const { min, max } = volumePanelBounds(chartHeight);
  return Math.max(min, Math.min(max, preferredHeight));
}

export function setVolumePanelHeight(height, chartHeight) {
  const { min, max } = volumePanelBounds(chartHeight);
  preferredHeight = Math.round(Math.max(min, Math.min(max, height)));
  return preferredHeight;
}

export function saveVolumePanelHeight() {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, String(preferredHeight));
  } catch {}
}

export function resetVolumePanelHeight() {
  preferredHeight = DEFAULT_VOLUME_PANEL_HEIGHT;
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {}
  return preferredHeight;
}
