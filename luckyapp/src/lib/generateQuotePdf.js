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
 * @param {Object} [opts] - { publicLink: string } for the customer-facing link
 */
async function buildQuotePdf(quote, customer, company = {}, opts = {}) {
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

  // =============== SELECTED MATERIALS GALLERY ===============
  // Customer-facing visual confirmation of the specific products that
  // will be installed. Photos + names + quantities only — never prices.
  // This is the same gallery rendered into the contract they sign, so
  // they're approving exactly these products before work starts.
  const selectedMaterials = Array.isArray(quote.selectedMaterials) ? quote.selectedMaterials : [];
  if (selectedMaterials.length > 0) {
    // Page break check — need ~140pt for the section header + at least one row
    if (y + 140 > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...FOREST);
    doc.text('Materials we\'ll be using', margin, y);
    y += 8;
    doc.setDrawColor(...CLOVER);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + 80, y);
    y += 14;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('These are the specific products selected for your project. Approving the contract approves these materials.', margin, y);
    y += 16;

    // Grid layout: 3 columns. Each card 110pt high (image 70 + caption 40).
    const cols = 3;
    const gutter = 12;
    const cardW = (contentWidth - gutter * (cols - 1)) / cols;
    const imgH = 70;
    const cardH = imgH + 56;

    // Try to load all images in parallel — failures fall back to a placeholder.
    const imageData = await Promise.all(selectedMaterials.map(async sm => {
      if (!sm.imageUrl) return null;
      try { return await loadImageAsBase64(sm.imageUrl); }
      catch { return null; }
    }));

    for (let i = 0; i < selectedMaterials.length; i++) {
      const sm = selectedMaterials[i];
      const col = i % cols;
      const x = margin + col * (cardW + gutter);

      if (col === 0 && i > 0) {
        // New row — page break check
        if (y + cardH + 20 > doc.internal.pageSize.getHeight() - 60) {
          doc.addPage();
          y = margin;
        }
      }

      // Card background
      doc.setFillColor(...LIGHT_BG);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(x, y, cardW, cardH, 4, 4, 'FD');

      // Image
      const img = imageData[i];
      if (img) {
        try {
          doc.addImage(img, 'PNG', x + 6, y + 6, cardW - 12, imgH);
        } catch {
          // jsPDF can throw on weird image formats — leave the slot blank
        }
      }

      // Caption
      doc.setTextColor(...CHARCOAL);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const nameLines = doc.splitTextToSize(sm.name || '', cardW - 12);
      doc.text(nameLines.slice(0, 2), x + 6, y + imgH + 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      const qtyLine = `${sm.quantity || 1} ${sm.unit || ''}`.trim();
      doc.text(qtyLine, x + 6, y + imgH + 38);

      // Optional color/texture chip text
      if (sm.color || sm.texture) {
        const chipText = [sm.color, sm.texture].filter(Boolean).join(' · ');
        doc.text(chipText, x + 6, y + imgH + 50, { maxWidth: cardW - 12 });
      }

      // Move y at end of each row
      if (col === cols - 1) y += cardH + gutter;
    }
    // Account for partial last row
    if ((selectedMaterials.length % cols) !== 0) y += cardH + gutter;

    y += 6;
  }

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

  // =============== DEPOSIT TO SCHEDULE ===============
  {
    const materialsCost = Number(quote.materialsCost || 0);
    const deliveryFee = Number(quote.deliveryFee || 0);
    const deposit = materialsCost + deliveryFee;

    if (deposit > 0) {
      if (y + 80 > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = margin;
      }
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(margin, y, contentWidth, 64, 4, 4, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, contentWidth, 64, 4, 4, 'S');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...CLOVER);
      doc.text('DEPOSIT TO SCHEDULE', margin + 16, y + 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...CHARCOAL);
      const depLeftX = margin + 16;
      const depRightX = pageWidth - margin - 16;

      let dY = y + 34;
      doc.setTextColor(...GRAY);
      doc.text(`Materials`, depLeftX, dY);
      doc.setTextColor(...CHARCOAL);
      doc.text(formatCurrency(materialsCost), depRightX, dY, { align: 'right' });

      dY += 12;
      doc.setTextColor(...GRAY);
      doc.text(`Delivery`, depLeftX, dY);
      doc.setTextColor(...CHARCOAL);
      doc.text(formatCurrency(deliveryFee), depRightX, dY, { align: 'right' });

      // Highlighted deposit total
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...CLOVER);
      doc.text(`Due to schedule:`, depLeftX + 200, dY);
      doc.text(formatCurrency(deposit), depRightX, dY, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += 80;
    }
  }

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

  // =============== HOW TO RESPOND (replaces signature/acceptance) ===============
  const materialsCost = Number(quote.materialsCost || 0);
  const deliveryFee = Number(quote.deliveryFee || 0);
  const deposit = materialsCost + deliveryFee;

  const stepsBoxHeight = 130;
  if (y + stepsBoxHeight + 30 > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    y = margin;
  }

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y, contentWidth, stepsBoxHeight, 4, 4, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, stepsBoxHeight, 4, 4, 'S');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CLOVER);
  doc.text('HOW TO RESPOND', margin + 16, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...CHARCOAL);

  const depositLine = deposit > 0
    ? `Tap "Looks good" on the link in your email/text to pay the ${formatCurrency(deposit)} deposit (materials${deliveryFee > 0 ? ' + delivery' : ''}) — that locks in your spot and we’ll reach out to schedule.`
    : 'Tap "Looks good" on the link in your email/text to accept the estimate, and we’ll reach out to schedule.';
  const changesLine = 'Want changes? Tap "Request changes" on the same link and tell us what to adjust or remove — we’ll send a revised estimate.';
  const cashLine = 'Prefer cash or check? Call (402) 405-5475 and we’ll arrange pickup or mailing — no need to send anything by mail unless we’ve coordinated it first.';

  let textY = y + 38;
  [depositLine, changesLine, cashLine].forEach((line, i) => {
    const wrapped = doc.splitTextToSize(line, contentWidth - 60);
    // bullet
    doc.setFillColor(...CLOVER);
    doc.circle(margin + 22, textY - 3, 1.6, 'F');
    doc.text(wrapped, margin + 32, textY);
    textY += wrapped.length * 12 + 4;
  });

  y += stepsBoxHeight + 18;

  // Public link (printed prominently if provided so paper-PDF readers can type it in)
  if (opts.publicLink) {
    if (y + 30 > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text('Review and respond online:', margin, y);
    y += 12;
    doc.setFontSize(9);
    doc.setTextColor(...CLOVER_DARK);
    doc.setFont('helvetica', 'bold');
    doc.textWithLink(opts.publicLink, margin, y, { url: opts.publicLink });
    doc.setFont('helvetica', 'normal');
    y += 16;
  }

  // =============== FOOTER ===============
  drawFooter(doc, co, pageWidth, margin);

  // =============== RETURN AS BASE64 OR OPEN IN TAB ===============
  return doc;
}

/**
 * Generate and open the PDF in a new browser tab.
 * (Original behavior — kept for the "PDF" button.)
 */
export async function generateQuotePdf(quote, customer, company = {}, opts = {}) {
  // Default the public link to the customer-facing /quote/[token] page when running in the browser
  const publicLink = opts.publicLink
    || (quote?.publicToken && typeof window !== 'undefined'
      ? `${window.location.origin}/quote/${quote.publicToken}`
      : '');
  const doc = await buildQuotePdf(quote, customer, company, { ...opts, publicLink });
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(new Blob([pdfBlob], { type: 'application/pdf' }));
  window.open(blobUrl, '_blank');
}

/**
 * Generate the PDF and return it as a Blob (for uploading to storage).
 */
export async function generateQuotePdfBlob(quote, customer, company = {}, opts = {}) {
  const publicLink = opts.publicLink
    || (quote?.publicToken && typeof window !== 'undefined'
      ? `${window.location.origin}/quote/${quote.publicToken}`
      : '');
  const doc = await buildQuotePdf(quote, customer, company, { ...opts, publicLink });
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
