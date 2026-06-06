import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const url = process.env.PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
  console.log("Supabase URL:", url);
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .limit(3);

  if (error) {
    console.error("Error fetching bookings:", error);
    return;
  }
  console.log("Bookings data:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
