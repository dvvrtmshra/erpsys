-- Allow custom (non-catalog) items in orders
ALTER TABLE order_items ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS custom_item_name VARCHAR(200);
