import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { siteSettings } from "~/db/schema";
import { eq } from "drizzle-orm";
import { exchangeOAuthCode } from "~/lib/mercadopago";

export const onGet: RequestHandler = async (requestEvent) => {
  const { query, redirect } = requestEvent;
  
  const code = query.get("code");
  const error = query.get("error");
  
  // Si MercadoPago envía un error (ej: el usuario denegó el acceso) o no hay código
  if (error || !code) {
    throw redirect(302, "/admin/club?mp_error=" + (error || "missing_code"));
  }

  try {
    // 1. Intercambiar el authorization code por los tokens
    const tokens = await exchangeOAuthCode(code, requestEvent.env);

    // 2. Calcular la fecha de expiración del token de acceso
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // 3. Guardar los tokens en la base de datos (para el tenant actual, asumiendo id=1)
    const db = getDB(requestEvent);
    await db
      .update(siteSettings)
      .set({
        mpAccessToken: tokens.access_token,
        mpRefreshToken: tokens.refresh_token,
        mpPublicKey: tokens.public_key,
        mpTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(siteSettings.id, 1));

    // 4. Redirigir de vuelta al panel de administrador con un indicador de éxito
    throw redirect(302, "/admin/club?mp_success=true");

  } catch (err: any) {
    console.error("[MercadoPago Callback Error]:", err);
    throw redirect(302, "/admin/club?mp_error=auth_failed");
  }
};
