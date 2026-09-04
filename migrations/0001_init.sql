-- ============================================================
-- 0001_init.sql  --  Nonmove KPI App initial schema
-- ============================================================

-- Store master (auto-derived from Excel import)
CREATE TABLE IF NOT EXISTS stores (
  store_id    TEXT PRIMARY KEY,
  store_name  TEXT NOT NULL,
  region      TEXT NOT NULL,
  province    TEXT NOT NULL,
  supervisor  TEXT
);

-- Daily stock snapshots  (one row per SKU per store per date)
CREATE TABLE IF NOT EXISTS stock_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date   TEXT NOT NULL,
  store_id        TEXT NOT NULL REFERENCES stores(store_id),
  category        TEXT,
  subcategory     TEXT,
  model           TEXT NOT NULL,
  product_code    TEXT,
  product_name    TEXT,
  stock_type      TEXT,         -- SELLABLE | ONLINE | DEMO
  assortment      TEXT,
  nonmove_period  TEXT,         -- '30-60' | '61-90' | '91-120' | '121 up'
  nonmove_flag    TEXT,         -- 'Nonmove' | 'Normal'
  stock_qty       INTEGER,
  stock_amount    REAL,
  sku_amount      REAL
);

CREATE INDEX IF NOT EXISTS idx_snap_store_date
  ON stock_snapshots(store_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snap_nonmove
  ON stock_snapshots(nonmove_flag, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snap_date
  ON stock_snapshots(snapshot_date);

-- Exclusion requests
CREATE TABLE IF NOT EXISTS exclusion_requests (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_snapshot_id   INTEGER REFERENCES stock_snapshots(id),
  store_id            TEXT NOT NULL REFERENCES stores(store_id),
  snapshot_date       TEXT NOT NULL,
  model               TEXT NOT NULL,
  product_name        TEXT,
  requester_name      TEXT NOT NULL,
  requester_phone     TEXT NOT NULL,
  -- sold_wait_delivery | demo_unit | damaged | system_error | other
  reason              TEXT NOT NULL,
  reason_detail       TEXT NOT NULL,
  issue_date          TEXT,
  clear_plan          TEXT,
  clear_plan_date     TEXT,
  -- pending | approved | rejected | needs_resubmit
  status              TEXT NOT NULL DEFAULT 'pending',
  admin_comment       TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_req_store
  ON exclusion_requests(store_id, status);
CREATE INDEX IF NOT EXISTS idx_req_status
  ON exclusion_requests(status);

-- Request photos (up to 3 per request)
CREATE TABLE IF NOT EXISTS request_photos (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  exclusion_request_id  INTEGER NOT NULL
    REFERENCES exclusion_requests(id) ON DELETE CASCADE,
  photo_url             TEXT NOT NULL,
  sort_order            INTEGER DEFAULT 0
);

-- KPI rate matrix — versioned (effective_from date)
-- 4 ranks × 8 buckets = 32 rows per version
CREATE TABLE IF NOT EXISTS kpi_rate_matrix (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  effective_from  TEXT NOT NULL,     -- ISO date; use latest version <= calc month
  rank_tier       INTEGER NOT NULL,  -- 1-4
  rank_label      TEXT NOT NULL,     -- e.g. 'Lower 150K'
  rank_min_amount REAL NOT NULL,     -- inclusive lower bound (THB)
  rank_max_amount REAL,              -- inclusive upper bound (NULL = no cap)
  bucket          INTEGER NOT NULL,  -- 1-8
  bucket_label    TEXT NOT NULL,     -- e.g. 'Increase 30% up'
  bucket_type     TEXT NOT NULL,     -- 'penalty' | 'reward'
  pct_min         REAL,              -- % lower bound (NULL = -inf)
  pct_max         REAL,              -- % upper bound (NULL = +inf)
  amount_thb      REAL NOT NULL      -- negative = penalty, positive = reward
);

CREATE INDEX IF NOT EXISTS idx_kpi_rate_date
  ON kpi_rate_matrix(effective_from);

-- Global KPI settings (single-row; insert new row to change)
CREATE TABLE IF NOT EXISTS kpi_settings (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  included_stock_types  TEXT NOT NULL DEFAULT '["SELLABLE","ONLINE"]',
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL  -- bcrypt
);

-- Audit log for hard-deleted requests
CREATE TABLE IF NOT EXISTS deletion_audit_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id       INTEGER NOT NULL,   -- original ID (no FK — record deleted)
  store_id         TEXT,
  model            TEXT,
  requester_name   TEXT,
  reason           TEXT,
  status_at_delete TEXT,
  deleted_by       TEXT,               -- admin username
  deleted_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
