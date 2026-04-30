// ─── Contract PDF builder ─────────────────────────────────────────────────────
// Builds a branded, server-renderable PDF of a signed (or unsigned) contract
// using jsPDF only — no browser-only image-loading helpers, so this runs fine
// inside a Next.js Route Handler. The signature image is already a data URL
// stored on the contract row (`signature_data_url`), which jsPDF accepts
// directly via `addImage`.
//
// Returns the PDF as a Uint8Array. The API route uploads it to the
// `contract-pdfs` Supabase storage bucket and saves the public URL on the
// contract row.

import jsPDF from 'jspdf';

const COMPANY = {
  name: 'Lucky Landscapes',
  phone: '(402) 405-5475',
  email: 'rileykopf@luckylandscapes.com',
  website: 'luckylandscapes.com',
  address: '109 South Canopy ST, Lincoln, NE',
};

const FOREST = [45, 74, 34];
const CLOVER = [107, 142, 78];
const CHARCOAL = [60, 60, 60];
const GRAY = [107, 114, 128];
const LIGHT_BG = [247, 245, 240];
const WHITE = [255, 255, 255];

function fmtMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

function ensureSpace(doc, y, needed, margin) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 60) {
    drawFooter(doc);
    doc.addPage();
    return margin;
  }
  return y;
}

