import { component$, useStylesScoped$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import logo from "~/media/logo-removebg-preview.png";

export default component$(() => {
  useStylesScoped$(`
    @keyframes float {
      0%, 100% {
        transform: translateY(0) rotate(0deg);
      }
      50% {
        transform: translateY(-15px) rotate(5deg);
      }
    }
    @keyframes pulse-glow {
      0%, 100% {
        opacity: 0.15;
        transform: scale(1);
      }
      50% {
        opacity: 0.35;
        transform: scale(1.08);
      }
    }
    .animate-float {
      animation: float 6s ease-in-out infinite;
    }
    .animate-pulse-glow {
      animation: pulse-glow 5s ease-in-out infinite;
    }
  `);

  return (
    <div class="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-[#000d04] font-sans text-white selection:bg-emerald-500 selection:text-white">
      {/* Background soccer field diagram lines */}
      <div class="absolute inset-0 z-0 opacity-[0.07] pointer-events-none">
        <svg class="h-full w-full stroke-white/50" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Pitch outline */}
          <rect x="4" y="4" width="92" height="92" fill="none" stroke-width="0.25" />
          {/* Halfway line */}
          <line x1="4" y1="50" x2="96" y2="50" stroke-width="0.25" />
          {/* Center circle */}
          <circle cx="50" cy="50" r="14" fill="none" stroke-width="0.25" />
          <circle cx="50" cy="50" r="0.4" fill="white" />
          {/* Penalty areas */}
          <rect x="28" y="4" width="44" height="14" fill="none" stroke-width="0.25" />
          <rect x="28" y="82" width="44" height="14" fill="none" stroke-width="0.25" />
          {/* Goal areas */}
          <rect x="38" y="4" width="24" height="5" fill="none" stroke-width="0.25" />
          <rect x="38" y="91" width="24" height="5" fill="none" stroke-width="0.25" />
        </svg>
      </div>

      {/* Radial green stadium light glow */}
      <div class="animate-pulse-glow absolute top-1/2 left-1/2 z-0 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none"></div>

      {/* Header bar with Logo */}
      <header class="relative z-10 w-full px-6 py-8 lg:px-12 flex justify-center border-b border-white/5 bg-gradient-to-b from-black/20 to-transparent">
        <Link href="/" class="group transition-transform duration-300 hover:scale-105">
          <img
            src={logo}
            alt="Sport Garden"
            width={200}
            height={62}
            class="h-12 w-auto object-contain"
          />
        </Link>
      </header>

      {/* Main Content */}
      <main class="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 py-12 text-center">
        {/* Floating Soccer Ball with Shadow */}
        <div class="relative mb-6 flex h-36 w-36 items-center justify-center">
          {/* Soccer ball emoji with glowing shadow */}
          <div class="animate-float text-7xl md:text-8xl filter drop-shadow-[0_12px_15px_rgba(16,185,129,0.4)] select-none">
            ⚽
          </div>
          {/* Levitating shadow beneath the ball */}
          <div class="absolute bottom-2 left-1/2 h-2 w-16 -translate-x-1/2 rounded-full bg-black/60 blur-md pointer-events-none"></div>
        </div>

        {/* Stadium Scoreboard styled 404 */}
        <div class="mb-6 inline-flex flex-col items-center rounded-3xl border border-white/10 bg-slate-900/70 p-6 px-10 shadow-2xl backdrop-blur-md select-none">
          <span class="text-[10px] font-black tracking-widest text-emerald-450 uppercase opacity-90">
            MARCADOR DEL ESTADIO
          </span>
          <h1 class="mt-2 text-7xl font-extrabold tracking-tighter text-red-500 md:text-8xl font-mono filter drop-shadow-[0_0_12px_rgba(239,68,68,0.45)]">
            404
          </h1>
          <span class="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            FUERA DE JUEGO (OFFSIDE)
          </span>
        </div>

        {/* Thematic Message */}
        <h2 class="text-2xl font-black md:text-3xl text-white tracking-tight uppercase px-4 leading-tight">
          ¡Tarjeta Roja! Página fuera de juego
        </h2>
        <p class="mt-3 max-w-md text-sm md:text-base leading-relaxed text-slate-400 font-medium px-2">
          El pase fue demasiado largo o la jugada se detuvo. La página que estás buscando no se encuentra dentro del campo de juego.
        </p>

        {/* Action Buttons */}
        <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md px-6">
          <Link
            href="/"
            class="flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-full bg-emerald-500 px-8 py-4 text-sm font-black tracking-wider text-white uppercase shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-emerald-650/30 active:scale-98"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4.5 w-4.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Volver al Inicio
          </Link>
          <Link
            href="/#canchas"
            class="flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-bold tracking-wider text-slate-200 transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:text-white active:scale-98"
          >
            Reservar Cancha
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer class="relative z-10 w-full py-6 text-center text-[10px] font-bold text-slate-600 uppercase tracking-widest border-t border-white/5 bg-black/10">
        &copy; {new Date().getFullYear()} Sport Garden Club. Todos los derechos reservados.
      </footer>
    </div>
  );
});

export const head = {
  title: "Página no encontrada - SportGarden",
};
