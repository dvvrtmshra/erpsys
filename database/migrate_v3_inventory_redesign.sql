-- Migration v3: catalog_number rename + category + inventory redesign
-- Run: psql -U postgres -p 5433 -d erp_db -f migrate_v3_inventory_redesign.sql

-- 1. Rename sku → catalog_number (safe if already done)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='catalog_items' AND column_name='sku'
  ) THEN
    ALTER TABLE catalog_items RENAME COLUMN sku TO catalog_number;
  END IF;
END $$;

-- 2. Add category column to catalog_items (safe if already exists)
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- 3. Rebuild inventory as a two-type table (finished goods + raw materials)
DROP TABLE IF EXISTS inventory CASCADE;

CREATE TABLE inventory (
  id            SERIAL PRIMARY KEY,
  type          VARCHAR(20) DEFAULT 'raw_material'
                  CHECK (type IN ('finished_good', 'raw_material')),
  catalog_item_id INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL,
  item_name     VARCHAR(200) NOT NULL,
  description   TEXT,
  unit          VARCHAR(20) DEFAULT 'unit',
  quantity      DECIMAL(12,2) DEFAULT 0,
  location      VARCHAR(100),
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

GRANT ALL PRIVILEGES ON TABLE inventory TO erp_user;
GRANT ALL PRIVILEGES ON SEQUENCE inventory_id_seq TO erp_user;
