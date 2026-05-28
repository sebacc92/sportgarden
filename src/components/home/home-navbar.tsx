import { component$, useSignal, useStylesScoped$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

import logoMobile from "~/media/logo-mobile-removebg-preview.png";
import logoDesktop from "~/media/logo-removebg-preview.png";

export type HomeNavbarUser =
  | {
    userId: string;
    role: string;
    name: string;
    email: string | null;
    phone: string | null;
  }
  | undefined;

type HomeNavbarProps = {
  user: HomeNavbarUser;
  showGalleryLink: boolean;
  showSchoolLink: boolean;
  showStoreLink?: boolean;
};

export const HomeNavbar = component$<HomeNavbarProps>(
  ({ user, showGalleryLink, showSchoolLink, showStoreLink }) => {
    const isMobileMenuOpen = useSignal(false);

    useStylesScoped$(`
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-fade-in-down {
        animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
    `);

    return (
      <nav class="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#001407]">
        <div class="mx-auto flex h-28 max-w-[96rem] items-center justify-between px-6 lg:px-10 xl:px-12">
          <Link href="/" class="group flex shrink-0 items-center py-3">
            <img
              src={logoMobile}
              alt="Sport Garden"
              width={200}
              height={200}
              class="h-20 w-auto object-contain transition-all duration-300 hover:scale-105 lg:hidden"
            />
            <img
              src={logoDesktop}
              alt="Sport Garden"
              width={300}
              height={92}
              class="hidden h-16 w-auto object-contain transition-all duration-300 hover:scale-105 lg:block xl:h-[72px] 2xl:h-20"
            />
          </Link>

          {/* Desktop Menu */}
          <div class="hidden items-center gap-4 text-sm font-bold tracking-wide text-slate-200 lg:flex xl:gap-6 xl:text-base 2xl:gap-8">
            <a
              href="#historia"
              class="transition-colors hover:text-emerald-400"
            >
              Historia
            </a>
            <a href="#canchas" class="transition-colors hover:text-emerald-400">
              Canchas
            </a>
            {showSchoolLink && (
              <a
                href="#escuelita"
                class="transition-colors hover:text-emerald-400"
              >
                Escuelita
              </a>
            )}
            {showGalleryLink && (
              <a
                href="#galeria"
                class="transition-colors hover:text-emerald-400"
              >
                Galería
              </a>
            )}
            {showStoreLink && (
              <a
                href="#tienda"
                class="transition-colors hover:text-emerald-400"
              >
                Tienda
              </a>
            )}
            <a
              href="#contacto"
              class="transition-colors hover:text-emerald-400"
            >
              Contacto
            </a>

            {(user?.role === "DEV" ||
              user?.role === "OWNER" ||
              user?.role === "MANAGER" ||
              user?.role === "EMPLOYEE") && (
                <a
                  href="/admin/calendar"
                  class="rounded-full bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
                >
                  Panel Admin
                </a>
              )}

            {user ? (
              <div class="group/user relative">
                <button
                  type="button"
                  class="flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 transition-all hover:bg-emerald-500/20"
                >
                  <span class="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-white uppercase select-none">
                    {user.name?.[0] ?? "U"}
                  </span>
                  <span class="max-w-[120px] truncate text-sm font-bold text-white">
                    {user.name ?? "Mi cuenta"}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3.5 w-3.5 text-slate-400 transition-colors group-hover/user:text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2.5"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown */}
                <div class="invisible absolute top-full right-0 z-50 mt-2 w-56 translate-y-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 opacity-0 shadow-2xl shadow-black/50 transition-all duration-150 group-hover/user:visible group-hover/user:translate-y-0 group-hover/user:opacity-100">
                  <div class="border-b border-white/5 px-4 py-3">
                    <p class="text-xs font-bold tracking-wider text-slate-500 uppercase">
                      Sesión activa
                    </p>
                    <p class="mt-0.5 truncate text-sm font-bold text-white">
                      {user.name}
                    </p>
                    <p class="truncate text-xs text-slate-400">{user.email}</p>
                  </div>
                  <Link
                    href="/cuenta"
                    class="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Mis Reservas
                  </Link>
                  <form method="POST" action="/api/logout">
                    <button
                      type="submit"
                      class="flex w-full items-center gap-3 border-t border-white/5 px-4 py-3 text-sm text-red-400 transition-colors hover:bg-red-500/5 hover:text-red-300"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Cerrar sesión
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <Link
                href="/auth/login"
                class="inline-flex items-center justify-center text-center rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition-all hover:bg-white/10 hover:border-white/40 hover:text-white"
              >
                Iniciar Sesión
              </Link>
            )}

            <a
              href="#canchas"
              class="rounded-full border border-white/20 bg-white px-4 py-2 font-black tracking-widest text-[#001407] uppercase shadow-lg shadow-black/25 transition-all hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-black/30 xl:px-6 xl:py-2.5"
            >
              Reservar
            </a>

            <a
              href="https://www.instagram.com/gardenclubfutbol/"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center text-slate-200 transition-colors hover:text-emerald-400 ml-2"
              aria-label="Instagram"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5.5 w-5.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
          </div>

          {/* Hamburger button (Mobile Only) */}
          <button
            onClick$={() => {
              isMobileMenuOpen.value = !isMobileMenuOpen.value;
            }}
            class="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition-all hover:bg-white/10 hover:text-white active:scale-95 lg:hidden"
            aria-label="Abrir menú"
          >
            {isMobileMenuOpen.value ? (
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu Dropdown (Glassmorphism Slide Down) */}
        {isMobileMenuOpen.value && (
          <div class="animate-fade-in-down fixed inset-x-0 top-28 z-40 h-[calc(100vh-7rem)] overflow-y-auto border-t border-white/10 bg-[#001407]/95 backdrop-blur-xl lg:hidden">
            <div class="flex flex-col gap-5 px-6 py-8">
              <a
                href="#historia"
                onClick$={() => {
                  isMobileMenuOpen.value = false;
                }}
                class="rounded-xl px-4 py-3 text-lg font-bold tracking-wider text-slate-200 transition-colors hover:bg-white/5 hover:text-emerald-400 border-b border-white/5"
              >
                Historia
              </a>
              <a
                href="#canchas"
                onClick$={() => {
                  isMobileMenuOpen.value = false;
                }}
                class="rounded-xl px-4 py-3 text-lg font-bold tracking-wider text-slate-200 transition-colors hover:bg-white/5 hover:text-emerald-400 border-b border-white/5"
              >
                Canchas
              </a>
              {showSchoolLink && (
                <a
                  href="#escuelita"
                  onClick$={() => {
                    isMobileMenuOpen.value = false;
                  }}
                  class="rounded-xl px-4 py-3 text-lg font-bold tracking-wider text-slate-200 transition-colors hover:bg-white/5 hover:text-emerald-400 border-b border-white/5"
                >
                  Escuelita
                </a>
              )}
              {showGalleryLink && (
                <a
                  href="#galeria"
                  onClick$={() => {
                    isMobileMenuOpen.value = false;
                  }}
                  class="rounded-xl px-4 py-3 text-lg font-bold tracking-wider text-slate-200 transition-colors hover:bg-white/5 hover:text-emerald-400 border-b border-white/5"
                >
                  Galería
                </a>
              )}
              {showStoreLink && (
                <a
                  href="#tienda"
                  onClick$={() => {
                    isMobileMenuOpen.value = false;
                  }}
                  class="rounded-xl px-4 py-3 text-lg font-bold tracking-wider text-slate-200 transition-colors hover:bg-white/5 hover:text-emerald-400 border-b border-white/5"
                >
                  Tienda
                </a>
              )}
              <a
                href="#contacto"
                onClick$={() => {
                  isMobileMenuOpen.value = false;
                }}
                class="rounded-xl px-4 py-3 text-lg font-bold tracking-wider text-slate-200 transition-colors hover:bg-white/5 hover:text-emerald-400 border-b border-white/5"
              >
                Contacto
              </a>

              <a
                href="https://www.instagram.com/gardenclubfutbol/"
                target="_blank"
                rel="noopener noreferrer"
                onClick$={() => {
                  isMobileMenuOpen.value = false;
                }}
                class="rounded-xl px-4 py-3 text-lg font-bold tracking-wider text-slate-200 transition-colors hover:bg-white/5 hover:text-emerald-400 border-b border-white/5 flex items-center gap-3"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5.5 w-5.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                <span>Instagram</span>
              </a>

              {(user?.role === "DEV" ||
                user?.role === "OWNER" ||
                user?.role === "MANAGER" ||
                user?.role === "EMPLOYEE") && (
                  <a
                    href="/admin/calendar"
                    onClick$={() => {
                      isMobileMenuOpen.value = false;
                    }}
                    class="mx-auto flex w-full max-w-xs items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30 px-6 py-3 text-base font-bold text-emerald-400 transition-all hover:bg-emerald-500/30"
                  >
                    Panel Admin
                  </a>
                )}

              {user ? (
                <div class="flex flex-col gap-4 border-t border-white/10 pt-6">
                  <div class="px-4 text-center">
                    <p class="text-xs font-bold tracking-widest text-slate-400 uppercase">
                      Sesión activa
                    </p>
                    <p class="truncate text-sm font-bold text-white">{user.name}</p>
                  </div>
                  <Link
                    href="/cuenta"
                    onClick$={() => {
                      isMobileMenuOpen.value = false;
                    }}
                    class="mx-auto flex w-full max-w-xs items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-base font-bold text-white transition-all hover:bg-white/10"
                  >
                    Mis Reservas
                  </Link>
                  <form method="POST" action="/api/logout" class="mx-auto w-full max-w-xs">
                    <button
                      type="submit"
                      onClick$={() => {
                        isMobileMenuOpen.value = false;
                      }}
                      class="flex w-full items-center justify-center gap-2 rounded-full bg-red-500/10 border border-red-500/30 px-6 py-3 text-base font-bold text-red-400 transition-all hover:bg-red-500/20"
                    >
                      Cerrar sesión
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  class="mx-auto flex w-full max-w-xs items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-base font-bold text-white transition-all hover:bg-white/10"
                >
                  Iniciar Sesión
                </Link>
              )}

              <a
                href="#canchas"
                onClick$={() => {
                  isMobileMenuOpen.value = false;
                }}
                class="mx-auto mt-4 flex w-full max-w-xs items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-black tracking-widest text-[#001407] uppercase shadow-lg shadow-black/25 transition-all hover:bg-slate-100 hover:shadow-black/35"
              >
                Reservar Cancha
              </a>
            </div>
          </div>
        )}
      </nav>
    );
  },
);
