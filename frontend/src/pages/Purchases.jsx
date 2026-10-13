import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { downloadPurchaseOrderPdf } from '../utils/purchaseOrderPdf';

const STATUS_COLORS = { pending: '#f39c12', ordered: '#2980b9', received: '#27ae60', cancelled: '#c0392b' };

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]); // inventory rows with type='raw_material'
  const [catalogInventoryMap, setCatalogInventoryMap] = useState({}); // catalog_item_id -> {qty, unit}
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null); // null = new, number = editing
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [panelTab, setPanelTab] = useState('catalog'); // 'catalog' | 'raw'
  const [panelSearch, setPanelSearch] = useState('');
  const panelRef = useRef();

  const load = () => api.get('/purchases').then(r => setPurchases(r.data));

  useEffect(() => {
    load();
    api.get('/suppliers').then(r => setSuppliers(r.data));
    api.get('/catalog').then(r => setCatalog(r.data));
    api.get('/inventory').then(r => {
      const raw = r.data.filter(i => i.type === 'raw_material');
      setRawMaterials(raw);
      const map = {};
      r.data.forEach(inv => {
        if (inv.catalog_item_id) map[inv.catalog_item_id] = { qty: parseInt(inv.quantity), unit: inv.unit };
      });
      setCatalogInventoryMap(map);
    });
  }, []);

  useEffect(() => {
    if (!showPanel) return;
    const handler = e => { if (panelRef.current && !panelRef.current.contains(e.target)) setShowPanel(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanel]);

  const openNew = () => {
    setEditId(null);
    setForm({ supplier_id: '', notes: '' });
    setItems([]);
    setError('');
    setPanelSearch('');
    setPanelTab('catalog');
  };

  const openEdit = async id => {
    try {
      const res = await api.get(`/purchases/${id}`);
      const p = res.data;
      setEditId(id);
      setForm({ supplier_id: p.supplier_id ? String(p.supplier_id) : '', notes: p.notes || '' });
      setItems((p.items || []).map((i, idx) => ({
        _key: `loaded-${i.id || idx}`,
        item_type: i.item_type || (i.item_id ? 'catalog' : 'raw_material'),
        item_id: i.item_id ? String(i.item_id) : null,
        item_name: i.item_name || '',
        catalog_number: i.catalog_number,
        category: i.category,
        unit: i.unit,
        inventory_id: null,
        current_stock: null,
        quantity: parseInt(i.quantity) || 1,
        unit_price: parseFloat(i.unit_price) || 0,
      })));
      setError('');
      setPanelSearch('');
      setPanelTab('catalog');
    } catch {
      alert('Could not load purchase order');
    }
  };

  // Toggle catalog item
  const toggleCatalogItem = cat => {
    const key = `catalog-${cat.id}`;
    const exists = items.findIndex(i => i._key === key);
    if (exists >= 0) { setItems(items.filter((_, i) => i !== exists)); return; }
    setItems([...items, {
      _key: key, item_type: 'catalog',
      item_id: String(cat.id), item_name: cat.name,
      catalog_number: cat.catalog_number, category: cat.category, unit: cat.unit,
      quantity: 1, unit_price: parseFloat(cat.unit_price) || 0,
    }]);
  };

  // Toggle raw material from inventory
  const toggleRawItem = raw => {
    const key = `raw-${raw.id}`;
    const exists = items.findIndex(i => i._key === key);
    if (exists >= 0) { setItems(items.filter((_, i) => i !== exists)); return; }
    setItems([...items, {
      _key: key, item_type: 'raw_material',
      item_id: null, item_name: raw.item_name,
      category: 'Raw Material', unit: raw.unit,
      inventory_id: raw.id, current_stock: parseInt(raw.quantity),
      quantity: 1, unit_price: 0,
    }]);
  };

  // Add a blank custom raw material row
  const addCustomRaw = () => {
    const key = `custom-${Date.now()}`;
    setItems([...items, {
      _key: key, item_type: 'raw_material',
      item_id: null, item_name: '',
      category: 'Raw Material', unit: 'unit',
      quantity: 1, unit_price: 0,
    }]);
    setShowPanel(false);
  };

  const updateItem = (idx, field, val) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    setItems(next);
  };
  const removeItem = idx => setItems(items.filter((_, i) => i !== idx));

  const total = items.reduce((s, i) => s + (parseInt(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (!items.length) { setError('Add at least one item.'); return; }
    const payload = {
      supplier_id: form.supplier_id || null,
      notes: form.notes,
      items: items.map(i => ({
        item_id: i.item_id || null,
        item_name: i.item_name,
        item_type: i.item_type || 'catalog',
        quantity: parseInt(i.quantity),
        unit_price: parseFloat(i.unit_price),
      })),
    };
    try {
      const res = editId
        ? await api.put(`/purchases/${editId}`, payload)
        : await api.post('/purchases', payload);
      const poId = editId || res.data.id;
      const full = await api.get(`/purchases/${poId}`);
      const enriched = {
        ...full.data,
        items: full.data.items.map((fi, idx) => ({
          ...fi,
          item_name: fi.item_name || items[idx]?.item_name,
          unit: fi.unit || items[idx]?.unit,
        })),
      };
      setForm(null);
      setEditId(null);
      load();
      if (confirm(`PO-${String(poId).padStart(4,'0')} ${editId ? 'updated' : 'created'}!\n\nDownload PDF now?`)) {
        downloadPurchaseOrderPdf(enriched);
      }
    } catch (err) {
      setError(err.response?.data?.error || (editId ? 'Error updating purchase order' : 'Error creating purchase order'));
    }
  };

  const updateStatus = async (id, status) => { await api.patch(`/purchases/${id}/status`, { status }); load(); };
  const del = async id => {
    if (!confirm('Delete this purchase order?')) return;
    try { await api.delete(`/purchases/${id}`); load(); }
    catch (err) { alert(err.response?.data?.error || 'Delete failed'); }
  };
  const downloadPdf = async id => {
    try { downloadPurchaseOrderPdf((await api.get(`/purchases/${id}`)).data); }
    catch { alert('Could not generate PDF'); }
  };

  // Panel filtering
  const filteredCatalog = catalog.filter(c => {
    const q = panelSearch.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.catalog_number || '').toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q);
  });
  const catalogByCategory = filteredCatalog.reduce((acc, c) => {
    const cat = c.category || 'Uncategorised';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  const filteredRaw = rawMaterials.filter(r => {
    const q = panelSearch.toLowerCase();
    return !q || r.item_name.toLowerCase().includes(q) || (r.unit || '').toLowerCase().includes(q);
  });

  const selectedKeys = new Set(items.map(i => i._key));
  const selectedCatalogIds = new Set(items.filter(i => i.item_type === 'catalog').map(i => i.item_id));
  const selectedRawIds = new Set(items.filter(i => i.item_type === 'raw_material' && i.inventory_id).map(i => String(i.inventory_id)));

  const stockBadge = (item) => {
    if (item.item_type === 'raw_material') {
      const qty = item.current_stock ?? null;
      if (qty === null || qty === undefined) return <span style={badgeStyle('#888','#f6f8fa')}>no data</span>;
      return <span style={badgeStyle(qty < 10 ? '#856404' : '#1e7e34', qty < 10 ? '#fff3cd' : '#d4edda')}>stock: {qty} {item.unit || ''}</span>;
    }
    const inv = catalogInventoryMap[parseInt(item.item_id)];
    if (!inv) return <span style={badgeStyle('#c0392b','#fde8e8')}>not in inventory</span>;
    return <span style={badgeStyle(inv.qty < 10 ? '#856404' : '#1e7e34', inv.qty < 10 ? '#fff3cd' : '#d4edda')}>stock: {inv.qty} {inv.unit || ''}</span>;
  };

  const badgeStyle = (color, bg) => ({ fontSize: 10, color, background: bg, padding: '1px 6px', borderRadius: 99, whiteSpace: 'nowrap' });

  const filtered = purchases.filter(p => {
    const q = search.toLowerCase();
    return (!q || (p.supplier_name || '').toLowerCase().includes(q) || String(p.id).includes(q))
      && (!statusFilter || p.status === statusFilter);
  });

  // ── Create form ──────────────────────────────────────────────
  if (form !== null) {
    const tabStyle = active => ({
      padding: '6px 16px', fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer',
      borderBottom: active ? '2px solid #0969da' : '2px solid transparent',
      color: active ? '#0969da' : '#555', background: 'none', border: 'none',
      borderBottom: active ? '2px solid #0969da' : '2px solid transparent',
    });

    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button className="btn-sm" onClick={() => { setForm(null); setEditId(null); }}>← Back</button>
          <h2 style={{ margin: 0 }}>{editId ? `Edit PO-${String(editId).padStart(4,'0')}` : 'New Purchase Order'}</h2>
        </div>

        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <label>Supplier
              <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}
                style={{ marginTop: 4, padding: '8px 10px', border: '1px solid #d0d7de', borderRadius: 4, fontSize: 14, width: '100%' }}>
                <option value="">— select supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>Notes
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Delivery instructions, special requirements…"
                style={{ marginTop: 4, height: 60, fontSize: 13 }} />
            </label>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Items to Purchase</h3>

              {/* Panel trigger */}
              <div style={{ position: 'relative' }} ref={panelRef}>
                <button type="button" className="btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}
                  onClick={() => setShowPanel(v => !v)}>
                  + Add Items {items.length > 0 && `(${items.length})`}
                </button>

                {showPanel && (
                  <div style={{
                    position: 'absolute', top: '110%', left: 0, zIndex: 200,
                    background: '#fff', border: '1px solid #d0d7de', borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.13)', width: 420, maxHeight: 480,
                    display: 'flex', flexDirection: 'column',
                  }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 8px' }}>
                      <button type="button" style={tabStyle(panelTab === 'catalog')} onClick={() => setPanelTab('catalog')}>
                        Catalog Items
                      </button>
                      <button type="button" style={tabStyle(panelTab === 'raw')} onClick={() => setPanelTab('raw')}>
                        Raw Materials
                      </button>
                    </div>

                    {/* Search */}
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f2f5' }}>
                      <input autoFocus placeholder={panelTab === 'catalog' ? 'Search catalog…' : 'Search raw materials…'}
                        value={panelSearch} onChange={e => setPanelSearch(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #d0d7de', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>

                    {/* Content */}
                    <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
                      {panelTab === 'catalog' && (
                        <>
                          {Object.keys(catalogByCategory).length === 0 && (
                            <div style={{ padding: '16px 12px', color: '#888', fontSize: 13 }}>No items found</div>
                          )}
                          {Object.entries(catalogByCategory).map(([cat, catItems]) => (
                            <div key={cat}>
                              <div style={{ padding: '5px 12px 2px', fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.4 }}>{cat}</div>
                              {catItems.map(c => {
                                const checked = selectedCatalogIds.has(String(c.id));
                                const inv = catalogInventoryMap[c.id];
                                return (
                                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', cursor: 'pointer', background: checked ? '#f0fff4' : 'transparent' }}>
                                    <input type="checkbox" checked={checked} onChange={() => toggleCatalogItem(c)} style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: '#1e2a3a' }}>{c.name}</div>
                                      <div style={{ fontSize: 11, color: '#888' }}>
                                        {c.catalog_number && <span>{c.catalog_number} · </span>}
                                        Rs. {parseFloat(c.unit_price || 0).toLocaleString('en-IN')} / {c.unit || 'unit'}
                                      </div>
                                    </div>
                                    <div style={{ flexShrink: 0 }}>
                                      {!inv
                                        ? <span style={badgeStyle('#888','#f6f8fa')}>no stock data</span>
                                        : <span style={badgeStyle(inv.qty < 10 ? '#856404' : '#1e7e34', inv.qty < 10 ? '#fff3cd' : '#d4edda')}>stock: {inv.qty}</span>
                                      }
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                        </>
                      )}

                      {panelTab === 'raw' && (
                        <>
                          {filteredRaw.length === 0 && panelSearch && (
                            <div style={{ padding: '16px 12px', color: '#888', fontSize: 13 }}>No raw materials found</div>
                          )}
                          {filteredRaw.length === 0 && !panelSearch && (
                            <div style={{ padding: '16px 12px', color: '#888', fontSize: 13 }}>No raw materials in inventory yet.<br />Use "+ Custom" to add one.</div>
                          )}
                          {filteredRaw.map(r => {
                            const checked = selectedRawIds.has(String(r.id));
                            const qty = parseInt(r.quantity);
                            return (
                              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', cursor: 'pointer', background: checked ? '#f0fff4' : 'transparent' }}>
                                <input type="checkbox" checked={checked} onChange={() => toggleRawItem(r)} style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: '#1e2a3a' }}>{r.item_name}</div>
                                  <div style={{ fontSize: 11, color: '#888' }}>Unit: {r.unit || 'unit'}{r.location ? ` · ${r.location}` : ''}</div>
                                </div>
                                <div style={{ flexShrink: 0 }}>
                                  <span style={badgeStyle(qty < 10 ? '#856404' : '#1e7e34', qty < 10 ? '#fff3cd' : '#d4edda')}>stock: {qty}</span>
                                </div>
                              </label>
                            );
                          })}
                          <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f2f5', marginTop: 4 }}>
                            <button type="button" className="btn-sm" onClick={addCustomRaw} style={{ width: '100%', textAlign: 'center' }}>
                              + Custom Raw Material (not in inventory)
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#888' }}>{items.length} item{items.length !== 1 ? 's' : ''} added</span>
                      <button type="button" className="btn-sm" onClick={() => setShowPanel(false)}>Done</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <div style={{ background: '#f8f9fc', border: '1px dashed #d0d7de', borderRadius: 6, padding: '28px 16px', textAlign: 'center', color: '#888', fontSize: 13 }}>
                No items yet. Click <strong>+ Add Items</strong> to select catalog items or raw materials.
              </div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f6f8fa', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#555' }}>Item</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#555' }}>Type</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#555' }}>Current Stock</th>
                      <th style={{ padding: '8px 10px', width: 90, textAlign: 'right', fontWeight: 600, color: '#555' }}>Qty to Order</th>
                      <th style={{ padding: '8px 10px', width: 110, textAlign: 'right', fontWeight: 600, color: '#555' }}>Unit Price</th>
                      <th style={{ padding: '8px 10px', width: 90, textAlign: 'right', fontWeight: 600, color: '#555' }}>Amount</th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item._key} style={{ borderBottom: idx < items.length - 1 ? '1px solid #f0f2f5' : 'none', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={{ padding: '8px 10px' }}>
                          {item.item_type === 'raw_material' && !item.inventory_id ? (
                            <input value={item.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)}
                              placeholder="Raw material name"
                              style={{ width: '100%', padding: '5px 7px', border: '1px solid #d0d7de', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }} />
                          ) : (
                            <div>
                              <div style={{ fontWeight: 500, color: '#1e2a3a' }}>{item.item_name}</div>
                              {item.catalog_number && <div style={{ fontSize: 11, color: '#888' }}>{item.catalog_number}{item.category ? ` · ${item.category}` : ''}</div>}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: 11, padding: '2px 7px', borderRadius: 99,
                            background: item.item_type === 'catalog' ? '#e8f0fe' : '#fef3e2',
                            color: item.item_type === 'catalog' ? '#1a56db' : '#b45309',
                          }}>
                            {item.item_type === 'catalog' ? 'Catalog' : 'Raw Material'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>{stockBadge(item)}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <input type="number" step="1" min="1" value={item.quantity}
                            onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            style={{ width: '100%', padding: '5px 7px', border: '1px solid #d0d7de', borderRadius: 4, fontSize: 13, textAlign: 'right', boxSizing: 'border-box' }} />
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <input type="number" step="0.01" min="0" value={item.unit_price}
                            onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                            style={{ width: '100%', padding: '5px 7px', border: '1px solid #d0d7de', borderRadius: 4, fontSize: 13, textAlign: 'right', boxSizing: 'border-box' }} />
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right', color: '#1e2a3a', whiteSpace: 'nowrap' }}>
                          {((parseInt(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <button type="button" onClick={() => removeItem(idx)}
                            style={{ padding: '3px 7px', border: '1px solid #f5b7b1', borderRadius: 4, background: '#fde8e8', color: '#c0392b', cursor: 'pointer', fontSize: 12 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f6f8fa' }}>
                      <td colSpan={5} style={{ padding: '10px 10px', fontWeight: 700, textAlign: 'right', fontSize: 14 }}>Grand Total</td>
                      <td style={{ padding: '10px 10px', fontWeight: 700, fontSize: 15, color: '#1e2a3a', textAlign: 'right' }}>
                        Rs. {total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="btn-primary">{editId ? 'Save Changes' : 'Create Purchase Order'}</button>
            <button type="button" onClick={() => { setForm(null); setEditId(null); }}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  // ── List ─────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Purchases</h2>
        <button className="btn-primary" onClick={openNew}>+ New Purchase Order</button>
      </div>

      <div className="search-row">
        <input className="search-input" placeholder="Search by supplier or PO #…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['pending','ordered','received','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || statusFilter) && <button className="btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); }}>Clear</button>}
        <span style={{ fontSize: 13, color: '#888' }}>{filtered.length} of {purchases.length}</span>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>PO #</th><th>Supplier</th><th>Status</th><th>Total</th><th>Date</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {filtered.map(p => (
            <tr key={p.id}>
              <td>PO-{String(p.id).padStart(4, '0')}</td>
              <td>{p.supplier_name || '—'}</td>
              <td><span className="badge" style={{ background: STATUS_COLORS[p.status] }}>{p.status}</span></td>
              <td>Rs. {parseFloat(p.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
              <td>{new Date(p.created_at).toLocaleDateString()}</td>
              <td>
                <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)} style={{ fontSize: 12, marginRight: 6 }}>
                  {['pending','ordered','received','cancelled'].map(s => <option key={s}>{s}</option>)}
                </select>
                <button className="btn-sm" onClick={() => openEdit(p.id)} style={{ marginRight: 4 }}>Edit</button>
                <button className="btn-sm" onClick={() => downloadPdf(p.id)} style={{ marginRight: 4 }}>⬇ PO PDF</button>
                <button className="btn-sm btn-danger" onClick={() => del(p.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={6} className="empty">{purchases.length ? 'No results match your filter.' : 'No purchase orders yet.'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
