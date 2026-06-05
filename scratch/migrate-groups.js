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

const groupsData = [
  {"id":"fce51de3-59ea-4b8c-9ddf-64abf59a12a5","name":"Natalia","contact_name":"Daniela","contact_phone":"1124943939","contact_email":"","balance":0,"created_at":1780331862}
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log(`Migrating ${groupsData.length} groups to Supabase...`);

  for (const row of groupsData) {
    const createdAt = row.created_at ? new Date(row.created_at * 1000) : new Date();
    const balance = parseFloat(row.balance || 0);

    console.log(`Inserting/Upserting group: ${row.name} (${row.id})...`);

    await sql`
      INSERT INTO groups (
        id, name, contact_name, contact_phone, contact_email, balance, created_at
      ) VALUES (
        ${row.id}, ${row.name}, ${row.contact_name}, ${row.contact_phone}, ${row.contact_email}, ${balance}, ${createdAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        contact_name = EXCLUDED.contact_name,
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        balance = EXCLUDED.balance,
        created_at = EXCLUDED.created_at
    `;
  }

  console.log('Groups migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Groups migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
