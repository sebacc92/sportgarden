import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Checking database...");
  const { data: schemas, error: schemasErr } = await supabase.rpc("get_schemas");
  if (schemasErr) {
    // If RPC is not available, let's try direct queries or SQL query via pg if we can, 
    // or query next_auth.users directly to see if it succeeds.
    console.log("RPC get_schemas failed/not defined, trying direct select on next_auth.users");
  } else {
    console.log("Schemas:", schemas);
  }

  const { data: publicUsers, error: publicUsersErr } = await supabase
    .from("users")
    .select("count", { count: "exact" });
  console.log("public.users query:", { publicUsers, error: publicUsersErr?.message });

  const { data: nextAuthUsers, error: nextAuthUsersErr } = await supabase
    .schema("next_auth")
    .from("users")
    .select("count", { count: "exact" });
  console.log("next_auth.users query:", { nextAuthUsers, error: nextAuthUsersErr?.message });
}

main().catch(console.error);
