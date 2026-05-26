import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { mercadoPagoCredentials } from "~/db/schema";
import { eq } from "drizzle-orm";

interface CheckoutRequest {
  canchaId: string;
  precioSeña: string | number;
  usuario: {
    nombre: string;
    email?: string;
    telefono?: string;
  };
}

export const onPost: RequestHandler = async (requestEvent) => {
  const { request, json } = requestEvent;

  try {
    // 1. Obtener y parsear los datos del body
    const body = (await request.json()) as CheckoutRequest;
    const { canchaId, precioSeña, usuario } = body;

    if (!canchaId || precioSeña === undefined || precioSeña === null || !usuario) {
      json(400, {
        error: "Faltan parámetros requeridos. Se requiere 'canchaId', 'precioSeña' y 'usuario'.",
      });
      return;
    }

    const price = Number(precioSeña);
    if (isNaN(price) || price <= 0) {
      json(400, {
        error: "El precio de la seña debe ser un número mayor a cero.",
      });
      return;
    }

    // 2. Consultar las credenciales en la base de datos buscando el id: "1"
    const db = getDB(requestEvent);
    const [credentials] = await db
      .select()
      .from(mercadoPagoCredentials)
      .where(eq(mercadoPagoCredentials.id, "1"))
      .limit(1);

    if (!credentials || !credentials.accessToken) {
      json(400, {
        error: "No se encontraron credenciales de Mercado Pago vinculadas para el club (ID 1).",
      });
      return;
    }

    // 3. Crear la preferencia de pago a través de fetch server-to-server a Mercado Pago
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: `Seña Reserva - Cancha ${canchaId}`,
            quantity: 1,
            unit_price: price,
            currency_id: "ARS",
          },
        ],
        back_urls: {
          success: "https://evasion-chute-bonding.ngrok-free.dev/admin/club?booking=success",
          failure: "https://evasion-chute-bonding.ngrok-free.dev/admin/club?booking=failure",
          pending: "https://evasion-chute-bonding.ngrok-free.dev/admin/club?booking=pending",
        },
        auto_return: "approved",
        notification_url: "https://evasion-chute-bonding.ngrok-free.dev/api/mercadopago/webhooks",
      }),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error("[MercadoPago Preference Response Error]:", errorText);
      json(mpResponse.status, {
        error: "Error del servidor de Mercado Pago al crear la preferencia de pago.",
        details: errorText,
      });
      return;
    }

    const preferenceData = await mpResponse.json();

    // 4. Retornar los campos de redirección requeridos
    json(200, {
      init_point: preferenceData.init_point,
      sandbox_init_point: preferenceData.sandbox_init_point,
      id: preferenceData.id,
    });
  } catch (error: any) {
    console.error("[Checkout Route Error]:", error);
    json(500, {
      error: "Ocurrió un error inesperado al procesar la preferencia de pago.",
      details: error?.message || String(error),
    });
  }
};
