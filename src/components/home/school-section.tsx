import { component$ } from "@builder.io/qwik";

interface SchoolCategory {
  id: string;
  name: string;
  teacher: string;
  monthlyFee: number;
  schedules?: { day: number; startTime: string; endTime: string }[];
  days?: number[];
  startTime?: string;
  endTime?: string;
}

interface SchoolSectionProps {
  categories: SchoolCategory[];
  theme?: "light" | "dark";
}

export const SchoolSection = component$<SchoolSectionProps>(
  ({ categories, theme = "dark" }) => {
    if (!categories || categories.length === 0) return null;

    const isLight = theme === "light";

    const daysOfWeek = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    const shortDaysOfWeek = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    return (
      <section
        class={[
          "relative scroll-mt-28 overflow-hidden py-24 transition-colors duration-500",
          isLight ? "bg-[#F5F2EB]" : "bg-slate-950",
        ]}
        id="escuelita"
      >
        {/* Decorative background */}
        <div
          class={[
            "pointer-events-none absolute inset-0 z-0",
            isLight ? "opacity-10" : "opacity-20",
          ]}
        >
          <div
            class={[
              "animate-blob absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-emerald-400 blur-[100px] filter",
              isLight ? "mix-blend-multiply" : "mix-blend-screen",
            ]}
          />
          <div
            class={[
              "animate-blob animation-delay-2000 absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-emerald-600 blur-[100px] filter",
              isLight ? "mix-blend-multiply" : "mix-blend-screen",
            ]}
          />
        </div>

        <div class="relative z-10 mx-auto max-w-6xl px-6">
          <div class="mb-16 text-center">
            <h2
              class={[
                "mb-4 flex items-center justify-center gap-3 text-4xl font-black tracking-tighter uppercase md:text-5xl",
                isLight ? "text-[#001407]" : "text-white",
              ]}
            >
              Escuelita de Fútbol
            </h2>
            <p
              class={[
                "mx-auto max-w-2xl text-lg font-medium",
                isLight ? "text-slate-700" : "text-slate-400",
              ]}
            >
              Sumate a nuestros entrenamientos. Formación, diversión y los
              mejores profesores para todas las edades.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                class={[
                  "group flex flex-col rounded-3xl border p-6 transition-all duration-300 hover:-translate-y-1",
                  isLight
                    ? "border-slate-200 bg-white shadow-lg shadow-slate-100/50 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-slate-200/80"
                    : "border-white/10 bg-slate-900/50 backdrop-blur-sm hover:border-emerald-500/50 hover:bg-slate-900",
                ]}
              >
                <div class="mb-4 flex items-start justify-between">
                  <div>
                    <div
                      class={[
                        "mb-1 text-xs font-black tracking-widest uppercase",
                        isLight ? "text-emerald-600" : "text-emerald-400",
                      ]}
                    >
                      Categoría
                    </div>
                    <h3
                      class={[
                        "text-2xl font-black",
                        isLight ? "text-[#001407]" : "text-white",
                      ]}
                    >
                      {cat.name}
                    </h3>
                  </div>
                  <div
                    class={[
                      "flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                      isLight
                        ? "border-slate-200 bg-slate-50 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600"
                        : "border-white/5 bg-slate-800 text-slate-300 group-hover:bg-emerald-500/10 group-hover:text-emerald-400",
                    ]}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                </div>

                <div class="mb-6 space-y-4">
                  <div
                    class={[
                      "flex items-center gap-3",
                      isLight ? "text-slate-700" : "text-slate-300",
                    ]}
                  >
                    <div
                      class={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        isLight ? "bg-slate-100 text-slate-700" : "bg-white/5",
                      ]}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                      </svg>
                    </div>
                    <div>
                      <div class="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                        Profesor
                      </div>
                      <div class="font-bold">{cat.teacher}</div>
                    </div>
                  </div>

                  {(() => {
                    const schedules =
                      cat.schedules ||
                      (cat.days
                        ? cat.days.map((d: number) => ({
                            day: d,
                            startTime: cat.startTime,
                            endTime: cat.endTime,
                          }))
                        : []);
                    if (!schedules || schedules.length === 0) return null;

                    const groups: Record<string, number[]> = {};
                    schedules.forEach((s: any) => {
                      const key = `${s.startTime || "?"}-${s.endTime || "?"}`;
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(s.day);
                    });

                    return (
                      <div
                        class={[
                          "space-y-4 border-t pt-4",
                          isLight ? "border-slate-100" : "border-white/5",
                        ]}
                      >
                        <div class="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                          Horarios
                        </div>
                        {Object.entries(groups).map(([time, days]) => (
                          <div
                            key={time}
                            class={[
                              "flex gap-3",
                              isLight ? "text-slate-700" : "text-slate-300",
                            ]}
                          >
                            <div
                              class={[
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                isLight
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-emerald-500/10 text-emerald-400",
                              ]}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                            </div>
                            <div>
                              <div class="mb-1 flex flex-wrap gap-1">
                                {days
                                  .sort((a, b) => a - b)
                                  .map((d: number) => (
                                    <span
                                      key={d}
                                      class={[
                                        "rounded-md border px-2 py-0.5 text-[10px] font-black",
                                        isLight
                                          ? "border-slate-200 bg-slate-50 text-slate-600"
                                          : "border-white/10 bg-white/5 text-slate-300",
                                      ]}
                                      title={daysOfWeek[d]}
                                    >
                                      {shortDaysOfWeek[d]}
                                    </span>
                                  ))}
                              </div>
                              <div
                                class={[
                                  "text-sm font-bold",
                                  isLight
                                    ? "text-emerald-700"
                                    : "text-emerald-400",
                                ]}
                              >
                                {time.replace("-", " a ")} hs
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div
                  class={[
                    "mt-auto flex items-center justify-between border-t pt-6",
                    isLight ? "border-slate-100" : "border-white/5",
                  ]}
                >
                  <div>
                    <div class="mb-0.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Cuota Mensual
                    </div>
                    <div
                      class={[
                        "text-xl font-black",
                        isLight ? "text-slate-900" : "text-white",
                      ]}
                    >
                      ${cat.monthlyFee?.toLocaleString("es-AR")}
                    </div>
                  </div>
                  <a
                    href="#contacto"
                    class={[
                      "rounded-xl border px-4 py-2.5 text-xs font-black tracking-widest uppercase shadow-sm transition-all duration-300",
                      isLight
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/10 hover:border-emerald-700 hover:bg-emerald-700"
                        : "border-emerald-500/20 bg-white/5 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white",
                    ]}
                  >
                    Consultar
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  },
);
