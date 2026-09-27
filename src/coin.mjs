import { localizeUI } from "./i18n.mjs";
export const COIN_COLORS = {
  gold: [localizeUI("Золото"), "#f5b840"],
  mint: [localizeUI("Мята"), "#37d6aa"],
  blue: [localizeUI("Синий"), "#77b9ff"],
  violet: [localizeUI("Фиолетовый"), "#bd98ff"],
  coral: [localizeUI("Коралл"), "#ff8c92"],
  red: [localizeUI("Красный"), "#ff465d"],
  orange: [localizeUI("Апельсин"), "#ff974f"],
  lime: [localizeUI("Лайм"), "#b4e55a"],
  cyan: [localizeUI("Бирюза"), "#50dce6"],
  pink: [localizeUI("Розовый"), "#f582c3"],
  white: [localizeUI("Белый"), "#f0f3fa"],
  silver: [localizeUI("Серебро"), "#c5d0de"],
  teal: [localizeUI("Петроль"), "#249c94"],
  indigo: [localizeUI("Индиго"), "#7178ee"],
  copper: [localizeUI("Медь"), "#d39465"],
};
export const COIN_SYMBOLS = {
  initials: localizeUI("Буквы"),
  prism: localizeUI("Призма"),
  link: localizeUI("Связь"),
  strata: localizeUI("Слои"),
  vector: localizeUI("Вектор"),
  nexus: localizeUI("Узел"),
  aperture: localizeUI("Контур"),
  diamond: localizeUI("Кристалл"),
  star: localizeUI("Звезда"),
  mountain: localizeUI("Горы"),
  orbit: localizeUI("Орбита"),
  bolt: localizeUI("Молния"),
  flame: localizeUI("Пламя"),
  crown: localizeUI("Корона"),
  compass: localizeUI("Компас"),
  wave: localizeUI("Волна"),
  sprout: localizeUI("Росток"),
  hex: localizeUI("Гексагон"),
};
export const COIN_RIMS = {
  classic: localizeUI("Двойной ободок"),
  solid: localizeUI("Заливка"),
  segments: localizeUI("Сегменты"),
};
export function validateCoin(coin) {
  if (coin === undefined) return;
  if (
    !coin ||
    typeof coin !== "object" ||
    !(
      Object.hasOwn(COIN_COLORS, coin.color) ||
      /^#[a-fA-F0-9]{6}$/.test(coin.color)
    ) ||
    !Object.hasOwn(COIN_SYMBOLS, coin.symbol) ||
    (coin.rim !== undefined && !Object.hasOwn(COIN_RIMS, coin.rim)) ||
    (coin.label !== undefined &&
      (typeof coin.label !== "string" || Array.from(coin.label).length > 5))
  )
    throw new Error(localizeUI("Некорректное оформление монеты"));
}
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function hexToHsl(hex) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    lightness = (max + min) / 2;
  let hue = 0,
    saturation = 0;
  if (max !== min) {
    const delta = max - min;
    saturation =
      lightness > 0.5
        ? delta / (2 - max - min)
        : delta / (max + min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
  }
  return {
    hue: Math.round(hue) % 360,
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100),
  };
}
function hslToHex(hue, saturation, lightness) {
  const h = ((Number(hue) % 360) + 360) % 360,
    s = Math.max(0, Math.min(100, Number(saturation))) / 100,
    l = Math.max(0, Math.min(100, Number(lightness))) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s,
    segment = h / 60,
    second = chroma * (1 - Math.abs((segment % 2) - 1));
  const [r, g, b] =
    segment < 1
      ? [chroma, second, 0]
      : segment < 2
        ? [second, chroma, 0]
        : segment < 3
          ? [0, chroma, second]
          : segment < 4
            ? [0, second, chroma]
            : segment < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];
  const offset = l - chroma / 2;
  return `#${[r, g, b]
    .map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}
export function coinSvg(
  name = "",
  coin = { color: "gold", symbol: "initials" },
) {
  validateCoin(coin);
  const tint = COIN_COLORS[coin.color]?.[1] ?? coin.color;
  const solid = coin.rim === "solid";
  const color = solid ? "#11151b" : tint;
  const label = coin.label || Array.from(name.trim()).slice(0, 2).join("");
  const letters = escape(
    Array.from(label.trim()).slice(0, 5).join("").toLocaleUpperCase("ru") ||
      "V",
  );
  const letterWidth = Array.from(label.trim().toLocaleUpperCase("ru")).reduce((sum, char) => sum + (/[WMШЩЖЮ]/.test(char) ? 1.15 : /[IІ1]/.test(char) ? 0.5 : 0.86), 0);
  const letterSize = Math.min(23, 44 / Math.max(1, letterWidth));
  const art = {
    prism: `<path fill="${color}" stroke="none" d="M32 12 48 25 33 32 17 25Zm-15 18 13 6v16L17 41Zm17 6 14-6v11L34 52Z"/>`,
    link: `<path d="m28 21 5-5a10 10 0 0 1 14 14l-7 7M36 43l-5 5a10 10 0 0 1-14-14l7-7M24 40l16-16" stroke-width="6"/>`,
    strata: `<path fill="${color}" stroke="none" d="M16 17h33l-6 7H10Zm3 12h34l-6 7H13Zm-3 12h33l-6 7H10Z"/>`,
    vector: `<path fill="${color}" stroke="none" d="M12 18h9l11 21 11-21h9L32 54ZM28 12h8v17h-8Z"/>`,
    nexus: `<path fill="${color}" stroke="none" d="M14 14h12v12H14Zm24 0h12v12H38ZM26 26h12v12H26ZM14 38h12v12H14Zm24 0h12v12H38Z"/>`,
    aperture: `<path d="M44 19a19 19 0 1 0 5 21M18 33h28M33 18v30" stroke-width="6"/>`,
    initials: `<text x="32" y="33" dominant-baseline="middle" text-anchor="middle" font-family="Georgia, serif" font-size="${letterSize}" font-weight="700" fill="${color}" stroke="none">${letters}</text>`,
    bolt: '<path d="m35 12-17 24h13l-2 16 17-25H33Z"/>',
    flame:
      '<path d="M32 12c6 12 17 18 13 29-4 13-25 13-28 0-2-8 3-13 8-18-1 10 9 7 7-11Z"/>',
    crown: '<path d="m15 23 9 8 8-15 8 15 9-8-4 23H19Z M19 40h26"/>',
    compass:
      '<circle cx="32" cy="32" r="18"/><path d="m39 22-3 14-14 6 6-15Z"/>',
    wave: '<path d="M14 25q9-12 18 0t18 0M14 34q9-12 18 0t18 0M14 43q9-12 18 0t18 0"/>',
    sprout:
      '<path d="M32 49V29M32 36Q12 38 16 18q20-1 16 18M32 29q-2-16 16-15 2 17-16 15"/>',
    hex: '<path d="m32 13 17 10v19L32 52 15 42V23Z m0 9 9 5v10l-9 5-9-5V27Z"/>',
    diamond: '<path d="m32 15 14 17-14 17-14-17Z M18 32h28 M32 15v34"/>',
    star: '<path d="m32 14 5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1Z"/>',
    mountain: '<path d="m14 44 13-23 7 12 6-8 11 19Z M22 30l5 4 5-4"/>',
    orbit:
      '<circle cx="32" cy="32" r="9"/><ellipse cx="32" cy="32" rx="22" ry="10" transform="rotate(-35 32 32)"/>',
  }[coin.symbol];
  return `<svg viewBox="0 0 64 64" aria-hidden="true" class="coin-svg"><circle cx="32" cy="32" r="30" fill="${solid ? tint : "#11151b"}" stroke="${tint}" stroke-width="2"/><circle cx="32" cy="32" r="25" fill="none" stroke="${color}" opacity="${solid ? 0.6 : 0.3}" stroke-dasharray="${coin.rim === "segments" ? "5 4" : "none"}"/><g fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round">${art}</g></svg>`;
}
export function coinEditor() {
  return localizeUI`<fieldset class="coin-editor"><legend>Монетка графика</legend><div class="coin-customizer"><div class="coin-preview"></div><div><div class="coin-options" role="group" aria-label="Цвет монетки">${Object.entries(
    COIN_COLORS,
  )
    .map(
      ([id, [name, color]]) =>
        `<button type="button" data-coin-color="${id}" aria-label="${name}" style="--coin-color:${color}"><i></i></button>`,
    )
    .join(
      "",
    )}<button type="button" data-coin-custom aria-label="Свой цвет" title="Настроить цвет">+</button></div><div class="coin-custom-color" hidden><div class="coin-custom-color-heading"><span class="coin-custom-swatch"></span><span>Свой цвет</span><strong class="coin-custom-value">#F5B840</strong></div><label class="coin-range-label">Оттенок<input type="range" name="coinHue" min="0" max="359" step="1" value="40" aria-label="Оттенок цвета"></label><div class="coin-range-pair"><label class="coin-range-label">Насыщенность<input type="range" name="coinSaturation" min="0" max="100" step="1" value="90" aria-label="Насыщенность цвета"></label><label class="coin-range-label">Светлота<input type="range" name="coinLightness" min="0" max="100" step="1" value="50" aria-label="Светлота цвета"></label></div><label class="coin-hex-label">HEX<input name="coinHex" maxlength="7" placeholder="#AABBCC" pattern="#[a-fA-F0-9]{6}" autocomplete="off"></label></div><div class="coin-options coin-symbols" role="group" aria-label="Символ монетки">${Object.entries(
    Object.fromEntries(
      Object.entries(COIN_SYMBOLS).filter(([id]) =>
        [
          "initials",
          "prism",
          "link",
          "strata",
          "vector",
          "nexus",
          "aperture",
        ].includes(id),
      ),
    ),
  )
    .map(
      ([id, name]) =>
        `<button type="button" data-coin-symbol="${id}">${name}</button>`,
    )
    .join(
      "",
    )}</div><details class="legacy-coins"><summary>Прежние символы</summary><div class="coin-options">${Object.entries(
    COIN_SYMBOLS,
  )
    .filter(
      ([id]) =>
        ![
          "initials",
          "prism",
          "link",
          "strata",
          "vector",
          "nexus",
          "aperture",
        ].includes(id),
    )
    .map(
      ([id, name]) =>
        `<button type="button" data-coin-symbol="${id}">${name}</button>`,
    )
    .join(
      "",
    )}</div></details><div class="coin-options coin-rims" role="group" aria-label="Ободок монетки">${Object.entries(
    COIN_RIMS,
  )
    .map(
      ([id, name]) =>
        `<button type="button" data-coin-rim="${id}">${name}</button>`,
    )
    .join(
      "",
    )}</div><label class="coin-letter-field">Свои буквы · от 1 до 5<input name="coinLabel" maxlength="10" placeholder="Из названия графика" autocomplete="off"></label></div></div><p class="micro">Личный знак графика.</p></fieldset>`;
}
export function bindCoinEditor(root, coin) {
  let value = {
    color: "gold",
    symbol: "initials",
    rim: "classic",
    label: "",
    ...coin,
  };
  const labelInput = root.querySelector('[name="coinLabel"]');
  labelInput.value = value.label;
  labelInput.oninput = () => {
    value.label = Array.from(labelInput.value).slice(0, 5).join("");
    labelInput.value = value.label;
    paint();
  };
  const paint = () => {
    const custom = value.color.startsWith("#");
    root.querySelector(".coin-custom-color").hidden = !custom;
    root
      .querySelector("[data-coin-custom]")
      .setAttribute("aria-pressed", String(custom));
    root
      .querySelector(".coin-letter-field")
      .classList.toggle("inactive", value.symbol !== "initials");
    const pickerColor = custom ? value.color : COIN_COLORS[value.color][1];
    const hsl = hexToHsl(pickerColor);
    root.querySelector("[name=coinHue]").value = hsl.hue;
    root.querySelector("[name=coinSaturation]").value = hsl.saturation;
    root.querySelector("[name=coinLightness]").value = hsl.lightness;
    root.querySelector(".coin-custom-color").style.setProperty(
      "--coin-picker-hue",
      hsl.hue,
    );
    root.querySelector(".coin-custom-swatch").style.backgroundColor = pickerColor;
    root.querySelector(".coin-custom-value").textContent = pickerColor.toUpperCase();
    root.querySelector("[name=coinHex]").value = custom ? value.color : "";
    for (const b of root.querySelectorAll("[data-coin-rim]"))
      b.setAttribute("aria-pressed", String(b.dataset.coinRim === value.rim));
    root.querySelector(".coin-preview").innerHTML = coinSvg(
      root.querySelector('[name="name"]').value,
      value,
    );
    for (const b of root.querySelectorAll("[data-coin-color]"))
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.coinColor === value.color),
      );
    for (const b of root.querySelectorAll("[data-coin-symbol]"))
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.coinSymbol === value.symbol),
      );
  };
  for (const b of root.querySelectorAll("[data-coin-color]"))
    b.onclick = () => {
      value.color = b.dataset.coinColor;
      paint();
    };
  for (const b of root.querySelectorAll("[data-coin-symbol]"))
    b.onclick = () => {
      value.symbol = b.dataset.coinSymbol;
      paint();
    };
  for (const b of root.querySelectorAll("[data-coin-rim]"))
    b.onclick = () => {
      value.rim = b.dataset.coinRim;
      paint();
    };
  root.querySelector('[name="name"]').addEventListener("input", paint);
  root.querySelector("[data-coin-custom]").onclick = () => {
    value.color = (
      COIN_COLORS[value.color]?.[1] ?? value.color
    ).toLowerCase();
    paint();
    root.querySelector("[name=coinHue]").focus();
  };
  const readHsl = () => {
    value.color = hslToHex(
      root.querySelector("[name=coinHue]").value,
      root.querySelector("[name=coinSaturation]").value,
      root.querySelector("[name=coinLightness]").value,
    );
    paint();
  };
  for (const input of root.querySelectorAll('[name="coinHue"], [name="coinSaturation"], [name="coinLightness"]'))
    input.oninput = readHsl;
  root.querySelector("[name=coinHex]").oninput = (e) => {
    if (/^#[a-fA-F0-9]{6}$/.test(e.target.value)) {
      value.color = e.target.value.toLowerCase();
      paint();
    }
  };
  paint();
  return () => ({ ...value });
}
