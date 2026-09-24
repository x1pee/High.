import test from "node:test";
import assert from "node:assert/strict";
import {
  createJournal,
  upsertEvent,
  calculate,
  shiftDate,
} from "../src/domain.mjs";
import {
  timeline,
  minuteAt,
  dateAt,
  candleTitle,
  movingAverage,
  MAX_BARS,
} from "../src/timeline.mjs";
import { intraday } from "../src/intraday.mjs";
function fixture() {
  let j = createJournal("T", 1000);
  for (let d = 0; d < 21; d++)
    for (let n = 0; n < 6; n++)
      j = upsertEvent(j, {
        date: shiftDate("2026-09-01", d),
        time: String(n * 4 + 1).padStart(2, "0") + ":20",
        text: "Событие",
        delta: n % 2 ? -3 : 5,
      });
  return j;
}
test("4h spans three weeks continuously and preserves every day close and real event", () => {
  const j = fixture(),
    days = calculate(j),
    source = JSON.stringify(j),
    bars = timeline(
      days,
      1000,
      240,
      minuteAt("2026-09-01"),
      minuteAt("2026-09-22"),
    );
  assert.equal(bars.length, 126);
  assert.equal(new Set(bars.map((c) => c.date)).size, 21);
  for (let i = 1; i < bars.length; i++) {
    assert.equal(bars[i].open, bars[i - 1].close);
    assert.equal(bars[i].from, bars[i - 1].to);
  }
  for (const d of days)
    assert.equal(bars.filter((c) => c.date === d.date).at(-1).close, d.close);
  assert.equal(bars.flatMap((c) => c.events).length, 126);
  assert.equal(JSON.stringify(j), source);
});
test("1h and 5m cross midnight; missing days have no invented movement, no future candles", () => {
  let j = createJournal("T", 1000);
  j = upsertEvent(j, {
    date: "2026-09-01",
    time: "23:59",
    text: "A",
    delta: 5,
  });
  j = upsertEvent(j, {
    date: "2026-09-03",
    time: "00:01",
    text: "B",
    delta: 5,
  });
  for (const interval of [5, 60]) {
    const bars = timeline(
      calculate(j),
      1000,
      interval,
      minuteAt("2026-09-01", 23 * 60),
      minuteAt("2026-09-03", 30),
    );
    assert(bars.length > 24);
    assert.equal(bars.at(-1).to, minuteAt("2026-09-03", 30));
    assert.equal(bars.at(-1).close, 1010);
    for (const c of bars.filter((c) => c.date === "2026-09-02"))
      assert.deepEqual(
        [c.open, c.close, c.high, c.low, c.synthetic],
        [1005, 1005, 1005, 1005, false],
      );
  }
  assert.deepEqual(
    timeline([], 1000, 60, minuteAt("2026-09-01"), minuteAt("2026-09-03")),
    [],
  );
});
test("Stable calendar coordinates across DST, bounded minute chart and SMA", () => {
  assert.equal(dateAt(minuteAt("2026-03-29")), "2026-03-29");
  const bars = timeline(
    calculate(fixture()),
    1000,
    1,
    minuteAt("2026-09-01"),
    minuteAt("2026-09-22"),
  );
  assert(bars.length <= MAX_BARS + 1);
  assert.deepEqual(
    movingAverage([{ close: 1 }, { close: 3 }, { close: 5 }], 2),
    [null, 2, 4],
  );
});
test("Candle names reflect size and direction; custom titles always take precedence", () => {
  const c = {
    date: "2026-09-20",
    recorded: true,
    title: "",
    delta: 1,
    percent: 0.1,
  };
  const small = candleTitle(c),
    large = candleTitle({ ...c, delta: 100, percent: 10 }),
    down = candleTitle({ ...c, delta: -100, percent: -10 });
  assert.notEqual(small, large);
  assert.notEqual(large, down);
  assert.equal(candleTitle(c), small);
  assert.equal(candleTitle({ ...c, title: "Мой день" }), "Мой день");
  assert.equal(
    candleTitle({ ...c, recorded: false, synthetic: false }),
    "Без новых записей",
  );
});

test("intraday candle titles use the day name and keep event text in the event list", () => {
  const day = {
    date: "2026-09-24",
    open: 100,
    close: 90,
    title: "День под давлением",
    note: "Отдельная заметка дня",
    events: [
      {
        id: "loss",
        date: "2026-09-24",
        time: "13:00",
        text: "Потерял 70 баксов",
        delta: -10,
        before: 100,
        after: 90,
      },
    ],
  };
  const titled = intraday(day, 1, { until: 14 * 60 });
  const eventCandle = titled.find((bar) => bar.events.length);
  assert.equal(eventCandle.title, day.title);
  assert.equal(eventCandle.events[0].text, "Потерял 70 баксов");
  assert.equal(candleTitle(eventCandle), day.title);

  const unnamed = intraday({ ...day, title: "" }, 1, { until: 14 * 60 })
    .find((bar) => bar.events.length);
  assert.equal(unnamed.title, "");
  assert.notEqual(candleTitle(unnamed), day.events[0].text);
});

test('Panning a historical window never changes the shared candles or anchors',()=>{
  const days=calculate(fixture()),now=minuteAt('2026-09-22');
  const full=timeline(days,1000,60,minuteAt('2026-09-18'),now,true,now);
  const cropped=timeline(days,1000,60,minuteAt('2026-09-19',120),minuteAt('2026-09-20',840),true,now);
  assert(cropped.length>24);
  for(const bar of cropped)assert.deepEqual(bar,full.find(c=>c.from===bar.from));
});
