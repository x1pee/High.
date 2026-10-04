# High.

**Your life, one entry at a time.**

An offline journal that turns everyday moments into a personal chart. Add an entry, choose its impact, and watch your story take shape.

- Candles, trend lines, and space to plan ahead.
- Notes, favorite days, and weekly or monthly summaries.
- Five themes and an English or Russian interface.
- Local backups, JSON export, and optional encrypted manual sync.

## Get started

Download **High_2.0.0_x64.exe** from [Releases](https://github.com/x1pee/High./releases/tag/v2.0.0) and open it. No installer. Windows requires WebView2 Runtime.

Your journal lives in `%APPDATA%\Vyshe`. High. checks GitHub for updates and highlights the update button when a new version is available. Download and restart after confirmation; your entries stay on your device. You can also replace the EXE manually after closing High.

Other platforms are available as **preview builds**:

| Platform | Download | Notes |
| --- | --- | --- |
| Linux x64 | [AppImage](https://github.com/x1pee/High./releases/download/v2.0.0/High_2.0.0_linux_x64.AppImage) | Make the file executable, then open it. |
| macOS Apple Silicon | [High.app archive](https://github.com/x1pee/High./releases/download/v2.0.0/High_2.0.0_macos_arm64_preview.tar.gz) | Extract and open High.app. No Apple signing or notarization; macOS may block it. Intel Macs are not supported by this build. |
| Android ARM64 | [APK](https://github.com/x1pee/High./releases/download/v2.0.0/High_2.0.0_android_arm64.apk) | 8.4 MB optimized release build with a persistent Android signing key; outside Google Play. |

If you installed the previous Android debug APK, export your journal before removing it: Android cannot install this release over an app signed with the old debug key. Import the journal after installing the new APK.

These builds passed compilation, but have not been tested on physical devices. Built-in updates are verified on Windows only. **iPhone is postponed** until Apple signing and distribution are configured.

Sync transfers individual graphs manually through a pairing file; keep that file private. [Sync guide](cloudflare/README.md) · [Platform status](PLATFORMS-AND-SYNC.md).

## По-русски

High. — дневник, который превращает события в личный график. Записывай важное, добавляй заметки и замечай свой ритм. Данные остаются на устройстве; зашифрованную синхронизацию можно включить вручную. Скачай EXE из Releases и открой — установка не нужна.

## Development

`npm ci` · `npm start` · `npm test` · `npm run pack`

[Changelog](CHANGELOG.md) · [Release guide](RELEASE.md) · [Audit](AUDIT-PRE-2.0.md) · [Next steps](V2-READINESS.md)
