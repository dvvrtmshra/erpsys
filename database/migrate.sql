-- Idempotent migrations — safe to run on every startup

-- catalog_items (columns added after initial release)
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS catalog_number VARCHAR(50);
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'unit';
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- orders / order_items
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS custom_item_name VARCHAR(200);

-- purchases / purchase_items
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS custom_item_name VARCHAR(200);
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(50);

-- inventory (type and catalog_item_id may be missing from older schema installs)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'raw_material';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS catalog_item_id INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS location VARCHAR(100);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS min_stock_level DECIMAL(12,2) DEFAULT 10;
