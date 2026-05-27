// Polyfill process properties for Vercel Edge Runtime compatibility with Mercado Pago SDK
if (typeof process === "undefined") {
  (globalThis as any).process = {
    env: {},
    version: "v20.0.0",
    versions: { node: "20.0.0" },
    arch: "x64",
    platform: "linux",
  };
} else {
  if (!process.version) {
    (process as any).version = "v20.0.0";
  }
  if (!process.arch) {
    (process as any).arch = "x64";
  }
  if (!process.platform) {
    (process as any).platform = "linux";
  }
}

// Polyfill global Headers prototype for compatibility with node-fetch's raw() method
if (typeof globalThis.Headers !== "undefined" && !(globalThis.Headers.prototype as any).raw) {
  (globalThis.Headers.prototype as any).raw = function () {
    const rawHeaders: Record<string, string[]> = {};
    this.forEach((value: string, name: string) => {
      rawHeaders[name] = value.split(",").map((v) => v.trim());
    });
    return rawHeaders;
  };
}

import type { RequestHandler } from "@builder.io/qwik-city";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { getDB } from "~/db";
import { bookings, transactions, cashSessions } from "~/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/webhook/mercadopago
 * 
 * Webhook/IPN endpoint to handle asynchronous payment notifications from Mercado Pago.
 * Adheres to Zero-Trust architecture by validating all payloads directly with the Mercado Pago API
 * using the official SDK and server-side secret credentials.
 */
