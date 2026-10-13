import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function downloadPurchaseOrderPdf(purchase) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date();
  const fmt = d => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Header bar ────────────────────────────────────────────────
  doc.setFillColor(30, 100, 60);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`PO No: PO-${String(purchase.id).padStart(4, '0')}`, 14, 21);
  doc.text(`Date: ${fmt(today)}`, pageW / 2, 21);
  doc.text(`Status: ${(purchase.status || 'pending').toUpperCase()}`, pageW - 14, 21, { align: 'right' });

  // ── From (buyer) ──────────────────────────────────────────────
  doc.setTextColor(30, 42, 58);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Purchase Order From:', 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Your Company Name', 14, 44);
  doc.text('Address Line 1, City, State - PIN', 14, 49);
  doc.text('Phone: +91 XXXXX XXXXX  |  Email: info@yourcompany.com', 14, 54);

  // ── Supplier ──────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Supplier:', pageW / 2, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(purchase.supplier_name || 'Unknown Supplier', pageW / 2, 44);
  if (purchase.supplier_contact) doc.text(`Contact: ${purchase.supplier_contact}`, pageW / 2, 49);
  if (purchase.supplier_phone) doc.text(`Phone: ${purchase.supplier_phone}`, pageW / 2, 54);
  if (purchase.supplier_email) doc.text(`Email: ${purchase.supplier_email}`, pageW / 2, 59);

  // ── Items table ───────────────────────────────────────────────
  const rows = (purchase.items || []).map((item, i) => [
    i + 1,
    item.item_name || item.name || '—',
    item.catalog_number || '—',
    item.category || '—',
    parseInt(item.quantity),
    item.unit || 'unit',
    parseFloat(item.unit_price).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
    (parseInt(item.quantity) * parseFloat(item.unit_price)).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    startY: 66,
    head: [['#', 'Item', 'Cat. No.', 'Category', 'Qty', 'Unit', 'Unit Price (₹)', 'Amount (₹)']],
    body: rows,
    headStyles: { fillColor: [30, 100, 60], fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      4: { halign: 'right', cellWidth: 14 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 28 },
      7: { halign: 'right', cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: [240, 248, 243] },
    margin: { left: 14, right: 14 },
  });

  // ── Totals ────────────────────────────────────────────────────
  const finalY = doc.lastAutoTable.finalY + 6;
  const total = parseFloat(purchase.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  doc.setDrawColor(200);
  doc.line(pageW - 80, finalY, pageW - 14, finalY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', pageW - 80, finalY + 7);
  doc.text(`Rs. ${total}`, pageW - 14, finalY + 7, { align: 'right' });

  // ── Notes ─────────────────────────────────────────────────────
  if (purchase.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 14, finalY + 7);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(purchase.notes, pageW - 28);
    doc.text(lines, 14, finalY + 13);
  }

  // ── Terms ─────────────────────────────────────────────────────
  const termsY = Math.max(finalY + 32, doc.internal.pageSize.getHeight() - 38);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions:', 14, termsY);
  doc.setFont('helvetica', 'normal');
  doc.text('1. Please supply the items listed above as per agreed specifications.', 14, termsY + 5);
  doc.text('2. Invoice must reference this PO number for payment processing.', 14, termsY + 10);
  doc.text('3. Delivery must be completed within the agreed timeline.', 14, termsY + 15);

  // ── Authorised signature placeholder ─────────────────────────
  doc.setTextColor(30, 42, 58);
  doc.setFontSize(9);
  doc.line(pageW - 70, termsY + 28, pageW - 14, termsY + 28);
  doc.text('Authorised Signatory', pageW - 14, termsY + 33, { align: 'right' });

  doc.save(`PO-${String(purchase.id).padStart(4, '0')}-${purchase.supplier_name || 'Supplier'}.pdf`);
}
