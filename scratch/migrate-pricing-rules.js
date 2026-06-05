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

const rulesData = [
  {"id":"00miqbyr1","pitch_id":"pitch-008","day_of_week":4,"start_time":"18:00","end_time":"23:00","price":100000},{"id":"0nqgptea3","pitch_id":"pitch-002","day_of_week":6,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"1h6kjfy74","pitch_id":"pitch-006","day_of_week":2,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"1iqn3m9xo","pitch_id":"pitch-002","day_of_week":7,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"1rvgjcot8","pitch_id":"pitch-007","day_of_week":3,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"2nm5v5tkr","pitch_id":"pitch-002","day_of_week":2,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"33e3n5jvb","pitch_id":"pitch-005","day_of_week":7,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"3d5f8b9i1","pitch_id":"pitch-007","day_of_week":5,"start_time":"18:00","end_time":"23:00","price":94997},{"id":"3kvxdm22w","pitch_id":"pitch-007","day_of_week":7,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"3vwe1luc6","pitch_id":"pitch-009","day_of_week":7,"start_time":"00:00","end_time":"23:00","price":170000},{"id":"3ylkvymy0","pitch_id":"pitch-009","day_of_week":5,"start_time":"00:00","end_time":"23:00","price":200000},{"id":"43i6es3mj","pitch_id":"pitch-008","day_of_week":5,"start_time":"18:00","end_time":"23:00","price":100000},{"id":"46jhnimje","pitch_id":"pitch-004","day_of_week":0,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"4gqr0nzt4","pitch_id":"pitch-004","day_of_week":2,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"52wbvkot1","pitch_id":"pitch-006","day_of_week":4,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"5hkcdt63t","pitch_id":"pitch-005","day_of_week":2,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"6lkeev1y5","pitch_id":"pitch-004","day_of_week":4,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"6pgdhhbgm","pitch_id":"pitch-009","day_of_week":0,"start_time":"00:00","end_time":"23:00","price":170000},{"id":"735wc1l5j","pitch_id":"pitch-004","day_of_week":7,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"8pg7hpcxo","pitch_id":"pitch-009","day_of_week":2,"start_time":"00:00","end_time":"23:00","price":200000},{"id":"9k04832k1","pitch_id":"pitch-003","day_of_week":5,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"9n5ja9rly","pitch_id":"pitch-005","day_of_week":1,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"9zks8cmzf","pitch_id":"pitch-005","day_of_week":6,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"a9n7hrjly","pitch_id":"pitch-005","day_of_week":0,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"bc1qq8wp3","pitch_id":"pitch-006","day_of_week":0,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"btga70g97","pitch_id":"pitch-008","day_of_week":7,"start_time":"00:00","end_time":"23:00","price":85000},{"id":"ck17jbxtf","pitch_id":"pitch-001","day_of_week":0,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"cy0rv3mfm","pitch_id":"pitch-003","day_of_week":1,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"dyees20xz","pitch_id":"pitch-002","day_of_week":0,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"eaegitzye","pitch_id":"pitch-004","day_of_week":1,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"eaz7qnymr","pitch_id":"pitch-007","day_of_week":0,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"ei1bok923","pitch_id":"pitch-001","day_of_week":6,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"f1t8g5kzk","pitch_id":"pitch-001","day_of_week":7,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"fqgz4mj2o","pitch_id":"pitch-002","day_of_week":5,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"gll1drk9c","pitch_id":"pitch-003","day_of_week":4,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"gnbs1tlms","pitch_id":"pitch-002","day_of_week":4,"start_time":"18:00","end_time":"23:00","price":94997},{"id":"gte43qjf4","pitch_id":"pitch-007","day_of_week":1,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"ifkehwfpr","pitch_id":"pitch-003","day_of_week":6,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"j72ong4t9","pitch_id":"pitch-006","day_of_week":3,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"j7tzgd5sl","pitch_id":"pitch-001","day_of_week":3,"start_time":"18:00","end_time":"19:00","price":95000},{"id":"jk0dod35f","pitch_id":"pitch-009","day_of_week":6,"start_time":"00:00","end_time":"23:00","price":170000},{"id":"knpwc4eod","pitch_id":"pitch-009","day_of_week":4,"start_time":"00:00","end_time":"23:00","price":200000},{"id":"lh12lq5f0","pitch_id":"pitch-002","day_of_week":3,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"lh12lq5f0","pitch_id":"pitch-002","day_of_week":3,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"lx10kl6p2","pitch_id":"pitch-007","day_of_week":6,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"m69x0gyef","pitch_id":"pitch-009","day_of_week":1,"start_time":"00:00","end_time":"23:00","price":200000},{"id":"mjavf4evl","pitch_id":"pitch-007","day_of_week":2,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"mum4cpi8v","pitch_id":"pitch-001","day_of_week":1,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"oicncymu8","pitch_id":"pitch-007","day_of_week":4,"start_time":"18:00","end_time":"23:00","price":94997},{"id":"ovkwv066l","pitch_id":"pitch-005","day_of_week":3,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"p37kivw83","pitch_id":"pitch-002","day_of_week":1,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"p3b6hfidf","pitch_id":"pitch-003","day_of_week":0,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"pknq64uoz","pitch_id":"pitch-009","day_of_week":3,"start_time":"00:00","end_time":"23:00","price":200000},{"id":"pq29nmlai","pitch_id":"pitch-008","day_of_week":1,"start_time":"18:00","end_time":"23:00","price":100000},{"id":"ptpf7b90v","pitch_id":"pitch-005","day_of_week":4,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"qydzfnvqo","pitch_id":"pitch-001","day_of_week":4,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"rai04ey7b","pitch_id":"pitch-008","day_of_week":6,"start_time":"00:00","end_time":"23:00","price":85000},{"id":"rfvjgrkxa","pitch_id":"pitch-001","day_of_week":2,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"s2eb7kupm","pitch_id":"pitch-006","day_of_week":5,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"shzyri8as","pitch_id":"pitch-006","day_of_week":6,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"t69pmm1pq","pitch_id":"pitch-003","day_of_week":2,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"tcqygl6g8","pitch_id":"pitch-001","day_of_week":5,"start_time":"18:00","end_time":"19:00","price":95000},{"id":"tsudz0t87","pitch_id":"pitch-005","day_of_week":5,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"uhsfxha4z","pitch_id":"pitch-003","day_of_week":3,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"vlyqbmebp","pitch_id":"pitch-008","day_of_week":3,"start_time":"18:00","end_time":"23:00","price":100000},{"id":"wqrmhbuyo","pitch_id":"pitch-008","day_of_week":0,"start_time":"00:00","end_time":"23:00","price":85000},{"id":"wy86s2q8d","pitch_id":"pitch-004","day_of_week":6,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"xiizl8e5d","pitch_id":"pitch-003","day_of_week":7,"start_time":"00:00","end_time":"23:00","price":80000},{"id":"y4f9a9ggo","pitch_id":"pitch-006","day_of_week":1,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"yeun3klv2","pitch_id":"pitch-004","day_of_week":5,"start_time":"18:00","end_time":"23:00","price":55000},{"id":"ygev3qke2","pitch_id":"pitch-008","day_of_week":2,"start_time":"18:00","end_time":"23:00","price":100000},{"id":"ysmkplbqb","pitch_id":"pitch-004","day_of_week":3,"start_time":"18:00","end_time":"23:00","price":95000},{"id":"zsqg9bfex","pitch_id":"pitch-006","day_of_week":7,"start_time":"00:00","end_time":"23:00","price":80000}
];

