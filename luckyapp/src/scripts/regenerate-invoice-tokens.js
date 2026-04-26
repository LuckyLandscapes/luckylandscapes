/**
 * One-off: regenerate invoice public_tokens with URL-safe hex.
 * Fixes a 404 on /pay/[token] caused by base64 tokens containing '/'.
 *
 * Run with:  node src/scripts/regenerate-invoice-tokens.js
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^(\w+)=(.*)/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

(async () => {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, public_token');

  if (error) { console.error(error); process.exit(1); }

  let fixed = 0;
  for (const inv of invoices) {
    // Only regenerate tokens that are missing or contain unsafe chars
    if (inv.public_token && !/[/+=]/.test(inv.public_token)) continue;
    const newToken = crypto.randomBytes(18).toString('hex');
    const { error: upErr } = await supabase
      .from('invoices')
      .update({ public_token: newToken })
      .eq('id', inv.id);
    if (upErr) console.error('failed', inv.id, upErr.message);
    else { fixed++; console.log(`✓ ${inv.id} → ${newToken}`); }
  }
  console.log(`\nRegenerated ${fixed} invoice token(s).`);
  process.exit(0);
})();
