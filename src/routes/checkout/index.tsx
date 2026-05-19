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

// Polyfill global Headers prototype for compatibility with node-fetch's raw() method
if (typeof globalThis.Headers !== "undefined" && !(globalThis.Headers.prototype as any).raw) {
  (globalThis.Headers.prototype as any).raw = function () {
    const rawHeaders: Record<string, string[]> = {};
    this.forEach((value: string, name: string) => {
      rawHeaders[name] = value.split(",").map((v) => v.trim());
    });
    return rawHeaders;
  };
}

import { component$, useVisibleTask$ } from "@builder.io/qwik";
import { routeAction$, Form, Link } from "@builder.io/qwik-city";
import { MercadoPagoConfig, Preference } from "mercadopago";

export const useCrearPreferencia = routeAction$(async (data, requestEvent) => {
  const mpAccessToken = requestEvent.env.get("MP_ACCESS_TOKEN");

  if (!mpAccessToken) {
    return requestEvent.fail(500, {
      message: "Configuración incorrecta: falta el token de acceso de Mercado Pago en el servidor.",
    });
  }

  try {
    // 1. Inicializar Mercado Pago Config
    const client = new MercadoPagoConfig({
      accessToken: mpAccessToken,
    });

    // 2. Resolver host dinámicamente para los back_urls
    const origin = requestEvent.url.origin;

    // 3. Crear instancia de Preferencia
    const preference = new Preference(client);

    // 4. Crear la preferencia en Mercado Pago
    const response = await preference.create({
      body: {
        items: [
          {
            id: "reserva-test-1200",
            title: "Reserva de Cancha - Garden Club",
            quantity: 1,
            unit_price: 1200,
            currency_id: "ARS",
          },
        ],
        back_urls: {
          success: `${origin}/pago/exitoso`,
          failure: `${origin}/pago/fallido`,
          pending: `${origin}/pago/pendiente`,
        },
        auto_return: "approved",
        statement_descriptor: "GARDEN CLUB",
      },
    });

    if (!response.init_point) {
      throw new Error("No se recibió la URL de inicio del pago (init_point) desde Mercado Pago.");
    }

    return {
      success: true,
      initPoint: response.init_point,
    };
  } catch (error: any) {
    console.error("Error al crear preferencia de Mercado Pago:", error);
    return requestEvent.fail(500, {
      message: error?.message || "Ocurrió un error inesperado al procesar el pago. Intenta de nuevo.",
    });
  }
});

export default component$(() => {
  const crearPreferenciaAction = useCrearPreferencia();

  useVisibleTask$(({ track }) => {
    track(() => crearPreferenciaAction.value);
    if (crearPreferenciaAction.value?.success && crearPreferenciaAction.value?.initPoint) {
      window.location.href = crearPreferenciaAction.value.initPoint;
    }
  });

  return (
    <div class="min-h-screen bg-slate-950 pt-36 pb-20 font-sans text-white selection:bg-emerald-500 selection:text-white">
      {/* Background navbar filler */}
      <div class="fixed inset-x-0 top-0 z-40 h-28 bg-[#001407]"></div>

      <div class="mx-auto max-w-xl px-6 lg:px-8">
        {/* Back Link */}
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
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a las canchas
        </Link>

        {/* Card Contenedora Principal */}
        <div class="overflow-hidden rounded-3xl border border-white/5 bg-slate-900/60 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur-md sm:p-8">
          {/* Header */}
          <div class="mb-6 border-b border-white/5 pb-6 text-center">
            <span class="inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold tracking-wider text-emerald-400 uppercase">
              Pasarela de Pago Segura
            </span>
            <h1 class="mt-3 text-2xl font-black tracking-tight text-white uppercase sm:text-3xl">
              Reserva tu Turno
            </h1>
            <p class="mt-2 text-sm text-slate-400">
              Estás a un paso de confirmar tu reserva. El pago es procesado y protegido por Mercado Pago.
            </p>
          </div>

          {/* Item details card */}
          <div class="mb-8 rounded-2xl border border-white/5 bg-slate-950/50 p-5 space-y-4">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <h3 class="text-base font-extrabold text-white">
                  Reserva de Cancha - Garden Club
                </h3>
                <p class="text-xs font-semibold text-slate-500">
                  Item de prueba · Acreditación instantánea
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
                $1.200 <span class="text-xs font-semibold text-slate-400">ARS</span>
              </span>
            </div>
          </div>

          {/* Action form */}
          <Form
            action={crearPreferenciaAction}
            onSubmit$={() => {
              // Si ya se cargó, la redirección es inminente
            }}
            class="space-y-4"
          >
            {crearPreferenciaAction.value?.message && (
              <div class="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-center text-sm font-semibold text-red-400">
                {crearPreferenciaAction.value.message}
              </div>
            )}



            <button
              type="submit"
              disabled={crearPreferenciaAction.isRunning}
              class={[
                "w-full flex items-center justify-center gap-3 rounded-2xl bg-[#009EE3] py-4 text-sm font-black tracking-widest text-white uppercase shadow-lg shadow-[#009EE3]/20 transition-all hover:bg-[#0089C7] hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100",
              ]}
            >
              {crearPreferenciaAction.isRunning ? (
                <>
                  <svg
                    class="h-5 w-5 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Redirigiendo a Mercado Pago...
                </>
              ) : (
                <>
                  Pagar con Mercado Pago
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.5" d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </Form>

          {/* Secure transaction notice */}
          <div class="mt-6 flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Transacción 100% encriptada y protegida por SSL
          </div>
        </div>
      </div>
    </div>
  );
});

export const head = {
  title: "Pagar Reserva - Garden Club",
};
