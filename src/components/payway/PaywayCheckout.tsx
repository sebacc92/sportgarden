import { component$, useSignal, useVisibleTask$, $, useComputed$, type PropFunction } from "@builder.io/qwik";
import { PAYWAY_PAYMENT_METHODS } from "~/lib/payway/types";

// Setup types for window objects
interface DecidirInstance {
  setPublishableKey(key: string): void;
  createToken(form: HTMLFormElement, callback: (status: number, response: any) => void): void;
}

declare global {
  interface Window {
    decidir?: DecidirInstance;
    Decidir?: new (endpointUrl: string) => DecidirInstance;
  }
}

export interface PaywayCheckoutProps {
  publicApiKey: string;
  amount: number;
  onSuccess$: PropFunction<(token: string, paymentMethodId: number) => void>;
  onError$: PropFunction<(message: string) => void>;
}

export default component$<PaywayCheckoutProps>((props) => {
  // Loading & Error states
  const sdkLoaded = useSignal(false);
  const isTokenizing = useSignal(false);
  const errorMessage = useSignal<string | null>(null);

  // Form input mirror signals for the premium live card preview
  const cardNumber = useSignal("");
  const cardHolder = useSignal("");
  const expMonth = useSignal("");
  const expYear = useSignal("");
  const securityCode = useSignal("");
  const docType = useSignal("DNI");
  const docNumber = useSignal("");
  const focusedField = useSignal<"front" | "back">("front");

  // Determine card type based on number prefix
  const cardBrand = useComputed$(() => {
    const num = cardNumber.value.replace(/\s+/g, "");
    if (/^4/.test(num)) return "VISA";
    if (/^(5[1-5]|2[2-7])/.test(num)) return "MASTERCARD";
    if (/^3[47]/.test(num)) return "AMEX";
    if (/^(6011|65|64[4-9])/.test(num)) return "DISCOVER";
    if (/^(5067|4576|4011)/.test(num)) return "CABAL";
    return "UNKNOWN";
  });

  // Map card brand to Decidir Payment Method ID
  const paymentMethodId = useComputed$(() => {
    switch (cardBrand.value) {
      case "VISA":
        return PAYWAY_PAYMENT_METHODS.VISA;
      case "MASTERCARD":
        return PAYWAY_PAYMENT_METHODS.MASTERCARD;
      case "AMEX":
        return PAYWAY_PAYMENT_METHODS.AMEX;
      case "CABAL":
        return PAYWAY_PAYMENT_METHODS.CABAL;
      default:
        return PAYWAY_PAYMENT_METHODS.VISA; // Default to Visa
    }
  });

  // Dynamically load the Decidir/Payway SDK script only when component mounts
  useVisibleTask$(({ cleanup }) => {
    const scriptId = "payway-decidir-sdk";
    if (document.getElementById(scriptId)) {
      sdkLoaded.value = true;
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://api-sandbox.payway.com.ar/djs/v2/decidir.js";
    script.async = true;
    script.onload = () => {
      sdkLoaded.value = true;
      console.log("[Payway SDK]: Decidir.js dynamically loaded successfully.");
    };
    script.onerror = () => {
      console.error("[Payway SDK]: Failed to load Decidir.js library.");
      errorMessage.value = "No se pudo cargar la librería de pagos Payway. Reintente por favor.";
    };
    document.body.appendChild(script);

    cleanup(() => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
      sdkLoaded.value = false;
    });
  });

  // Handle Form Submission & Tokenization
  const handleSubmit = $(async (event: Event) => {
    event.preventDefault();

    if (!sdkLoaded.value) {
      errorMessage.value = "La pasarela de pago aún no se ha cargado. Por favor, espere un momento.";
      return;
    }

    // Basic frontend checks
    if (!cardNumber.value || !cardHolder.value || !expMonth.value || !expYear.value || !securityCode.value || !docNumber.value) {
      errorMessage.value = "Por favor, complete todos los campos requeridos.";
      return;
    }

    isTokenizing.value = true;
    errorMessage.value = null;

    try {
      // Find or instantiate Decidir SDK
      let decidirInstance = window.decidir;
      if (!decidirInstance && window.Decidir) {
        // Fallback constructor instantiation if window.decidir is not pre-populated
        decidirInstance = new window.Decidir("https://api-sandbox.payway.com.ar/api/v2");
      }

      if (!decidirInstance) {
        throw new Error("El SDK de Payway (Decidir) no pudo ser inicializado en este navegador.");
      }

      // Configure SDK with Public Key
      decidirInstance.setPublishableKey(props.publicApiKey);

      const formElement = event.target as HTMLFormElement;

      // Tokenize the sensitive card details safely via Payway SDK
      decidirInstance.createToken(formElement, async (status: number, response: any) => {
        isTokenizing.value = false;

        if (status === 200 || status === 201) {
          // Success: Token received safely
          console.log("[Payway SDK]: Token created successfully:", response.id);
          await props.onSuccess$(response.id, paymentMethodId.value);
        } else {
          // Error tokenizing details
          console.error("[Payway SDK]: Tokenization error response:", response);
          const errorMsg = response.message || response.error?.message || "Los datos de la tarjeta son inválidos. Revise el número, CVV o vencimiento.";
          errorMessage.value = errorMsg;
          await props.onError$(errorMsg);
        }
      });
    } catch (err: any) {
      isTokenizing.value = false;
      console.error("[Payway SDK Client Error]:", err);
      errorMessage.value = err?.message || "Ocurrió un error inesperado al procesar la tarjeta.";
      await props.onError$(errorMessage.value!);
    }
  });

  // Format Card Number (adds spaces every 4 digits)
  const formatCardNumber = $((val: string) => {
    const cleaned = val.replace(/\D/g, "");
    const limited = cleaned.slice(0, 16);
    const matches = limited.match(/\d{1,4}/g);
    cardNumber.value = matches ? matches.join(" ") : limited;
  });

  return (
    <div class="space-y-8 select-none">
      {/* 3D-Like Premium Live Credit Card Preview */}
      <div class="perspective-1000 mx-auto w-full max-w-[340px] h-[210px] sm:max-w-[380px]">
        <div
          class={[
            "relative w-full h-full transition-transform duration-700 transform-style-3d shadow-2xl rounded-2xl text-white font-mono",
            focusedField.value === "back" ? "rotate-y-180" : "",
          ]}
        >
          {/* Card Front */}
          <div class="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-slate-900 via-[#0a2312] to-emerald-950 rounded-2xl border border-white/10 p-6 flex flex-col justify-between overflow-hidden">
            {/* Glossy circles overlay */}
            <div class="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl"></div>
            <div class="absolute -left-10 -bottom-10 w-32 h-32 bg-slate-500/10 rounded-full blur-2xl"></div>

            <div class="flex items-start justify-between z-10">
              {/* Card Chip */}
              <div class="w-11 h-9 bg-gradient-to-r from-amber-400 to-amber-200 rounded-lg flex items-center justify-center opacity-85 shadow border border-amber-300/30">
                <div class="w-7 h-5 border border-slate-900/15 rounded flex flex-wrap">
                  <div class="w-1/2 border-r border-b border-slate-900/15"></div>
                  <div class="w-1/2 border-b border-slate-900/15"></div>
                  <div class="w-1/2 border-r border-slate-900/15"></div>
                  <div class="w-1/2"></div>
                </div>
              </div>

              {/* Brand Logo */}
              <div class="text-right z-10 h-8 flex items-center">
                {cardBrand.value === "VISA" && (
                  <span class="text-2xl font-black italic tracking-wide text-sky-400 bg-white/5 px-2 py-0.5 rounded">VISA</span>
                )}
                {cardBrand.value === "MASTERCARD" && (
                  <div class="flex items-center gap-1">
                    <div class="w-6 h-6 rounded-full bg-red-500 opacity-90"></div>
                    <div class="w-6 h-6 -ml-3 rounded-full bg-amber-500 opacity-90"></div>
                  </div>
                )}
                {cardBrand.value === "AMEX" && (
                  <span class="text-sm font-extrabold px-2 py-1 bg-sky-600 rounded text-white shadow border border-sky-400/20">AMEX</span>
                )}
                {cardBrand.value === "CABAL" && (
                  <span class="text-sm font-black px-2.5 py-1 bg-emerald-700 rounded text-emerald-100 shadow">CABAL</span>
                )}
                {cardBrand.value === "UNKNOWN" && (
                  <span class="text-xs font-semibold text-slate-500 tracking-widest uppercase">TARJETA</span>
                )}
              </div>
            </div>

            {/* Card Number display */}
            <div class="text-lg sm:text-xl font-bold tracking-widest text-center py-2 z-10 bg-slate-950/20 rounded border border-white/5 my-1 font-mono select-all">
              {cardNumber.value || "•••• •••• •••• ••••"}
            </div>

            <div class="flex items-center justify-between text-[11px] sm:text-xs z-10">
              {/* Holder Name */}
              <div class="flex flex-col max-w-[70%]">
                <span class="text-slate-400 text-[9px] uppercase tracking-wider">Titular</span>
                <span class="font-bold tracking-wide truncate uppercase text-slate-200">
                  {cardHolder.value || "NOMBRE COMPLETO"}
                </span>
              </div>
              {/* Expiry Date */}
              <div class="flex flex-col text-right">
                <span class="text-slate-400 text-[9px] uppercase tracking-wider">Vence</span>
                <span class="font-bold text-slate-200 font-mono">
                  {expMonth.value ? `${expMonth.value.padStart(2, "0")}` : "MM"}/{expYear.value ? `${expYear.value.slice(-2)}` : "AA"}
                </span>
              </div>
            </div>
          </div>

          {/* Card Back */}
          <div class="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-[#0c0d12] via-slate-900 to-[#1e1f29] rounded-2xl border border-white/10 py-6 flex flex-col justify-between rotate-y-180 shadow-2xl">
            {/* Magnetic Stripe */}
            <div class="w-full h-11 bg-slate-950/90 z-10"></div>

            {/* Signature & CVV stripe */}
            <div class="px-6 my-2 z-10">
              <div class="flex items-center">
                <div class="flex-grow h-9 bg-slate-200/10 rounded-l border border-white/5 flex items-center justify-end px-3 font-semibold text-slate-500 italic line-through select-none text-[9px]">
                  Sport Garden Club
                </div>
                <div class="w-14 h-9 bg-amber-400 rounded-r text-slate-950 font-bold flex items-center justify-center font-mono text-sm tracking-widest">
                  {securityCode.value || "•••"}
                </div>
              </div>
              <span class="text-[8px] text-slate-500 mt-1 block tracking-wider uppercase text-right px-1">Código Seguridad (CVV)</span>
            </div>

            {/* Back footer info */}
            <div class="px-6 flex justify-between items-center text-[9px] text-slate-400 font-sans z-10 leading-none">
              <span>SANDBOX TRANSACCIÓN</span>
              <span class="font-bold text-emerald-500">PAYWAY SECURE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actual Form */}
      <form
        onSubmit$={handleSubmit}
        class="space-y-4 text-left"
      >
        {errorMessage.value && (
          <div class="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-400 flex items-start gap-2.5">
            <svg class="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errorMessage.value}</span>
          </div>
        )}

        {/* Cardholder Name input */}
        <div class="flex flex-col space-y-1.5">
          <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Nombre en la tarjeta</label>
          <input
            type="text"
            data-decidir="card_holder_name"
            required
            placeholder="Como figura impreso"
            onFocus$={() => { focusedField.value = "front"; }}
            onInput$={(e) => { cardHolder.value = (e.target as HTMLInputElement).value.toUpperCase(); }}
            class="w-full rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 px-4 text-sm font-bold text-white shadow-inner outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>

        {/* Card Number input */}
        <div class="flex flex-col space-y-1.5">
          <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Número de tarjeta</label>
          <div class="relative">
            <input
              type="text"
              data-decidir="card_number"
              required
              value={cardNumber.value}
              placeholder="0000 0000 0000 0000"
              onFocus$={() => { focusedField.value = "front"; }}
              onInput$={(e) => {
                const target = e.target as HTMLInputElement;
                formatCardNumber(target.value);
              }}
              class="w-full rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 pl-4 pr-12 text-sm font-bold text-white shadow-inner outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
            />
            {/* Live brand badge indicator in input field */}
            <div class="absolute right-4 top-1/2 -translate-y-1/2 font-bold italic text-slate-400 text-xs select-none">
              {cardBrand.value !== "UNKNOWN" ? cardBrand.value : ""}
            </div>
          </div>
        </div>

        {/* Dynamic Row: Expiry & CVV */}
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col space-y-1.5">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Mes Vence</label>
            <input
              type="text"
              data-decidir="card_expiration_month"
              required
              maxLength={2}
              placeholder="MM"
              onFocus$={() => { focusedField.value = "front"; }}
              onInput$={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value.replace(/\D/g, "");
                expMonth.value = value.slice(0, 2);
                target.value = expMonth.value;
              }}
              class="w-full text-center rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 text-sm font-bold text-white shadow-inner outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>

          <div class="flex flex-col space-y-1.5">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Año Vence</label>
            <input
              type="text"
              data-decidir="card_expiration_year"
              required
              maxLength={2}
              placeholder="AA"
              onFocus$={() => { focusedField.value = "front"; }}
              onInput$={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value.replace(/\D/g, "");
                expYear.value = value.slice(0, 2);
                target.value = expYear.value;
              }}
              class="w-full text-center rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 text-sm font-bold text-white shadow-inner outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>

          <div class="flex flex-col space-y-1.5">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">CVV</label>
            <input
              type="password"
              data-decidir="security_code"
              required
              maxLength={4}
              placeholder="123"
              onFocus$={() => { focusedField.value = "back"; }}
              onBlur$={() => { focusedField.value = "front"; }}
              onInput$={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value.replace(/\D/g, "");
                securityCode.value = value.slice(0, 4);
                target.value = securityCode.value;
              }}
              class="w-full text-center rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 text-sm font-bold text-white shadow-inner outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
        </div>

        {/* Divider line */}
        <div class="h-px bg-white/5 my-4"></div>

        {/* Dynamic Row: Doc Type & Doc Number */}
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col space-y-1.5">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Documento</label>
            <select
              data-decidir="card_holder_doc_type"
              required
              value={docType.value}
              onChange$={(e) => { docType.value = (e.target as HTMLSelectElement).value; }}
              class="w-full rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 px-3 text-sm font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
            >
              <option value="DNI">DNI</option>
              <option value="CI">CI</option>
              <option value="PASAPORTE">PASAPORTE</option>
            </select>
          </div>

          <div class="col-span-2 flex flex-col space-y-1.5">
            <label class="text-xs font-bold text-slate-400 uppercase tracking-widest">Nº Documento del Titular</label>
            <input
              type="text"
              data-decidir="card_holder_doc_number"
              required
              placeholder="Número de DNI"
              onInput$={(e) => {
                const target = e.target as HTMLInputElement;
                const value = target.value.replace(/\D/g, "");
                docNumber.value = value;
                target.value = value;
              }}
              class="w-full rounded-2xl border border-white/5 bg-slate-950/60 py-3.5 px-4 text-sm font-bold text-white shadow-inner outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
        </div>

        {/* Payway Submit Button */}
        <button
          type="submit"
          disabled={!sdkLoaded.value || isTokenizing.value}
          class={[
            "w-full flex items-center justify-center gap-3 rounded-2xl py-4 mt-6 text-sm font-black tracking-widest text-white uppercase shadow-lg transition-all",
            "bg-emerald-600 shadow-emerald-950/30 hover:bg-emerald-500 hover:-translate-y-0.5 active:scale-95",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:active:scale-100",
          ]}
        >
          {isTokenizing.value ? (
            <>
              <svg class="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Encriptando Datos...
            </>
          ) : !sdkLoaded.value ? (
            "Cargando Pasarela Payway..."
          ) : (
            <>
              Abonar ${props.amount.toLocaleString("es-AR")} ARS
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.5" d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
});
