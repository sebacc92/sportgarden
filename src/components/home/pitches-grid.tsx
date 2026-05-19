import { component$ } from "@builder.io/qwik";
import type { QRL } from "@builder.io/qwik";
import type { InferSelectModel } from "drizzle-orm";
import type { pitches } from "~/db/schema";
import { Button } from "~/components/ui";

export type PitchRow = InferSelectModel<typeof pitches>;

type PitchesGridProps = {
  pitches: PitchRow[];
  onReserve: QRL<(pitchId: string) => void>;
  theme?: "light" | "dark";
};

export const PitchesGrid = component$<PitchesGridProps>(
  ({ pitches: pitchList, onReserve, theme = "dark" }) => {
    const isLight = theme === "light";

    return (
      <section
        id="canchas"
        class={[
          "relative z-20 w-full py-24 transition-colors duration-500",
          isLight ? "bg-[#F5F2EB]" : "bg-slate-950",
        ]}
      >
        <div class="mx-auto max-w-7xl px-6 lg:px-8">
          <div class="mb-16 text-center">
            <h2
              class={[
                "mb-4 text-4xl font-black tracking-tighter uppercase md:text-5xl",
                isLight ? "text-[#001407]" : "text-white",
              ]}
            >
              Nuestras{" "}
              <span class={isLight ? "text-emerald-600" : "text-emerald-400"}>
                Canchas
              </span>
            </h2>
            <p
              class={[
                "mx-auto max-w-2xl text-lg font-medium",
                isLight ? "text-slate-700" : "text-slate-400",
              ]}
            >
              Selecciona tu cancha ideal, verifica la disponibilidad y reserva
              tu próximo partido.
              <span
                class={[
                  "mt-2 block text-sm font-medium italic",
                  isLight ? "text-slate-600" : "text-slate-500",
                ]}
              >
                * El precio de la reserva puede variar según el día y el horario
                seleccionado.
              </span>
            </p>
          </div>
          <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {pitchList.length === 0 ? (
              <div
                class={[
                  "col-span-full rounded-3xl border py-20 text-center backdrop-blur-sm",
                  isLight
                    ? "border-slate-200 bg-white/60 text-slate-500"
                    : "border-white/5 bg-slate-900/50 text-slate-400",
                ]}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="mx-auto mb-4 h-12 w-12 opacity-50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p class="text-xl font-medium">
                  No hay canchas disponibles en este momento.
                </p>
              </div>
            ) : (
              pitchList.map((pitch) => (
                <div
                  key={pitch.id}
                  class={[
                    "group flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-2",
                    isLight
                      ? "border-slate-200/80 bg-white shadow-lg shadow-slate-100 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-slate-200/80"
                      : "border-white/10 bg-slate-900 shadow-2xl hover:border-emerald-500/30 hover:shadow-emerald-900/20",
                  ]}
                >
                  <div
                    class={[
                      "relative flex h-56 items-center justify-center overflow-hidden",
                      isLight ? "bg-slate-100" : "bg-slate-800",
                    ]}
                  >
                    {pitch.imageUrl && (
                      <img
                        src={pitch.imageUrl}
                        alt={pitch.name}
                        width={400}
                        height={300}
                        class="absolute inset-0 z-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    )}

                    <div
                      class={[
                        "absolute inset-0 z-10",
                        pitch.imageUrl
                          ? isLight
                            ? "bg-gradient-to-t from-white via-white/30 to-transparent"
                            : "bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"
                          : isLight
                            ? "bg-gradient-to-t from-white via-transparent to-transparent"
                            : "bg-gradient-to-t from-slate-900 via-transparent to-transparent",
                      ]}
                    />

                    {!pitch.imageUrl && (
                      <>
                        <div
                          class={[
                            "absolute inset-x-0 bottom-0 z-10 flex h-1/2 w-full justify-center border-t-2",
                            isLight ? "border-slate-200" : "border-white/10",
                          ]}
                        >
                          <div
                            class={[
                              "mt-auto h-12 w-24 rounded-t-full border-2 border-b-0",
                              isLight ? "border-slate-200" : "border-white/10",
                            ]}
                          />
                        </div>
                        <span
                          class={[
                            "z-10 text-6xl font-black tracking-tighter transition-transform duration-500 group-hover:scale-110",
                            isLight ? "text-slate-900/5" : "text-white/5",
                          ]}
                        >
                          {pitch.type}
                        </span>
                      </>
                    )}

                    {pitch.isCovered && (
                      <span
                        class={[
                          "absolute top-4 right-4 z-20 rounded-full border px-3 py-1 text-xs font-bold backdrop-blur-md",
                          isLight
                            ? "border-emerald-500/20 bg-emerald-50/90 text-emerald-700"
                            : "border-white/10 bg-slate-950/80 text-emerald-400",
                        ]}
                      >
                        TECHADA
                      </span>
                    )}
                  </div>

                  <div class="flex flex-1 flex-col justify-between p-8">
                    <div>
                      <div class="mb-2 flex items-center gap-3">
                        <span
                          class={[
                            "rounded px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase",
                            isLight
                              ? "bg-slate-100 text-slate-700"
                              : "bg-slate-800 text-slate-300",
                          ]}
                        >
                          {pitch.type}
                        </span>
                      </div>
                      <h3
                        class={[
                          "mb-2 text-2xl font-bold",
                          isLight ? "text-[#001407]" : "text-white",
                        ]}
                      >
                        {pitch.name}
                      </h3>
                      <p
                        class={[
                          "text-sm leading-relaxed",
                          isLight ? "text-slate-700" : "text-slate-400",
                        ]}
                      >
                        Superficie profesional{" "}
                        {pitch.isCovered ? "techada" : "descubierta"}. Capacidad
                        para {pitch.type.replace("F", "")} jugadores por lado.
                      </p>
                      {pitch.notes && (
                        <div
                          class={[
                            "mt-4 rounded-xl border p-3",
                            isLight
                              ? "border-emerald-500/30 bg-emerald-50/50"
                              : "border-emerald-500/20 bg-emerald-500/10",
                          ]}
                        >
                          <p
                            class={[
                              "text-xs font-medium italic",
                              isLight ? "text-emerald-800" : "text-emerald-400",
                            ]}
                          >
                            <span class="mr-1 font-bold tracking-wider uppercase">
                              Nota:
                            </span>
                            {pitch.notes}
                          </p>
                        </div>
                      )}
                    </div>
                    <div
                      class={[
                        "mt-8 flex items-end justify-between border-t pt-6",
                        isLight ? "border-slate-100" : "border-white/5",
                      ]}
                    >
                      <div>
                        <div class="mb-0.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                          Desde
                        </div>
                        <div class="flex items-baseline gap-1.5">
                          <div
                            class={[
                              "text-3xl font-black",
                              isLight ? "text-slate-900" : "text-white",
                            ]}
                          >
                            ${pitch.pricePerHour?.toLocaleString("es-AR")}
                          </div>
                          <div class="text-xs font-bold tracking-tighter text-slate-500 uppercase">
                            / hora
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick$={() => onReserve(pitch.id)}
                        look="primary"
                        class={[
                          "cursor-pointer rounded-xl text-white shadow-md transition-transform duration-200 active:scale-95",
                          isLight
                            ? "bg-emerald-600 shadow-emerald-600/10 hover:bg-emerald-700"
                            : "bg-emerald-500 shadow-emerald-500/10 hover:bg-emerald-600",
                        ]}
                      >
                        RESERVAR
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    );
  },
);
