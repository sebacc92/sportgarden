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

const bookingsData = [
  {"id":"2980022e-a76c-44b3-88b5-910016749ac2","user_id":"b7c5b7f8-a40a-4ac4-a390-b5a25bfb0ffa","pitch_id":"pitch-002","start_time":1780707600,"end_time":1780711200,"status":"PENDING_APPROVAL","total_price":95000,"paid_amount":0,"payment_status":"PENDING","created_at":1780665139,"preference_id":null,"payment_id":null,"extras":null,"group_id":null,"is_subscription":0,"payment_method":"MERCADO_PAGO","notes":null,"booking_type":"EVENTUAL"},
  {"id":"496251f6-1360-4487-ba51-905168803cb5","user_id":"b7c5b7f8-a40a-4ac4-a390-b5a25bfb0ffa","pitch_id":"pitch-004","start_time":1780707600,"end_time":1780711200,"status":"PENDING_APPROVAL","total_price":55000,"paid_amount":0,"payment_status":"PENDING","created_at":1780665455,"preference_id":null,"payment_id":null,"extras":null,"group_id":null,"is_subscription":0,"payment_method":"MERCADO_PAGO","notes":null,"booking_type":"EVENTUAL"},
  {"id":"9d11ebe0-b7f5-45cf-9aae-79a95a7fce1e","user_id":"b7c5b7f8-a40a-4ac4-a390-b5a25bfb0ffa","pitch_id":"pitch-001","start_time":1780707600,"end_time":1780711200,"status":"PENDING_APPROVAL","total_price":55000,"paid_amount":0,"payment_status":"PENDING","created_at":1780665673,"preference_id":null,"payment_id":null,"extras":null,"group_id":null,"is_subscription":0,"payment_method":"MERCADO_PAGO","notes":null,"booking_type":"EVENTUAL"},
  {"id":"9f4088ea-beb5-479e-93a9-dea6a8ab3a65","user_id":"b7c5b7f8-a40a-4ac4-a390-b5a25bfb0ffa","pitch_id":"pitch-003","start_time":1780707600,"end_time":1780711200,"status":"PENDING_APPROVAL","total_price":95000,"paid_amount":0,"payment_status":"PENDING","created_at":1780665113,"preference_id":null,"payment_id":null,"extras":null,"group_id":null,"is_subscription":0,"payment_method":"MERCADO_PAGO","notes":null,"booking_type":"EVENTUAL"},
  {"id":"ae7df50c-f291-40ef-b85e-7b7f342ec88a","user_id":"b7c5b7f8-a40a-4ac4-a390-b5a25bfb0ffa","pitch_id":"pitch-008","start_time":1780707600,"end_time":1780711200,"status":"PENDING_APPROVAL","total_price":100000,"paid_amount":0,"payment_status":"PENDING","created_at":1780665479,"preference_id":null,"payment_id":null,"extras":null,"group_id":null,"is_subscription":0,"payment_method":"MERCADO_PAGO","notes":null,"booking_type":"EVENTUAL"},
  {"id":"d7ca0703-c8aa-479f-ae12-ba9549b5e6f6","user_id":"b7c5b7f8-a40a-4ac4-a390-b5a25bfb0ffa","pitch_id":"pitch-006","start_time":1780707600,"end_time":1780711200,"status":"PENDING_APPROVAL","total_price":95000,"paid_amount":0,"payment_status":"PENDING","created_at":1780665247,"preference_id":null,"payment_id":null,"extras":null,"group_id":null,"is_subscription":0,"payment_method":"MERCADO_PAGO","notes":null,"booking_type":"EVENTUAL"},
  {"id":"f4c08b1b-013f-42c5-ab96-60111d75f417","user_id":"b7c5b7f8-a40a-4ac4-a390-b5a25bfb0ffa","pitch_id":"pitch-005","start_time":1780707600,"end_time":1780711200,"status":"PENDING_APPROVAL","total_price":95000,"paid_amount":0,"payment_status":"PENDING","created_at":1780665168,"preference_id":null,"payment_id":null,"extras":null,"group_id":null,"is_subscription":0,"payment_method":"MERCADO_PAGO","notes":null,"booking_type":"EVENTUAL"},
  {"id":"fc5bbac3-5112-4d0f-8979-b9c2d4a5b994","user_id":"b7c5b7f8-a40a-4ac4-a390-b5a25bfb0ffa","pitch_id":"pitch-007","start_time":1780707600,"end_time":1780711200,"status":"PENDING_APPROVAL","total_price":94997,"paid_amount":0,"payment_status":"PENDING","created_at":1780665212,"preference_id":null,"payment_id":null,"extras":null,"group_id":null,"is_subscription":0,"payment_method":"MERCADO_PAGO","notes":null,"booking_type":"EVENTUAL"}
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  console.log(`Migrating ${bookingsData.length} bookings to Supabase...`);

  for (const row of bookingsData) {
    const startTime = new Date(row.start_time * 1000);
    const endTime = new Date(row.end_time * 1000);
    const createdAt = row.created_at ? new Date(row.created_at * 1000) : new Date();
    const totalPrice = parseFloat(row.total_price || 0);
    const paidAmount = parseFloat(row.paid_amount || 0);
    const isSubscription = row.is_subscription === 1;
    const extras = row.extras ? JSON.stringify(row.extras) : null;

    console.log(`Inserting/Upserting booking ${row.id}...`);

    await sql`
      INSERT INTO bookings (
        id, user_id, pitch_id, start_time, end_time, status, total_price,
        paid_amount, payment_status, created_at, preference_id, payment_id,
        extras, group_id, is_subscription, payment_method, notes, booking_type
      ) VALUES (
        ${row.id}, ${row.user_id}, ${row.pitch_id}, ${startTime}, ${endTime}, ${row.status}, ${totalPrice},
        ${paidAmount}, ${row.payment_status}, ${createdAt}, ${row.preference_id}, ${row.payment_id},
        ${extras}, ${row.group_id}, ${isSubscription}, ${row.payment_method}, ${row.notes}, ${row.booking_type}
      )
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        pitch_id = EXCLUDED.pitch_id,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        status = EXCLUDED.status,
        total_price = EXCLUDED.total_price,
        paid_amount = EXCLUDED.paid_amount,
        payment_status = EXCLUDED.payment_status,
        created_at = EXCLUDED.created_at,
        preference_id = EXCLUDED.preference_id,
        payment_id = EXCLUDED.payment_id,
        extras = EXCLUDED.extras,
        group_id = EXCLUDED.group_id,
        is_subscription = EXCLUDED.is_subscription,
        payment_method = EXCLUDED.payment_method,
        notes = EXCLUDED.notes,
        booking_type = EXCLUDED.booking_type
    `;
  }

  console.log('Bookings migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Bookings migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
