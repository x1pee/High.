CREATE TABLE sync_accounts (
  account_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at TEXT NOT NULL
);

CREATE TABLE sync_journals (
  account_id TEXT NOT NULL REFERENCES sync_accounts(account_id) ON DELETE CASCADE,
  graph_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  cipher_version INTEGER NOT NULL CHECK (cipher_version = 1),
  nonce TEXT NOT NULL CHECK (length(nonce) = 16),
  ciphertext TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_id, graph_id)
);

CREATE INDEX sync_journals_updated_at ON sync_journals(account_id, updated_at DESC);