console.log('Connecting to Supabase...');
const sql = postgres(supabaseUrl, { prepare: false, ssl: 'require' });

try {
  // Deduplicate items just in case (e.g. lh12lq5f0 has a duplicate in the JSON)
  const uniqueRulesMap = new Map();
  for (const rule of rulesData) {
    uniqueRulesMap.set(rule.id, rule);
  }
  const uniqueRules = Array.from(uniqueRulesMap.values());

  console.log(`Migrating ${uniqueRules.length} pricing rules to Supabase...`);

  // We can insert them in batches for high speed
  const batchSize = 50;
  for (let i = 0; i < uniqueRules.length; i += batchSize) {
    const chunk = uniqueRules.slice(i, i + batchSize);
    console.log(`Inserting batch ${i / batchSize + 1} (${chunk.length} rules)...`);
    
    for (const row of chunk) {
      const price = parseFloat(row.price || 0);
      const dayOfWeek = parseInt(row.day_of_week);

      await sql`
        INSERT INTO pitch_pricing_rules (
          id, pitch_id, day_of_week, start_time, end_time, price
        ) VALUES (
          ${row.id}, ${row.pitch_id}, ${dayOfWeek}, ${row.start_time}, ${row.end_time}, ${price}
        )
        ON CONFLICT (id) DO UPDATE SET
          pitch_id = EXCLUDED.pitch_id,
          day_of_week = EXCLUDED.day_of_week,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          price = EXCLUDED.price
      `;
    }
  }

  console.log('Pitch pricing rules migration completed successfully!');
  process.exit(0);
} catch (err) {
  console.error('Pitch pricing rules migration failed:', err);
  process.exit(1);
} finally {
  await sql.end();
}
