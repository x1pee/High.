import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseQuickMove,
  QUICK_MOVE_WINDOW_MS,
  quickMoveStage,
  recentQuickMove,
} from "../src/quick-moves.mjs";

test("quick-move name tiers start at clicks 1, 5, 10, and 20", () => {
  assert.deepEqual(
    [1, 4, 5, 9, 10, 19, 20, 100].map(quickMoveStage),
    [1, 1, 2, 2, 3, 3, 4, 4],
  );
});

test("each direction and tier has ten distinct names and records the click suffix", () => {
  for (const direction of ["up", "down"]) {
    for (const count of [1, 5, 10, 20]) {
      const names = Array.from(
        { length: 10 },
        (_, i) => chooseQuickMove(direction, count, () => (i + 0.1) / 10).text,
      );
      assert.equal(new Set(names).size, 10);
      assert(names.every((name) => name.endsWith(`(x${count})`)));
    }
  }
});

test("rapid clicks reuse only the latest event with the same direction and date", () => {
  const now = Date.parse("2026-09-24T16:00:00.000Z");
  const events = [
    {
      id: "up-old",
      date: "2026-09-24",
      quickMove: { direction: "up", count: 1, lastAt: new Date(now - 240_000).toISOString() },
    },
    {
      id: "down",
      date: "2026-09-24",
      quickMove: { direction: "down", count: 1, lastAt: new Date(now - 60_000).toISOString() },
    },
    {
      id: "up-new",
      date: "2026-09-24",
      quickMove: { direction: "up", count: 2, lastAt: new Date(now - 10_000).toISOString() },
    },
    {
      id: "up-other-day",
      date: "2026-09-23",
      quickMove: { direction: "up", count: 8, lastAt: new Date(now - 1_000).toISOString() },
    },
    {
      id: "up-deleted",
      date: "2026-09-24",
      deletedAt: new Date(now - 1_000).toISOString(),
      quickMove: { direction: "up", count: 9, lastAt: new Date(now - 1_000).toISOString() },
    },
  ];

  assert.equal(recentQuickMove(events, "up", "2026-09-24", now)?.id, "up-new");
  assert.equal(recentQuickMove(events, "down", "2026-09-24", now)?.id, "down");
});

test("a click exactly five minutes later joins the event; one millisecond later starts a new one", () => {
  const now = Date.parse("2026-09-24T16:00:00.000Z");
  const event = {
    id: "up",
    date: "2026-09-24",
    createdAt: new Date(now - QUICK_MOVE_WINDOW_MS).toISOString(),
    quickMove: { direction: "up", count: 1 },
  };
  assert.equal(recentQuickMove([event], "up", event.date, now)?.id, "up");
  assert.equal(
    recentQuickMove([event], "up", event.date, now + 1),
    null,
  );
});

test("neighboring clicks avoid repeating the same name variant", () => {
  const first = chooseQuickMove("up", 1, () => 0.4);
  const next = chooseQuickMove("up", 2, () => 0.4, first.variant);
  assert.notEqual(next.variant, first.variant);
});
