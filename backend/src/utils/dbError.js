// Translate PostgreSQL error codes into user-friendly messages
function dbError(err) {
  const code = err.code;
  const detail = err.detail || '';
  const constraint = err.constraint || '';

  if (code === '23505') {
    // Unique violation
    if (detail.includes('catalog_number')) return 'A catalog item with this catalog number already exists.';
    if (detail.includes('username')) return 'This username is already taken.';
    if (detail.includes('email')) return 'This email address is already registered.';
    return `Duplicate value: ${detail || constraint}`;
  }

  if (code === '23503') {
    // Foreign key violation
    if (detail.includes('order_items') || detail.includes('orders')) return 'Cannot delete: this item is referenced by one or more orders.';
    if (detail.includes('purchase_items') || detail.includes('purchases')) return 'Cannot delete: this item is referenced by one or more purchase orders.';
    if (detail.includes('tender_items') || detail.includes('tenders')) return 'Cannot delete: this item is referenced by one or more tenders.';
    if (detail.includes('inventory')) return 'Cannot delete: this item is referenced in inventory.';
    if (detail.includes('supplier')) return 'Cannot delete: this supplier is referenced by existing records.';
    if (detail.includes('customer')) return 'Cannot delete: this customer is referenced by existing records.';
    if (detail.includes('catalog_item')) return 'Referenced catalog item does not exist.';
    return `Reference error: ${detail || constraint}`;
  }

  if (code === '23502') {
    // Not-null violation
    const col = err.column || 'a required field';
    return `Missing required value: "${col}" cannot be empty.`;
  }

  if (code === '22P02') {
    // Invalid text representation (e.g. non-numeric id)
    return 'Invalid input: expected a number but received text.';
  }

  if (code === '22003') {
    // Numeric value out of range
    return 'Value is out of the allowed numeric range.';
  }

  if (code === '42703') {
    // Undefined column — usually a missing migration
    return `Database schema is out of date (column "${err.column || 'unknown'}" not found). Please run the latest migration scripts.`;
  }

  if (code === '42P01') {
    // Undefined table — missing migration
    return `Database schema is out of date (table "${err.table || 'unknown'}" not found). Please run the latest migration scripts.`;
  }

  if (code === '08006' || code === '08001' || code === '08004') {
    return 'Cannot connect to the database. Please check the server is running.';
  }

  // Fall back to the raw pg message, which is still better than "Server error"
  return err.message || 'An unexpected server error occurred.';
}

module.exports = { dbError };
