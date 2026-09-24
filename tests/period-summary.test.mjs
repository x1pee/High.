import test from "node:test";
import assert from "node:assert/strict";
import {
  createJournal,
  upsertDay,
  upsertEvent,
  calculate,
  validateJournal,
} from "../src/domain.mjs";
import {
  periodBounds,
  shiftPeriodAnchor,
  summarizePeriod,
} from "../src/period-summary.mjs";

test("week and month bounds use calendar dates and include leap day", () => {
  assert.deepEqual(periodBounds("2026-09-24", "week"), {
    start: "2026-09-21",
    end: "2026-09-27",
  });
  assert.deepEqual(periodBounds("2024-02-29", "month"), {
    start: "2024-02-01",
    end: "2024-02-29",
  });
  assert.equal(shiftPeriodAnchor("2025-01-31", "month", 1), "2025-02-28");
});

test("period summary uses real compounded values, absolute turnover and notes", () => {
  let journal = createJournal("Сводка", 100);
  journal = upsertEvent(journal, {
    date: "2026-09-21",
    time: "10:00",
    text: "Большой хороший момент",
    delta: 10,
  });
  journal = upsertEvent(journal, {
    date: "2026-09-22",
    time: "11:00",
    text: "Небольшой откат",
    delta: -5,
  });
  journal = upsertDay(journal, {
    date: "2026-09-23",
    title: "Запомнить",
    note: "Хороший спокойный день",
  });
  journal = upsertEvent(journal, {
    date: "2026-09-29",
    time: "12:00",
    text: "За пределами недели",
    delta: 20,
  });

  const summary = summarizePeriod(
    calculate(journal),
    "2026-09-21",
    "2026-09-27",
  );
  assert.equal(summary.days, 3);
  assert.equal(summary.eventCount, 2);
  assert.equal(summary.delta, 5);
  assert.equal(summary.percent, 5);
  assert.equal(summary.turnover, 15);
  assert.equal(summary.highlights[0].text, "Большой хороший момент");
  assert.equal(summary.notes[0].note, "Хороший спокойный день");
});

test("favorite dates validate and reject duplicates or malformed values", () => {
  const journal = createJournal("Избранное", 100);
  journal.settings.favoriteDays = ["2026-09-24"];
  assert.deepEqual(validateJournal(journal).settings.favoriteDays, ["2026-09-24"]);
  assert.throws(() =>
    validateJournal({
      ...journal,
      settings: { ...journal.settings, favoriteDays: ["2026-09-24", "2026-09-24"] },
    }),
  );
  assert.throws(() =>
    validateJournal({
      ...journal,
      settings: { ...journal.settings, favoriteDays: ["2026-02-30"] },
    }),
  );
});
