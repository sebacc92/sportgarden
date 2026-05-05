import { component$, useSignal, $, useTask$, useComputed$ } from "@builder.io/qwik";
import { routeLoader$, Form, type DocumentHead, Link, server$, type RequestEventBase } from "@builder.io/qwik-city";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import { getDB } from "../db";
import { pitches, bookings } from "../db/schema";
import { useGuestBookingAction, useUserBookingAction, calculateDynamicPrice } from "./api/bookings/index";
import { Button, Modal, Alert } from "~/components/ui";

export { useGuestBookingAction, useUserBookingAction };

export const usePitchesLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return await db.select().from(pitches).where(eq(pitches.isActive, true));
});

export const useUserLoader = routeLoader$((requestEvent) => {
  return requestEvent.sharedMap.get("user") as { userId: string; role: string } | undefined;
});

export const getDailyBookings = server$(async function(this: RequestEventBase, pitchId: string, dateStr: string) {
  const db = getDB(this);
  if (!pitchId || !dateStr) return [];

  const startOfDay = new Date(`${dateStr}T00:00:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59`);

  const dailyBookings = await db.query.bookings.findMany({
    where: and(
      eq(bookings.pitchId, pitchId),
      gte(bookings.startTime, startOfDay),
      lt(bookings.startTime, endOfDay),
      inArray(bookings.status, ["CONFIRMED", "PENDING_APPROVAL", "COMPLETED"])
    ),
    columns: {
      startTime: true,
      endTime: true,
    },
    orderBy: (bookings, { asc }) => [asc(bookings.startTime)],
  });

  return dailyBookings.map(b => ({
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString()
  }));
});

