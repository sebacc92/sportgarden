import { config } from "dotenv";
import { createClient } from "@libsql/client";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runDeleteRegisters() {
  console.log("Iniciando eliminación del historial de cajas en Turso...");
  try {
    const delRegisters = await client.execute("DELETE FROM cash_registers");
    console.log(`✓ Historial de cajas (cash_registers) eliminado (${delRegisters.rowsAffected} filas afectadas)`);

    console.log("¡Eliminación completada con éxito!");
  } catch (error) {
    console.error("Error durante la eliminación del historial de cajas:", error);
  } finally {
    client.close();
  }
}

runDeleteRegisters();
