# High. 2.0.0 — release checks

2026-10-04. Windows release; source and downloads remain private.

- JavaScript: 126 tests passed, including journal recovery, quick moves, sync conflicts, and update lifecycle.
- Rust: 2 tests passed for scoped profile paths and complete document replacement.
- Headless layout QA passed at desktop and phone widths.
- English QA passed for chart, entry form, diary, all settings, version history, and RU/EN persistence. User-written entries stayed unchanged.
- Windows production EXE built locally: 6,164,480 bytes; SHA256 `3E4B25F8FC7AACCAD8305F7222988A1515A365FDE992CD4F1F1EF232F1902BDA`.
- Real WebView2 QA passed with a separate profile and audit identifier `life.high.audit20261004`: create/save, restart persistence, scoped native IO, tray launch, second-instance activation, English persistence, and graceful close. The user's running older app and autostart entry were preserved. This is not an upgrade test of the user's installed copy.
- Package, Cargo, Tauri, and visible version agree on 2.0.0. Release history starts with 2.0.0 in both languages.
- README and release notes now lead with short English copy and include a brief Russian introduction.
- Windows release workflow builds and signs a portable EXE, signature, and manifest. Native QA workflow uses portable Linux AppImage and macOS app targets; no setup/MSI/DEB/DMG is published.
- The first Windows CI attempt exposed an invalid default workspace caused by the trailing dot in `High.`. The repaired workflow fetches the private tagged source into RUNNER_TEMP using an ephemeral authenticated header and supports dispatch for an existing tag. The duplicate Windows job was removed from the cross-platform QA matrix.

## Scope

Manual encrypted sync transfers individual graphs through a pairing file. It is not background library sync; keys currently remain in local WebView storage. Physical Android sync and mobile installation have not been validated.

The GitHub repository is private. Anonymous in-app update requests still cannot download Releases; use an authorized GitHub download and replace the EXE manually. Signed artifacts do not by themselves establish that the private updater works.

Linux, macOS, and Android workflows produce QA artifacts. Successful compilation does not establish native runtime behavior or production signing on those platforms.

[Earlier audit](AUDIT-PRE-2.0.md) · [Remaining updater and sync work](V2-READINESS.md)
