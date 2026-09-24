# Tauri 2 и переносимые сборки · 1.9.9.19

Основная оболочка приложения — Tauri 2. Windows рисует интерфейс в системном WebView2, macOS/iOS используют WebKit, Linux — WebKitGTK, Android — Android WebView. Windows EXE содержит приложение и web-ресурсы, а не Chromium и Node.js; это portable-файл без setup. Нужен WebView2 Runtime.

## Дневник и локальные данные

Windows по-прежнему использует `%APPDATA%\Vyshe`. Журнал, графики, резервные копии и удалённые графики читаются прежней моделью JSON. Tauri вызывает общую проверку и `desktop/library.cjs` для операций с графиками; файловый I/O выполняется командами Rust. Путь профиля ограничивает файловые операции, а сохранение использует временный файл и атомарную замену.

Для тестов используется отдельный профиль через `VYSHE_DATA_DIR`; личный дневник тогда не открывается и не изменяется. Не запускай две версии приложения одновременно с одним профилем, если одна из них может писать в тот же дневник.

Ручной запуск EXE показывает окно. Аргумент `--background` прячет его только для автозапуска Windows при включённых настройках автозапуска и трея. Повторный ручной запуск возвращает окно уже работающего экземпляра. Перед закрытием приложение дожидается сохранения.

## Версии и сборки

Четырёхчастная версия продукта хранится в `package.json` в поле `appVersion`; она подставляется в интерфейс и bridge при сборке. Внутренняя SemVer для Cargo/Tauri — 1.9.23.

После `npm ci`:

| Платформа | Нужные средства | Команда |
|---|---|---|
| Windows | Node.js 24, Rust MSVC, C++ Build Tools с Desktop development with C++, WebView2 | `npm run pack` |
| Linux | Linux/Ubuntu, Rust, Node.js, WebKitGTK 4.1, AppIndicator и build tools | `npm run pack:linux` |
| macOS | Mac, Rust и Xcode Command Line Tools | `npm run pack:mac` |
| Android | Android Studio, Android SDK/NDK, Java 21, Rust Android target | `npm run android:init -- --ci`, затем `npm run android:build -- --debug --target aarch64 --apk` |
| iPhone | Mac, полный Xcode, CocoaPods и Rust iOS targets | `npm run ios:init -- --ci`, затем `npm run ios:build -- --debug --target aarch64-sim` |

Windows portable output: `src-tauri/target/release/high.exe`; он не использует updater. `.github/workflows/updater-release.yml` выпускает NSIS-установщик и подписанные артефакты для Tauri updater. Перед релизом секрет GitHub Actions должен содержать приватный ключ. Linux и macOS требуют сборки на соответствующих ОС; текущая проверка автообновления ограничена Windows. Платформенный workflow также создаёт Android debug APK и iOS Simulator, но не подписанную IPA для iPhone.

## Текущий результат и границы

На Windows тестируются JavaScript-модель и Tauri UI layout на синтетическом дневнике. Для updater написаны проверки состояния, подписи/загрузки, ошибки и явного подтверждения установки; полный тест на двух установленных версиях ещё предстоит после публикации подписанных релизов.

Linux, macOS, Android и iOS на этой машине не собирались и на физических устройствах не проверялись. Синхронизация Cloudflare Worker + D1 уже подключена вручную; снимки шифруются на устройстве. Её transport и compare-and-swap проверяются тестами, но ключи сопряжения нужно хранить отдельно.
