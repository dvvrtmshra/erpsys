-- Migration: add category column to catalog_items
-- Run: psql -U postgres -p 5433 -d erp_db -f migrate_add_category.sql

ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS category VARCHAR(100);
