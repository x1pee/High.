const MAX_BODY_BYTES = 1_800_000;
const DEFAULT_ORIGINS = [
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "capacitor://localhost",
  "http://localhost:1420",
];

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });

const validId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

const validBase64Url = (value, minBytes, maxBytes) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value))
    return false;
  if (value.length % 4 === 1) return false;
  try {
    const padded =
      value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4);
    const bytes = atob(padded).length;
    return bytes >= minBytes && bytes <= maxBytes;
  } catch {
    return false;
  }
};

const sha256Hex = async (value) => {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const allowedOrigins = (env) =>
  new Set(
    (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(","))
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

const withHeaders = (response, origin, allowOrigin) => {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Vary", "Origin");
  if (origin && allowOrigin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
    headers.set("Access-Control-Max-Age", "600");
  }
  return new Response(response.body, { status: response.status, headers });
};

async function authenticate(request, env) {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(
    request.headers.get("Authorization") || "",
  );
  if (!match) return null;
  const tokenHash = await sha256Hex(match[1].toLowerCase());
  const row = await env.DB.prepare(
    "SELECT account_id FROM sync_accounts WHERE token_hash = ?1",
  )
    .bind(tokenHash)
    .first();
  return row?.account_id || null;
}

async function handle(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/v1/health") {
    return json({ ok: true, service: "high-sync", protocolVersion: 1 });
  }
  if (!url.pathname.startsWith("/v1/"))
    return json({ error: "not_found" }, 404);

  const accountId = await authenticate(request, env);
  if (!accountId) return json({ error: "unauthorized" }, 401);

  if (request.method === "GET" && url.pathname === "/v1/graphs") {
    const result = await env.DB.prepare(
      "SELECT graph_id AS graphId, revision, updated_at AS updatedAt FROM sync_journals WHERE account_id = ?1 ORDER BY updated_at DESC LIMIT 500",
    )
      .bind(accountId)
      .all();
    return json({ graphs: result.results || [] });
  }

  const match = /^\/v1\/graphs\/([^/]+)$/.exec(url.pathname);
  if (!match || !validId(match[1])) return json({ error: "not_found" }, 404);
  const graphId = match[1];

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT graph_id AS graphId, revision, cipher_version AS cipherVersion, nonce, ciphertext, updated_at AS updatedAt FROM sync_journals WHERE account_id = ?1 AND graph_id = ?2",
    )
      .bind(accountId, graphId)
      .first();
    return row ? json(row) : json({ error: "not_found" }, 404);
  }

  if (request.method !== "PUT")
    return json({ error: "method_not_allowed" }, 405, {
      Allow: "GET, PUT, OPTIONS",
    });
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_BYTES)
    return json({ error: "payload_too_large" }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES)
    return json({ error: "payload_too_large" }, 413);

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (
    !input ||
    !Number.isSafeInteger(input.baseRevision) ||
    input.baseRevision < 0 ||
    input.cipherVersion !== 1 ||
    !validBase64Url(input.nonce, 12, 12) ||
    !validBase64Url(input.ciphertext, 16, MAX_BODY_BYTES)
  )
    return json({ error: "invalid_payload" }, 400);

  const updatedAt = new Date().toISOString();
  let result;
  if (input.baseRevision === 0) {
    result = await env.DB.prepare(
      "INSERT INTO sync_journals (account_id, graph_id, revision, cipher_version, nonce, ciphertext, updated_at) VALUES (?1, ?2, 1, 1, ?3, ?4, ?5) ON CONFLICT(account_id, graph_id) DO NOTHING",
    )
      .bind(accountId, graphId, input.nonce, input.ciphertext, updatedAt)
      .run();
  } else {
    result = await env.DB.prepare(
      "UPDATE sync_journals SET revision = revision + 1, cipher_version = 1, nonce = ?1, ciphertext = ?2, updated_at = ?3 WHERE account_id = ?4 AND graph_id = ?5 AND revision = ?6",
    )
      .bind(
        input.nonce,
        input.ciphertext,
        updatedAt,
        accountId,
        graphId,
        input.baseRevision,
      )
      .run();
  }

  if (result.meta?.changes === 1) {
    return json({ graphId, revision: input.baseRevision + 1, updatedAt });
  }

  const current = await env.DB.prepare(
    "SELECT revision FROM sync_journals WHERE account_id = ?1 AND graph_id = ?2",
  )
    .bind(accountId, graphId)
    .first();
  return json(
    { error: "revision_conflict", serverRevision: current?.revision || 0 },
    409,
  );
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowOrigin = !origin || allowedOrigins(env).has(origin);
    if (!allowOrigin)
      return withHeaders(
        json({ error: "origin_not_allowed" }, 403),
        origin,
        false,
      );
    if (request.method === "OPTIONS") {
      return withHeaders(
        new Response(null, { status: 204 }),
        origin,
        allowOrigin,
      );
    }
    try {
      return withHeaders(await handle(request, env), origin, allowOrigin);
    } catch {
      return withHeaders(
        json({ error: "internal_error" }, 500),
        origin,
        allowOrigin,
      );
    }
  },
};
