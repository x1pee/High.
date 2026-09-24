const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const fromHex = (value, length, label) => {
  if (
    typeof value !== "string" ||
    value.length !== length * 2 ||
    !/^[a-f0-9]+$/i.test(value)
  ) {
    throw new Error(`Некорректный ${label}`);
  }
  return Uint8Array.from(value.match(/.{2}/g), (pair) =>
    Number.parseInt(pair, 16),
  );
};

const toBase64Url = (bytes) => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const fromBase64Url = (value) => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(value) ||
    value.length % 4 === 1
  ) {
    throw new Error("Некорректные зашифрованные данные");
  }
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const aad = (accountId, graphId) => {
  if (typeof accountId !== "string" || typeof graphId !== "string")
    throw new Error("Не заданы аккаунт или график");
  return encoder.encode(`HIGH-SYNC-v1\0${accountId}\0${graphId}`);
};

export function createSyncCredentials() {
  const token = new Uint8Array(32);
  const encryptionKey = new Uint8Array(32);
  crypto.getRandomValues(token);
  crypto.getRandomValues(encryptionKey);
  return {
    version: 1,
    accountId: crypto.randomUUID(),
    token: [...token]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
    encryptionKey: [...encryptionKey]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  };
}

export async function encryptSnapshot(
  journal,
  credentials,
  graphId = journal?.id,
) {
  if (
    !journal ||
    typeof journal !== "object" ||
    !credentials ||
    credentials.version !== 1
  ) {
    throw new Error("Некорректный дневник или ключ синхронизации");
  }
  const keyBytes = fromHex(credentials.encryptionKey, 32, "ключ шифрования");
  fromHex(credentials.token, 32, "токен синхронизации");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
  ]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: aad(credentials.accountId, graphId),
      tagLength: 128,
    },
    key,
    encoder.encode(JSON.stringify(journal)),
  );
  return {
    cipherVersion: 1,
    nonce: toBase64Url(nonce),
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decryptSnapshot(
  envelope,
  credentials,
  graphId,
  validate = (value) => value,
) {
  if (
    !envelope ||
    envelope.cipherVersion !== 1 ||
    !credentials ||
    credentials.version !== 1
  ) {
    throw new Error("Неизвестный формат синхронизации");
  }
  const keyBytes = fromHex(credentials.encryptionKey, 32, "ключ шифрования");
  const nonce = fromBase64Url(envelope.nonce);
  const ciphertext = fromBase64Url(envelope.ciphertext);
  if (nonce.length !== 12 || ciphertext.length < 16)
    throw new Error("Некорректные зашифрованные данные");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "decrypt",
  ]);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: aad(credentials.accountId, graphId),
      tagLength: 128,
    },
    key,
    ciphertext,
  );
  return validate(JSON.parse(decoder.decode(plaintext)));
}
