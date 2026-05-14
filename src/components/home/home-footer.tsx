import { component$ } from "@builder.io/qwik";

export const HomeFooter = component$(() => {
  const year = new Date().getFullYear();

  return (
    <footer class="relative z-20 border-t border-white/10 bg-slate-950 py-12">
      <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 text-center md:flex-row md:text-left lg:px-8">
        <div>
          <div class="text-2xl font-black uppercase tracking-tighter text-white">
            Sport<span class="text-emerald-400">Garden</span>
          </div>
          <p class="mt-2 text-sm text-slate-500">Las mejores canchas, el mejor tercer tiempo.</p>
        </div>
        <div class="flex gap-6">
          <a href="#inicio" class="text-sm font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-emerald-400">
            Inicio
          </a>
          <a href="#historia" class="text-sm font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-emerald-400">
            Historia
          </a>
          <a href="#canchas" class="text-sm font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-emerald-400">
            Canchas
          </a>
        </div>
        <p class="mt-4 text-xs text-slate-600 md:mt-0">
          © {year} GardenClubFutbol. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
});
