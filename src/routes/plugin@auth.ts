import type { RequestHandler } from "@builder.io/qwik-city";
import { verifySessionJWT } from "~/lib/auth";

export const onRequest: RequestHandler = async ({ cookie, sharedMap }) => {
  const token = cookie.get("session")?.value;

  if (token) {
    const payload = await verifySessionJWT(token);
    if (payload) {
      sharedMap.set("user", payload);
    }
  }
};
