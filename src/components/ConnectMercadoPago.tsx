import { component$, useComputed$ } from "@builder.io/qwik";

export interface ConnectMercadoPagoProps {
  /** Indica si el administrador ya vinculó su cuenta de Mercado Pago */
  isConnected?: boolean;
  /** Nombre del club o administrador de la cancha */
  merchantName?: string;
}

export const ConnectMercadoPago = component$<ConnectMercadoPagoProps>(
  ({ isConnected = false, merchantName }) => {
    // Acceso a variables de entorno públicas en Qwik
    const clientId = import.meta.env.PUBLIC_MP_CLIENT_ID || "";
    const redirectUri = import.meta.env.PUBLIC_MP_REDIRECT_URI || "";

    // Generar URL de Autorización (OAuth) para Sandbox de Mercado Pago
    const authorizationUrl = useComputed$(() => {
      const baseUrl = "https://auth.mercadopago.com.ar/authorization";
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        platform_id: "mp",
        redirect_uri: redirectUri,
      });
      return `${baseUrl}?${params.toString()}`;
    });

    return (
      <div class="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-100 transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/80 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        {/* Cabecera del Componente */}
        <div class="mb-6 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 dark:bg-sky-950/50 dark:text-sky-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="h-6 w-6"
              >
                <path d="M4.5 3.75a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V6.75a3 3 0 0 0-3-3h-15Z" />
                <path
                  fill-rule="evenodd"
                  d="M2.25 12c.074.015.15.022.225.022h19c.075 0 .151-.007.225-.022a1.5 1.5 0 0 0-1.475-1.228H3.725A1.5 1.5 0 0 0 2.25 12Zm4.5-3.75a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">
                Pasarela de Pagos
              </h3>
              <p class="text-xs font-medium text-slate-400 dark:text-slate-500">
                Mercado Pago Connect (OAuth)
              </p>
            </div>
          </div>

          <span
            class={[
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase transition-all duration-300",
              isConnected
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
            ]}
          >
            <span
              class={[
                "h-1.5 w-1.5 rounded-full",
                isConnected ? "bg-emerald-500" : "bg-amber-500",
              ]}
            />
            {isConnected ? "Conectado" : "Desconectado"}
          </span>
        </div>

        {/* Cuerpo Principal del Estado */}
        {isConnected ? (
          <div class="space-y-5">
            <div class="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/10">
              <div class="flex items-start gap-3">
                <div class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    class="h-3.5 w-3.5"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h4 class="text-sm font-bold text-emerald-800 dark:text-emerald-400">
                    Vincuiación Exitosa
                  </h4>
                  <p class="mt-1 text-xs font-medium text-emerald-600/90 dark:text-emerald-500/90">
                    {merchantName ? (
                      <>
                        La cuenta del club{" "}
                        <strong class="font-extrabold">{merchantName}</strong>{" "}
                        está lista para recibir pagos.
                      </>
                    ) : (
                      "Tu cuenta de Mercado Pago está lista para recibir cobros en línea de forma directa y automatizada."
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/40">
              <div class="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Modo de Operación</span>
                <span class="font-bold text-amber-600 dark:text-amber-500">
                  Pruebas (Sandbox)
                </span>
              </div>
              <div class="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Comisión de Plataforma</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">
                  0.0%
                </span>
              </div>
            </div>

            <div class="text-center">
              <p class="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                ¿Necesitas cambiar de cuenta? Desconéctala desde la configuración
                avanzada del club.
              </p>
            </div>
          </div>
        ) : (
          <div class="space-y-6">
            <p class="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Vincula tu cuenta de **Mercado Pago** para automatizar el cobro de
              señas y reservas. Los clientes pagarán directo a tu cuenta y el
              sistema confirmará la cancha al instante.
            </p>

            {/* Botón Premium estilo Mercado Pago */}
            <a
              href={authorizationUrl.value}
              class="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[#009EE3] py-4 text-sm font-black tracking-widest text-white uppercase shadow-lg shadow-sky-500/20 transition-all duration-300 hover:scale-[1.02] hover:bg-[#0086C3] hover:shadow-xl hover:shadow-sky-500/30 active:scale-[0.98]"
            >
              {/* Reflejo/Gradiente de luz dinámico */}
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
              
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="h-5 w-5 shrink-0"
              >
                <path d="M5.25 6.375a.375.375 0 0 1 .375-.375h12.75a.375.375 0 0 1 .375.375v11.25a.375.375 0 0 1-.375.375H5.625a.375.375 0 0 1-.375-.375V6.375Z" />
                <path
                  fill-rule="evenodd"
                  d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM6.75 8.25a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 1.5 0v-6a.75.75 0 0 0-.75-.75Zm3.75.75a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75v-3Zm1.5.75v1.5h1.5v-1.5h-1.5Z"
                  clip-rule="evenodd"
                />
              </svg>
              Conectar Mercado Pago
            </a>

            {/* Aviso de Sandbox y Seguridad */}
            <div class="flex items-start gap-2.5 rounded-xl bg-slate-50/80 p-3.5 dark:bg-slate-800/20">
              <span class="mt-0.5 text-xs text-amber-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  class="h-4.5 w-4.5"
                >
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                    clip-rule="evenodd"
                  />
                </svg>
              </span>
              <p class="text-[11px] font-medium leading-relaxed text-slate-400 dark:text-slate-500">
                **Entorno Sandbox**: Se utilizarán credenciales de prueba. No se
                realizarán transacciones monetarias reales durante esta fase de
                desarrollo.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);
