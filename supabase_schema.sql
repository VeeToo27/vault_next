-- ============================================================
-- DIGITAL VAULT — PostgreSQL Schema
-- Works with Supabase, Railway Postgres, or any Postgres DB
-- Run this in your database's SQL editor once before deploying
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  uid        TEXT UNIQUE NOT NULL,
  username   TEXT UNIQUE NOT NULL,
  pin_hash   TEXT NOT NULL,
  balance    NUMERIC(12,2) NOT NULL DEFAULT 0,
  blocked    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stalls
CREATE TABLE IF NOT EXISTS stalls (
  id         BIGSERIAL PRIMARY KEY,
  stall_id   TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  pin_hash   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Menu items
CREATE TABLE IF NOT EXISTS menu_items (
  id       BIGSERIAL PRIMARY KEY,
  stall_id TEXT NOT NULL REFERENCES stalls(stall_id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  price    NUMERIC(10,2) NOT NULL
);

-- Tokens (orders)
CREATE TABLE IF NOT EXISTS tokens (
  id         BIGSERIAL PRIMARY KEY,
  token_no   INTEGER NOT NULL,
  stall_id   TEXT NOT NULL REFERENCES stalls(stall_id),
  stall_name TEXT NOT NULL,
  username   TEXT NOT NULL REFERENCES users(username),
  items      JSONB NOT NULL,
  total      NUMERIC(10,2) NOT NULL,
  status     TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Served')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admins
CREATE TABLE IF NOT EXISTS admins (
  id       BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- Indexes for fast lookups under load
CREATE INDEX IF NOT EXISTS idx_tokens_stall    ON tokens(stall_id);
CREATE INDEX IF NOT EXISTS idx_tokens_username ON tokens(username);
CREATE INDEX IF NOT EXISTS idx_tokens_status   ON tokens(status);
CREATE INDEX IF NOT EXISTS idx_users_username  ON users(username);
CREATE INDEX IF NOT EXISTS idx_menu_stall      ON menu_items(stall_id);

-- Default admin (change password after first login)
INSERT INTO admins (username, password) VALUES ('Admin', 'Hello')
ON CONFLICT (username) DO NOTHING;

-- NOTE: No place_order() function needed.
-- The atomic transaction is handled in app/api/tokens/route.ts
-- using pg's BEGIN/COMMIT with SELECT FOR UPDATE row-level locking.
