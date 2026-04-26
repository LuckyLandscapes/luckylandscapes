/**
 * Apply migration 015 ALTER on public_token default.
 * Uses the Supabase SQL endpoint via service role.
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^(\w+)=(.*)/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

(async () => {
  // Supabase JS client doesn't expose raw DDL — print SQL the user can run manually
  // (and we already regenerated the tokens via the other script, so this is
  // just for the column default).
  const sql = `ALTER TABLE invoices ALTER COLUMN public_token SET DEFAULT encode(gen_random_bytes(18), 'hex');`;
  console.log('Run this SQL in Supabase SQL Editor → New Query:\n');
  console.log(sql);
  console.log('\nThis sets the default for NEW invoices. (Existing tokens were already regenerated.)');
  process.exit(0);
})();
