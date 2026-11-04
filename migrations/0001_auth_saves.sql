PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 salt TEXT NOT NULL, hash TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS login_attempts (
 key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, started_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS saves (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, slot TEXT NOT NULL,
 state TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
 week INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY (user_id,slot)
);
CREATE INDEX IF NOT EXISTS idx_saves_updated ON saves(user_id,updated_at DESC);
