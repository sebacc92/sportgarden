import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing in .env.local');
  process.exit(1);
}

console.log('Connecting to database via:', process.env.DATABASE_URL);

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require' });
const db = drizzle(sql);

try {
  console.log('Running migrations from ./drizzle folder...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations completed successfully!');
  await sql.end();
  process.exit(0);
} catch (err) {
  console.error('Migration failed:', err);
  await sql.end();
  process.exit(1);
}
