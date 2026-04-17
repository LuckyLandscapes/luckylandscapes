import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import fullLogoSrc from '@/assets/Fulllogopdf.png';

/**
 * Load an image from a URL/import and return a base64 data URL.
 */
function loadImageAsBase64(src) {
  // Handle Next.js static asset objects or plain strings
  const imagePath = src?.src || src;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${imagePath}`));
    img.src = imagePath;
  });
}

/**
 * Generate a branded Lucky Landscapes quote PDF.
 * @param {Object} quote - The quote object
 * @param {Object} customer - The customer object
 * @param {Object} [company] - Optional company info override
 */
async function buildQuotePdf(quote, customer, company = {}) {
  const doc = new jsPDF('p', 'pt', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  // Company defaults
  const co = {
    name: company.name || 'Lucky Landscapes',
    phone: company.phone || '(402) 405-5475',
    email: company.email || 'rileykopf@luckylandscapes.com',
    website: company.website || 'luckylandscapes.com',
    address: company.address || '109 South Canopy Street',
    tagline: company.tagline || 'Creating Outdoor Spaces You\'ll Feel Lucky to Have!',
    ...company,
  };

  // =============== COLORS (matching website brand) ===============
  const CLOVER = [107, 142, 78];   // #6B8E4E — primary brand green
  const CLOVER_DARK = [90, 122, 64];    // #5A7A40 — darker accent
  const FOREST = [45, 74, 34];     // #2D4A22 — deep green (header bg)
  const CHARCOAL = [60, 60, 60];     // #3C3C3C — body text
  const GRAY = [107, 114, 128];  // #6B7280 — muted text
  const LIGHT_BG = [247, 245, 240];  // #F7F5F0 — cream background
  const WHITE = [255, 255, 255];

  let y = margin;

  // =============== HEADER BAR ===============
  const headerHeight = 90;
  doc.setFillColor(...FOREST);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Full branded logo (includes clover + company name)
  try {
    const logoBase64 = await loadImageAsBase64(fullLogoSrc);
    
    // Determine dimensions (use imported values if available for accuracy)
    const originalWidth = fullLogoSrc?.width || 1558;
    const originalHeight = fullLogoSrc?.height || 644;
    const logoAspectRatio = originalWidth / originalHeight;

    // Increase size for "full banner" feel
    const logoDisplayHeight = headerHeight - 14; // Larger — 76pt tall
    const logoDisplayWidth = logoDisplayHeight * logoAspectRatio;
    
    const logoX = margin - 10; // Slight bleed into margin for more "banner" feel
    const logoY = (headerHeight - logoDisplayHeight) / 2;
    
    doc.addImage(logoBase64, 'PNG', logoX, logoY, logoDisplayWidth, logoDisplayHeight);
  } catch (err) {
    console.error('PDF Logo Load Error:', err);
    // Silent fallback if logo fails (or render co.name if absolutely required)
    // The user specifically asked to remove the text because it's in the logo.
  }

  // Contact info (right side, stacked)
  doc.setFontSize(8.5);
  doc.setTextColor(...WHITE);
  const contactLines = [co.phone, co.email, co.website];
  contactLines.forEach((line, i) => {
    doc.text(line, pageWidth - margin, 26 + i * 14, { align: 'right' });
  });

  y = headerHeight + 32;

  // =============== QUOTE TITLE ===============
  doc.setTextColor(...CHARCOAL);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTIMATE', margin, y);

  // Quote number badge (right)
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CLOVER);
  doc.text(`#${quote.quoteNumber}`, pageWidth - margin, y, { align: 'right' });

  y += 30;

  // =============== QUOTE META ROW ===============
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y - 6, contentWidth, 50, 4, 4, 'F');
  // Subtle border
  doc.setDrawColor(229, 231, 235); // gray-200
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y - 6, contentWidth, 50, 4, 4, 'S');

  const metaItems = [
    { label: 'DATE', value: formatDate(quote.createdAt) },
    { label: 'VALID FOR', value: '30 days' },
    { label: 'CATEGORY', value: quote.category || '—' },
    { label: 'STATUS', value: (quote.status || 'draft').toUpperCase() },
  ];

  const metaColWidth = contentWidth / metaItems.length;
  metaItems.forEach((item, i) => {
    const x = margin + i * metaColWidth + 16;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(item.label, x, y + 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CHARCOAL);
    doc.text(item.value, x, y + 28);
    doc.setFont('helvetica', 'normal');
  });

  y += 68;

  // =============== CUSTOMER INFO ===============
  doc.setFontSize(8);
  doc.setTextColor(...CLOVER);
  doc.setFont('helvetica', 'bold');
  doc.text('PREPARED FOR', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 16;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CHARCOAL);
  doc.text(customer ? `${customer.firstName} ${customer.lastName || ''}` : 'N/A', margin, y);
  doc.setFont('helvetica', 'normal');

  y += 14;
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  if (customer?.address) doc.text(customer.address, margin, y);
  y += 13;
  if (customer?.city) doc.text(`${customer.city}, ${customer.state || ''} ${customer.zip || ''}`, margin, y);
  y += 13;
  if (customer?.phone) doc.text(customer.phone, margin, y);
  y += 13;
  if (customer?.email) doc.text(customer.email, margin, y);

  y += 30;

  // =============== LINE ITEMS TABLE ===============
  const items = quote.items || [];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: CLOVER,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 10, bottom: 10, left: 12, right: 12 },
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
      textColor: CHARCOAL,
    },
    alternateRowStyles: {
      fillColor: LIGHT_BG,
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.38 },
      1: { halign: 'center', cellWidth: contentWidth * 0.10 },
      2: { halign: 'center', cellWidth: contentWidth * 0.14 },
      3: { halign: 'right', cellWidth: contentWidth * 0.18 },
      4: { halign: 'right', cellWidth: contentWidth * 0.20, fontStyle: 'bold' },
    },
    head: [['Service / Item', 'Qty', 'Unit', 'Unit Price', 'Total']],
    body: items.map(item => [
      item.name,
      String(item.quantity),
      item.unit,
      formatCurrency(item.unitPrice),
      formatCurrency(item.total),
    ]),
    didDrawPage: () => {
      // Footer on every page
      drawFooter(doc, co, pageWidth, margin);
    },
  });

  y = doc.lastAutoTable.finalY + 20;

  // =============== TOTALS BOX ===============
  const totalsWidth = 240;
  const totalsX = pageWidth - margin - totalsWidth;

  // Subtotal
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text('Subtotal', totalsX, y + 4);
  doc.setTextColor(...CHARCOAL);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(quote.total), pageWidth - margin, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  y += 20;

  // Tax
  doc.setTextColor(...GRAY);
  doc.text('Tax', totalsX, y + 4);
  doc.setTextColor(...CHARCOAL);
  doc.text('$0.00', pageWidth - margin, y + 4, { align: 'right' });

  y += 20;

  // Divider
  doc.setDrawColor(...CLOVER);
  doc.setLineWidth(2);
  doc.line(totalsX, y, pageWidth - margin, y);

  y += 18;

  // Total
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CLOVER);
  doc.text('TOTAL', totalsX, y + 4);
  doc.text(formatCurrency(quote.total), pageWidth - margin, y + 4, { align: 'right' });

  y += 40;

  // =============== NOTES ===============
  if (quote.notes) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text('NOTES', margin, y);
    y += 14;

    doc.setFontSize(9);
    doc.setTextColor(...CHARCOAL);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(quote.notes, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 13 + 16;
  }

  // =============== TERMS / ACCEPTANCE ===============
  if (y + 120 > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    y = margin;
  }

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y, contentWidth, 90, 4, 4, 'F');
  doc.setDrawColor(229, 231, 235); // gray-200
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 90, 4, 4, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CHARCOAL);
  doc.text('Acceptance', margin + 16, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(
    'By signing below, you accept this estimate and authorize Lucky Landscapes to begin work as described above.',
    margin + 16, y + 36
  );

  // Signature line
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.5);
  doc.line(margin + 16, y + 70, margin + 200, y + 70);
  doc.text('Signature', margin + 16, y + 82);

  doc.line(margin + 240, y + 70, margin + 380, y + 70);
  doc.text('Date', margin + 240, y + 82);

  // =============== FOOTER ===============
  drawFooter(doc, co, pageWidth, margin);

  // =============== RETURN AS BASE64 OR OPEN IN TAB ===============
  return doc;
}

/**
 * Generate and open the PDF in a new browser tab.
 * (Original behavior — kept for the "PDF" button.)
 */
export async function generateQuotePdf(quote, customer, company = {}) {
  const doc = await buildQuotePdf(quote, customer, company);
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(new Blob([pdfBlob], { type: 'application/pdf' }));
  window.open(blobUrl, '_blank');
}

/**
 * Generate the PDF and return it as a base64 string (for email attachments).
 */
export async function generateQuotePdfBase64(quote, customer, company = {}) {
  const doc = await buildQuotePdf(quote, customer, company);
  // doc.output('datauristring') returns "data:application/pdf;base64,XXXX"
  // We only need the base64 part after the comma
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
}

/**
 * Generate the PDF and return it as a Blob (for uploading to storage).
 */
export async function generateQuotePdfBlob(quote, customer, company = {}) {
  const doc = await buildQuotePdf(quote, customer, company);
  return doc.output('blob');
}

// =============== HELPERS ===============

function drawFooter(doc, co, pageWidth, margin) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `${co.name} • ${co.phone} • ${co.email}`,
    pageWidth / 2,
    pageHeight - 24,
    { align: 'center' }
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n || 0);
}
