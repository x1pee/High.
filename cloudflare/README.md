# High. private sync API

The High. sync service is deployed on the Cloudflare Free plan. The Worker stores opaque AES-GCM ciphertext in D1; diary JSON is encrypted in the app before upload. Requests use a random 256-bit bearer token. The separate 256-bit encryption key is in the local pairing file and is not sent to Cloudflare.

## Current setup

- Worker: `https://high-sync.high-sync-x1pee-2026.workers.dev`
- Health check: `https://high-sync.high-sync-x1pee-2026.workers.dev/v1/health`
- D1 binding: `DB`; the database ID is already set in `wrangler.jsonc`.
- Pairing file: `cloudflare/local-credentials.json` (ignored by Git; keep a safe offline backup).
- The account is provisioned and the app sync client is available under Settings → My Data. A read-only connection check returned zero cloud graphs. No diary has been uploaded.

On each device, open Settings → My Data, choose the same `cloudflare/local-credentials.json`, then press “Синхронизировать сейчас” only when you want to transfer a graph. The app asks before a first upload and shows a choice if local and cloud copies differ. Keep the pairing file private: anyone with it can access the account and decrypt its snapshots. The current app stores the credentials in its local WebView storage, not in the OS keychain.

## Local check

From the project root:

```powershell
npm.cmd test
npx.cmd wrangler dev --config cloudflare/wrangler.jsonc
```

Wrangler uses a local D1 database by default for local development.

## Recreating the setup in a different Cloudflare account

These provisioning steps are already complete for the account above. Do not rerun `d1 create` there: the database already exists. In Windows PowerShell call `npx.cmd` (the `npx` alias can be blocked by script execution policy):

1. Sign in and authorize Wrangler: `npx.cmd wrangler login`.
2. Create the D1 database once: `npx.cmd wrangler d1 create high-sync --update-config --config cloudflare/wrangler.jsonc`.
3. Apply the schema: `npx.cmd wrangler d1 migrations apply high-sync --remote --config cloudflare/wrangler.jsonc`.
4. Create a new local pairing file: `node cloudflare/scripts/create-credentials.mjs`; securely keep the file and run the one-time SQL command printed by the script.
5. Deploy: `npx.cmd wrangler deploy --config cloudflare/wrangler.jsonc`.

Keep using the current pairing file on all devices. If it is lost, a new file will create a different account; the old server data cannot be decrypted with new keys.

## API

- `GET /v1/health` — public liveness check.
- `GET /v1/graphs` — list graph IDs and server revisions for the authenticated account.
- `GET /v1/graphs/:graphId` — return one encrypted snapshot.
- `PUT /v1/graphs/:graphId` — create/update an encrypted snapshot using `baseRevision`; stale writes return HTTP 409.

All data routes require `Authorization: Bearer <64-character-hex-token>`. The JSON payload for `PUT` is `{ "baseRevision": 0, "cipherVersion": 1, "nonce": "<base64url>", "ciphertext": "<base64url>" }`. Nonces must be fresh 96-bit random values. The client uses AES-256-GCM and binds account ID plus graph ID as authenticated additional data.

## Limits and recovery

D1 Free has a 500 MB per-database size limit, 5 GB total storage per account, 5 million rows read/day, and 100,000 rows written/day. Workers Free allows 100,000 requests/day and 10 ms CPU per request. Reaching a daily limit pauses further operations until reset. D1 Free has seven-day point-in-time recovery according to the current limits, but maintain a separate encrypted export too. Pricing and limits can change; see the official [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
