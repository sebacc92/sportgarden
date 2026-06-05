import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require' });

try {
  const result = await sql`SELECT role, name FROM users WHERE id = 'usr-seba-1778110113856'`;
  console.log('Query succeeded!', result);
  await sql.end();
  process.exit(0);
} catch (err) {
  console.error('Query failed with error:', err.message || err);
  await sql.end();
  process.exit(1);
}
