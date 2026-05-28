import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";
import { routeAction$, Link } from "@builder.io/qwik-city";
import PaywayCheckout from "~/components/payway/PaywayCheckout";
import { processPaywayPayment } from "~/lib/payway";
import type { PaywayPaymentRequest } from "~/lib/payway/types";

// Public key provided by user in prompt
const PAYWAY_PUBLIC_KEY = "019e6f79-1a83-71d9-98fc-53bb42253";

export const useProcesarPagoPayway = routeAction$(async (data, requestEvent) => {
  const token = data.token as string;
  const paymentMethodId = Number(data.payment_method_id);
  const amount = Number(data.amount);

  if (!token || !paymentMethodId || !amount || isNaN(paymentMethodId) || isNaN(amount)) {
    return requestEvent.fail(400, {
      message: "Datos de pago inválidos o incompletos. Por favor revise el formulario.",
    });
  }

  // Generate unique transaction ID using app prefix (sgf = Sport Garden Futbol)
  const siteTransactionId = `sgf_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

  const paymentRequest: PaywayPaymentRequest = {
    site_transaction_id: siteTransactionId,
    token,
    payment_method_id: paymentMethodId,
    amount,
    currency: "ARS",
    installments: 1,
    description: "Reserva de Cancha - Sport Garden Club",
    establishment_name: "Sport Garden Club",
  };

  try {
    const result = await processPaywayPayment(paymentRequest, requestEvent.env);
    
    return {
      success: true,
      paymentId: result.id,
      site_transaction_id: result.site_transaction_id,
      amount: result.amount,
      date: result.date,
      ticket: result.status_details?.ticket || "N/A",
    };
  } catch (error: any) {
    console.error("[Payway Route Action Error]:", error);
    return requestEvent.fail(error.status || 500, {
      message: error.message || "Ocurrió un error inesperado al liquidar el cobro.",
    });
  }
});

export default component$(() => {
  const procesarPagoAction = useProcesarPagoPayway();
  const paymentError = useSignal<string | null>(null);
  const purchaseAmount = 1500; // Standard premium demo fee in ARS

  // Scroll to top on success
  useVisibleTask$(({ track }) => {
    track(() => procesarPagoAction.value?.success);
    if (procesarPagoAction.value?.success) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  return (
    <div class="min-h-screen bg-slate-950 pt-36 pb-20 font-sans text-white selection:bg-emerald-500 selection:text-white">
      {/* Background fixed navbar filler */}
      <div class="fixed inset-x-0 top-0 z-40 h-28 bg-[#001407] border-b border-white/5"></div>

      <div class="mx-auto max-w-xl px-6 lg:px-8">
        {/* Back navigation */}
        <Link
          href="/#canchas"
          class="group mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 transition-transform group-hover:-translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver al Inicio
        </Link>

        {/* If payment completed successfully, display premium ticket feedback */}
        {procesarPagoAction.value?.success ? (
          <div class="overflow-hidden rounded-3xl border border-emerald-500/20 bg-slate-900/40 p-8 text-center shadow-2xl shadow-emerald-950/20 backdrop-blur-md animate-fade-in">
            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-6">
              <svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <span class="inline-block rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-bold tracking-wider text-emerald-400 uppercase">
              Transacción Aprobada
            </span>
            
            <h1 class="mt-4 text-3xl font-black tracking-tight text-white uppercase">
              ¡Pago Exitoso!
            </h1>
            
            <p class="mt-2 text-sm text-slate-400">
              Tu reserva en Sport Garden Club ha sido confirmada con éxito.
            </p>

            {/* Receipt layout */}
            <div class="mt-8 rounded-2xl border border-white/5 bg-slate-950/60 p-5 text-left space-y-3.5 font-mono text-xs text-slate-400">
              <div class="flex justify-between">
                <span>COMERCIO:</span>
                <span class="font-bold text-white">SPORT GARDEN CLUB</span>
              </div>
              <div class="flex justify-between">
                <span>TRANSACCIÓN ID:</span>
                <span class="font-bold text-white">{procesarPagoAction.value.site_transaction_id}</span>
              </div>
              <div class="flex justify-between">
                <span>PAYWAY REF ID:</span>
                <span class="font-bold text-white">{procesarPagoAction.value.paymentId}</span>
              </div>
              <div class="flex justify-between">
                <span>Nº TICKET:</span>
                <span class="font-bold text-white">{procesarPagoAction.value.ticket}</span>
              </div>
              <div class="flex justify-between">
                <span>FECHA:</span>
                <span class="font-bold text-white">
                  {new Date(procesarPagoAction.value.date).toLocaleString("es-AR")}
                </span>
              </div>
              <div class="border-t border-white/5 pt-3.5 flex justify-between text-sm">
                <span class="font-bold text-slate-300">TOTAL ABONADO:</span>
                <span class="font-black text-emerald-400">
                  ${procesarPagoAction.value.amount.toLocaleString("es-AR")} ARS
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div class="mt-8 space-y-3">
              <Link
                href="/cuenta"
                class="block w-full rounded-2xl bg-emerald-600 py-4 text-sm font-black tracking-widest text-white uppercase shadow-lg shadow-emerald-950/30 transition-all hover:bg-emerald-500 hover:-translate-y-0.5 active:scale-95 text-center"
              >
                Ver Mis Turnos
              </Link>
              <Link
                href="/"
                class="block w-full rounded-2xl bg-slate-800/80 py-4 text-sm font-black tracking-widest text-slate-300 uppercase transition-all hover:bg-slate-700/80 hover:-translate-y-0.5 active:scale-95 text-center"
              >
                Volver al Inicio
              </Link>
            </div>
          </div>
        ) : (
          /* Main Card */
          <div class="overflow-hidden rounded-3xl border border-white/5 bg-slate-900/60 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur-md sm:p-8">
            {/* Header */}
            <div class="mb-6 border-b border-white/5 pb-6 text-center">
              <span class="inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold tracking-wider text-emerald-400 uppercase">
                Pago Seguro Decidir v2 / Payway
              </span>
              <h1 class="mt-3 text-2xl font-black tracking-tight text-white uppercase sm:text-3xl">
                Confirmar Reserva
              </h1>
              <p class="mt-2 text-sm text-slate-400">
                Ingrese los datos de su tarjeta de crédito o débito para completar el pago.
              </p>
            </div>

            {/* Item detail card */}
            <div class="mb-8 rounded-2xl border border-white/5 bg-slate-950/50 p-5 space-y-4">
              <div class="flex items-start justify-between gap-4">
                <div class="space-y-1">
                  <h3 class="text-base font-extrabold text-white">
                    Reserva de Cancha - Sport Garden Club
                  </h3>
                  <p class="text-xs font-semibold text-slate-500">
                    Alquiler de Cancha de Fútbol 5 (1 Hora) · Acreditación Instantánea
                  </p>
                </div>
                <span class="shrink-0 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-400">
                  Cant: 1
                </span>
              </div>

              <div class="border-t border-white/5 pt-4 flex items-center justify-between">
                <span class="text-xs font-bold tracking-wider text-slate-400 uppercase">
                  Monto a Abonar
                </span>
                <span class="text-2xl font-black text-white">
                  ${purchaseAmount.toLocaleString("es-AR")}{" "}
                  <span class="text-xs font-semibold text-slate-400">ARS</span>
                </span>
              </div>
            </div>

            {/* Display action errors if any */}
            {(procesarPagoAction.value?.message || paymentError.value) && (
              <div class="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-400 flex items-start gap-2.5">
                <svg class="h-5 w-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{procesarPagoAction.value?.message || paymentError.value}</span>
              </div>
            )}

            {/* Loader backdrop during routeAction execution */}
            {procesarPagoAction.isRunning && (
              <div class="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6 mb-6 text-center animate-pulse">
                <div class="mx-auto flex h-10 w-10 items-center justify-center mb-3">
                  <svg class="h-8 w-8 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h4 class="text-sm font-bold text-emerald-400 uppercase tracking-widest">Liquidando Pago con Payway</h4>
                <p class="text-xs text-slate-400 mt-1">
                  Procesando la autorización de su tarjeta de manera segura. No cierre ni recargue esta página.
                </p>
              </div>
            )}

            {/* Embedded secure Payway Checkout Component */}
            <div class={procesarPagoAction.isRunning ? "pointer-events-none opacity-40 select-none transition-all duration-300" : "transition-all duration-300"}>
              <PaywayCheckout
                publicApiKey={PAYWAY_PUBLIC_KEY}
                amount={purchaseAmount}
                onSuccess$={$(async (token: string, paymentMethodId: number) => {
                  paymentError.value = null;
                  await procesarPagoAction.submit({
                    token,
                    payment_method_id: paymentMethodId,
                    amount: purchaseAmount,
                  });
                })}
                onError$={$(async (msg: string) => {
                  paymentError.value = msg;
                })}
              />
            </div>

            {/* SSL Notice */}
            <div class="mt-6 flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Conexión encriptada vía SSL por Payway Decidir
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export const head = {
  title: "Pago Seguro Payway - Sport Garden Club",
};
