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
| iPhone | Не входит в текущий план выпуска | Отдельная сборка для iOS не настроена. |

Windows portable output: `src-tauri/target/release/high.exe`. Официальный EXE включает собственное подписанное обновление: приложение проверяет GitHub Release, скачивает EXE, сверяет подпись и заменяет себя только после подтверждения. `.github/workflows/updater-release.yml` публикует EXE, подпись и `latest.json`; установщик, MSI и ZIP не создаются. Сборки для Linux, macOS и Android пока относятся к плану версии 2.0.

## Текущий результат и границы

Windows CI проверяет JavaScript и Rust. Сквозной тест обновления `1.9.22 → 1.9.23` прошёл на отдельной копии EXE: подпись и загрузка проверены, файл совпал с опубликованным по SHA-256, приложение перезапустилось, а тестовый дневник сохранился.

Linux, macOS и Android ещё не собирались в целевом workflow и не проверялись на устройствах. Синхронизация Cloudflare Worker + D1 запускается вручную; снимки шифруются на устройстве. Её transport и compare-and-swap проверяются тестами, но ключи сопряжения нужно хранить отдельно.
