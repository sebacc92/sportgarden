import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { extendActiveSubscriptions } from "~/lib/admin/subscriptions";

/**
 * Weekly cron (see vercel.json) that tops up active fixed subscriptions so
 * they always have bookings generated up to the rolling horizon.
 */
export const onGet: RequestHandler = async (requestEvent) => {
  const { env, request, json } = requestEvent;

  // Security verification to ensure only authorized callers (e.g., Vercel Cron) can run this endpoint.
  const authHeader = request.headers.get("authorization");
  const cronSecret = env.get("CRON_SECRET");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    json(401, { error: "Unauthorized" });
    return;
  }

  try {
    const db = getDB(requestEvent);
    const summary = await extendActiveSubscriptions(db);
    json(200, { success: true, ...summary });
  } catch (err: any) {
    console.error("[cron/subscriptions] Failed to extend subscriptions:", err);
    json(500, { error: err?.message || "Internal error" });
  }
};
