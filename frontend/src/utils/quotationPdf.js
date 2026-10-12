import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function downloadQuotationPdf(order) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(today.getDate() + 30);

  const fmt = d => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Header ──────────────────────────────────────────────────
  doc.setFillColor(9, 105, 218);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTATION', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Quotation No: Q-${String(order.id).padStart(4, '0')}`, 14, 21);
  doc.text(`Date: ${fmt(today)}`, pageW / 2, 21);
  doc.text(`Valid Until: ${fmt(validUntil)}`, pageW - 14, 21, { align: 'right' });

  // ── Company info ─────────────────────────────────────────────
  doc.setTextColor(30, 42, 58);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('From:', 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Your Company Name', 14, 44);
  doc.text('Address Line 1, City, State - PIN', 14, 49);
  doc.text('Phone: +91 XXXXX XXXXX  |  Email: info@yourcompany.com', 14, 54);

  // ── Bill To ───────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', pageW / 2, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(order.customer_name || 'Walk-in Customer', pageW / 2, 44);
  if (order.customer_phone) doc.text(`Phone: ${order.customer_phone}`, pageW / 2, 49);
  if (order.customer_email) doc.text(`Email: ${order.customer_email}`, pageW / 2, 54);
  if (order.customer_address) {
    const lines = doc.splitTextToSize(order.customer_address, 80);
    doc.text(lines, pageW / 2, order.customer_phone ? 54 : 49);
  }

  // ── Items table ───────────────────────────────────────────────
  const rows = (order.items || []).map((item, i) => [
    i + 1,
    item.item_name || '—',
    item.catalog_number || '—',
    item.category || '—',
    parseFloat(item.quantity).toFixed(2),
    `${parseFloat(item.unit_price).toFixed(2)}`,
    `${(item.quantity * item.unit_price).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 62,
    head: [['#', 'Item Name', 'Cat. No.', 'Category', 'Qty', 'Unit Price (₹)', 'Amount (₹)']],
    body: rows,
    headStyles: { fillColor: [9, 105, 218], fontSize: 9, halign: 'center' },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 28 },
      6: { halign: 'right', cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  // ── Totals ────────────────────────────────────────────────────
  const finalY = doc.lastAutoTable.finalY + 6;
  const total = parseFloat(order.total_amount || 0).toFixed(2);

  doc.setDrawColor(200);
  doc.line(pageW - 80, finalY, pageW - 14, finalY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total:', pageW - 80, finalY + 7);
  doc.text(`Rs. ${total}`, pageW - 14, finalY + 7, { align: 'right' });

  // ── Notes ─────────────────────────────────────────────────────
  if (order.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 14, finalY + 7);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(order.notes, pageW - 28);
    doc.text(noteLines, 14, finalY + 13);
  }

  // ── Terms ─────────────────────────────────────────────────────
  const termsY = Math.max(finalY + 30, doc.internal.pageSize.getHeight() - 40);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions:', 14, termsY);
  doc.setFont('helvetica', 'normal');
  doc.text('1. This quotation is valid for 30 days from the date of issue.', 14, termsY + 5);
  doc.text('2. Prices are subject to change without prior notice after the validity period.', 14, termsY + 10);
  doc.text('3. Delivery timelines will be confirmed upon order confirmation.', 14, termsY + 15);

  // ── Save ──────────────────────────────────────────────────────
  doc.save(`Quotation-Q${String(order.id).padStart(4, '0')}-${order.customer_name || 'Customer'}.pdf`);
}
