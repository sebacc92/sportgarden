import type { RequestEventBase } from "@builder.io/qwik-city";
import { createClient, type Client } from "@libsql/client";

export function tursoClient(requestEvent: RequestEventBase): Client {
  const url = requestEvent.env.get("TURSO_DATABASE_URL")?.trim();
  if (url === undefined) {
    // During build-time SSG, requestEvent.env might not have database variables.
    // Return a local in-memory client to prevent build/SSG crashes.
    return createClient({
      url: "file::memory:",
    });
  }

  const authToken = requestEvent.env.get("TURSO_AUTH_TOKEN")?.trim();
  if (authToken === undefined) {
    if (!url.includes("file:")) {
      throw new Error("TURSO_DATABASE_URL is not defined");
    }
  }

  return createClient({
    url,
    authToken,
  });
}
