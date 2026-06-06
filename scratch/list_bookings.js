import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ekcwhkdaphscxruyvoqj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrY3doa2RhcGhzY3hydXl2b3FqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYyMjAzNSwiZXhwIjoyMDk2MTk4MDM1fQ.zwwh5hhmyvso1SOCk7ijnrp03lNhO6UKGgwmJGsVuaY"; // Service role to bypass RLS

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, start_time, end_time, created_at, status')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching bookings:", error);
    return;
  }

  console.log("Recent Bookings:");
  console.log(JSON.stringify(data, null, 2));
}

run();
