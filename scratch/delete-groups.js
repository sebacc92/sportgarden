import { config } from "dotenv";
import { createClient } from "@libsql/client";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runDeleteGroups() {
  console.log("Iniciando eliminación de cuentas corrientes (groups) en Turso...");
  try {
    // 1. Eliminar group_transactions por seguridad (clave foránea)
    const delTransactions = await client.execute("DELETE FROM group_transactions");
    console.log(`✓ Transacciones de cuenta corriente eliminadas (${delTransactions.rowsAffected} filas afectadas)`);

    // 2. Eliminar groups
    const delGroups = await client.execute("DELETE FROM groups");
    console.log(`✓ Cuentas corrientes (groups) eliminadas (${delGroups.rowsAffected} filas afectadas)`);

    console.log("¡Eliminación completada con éxito!");
  } catch (error) {
    console.error("Error durante la eliminación de cuentas corrientes:", error);
  } finally {
    client.close();
  }
}

runDeleteGroups();
