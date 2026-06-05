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

const mpData = [
  {
    "id": "1",
    "access_token": "APP_USR-1847962286621138-060412-68574ca09b105f97509dace85ea903b8-1039107355",
    "refresh_token": "TG-6a21aa4e2ba62300010de904-1039107355",
    "expires_at": 1796143182,
    "public_key": "APP_USR-c2ed3802-0e7a-4aae-ad32-9cb4e45e3652",
    "user_id": "1039107355",
    "live_mode": 1,
    "created_at": 1780591182,
    "updated_at": 1780591182
  }
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log(`Migrating ${mpData.length} credential records to Supabase...`);

  for (const row of mpData) {
    const expiresAt = new Date(row.expires_at * 1000);
    const createdAt = new Date(row.created_at * 1000);
    const updatedAt = new Date(row.updated_at * 1000);
    const liveMode = row.live_mode === 1 || row.live_mode === true;

    console.log(`Inserting/Upserting MP credentials for user_id: ${row.user_id}...`);

    await sql`
      INSERT INTO mercado_pago_credentials (
        id, access_token, refresh_token, expires_at, 
        public_key, user_id, live_mode, created_at, updated_at
      ) VALUES (
        ${row.id}, ${row.access_token}, ${row.refresh_token}, ${expiresAt}, 
        ${row.public_key}, ${row.user_id}, ${liveMode}, ${createdAt}, ${updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        public_key = EXCLUDED.public_key,
        user_id = EXCLUDED.user_id,
        live_mode = EXCLUDED.live_mode,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
    `;
  }

  console.log('Mercado Pago credentials migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Mercado Pago credentials migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
