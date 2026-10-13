-- Idempotent migrations — safe to run on every startup

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS custom_item_name VARCHAR(200);

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0;

ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS custom_item_name VARCHAR(200);
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(50);
