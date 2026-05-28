import type { RequestEventBase } from "@builder.io/qwik-city";
import type { PaywayPaymentRequest, PaywayPaymentResponse, PaywayErrorResponse } from "./types";

const PAYWAY_SANDBOX_URL = "https://api-sandbox.payway.com.ar/api/v2";

/**
 * Custom error class for Payway integration to pass structured errors to the UI
 */
export class PaywayError extends Error {
  public code?: string;
  public status?: number;
  public details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = "PaywayError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Securely executes a payment request on the Payway API (v2) on the server.
 */
export async function processPaywayPayment(
  paymentData: PaywayPaymentRequest,
  env: RequestEventBase["env"]
): Promise<PaywayPaymentResponse> {
  const secretKey = env.get("SECRET_PAYWAY_KEY");
  
  if (!secretKey) {
    console.error("[Payway Service Error]: SECRET_PAYWAY_KEY is missing in the environment variables.");
    throw new PaywayError(
      "Error interno de configuración del servidor. Por favor contáctese con el administrador del club.",
      500,
      "MISSING_SERVER_KEY"
    );
  }

  const endpointUrl = `${PAYWAY_SANDBOX_URL}/payments`;

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: secretKey,
      },
      body: JSON.stringify(paymentData),
    });

    if (response.ok) {
      const data: PaywayPaymentResponse = await response.json();
      
      // Payway can sometimes return status 200/201 but with a "rejected" state inside the transaction details
      if (data.status === "rejected") {
        const rejectReason = data.status_details?.error?.reason?.description || "Operación rechazada por la entidad emisora.";
        const extraInfo = data.status_details?.error?.reason?.additional_description || "";
        const fullMessage = extraInfo ? `${rejectReason} (${extraInfo})` : rejectReason;
        
        throw new PaywayError(
          `Pago rechazado: ${fullMessage}`,
          402,
          "PAYMENT_REJECTED",
          data.status_details
        );
      }

      return data;
    }

    // Handle non-OK HTTP status codes (400, 401, 402, 500, etc.)
    let errorJson: any;
    try {
      errorJson = await response.json();
    } catch {
      errorJson = { message: response.statusText };
    }

    console.error("[Payway Server Response Error]:", {
      status: response.status,
      statusText: response.statusText,
      payload: errorJson,
    });

    // Parse and map the error elegantly
    const errorResponse = errorJson as PaywayErrorResponse;
    let errorMessage = "Ocurrió un error al procesar el pago con la entidad emisora.";
    let errorCode = errorResponse.error_type || "UNKNOWN_PAYWAY_ERROR";

    if (errorResponse.validation_errors && errorResponse.validation_errors.length > 0) {
      // Map validation errors to clean spanish warnings
      const firstError = errorResponse.validation_errors[0];
      errorMessage = mapValidationErrorToSpanish(firstError.code, firstError.description, firstError.param);
      errorCode = `VALIDATION_ERROR_${firstError.code}`;
    } else if (errorResponse.message) {
      errorMessage = errorResponse.message;
    }

    throw new PaywayError(errorMessage, response.status, errorCode, errorJson);
  } catch (error: any) {
    if (error instanceof PaywayError) {
      throw error;
    }
    
    console.error("[Payway Server Network/Unexpected Error]:", error);
    throw new PaywayError(
      "No pudimos establecer comunicación con la pasarela de pagos. Por favor verifique su conexión e intente nuevamente.",
      500,
      "GATEWAY_COMMUNICATION_ERROR"
    );
  }
}

/**
 * Translates and cleans up Payway validation error messages for excellent user feedback
 */
function mapValidationErrorToSpanish(code: string, originalDescription: string, param: string): string {
  // Common codes or parameters
  const parameter = param ? param.toLowerCase() : "";
  const desc = originalDescription ? originalDescription.toLowerCase() : "";

  if (parameter.includes("card_number") || desc.includes("card_number") || code === "invalid_card_number") {
    return "El número de tarjeta ingresado no es válido o es incorrecto.";
  }
  if (parameter.includes("security_code") || desc.includes("security_code") || code === "invalid_security_code") {
    return "El código de seguridad (CVV) es incorrecto o tiene un formato no válido.";
  }
  if (parameter.includes("expiration_month") || parameter.includes("expiration_year") || desc.includes("expiration") || code === "invalid_expiration") {
    return "La fecha de vencimiento es inválida o la tarjeta ya ha expirado.";
  }
  if (parameter.includes("holder") || desc.includes("holder")) {
    return "El nombre del titular ingresado no es válido.";
  }
  if (parameter.includes("identification") || desc.includes("identification")) {
    return "El tipo o número de documento del titular es incorrecto.";
  }
  if (code === "required") {
    return `El campo '${param}' es obligatorio para procesar la transacción.`;
  }

  return originalDescription || "Los datos de la tarjeta son incorrectos. Por favor verifíquelos.";
}
