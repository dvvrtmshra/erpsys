-- Migration: rename catalog_items.sku → catalog_number, decouple inventory from catalog
-- Run once against erp_db: psql -U postgres -p 5433 -d erp_db -f migrate_catalog_inventory_v2.sql

-- 1. Rename sku to catalog_number in catalog_items
ALTER TABLE catalog_items RENAME COLUMN sku TO catalog_number;

-- 2. Drop old inventory table and recreate as independent (loses existing inventory data)
DROP TABLE IF EXISTS inventory CASCADE;

CREATE TABLE inventory (
  id SERIAL PRIMARY KEY,
  item_name VARCHAR(200) NOT NULL,
  description TEXT,
  unit VARCHAR(20) DEFAULT 'unit',
  quantity DECIMAL(12,2) DEFAULT 0,
  location VARCHAR(100),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

GRANT ALL PRIVILEGES ON TABLE inventory TO erp_user;
GRANT ALL PRIVILEGES ON SEQUENCE inventory_id_seq TO erp_user;
