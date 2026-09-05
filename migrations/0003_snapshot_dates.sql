-- 0003_snapshot_dates.sql — Add is_active column to stock_snapshots
ALTER TABLE stock_snapshots ADD COLUMN is_active INTEGER DEFAULT 1;
