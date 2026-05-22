import { component$ } from "@builder.io/qwik";

export interface MercadoPagoConnectButtonProps {
  clientId: string;
  redirectUri: string;
  isConnected?: boolean;
}

export const MercadoPagoConnectButton = component$<MercadoPagoConnectButtonProps>(
  ({ clientId, redirectUri, isConnected = false }) => {
    // Si la cuenta ya está conectada, mostramos un indicador de éxito
    if (isConnected) {
      return (
        <div class="flex w-full items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M7.75 12L10.58 14.83L16.25 9.17004"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
            <div>
              <p class="text-sm font-bold text-emerald-800">
                Cuenta Conectada
              </p>
              <p class="text-xs font-medium text-emerald-600">
                Cobros automáticos habilitados
              </p>
            </div>
          </div>
          {/* Aquí se podría agregar un botón para "Desconectar" si el negocio lo requiere */}
        </div>
      );
    }

    // URL de Autorización de MercadoPago
    const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&redirect_uri=${redirectUri}`;

    return (
      <a
        href={authUrl}
        class="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#009EE3] py-4 text-sm font-black tracking-widest text-white uppercase shadow-md shadow-blue-200 transition-all hover:bg-[#0086C3] active:scale-[0.98]"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="shrink-0"
        >
          <path
            d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
            fill="currentColor"
          />
          <path
            d="M11 17L17 11L15.59 9.59L11 14.17L8.41 11.59L7 13L11 17Z"
            fill="currentColor"
          />
        </svg>
        Conectar con MercadoPago
      </a>
    );
  }
);
