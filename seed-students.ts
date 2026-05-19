import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./src/db/schema";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(turso, { schema });

  const dummyStudents = [
    {
      name: "Juan Perez",
      category: "2010/2011",
      guardianName: "Ricardo Perez",
      guardianPhone: "1122334455",
    },
    {
      name: "Mateo Garcia",
      category: "2012/2013",
      guardianName: "Laura Garcia",
      guardianPhone: "1133445566",
    },
    {
      name: "Santi Lopez",
      category: "2010/2011",
      guardianName: "Diego Lopez",
      guardianPhone: "1144556677",
    },
    {
      name: "Tiziano Rodriguez",
      category: "2014/2015",
      guardianName: "Maria Rodriguez",
      guardianPhone: "1155667788",
    },
    {
      name: "Joaquin Martinez",
      category: "2012/2013",
      guardianName: "Sonia Martinez",
      guardianPhone: "1166778899",
    },
    {
      name: "Nico Sanchez",
      category: "2014/2015",
      guardianName: "Pedro Sanchez",
      guardianPhone: "1177889900",
    },
    {
      name: "Facu Diaz",
      category: "Adultos",
      guardianName: "-",
      guardianPhone: "1188990011",
    },
    {
      name: "Leo Messi",
      category: "Adultos",
      guardianName: "-",
      guardianPhone: "1199001122",
    },
    {
      name: "Juli Alvarez",
      category: "2010/2011",
      guardianName: "Gustavo Alvarez",
      guardianPhone: "1100112233",
    },
    {
      name: "Enzo Fernandez",
      category: "2012/2013",
      guardianName: "Raul Fernandez",
      guardianPhone: "1111223344",
    },
  ];

  console.log("Sembrando alumnos de prueba...");

  for (const s of dummyStudents) {
    await db.insert(schema.students).values({
      id: crypto.randomUUID(),
      name: s.name,
      category: s.category,
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
      isActive: true,
    });
    console.log(`✅ Alumno ${s.name} creado.`);
  }

  console.log("Proceso terminado.");
  process.exit(0);
}

main().catch(console.error);
