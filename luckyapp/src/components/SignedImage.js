'use client';

// Drop-in replacement for <img src={storedUrl}> where the URL may point at a
// now-private Storage bucket. It resolves the stored URL to a short-lived signed
// URL (see src/lib/signedStorage.js) before rendering. For public/external URLs
// it renders immediately. While resolving it shows `fallback` (default: nothing).

import { useState, useEffect } from 'react';
import { resolveStorageUrl } from '@/lib/signedStorage';

export default function SignedImage({ src, fallback = null, ...rest }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!src) { setUrl(null); return; }
    resolveStorageUrl(src).then((resolved) => { if (alive) setUrl(resolved); });
    return () => { alive = false; };
  }, [src]);

  if (!url) return fallback;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} {...rest} />;
}
