import { component$, useSignal, $ } from "@builder.io/qwik";
import type { QRL } from "@builder.io/qwik";
import type { Pitch } from "~/db/schema";
import { Button } from "~/components/ui";
import { PitchesAvailabilityTimeline } from "./pitches-availability-timeline";

export type PitchRow = Pitch;

type PitchesGridProps = {
  pitches: PitchRow[];
  onReserve: QRL<(pitchId: string) => void>;
  onReserveWithTime$?: QRL<(pitchId: string, dateStr: string, time: string) => void>;
  theme?: "light" | "dark";
  operatingHours?: any[];
  holidays?: any[];
};

export const PitchesGrid = component$<PitchesGridProps>(
  ({ pitches: pitchList, onReserve, onReserveWithTime$, operatingHours = [], holidays = [], theme = "dark" }) => {
    const isLight = theme === "light";
    const viewMode = useSignal<"cards" | "timeline">("timeline");
    const filter = useSignal<"ALL" | "COVERED" | "UNCOVERED">("ALL");

    const filteredPitches = pitchList.filter((pitch) => {
      if (filter.value === "COVERED") return pitch.isCovered;
      if (filter.value === "UNCOVERED") return !pitch.isCovered;
      return true;
    });

    const tabBase =
      "cursor-pointer rounded-full px-5 py-2 text-xs font-black tracking-widest uppercase transition-all duration-300 border flex items-center gap-1.5";
    const tabActive = isLight
      ? "bg-[#001407] border-[#001407] text-[#F5F2EB] shadow-lg shadow-[#001407]/10"
      : "bg-emerald-500 border-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20";
    const tabInactive = isLight
      ? "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      : "bg-slate-900 border-white/10 text-slate-400 hover:border-white/20 hover:text-white";

    return (
      <section
        id="canchas"
        class={[
          "relative z-20 w-full py-24 transition-colors duration-500",
          isLight ? "bg-[#F5F2EB]" : "bg-slate-950",
        ]}
      >
        {/* ── Header + controls — centrados ── */}
        <div class="mx-auto max-w-7xl px-6 lg:px-8">
          <div class="mb-12 text-center">
            <h2
              class={[
                "mb-4 text-4xl font-black tracking-tighter uppercase md:text-5xl",
                isLight ? "text-[#001407]" : "text-white",
              ]}
            >
              Nuestras{" "}
              <span class={isLight ? "text-emerald-600" : "text-emerald-400"}>Canchas</span>
            </h2>
            <p
              class={[
                "mx-auto max-w-2xl text-lg font-medium",
                isLight ? "text-slate-700" : "text-slate-400",
              ]}
            >
              Seleccioná tu cancha ideal, verificá la disponibilidad y reservá tu próximo partido.
              <span
                class={[
                  "mt-2 block text-sm font-medium italic",
                  isLight ? "text-slate-600" : "text-slate-500",
                ]}
              >
                * El precio puede variar según el día y el horario seleccionado.
              </span>
            </p>
          </div>

          {/* Controls row */}
          <div class="mb-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            {/* Coverage filter */}
            <div class="flex flex-wrap justify-center gap-2">
              {(["ALL", "COVERED", "UNCOVERED"] as const).map((f) => (
                <button
                  key={f}
                  onClick$={() => (filter.value = f)}
                  class={[tabBase, filter.value === f ? tabActive : tabInactive]}
                >
                  {f === "ALL" ? "Todas" : f === "COVERED" ? "Techadas" : "Descubiertas"}
                </button>
              ))}
            </div>

            {/* View mode toggle */}
            <div
              class={[
                "flex gap-1 rounded-full border p-1",
                isLight ? "border-slate-200 bg-white" : "border-white/10 bg-slate-900",
              ]}
            >
              <button
                onClick$={() => (viewMode.value = "timeline")}
                class={[
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-black tracking-wide uppercase transition-all",
                  viewMode.value === "timeline" ? tabActive : "text-slate-500 hover:text-slate-700",
                ]}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Disponibilidad
              </button>
              <button
                onClick$={() => (viewMode.value = "cards")}
                class={[
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-black tracking-wide uppercase transition-all",
                  viewMode.value === "cards" ? tabActive : "text-slate-500 hover:text-slate-700",
                ]}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                Canchas
              </button>
            </div>
          </div>

        </div>

        {viewMode.value === "cards" && (
          <div class="mx-auto max-w-7xl px-6 lg:px-8">
            <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPitches.length === 0 ? (
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
                    {pitchList.length === 0
                      ? "No hay canchas disponibles en este momento."
                      : "No hay canchas que coincidan con el filtro seleccionado."}
                  </p>
                </div>
              ) : (
                filteredPitches.map((pitch) => (
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
                          {pitch.isCovered ? "techada" : "descubierta"}. Capacidad para{" "}
                          {pitch.type.replace("F", "")} jugadores por lado.
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
                              <span class="mr-1 font-bold tracking-wider uppercase">Nota:</span>
                              {pitch.notes}
                            </p>
                          </div>
                        )}
                      </div>
                      <div
                        class={[
                          "mt-8 flex flex-col gap-4 border-t pt-6 min-[380px]:flex-row min-[380px]:items-end min-[380px]:justify-between",
                          isLight ? "border-slate-100" : "border-white/5",
                        ]}
                      >
                        <div>
                          <div class="mb-0.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                            Desde
                          </div>
                          <div class="flex flex-wrap items-baseline gap-1.5">
                            <div
                              class={[
                                "text-2xl min-[380px]:text-3xl font-black",
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
                            "w-full cursor-pointer rounded-xl py-3.5 px-6 text-center font-black tracking-widest uppercase text-white shadow-md transition-all duration-200 active:scale-[0.98] min-[380px]:w-auto",
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
        )}

        {/* ── Timeline view — ancho completo ── */}
        {viewMode.value === "timeline" && (
          <div class="px-4 sm:px-6 lg:px-8">
            <PitchesAvailabilityTimeline
              pitches={pitchList}
              operatingHours={operatingHours}
              holidays={holidays}
              theme={theme}
              filter={filter.value}
              onSlotClick$={
                onReserveWithTime$ ??
                $((pitchId: string) => onReserve(pitchId))
              }
            />
          </div>
        )}
      </section>
    );
  },
);
