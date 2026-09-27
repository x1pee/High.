export function createUpdateClient({
  check,
  relaunch,
  getPreferences,
  version,
  history,
  flush = async () => {},
}) {
  let pending = null;
  let checking = null;
  let downloaded = 0;
  let total = 0;
  let status = null;

  const snapshot = (value = status) => ({
    state: value.state,
    version,
    history,
    message: value.message,
    ...(value.targetVersion ? { targetVersion: value.targetVersion } : {}),
  });
  const unsupported = () => {
    const preferences = getPreferences();
    return preferences.platform === "mobile" || preferences.portable;
  };
  const unavailable = () => ({
    state: "unavailable",
    message: "Обновления доступны в официальной Windows-версии приложения.",
  });

  function updateState() {
    if (unsupported()) return snapshot(unavailable());
    return snapshot(
      status ?? {
        state: "idle",
        message: "Нажми «Проверить обновления», чтобы узнать о новой версии.",
      },
    );
  }

  async function checkUpdate() {
    if (unsupported()) return updateState();
    if (["downloaded", "installed"].includes(status?.state)) return updateState();
    if (checking) return checking;
    checking = (async () => {
      status = { state: "checking", message: "Проверяю обновления…" };
      pending = null;
      try {
        pending = await check();
        status = pending
          ? {
              state: "available",
              targetVersion: pending.version,
              message: `Доступна версия ${pending.version}. Сначала загрузка, установка начнётся только после подтверждения.`,
            }
          : {
              state: "current",
              message: "У тебя установлена последняя версия.",
            };
      } catch (error) {
        status = {
          state: "error",
          message: `Не удалось проверить обновления: ${error?.message ?? String(error)}`,
        };
      } finally {
        checking = null;
      }
      return updateState();
    })();
    return checking;
  }

  async function downloadUpdate() {
    if (unsupported()) return updateState();
    if (["downloaded", "installed"].includes(status?.state)) return updateState();
    if (!pending) {
      const checked = await checkUpdate();
      if (!pending) return checked;
    }
    downloaded = 0;
    total = 0;
    status = { state: "downloading", message: "Загружаю обновление…" };
    try {
      await pending.download((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total > 0) {
            status.message = `Загружено ${Math.min(100, Math.floor((downloaded / total) * 100))}%.`;
          }
        }
      });
      status = {
        state: "downloaded",
        targetVersion: pending.version,
        message: `Версия ${pending.version} загружена и проверена. Подтверди перезапуск для установки.`,
      };
    } catch (error) {
      status = {
        state: "error",
        message: `Не удалось загрузить обновление: ${error?.message ?? String(error)}`,
      };
    }
    return updateState();
  }

  async function installUpdate() {
    if (unsupported()) return updateState();
    if (!pending || status?.state !== "downloaded")
      return {
        ...updateState(),
        state: "error",
        message: "Сначала проверь и загрузи обновление.",
      };
    try {
      status = { state: "installing", targetVersion: pending.version, message: "Сохраняю дневник и устанавливаю обновление…" };
      await flush();
      await pending.install();
      await relaunch();
      status = { state: "installed", message: "Перезапускаю приложение…" };
    } catch (error) {
      status = {
        state: "error",
        message: `Не удалось установить обновление: ${error?.message ?? String(error)}`,
      };
    }
    return updateState();
  }

  // A double click or a background check must not replace the offer while its
  // bytes are being downloaded or while the staged EXE is being installed.
  let operation = null;
  const exclusive = (work) => {
    if (operation) return operation;
    operation = Promise.resolve().then(work).finally(() => { operation = null; });
    return operation;
  };
  return {
    updateState,
    checkUpdate: () => exclusive(checkUpdate),
    downloadUpdate: () => exclusive(downloadUpdate),
    installUpdate: () => exclusive(installUpdate),
  };
}
