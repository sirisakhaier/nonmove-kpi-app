-- ============================================================
-- 0002_seed.sql  --  Default KPI rate matrix + admin user
-- ============================================================

-- Default KPI rate matrix (effective from 2026-01-01)
-- 4 ranks × 8 buckets = 32 rows
-- Rank tiers: 1=<150K, 2=150K-249K, 3=250K-299K, 4=300K+
-- Buckets: 1=+30%up, 2=+20-29%, 3=+10-19%, 4=0-9% increase
--          5=0-9% reduce, 6=10-19% reduce, 7=20-29% reduce, 8=30%+ reduce
INSERT OR IGNORE INTO kpi_rate_matrix
  (effective_from, rank_tier, rank_label, rank_min_amount, rank_max_amount,
   bucket, bucket_label, bucket_type, pct_min, pct_max, amount_thb)
VALUES
-- Rank 1: Lower 150K (0 to 149,999.99)
('2026-01-01',1,'Lower 150K',0,149999.99, 1,'Increase 30% up','penalty',30,NULL,-700),
('2026-01-01',1,'Lower 150K',0,149999.99, 2,'Increase 20% to 29%','penalty',20,29,-500),
('2026-01-01',1,'Lower 150K',0,149999.99, 3,'Increase 10% to 19%','penalty',10,19,-300),
('2026-01-01',1,'Lower 150K',0,149999.99, 4,'Increase up to 9%','penalty',0,9,-100),
('2026-01-01',1,'Lower 150K',0,149999.99, 5,'Reduce 0% to 9%','reward',-9,0,200),
('2026-01-01',1,'Lower 150K',0,149999.99, 6,'Reduce 10% to 19%','reward',-19,-10,400),
('2026-01-01',1,'Lower 150K',0,149999.99, 7,'Reduce 20% to 29%','reward',-29,-20,600),
('2026-01-01',1,'Lower 150K',0,149999.99, 8,'Reduce 30% up','reward',NULL,-30,800),

-- Rank 2: 150K-249K
('2026-01-01',2,'150K-249K',150000,249999.99, 1,'Increase 30% up','penalty',30,NULL,-800),
('2026-01-01',2,'150K-249K',150000,249999.99, 2,'Increase 20% to 29%','penalty',20,29,-600),
('2026-01-01',2,'150K-249K',150000,249999.99, 3,'Increase 10% to 19%','penalty',10,19,-400),
('2026-01-01',2,'150K-249K',150000,249999.99, 4,'Increase up to 9%','penalty',0,9,-200),
('2026-01-01',2,'150K-249K',150000,249999.99, 5,'Reduce 0% to 9%','reward',-9,0,600),
('2026-01-01',2,'150K-249K',150000,249999.99, 6,'Reduce 10% to 19%','reward',-19,-10,800),
('2026-01-01',2,'150K-249K',150000,249999.99, 7,'Reduce 20% to 29%','reward',-29,-20,1000),
('2026-01-01',2,'150K-249K',150000,249999.99, 8,'Reduce 30% up','reward',NULL,-30,1500),

-- Rank 3: 250K-299K
('2026-01-01',3,'250K-299K',250000,299999.99, 1,'Increase 30% up','penalty',30,NULL,-900),
('2026-01-01',3,'250K-299K',250000,299999.99, 2,'Increase 20% to 29%','penalty',20,29,-700),
('2026-01-01',3,'250K-299K',250000,299999.99, 3,'Increase 10% to 19%','penalty',10,19,-500),
('2026-01-01',3,'250K-299K',250000,299999.99, 4,'Increase up to 9%','penalty',0,9,-300),
('2026-01-01',3,'250K-299K',250000,299999.99, 5,'Reduce 0% to 9%','reward',-9,0,800),
('2026-01-01',3,'250K-299K',250000,299999.99, 6,'Reduce 10% to 19%','reward',-19,-10,1000),
('2026-01-01',3,'250K-299K',250000,299999.99, 7,'Reduce 20% to 29%','reward',-29,-20,1500),
('2026-01-01',3,'250K-299K',250000,299999.99, 8,'Reduce 30% up','reward',NULL,-30,2000),

-- Rank 4: 300K up
('2026-01-01',4,'300K up',300000,NULL, 1,'Increase 30% up','penalty',30,NULL,-1000),
('2026-01-01',4,'300K up',300000,NULL, 2,'Increase 20% to 29%','penalty',20,29,-800),
('2026-01-01',4,'300K up',300000,NULL, 3,'Increase 10% to 19%','penalty',10,19,-600),
('2026-01-01',4,'300K up',300000,NULL, 4,'Increase up to 9%','penalty',0,9,-400),
('2026-01-01',4,'300K up',300000,NULL, 5,'Reduce 0% to 9%','reward',-9,0,1000),
('2026-01-01',4,'300K up',300000,NULL, 6,'Reduce 10% to 19%','reward',-19,-10,1500),
('2026-01-01',4,'300K up',300000,NULL, 7,'Reduce 20% to 29%','reward',-29,-20,2000),
('2026-01-01',4,'300K up',300000,NULL, 8,'Reduce 30% up','reward',NULL,-30,3000);

-- Default KPI settings: include SELLABLE + ONLINE, exclude DEMO
INSERT OR IGNORE INTO kpi_settings (included_stock_types)
VALUES ('["SELLABLE","ONLINE"]');

-- Default admin user: admin / admin1234
-- bcrypt hash of "admin1234" (cost 10)
INSERT OR IGNORE INTO admin_users (username, password_hash)
VALUES ('admin', '$2a$10$rQnkPy0z6q8O9v5mEzK1dOrxJ7X4sWvF3tYpHcLgMnBuAkZeIdCj.');
-- IMPORTANT: Change this password immediately after first login!
