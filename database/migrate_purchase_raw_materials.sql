-- Allow raw material (non-catalog) rows in purchase_items
ALTER TABLE purchase_items ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS custom_item_name VARCHAR(200);
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'catalog';
