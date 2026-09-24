import { randomBytes, randomUUID, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const accountId = randomUUID();
const token = randomBytes(32).toString("hex");
const encryptionKey = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
const createdAt = new Date().toISOString();
const credentialsPath = new URL("../local-credentials.json", import.meta.url);

await writeFile(
  credentialsPath,
  `${JSON.stringify({ version: 1, accountId, token, encryptionKey }, null, 2)}\n`,
  { flag: "wx", mode: 0o600 },
);
console.log(`Локальный ключ создан: ${fileURLToPath(credentialsPath)}`);
console.log("Не отправляйте этот файл в GitHub и не загружайте его в облако.");
console.log(
  "Скопируйте и выполните эту команду один раз после применения миграции:",
);
console.log(
  `npx wrangler d1 execute high-sync --remote --config cloudflare/wrangler.jsonc --command "INSERT INTO sync_accounts (account_id, token_hash, created_at) VALUES ('${accountId}', '${tokenHash}', '${createdAt}');"`,
);
console.log(
  "Ключ шифрования и bearer-токен намеренно не выводятся в терминал.",
);
