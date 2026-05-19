import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export default component$((props: { message?: string }) => {
  return (
    <div class="min-h-screen bg-slate-950 pt-36 pb-20 font-sans text-white selection:bg-red-500 selection:text-white">
      {/* Background navbar filler */}
      <div class="fixed inset-x-0 top-0 z-40 h-28 bg-[#001407]"></div>

      <div class="mx-auto max-w-xl px-6 lg:px-8">
        <div class="overflow-hidden rounded-3xl border border-red-500/20 bg-slate-900/60 p-8 text-center shadow-2xl shadow-red-950/20 backdrop-blur-md">
          {/* Error Icon */}
          <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 shadow-lg shadow-red-950">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-10 w-10 animate-pulse"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          {/* Heading */}
          <h1 class="text-2xl font-black tracking-tight text-white uppercase sm:text-3xl">
            ¡Pago Rechazado!
          </h1>
          <p class="mt-2 text-sm text-red-355 font-medium">
            {props.message || "Tu transacción no pudo ser procesada. No se realizó ningún cargo."}
          </p>

          {/* Details */}
          <div class="my-8 rounded-2xl border border-white/5 bg-slate-950/50 p-5 text-left space-y-3.5 text-sm font-semibold">
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-slate-500 uppercase">Estado</span>
              <span class="rounded bg-red-500/10 px-2.5 py-0.5 text-xs font-black text-red-450 uppercase">
                Rechazado / Cancelado
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-slate-500 uppercase">Motivo</span>
              <span class="text-slate-300 text-right">Cancelado por el usuario o fondos insuficientes</span>
            </div>
          </div>

          {/* Suggestions block */}
          <div class="rounded-2xl border border-white/5 bg-red-500/5 p-4 mb-8 text-left text-xs leading-relaxed font-semibold text-slate-350">
            <p class="mb-1 font-black text-red-400 text-sm">💡 Sugerencia:</p>
            Revisa los datos de tu tarjeta, asegúrate de contar con límite suficiente o selecciona otro medio de pago (como efectivo o transferencia bancaria) e intenta nuevamente.
          </div>

          {/* Actions */}
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/checkout"
              class="flex items-center justify-center gap-2 rounded-xl bg-red-500 py-3.5 text-xs font-black tracking-wider text-white uppercase shadow-lg shadow-red-500/15 transition-all hover:bg-red-650 active:scale-[0.98]"
            >
              Reintentar Pago
            </Link>
            <Link
              href="/"
              class="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-slate-800 py-3.5 text-xs font-black tracking-wider text-white uppercase transition-all hover:bg-slate-700 active:scale-[0.98]"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head = {
  title: "Pago Fallido - Garden Club",
};
