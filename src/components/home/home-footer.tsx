import { component$ } from "@builder.io/qwik";
import logo from "~/media/garden-logo-transparente.png";
import {
  groupOperatingHoursForDisplay,
  type OperatingHourRow,
} from "~/lib/home-page/operating-hours";

export interface HomeFooterProps {
  settings?: {
    clubAddress?: string | null;
    clubPhone?: string | null;
    whatsappNumber?: string | null;
    operatingHours?: OperatingHourRow[] | null;
  };
}

export const HomeFooter = component$<HomeFooterProps>(({ settings }) => {
  const year = new Date().getFullYear();

  const address = settings?.clubAddress || "San Miguel, Buenos Aires";
  const rawHours = settings?.operatingHours || [];
  const hourGroups = groupOperatingHoursForDisplay(rawHours);
  const whatsapp = settings?.clubPhone || settings?.whatsappNumber || "";

  let whatsappUrl = "";
  if (whatsapp) {
    let cleanPhone = whatsapp.replace(/\D/g, "");
    if (cleanPhone.length === 10) {
      cleanPhone = "549" + cleanPhone;
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith("11")) {
      cleanPhone = "549" + cleanPhone;
    }
    whatsappUrl = `https://wa.me/${cleanPhone}`;
  }

  return (
    <footer class="relative z-20 border-t border-white/5 bg-[#001407] text-slate-400">
      <div class="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        {/* Main Footer Content */}
        <div class="grid grid-cols-1 gap-12 sm:grid-cols-2 md:grid-cols-4 lg:gap-16">
          {/* Column 1: Logo & Slogan */}
          <div class="flex flex-col items-center space-y-5 md:items-start">
            <img
              src={logo}
              alt="Garden Club Logo"
              width={320}
              height={368}
              class="h-44 w-auto object-contain transition-transform duration-500 hover:scale-105 sm:h-52 md:h-64"
            />
            <p class="max-w-xs text-center text-sm leading-relaxed text-slate-400 md:text-left">
              Las mejores canchas, el mejor tercer tiempo. Viví la experiencia premium en Garden Club Fútbol.
            </p>
          </div>

          {/* Column 2: Navigation Links */}
          <div class="flex flex-col items-center md:items-start">
            <h4 class="mb-5 text-xs font-black tracking-[0.2em] text-white uppercase select-none">
              Navegación
            </h4>
            <ul class="space-y-3 text-center text-sm md:text-left">
              <li>
                <a
                  href="#inicio"
                  class="transition-colors hover:text-emerald-400"
                >
                  Inicio
                </a>
              </li>
              <li>
                <a
                  href="#historia"
                  class="transition-colors hover:text-emerald-400"
                >
                  Nuestra Historia
                </a>
              </li>
              <li>
                <a
                  href="#canchas"
                  class="transition-colors hover:text-emerald-400"
                >
                  Nuestras Canchas
                </a>
              </li>
              <li>
                <a
                  href="#escuelita"
                  class="transition-colors hover:text-emerald-400"
                >
                  Escuelita de Fútbol
                </a>
              </li>
              <li>
                <a
                  href="#galeria"
                  class="transition-colors hover:text-emerald-400"
                >
                  Instalaciones
                </a>
              </li>
              <li>
                <a
                  href="#contacto"
                  class="transition-colors hover:text-emerald-400"
                >
                  Contacto
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: The Club Info */}
          <div class="flex flex-col items-center md:items-start">
            <h4 class="mb-5 text-xs font-black tracking-[0.2em] text-white uppercase select-none">
              El Club
            </h4>
            <ul class="space-y-4 text-center text-sm text-slate-400 md:text-left">
              <li class="flex flex-col items-center gap-1 md:flex-row md:items-start md:gap-3">
                <span class="text-base">⏰</span>
                <div>
                  <span class="block font-bold text-slate-300">Horarios</span>
                  {hourGroups.map((g) => (
                    <span key={g.label} class="block text-xs text-slate-500">
                      {g.label}: {g.time} hs
                    </span>
                  ))}
                </div>
              </li>
              <li class="flex flex-col items-center gap-1 md:flex-row md:items-start md:gap-3">
                <span class="text-base">⚽</span>
                <div>
                  <span class="block font-bold text-slate-300">Canchas Premium</span>
                  <span class="text-xs text-slate-500">Complejo F5, F6 y F9 profesional</span>
                </div>
              </li>
              <li class="flex flex-col items-center gap-1 md:flex-row md:items-start md:gap-3">
                <span class="text-base">🍻</span>
                <div>
                  <span class="block font-bold text-slate-300">Tercer Tiempo</span>
                  <span class="text-xs text-slate-500">Buffet completo y área social</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Action */}
          <div class="flex flex-col items-center md:items-start">
            <h4 class="mb-5 text-xs font-black tracking-[0.2em] text-white uppercase select-none">
              Contacto
            </h4>
            <ul class="mb-6 space-y-3.5 text-center text-sm text-slate-400 md:text-left">
              <li class="flex items-center justify-center gap-2.5 md:justify-start">
                <span class="text-emerald-400">📍</span>
                <span>{address}</span>
              </li>
              {whatsapp && (
                <li class="flex items-center justify-center gap-2.5 md:justify-start">
                  <span class="text-emerald-400">💬</span>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="transition-colors hover:text-emerald-400 font-medium"
                  >
                    WhatsApp: {whatsapp}
                  </a>
                </li>
              )}
            </ul>
            <a
              href="#canchas"
              class="inline-flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-5 py-2.5 text-xs font-black tracking-widest text-emerald-400 uppercase transition-all duration-300 hover:bg-emerald-500 hover:text-white"
            >
              Reservar Online
            </a>
          </div>
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <div class="bg-black py-8 border-t border-white/5">
        <div class="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col items-center justify-between gap-4 text-xs text-slate-500 md:flex-row">
          <p class="text-center md:text-left">
            © {year} GardenClubFutbol. Todos los derechos reservados.
          </p>
          <p class="text-center font-medium md:text-right">
            Desarrollado por{" "}
            <a
              href="https://indesign.ar"
              target="_blank"
              rel="noopener noreferrer"
              class="font-black text-slate-400 transition-colors hover:text-emerald-400"
            >
              INDESIGN
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
});
