import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export default component$((props: { message?: string }) => {
  return (
    <div class="min-h-screen bg-slate-950 pt-36 pb-20 font-sans text-white selection:bg-amber-500 selection:text-white">
      {/* Background navbar filler */}
      <div class="fixed inset-x-0 top-0 z-40 h-28 bg-[#001407]"></div>

      <div class="mx-auto max-w-xl px-6 lg:px-8">
        <div class="overflow-hidden rounded-3xl border border-amber-500/20 bg-slate-900/60 p-8 text-center shadow-2xl shadow-amber-950/20 backdrop-blur-md">
          {/* Pending Icon */}
          <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-950">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-10 w-10 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{ animationDuration: "3s" }}
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          {/* Heading */}
          <h1 class="text-2xl font-black tracking-tight text-white uppercase sm:text-3xl">
            ¡Pago en Proceso!
          </h1>
          <p class="mt-2 text-sm text-amber-355 font-medium">
            {props.message || "Mercado Pago está procesando tu pago. Esto puede demorar unos minutos."}
          </p>

          {/* Details */}
          <div class="my-8 rounded-2xl border border-white/5 bg-slate-950/50 p-5 text-left space-y-3.5 text-sm font-semibold">
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-slate-500 uppercase">Estado</span>
              <span class="rounded bg-amber-500/10 px-2.5 py-0.5 text-xs font-black text-amber-450 uppercase">
                Pendiente / En Proceso
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-slate-500 uppercase">Acreditación</span>
              <span class="text-slate-300 text-right">Sujeto a confirmación bancaria</span>
            </div>
          </div>

          {/* Info notice */}
          <div class="rounded-2xl border border-white/5 bg-amber-500/5 p-4 mb-8 text-left text-xs leading-relaxed font-semibold text-slate-350">
            <p class="mb-1 font-black text-amber-400 text-sm">⏳ ¿Qué debo hacer?</p>
            No es necesario realizar otro pago. Tan pronto como Mercado Pago nos notifique la aprobación (recibirás un e-mail confirmando la acreditación), actualizaremos automáticamente el estado de tu turno.
          </div>

          {/* Actions */}
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/cuenta"
              class="flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-xs font-black tracking-wider text-white uppercase shadow-lg shadow-amber-500/15 transition-all hover:bg-amber-600 active:scale-[0.98]"
            >
              Ver Mis Reservas
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
  title: "Pago Pendiente - Garden Club",
};
