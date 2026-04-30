// Concatenate captions and transcripts from a quote's media items into a
// single block of text the estimator can drop into the quote's Notes field
// instead of retyping what they already said during the walkthrough.
//
// Items are emitted in upload order (oldest first) so the summary reads
// like a sequential walk-through. Items with neither caption nor transcript
// are skipped — no useful prose to surface.

const LABEL = {
  image: 'Photo',
  video: 'Video',
  audio: 'Voice memo',
};

export function buildQuoteMediaSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return '';

  // Oldest first — reads top-to-bottom in walk-through order.
  const ordered = [...items].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return ta - tb;
  });

  const lines = [];
  for (const item of ordered) {
    const caption = (item.caption || '').trim();
    const transcript = (item.transcript || '').trim();
    if (!caption && !transcript) continue;

    const label = LABEL[item.mediaType] || 'Note';
    const head = caption || transcript;
    lines.push(`• ${label}: ${head}`);
    if (caption && transcript) {
      lines.push(`    ${transcript}`);
    }
  }

  if (lines.length === 0) return '';
  return `Walkthrough notes:\n${lines.join('\n')}`;
}
