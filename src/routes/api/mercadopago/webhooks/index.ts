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

import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, camelize, snakize } from "~/db";
import { bookings, mercadoPagoCredentials, transactions, cashSessions } from "~/db/schema";

export const onPost: RequestHandler = async (requestEvent) => {
  const { request, send } = requestEvent;

  try {
    // Parsear el body del Webhook
    const body = await request.json();
    console.log("[MercadoPago Webhook Received]:", JSON.stringify(body));

    const action = body.action || "";
    const type = body.type || "";
    const topic = body.topic || type || action;
    
    // Obtener el ID del pago
    const paymentId = body.data?.id || body.id;

    // Regla de negocio estricta: Solo procesamos eventos de tipo pago
    const isPaymentEvent = topic === "payment" || topic === "payment.created" || topic === "payment.updated";
    
    if (!isPaymentEvent || !paymentId) {
      console.log(`[MercadoPago Webhook] Ignorando evento no relevante. Tipo: ${type}, Acción: ${action}, Topic: ${topic}, ID: ${paymentId}`);
      send(200, "Event ignored");
      return;
    }

    console.log(`[MercadoPago Webhook] Procesando pago ID: ${paymentId}`);

    // Consultar las credenciales en la base de datos buscando el id: "1"
    const db = getDB(requestEvent);
    const { data: credentialsData, error: credentialsErr } = await db
      .from(mercadoPagoCredentials)
      .select("*")
      .eq("id", "1")
      .maybeSingle();

    if (credentialsErr) {
      throw new Error(credentialsErr.message);
    }
    const credentials = camelize<any>(credentialsData);

    const accessToken = credentials?.accessToken || requestEvent.env.get("MP_ACCESS_TOKEN");

    if (!accessToken) {
      console.error("[MercadoPago Webhook Error]: No se encontraron credenciales de acceso de Mercado Pago.");
      send(200, "Missing credentials");
      return;
    }

    // Consultar a la API de Mercado Pago para validar el estado real de la transacción
    const mpUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;
    const mpResponse = await fetch(mpUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error(`[MercadoPago Webhook Error]: Falla al obtener pago ${paymentId} de Mercado Pago. Status: ${mpResponse.status}, Error: ${errorText}`);
      send(200, "Error fetching payment details");
      return;
    }

    const paymentData = await mpResponse.json();
    const status = paymentData.status;
    const externalReference = paymentData.external_reference;
    const preferenceId = paymentData.preference_id;
    const transactionAmount = Number(paymentData.transaction_amount) || 0;

    console.log(`[MercadoPago Webhook] Pago ${paymentId} obtenido. Status: ${status}, Ref: ${externalReference}, Pref: ${preferenceId}, Amount: ${transactionAmount}`);

    if (status === "approved") {
      // Buscar la reserva por ID o por preferenceId
      const conditions: string[] = [];
      if (externalReference) {
        conditions.push(`id.eq.${externalReference}`);
      }
      if (preferenceId) {
        conditions.push(`preference_id.eq.${preferenceId}`);
      }

      if (conditions.length > 0) {
        const { data: foundBookingsData, error: bookingSearchErr } = await db
          .from(bookings)
          .select("*")
          .or(conditions.join(","))
          .limit(1);

        if (bookingSearchErr) {
          throw new Error(bookingSearchErr.message);
        }
        const foundBookings = camelize<any[]>(foundBookingsData);

        if (foundBookings.length > 0) {
          const booking = foundBookings[0];
          console.log(`[MercadoPago Webhook] Actualizando reserva ID: ${booking.id} a CONFIRMED/PAID`);
          
          const { error: updateErr } = await db
            .from(bookings)
            .update(
              snakize({
                status: "CONFIRMED",
                paymentStatus: "PAID",
                paidAmount: transactionAmount || booking.totalPrice,
                paymentId: String(paymentId),
                paymentMethod: "MERCADOPAGO",
              })
            )
            .eq("id", booking.id);

          if (updateErr) {
            throw new Error(updateErr.message);
          }

          console.log(`[MercadoPago Webhook] Reserva ID: ${booking.id} actualizada exitosamente.`);

          // Log the digital payment in the transactions table
          try {
            const { data: openSessionData, error: sessionErr } = await db
              .from(cashSessions)
              .select("*")
              .eq("status", "OPEN")
              .maybeSingle();

            if (sessionErr) {
              throw new Error(sessionErr.message);
            }
            const openSession = camelize<any>(openSessionData);

            const { error: txnErr } = await db.from(transactions).insert(
              snakize({
                id: crypto.randomUUID(),
                cashSessionId: openSession ? openSession.id : null,
                type: "INCOME",
                category: "RESERVA_MP",
                amount: transactionAmount || booking.totalPrice,
                description: `Pago digital MP - Reserva: ${booking.id.slice(0, 8)}`,
                paymentMethod: "MERCADOPAGO",
                referenceId: booking.id,
              })
            );

            if (txnErr) {
              throw new Error(txnErr.message);
            }
            console.log(`[MercadoPago Webhook] Digital transaction successfully recorded with session ID: ${openSession ? openSession.id : 'NULL'}`);
          } catch (e) {
            console.error(`[MercadoPago Webhook] Error logging transaction:`, e);
          }
        } else {
          console.warn(`[MercadoPago Webhook Warning]: No se encontró ninguna reserva asociada al pago ${paymentId} (Ref: ${externalReference}, Pref: ${preferenceId})`);
        }
      } else {
        console.warn(`[MercadoPago Webhook Warning]: El pago ${paymentId} no contiene información de referencia ni preferencia.`);
      }
    } else {
      console.log(`[MercadoPago Webhook] Pago ${paymentId} no está aprobado (Status: ${status}). No se actualiza la reserva.`);
    }

    send(200, "OK");
  } catch (error: any) {
    console.error("[MercadoPago Webhook Fatal Error]:", error);
    // Retornamos 200 en el catch tal como exige Mercado Pago para evitar reintentos infinitos
    send(200, "OK with error");
  }
};
