export function animateEventChart(root, bars, geometry, eventId, settings) {
  if (
    settings.eventAnimation === false ||
    settings.reducedMotion ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return false;
  const index = bars.findIndex((c) => c.events.some((e) => e.id === eventId));
  if (index < 0) return false;
  // Rebuild the already computed interval in order. No extra dates or prices.
  let first = index;
  while (
    first > Math.max(0, index - 12) &&
    !bars[first - 1].recorded &&
    !bars[first - 1].starter
  )
    first--;
  root.dataset.eventAnimation = "playing";
  const animations = [];
  const event = bars[index].events.find((e) => e.id === eventId);
  const before = event.before ?? bars[index].open;
  const after = event.after ?? bars[index].close;
  const color = after >= before ? "var(--up)" : "var(--down)";
  const ns = "http://www.w3.org/2000/svg";
  const transient = document.createElementNS(ns, "g");
  transient.dataset.candleIndex = String(index);
  transient.dataset.recorded = "true";
  transient.dataset.eventImpulse = eventId;
  const body = document.createElementNS(ns, "rect");
  const target = root.querySelector(
    `.chart-candle[data-candle-index="${index}"]`,
  );
  const width = target?.querySelector(".candle-body")?.getAttribute("width") ??
    Math.max(1, Math.min(14, Math.floor(geometry.step * 0.72)));
  body.setAttribute("x", geometry.x(index) - Number(width) / 2);
  body.setAttribute("y", Math.min(geometry.y(before), geometry.y(after)));
  body.setAttribute("width", width);
  body.setAttribute(
    "height",
    Math.max(2, Math.abs(geometry.y(after) - geometry.y(before))),
  );
  body.setAttribute("fill", color);
  transient.style.pointerEvents = "none";
  transient.append(body);
  root.querySelector("svg").append(transient);
  const oldOpacity = target?.style.opacity ?? "";
  // Keep the final candle faintly visible under the animated impulse so it
  // never disappears while the event is being revealed.
  if (target) target.style.opacity = "0.28";
  for (let i = first; i <= index; i++) {
    const el =
      i === index
        ? transient
        : root.querySelector(`.chart-candle[data-candle-index="${i}"]`);
    if (!el) continue;
    const delay = (i - first) * 45;
    el.style.transformOrigin = `${geometry.x(i)}px ${geometry.y(i === index ? before : bars[i].open)}px`;
    const animation = el.animate(
      [
        { opacity: 0.2, transform: "scaleY(.08)" },
        { opacity: 1, transform: "scaleY(.67)", offset: 0.2 },
        { opacity: 1, transform: "scaleY(.5)", offset: 0.34 },
        { opacity: 1, transform: "scaleY(.91)", offset: 0.55 },
        { opacity: 1, transform: "scaleY(.79)", offset: 0.68 },
        { opacity: 1, transform: "scaleY(1.025)", offset: 0.87 },
        { opacity: 1, transform: "scaleY(1)" },
      ],
      {
        duration: i === index ? 1250 : 240,
        delay,
        fill: "backwards",
        easing: "cubic-bezier(.18,.7,.3,1)",
      },
    );
    animations.push(animation.finished.catch(() => {}));
  }
  // Also works for line/baseline styles, where there are no candle elements.
  const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  halo.setAttribute("cx", geometry.x(index));
  halo.setAttribute("cy", geometry.y(after));
  halo.setAttribute("r", "7");
  halo.setAttribute("fill", "none");
  halo.setAttribute("stroke", color);
  halo.setAttribute("stroke-width", "2");
  halo.style.pointerEvents = "none";
  halo.style.transformOrigin = `${geometry.x(index)}px ${geometry.y(after)}px`;
  root.querySelector("svg").append(halo);
  const flash = halo.animate(
    [
      { opacity: 0, transform: "scale(.6)" },
      { opacity: 1, offset: 0.25 },
      { opacity: 0, transform: "scale(3)" },
    ],
    { duration: 1150, delay: (index - first) * 45, fill: "both" },
  );
  animations.push(flash.finished.catch(() => {}));
  Promise.all(animations).then(() => {
    halo.remove();
    transient.remove();
    if (target) target.style.opacity = oldOpacity;
    delete root.dataset.eventAnimation;
  });
  return true;
}
