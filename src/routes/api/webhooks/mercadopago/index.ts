import type { RequestHandler } from "@builder.io/qwik-city";

export const onPost: RequestHandler = async (requestEvent) => {
  const payload = await requestEvent.request.json().catch(() => null);

  if (!payload) {
    requestEvent.status(400);
    requestEvent.send(400, "Bad Request");
    return;
  }

  // Webhook structure for MercadoPago
  // Usually MP sends `type` or `topic` and `data.id`
  if (payload.type === "payment" || payload.topic === "payment") {
    const paymentId = payload.data?.id;

    if (paymentId) {
      // TODO: Fetch payment details from MercadoPago API using paymentId
      // Ensure you configure MP Access Token in .env to use the SDK.
      // Example pseudo-code:
      /*
      import { Payment, MercadoPagoConfig } from 'mercadopago';
      const client = new MercadoPagoConfig({ accessToken: requestEvent.env.get('MP_ACCESS_TOKEN')! });
      const payment = new Payment(client);
      const mpPayment = await payment.get({ id: paymentId });
      
      const externalReference = mpPayment.external_reference; // our bookingId
      
      if (mpPayment.status === 'approved') {
        const db = getDB(requestEvent);
        await db.update(bookings)
          .set({ 
            paymentStatus: "PAID", 
            paymentId: paymentId.toString(),
            paidAmount: mpPayment.transaction_amount
          })
          .where(eq(bookings.id, externalReference));
      }
      */

      console.log(
        `[Webhook] Payment notification received for payment ID: ${paymentId}`,
      );
    }
  }

  // Always return 200 OK so MercadoPago knows we received the notification
  requestEvent.status(200);
  requestEvent.send(200, "OK");
};
