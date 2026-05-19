import { component$, type JSXOutput } from "@builder.io/qwik";
import { DEFAULT_CLUB_SERVICES } from "~/lib/home-page/constants";
import {
  groupOperatingHoursForDisplay,
  type OperatingHourRow,
} from "~/lib/home-page/operating-hours";

export type HomeContactSettings = {
  clubAddress?: string | null;
  operatingHours?: OperatingHourRow[] | null;
  services?: string[] | null;
};

type ContactSectionProps = {
  settings: HomeContactSettings;
  theme?: "light" | "dark";
};

const ServiceIcon = component$<{ label: string; isLight?: boolean }>(
  ({ label, isLight = false }) => {
    const lowS = label.toLowerCase();

    const iconMap: Record<string, JSXOutput> = {
      "wi-fi": (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 20h.01" />
          <path d="M2 8.82a15 15 0 0 1 20 0" />
          <path d="M5 12.859a10 10 0 0 1 14 0" />
          <path d="M8.5 16.429a5 5 0 0 1 7 0" />
        </svg>
      ),
      vestuario: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
        </svg>
      ),
      "ayuda médica": (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      ),
      torneos: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      ),
      colegios: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m22 10-10-5L2 10l10 5 10-5z" />
          <path d="M6 12v5c3 3 9 3 12 0v5" />
          <path d="M11 10v4" />
        </svg>
      ),
      bar: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 3h18l-2 9H5L3 3z" />
          <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
          <path d="m9 3 1 9" />
          <path d="m15 3-1 9" />
        </svg>
      ),
      estacionamiento: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect width="18" height="12" x="3" y="10" rx="2" />
          <path d="M7 10V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6" />
          <circle cx="7" cy="15" r="1" />
          <circle cx="17" cy="15" r="1" />
        </svg>
      ),
      cumpleaños: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    };

    let icon: JSXOutput = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );

    for (const key of Object.keys(iconMap)) {
      if (lowS.includes(key)) icon = iconMap[key]!;
    }

    return (
      <div class="group/item flex items-center gap-3">
        <div
          class={[
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            isLight
              ? "bg-slate-100 text-emerald-600 group-hover/item:bg-emerald-500 group-hover/item:text-white"
              : "bg-slate-800 text-emerald-400 group-hover/item:bg-emerald-500 group-hover/item:text-white",
          ]}
        >
          {icon}
        </div>
        <span
          class={[
            "text-xs font-bold transition-colors",
            isLight
              ? "text-slate-700 group-hover/item:text-emerald-700"
              : "text-slate-300 group-hover/item:text-white",
          ]}
        >
          {label}
        </span>
      </div>
    );
  },
);

export const ContactSection = component$<ContactSectionProps>(
  ({ settings, theme = "dark" }) => {
    const isLight = theme === "light";
    const address =
      settings.clubAddress || "Pedro moran 2379. Capital Federal. Argentina";
    const mapQuery = settings.clubAddress || "Pedro Moran 2379, CABA";
    const hoursRows =
      (settings.operatingHours as OperatingHourRow[] | undefined) ?? [];
    const hourGroups = groupOperatingHoursForDisplay(hoursRows);
    const services = (settings.services as string[] | undefined)?.length
      ? (settings.services as string[])
      : [...DEFAULT_CLUB_SERVICES];

    return (
      <section
        id="contacto"
        class={[
          "relative z-20 w-full py-24 transition-colors duration-500",
          isLight ? "bg-[#F5F2EB]" : "bg-slate-950",
        ]}
      >
        <div class="mx-auto max-w-7xl px-6 lg:px-8">
          <div class="mb-12">
            <h2
              class={[
                "mb-4 text-4xl font-black tracking-tighter uppercase md:text-5xl",
                isLight ? "text-[#001407]" : "text-white",
              ]}
            >
              Donde{" "}
              <span class={isLight ? "text-emerald-600" : "text-emerald-400"}>
                estamos
              </span>
            </h2>
          </div>

          <div class="grid items-start gap-8 lg:grid-cols-5">
            <div
              class={[
                "group relative aspect-[16/10] overflow-hidden rounded-3xl border shadow-2xl lg:col-span-3 lg:aspect-auto lg:h-[600px]",
                isLight
                  ? "border-slate-200 bg-white"
                  : "border-white/10 bg-slate-900",
              ]}
            >
              <iframe
                src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed&z=16`}
                class="h-full w-full transition-all duration-700 group-hover:scale-[1.02]"
                loading="lazy"
                title="Mapa de ubicación"
              />
              <div
                class={[
                  "pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset",
                  isLight ? "ring-slate-200/50" : "ring-white/10",
                ]}
              />
            </div>

            <div class="space-y-4 lg:col-span-2">
              <div
                class={[
                  "overflow-hidden rounded-2xl border backdrop-blur-sm",
                  isLight
                    ? "border-slate-200 bg-white/70 shadow-lg shadow-slate-100/50"
                    : "border-white/10 bg-slate-900/50",
                ]}
              >
                <div class="p-6">
                  <div class="mb-4 flex items-center justify-between">
                    <h3
                      class={[
                        "text-sm font-black tracking-widest uppercase",
                        isLight ? "text-slate-500" : "text-slate-400",
                      ]}
                    >
                      Ubicación
                    </h3>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-emerald-500"
                    >
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                  </div>
                  <p
                    class={[
                      "leading-relaxed font-bold",
                      isLight ? "text-slate-900" : "text-white",
                    ]}
                  >
                    {address}
                  </p>
                </div>
              </div>

              <div
                class={[
                  "overflow-hidden rounded-2xl border backdrop-blur-sm",
                  isLight
                    ? "border-slate-200 bg-white/70 shadow-lg shadow-slate-100/50"
                    : "border-white/10 bg-slate-900/50",
                ]}
              >
                <div class="p-6">
                  <div class="mb-6 flex items-center justify-between">
                    <h3
                      class={[
                        "text-sm font-black tracking-widest uppercase",
                        isLight ? "text-slate-500" : "text-slate-400",
                      ]}
                    >
                      Horarios del Club
                    </h3>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-emerald-500"
                    >
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                  </div>
                  <div class="space-y-4">
                    {hourGroups.map((g) => (
                      <div key={`${g.label}-${g.time}`} class="flex flex-col">
                        <span class="mb-1 text-xs font-black tracking-wider text-slate-500 uppercase">
                          {g.label}
                        </span>
                        <span
                          class={[
                            "font-bold",
                            g.time === "Cerrado"
                              ? isLight
                                ? "text-red-650"
                                : "text-red-400"
                              : isLight
                                ? "text-slate-900"
                                : "text-white",
                          ]}
                        >
                          {g.time}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                class={[
                  "overflow-hidden rounded-2xl border backdrop-blur-sm",
                  isLight
                    ? "border-slate-200 bg-white/70 shadow-lg shadow-slate-100/50"
                    : "border-white/10 bg-slate-900/50",
                ]}
              >
                <div class="p-6">
                  <div class="mb-8 flex items-center justify-between">
                    <h3
                      class={[
                        "text-sm font-black tracking-widest uppercase",
                        isLight ? "text-slate-500" : "text-slate-400",
                      ]}
                    >
                      Servicios del Club
                    </h3>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="text-emerald-500"
                    >
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                  </div>

                  <div class="grid grid-cols-2 gap-x-4 gap-y-6">
                    {services.map((s) => (
                      <ServiceIcon key={s} label={s} isLight={isLight} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  },
);
