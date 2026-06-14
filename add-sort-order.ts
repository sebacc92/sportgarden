import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL environment variable is missing');
  }

  const sql = postgres(connectionString);
  console.log('Connecting to database and adding sort_order column...');

  try {
    await sql`
      ALTER TABLE pitches 
      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
    `;
    console.log('Column sort_order added successfully!');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
