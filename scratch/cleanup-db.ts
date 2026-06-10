import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log("🧹 Limpiando reservas y balances...\n");

  // 1. Borrar guest_requests (depende de bookings)
  const { error: e1, count: c1 } = await supabase
    .from("guest_requests")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // match all rows
  console.log(`guest_requests: ${e1 ? "❌ " + e1.message : "✅ eliminados"}`);

  // 2. Borrar group_transactions (depende de bookings y groups)
  const { error: e2 } = await supabase
    .from("group_transactions")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  console.log(`group_transactions: ${e2 ? "❌ " + e2.message : "✅ eliminados"}`);

  // 3. Borrar bookings
  const { error: e3 } = await supabase
    .from("bookings")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  console.log(`bookings: ${e3 ? "❌ " + e3.message : "✅ eliminados"}`);

  // 4. Resetear balance de los grupos a 0
  const { error: e4 } = await supabase
    .from("groups")
    .update({ balance: 0 })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  console.log(`groups balance reset: ${e4 ? "❌ " + e4.message : "✅ reseteados a 0"}`);

  // Verificar
  console.log("\n📊 Verificación:");
  const { count: bookingsCount } = await supabase.from("bookings").select("*", { count: "exact", head: true });
  const { count: guestCount } = await supabase.from("guest_requests").select("*", { count: "exact", head: true });
  const { count: txCount } = await supabase.from("group_transactions").select("*", { count: "exact", head: true });
  const { data: groupsData } = await supabase.from("groups").select("name, balance");

  console.log(`  bookings: ${bookingsCount}`);
  console.log(`  guest_requests: ${guestCount}`);
  console.log(`  group_transactions: ${txCount}`);
  console.log(`  groups:`, groupsData?.map((g: any) => `${g.name} (balance: ${g.balance})`).join(", ") || "ninguno");

  console.log("\n✅ Limpieza completada!");
}

cleanup().catch(console.error);
