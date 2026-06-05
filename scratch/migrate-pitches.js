import { createClient } from '@libsql/client';
import postgres from 'postgres';
import fs from 'fs';

// Read .env.local manually to get Turso and Supabase URLs
const envContent = fs.readFileSync('.env.local', 'utf-8');

function getEnvVar(name) {
  const regex = new RegExp(`^(?:#\\s*)?${name}=(?:"([^"]*)"|'([^']*)'|([^\\s#]+))`, 'm');
  const match = envContent.match(regex);
  if (!match) return null;
  return match[1] || match[2] || match[3] || null;
}

const tursoUrl = getEnvVar('TURSO_DATABASE_URL');
const tursoToken = getEnvVar('TURSO_AUTH_TOKEN');
const supabaseUrl = getEnvVar('DATABASE_URL');

if (!tursoUrl || !supabaseUrl) {
  console.error('Missing Turso or Supabase credentials in .env.local');
  process.exit(1);
}

console.log('Connecting to Turso:', tursoUrl);
const turso = createClient({
  url: tursoUrl,
  authToken: tursoToken || undefined,
});

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log('Fetching pitches from Turso...');
  const result = await turso.execute('SELECT * FROM pitches');
  const pitches = result.rows;
  console.log(`Found ${pitches.length} pitches in Turso.`);

  if (pitches.length === 0) {
    console.log('No pitches to migrate.');
    process.exit(0);
  }

  console.log('Migrating pitches to Supabase...');
  for (const row of pitches) {
    // SQLite boolean values are 0 or 1, map them to boolean for PG
    const mappedRow = {
      id: row.id,
      name: row.name,
      type: row.type,
      is_covered: row.is_covered === 1 || row.is_covered === true,
      is_lit: row.is_lit === 1 || row.is_lit === true,
      price_per_hour: parseFloat(row.price_per_hour || 0),
      peak_hour_start: row.peak_hour_start || null,
      peak_price_per_hour: row.peak_price_per_hour !== null && row.peak_price_per_hour !== undefined ? parseFloat(row.peak_price_per_hour) : null,
      deposit_type: row.deposit_type || 'PERCENTAGE',
      deposit_amount: parseFloat(row.deposit_amount || 0),
      notes: row.notes || null,
      is_active: row.is_active === 1 || row.is_active === true,
      image_url: row.image_url || null,
      sport: row.sport || 'Fútbol',
      surface: row.surface || 'Sintético'
    };

    console.log(`Inserting pitch: ${mappedRow.name} (${mappedRow.id})...`);
    
    await sql`
      INSERT INTO pitches (
        id, name, type, is_covered, is_lit, price_per_hour, 
        peak_hour_start, peak_price_per_hour, deposit_type, 
        deposit_amount, notes, is_active, image_url, sport, surface
      ) VALUES (
        ${mappedRow.id}, ${mappedRow.name}, ${mappedRow.type}, 
        ${mappedRow.is_covered}, ${mappedRow.is_lit}, ${mappedRow.price_per_hour}, 
        ${mappedRow.peak_hour_start}, ${mappedRow.peak_price_per_hour}, ${mappedRow.deposit_type}, 
        ${mappedRow.deposit_amount}, ${mappedRow.notes}, ${mappedRow.is_active}, 
        ${mappedRow.image_url}, ${mappedRow.sport}, ${mappedRow.surface}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        is_covered = EXCLUDED.is_covered,
        is_lit = EXCLUDED.is_lit,
        price_per_hour = EXCLUDED.price_per_hour,
        peak_hour_start = EXCLUDED.peak_hour_start,
        peak_price_per_hour = EXCLUDED.peak_price_per_hour,
        deposit_type = EXCLUDED.deposit_type,
        deposit_amount = EXCLUDED.deposit_amount,
        notes = EXCLUDED.notes,
        is_active = EXCLUDED.is_active,
        image_url = EXCLUDED.image_url,
        sport = EXCLUDED.sport,
        surface = EXCLUDED.surface
    `;
  }

  console.log('Migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
