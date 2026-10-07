High. 2.0.0.1 / internal SemVer 2.0.1 — 2026-10-08

- Visual rhythm now generates deterministic candles on days without events; day-end anchors remain exact. Disabling rhythm keeps gaps flat. No synthetic events or journal mutations.
- Decorative wick extrema are a presentation layer for recorded, interpolated and starter candles. Future space remains empty.
- With Auto off, price-axis dragging scales around the viewport midpoint; plot dragging still pans. Auto continues to lock vertical movement.
- Number roll direction only controls motion. Signed spans use their own sign for color.
- 128 JavaScript tests passed. Desktop + 390px browser QA passed, including price-axis drag in both directions, color during down-move animation, data save/reopen and drawing in future space. Browser QA mocks native IPC and is not physical mobile-device proof.
- Display version 2.0.0.1 uses SemVer 2.0.1 for Tauri, Android and signed updater compatibility.

- Native debug/audit build passed real WebView2 QA with an isolated profile: create/save, restart persistence, scoped native IO, visibility/tray behavior, English persistence and graceful close. The user's running 2.0.0 process was left open.

Published release: https://github.com/x1pee/High./releases/tag/v2.0.1 (title High. 2.0.0.1). Windows CI run 37692757166 and native run 37692757155 succeeded. EXE: 6 133 248 bytes, SHA-256 3ab55fb644703549848d9985767b0a98fe3718c4772debb7f028628c33f5aadc. APK: 8 405 524 bytes, SHA-256 2c80b5f68ba9e1d2a2f323cce7f7f736b3b63c3a7e7cfc396c54bb25a1d2f82e. APK signature v2/v3 passed; certificate matches the previous Android release. Anonymous full downloads matched SHA-256. Anonymous latest.json offers SemVer 2.0.1 with display_version 2.0.0.1; EXE signature and signed version passed independent minisign verification, and a modified EXE was rejected. Linux x64 and macOS ARM64 previews were also attached; macOS executable permissions were preserved. No physical mobile/macOS/Linux runtime proof is claimed.
