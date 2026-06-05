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

const subscriptionData = [
  {
    "id": "716a4b5c-3554-4c3a-bf15-cba161612cfc",
    "student_id": "523130c8-2ed2-46c6-8e3a-32f508bf1e84",
    "month": 5,
    "year": 2026,
    "price": 26000,
    "status": "PAID",
    "due_date": 1781970117,
    "created_at": 1779291717
  }
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log(`Migrating ${subscriptionData.length} subscriptions to Supabase...`);

  for (const row of subscriptionData) {
    const dueDate = row.due_date ? new Date(row.due_date * 1000) : null;
    const createdAt = row.created_at ? new Date(row.created_at * 1000) : new Date();
    const price = parseFloat(row.price || 0);

    console.log(`Inserting/Upserting subscription ${row.id} for student: ${row.student_id}...`);

    await sql`
      INSERT INTO student_subscriptions (
        id, student_id, month, year, price, status, due_date, created_at
      ) VALUES (
        ${row.id}, ${row.student_id}, ${row.month}, ${row.year}, ${price}, ${row.status}, ${dueDate}, ${createdAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        student_id = EXCLUDED.student_id,
        month = EXCLUDED.month,
        year = EXCLUDED.year,
        price = EXCLUDED.price,
        status = EXCLUDED.status,
        due_date = EXCLUDED.due_date,
        created_at = EXCLUDED.created_at
    `;
  }

  console.log('Student subscriptions migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Student subscriptions migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
