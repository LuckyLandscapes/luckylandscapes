// Tappable address. Renders an address as a link that opens the maps app with
// the location pre-filled and ready to navigate. Drops to plain text (or null)
// when there's no address to link. Presentational only — no hooks — so it works
// inside both client and server components.
//
// Usage:
//   <AddressLink address={job.address} />                       // single string
//   <AddressLink {...customer} />                               // { address, city, state, zip }
//   <AddressLink {...customer} multiline />                     // street on line 1, city/state/zip on line 2
//   <AddressLink query={fullAddr}>{c.city}, {c.state}</AddressLink>  // custom display, full address as the maps query

import { formatAddress, mapsHref } from '@/lib/addressLink';

export default function AddressLink({
  address,
  city,
  state,
  zip,
  query,            // optional: the string to search in maps, when it differs from what's displayed
  multiline = false,
  className = '',
  style,
  children,         // optional: custom display content (e.g. just "Lincoln, NE")
  stopPropagation = true,
  ...rest
}) {
  const full = formatAddress({ address, city, state, zip });
  const search = query || full;
  const href = mapsHref(search);

  // Nothing to link — render whatever display was provided, or nothing.
  if (!href) return children != null ? children : (full || null);

  let display = children;
  if (display == null) {
    if (multiline && (city || state || zip)) {
      const cityState = [city, state].filter(Boolean).join(', ');
      const line2 = [cityState, zip].filter(Boolean).join(' ').trim();
      display = (
        <>
          {address}
          {address && line2 ? <br /> : null}
          {line2}
        </>
      );
    } else {
      display = full;
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Maps"
      className={`address-link ${className}`.trim()}
      style={style}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      {...rest}
    >
      {display}
    </a>
  );
}
