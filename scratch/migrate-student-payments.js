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

const paymentData = [
  {
    "id": "424d27a6-eb0b-4409-8075-6f6ecd3e558f",
    "subscription_id": "716a4b5c-3554-4c3a-bf15-cba161612cfc",
    "amount": 26000,
    "payment_method": "CASH",
    "payment_date": 1779291717
  }
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log(`Migrating ${paymentData.length} payments to Supabase...`);

  for (const row of paymentData) {
    const paymentDate = row.payment_date ? new Date(row.payment_date * 1000) : new Date();
    const amount = parseFloat(row.amount || 0);

    console.log(`Inserting/Upserting student payment ${row.id} for subscription: ${row.subscription_id}...`);

    await sql`
      INSERT INTO student_payments (
        id, subscription_id, amount, payment_method, payment_date
      ) VALUES (
        ${row.id}, ${row.subscription_id}, ${amount}, ${row.payment_method}, ${paymentDate}
      )
      ON CONFLICT (id) DO UPDATE SET
        subscription_id = EXCLUDED.subscription_id,
        amount = EXCLUDED.amount,
        payment_method = EXCLUDED.payment_method,
        payment_date = EXCLUDED.payment_date
    `;
  }

  console.log('Student payments migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Student payments migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
