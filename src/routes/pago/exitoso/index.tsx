import { component$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";

export default component$(() => {
  const loc = useLocation();
  const paymentId = loc.url.searchParams.get("payment_id") || "N/D";

  return (
    <div class="min-h-screen bg-slate-950 pt-36 pb-20 font-sans text-white selection:bg-emerald-500 selection:text-white">
      {/* Background navbar filler */}
      <div class="fixed inset-x-0 top-0 z-40 h-28 bg-[#001407]"></div>

      <div class="mx-auto max-w-xl px-6 lg:px-8">
        <div class="overflow-hidden rounded-3xl border border-emerald-500/20 bg-slate-900/60 p-8 text-center shadow-2xl shadow-emerald-950/20 backdrop-blur-md">
          {/* Success Check Icon */}
          <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-950">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-10 w-10 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Heading */}
          <h1 class="text-2xl font-black tracking-tight text-white uppercase sm:text-3xl">
            ¡Pago Aprobado!
          </h1>
          <p class="mt-2 text-sm text-emerald-350 font-medium">
            Tu reserva ha sido confirmada con éxito.
          </p>

          {/* Details */}
          <div class="my-8 rounded-2xl border border-white/5 bg-slate-950/50 p-5 text-left space-y-3.5 text-sm font-semibold">
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-slate-500 uppercase">Estado</span>
              <span class="rounded bg-emerald-500/10 px-2.5 py-0.5 text-xs font-black text-emerald-400 uppercase">
                Aprobado
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-slate-500 uppercase">Servicio</span>
              <span class="text-white text-right">Reserva de Cancha - Garden Club</span>
            </div>
            {paymentId !== "N/D" && (
              <div class="flex justify-between items-center border-t border-white/5 pt-3.5">
                <span class="text-xs font-bold text-slate-500 uppercase">ID de Pago</span>
                <span class="font-mono text-xs text-slate-300">{paymentId}</span>
              </div>
            )}
          </div>

          {/* Direct WhatsApp Call to Action */}
          <div class="rounded-2xl border border-white/5 bg-emerald-500/5 p-4 mb-8 text-left text-xs leading-relaxed font-semibold text-slate-350">
            <p class="mb-1 font-black text-emerald-400 text-sm">⚽ ¡Todo listo para jugar!</p>
            Te hemos enviado un correo electrónico con el comprobante de tu reserva. Si necesitas realizar consultas sobre tu turno o equipamiento, contáctanos directo a nuestro canal de soporte.
          </div>

          {/* Actions */}
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/cuenta"
              class="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-xs font-black tracking-wider text-white uppercase shadow-lg shadow-emerald-500/15 transition-all hover:bg-emerald-600 active:scale-[0.98]"
            >
              Mis Reservas
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
  title: "Pago Exitoso - Garden Club",
};
