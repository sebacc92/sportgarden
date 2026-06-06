import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const url = process.env.PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key);

  // We can query the information_schema to find the data types of start_time and end_time
  const { data, error } = await supabase.rpc("inspect_table_columns", {});
  
  if (error) {
    // If RPC doesn't exist, we can try running a direct query via postgrest or inspect using a general select on PG catalogs if allowed.
    // Wait, let's just query pg_attribute and pg_type
    console.log("RPC inspect_table_columns not available, trying to check schema via SQL endpoint if we can or select a query.");
  }
  
  // Let's try select query for columns from information_schema.columns
  // Note that Postgrest doesn't allow raw SQL unless we use RPC, but we can query information_schema if exposed in API.
  // Wait, let's check if the table has start_time and end_time. Let's run a query to information_schema via standard Postgrest REST API:
  // Usually, Postgres schemas are not exposed via postgrest api unless in the search path.
  // Let's print the error or check if we can query.
  const { data: cols, error: colsErr } = await supabase
    .from("bookings")
    .select("start_time")
    .limit(1);
    
  console.log("Sample booking start_time:", cols);
  if (colsErr) console.error("Error:", colsErr);
}

main().catch(console.error);