export const onPost: RequestHandler = async (requestEvent) => {
  console.log("[Webhook MP] Received incoming notification request.");

  let payload: any = null;

  // 1. Safe extraction and parsing of the request body
  try {
    const rawBody = await requestEvent.request.text();
    if (!rawBody || rawBody.trim() === "") {
      console.warn("[Webhook MP] Warning: Empty body received.");
    } else {
      payload = JSON.parse(rawBody);
    }
  } catch (parseError: any) {
    console.error("[Webhook MP] Error parsing JSON body:", parseError);
    // If the body is malformed or not valid JSON, return 400 Bad Request to halt invalid retries
    requestEvent.status(400);
    requestEvent.json(400, { success: false, error: "Invalid JSON payload" });
    return;
  }

  // Fallback to empty object if body is null or undefined to avoid runtime type crashes
  const body = payload || {};

  // 2. Identify the resource type and payment ID using Multi-channel search (IPN vs Webhook)
  // Mercado Pago sends notifications in two formats:
  // - Webhooks (JSON Body): { type: "payment", data: { id: "123456" } }
  // - IPN (Query Parameters): /api/webhook/mercadopago?id=123456&topic=payment
  const url = new URL(requestEvent.request.url);
  
  const topic = url.searchParams.get("topic") || body.type || body.action;
  const paymentIdStr = url.searchParams.get("id") || body.data?.id || body.id;

  console.log(`[Webhook MP] Resolved Context: topic='${topic}', paymentId='${paymentIdStr}'`);

  // We are only interested in 'payment' notifications
  if (topic !== "payment" && topic !== "payment.created" && topic !== "payment.updated") {
    console.log(`[Webhook MP] Ignored notification topic: '${topic}'. Only processing 'payment' events.`);
    requestEvent.status(200);
    requestEvent.json(200, { success: true, message: "Ignored non-payment notification topic" });
    return;
  }

  if (!paymentIdStr) {
    console.error("[Webhook MP] Bad Request: Missing payment ID in query parameters or request body.");
    requestEvent.status(400);
    requestEvent.json(400, { success: false, error: "Missing payment ID" });
    return;
  }

  const paymentId = Number(paymentIdStr);
  if (isNaN(paymentId)) {
    console.error(`[Webhook MP] Bad Request: Payment ID '${paymentIdStr}' is not a valid number.`);
    requestEvent.status(400);
    requestEvent.json(400, { success: false, error: "Invalid payment ID format" });
    return;
  }

  // 3. Initialize Mercado Pago SDK securely using Zero-Trust principles
  const mpAccessToken = requestEvent.env.get("MP_ACCESS_TOKEN");
  if (!mpAccessToken) {
    console.error("[Webhook MP] System Error: MP_ACCESS_TOKEN is missing from server environment variables.");
    // Return HTTP 500 so Mercado Pago retries later when the server configuration is fixed
    requestEvent.status(500);
    requestEvent.json(500, { success: false, error: "Internal Server Configuration Error" });
    return;
  }

  try {
    // Instantiate MP client on-the-fly for stateless Vercel Serverless environment compatibility
    const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const paymentClient = new Payment(client);

    console.log(`[Webhook MP] Zero-Trust Verification: Fetching status of payment ${paymentId} directly from Mercado Pago...`);
    const mpPayment = await paymentClient.get({ id: paymentId });

    if (!mpPayment || !mpPayment.status) {
      throw new Error(`Failed to retrieve valid payment details for ID ${paymentId}`);
    }

    const status = mpPayment.status; // e.g. 'approved', 'pending', 'rejected', 'refunded', etc.
    const externalReference = mpPayment.external_reference; // Stores our internal booking UUID

    console.log(`[Webhook MP] Verified details: Status='${status}', ExternalReference='${externalReference}'`);

    // 4. State Flow Control and Database Updates
    if (status === "approved") {
      if (!externalReference) {
        console.warn(`[Webhook MP] Payment ${paymentId} is approved, but has no 'external_reference' (booking ID). Cannot link to database.`);
      } else {
        console.log(`[Webhook MP] Payment approved! Updating booking '${externalReference}' in database...`);

        // --- ACTIVE PRODUCTION QUERY (Turso + Drizzle ORM) ---
        const db = getDB(requestEvent);
        const updatedBookings = await db
          .update(bookings)
          .set({
            status: "CONFIRMED",
            paymentStatus: "PAID",
            paidAmount: Number(mpPayment.transaction_amount || 0),
            paymentId: paymentId.toString(),
            paymentMethod: mpPayment.payment_method_id || "MERCADOPAGO",
          })
          .where(eq(bookings.id, externalReference))
          .returning();

        if (updatedBookings.length === 0) {
          console.error(`[Webhook MP] Booking with ID '${externalReference}' not found in Turso DB.`);
        } else {
          console.log(`[Webhook MP] Booking '${externalReference}' successfully confirmed in Turso database.`);

          // Log the digital payment in the transactions table
          try {
            const openSession = await db.query.cashSessions.findFirst({
              where: eq(cashSessions.status, "OPEN"),
            });

            await db.insert(transactions).values({
              id: crypto.randomUUID(),
              cashSessionId: openSession ? openSession.id : null,
              type: "INCOME",
              category: "RESERVA_MP",
              amount: Number(mpPayment.transaction_amount || 0),
              description: `Pago digital MP - Reserva: ${externalReference.slice(0, 8)}`,
              paymentMethod: mpPayment.payment_method_id || "MERCADOPAGO",
              referenceId: externalReference,
            });
            console.log(`[Webhook MP] Digital transaction successfully recorded with session ID: ${openSession ? openSession.id : 'NULL'}`);
          } catch (e) {
            console.error(`[Webhook MP] Error logging transaction:`, e);
          }
        }

        /* 
         * ==========================================================================
         * TODO / INJECTION TEMPLATE FOR ALTERNATIVE DATABASES (SUPABASE / PURE SQL)
         * ==========================================================================
         * 
         * If you migrate from Turso to Supabase (PostgreSQL) or use a different adapter,
         * replace or supplement the Turso block above with the following pattern:
         * 
         * A) USING SUPABASE JS SDK:
         * -------------------------
         * import { createClient } from '@supabase/supabase-sdk';
         * const supabase = createClient(
         *   requestEvent.env.get("SUPABASE_URL")!,
         *   requestEvent.env.get("SUPABASE_SERVICE_ROLE_KEY")! // Use service role for backend operations
         * );
         * 
         * const { data, error } = await supabase
         *   .from('bookings')
         *   .update({ 
         *     status: 'CONFIRMED',
         *     payment_status: 'PAID',
         *     paid_amount: mpPayment.transaction_amount,
         *     payment_id: paymentId.toString(),
         *     payment_method: mpPayment.payment_method_id || 'MERCADOPAGO'
         *   })
         *   .eq('id', externalReference);
         * 
         * if (error) {
         *   console.error("Supabase update error:", error.message);
         *   throw error;
         * }
         * 
         * B) USING PURE SQL (e.g. pg-pool / mysql2 / libSQL Client directly):
         * -------------------------------------------------------------
         * const query = `
         *   UPDATE bookings 
         *   SET status = 'CONFIRMED', 
         *       payment_status = 'PAID', 
         *       paid_amount = $1, 
         *       payment_id = $2, 
         *       payment_method = $3 
         *   WHERE id = $4
         * `;
         * await dbClient.query(query, [
         *   mpPayment.transaction_amount, 
         *   paymentId.toString(), 
         *   mpPayment.payment_method_id || 'MERCADOPAGO', 
         *   externalReference
         * ]);
         */
      }
    } else {
      // Handling other states with detailed logging
      switch (status) {
        case "pending":
          console.log(`[Webhook MP] Payment ${paymentId} is pending. Waiting for confirmation.`);
          break;
        case "in_process":
          console.log(`[Webhook MP] Payment ${paymentId} is in process. Waiting for authorization.`);
          break;
        case "rejected":
          console.log(`[Webhook MP] Payment ${paymentId} was rejected. Reason: ${mpPayment.status_detail}`);
          break;
        case "refunded":
          console.log(`[Webhook MP] Payment ${paymentId} was refunded.`);
          break;
        case "cancelled":
          console.log(`[Webhook MP] Payment ${paymentId} was cancelled.`);
          break;
        default:
          console.log(`[Webhook MP] Payment ${paymentId} reported unhandled status: '${status}'`);
      }
    }

    // 5. Successful Webhook Processing Response
    // Always return HTTP 200 OK rapidly so Mercado Pago knows the notification was successfully verified
    requestEvent.status(200);
    requestEvent.json(200, { success: true });

  } catch (error: any) {
    console.error("[Webhook MP] Error during verification or database update:", error);
    // If the error comes from our infrastructure/fetch, return 500 to prompt MP to retry the hook
    requestEvent.status(500);
    requestEvent.json(500, { 
      success: false, 
      error: "Internal server error during payment verification",
      details: error?.message || error
    });
  }
};
