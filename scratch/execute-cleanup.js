import { config } from "dotenv";
import { createClient } from "@libsql/client";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runCleanup() {
  console.log("Iniciando eliminación de datos en Turso...");
  try {
    // 1. Eliminar guest_requests
    const delGuests = await client.execute("DELETE FROM guest_requests");
    console.log(`✓ Solicitudes de invitados (guest_requests) eliminadas (${delGuests.rowsAffected} filas afectadas)`);

    // 2. Eliminar group_transactions
    const delGroupTrans = await client.execute("DELETE FROM group_transactions");
    console.log(`✓ Transacciones de grupo (group_transactions) eliminadas (${delGroupTrans.rowsAffected} filas afectadas)`);

    // 3. Eliminar bookings
    const delBookings = await client.execute("DELETE FROM bookings");
    console.log(`✓ Reservas (bookings) eliminadas (${delBookings.rowsAffected} filas afectadas)`);

    // 4. Eliminar cash_movements
    const delMovements = await client.execute("DELETE FROM cash_movements");
    console.log(`✓ Movimientos de caja (cash_movements) eliminados (${delMovements.rowsAffected} filas afectadas)`);

    console.log("¡Limpieza completada con éxito!");
  } catch (error) {
    console.error("Error durante la limpieza:", error);
  } finally {
    client.close();
  }
}

runCleanup();
