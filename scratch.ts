import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./src/db/schema";
const client = createClient({ url: "file:local.db" });
const db = drizzle(client, { schema });
console.log(db.query.pitches.findMany({ with: { pricingRules: true } }).toSQL());
