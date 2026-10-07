High. 2.0.0.1 / internal SemVer 2.0.1 — 2026-10-08

- Visual rhythm now generates deterministic candles on days without events; day-end anchors remain exact. Disabling rhythm keeps gaps flat. No synthetic events or journal mutations.
- Decorative wick extrema are a presentation layer for recorded, interpolated and starter candles. Future space remains empty.
- With Auto off, price-axis dragging scales around the viewport midpoint; plot dragging still pans. Auto continues to lock vertical movement.
- Number roll direction only controls motion. Signed spans use their own sign for color.
- 128 JavaScript tests passed. Desktop + 390px browser QA passed, including price-axis drag in both directions, color during down-move animation, data save/reopen and drawing in future space. Browser QA mocks native IPC and is not physical mobile-device proof.
- Display version 2.0.0.1 uses SemVer 2.0.1 for Tauri, Android and signed updater compatibility.
