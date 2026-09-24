# Сборки платформ и синхронизация · 1.9.9.13

Проверка проекта: 24 сентября 2026. Основной desktop-клиент собран на Tauri 2. Linux, macOS и мобильные пакеты на этой машине не собирались и не проверялись на устройствах.

## Сборки

В `.github/workflows/tauri.yml` настроены ручной запуск и запуск по тегу `v1.9.9.*`. GitHub Actions использует отдельные Windows, Ubuntu и macOS runners; workflow проверяет JavaScript и Rust, собирает desktop-пакеты, Android debug APK и iOS Simulator. Артефакты пока прикрепляются к запуску Actions; workflow не публикует GitHub Release.

Перед запуском workflow исходники нужно поместить в GitHub-репозиторий и отправить туда тег. В текущей папке Git-репозиторий и remote не настроены.

| Платформа | Команда / результат | Что установить или учесть |
| --- | --- | --- |
| Windows | `npm ci`, `npm test`, `npm run pack`; собирает `src-tauri/target/release/high.exe` | Node.js 24, Rust stable/MSVC, Microsoft C++ Build Tools с Desktop development with C++, WebView2. В этой среде prerequisites уже установлены. |
| Linux | `npm run pack:linux`; AppImage и `.deb` | Linux-машина или Ubuntu runner; Rust stable, Node.js 24 и системные библиотеки WebKitGTK, GTK/appindicator, OpenSSL, librsvg, xdo и patchelf. Пакеты отличаются по дистрибутивам. |
| macOS | `npm run pack:mac`; `.app` и `.dmg` | Mac и Xcode Command Line Tools; для iOS нужен полный Xcode. Публичное распространение приложения требует подписи и notarization. |
| Android | `npm run android:init -- --ci`, затем `npm run android:build -- --debug --target aarch64 --apk` | Android Studio, Android SDK Platform/Platform Tools/Build Tools/Command-line Tools, NDK side-by-side, Java 21 или JBR из Android Studio и Rust Android target. CI собирает debug APK; подпись магазина не настроена. |
| iOS | `npm run ios:init -- --ci`, затем `npm run ios:build -- --debug --target aarch64-sim` | Mac, полный Xcode, CocoaPods и Rust targets для iOS Simulator. Сейчас проверяется только сборка симулятора; IPA для iPhone и App Store не собирался. Для публикации в App Store нужна программа Apple Developer за 99 USD в год; региональная цена может отличаться. |

Точные Linux-зависимости для Ubuntu, переменные Android SDK/NDK и цели Rust перечислены в [официальных prerequisites Tauri](https://v2.tauri.app/start/prerequisites/). Для распространения desktop-сборок потребуется настроить подпись, особенно для macOS.

## Обновления приложения и синхронизация дневника

Это две отдельные системы. GitHub Releases подходят для бинарных файлов приложения и release notes. Они не синхронизируют личный дневник. Текущий `src/tauri-bridge.mjs` намеренно возвращает состояние updater `unconfigured`; Tauri updater plugin, ключ подписи, endpoint и автоматическая публикация релизов ещё не настроены.

Для updater потребуется включить Tauri updater plugin, создать пару ключей подписи, добавить только приватный ключ как GitHub Actions secret, оставить публичный ключ в приложении, включить сборку signed updater artifacts и настроить публикацию GitHub Releases. Потеря приватного ключа лишит уже установленные копии возможности получать следующие обновления, поэтому секрет нужно отдельно сохранить в безопасном резервном месте.

Синхронизация дневника работает через бесплатный Cloudflare Workers + D1. Worker и база развёрнуты, а клиент доступен в «Настройки → Мои данные»: устройство шифрует дневник AES-GCM до отправки, Worker хранит только шифротекст. Подключение устройств выполняется одним и тем же файлом сопряжения `cloudflare/local-credentials.json`; точные шаги и ограничения описаны в [cloudflare/README.md](cloudflare/README.md). Сейчас перенос запускается вручную, первая отправка требует подтверждения, а несовпадающие версии требуют выбора локальной или облачной копии. Секреты файла сопряжения сохраняются в локальном хранилище WebView, а не в системном хранилище ключей.

На дату этой проверки Workers Free включает 100 тыс. запросов в сутки и 10 ms CPU на запрос. D1 Free ограничивает отдельную базу 500 MB, суммарное хранилище аккаунта — 5 GB, чтения — 5 млн строк/сутки, записи — 100 тыс. строк/сутки; превышение дневной квоты временно останавливает запросы. Условия сверяйте перед развёртыванием на [странице тарифов Workers](https://developers.cloudflare.com/workers/platform/pricing/) и в [ограничениях D1](https://developers.cloudflare.com/d1/platform/limits/).

Отдельный VPS сейчас покупать не нужно: Worker и D1 размещает Cloudflare. У бесплатного тарифа есть ограничения и нужно самостоятельно хранить резервную копию шифрованных данных; D1 Free сейчас предоставляет семидневное восстановление по времени.

Для фоновой синхронизации ещё нужны очередь изменений при отсутствии сети, автоматическая проверка после запуска/возврата приложения, безопасное разрешение одновременных правок и синхронизация удалений. Пока дневник остаётся локальным до нажатия «Синхронизировать сейчас»; перед первой загрузкой приложение отдельно запрашивает подтверждение. Ревизии на сервере защищают от тихой перезаписи, но пока при конфликте пользователь выбирает одну из двух целых копий.
