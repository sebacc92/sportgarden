import postgres from 'postgres';
import fs from 'fs';

// Read .env.local manually to get Supabase URL
const envContent = fs.readFileSync('.env.local', 'utf-8');

function getEnvVar(name) {
  const regex = new RegExp(`^(?:#\\s*)?${name}=(?:"([^"]*)"|'([^']*)'|([^\\s#]+))`, 'm');
  const match = envContent.match(regex);
  if (!match) return null;
  return match[1] || match[2] || match[3] || null;
}

const supabaseUrl = getEnvVar('DATABASE_URL');

if (!supabaseUrl) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

const cashSessionsData = [
  {"id":"58ea96da-f072-47c8-8caf-e4a3c71e9363","opened_at":1780668480,"closed_at":null,"status":"OPEN","opened_by":null,"closed_by":null}
];

const cashRegistersData = [
  {"id":"58ea96da-f072-47c8-8caf-e4a3c71e9363","opened_at":1780668480,"closed_at":null,"opening_balance":10,"closing_balance":null,"status":"OPEN","opened_by":null,"closed_by":null,"bill_count":null,"notes":null}
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log(`Migrating ${cashSessionsData.length} cash sessions to Supabase...`);
  for (const row of cashSessionsData) {
    const openedAt = row.opened_at ? new Date(row.opened_at * 1000) : new Date();
    const closedAt = row.closed_at ? new Date(row.closed_at * 1000) : null;

    console.log(`Inserting/Upserting cash session: ${row.id}...`);
    await sql`
      INSERT INTO cash_sessions (
        id, opened_at, closed_at, status, opened_by, closed_by
      ) VALUES (
        ${row.id}, ${openedAt}, ${closedAt}, ${row.status}, ${row.opened_by}, ${row.closed_by}
      )
      ON CONFLICT (id) DO UPDATE SET
        opened_at = EXCLUDED.opened_at,
        closed_at = EXCLUDED.closed_at,
        status = EXCLUDED.status,
        opened_by = EXCLUDED.opened_by,
        closed_by = EXCLUDED.closed_by
    `;
  }

  console.log(`Migrating ${cashRegistersData.length} cash registers to Supabase...`);
  for (const row of cashRegistersData) {
    const openedAt = row.opened_at ? new Date(row.opened_at * 1000) : new Date();
    const closedAt = row.closed_at ? new Date(row.closed_at * 1000) : null;
    const openingBalance = parseFloat(row.opening_balance || 0);
    const closingBalance = row.closing_balance !== null ? parseFloat(row.closing_balance) : null;
    const billCount = row.bill_count ? JSON.stringify(row.bill_count) : null;

    console.log(`Inserting/Upserting cash register: ${row.id}...`);
    await sql`
      INSERT INTO cash_registers (
        id, opened_at, closed_at, opening_balance, closing_balance, status, opened_by, closed_by, bill_count, notes
      ) VALUES (
        ${row.id}, ${openedAt}, ${closedAt}, ${openingBalance}, ${closingBalance}, ${row.status}, ${row.opened_by}, ${row.closed_by}, ${billCount}, ${row.notes}
      )
      ON CONFLICT (id) DO UPDATE SET
        opened_at = EXCLUDED.opened_at,
        closed_at = EXCLUDED.closed_at,
        opening_balance = EXCLUDED.opening_balance,
        closing_balance = EXCLUDED.closing_balance,
        status = EXCLUDED.status,
        opened_by = EXCLUDED.opened_by,
        closed_by = EXCLUDED.closed_by,
        bill_count = EXCLUDED.bill_count,
        notes = EXCLUDED.notes
    `;
  }

  console.log('Cash management tables migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Cash management migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
