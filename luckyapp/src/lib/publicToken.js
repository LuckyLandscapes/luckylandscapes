// Helpers for public-token endpoints (invoice payment links, signed contracts,
// shareable quotes). Tokens are minted by makeUrlSafeToken in data.js — 18
// random bytes encoded as hex, so they always look like 36 lowercase hex chars.

const TOKEN_RE = /^[a-f0-9]{32,72}$/i;

// True if the input could plausibly be one of our tokens. Use this to reject
// obviously-malformed input before hitting the DB so attackers can't fish via
// SQL-injection-shaped strings or short brute-force candidates.
export function isValidTokenShape(token) {
  if (typeof token !== 'string') return false;
  return TOKEN_RE.test(token);
}
