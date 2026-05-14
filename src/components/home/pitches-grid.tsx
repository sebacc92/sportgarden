import { component$ } from "@builder.io/qwik";
import type { QRL } from "@builder.io/qwik";
import type { InferSelectModel } from "drizzle-orm";
import type { pitches } from "~/db/schema";
import { Button } from "~/components/ui";

export type PitchRow = InferSelectModel<typeof pitches>;

type PitchesGridProps = {
  pitches: PitchRow[];
  onReserve: QRL<(pitchId: string) => void>;
};

export const PitchesGrid = component$<PitchesGridProps>(({ pitches: pitchList, onReserve }) => {
  return (
    <section id="canchas" class="relative z-20 mx-auto max-w-7xl px-6 pb-20 pt-10 lg:px-8">
      <div class="mb-16 text-center">
        <h2 class="mb-4 text-4xl font-black uppercase tracking-tighter text-white md:text-5xl">
          Nuestras <span class="text-emerald-400">Canchas</span>
        </h2>
        <p class="mx-auto max-w-2xl text-lg text-slate-400">
          Selecciona tu cancha ideal, verifica la disponibilidad y reserva tu próximo partido.
        </p>
      </div>
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {pitchList.length === 0 ? (
          <div class="col-span-full rounded-3xl border border-white/5 bg-slate-900/50 py-20 text-center text-slate-400 backdrop-blur-sm">
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
            <p class="text-xl font-medium">No hay canchas disponibles en este momento.</p>
          </div>
        ) : (
          pitchList.map((pitch) => (
            <div
              key={pitch.id}
              class="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:border-emerald-500/30 hover:shadow-emerald-900/20"
            >
              <div class="relative flex h-56 items-center justify-center overflow-hidden bg-slate-800">
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
                      ? "bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"
                      : "bg-gradient-to-t from-slate-900 via-transparent to-transparent",
                  ]}
                />

                {!pitch.imageUrl && (
                  <>
                    <div class="absolute inset-x-0 bottom-0 z-10 flex h-1/2 w-full justify-center border-t-2 border-white/10">
                      <div class="mt-auto h-12 w-24 rounded-t-full border-2 border-b-0 border-white/10" />
                    </div>
                    <span class="z-10 text-6xl font-black tracking-tighter text-white/5 transition-transform duration-500 group-hover:scale-110">
                      {pitch.type}
                    </span>
                  </>
                )}

                {pitch.isCovered && (
                  <span class="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-bold text-emerald-400 backdrop-blur-md">
                    TECHADA
                  </span>
                )}
              </div>

              <div class="flex flex-1 flex-col justify-between p-8">
                <div>
                  <div class="mb-2 flex items-center gap-3">
                    <span class="rounded bg-slate-800 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                      {pitch.type}
                    </span>
                  </div>
                  <h3 class="mb-2 text-2xl font-bold text-white">{pitch.name}</h3>
                  <p class="text-sm leading-relaxed text-slate-400">
                    Superficie profesional {pitch.isCovered ? "techada" : "descubierta"}. Capacidad para{" "}
                    {pitch.type.replace("F", "")} jugadores por lado.
                  </p>
                  {pitch.notes && (
                    <div class="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <p class="text-xs font-medium italic text-emerald-400">
                        <span class="mr-1 font-bold uppercase tracking-wider">Nota:</span>
                        {pitch.notes}
                      </p>
                    </div>
                  )}
                </div>
                <div class="mt-8 flex items-end justify-between border-t border-white/5 pt-6">
                  <div>
                    <div class="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Precio x Hora</div>
                    <div class="text-2xl font-black text-white">${pitch.pricePerHour}</div>
                  </div>
                  <Button
                    onClick$={() => onReserve(pitch.id)}
                    look="primary"
                    class="cursor-pointer rounded-xl bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    RESERVAR
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
});
