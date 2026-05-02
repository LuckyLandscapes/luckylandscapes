'use client';

// Customer-facing material card. Hides every internal field — no cost, no
// supplier name, no SKU, no stock, no margins. Reused on:
//   - /catalog Customer view tab
//   - present mode (slideshow at the kitchen table)
//   - SelectMaterialsModal preview pane
//   - Quote PDF "Materials we'll use" section (rendered to PDF separately
//     but the visual contract matches this component)
//   - /quote/[token] public view
//   - /sign/[token] approval gallery

export default function CustomerCatalogCard({ material, size = 'md', showQuantity = false }) {
  if (!material) return null;
  const isLarge = size === 'lg';
  const m = material;

  return (
    <div className={`customer-card customer-card-${size}`}>
      <div className="customer-card-image" aria-hidden={!m.imageUrl}>
        {m.imageUrl ? (
          <img src={m.imageUrl} alt={m.name} loading="lazy" />
        ) : (
          <div className="customer-card-placeholder">
            <span style={{ fontSize: isLarge ? 64 : 40 }}>📦</span>
          </div>
        )}
      </div>
      <div className="customer-card-body">
        <div className="customer-card-name">{m.name}</div>
        {m.subcategory ? (
          <div className="customer-card-subcat">{m.category} · {m.subcategory}</div>
        ) : (
          <div className="customer-card-subcat">{m.category}</div>
        )}
        {m.description && <div className="customer-card-desc">{m.description}</div>}
        <div className="customer-card-chips">
          {m.color && <span className="chip chip-color">{m.color}</span>}
          {m.texture && <span className="chip chip-texture">{m.texture}</span>}
          {m.coveragePerUnit && <span className="chip chip-coverage">{m.coveragePerUnit}</span>}
        </div>
        {showQuantity && m.quantity != null && (
          <div className="customer-card-qty">{m.quantity} {m.unit}</div>
        )}
      </div>
    </div>
  );
}
