import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import logo from "~/media/g184.png";

export type HomeNavbarUser = {
  userId: string;
  role: string;
  name: string;
  email: string | null;
  phone: string | null;
} | undefined;

type HomeNavbarProps = {
  user: HomeNavbarUser;
  showGalleryLink: boolean;
  showSchoolLink: boolean;
};

export const HomeNavbar = component$<HomeNavbarProps>(({ user, showGalleryLink, showSchoolLink }) => {
  return (
    <nav class="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#001407]">
      <div class="mx-auto flex h-28 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" class="group flex shrink-0 items-center py-1">
          <img
            src={logo}
            alt="Garden Club"
            width={393}
            height={451}
            class="h-[5.6875rem] w-auto object-contain object-left transition-transform group-hover:scale-105 sm:h-[6.5rem]"
          />
        </Link>
        <div class="hidden min-w-0 items-center gap-8 text-sm font-medium text-slate-200 md:flex">
          <a href="#historia" class="transition-colors hover:text-emerald-400">Historia</a>
          <a href="#canchas" class="transition-colors hover:text-emerald-400">Canchas</a>
          {showSchoolLink && (
            <a href="#escuelita" class="transition-colors hover:text-emerald-400">Escuelita</a>
          )}
          {showGalleryLink && (
            <a href="#galeria" class="transition-colors hover:text-emerald-400">Galería</a>
          )}
          <a href="#contacto" class="transition-colors hover:text-emerald-400">Contacto</a>

          {(user?.role === "DEV" || user?.role === "OWNER" || user?.role === "MANAGER" || user?.role === "EMPLOYEE") && (
            <a
              href="/admin/calendar"
              class="rounded-full bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
            >
              Panel Admin
            </a>
          )}

          {user ? (
            <div class="relative group/user">
              <button
                type="button"
                class="flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 transition-all hover:bg-emerald-500/20"
              >
                <span class="flex h-7 w-7 select-none items-center justify-center rounded-full bg-emerald-500 text-xs font-black uppercase text-white">
                  {user.name?.[0] ?? "U"}
                </span>
                <span class="max-w-[120px] truncate text-sm font-bold text-white">
                  {user.name ?? "Mi cuenta"}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-400 transition-colors group-hover/user:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              <div class="invisible absolute right-0 top-full z-50 mt-2 w-56 translate-y-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 opacity-0 shadow-2xl shadow-black/50 transition-all duration-150 group-hover/user:visible group-hover/user:translate-y-0 group-hover/user:opacity-100">
                <div class="border-b border-white/5 px-4 py-3">
                  <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Sesión activa</p>
                  <p class="mt-0.5 truncate text-sm font-bold text-white">{user.name}</p>
                  <p class="truncate text-xs text-slate-400">{user.email}</p>
                </div>
                <Link
                  href="/cuenta"
                  class="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Mis Reservas
                </Link>
                <form method="POST" action="/api/auth/logout">
                  <button
                    type="submit"
                    class="flex w-full items-center gap-3 border-t border-white/5 px-4 py-3 text-sm text-red-400 transition-colors hover:bg-red-500/5 hover:text-red-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Cerrar sesión
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <Link href="/auth/login" class="transition-colors hover:text-white">
              Iniciar Sesión
            </Link>
          )}

          <a
            href="#canchas"
            class="rounded-full border border-white/20 bg-white px-6 py-2.5 font-black uppercase tracking-widest text-[#001407] shadow-lg shadow-black/25 transition-all hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-black/30"
          >
            Reservar
          </a>
        </div>
      </div>
    </nav>
  );
});
