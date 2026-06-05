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

const studentsData = [
  {
    "id": "523130c8-2ed2-46c6-8e3a-32f508bf1e84",
    "name": "Elias Singman",
    "birth_date": 1366329600,
    "guardian_name": "Ezequiel ",
    "guardian_phone": "1121778038",
    "guardian_email": null,
    "category": "2012",
    "is_active": 1,
    "created_at": 1779291717,
    "monthly_fee": 26000
  }
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log(`Migrating ${studentsData.length} students to Supabase...`);

  for (const row of studentsData) {
    const birthDate = row.birth_date ? new Date(row.birth_date * 1000) : null;
    const createdAt = row.created_at ? new Date(row.created_at * 1000) : new Date();
    const isActive = row.is_active === 1 || row.is_active === true;
    const monthlyFee = parseFloat(row.monthly_fee || 0);

    console.log(`Inserting/Upserting student: ${row.name} (${row.id})...`);

    await sql`
      INSERT INTO students (
        id, name, birth_date, guardian_name, guardian_phone, 
        guardian_email, category, monthly_fee, is_active, created_at
      ) VALUES (
        ${row.id}, ${row.name}, ${birthDate}, ${row.guardian_name}, ${row.guardian_phone}, 
        ${row.guardian_email}, ${row.category}, ${monthlyFee}, ${isActive}, ${createdAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        birth_date = EXCLUDED.birth_date,
        guardian_name = EXCLUDED.guardian_name,
        guardian_phone = EXCLUDED.guardian_phone,
        guardian_email = EXCLUDED.guardian_email,
        category = EXCLUDED.category,
        monthly_fee = EXCLUDED.monthly_fee,
        is_active = EXCLUDED.is_active,
        created_at = EXCLUDED.created_at
    `;
  }

  console.log('Students migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Students migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