function drawFooter(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${COMPANY.name} • ${COMPANY.phone} • ${COMPANY.email} • ${COMPANY.address}`,
    pageWidth / 2,
    pageHeight - 24,
    { align: 'center' }
  );
}

/**
 * Build a contract PDF.
 * @param {Object} contract — snake_case row from `contracts` table
 * @returns {Uint8Array}
 */
export function buildContractPdfBytes(contract) {
  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  // ── Header bar ─────────────────────────────────────────────
  const headerHeight = 70;
  doc.setFillColor(...FOREST);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(COMPANY.name, margin, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Service Agreement', margin, 50);

  doc.setFontSize(8.5);
  doc.text(COMPANY.phone, pageWidth - margin, 26, { align: 'right' });
  doc.text(COMPANY.email, pageWidth - margin, 40, { align: 'right' });
  doc.text(COMPANY.website, pageWidth - margin, 54, { align: 'right' });

  let y = headerHeight + 32;

  // ── Title row ──────────────────────────────────────────────
  doc.setTextColor(...CHARCOAL);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SERVICE AGREEMENT', margin, y);
  doc.setFontSize(13);
  doc.setTextColor(...CLOVER);
  doc.text(`#${contract.contract_number || contract.contractNumber || ''}`, pageWidth - margin, y, { align: 'right' });
  y += 26;

  // ── Status banner (if signed) ──────────────────────────────
  const isSigned = contract.status === 'signed';
  if (isSigned) {
    doc.setFillColor(230, 247, 230);
    doc.setDrawColor(165, 216, 165);
    doc.roundedRect(margin, y, contentWidth, 38, 4, 4, 'FD');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 111, 58);
    doc.text(`SIGNED — ${fmtDateTime(contract.signed_at || contract.signedAt)}`, margin + 16, y + 24);
    y += 52;
  }

  // ── Meta strip ─────────────────────────────────────────────
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin, y, contentWidth, 56, 4, 4, 'FD');

  const cs = contract.customer_snapshot || contract.customerSnapshot || {};
  const customerName = cs.name || 'Customer';
  const meta = [
    { label: 'AGREEMENT DATE', value: new Date(contract.created_at || contract.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
    { label: 'TOTAL', value: fmtMoney(contract.total_amount || contract.totalAmount) },
    { label: 'DEPOSIT', value: fmtMoney(contract.deposit_amount || contract.depositAmount) },
    { label: 'STATUS', value: (contract.status || 'draft').toUpperCase() },
  ];
  const colW = contentWidth / meta.length;
  meta.forEach((it, i) => {
    const x = margin + i * colW + 14;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(it.label, x, y + 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CHARCOAL);
    doc.text(it.value, x, y + 38);
  });
  y += 74;

  // ── Customer block ─────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CLOVER);
  doc.text('CUSTOMER', margin, y);
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...CHARCOAL);
  doc.text(customerName, margin, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  if (cs.address) { doc.text(cs.address, margin, y); y += 12; }
  if (cs.city || cs.state || cs.zip) {
    doc.text([cs.city, cs.state, cs.zip].filter(Boolean).join(' ').replace(/\s+/g, ' '), margin, y);
    y += 12;
  }
  if (cs.email) { doc.text(cs.email, margin, y); y += 12; }
  if (cs.phone) { doc.text(cs.phone, margin, y); y += 12; }
  y += 12;

  // ── Body (rendered as wrapped plain text, preserving the frozen template) ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CHARCOAL);
  doc.text('AGREEMENT TERMS', margin, y);
  y += 16;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CHARCOAL);

  const bodyLines = (contract.body || '').split('\n');
  const lineHeight = 12;
  for (const rawLine of bodyLines) {
    const line = rawLine.trimEnd();
    // Section headings are short ALL-CAPS lines — render them bold/colored.
    const isHeading = /^[A-Z0-9 .,&\-]{4,}$/.test(line) && line.length < 80 && line === line.toUpperCase();
    const isNumberedHeading = /^\d+\.\s+[A-Z]/.test(line);

    if (isHeading || isNumberedHeading) {
      y = ensureSpace(doc, y + 4, 18, margin);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...CLOVER);
      doc.text(line, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...CHARCOAL);
      y += lineHeight + 2;
      continue;
    }

    const wrapped = doc.splitTextToSize(line || ' ', contentWidth);
    for (const w of wrapped) {
      y = ensureSpace(doc, y, lineHeight, margin);
      doc.text(w, margin, y);
      y += lineHeight;
    }
  }

  // ── Signature block ────────────────────────────────────────
  y = ensureSpace(doc, y + 18, 180, margin);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CLOVER);
  doc.text('CUSTOMER SIGNATURE', margin, y);
  y += 18;

  const sigUrl = contract.signature_data_url || contract.signatureDataUrl;
  const typedName = contract.signature_typed_name || contract.signatureTypedName;

  if (sigUrl && sigUrl.startsWith('data:image/')) {
    try {
      const sigW = 220;
      const sigH = 70;
      doc.setDrawColor(220, 220, 220);
      doc.rect(margin, y, sigW, sigH, 'S');
      doc.addImage(sigUrl, 'PNG', margin + 4, y + 4, sigW - 8, sigH - 8);
      // Right column — typed name + timestamp + IP
      const rightX = margin + sigW + 24;
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'normal');
      doc.text('TYPED NAME', rightX, y + 14);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...CHARCOAL);
      doc.text(typedName || '—', rightX, y + 30);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text('SIGNED AT', rightX, y + 48);
      doc.setFontSize(9.5);
      doc.setTextColor(...CHARCOAL);
      doc.text(fmtDateTime(contract.signed_at || contract.signedAt), rightX, y + 62);
      y += sigH + 14;

      // Evidentiary trail
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      const ip = contract.signature_ip || contract.signatureIp;
      const ua = contract.signature_user_agent || contract.signatureUserAgent;
      if (ip || ua) {
        doc.text(
          `Evidence: ${[ip ? `IP ${ip}` : null, ua ? `UA "${(ua || '').slice(0, 90)}${ua.length > 90 ? '…' : ''}"` : null].filter(Boolean).join('  •  ')}`,
          margin,
          y
        );
        y += 10;
      }
      doc.text(`Public token: ${contract.public_token || contract.publicToken || ''}`, margin, y);
      y += 12;
    } catch (e) {
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text('Signature image failed to embed: ' + (e?.message || String(e)), margin, y);
      y += 14;
    }
  } else {
    // Unsigned — render an empty signature line so the PDF still prints/looks right
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.8);
    doc.line(margin, y + 38, margin + 280, y + 38);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text('Customer signature', margin, y + 50);

    doc.line(margin + 320, y + 38, margin + 320 + 160, y + 38);
    doc.text('Date', margin + 320, y + 50);
    y += 70;
  }

  drawFooter(doc);

  // jsPDF in Node returns ArrayBuffer with output('arraybuffer')
  const ab = doc.output('arraybuffer');
  return new Uint8Array(ab);
}
