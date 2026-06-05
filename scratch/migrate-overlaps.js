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

const overlapsData = [
  {"id":"6teyist9l","pitch_id":"pitch-009","overlap_pitch_id":"pitch-006"}
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log(`Migrating ${overlapsData.length} overlaps to Supabase...`);

  for (const row of overlapsData) {
    console.log(`Inserting/Upserting overlap ${row.id} for pitches: ${row.pitch_id} <-> ${row.overlap_pitch_id}...`);

    await sql`
      INSERT INTO pitch_overlaps (
        id, pitch_id, overlap_pitch_id
      ) VALUES (
        ${row.id}, ${row.pitch_id}, ${row.overlap_pitch_id}
      )
      ON CONFLICT (id) DO UPDATE SET
        pitch_id = EXCLUDED.pitch_id,
        overlap_pitch_id = EXCLUDED.overlap_pitch_id
    `;
  }

  console.log('Pitch overlaps migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Pitch overlaps migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
