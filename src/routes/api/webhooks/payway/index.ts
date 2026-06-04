import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { bookings, transactions, cashSessions } from "~/db/schema";
import { eq } from "drizzle-orm";
import { processPaywayWebhook } from "~/lib/payway";

/**
 * POST /api/webhooks/payway
 * 
 * Webhook endpoint to handle asynchronous payment notifications from Payway / Decidir.
 * It processes the payment result, marks the booking as confirmed, and records the cash register transaction.
 */
export const onPost: RequestHandler = async (requestEvent) => {
  console.log("[Webhook Payway] Received incoming notification request.");

  // 1. Extract and parse request body safely
  const payload = await requestEvent.request.json().catch((parseError) => {
    console.error("[Webhook Payway] Error parsing JSON body:", parseError);
    return null;
  });

  if (!payload) {
    requestEvent.status(400);
    requestEvent.json(400, { success: false, error: "Invalid JSON payload" });
    return;
  }

  try {
    // 2. Process webhook payload via the helper service
    const result = await processPaywayWebhook(payload);

    if (!result.success || !result.bookingId) {
      console.warn("[Webhook Payway] Webhook skipped or invalid status:", result);
      requestEvent.status(200);
      requestEvent.json(200, { success: true, message: "Webhook skipped or invalid status" });
      return;
    }

    const bookingId = result.bookingId;
    const paymentId = payload?.id?.toString() || payload?.site_transaction_id || "PAYWAY_TX";
    const amount = Number(payload?.amount || 0);

    console.log(`[Webhook Payway] Updating booking ${bookingId} with payment ID ${paymentId} and amount ${amount}`);

    const db = getDB(requestEvent);

    // 3. Update the booking status in Turso DB
    const updatedBookings = await db
      .update(bookings)
      .set({
        status: "CONFIRMED",
        paymentStatus: "PAID",
        paidAmount: amount,
        paymentId: paymentId,
        paymentMethod: "PAYWAY",
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    if (updatedBookings.length === 0) {
      console.error(`[Webhook Payway] Booking with ID '${bookingId}' not found in Turso DB.`);
      requestEvent.status(404);
      requestEvent.json(404, { success: false, error: "Booking not found" });
      return;
    }

    console.log(`[Webhook Payway] Booking '${bookingId}' successfully confirmed in Turso database.`);

    // 4. Log the digital transaction in the cash session
    try {
      const openSession = await db.query.cashSessions.findFirst({
        where: eq(cashSessions.status, "OPEN"),
      });

      await db.insert(transactions).values({
        id: crypto.randomUUID(),
        cashSessionId: openSession ? openSession.id : null,
        type: "INCOME",
        category: "RESERVA_PAYWAY",
        amount: amount,
        description: `Pago digital Payway - Reserva: ${bookingId.slice(0, 8)}`,
        paymentMethod: "PAYWAY",
        referenceId: bookingId,
      });
      console.log(`[Webhook Payway] Digital transaction successfully recorded with session ID: ${openSession ? openSession.id : 'NULL'}`);
    } catch (e) {
      console.error(`[Webhook Payway] Error logging transaction:`, e);
    }

    // 5. Successful Webhook Processing Response
    requestEvent.status(200);
    requestEvent.json(200, { success: true });
  } catch (error: any) {
    console.error("[Webhook Payway] Error during webhook processing:", error);
    requestEvent.status(500);
    requestEvent.json(500, {
      success: false,
      error: "Internal server error during payment verification",
      details: error?.message || error,
    });
  }
};

// Support any method request for maximum compatibility
export const onRequest = onPost;
