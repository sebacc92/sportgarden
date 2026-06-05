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

const chatSessionsData = [
  {"id":"sess-178046138481051h2iwp","created_at":1780461998,"last_active":1780462045},
  {"id":"sess-1780462149590i1snqa9","created_at":1780462162,"last_active":1780462464},
  {"id":"sess-1780462754432wi16b6e","created_at":1780462789,"last_active":1780462987}
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log(`Migrating ${chatSessionsData.length} chat sessions to Supabase...`);

  for (const row of chatSessionsData) {
    const createdAt = row.created_at ? new Date(row.created_at * 1000) : new Date();
    const lastActive = row.last_active ? new Date(row.last_active * 1000) : new Date();

    console.log(`Inserting/Upserting chat session: ${row.id}...`);

    await sql`
      INSERT INTO chat_sessions (
        id, created_at, last_active
      ) VALUES (
        ${row.id}, ${createdAt}, ${lastActive}
      )
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        last_active = EXCLUDED.last_active
    `;
  }

  console.log('Chat sessions migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Chat sessions migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
