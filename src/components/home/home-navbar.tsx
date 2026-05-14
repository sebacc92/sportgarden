import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import logo from "~/media/g184.png";

export type HomeNavbarUser = { userId: string; role: string } | undefined;

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
          <a href="#historia" class="transition-colors hover:text-emerald-400">
            Historia
          </a>
          <a href="#canchas" class="transition-colors hover:text-emerald-400">
            Canchas
          </a>
          {showSchoolLink && (
            <a href="#escuelita" class="transition-colors hover:text-emerald-400">
              Escuelita
            </a>
          )}
          {showGalleryLink && (
            <a href="#galeria" class="transition-colors hover:text-emerald-400">
              Galería
            </a>
          )}
          <a href="#contacto" class="transition-colors hover:text-emerald-400">
            Contacto
          </a>
          {user?.role === "ADMIN" && (
            <a
              href="/admin/calendar"
              class="rounded-full bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
            >
              Panel Admin
            </a>
          )}
          {user ? (
            <div class="flex items-center gap-4">
              <span class="font-bold text-emerald-400">Hola!</span>
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
