import type { RequestEventBase } from "@builder.io/qwik-city";

export interface MercadoPagoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
  live_mode: boolean;
}

export interface MercadoPagoError {
  message: string;
  error: string;
  status: number;
  cause: any[];
}

/**
 * Intercambia el Authorization Code por tokens de acceso de MercadoPago.
 */
export async function exchangeOAuthCode(
  code: string,
  env: RequestEventBase["env"]
): Promise<MercadoPagoTokenResponse> {
  const clientId = env.get("MP_CLIENT_ID");
  const clientSecret = env.get("MP_CLIENT_SECRET");
  const redirectUri = env.get("MP_REDIRECT_URI");

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Faltan variables de entorno de MercadoPago (MP_CLIENT_ID, MP_CLIENT_SECRET, MP_REDIRECT_URI).");
  }

  const url = "https://api.mercadopago.com/oauth/token";
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText, status: response.status };
    }
    console.error("[MercadoPago Error]: Error al intercambiar código:", errorData);
    throw new Error(
      `Error al autorizar con MercadoPago: ${errorData.message || errorData.error || response.statusText}`
    );
  }

  const data: MercadoPagoTokenResponse = await response.json();
  return data;
}
