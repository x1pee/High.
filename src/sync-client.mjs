import { decryptSnapshot, encryptSnapshot } from "./sync-crypto.mjs";

export const SYNC_API_URL =
  "https://high-sync.high-sync-x1pee-2026.workers.dev";

const CREDENTIALS_KEY = "high.sync.credentials.v1";
const MARKER_PREFIX = "high.sync.marker.v1:";

export function parseSyncCredentials(value) {
  const credentials = typeof value === "string" ? JSON.parse(value) : value;
  if (
    !credentials ||
    credentials.version !== 1 ||
    typeof credentials.accountId !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(credentials.accountId) ||
    typeof credentials.token !== "string" ||
    !/^[a-f0-9]{64}$/i.test(credentials.token) ||
    typeof credentials.encryptionKey !== "string" ||
    !/^[a-f0-9]{64}$/i.test(credentials.encryptionKey)
  ) {
    throw new Error("Файл сопряжения не распознан или повреждён");
  }
  return {
    version: 1,
    accountId: credentials.accountId,
    token: credentials.token.toLowerCase(),
    encryptionKey: credentials.encryptionKey.toLowerCase(),
  };
}

export function loadSyncCredentials(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(CREDENTIALS_KEY);
    return value ? parseSyncCredentials(value) : null;
  } catch {
    return null;
  }
}

export function saveSyncCredentials(
  credentials,
  storage = globalThis.localStorage,
) {
  const valid = parseSyncCredentials(credentials);
  if (!storage) throw new Error("Локальное хранилище недоступно");
  storage.setItem(CREDENTIALS_KEY, JSON.stringify(valid));
  return valid;
}

export function getSyncMarker(
  accountId,
  graphId,
  storage = globalThis.localStorage,
) {
  try {
    const value = storage?.getItem(`${MARKER_PREFIX}${accountId}:${graphId}`);
    if (!value) return null;
    const marker = JSON.parse(value);
    if (
      !Number.isSafeInteger(marker.serverRevision) ||
      marker.serverRevision < 1 ||
      !Number.isSafeInteger(marker.localRevision) ||
      marker.localRevision < 0
    )
      return null;
    return marker;
  } catch {
    return null;
  }
}

export function setSyncMarker(
  accountId,
  graphId,
  marker,
  storage = globalThis.localStorage,
) {
  if (!storage) throw new Error("Локальное хранилище недоступно");
  storage.setItem(
    `${MARKER_PREFIX}${accountId}:${graphId}`,
    JSON.stringify(marker),
  );
}

export class SyncRequestError extends Error {
  constructor(status, code, details = {}) {
    const messages = {
      unauthorized:
        "Ключ сопряжения не принят. Импортируй актуальный файл сопряжения.",
      origin_not_allowed:
        "Этот адрес приложения не разрешён сервером синхронизации.",
      payload_too_large: "Дневник слишком большой для отправки на сервер.",
      revision_conflict: "Облачная копия изменилась на другом устройстве.",
      internal_error: "Сервер временно не смог обработать запрос.",
    };
    super(messages[code] ?? `Ошибка сервера синхронизации (${status}).`);
    this.name = "SyncRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createSyncClient({
  baseUrl = SYNC_API_URL,
  fetchImpl = globalThis.fetch,
  validate = (journal) => journal,
} = {}) {
  if (typeof fetchImpl !== "function")
    throw new Error("Сетевые запросы недоступны в этой версии приложения");

  async function request(credentials, path, options = {}) {
    const valid = parseSyncCredentials(credentials);
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...options,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${valid.token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });
    } catch {
      throw new Error("Нет соединения с сервером синхронизации.");
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new SyncRequestError(response.status, result.error, result);
    return result;
  }

  return Object.freeze({
    async listGraphs(credentials) {
      const result = await request(credentials, "/v1/graphs");
      if (!Array.isArray(result.graphs))
        throw new Error("Сервер вернул неизвестный список графиков");
      return result.graphs;
    },

    async readJournal(credentials, graphId) {
      const result = await request(
        credentials,
        `/v1/graphs/${encodeURIComponent(graphId)}`,
      ).catch((error) => {
        if (error instanceof SyncRequestError && error.status === 404)
          return null;
        throw error;
      });
      if (!result) return null;
      if (
        result.graphId !== graphId ||
        !Number.isSafeInteger(result.revision) ||
        result.revision < 1
      )
        throw new Error("Сервер вернул некорректную версию графика");
      return {
        revision: result.revision,
        updatedAt: result.updatedAt,
        journal: await decryptSnapshot(result, credentials, graphId, validate),
      };
    },

    async writeJournal(credentials, journal, baseRevision) {
      if (!Number.isSafeInteger(baseRevision) || baseRevision < 0)
        throw new Error("Некорректная версия облачной копии");
      const encrypted = await encryptSnapshot(journal, credentials, journal.id);
      return request(
        credentials,
        `/v1/graphs/${encodeURIComponent(journal.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({ baseRevision, ...encrypted }),
        },
      );
    },
  });
}
