import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, Form, type DocumentHead } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "../db";
import { pitches } from "../db/schema";
import { useGuestBookingAction } from "./api/bookings/index";
import { Button, Modal, Alert } from "~/components/ui";

export { useGuestBookingAction };

export const usePitchesLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return await db.select().from(pitches).where(eq(pitches.isActive, true));
});

export default component$(() => {
  const activePitches = usePitchesLoader();
  const guestAction = useGuestBookingAction();

  const isModalOpen = useSignal(false);
  const selectedPitchId = useSignal("");

  const openBookingModal = $((pitchId: string) => {
    selectedPitchId.value = pitchId;
    isModalOpen.value = true;
  });

  const closeBookingModal = $(() => {
    isModalOpen.value = false;
    selectedPitchId.value = "";
  });

  return (
    <div class="min-h-screen bg-slate-950 text-white font-sans selection:bg-emerald-500 selection:text-white pb-20">

      {/* Navbar */}
      <nav class="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div class="mx-auto max-w-7xl px-6 lg:px-8 h-20 flex items-center justify-between">
          <div class="font-black text-2xl tracking-tighter uppercase">
            Sport<span class="text-emerald-500">Garden</span>
          </div>
          <div class="hidden sm:flex gap-6 items-center text-sm font-medium text-slate-300">
            <a href="#" class="hover:text-emerald-400 transition-colors">Instalaciones</a>
            <a href="#" class="hover:text-emerald-400 transition-colors">Torneos</a>
            <a href="#" class="hover:text-emerald-400 transition-colors">Contacto</a>
            <a href="/admin/calendar" class="ml-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white">Panel Admin</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section class="relative overflow-hidden pt-24 pb-32">
        <div class="absolute inset-0 -z-10">
          <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/40 via-slate-950 to-slate-950"></div>
          <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4wNSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48cGF0aCBkPSJNNjAgMEwwIDYwTTAgMGw2MCA2MCIvPjwvZz48L3N2Zz4=')] opacity-20"></div>
        </div>

        <div class="mx-auto max-w-7xl px-6 lg:px-8 text-center relative z-10">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8 ring-1 ring-emerald-500/20">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Abierto todos los días
          </div>
          <h1 class="text-5xl md:text-7xl font-black tracking-tighter uppercase mb-6 drop-shadow-lg">
            La Cancha <br class="md:hidden" /> Es Tuya
          </h1>
          <p class="mt-4 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-medium">
            Instalaciones premium, césped de última generación y tercer tiempo garantizado. Elige tu cancha y reserva en segundos.
          </p>
        </div>
      </section>

      {/* Pitches Grid */}
      <section class="mx-auto max-w-7xl px-6 lg:px-8 -mt-10 relative z-20">
        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {activePitches.value.length === 0 ? (
            <div class="col-span-full text-center text-slate-400 py-20 bg-slate-900/50 rounded-3xl border border-white/5 backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p class="text-xl font-medium">No hay canchas disponibles en este momento.</p>
            </div>
          ) : (
            activePitches.value.map((pitch) => (
              <div
                key={pitch.id}
                class="group flex flex-col overflow-hidden rounded-3xl bg-slate-900 border border-white/10 shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-emerald-900/20 hover:border-emerald-500/30"
              >
                <div class="relative h-56 bg-slate-800 flex items-center justify-center overflow-hidden">
                  <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10"></div>
                  <div class="absolute inset-x-0 bottom-0 h-1/2 border-t-2 border-white/10 w-full flex justify-center">
                    <div class="w-24 h-12 border-2 border-b-0 border-white/10 rounded-t-full mt-auto"></div>
                  </div>

                  <span class="text-6xl font-black text-white/5 tracking-tighter group-hover:scale-110 transition-transform duration-500">{pitch.type}</span>

                  {pitch.isCovered && (
                    <span class="absolute top-4 right-4 z-20 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-bold text-emerald-400 backdrop-blur-md border border-white/10">
                      TECHADA
                    </span>
                  )}
                </div>

                <div class="flex flex-1 flex-col justify-between p-8">
                  <div>
                    <div class="flex items-center gap-3 mb-2">
                      <span class="px-2.5 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-300 uppercase tracking-wider">{pitch.type}</span>
                    </div>
                    <h3 class="text-2xl font-bold text-white mb-2">{pitch.name}</h3>
                    <p class="text-slate-400 leading-relaxed text-sm">
                      Superficie profesional {pitch.isCovered ? "techada" : "descubierta"}. Capacidad para {pitch.type.replace("F", "")} jugadores por lado.
                    </p>
                  </div>
                  <div class="mt-8 flex items-end justify-between border-t border-white/5 pt-6">
                    <div>
                      <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Precio x Hora</div>
                      <div class="text-2xl font-black text-white">${pitch.pricePerHour}</div>
                    </div>
                    <Button
                      onClick$={() => openBookingModal(pitch.id)}
                      look="primary"
                      class="bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-xl cursor-pointer"
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

      {/* Booking Modal */}
      <Modal.Root bind:show={isModalOpen}>
        <Modal.Panel class="bg-slate-900 border border-white/10 rounded-3xl max-w-md">
          <div class="flex justify-between items-center mb-6">
            <Modal.Title class="text-xl font-bold text-white">Solicitar Reserva</Modal.Title>
            <Modal.Close class="text-slate-400 hover:text-white transition-colors p-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </Modal.Close>
          </div>

          <div>
            {guestAction.value?.success ? (
              <div class="text-center py-8">
                <div class="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 class="text-xl font-bold text-white mb-2">¡Solicitud Enviada!</h3>
                <p class="text-slate-400 text-sm">El club revisará tu pedido y lo confirmará en breve. (Estado: Pendiente)</p>
                <Button
                  onClick$={closeBookingModal}
                  look="secondary"
                  class="mt-6 w-full py-3 rounded-xl bg-slate-800 text-white hover:bg-slate-700"
                >
                  Cerrar
                </Button>
              </div>
            ) : (
              <Form action={guestAction} class="space-y-5">
                <input type="hidden" name="pitchId" value={selectedPitchId.value} />

                {guestAction.value?.message && (
                  <Alert.Root look="alert" class="bg-red-500/10 border-red-500/20 text-red-400">
                    <Alert.Description>{guestAction.value.message}</Alert.Description>
                  </Alert.Root>
                )}

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Inicio</label>
                    <input
                      type="datetime-local"
                      name="startTime"
                      required
                      class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fin</label>
                    <input
                      type="datetime-local"
                      name="endTime"
                      required
                      class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tu Nombre Completo</label>
                  <input
                    type="text"
                    name="guestName"
                    placeholder="Ej: Juan Pérez"
                    required
                    class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Teléfono (WhatsApp)</label>
                  <input
                    type="tel"
                    name="guestPhone"
                    placeholder="+54 9 11 1234-5678"
                    required
                    class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  />
                </div>

                <div class="pt-2">
                  <Button
                    type="submit"
                    disabled={guestAction.isRunning}
                    look="primary"
                    class="w-full py-4 rounded-xl bg-emerald-500 text-slate-950 font-black uppercase tracking-wider hover:bg-emerald-400"
                  >
                    {guestAction.isRunning ? "Procesando..." : "Confirmar Solicitud"}
                  </Button>
                </div>
              </Form>
            )}
          </div>
        </Modal.Panel>
      </Modal.Root>

    </div>
  );
});

export const head: DocumentHead = {
  title: "SportGarden - El Mejor Fútbol",
  meta: [
    {
      name: "description",
      content: "Alquiler de canchas de fútbol premium. Reserva tu turno online en SportGarden.",
    },
  ],
};
