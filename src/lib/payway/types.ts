/**
 * Payway (Decidir v2) Payment Method IDs Mapping
 */
export const PAYWAY_PAYMENT_METHODS = {
  VISA: 1,
  MASTERCARD: 15,
  AMEX: 65,
  CABAL: 42,
  DINERS: 2,
  NARANJA: 24,
} as const;

export type PaywayPaymentMethodName = keyof typeof PAYWAY_PAYMENT_METHODS;

/**
 * Payload required to process a payment with Payway API v2
 */
export interface PaywayPaymentRequest {
  site_transaction_id: string; // Unique transaction identifier
  token: string;                // One-time secure card token from frontend
  payment_method_id: number;    // ID of the card issuer brand (e.g., 1 = Visa)
  amount: number;               // Float/decimal amount (e.g. 1500.50)
  currency: "ARS";              // Currency identifier
  installments: number;         // Installment/quota count (e.g., 1)
  description: string;          // Transaction description
  establishment_name: string;   // Name of business / club
}

/**
 * Decidir/Payway standard error item details
 */
export interface PaywayValidationError {
  code: string;
  param: string;
  description: string;
}

/**
 * Standard Decidir/Payway error API structure
 */
export interface PaywayErrorResponse {
  error_type: string;
  validation_errors?: PaywayValidationError[];
  message?: string;
}

/**
 * Decidir/Payway success or processed payment response details
 */
export interface PaywayPaymentResponse {
  id: number;
  site_transaction_id: string;
  token: string;
  user_id?: string;
  payment_method_id: number;
  bin?: string;
  amount: number;
  currency: string;
  installments: number;
  payment_type: string;
  sub_payment_method_type?: string;
  status: "approved" | "rejected" | "annulled" | "refunded" | "chargeback";
  status_details?: {
    ticket?: string;
    card_authorization_code?: string;
    address_validation_code?: string;
    error?: {
      type: string;
      reason: {
        id: number;
        description: string;
        additional_description: string;
      };
    };
  };
  date: string;
}

/**
 * Standard client callback payload for Decidir.js token creation
 */
export interface DecidirTokenResponse {
  id: string; // The token string, equivalent to response.id
  status: string;
  card_number_length: number;
  date_created: string;
  bin: string;
  last_four_digits: string;
  security_code_length: number;
  expiration_month: number;
  expiration_year: number;
  cardholder: {
    name: string;
    identification: {
      type: string;
      number: string;
    };
  };
}
