import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import { downloadQuotationPdf } from '../utils/quotationPdf';

const emptyCustomer = { name: '', contact_person: '', email: '', phone: '', address: '' };

export default function OrderForm() {
  const { id } = useParams();
  const isEdit = !!id;

  const [customers, setCustomers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [inventoryMap, setInventoryMap] = useState({});
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  // items: { type: 'catalog'|'custom', item_id, item_name, quantity, unit_price }
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ ...emptyCustomer });
  const [customerError, setCustomerError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showCatalogPanel, setShowCatalogPanel] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const panelRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isDirty) return;
    const handler = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    loadCustomers();
    api.get('/catalog').then(r => setCatalog(r.data));
    api.get('/inventory').then(r => {
      const map = {};
      r.data.forEach(inv => {
        if (inv.type === 'finished_good' && inv.catalog_item_id) {
          map[inv.catalog_item_id] = inv.quantity;
        }
      });
      setInventoryMap(map);
    });
    if (isEdit) {
      api.get(`/orders/${id}`).then(r => {
        const o = r.data;
        setCustomerId(o.customer_id ? String(o.customer_id) : '');
        setNotes(o.notes || '');
        setItems(o.items?.length ? o.items.map(i => ({
          type: 'catalog',
          item_id: String(i.item_id),
          item_name: i.item_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })) : []);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, []);

  // Close catalog panel when clicking outside
  useEffect(() => {
    if (!showCatalogPanel) return;
    const handler = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowCatalogPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCatalogPanel]);

  const loadCustomers = () => api.get('/customers').then(r => setCustomers(r.data));

  const createCustomer = async e => {
    e.preventDefault();
    setCustomerError('');
    try {
      const res = await api.post('/customers', newCustomer);
      await loadCustomers();
      setCustomerId(String(res.data.id));
      setShowNewCustomer(false);
      setNewCustomer({ ...emptyCustomer });
    } catch (err) {
      setCustomerError(err.response?.data?.error || 'Error creating customer');
    }
  };

  // Toggle a catalog item in/out of the order
  const toggleCatalogItem = (cat) => {
    const exists = items.findIndex(i => i.type === 'catalog' && i.item_id === String(cat.id));
    if (exists >= 0) {
      setItems(items.filter((_, idx) => idx !== exists));
    } else {
      setItems([...items, {
        type: 'catalog',
        item_id: String(cat.id),
        item_name: cat.name,
        quantity: 1,
        unit_price: parseFloat(cat.unit_price) || 0,
        catalog_number: cat.catalog_number,
        category: cat.category,
        unit: cat.unit,
      }]);
    }
  };

  const addCustomItem = () => {
    setIsDirty(true);
    setItems([...items, { type: 'custom', item_id: null, item_name: '', quantity: 1, unit_price: 0 }]);
  };

  const updateItem = (idx, field, val) => {
    setIsDirty(true);
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    setItems(next);
  };

  const removeItem = idx => setItems(items.filter((_, i) => i !== idx));

  const total = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (!items.length) { setError('Please add at least one item.'); return; }
    try {
      const payload = {
        customer_id: customerId || null,
        notes,
        items: items.map(i => ({
          item_id: i.type === 'catalog' ? i.item_id : null,
          item_name: i.item_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      };
      const order = isEdit
        ? await api.put(`/orders/${id}`, payload)
        : await api.post('/orders', payload);
      const full = await api.get(`/orders/${order.data.id}`);
      const cust = customers.find(c => String(c.id) === String(customerId));
      setIsDirty(false);
      setCreatedOrder({
        ...full.data,
        customer_phone: cust?.phone,
        customer_email: cust?.email,
        customer_address: cust?.address,
      });
    } catch (err) {
      setError(err.response?.data?.error || (isEdit ? 'Error updating order' : 'Error creating order'));
    }
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try { downloadQuotationPdf(createdOrder); }
    finally { setPdfLoading(false); }
  };

  const stockBadge = itemId => {
    if (!itemId) return null;
    const qty = inventoryMap[parseInt(itemId)];
    if (qty === undefined) return (
      <span style={{ fontSize: 11, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '2px 6px', borderRadius: 99, whiteSpace: 'nowrap' }}>
        Not in inventory
      </span>
    );
    return (
      <span style={{ fontSize: 11, color: qty < 10 ? 'var(--warn)' : 'var(--success)', background: qty < 10 ? 'var(--warn-bg)' : 'var(--success-bg)', padding: '2px 6px', borderRadius: 99, whiteSpace: 'nowrap' }}>
        Stock: {parseFloat(qty).toFixed(0)}{qty < 10 ? ' ⚠' : ''}
      </span>
    );
  };

  const filteredCatalog = catalog.filter(c => {
    const q = catalogSearch.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.catalog_number || '').toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q);
  });

  // Group catalog by category for the panel
  const catalogByCategory = filteredCatalog.reduce((acc, c) => {
    const cat = c.category || 'Uncategorised';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  const selectedCatalogIds = new Set(items.filter(i => i.type === 'catalog').map(i => i.item_id));

  // ── Success / quotation screen ──────────────────────────────
  if (createdOrder) {
    return (
      <div style={{ maxWidth: 600 }}>
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-b)', borderRadius: 8, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>
            ✓ Order #{createdOrder.id} {isEdit ? 'updated' : 'created'} successfully
          </div>
          <div style={{ color: 'var(--text-2)', fontSize: 14 }}>
            Customer: <strong>{createdOrder.customer_name || 'Walk-in'}</strong> &nbsp;|&nbsp;
            Total: <strong>Rs. {parseFloat(createdOrder.total_amount).toFixed(2)}</strong>
          </div>
        </div>

        <h3 style={{ marginBottom: 12 }}>Order Items</h3>
        <table className="data-table" style={{ marginBottom: 24 }}>
          <thead><tr><th>Item</th><th>Cat. No.</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
          <tbody>
            {(createdOrder.items || []).map((item, i) => (
              <tr key={i}>
                <td>{item.item_name}</td>
                <td>{item.catalog_number || '—'}</td>
                <td>{item.quantity}</td>
                <td>{parseFloat(item.unit_price).toFixed(2)}</td>
                <td>{(item.quantity * item.unit_price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontWeight: 700, marginBottom: 24, fontSize: 15 }}>
          Grand Total: Rs. {parseFloat(createdOrder.total_amount).toFixed(2)}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn-primary" onClick={handleDownloadPdf} disabled={pdfLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {pdfLoading ? 'Generating…' : '⬇ Download Quotation PDF'}
          </button>
          <Link to="/orders" style={{ color: 'var(--accent)', fontSize: 14 }}>← Back to Orders</Link>
          <button className="btn-sm" onClick={() => { setCreatedOrder(null); setItems([]); setCustomerId(''); setNotes(''); }}>
            + New Order
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading">Loading order…</div>;

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ marginBottom: 20 }}>{isEdit ? `Edit Order #${id}` : 'New Order'}</h2>

      {showNewCustomer && (
        <Modal title="Create New Customer" onClose={() => setShowNewCustomer(false)}>
          <form onSubmit={createCustomer}>
            <label>Name *<input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} required /></label>
            <label>Contact Person<input value={newCustomer.contact_person} onChange={e => setNewCustomer({ ...newCustomer, contact_person: e.target.value })} /></label>
            <label>Email<input type="email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} /></label>
            <label>Phone<input value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} /></label>
            <label>Address<textarea value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} /></label>
            {customerError && <p className="error">{customerError}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn-primary">Create & Select</button>
              <button type="button" onClick={() => setShowNewCustomer(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      <form onSubmit={submit}>
        {/* Customer */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ marginBottom: 0 }}>Customer
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                style={{ flex: 1 }} className="filter-select">
                <option value="">— select or create —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>)}
              </select>
              <button type="button" className="btn-sm" onClick={() => setShowNewCustomer(true)} style={{ whiteSpace: 'nowrap' }}>
                + New Customer
              </button>
            </div>
          </label>
        </div>

        <label>Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special instructions…" /></label>

        {/* Items section */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Items</h3>
            {/* Catalog picker button */}
            <div style={{ position: 'relative' }} ref={panelRef}>
              <button type="button" className="btn-primary"
                style={{ fontSize: 13, padding: '6px 14px' }}
                onClick={() => setShowCatalogPanel(v => !v)}>
                + Add from Catalog {selectedCatalogIds.size > 0 && `(${selectedCatalogIds.size} selected)`}
              </button>

              {showCatalogPanel && (
                <div style={{
                  position: 'absolute', top: '110%', left: 0, zIndex: 200,
                  background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)', width: 380, maxHeight: 440,
                  display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <input
                      autoFocus
                      placeholder="Search catalog…"
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, boxSizing: 'border-box', background: 'var(--surface-3)', color: 'var(--text-1)' }}
                    />
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
                    {Object.keys(catalogByCategory).length === 0 && (
                      <div style={{ padding: '16px 12px', color: 'var(--text-3)', fontSize: 13 }}>No items found</div>
                    )}
                    {Object.entries(catalogByCategory).map(([cat, catItems]) => (
                      <div key={cat}>
                        <div style={{ padding: '5px 12px 3px', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {cat}
                        </div>
                        {catItems.map(c => {
                          const checked = selectedCatalogIds.has(String(c.id));
                          const qty = inventoryMap[c.id];
                          return (
                            <label key={c.id} style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px',
                              cursor: 'pointer', background: checked ? 'var(--active)' : 'transparent',
                            }}
                              onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--hover)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = checked ? 'var(--active)' : 'transparent'; }}
                            >
                              <input type="checkbox" checked={checked} onChange={() => toggleCatalogItem(c)}
                                style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: 'var(--text-1)' }}>{c.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                                  {c.catalog_number && <span>{c.catalog_number} · </span>}
                                  Rs. {parseFloat(c.unit_price || 0).toLocaleString('en-IN')}
                                  {c.unit && <span> / {c.unit}</span>}
                                </div>
                              </div>
                              <div style={{ flexShrink: 0 }}>
                                {qty === undefined
                                  ? <span style={{ fontSize: 10, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '1px 5px', borderRadius: 99 }}>no stock</span>
                                  : <span style={{ fontSize: 10, color: qty < 10 ? 'var(--warn)' : 'var(--success)', background: qty < 10 ? 'var(--warn-bg)' : 'var(--success-bg)', padding: '1px 5px', borderRadius: 99 }}>{qty} units</span>
                                }
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{selectedCatalogIds.size} selected</span>
                    <button type="button" className="btn-sm" onClick={() => setShowCatalogPanel(false)}>Done</button>
                  </div>
                </div>
              )}
            </div>

            <button type="button" className="btn-sm" onClick={addCustomItem} style={{ whiteSpace: 'nowrap' }}>
              + Custom Item
            </button>
          </div>

          {/* Items table */}
          {items.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 6, padding: '28px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              No items added yet. Click <strong style={{ color: 'var(--text-2)' }}>+ Add from Catalog</strong> to pick items, or <strong style={{ color: 'var(--text-2)' }}>+ Custom Item</strong> for unlisted items.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--text-2)' }}>Item</th>
                    <th style={{ padding: '8px 10px', width: 80, textAlign: 'right', fontWeight: 500, color: 'var(--text-2)' }}>Qty</th>
                    <th style={{ padding: '8px 10px', width: 110, textAlign: 'right', fontWeight: 500, color: 'var(--text-2)' }}>Unit Price</th>
                    <th style={{ padding: '8px 10px', width: 90, textAlign: 'right', fontWeight: 500, color: 'var(--text-2)' }}>Amount</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid var(--border-2)' : 'none', background: 'transparent' }}>
                      <td style={{ padding: '8px 10px' }}>
                        {item.type === 'catalog' ? (
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--text-1)' }}>{item.item_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                              {item.catalog_number && <span>{item.catalog_number}</span>}
                              {item.category && <span style={{ marginLeft: 6 }}>{item.category}</span>}
                              <span style={{ marginLeft: 8 }}>{stockBadge(item.item_id)}</span>
                            </div>
                          </div>
                        ) : (
                          <input
                            value={item.item_name}
                            onChange={e => updateItem(idx, 'item_name', e.target.value)}
                            placeholder="Item name (custom)"
                            style={{ width: '100%', padding: '5px 7px', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <input type="number" step="1" min="1"
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                          style={{ width: '100%', padding: '5px 7px', borderRadius: 4, fontSize: 13, textAlign: 'right', boxSizing: 'border-box' }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <input type="number" step="0.01" min="0"
                          value={item.unit_price}
                          onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                          style={{ width: '100%', padding: '5px 7px', borderRadius: 4, fontSize: 13, textAlign: 'right', boxSizing: 'border-box' }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-1)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <button type="button" onClick={() => removeItem(idx)}
                          style={{ padding: '3px 7px', border: '1px solid var(--danger-b)', borderRadius: 4, background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                    <td colSpan={3} style={{ padding: '10px 10px', fontWeight: 600, textAlign: 'right', fontSize: 14, color: 'var(--text-2)' }}>Grand Total</td>
                    <td style={{ padding: '10px 10px', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', textAlign: 'right' }}>
                      Rs. {total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="btn-primary">{isEdit ? 'Save Changes' : 'Create Order'}</button>
          <button type="button" onClick={() => navigate('/orders')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
