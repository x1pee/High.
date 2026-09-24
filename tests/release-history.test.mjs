import test from "node:test";
import assert from "node:assert/strict";
import { applyDisplayVersion, isDisplayVersion, parseReleaseHistory } from "../scripts/release-history.mjs";

test("release history accepts the 2.0 line and reads the newest changelog sections", () => {
  const changelog = [
    "# Версия 2.0.0 · 2026-10-01",
    "",
    "- Перенос дневника между устройствами.",
    "- Обновлён выбор времени.",
    "",
    "# Версия 1.9.9.17 · 24.09.2026",
    "",
    "- График можно двигать по вертикали.",
  ].join("\n");
  assert.deepEqual(parseReleaseHistory(changelog), [
    {
      version: "2.0.0",
      notes: "Перенос дневника между устройствами. Обновлён выбор времени.",
    },
    { version: "1.9.9.17", notes: "График можно двигать по вертикали." },
  ]);
  assert.equal(isDisplayVersion("2.0.0"), true);
  assert.equal(isDisplayVersion("2.0"), true);
  assert.equal(isDisplayVersion("1.9.9.17"), true);
  assert.equal(isDisplayVersion("2..0"), false);
  assert.equal(
    applyDisplayVersion("High. __APP_VERSION__; history: 1.9.9.16", "2.0.0"),
    "High. 2.0.0; history: 1.9.9.16",
  );
  assert.throws(() => applyDisplayVersion("High. __APP_VERSION__", "2..0"), /Invalid display version/);
});
