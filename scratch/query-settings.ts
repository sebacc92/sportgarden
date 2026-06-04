import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { siteSettings } from "../src/db/schema";
import { eq } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Missing TURSO_DATABASE_URL");
  process.exit(1);
}

const client = createClient({ url, authToken });
const db = drizzle(client);

async function main() {
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1));
  console.log("SiteSettings Row 1:", JSON.stringify(rows[0], null, 2));
  client.close();
}

main().catch(console.error);
