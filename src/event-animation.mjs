const DURATION = 420;
let nextAnimationId = 0;

// One impulse, no history replay. Its real endpoints are never overshot.
export function animateEventChart(root, bars, geometry, eventId, settings, transition = {}) {
  if (settings.eventAnimation === false || settings.reducedMotion ||
      matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const index = bars.findIndex(c => c.events.some(e => e.id === eventId));
  if (index < 0 || !root.querySelector("svg")) return false;
  // The recorded interval owns only real before/after values. Visual drift
  // has already returned to this open, even when the event is mid-interval.
  const bar = bars[index];
  const before = bar.open, after = bar.close;
  if (![before, after].every(Number.isFinite)) return false;
  const initial = Number.isFinite(transition.fromValue) ? transition.fromValue : before;
  const ns = "http://www.w3.org/2000/svg";
  const svg = root.querySelector("svg");
  const overlay = document.createElementNS(ns, "g");
  overlay.setAttribute("clip-path", "url(#price-plot)");
  overlay.style.pointerEvents = "none";
  const token = String(++nextAnimationId);
  root.dataset.eventAnimation = "playing";
  root.dataset.eventAnimationId = token;
  const color = after > before ? "var(--up)" : after < before ? "var(--down)" : "var(--muted)";
  const target = root.querySelector(`.chart-candle[data-candle-index="${index}"]`);
  const oldOpacity = target?.style.opacity ?? "";
  const animations = [];
  // Dense canvas and line charts already have their final geometry; only
  // highlight the endpoint there instead of placing a duplicate candle.
  const referenceEnd = after === before ? initial : after;
  if (target && before !== referenceEnd) {
    const transient = document.createElementNS(ns, "g");
    transient.dataset.eventImpulse = eventId;
    transient.dataset.candleIndex = String(index);
    transient.dataset.before = String(before);
    transient.dataset.after = String(after);
    transient.dataset.initialValue = String(initial);
    transient.dataset.duration = String(DURATION);
    const body = document.createElementNS(ns, "rect");
    const width = Number(target.querySelector(".candle-body")?.getAttribute("width")) ||
      Math.max(1, Math.min(24, geometry.bw ?? geometry.step * 0.8));
    body.classList.add("event-impulse-body");
    body.setAttribute("x", geometry.x(index) - width / 2);
    body.setAttribute("y", Math.min(geometry.y(before), geometry.y(referenceEnd)));
    body.setAttribute("width", width);
    body.setAttribute("height", Math.abs(geometry.y(referenceEnd) - geometry.y(before)));
    body.setAttribute("fill", color);
    transient.append(body);
    transient.style.transformOrigin = `${geometry.x(index)}px ${geometry.y(before)}px`;
    transient.style.transformBox = "view-box";
    overlay.append(transient);
    target.style.opacity = "0";
    const fraction = (initial - before) / (referenceEnd - before);
    const finalFraction = (after - before) / (referenceEnd - before);
    const animation = transient.animate([
      { transform: `scaleY(${fraction})` },
      { transform: `scaleY(${finalFraction})` },
    ], { duration: DURATION, easing: "cubic-bezier(.2,.7,.25,1)", fill: "both" });
    animations.push(animation.finished.catch(() => {}));
  }
  const halo = document.createElementNS(ns, "circle");
  halo.dataset.eventHalo = eventId;
  halo.setAttribute("cx", geometry.x(index));
  halo.setAttribute("cy", geometry.y(after));
  halo.setAttribute("r", "6");
  halo.setAttribute("fill", "none");
  halo.setAttribute("stroke", color);
  halo.setAttribute("stroke-width", "1.5");
  overlay.append(halo);
  svg.append(overlay);
  const flash = halo.animate([{opacity:0}, {opacity:0.8,offset:0.3}, {opacity:0}],
    {duration:DURATION,fill:"both"});
  animations.push(flash.finished.catch(() => {}));
  Promise.all(animations).then(() => {
    overlay.remove();
    if (target?.isConnected) target.style.opacity = oldOpacity;
    if (root.dataset.eventAnimationId === token) {
      delete root.dataset.eventAnimation;
      delete root.dataset.eventAnimationId;
    }
  });
  return true;
}
