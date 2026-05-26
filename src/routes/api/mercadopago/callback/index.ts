import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { mercadoPagoCredentials } from "~/db/schema";
import { exchangeOAuthCode } from "~/lib/mercadopago";

export const onGet: RequestHandler = async (requestEvent) => {
  const { query, redirect } = requestEvent;
  
  const code = query.get("code");
  const error = query.get("error");
  
  // Si Mercado Pago envía un error (ej: el usuario denegó el acceso) o no hay código
  if (error || !code) {
    throw redirect(302, "/admin/club?mp_error=" + (error || "missing_code"));
  }

  try {
    // 1. Intercambiar el authorization code por los tokens de Sandbox
    const tokens = await exchangeOAuthCode(code, requestEvent.env);

    // 2. Calcular la fecha de expiración del token de acceso (expires_in es en segundos)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // 3. Guardar o actualizar las credenciales en la base de datos (id por defecto "1" para el club único)
    const db = getDB(requestEvent);
    
    await db
      .insert(mercadoPagoCredentials)
      .values({
        id: "1", // Vinculado al administrador/club principal (id: "1")
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt,
        publicKey: tokens.public_key,
        userId: String(tokens.user_id),
        liveMode: tokens.live_mode,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: mercadoPagoCredentials.id,
        set: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: expiresAt,
          publicKey: tokens.public_key,
          userId: String(tokens.user_id),
          liveMode: tokens.live_mode,
          updatedAt: new Date(),
        },
      });

    // 4. Redirigir de vuelta al panel con un indicador de éxito
    throw redirect(302, "/admin/club?mp_success=true");

  } catch (err: any) {
    // Si el error contiene las propiedades de redirección nativas de Qwik City, lo relanzamos directamente
    if (err && typeof err === 'object' && ('status' in err || 'location' in err || err.constructor?.name === 'RedirectMessage')) {
      throw err;
    }
    console.error("[MercadoPago Callback Error]:", err);
    throw redirect(302, "/admin/club?mp_error=auth_failed");
  }
};