export default component$(() => {
  const activePitches = usePitchesLoader();
  const user = useUserLoader();
  const guestAction = useGuestBookingAction();
  const userAction = useUserBookingAction();

  const isModalOpen = useSignal(false);
  const selectedPitchId = useSignal("");
  
  // Form signals for availability checking
  const dateStr = useSignal("");
  const timeStr = useSignal("");
  const occupiedSlots = useSignal<{startTime: string, endTime: string}[]>([]);
  const isCheckingAvailability = useSignal(false);
  
  // Keep track of selected pitch for calculation
  const selectedPitch = activePitches.value.find(p => p.id === selectedPitchId.value);
  const durationStr = useSignal("60");

  const openBookingModal = $((pitchId: string) => {
    selectedPitchId.value = pitchId;
    dateStr.value = "";
    timeStr.value = "";
    durationStr.value = "60";
    occupiedSlots.value = [];
    isModalOpen.value = true;
  });

  const closeBookingModal = $(() => {
    isModalOpen.value = false;
    selectedPitchId.value = "";
  });

  useTask$(({ track }) => {
    const pitchId = track(() => selectedPitchId.value);
    const date = track(() => dateStr.value);

    if (pitchId && date) {
      isCheckingAvailability.value = true;
      getDailyBookings(pitchId, date).then((slots) => {
        occupiedSlots.value = slots;
        isCheckingAvailability.value = false;
      });
    } else {
      occupiedSlots.value = [];
    }
  });

  const isOverlapping = useComputed$(() => {
    if (!dateStr.value || !timeStr.value || !durationStr.value) return false;
    const start = new Date(`${dateStr.value}T${timeStr.value}:00`).getTime();
    const duration = parseInt(durationStr.value, 10);
    const end = start + duration * 60000;

    return occupiedSlots.value.some((slot) => {
      const slotStart = new Date(slot.startTime).getTime();
      const slotEnd = new Date(slot.endTime).getTime();
      return start < slotEnd && end > slotStart;
    });
  });

  const isSubmitDisabled = isOverlapping.value || isCheckingAvailability.value;

  const dynamicPrice = useComputed$(() => {
    if (!selectedPitch || !dateStr.value || !timeStr.value) return 0;
    const start = new Date(`${dateStr.value}T${timeStr.value}:00`);
    const durationMins = parseInt(durationStr.value, 10);
    
    return calculateDynamicPrice(
      start,
      durationMins,
      selectedPitch.pricePerHour,
      selectedPitch.peakHourStart,
      selectedPitch.peakPricePerHour
    );
  });

  const totalPrice = dynamicPrice.value;
  const senaAmount = selectedPitch ? (selectedPitch.reservationPercentage / 100) * totalPrice : 0;

  const timeOptions: string[] = [];
  for (let h = 8; h <= 23; h++) {
    timeOptions.push(`${h.toString().padStart(2, '0')}:00`);
    timeOptions.push(`${h.toString().padStart(2, '0')}:30`);
  }

  const isSlotDisabled = (time: string) => {
    if (!dateStr.value) return true;
    const start = new Date(`${dateStr.value}T${time}:00`).getTime();
    const duration = parseInt(durationStr.value, 10);
    const end = start + duration * 60000;

    return occupiedSlots.value.some((slot) => {
      const slotStart = new Date(slot.startTime).getTime();
      const slotEnd = new Date(slot.endTime).getTime();
      return start < slotEnd && end > slotStart;
    });
  };

  const timeGridUI = (
    <div class="space-y-3">
      <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between">
        <span>Horario</span>
        {isCheckingAvailability.value && <span class="text-emerald-400 animate-pulse">Cargando...</span>}
      </label>
      
      {!dateStr.value ? (
        <div class="text-sm text-slate-500 font-medium p-4 bg-slate-800/50 rounded-xl border border-white/10 text-center">
          Selecciona una fecha primero.
        </div>
      ) : (
        <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {timeOptions.map((time) => {
            const disabled = isSlotDisabled(time) || isCheckingAvailability.value;
            const selected = timeStr.value === time;
            return (
              <button
                key={time}
                type="button"
                disabled={disabled}
                onClick$={() => timeStr.value = time}
                class={[
                  "py-2 px-1 text-sm font-bold rounded-lg border transition-all text-center",
                  disabled 
                    ? "opacity-30 border-white/5 bg-slate-900 cursor-not-allowed text-slate-500 line-through" 
                    : selected
                      ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
                      : "bg-slate-800 border-white/10 text-white hover:border-emerald-500/50 hover:bg-slate-700"
                ]}
              >
                {time}
              </button>
            );
          })}
        </div>
      )}
      {isOverlapping.value && timeStr.value && (
        <div class="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm font-bold flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          El horario seleccionado se superpone con una reserva existente.
        </div>
      )}
    </div>
  );

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
            {user.value?.role === "ADMIN" && (
              <a href="/admin/calendar" class="ml-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white">Panel Admin</a>
            )}
            {user.value ? (
              <div class="flex items-center gap-4 ml-4">
                <span class="text-emerald-400 font-bold">Hola!</span>
                {/* Logout should ideally be a form post, but skipping for brevity */}
              </div>
            ) : (
              <Link href="/auth/login" class="ml-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-full transition-colors text-slate-950 font-bold">
                Iniciar Sesión
              </Link>
            )}
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
        <Modal.Panel class="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-6">
            <Modal.Title class="text-2xl font-black tracking-tight text-white">Solicitar Reserva</Modal.Title>
            <Modal.Close class="text-slate-400 hover:text-white transition-colors p-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </Modal.Close>
          </div>

          <div>
            {(guestAction.value?.success || userAction.value?.success) ? (
              <div class="text-center py-8">
                <div class="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 class="text-2xl font-black text-white mb-2">¡Reserva Exitosa!</h3>
                <p class="text-slate-400 text-sm mb-8">
                  {guestAction.value?.success 
                    ? "El club revisará tu pedido y lo confirmará en breve. (Estado: Pendiente)" 
                    : "Tu reserva ha sido confirmada directamente. ¡Te esperamos!"}
                </p>
                <Button
                  onClick$={closeBookingModal}
                  look="secondary"
                  class="w-full py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider"
                >
                  Cerrar
                </Button>
              </div>
            ) : (
              <div>
                {!user.value && (
                  <div class="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl mb-6 p-4 text-sm leading-relaxed">
                    <strong class="font-black block mb-1">Atención:</strong> 
                    Como invitado, tu solicitud deberá ser aprobada por el club.<br/>
                    <span class="opacity-90">Para confirmar al instante y acceder a pagos online, necesitas <Link href="/auth/register" class="font-bold underline underline-offset-2 hover:text-amber-200 transition-colors">crear usuario</Link>.</span>
                  </div>
                )}

                {user.value ? (
                  <Form action={userAction} class="space-y-6">
                    <input type="hidden" name="pitchId" value={selectedPitchId.value} />

                    {userAction.value?.message && (
                      <Alert.Root look="alert" class="bg-red-500/10 border-red-500/20 text-red-400 rounded-xl">
                        <Alert.Description>{userAction.value?.message}</Alert.Description>
                      </Alert.Root>
                    )}

                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Fecha</label>
                        <input type="date" name="date" required bind:value={dateStr} class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-medium" />
                      </div>
                      <div>
                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Duración</label>
                        <select name="duration" required bind:value={durationStr} class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-medium appearance-none">
                          <option value="60">60 minutos (1 hora)</option>
                          <option value="90">90 minutos (1.5 horas)</option>
                          <option value="120">120 minutos (2 horas)</option>
                        </select>
                      </div>
                    </div>

                    <input type="hidden" name="time" value={timeStr.value} />
                    {timeGridUI}

                    <div class="space-y-4 pt-4 border-t border-white/5">
                      <div class="bg-slate-800/50 rounded-xl p-4 border border-emerald-500/20">
                        <div class="flex justify-between items-center mb-4">
                          <span class="text-sm font-medium text-slate-300">Total a pagar:</span>
                          <span class="text-xl font-black text-white">${totalPrice}</span>
                        </div>
                        
                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Opciones de Pago</label>
                        <div class="space-y-2">
                          <label class="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                            <input type="radio" name="paymentOption" value="LATER" class="text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/20" checked />
                            <span class="text-sm font-medium text-white flex-1">Pagar en el club</span>
                          </label>
                          <label class="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                            <input type="radio" name="paymentOption" value="SENA" class="text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/20" />
                            <div class="flex-1">
                              <span class="text-sm font-medium text-white block">Pagar Seña ({selectedPitch?.reservationPercentage}%)</span>
                              <span class="text-xs text-slate-400">Pagas hoy: ${senaAmount}</span>
                            </div>
                          </label>
                          <label class="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                            <input type="radio" name="paymentOption" value="TOTAL" class="text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/20" />
                            <div class="flex-1">
                              <span class="text-sm font-medium text-white block">Pagar Total</span>
                              <span class="text-xs text-slate-400">Pagas hoy: ${totalPrice}</span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div class="pt-4">
                      <Button type="submit" disabled={userAction.isRunning || isSubmitDisabled || !timeStr.value} look="primary" class="w-full py-4 rounded-xl bg-emerald-500 text-slate-950 font-black uppercase tracking-wider hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                        {userAction.isRunning ? "Procesando..." : "Confirmar Reserva"}
                      </Button>
                    </div>
                  </Form>
                ) : (
                  <Form action={guestAction} class="space-y-6">
                    <input type="hidden" name="pitchId" value={selectedPitchId.value} />

                    {guestAction.value?.message && (
                      <Alert.Root look="alert" class="bg-red-500/10 border-red-500/20 text-red-400 rounded-xl">
                        <Alert.Description>{guestAction.value?.message}</Alert.Description>
                      </Alert.Root>
                    )}

                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Fecha</label>
                        <input type="date" name="date" required bind:value={dateStr} class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-medium" />
                      </div>
                      <div>
                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Duración</label>
                        <select name="duration" required bind:value={durationStr} class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-medium appearance-none">
                          <option value="60">60 minutos (1 hora)</option>
                          <option value="90">90 minutos (1.5 horas)</option>
                          <option value="120">120 minutos (2 horas)</option>
                        </select>
                      </div>
                    </div>

                    <input type="hidden" name="time" value={timeStr.value} />
                    {timeGridUI}

                    <div class="space-y-4 pt-4 border-t border-white/5">
                      <div>
                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tu Nombre Completo</label>
                        <input type="text" name="guestName" placeholder="Ej: Juan Pérez" required class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-medium" />
                      </div>
                      <div>
                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Teléfono (WhatsApp)</label>
                        <input type="tel" name="guestPhone" placeholder="+54 9 11 1234-5678" required class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-medium" />
                      </div>
                    </div>

                    <div class="pt-4">
                      <Button type="submit" disabled={guestAction.isRunning || isSubmitDisabled || !timeStr.value} look="primary" class="w-full py-4 rounded-xl bg-emerald-500 text-slate-950 font-black uppercase tracking-wider hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                        {guestAction.isRunning ? "Procesando..." : "Enviar Solicitud"}
                      </Button>
                    </div>
                  </Form>
                )}
              </div>
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
