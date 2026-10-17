import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, Clock, AlertCircle, Plus, Trash2, CreditCard } from 'lucide-react';
import api from '../api';
import Modal from '../components/Modal';

const empty = { type: 'income', amount: '', description: '', reference: '', entry_date: '' };

const PAY_STYLE = {
  paid:    { bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success-b)' },
  unpaid:  { bg: 'var(--danger-bg)',  color: 'var(--danger)',  border: 'var(--danger-b)'  },
  partial: { bg: 'var(--warn-bg)',    color: 'var(--warn)',    border: 'var(--warn-b)'    },
};

function fmt(n) {
  return 'Rs. ' + parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function PayBadge({ status }) {
  const c = PAY_STYLE[status] || PAY_STYLE.unpaid;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

// Inline payment widget — shows paid/remaining bar + partial amount input
function PaymentCell({ id, total, amountPaid, paymentStatus, onSave }) {
  const [open, setOpen] = useState(false);
  const [inputAmt, setInputAmt] = useState('');
  const paid = parseFloat(amountPaid || 0);
  const totalAmt = parseFloat(total || 0);
  const remaining = Math.max(0, totalAmt - paid);
  const pct = totalAmt > 0 ? Math.min(100, (paid / totalAmt) * 100) : 0;
  const status = paymentStatus || 'unpaid';

  const save = async () => {
    const amt = parseFloat(inputAmt);
    if (isNaN(amt) || amt < 0) return;
    await onSave(id, amt);
    setOpen(false);
    setInputAmt('');
  };

  const markFull = async () => { await onSave(id, totalAmt); setOpen(false); };
  const markUnpaid = async () => { await onSave(id, 0); setOpen(false); };

  return (
    <div style={{ minWidth: 220 }}>
      {/* Status badge + amounts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <PayBadge status={status} />
        {status === 'partial' && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {fmt(paid)} paid · <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(remaining)} left</span>
          </span>
        )}
        {status === 'paid' && (
          <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 500 }}>Fully collected</span>
        )}
        {status === 'unpaid' && (
          <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 500 }}>{fmt(totalAmt)} due</span>
        )}
      </div>

      {/* Progress bar */}
      {status !== 'unpaid' && (
        <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 99, marginBottom: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99, width: `${pct}%`,
            background: status === 'paid' ? 'var(--success)' : 'var(--warn)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      )}

      {/* Amount input — always shown when open */}
      {open ? (
        <div style={{ background: 'var(--surface-2)', border: '1.5px solid var(--accent)', borderRadius: 8, padding: '10px 12px', marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
            Enter amount paid <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(total: {fmt(totalAmt)})</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-3)', pointerEvents: 'none', fontWeight: 600 }}>Rs.</span>
              <input
                autoFocus
                type="number" min="0" step="0.01" max={totalAmt}
                value={inputAmt}
                onChange={e => setInputAmt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false); }}
                placeholder="0.00"
                style={{ width: '100%', padding: '6px 8px 6px 34px', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <button onClick={save} className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>Save</button>
            <button onClick={() => setOpen(false)} className="btn-sm">✕</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {status !== 'paid' && (
            <button onClick={markFull} style={qBtn('var(--success-bg)','var(--success)','var(--success-b)')}>✓ Mark Paid</button>
          )}
          <button
            onClick={() => { setInputAmt(paid > 0 ? String(paid) : ''); setOpen(true); }}
            style={qBtn('var(--accent-bg)','var(--accent)','rgba(35,131,226,0.3)')}
          >
            <CreditCard size={10} /> {status === 'partial' ? 'Edit Amount' : 'Enter Partial'}
          </button>
          {status !== 'unpaid' && (
            <button onClick={markUnpaid} style={qBtn('var(--warn-bg)','var(--warn)','var(--warn-b)')}>Reset</button>
          )}
        </div>
      )}
    </div>
  );
}

function qBtn(bg, color, border) {
  return {
    fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 6,
    background: bg, color, border: `1px solid ${border}`,
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4,
  };
}

export default function Accounting() {
  const [tab, setTab] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [journal, setJournal] = useState({ entries: [], summary: { income: 0, expense: 0, balance: 0 } });
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [payFilter, setPayFilter] = useState('');

  const loadAll = () => Promise.all([
    api.get('/orders'),
    api.get('/purchases'),
    api.get('/accounting'),
  ]).then(([o, p, j]) => {
    setOrders(o.data);
    setPurchases(p.data);
    setJournal(j.data);
  });

  useEffect(() => { loadAll(); }, []);

  const saveOrderPayment = async (id, amount_paid) => {
    const status = amount_paid <= 0 ? 'unpaid'
      : amount_paid >= parseFloat(orders.find(o => o.id === id)?.total_amount || 0) ? 'paid' : 'partial';
    await api.patch(`/orders/${id}/payment`, { payment_status: status, amount_paid });
    loadAll();
  };

  const savePurchasePayment = async (id, amount_paid) => {
    const status = amount_paid <= 0 ? 'unpaid'
      : amount_paid >= parseFloat(purchases.find(p => p.id === id)?.total_amount || 0) ? 'paid' : 'partial';
    await api.patch(`/purchases/${id}/payment`, { payment_status: status, amount_paid });
    loadAll();
  };

  const saveEntry = async e => {
    e.preventDefault(); setError('');
    try { await api.post('/accounting', form); setForm(null); loadAll(); }
    catch (err) { setError(err.response?.data?.error || 'Error'); }
  };

  const delEntry = async id => {
    if (!confirm('Delete this entry?')) return;
    try { await api.delete(`/accounting/${id}`); loadAll(); }
    catch (err) { alert(err.response?.data?.error || 'Delete failed'); }
  };

  // ── Summary calculations ───────────────────────────────────────
  const totalReceived   = orders.reduce((s, o) => s + parseFloat(o.amount_paid || 0), 0);
  const totalReceivable = orders.reduce((s, o) => s + Math.max(0, parseFloat(o.total_amount || 0) - parseFloat(o.amount_paid || 0)), 0);
  const totalPaidOut    = purchases.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0);
  const totalPayable    = purchases.reduce((s, p) => s + Math.max(0, parseFloat(p.total_amount || 0) - parseFloat(p.amount_paid || 0)), 0);
  const netBalance      = (totalReceived + journal.summary.income) - (totalPaidOut + journal.summary.expense);

  const filteredOrders = orders.filter(o => {
    const q = search.toLowerCase();
    return (!q || (o.customer_name || '').toLowerCase().includes(q) || String(o.id).includes(q))
      && (!payFilter || (o.payment_status || 'unpaid') === payFilter);
  });

  const filteredPurchases = purchases.filter(p => {
    const q = search.toLowerCase();
    return (!q || (p.supplier_name || '').toLowerCase().includes(q) || String(p.id).includes(q))
      && (!payFilter || (p.payment_status || 'unpaid') === payFilter);
  });

  const filteredJournal = journal.entries.filter(e => {
    const q = search.toLowerCase();
    return (!q || e.description?.toLowerCase().includes(q) || e.reference?.toLowerCase().includes(q))
      && (!payFilter || e.type === payFilter);
  });

  const tabStyle = active => ({
    padding: '9px 20px', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
    background: 'none', border: 'none', fontFamily: 'inherit',
    color: active ? 'var(--text-1)' : 'var(--text-2)',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    transition: 'color 0.15s',
  });

  const unpaidOrderCount    = orders.filter(o => (o.payment_status || 'unpaid') !== 'paid').length;
  const unpaidPurchaseCount = purchases.filter(p => (p.payment_status || 'unpaid') !== 'paid').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Accounting</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Track receivables, payables, and journal entries.</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({ ...empty }); setError(''); }}>
          <Plus size={14} /> Add Journal Entry
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 14, marginBottom: 28 }}>
        <SCard icon={TrendingUp}   color="var(--success)" bg="var(--success-bg)" label="Total Received"    value={fmt(totalReceived)} />
        <SCard icon={Clock}        color="var(--warn)"    bg="var(--warn-bg)"    label="Still Receivable"  value={fmt(totalReceivable)} />
        <SCard icon={TrendingDown} color="var(--danger)"  bg="var(--danger-bg)"  label="Total Paid Out"    value={fmt(totalPaidOut)} />
        <SCard icon={AlertCircle}  color="#8b5cf6"        bg="rgba(139,92,246,0.12)" label="Still Payable" value={fmt(totalPayable)} />
        <SCard icon={Wallet}       color={netBalance >= 0 ? 'var(--accent)' : 'var(--danger)'} bg={netBalance >= 0 ? 'var(--accent-bg)' : 'var(--danger-bg)'} label="Net Balance" value={fmt(netBalance)} large />
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 20, display: 'flex' }}>
        <button style={tabStyle(tab === 'overview')}   onClick={() => { setTab('overview');   setSearch(''); setPayFilter(''); }}>Overview</button>
        <button style={tabStyle(tab === 'receivable')} onClick={() => { setTab('receivable'); setSearch(''); setPayFilter(''); }}>
          Sales / Receivable {unpaidOrderCount > 0 && <Pill n={unpaidOrderCount} />}
        </button>
        <button style={tabStyle(tab === 'payable')}    onClick={() => { setTab('payable');    setSearch(''); setPayFilter(''); }}>
          Purchases / Payable {unpaidPurchaseCount > 0 && <Pill n={unpaidPurchaseCount} />}
        </button>
        <button style={tabStyle(tab === 'journal')} onClick={() => { setTab('journal'); setSearch(''); setPayFilter(''); }}>Journal Entries</button>
      </div>

      {tab !== 'overview' && (
        <div className="search-row">
          <input className="search-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="filter-select" value={payFilter} onChange={e => setPayFilter(e.target.value)}>
            <option value="">{tab === 'journal' ? 'All Types' : 'All Payments'}</option>
            {tab === 'journal'
              ? <><option value="income">Income</option><option value="expense">Expense</option></>
              : <><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option></>
            }
          </select>
          {(search || payFilter) && <button className="btn-sm" onClick={() => { setSearch(''); setPayFilter(''); }}>Clear</button>}
        </div>
      )}

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <MiniPanel title="Unpaid / Partial Orders" icon={<Clock size={14} color="#f59e0b" />} onViewAll={() => setTab('receivable')}
            empty={unpaidOrderCount === 0} emptyText="All orders fully collected">
            {orders.filter(o => (o.payment_status || 'unpaid') !== 'paid').slice(0, 5).map(o => {
              const paid = parseFloat(o.amount_paid || 0);
              const total = parseFloat(o.total_amount || 0);
              return (
                <MiniRow key={o.id}
                  left={o.customer_name || 'Walk-in'} sub={`Order #${o.id}`}
                  right={fmt(total)} badge={<PayBadge status={o.payment_status || 'unpaid'} />}
                  paid={paid} total={total}
                  onMarkPaid={() => saveOrderPayment(o.id, total)}
                  onSavePartial={amt => saveOrderPayment(o.id, amt)} />
              );
            })}
          </MiniPanel>

          <MiniPanel title="Unpaid / Partial POs" icon={<AlertCircle size={14} color="#8b5cf6" />} onViewAll={() => setTab('payable')}
            empty={unpaidPurchaseCount === 0} emptyText="All purchases fully settled">
            {purchases.filter(p => (p.payment_status || 'unpaid') !== 'paid').slice(0, 5).map(p => {
              const paid = parseFloat(p.amount_paid || 0);
              const total = parseFloat(p.total_amount || 0);
              return (
                <MiniRow key={p.id}
                  left={p.supplier_name || 'Unknown'} sub={`PO-${String(p.id).padStart(4,'0')}`}
                  right={fmt(total)} badge={<PayBadge status={p.payment_status || 'unpaid'} />}
                  paid={paid} total={total}
                  onMarkPaid={() => savePurchasePayment(p.id, total)}
                  onSavePartial={amt => savePurchasePayment(p.id, amt)} />
              );
            })}
          </MiniPanel>
        </div>
      )}

      {/* RECEIVABLE */}
      {tab === 'receivable' && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Order #</th><th>Customer</th><th>Total</th>
              <th>Paid</th><th>Remaining</th><th>Date</th><th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(o => {
              const paid = parseFloat(o.amount_paid || 0);
              const total = parseFloat(o.total_amount || 0);
              const remaining = Math.max(0, total - paid);
              return (
                <tr key={o.id}>
                  <td style={{ fontWeight: 600 }}>#{o.id}</td>
                  <td>{o.customer_name || 'Walk-in'}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(total)}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(paid)}</td>
                  <td style={{ color: remaining > 0 ? 'var(--danger)' : 'var(--text-3)', fontWeight: remaining > 0 ? 600 : 400 }}>
                    {remaining > 0 ? fmt(remaining) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-3)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td>
                    <PaymentCell id={o.id} total={total} amountPaid={paid}
                      paymentStatus={o.payment_status || 'unpaid'} onSave={saveOrderPayment} />
                  </td>
                </tr>
              );
            })}
            {!filteredOrders.length && <tr><td colSpan={7} className="empty">No orders found.</td></tr>}
          </tbody>
        </table>
      )}

      {/* PAYABLE */}
      {tab === 'payable' && (
        <table className="data-table">
          <thead>
            <tr>
              <th>PO #</th><th>Supplier</th><th>Total</th>
              <th>Paid</th><th>Remaining</th><th>Date</th><th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {filteredPurchases.map(p => {
              const paid = parseFloat(p.amount_paid || 0);
              const total = parseFloat(p.total_amount || 0);
              const remaining = Math.max(0, total - paid);
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>PO-{String(p.id).padStart(4,'0')}</td>
                  <td>{p.supplier_name || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(total)}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(paid)}</td>
                  <td style={{ color: remaining > 0 ? 'var(--danger)' : 'var(--text-3)', fontWeight: remaining > 0 ? 600 : 400 }}>
                    {remaining > 0 ? fmt(remaining) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-3)' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>
                    <PaymentCell id={p.id} total={total} amountPaid={paid}
                      paymentStatus={p.payment_status || 'unpaid'} onSave={savePurchasePayment} />
                  </td>
                </tr>
              );
            })}
            {!filteredPurchases.length && <tr><td colSpan={7} className="empty">No purchase orders found.</td></tr>}
          </tbody>
        </table>
      )}

      {/* JOURNAL */}
      {tab === 'journal' && (
        <table className="data-table">
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Description</th><th>Reference</th><th></th></tr></thead>
          <tbody>
            {filteredJournal.map(e => (
              <tr key={e.id}>
                <td style={{ color: 'var(--text-3)' }}>{e.entry_date ? new Date(e.entry_date).toLocaleDateString() : '—'}</td>
                <td><span className="badge" style={{ background: e.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>{e.type}</span></td>
                <td style={{ fontWeight: 600, color: e.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                  {e.type === 'income' ? '+' : '−'} {fmt(e.amount)}
                </td>
                <td>{e.description || '—'}</td>
                <td style={{ color: 'var(--text-3)' }}>{e.reference || '—'}</td>
                <td><button className="btn-sm btn-danger" onClick={() => delEntry(e.id)}><Trash2 size={11} /> Delete</button></td>
              </tr>
            ))}
            {!filteredJournal.length && <tr><td colSpan={6} className="empty">{journal.entries.length ? 'No entries match.' : 'No journal entries yet.'}</td></tr>}
          </tbody>
        </table>
      )}

      {form && (
        <Modal title="New Journal Entry" onClose={() => setForm(null)}>
          <form onSubmit={saveEntry}>
            <label>Type
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </label>
            <label>Amount *<input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></label>
            <label>Description<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Security deposit, rent…" /></label>
            <label>Reference<input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Invoice #, cheque #…" /></label>
            <label>Date<input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} /></label>
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn-primary">Save Entry</button>
              <button type="button" className="btn-secondary" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────
function Pill({ n }) {
  return <span style={{ marginLeft: 6, background: 'var(--warn-bg)', color: 'var(--warn)', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{n}</span>;
}

function SCard({ icon: Icon, color, bg, label, value, large }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <div style={{ fontSize: large ? 17 : 15, fontWeight: 700, color, letterSpacing: '-0.3px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginTop: 5 }}>{label}</div>
    </div>
  );
}

function MiniPanel({ title, icon, onViewAll, empty, emptyText, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{icon}{title}</div>
        <button onClick={onViewAll} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
      </div>
      {empty
        ? <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>✓ {emptyText}</div>
        : <div>{children}</div>}
    </div>
  );
}

function MiniRow({ left, sub, right, badge, paid, total, onMarkPaid, onSavePartial }) {
  const [open, setOpen] = useState(false);
  const [inputAmt, setInputAmt] = useState('');
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  const save = async () => {
    const amt = parseFloat(inputAmt);
    if (isNaN(amt) || amt < 0) return;
    await onSavePartial(amt);
    setOpen(false);
    setInputAmt('');
  };

  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (pct > 0 || open) ? 6 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{left}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{sub}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {badge}
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{right}</span>
          <button onClick={onMarkPaid} style={qBtn('var(--success-bg)','var(--success)','var(--success-b)')}>✓ Paid</button>
          <button onClick={() => { setInputAmt(paid > 0 ? String(paid) : ''); setOpen(v => !v); }} style={qBtn('var(--accent-bg)','var(--accent)','rgba(35,131,226,0.3)')}>
            Partial
          </button>
        </div>
      </div>
      {pct > 0 && !open && (
        <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--warn)', borderRadius: 99 }} />
        </div>
      )}
      {paid > 0 && paid < total && !open && (
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {fmt(paid)} paid · <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(total - paid)} remaining</span>
        </div>
      )}
      {open && (
        <div style={{ background: 'var(--surface-2)', border: '1.5px solid var(--accent)', borderRadius: 8, padding: '8px 10px', marginTop: 2 }}>
          <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, marginBottom: 5 }}>
            Amount paid <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>/ {fmt(total)}</span>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)', pointerEvents: 'none', fontWeight: 600 }}>Rs.</span>
              <input
                autoFocus
                type="number" min="0" step="0.01" max={total}
                value={inputAmt}
                onChange={e => setInputAmt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false); }}
                placeholder="0.00"
                style={{ width: '100%', padding: '5px 7px 5px 30px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <button onClick={save} className="btn-primary" style={{ fontSize: 11, padding: '5px 12px' }}>Save</button>
            <button onClick={() => setOpen(false)} className="btn-sm">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
