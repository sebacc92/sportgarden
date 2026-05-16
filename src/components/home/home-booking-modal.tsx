import { component$, useSignal, $, useTask$, useComputed$ } from "@builder.io/qwik";
import type { QRL, Signal } from "@builder.io/qwik";
import { Form, Link } from "@builder.io/qwik-city";
import type { InferSelectModel } from "drizzle-orm";
import { pitches } from "~/db/schema";
import { Button, Modal, Alert } from "~/components/ui";
import { calculateProportionalPrice } from "~/utils/pricing";
import { getDailyBookings } from "~/lib/home-page/loaders";
import { TIME_SLOT_OPTIONS } from "~/lib/home-page/constants";
import type { HomeNavbarUser } from "./home-navbar";

export type PitchRow = InferSelectModel<typeof pitches>;
export type SiteSettingsShape = {
  paymentMethods?: { id: string; name: string; isActive: boolean }[];
  extraServices?: { name: string; price: number; icon: string }[];
  bankAlias?: string | null;
  whatsappNumber?: string | null;
};
export type HomeBookingModalProps = {
  isOpen: Signal<boolean>;
  selectedPitchId: Signal<string>;
  onClose: QRL<() => void>;
  pitches: PitchRow[];
  user: HomeNavbarUser;
  settings: SiteSettingsShape;
  guestAction: any;
  userAction: any;
};

export const HomeBookingModal = component$<HomeBookingModalProps>(
  ({ isOpen, selectedPitchId, onClose, pitches: pitchesRows, user, settings, guestAction, userAction }) => {
    const dateStr = useSignal("");
    const timeStr = useSignal("");
    const occupiedSlots = useSignal<{ startTime: string; endTime: string }[]>([]);
    const isCheckingAvailability = useSignal(false);

    const currentStep = useSignal(1);
    const selectedExtras = useSignal<{ name: string; price: number }[]>([]);
    const paymentMethod = useSignal("CASH");
    const paymentOption = useSignal("LATER");

    const durationStr = useSignal("60");

    const toggleExtra = $((extra: { name: string; price: number }) => {
      const exists = selectedExtras.value.find((e) => e.name === extra.name);
      if (exists) {
        selectedExtras.value = selectedExtras.value.filter((e) => e.name !== extra.name);
      } else {
        selectedExtras.value = [...selectedExtras.value, extra];
      }
    });

    const nextStep = $(() => {
      if (currentStep.value < 3) currentStep.value++;
    });
    const prevStep = $(() => {
      if (currentStep.value > 1) currentStep.value--;
    });

    const selectedPitch = useComputed$(() => pitchesRows.find((p) => p.id === selectedPitchId.value));

    useTask$(({ track }) => {
      const open = track(() => isOpen.value);
      if (!open) {
        dateStr.value = "";
        timeStr.value = "";
        durationStr.value = "60";
        occupiedSlots.value = [];
        currentStep.value = 1;
        selectedExtras.value = [];
        paymentMethod.value = "CASH";
        paymentOption.value = "LATER";
        isCheckingAvailability.value = false;
        return;
      }
      track(() => selectedPitchId.value);
      dateStr.value = "";
      timeStr.value = "";
      durationStr.value = "60";
      occupiedSlots.value = [];
      selectedExtras.value = [];
    });

    useTask$(({ track }) => {
      const open = track(() => isOpen.value);
      const pitchId = track(() => selectedPitchId.value);
      const date = track(() => dateStr.value);

      if (!open || !pitchId || !date) {
        occupiedSlots.value = [];
        return;
      }

      isCheckingAvailability.value = true;
      getDailyBookings(pitchId, date).then((slots) => {
        occupiedSlots.value = slots;
        isCheckingAvailability.value = false;
      });
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

    const isSubmitDisabled = useComputed$(() => isOverlapping.value || isCheckingAvailability.value);

    const dynamicPrice = useComputed$(() => {
      const sp = selectedPitch.value;
      if (!sp || !dateStr.value || !timeStr.value) return 0;
      const durationMins = parseInt(durationStr.value, 10);

      return calculateProportionalPrice(
        dateStr.value,
        timeStr.value,
        durationMins,
        sp.pricePerHour,
        (sp as any).pricingRules || []
      );
    });

    const extrasTotal = useComputed$(() => selectedExtras.value.reduce((acc, extra) => acc + extra.price, 0));

    const totalPrice = useComputed$(() => dynamicPrice.value + extrasTotal.value);

    const senaAmount = useComputed$(() => {
      const sp = selectedPitch.value;
      if (!sp) return 0;
      const depositType = (sp as any).depositType ?? "PERCENTAGE";
      const depositAmount = (sp as any).depositAmount ?? 0;
      return depositType === "FIXED" ? depositAmount : (depositAmount / 100) * totalPrice.value;
    });

    const senaLabel = useComputed$(() => {
      const sp = selectedPitch.value;
      if (!sp) return "0%";
      const depositType = (sp as any).depositType ?? "PERCENTAGE";
      const depositAmount = (sp as any).depositAmount ?? 0;
      return depositType === "FIXED" ? `$${depositAmount}` : `${depositAmount}%`;
    });

    const isSlotDisabled = (time: string) => {
      if (!dateStr.value) return true;

      const today = new Date();
      const isToday = dateStr.value === today.toISOString().split("T")[0];
      if (isToday) {
        const [hours, minutes] = time.split(":").map(Number);
        const slotTime = new Date();
        slotTime.setHours(hours, minutes, 0, 0);
        if (slotTime <= today) {
          return true;
        }
      }

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
            {TIME_SLOT_OPTIONS.map((time) => {
              const disabled = isSlotDisabled(time) || isCheckingAvailability.value;
              const selected = timeStr.value === time;
              return (
                <button
                  key={time}
                  type="button"
                  disabled={disabled}
                  onClick$={() => (timeStr.value = time)}
                  class={[
                    "py-2 px-1 text-sm font-bold rounded-lg border transition-all text-center",
                    disabled
                      ? "opacity-30 border-white/5 bg-slate-900 cursor-not-allowed text-slate-500 line-through"
                      : selected
                        ? "bg-emerald-500 border-emerald-300 text-white shadow-lg shadow-emerald-900/40"
                        : "bg-slate-800 border-white/10 text-white hover:border-emerald-500/50 hover:bg-slate-700",
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
              <path
                fill-rule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
            El horario seleccionado se superpone con una reserva existente.
          </div>
        )}
      </div>
    );

    return (
      <Modal.Root bind:show={isOpen}>
        <Modal.Panel class="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-6">
            <Modal.Title class="text-2xl font-black tracking-tight text-white">Solicitar Reserva</Modal.Title>
            <Modal.Close class="text-slate-400 hover:text-white transition-colors p-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Modal.Close>
          </div>

          <div>
            {(guestAction.value?.success || userAction.value?.success) ? (
              <div class="text-center py-8">
                <div class="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 class="text-2xl font-black text-white mb-2">¡Reserva Exitosa!</h3>
                <p class="text-slate-400 text-sm mb-8">
                  {guestAction.value?.success
                    ? "El club revisará tu pedido y lo confirmará en breve. (Estado: Pendiente)"
                    : "Tu reserva ha sido confirmada directamente. ¡Te esperamos!"}
                </p>
                <Button
                  onClick$={onClose}
                  look="secondary"
                  class="w-full py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider"
                >
                  Cerrar
                </Button>
              </div>
            ) : (
              <div>
                <div class="flex items-center justify-between mb-8 relative px-4">
                  <div class="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-800 -z-10 rounded-full"></div>
                  <div
                    class="absolute left-8 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 -z-10 transition-all duration-300 rounded-full"
                    style={{ width: `calc(${(currentStep.value - 1) * 50}% - 2rem)` }}
                  ></div>

                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      class={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border-4 border-slate-900 transition-colors ${currentStep.value >= step ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`}
                    >
                      {step}
                    </div>
                  ))}
                </div>

                <Form action={(user ? userAction : guestAction) as any} class="space-y-6">
                  <input type="hidden" name="pitchId" value={selectedPitchId.value} />
                  <input type="hidden" name="time" value={timeStr.value} />
                  {selectedExtras.value.map((ext) => (
                    <input key={ext.name} type="hidden" name="extras[]" value={JSON.stringify(ext)} />
                  ))}

                  {((userAction.value as any)?.message || (guestAction.value as any)?.message) && (
                    <Alert.Root look="alert" class="bg-red-500/10 border-red-500/20 text-red-400 rounded-xl">
                      <Alert.Description>{(userAction.value as any)?.message || (guestAction.value as any)?.message}</Alert.Description>
                    </Alert.Root>
                  )}

                  <div class={["space-y-6 animate-fade-in", currentStep.value !== 1 && "hidden"]}>
                    {selectedPitch.value && (
                      <div class="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex justify-between items-center">
                        <div>
                          <h4 class="text-white font-bold">{selectedPitch.value.name}</h4>
                          <span class="text-xs text-emerald-400 font-black tracking-widest uppercase">{selectedPitch.value.type}</span>
                        </div>
                        <div class="text-right">
                          <span class="block text-sm text-slate-400">Precio Base</span>
                          <span class="text-white font-bold">${selectedPitch.value.pricePerHour}/hr</span>
                        </div>
                      </div>
                    )}

                    {!user && (
                      <div class="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-4 text-sm leading-relaxed">
                        <strong class="font-black block mb-1">Atención Invitado:</strong>
                        Tu solicitud requerirá aprobación. Para confirmar al instante,{" "}
                        <Link href="/auth/register" class="font-bold underline hover:text-amber-200">
                          crea un usuario
                        </Link>
                        .
                      </div>
                    )}

                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <div class="flex justify-between items-center mb-2">
                          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest">Fecha</label>
                          <div class="flex gap-2">
                            <button
                              type="button"
                              onClick$={() => {
                                const today = new Date();
                                const yyyy = today.getFullYear();
                                const mm = String(today.getMonth() + 1).padStart(2, "0");
                                const dd = String(today.getDate()).padStart(2, "0");
                                dateStr.value = `${yyyy}-${mm}-${dd}`;
                              }}
                              class="text-[10px] font-black text-emerald-400 hover:text-emerald-200 px-2 py-0.5 border border-emerald-500/30 hover:border-emerald-500 rounded-md transition-all uppercase tracking-widest"
                            >
                              Hoy
                            </button>
                            <button
                              type="button"
                              onClick$={() => {
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                const yyyy = tomorrow.getFullYear();
                                const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
                                const dd = String(tomorrow.getDate()).padStart(2, "0");
                                dateStr.value = `${yyyy}-${mm}-${dd}`;
                              }}
                              class="text-[10px] font-black text-emerald-400 hover:text-emerald-200 px-2 py-0.5 border border-emerald-500/30 hover:border-emerald-500 rounded-md transition-all uppercase tracking-widest"
                            >
                              Mañana
                            </button>
                          </div>
                        </div>
                        <input
                          type="date"
                          name="date"
                          required
                          bind:value={dateStr}
                          min={new Date().toISOString().split("T")[0]}
                          class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-medium"
                        />
                      </div>
                      <div>
                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Duración</label>
                        <select
                          name="duration"
                          required
                          bind:value={durationStr}
                          class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-medium appearance-none"
                        >
                          <option value="60">60 min (1h)</option>
                          <option value="90">90 min (1.5h)</option>
                          <option value="120">120 min (2h)</option>
                        </select>
                      </div>
                    </div>

                    {timeGridUI}

                    <div class="pt-4 border-t border-white/5">
                      <Button
                        type="button"
                        onClick$={nextStep}
                        disabled={!timeStr.value || isSubmitDisabled.value}
                        look="primary"
                        class="w-full py-4 rounded-xl bg-emerald-500 text-white font-black uppercase tracking-wider hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Siguiente Paso
                      </Button>
                    </div>
                  </div>

                  <div class={["space-y-6 animate-fade-in", currentStep.value !== 2 && "hidden"]}>
                    <h4 class="text-lg font-black text-white text-center">Tus Datos</h4>

                    {!user ? (
                      <div class="space-y-4">
                        <div>
                          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nombre Completo *</label>
                          <input
                            type="text"
                            name="guestName"
                            placeholder="Ej: Juan Pérez"
                            required
                            class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Teléfono (WhatsApp) *</label>
                          <input
                            type="tel"
                            name="guestPhone"
                            placeholder="+54 9 11 1234-5678"
                            required
                            class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email (Opcional)</label>
                          <input
                            type="email"
                            name="guestEmail"
                            placeholder="juan@ejemplo.com"
                            class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div class="bg-slate-800/50 p-6 rounded-xl border border-emerald-500/20 text-center">
                        <div class="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black">
                          U
                        </div>
                        <h5 class="text-white font-bold text-lg">Usuario Registrado</h5>
                        <p class="text-emerald-400 text-sm mt-1">Usaremos tu cuenta para la reserva</p>
                      </div>
                    )}

                    <div class="flex gap-4 pt-4 border-t border-white/5">
                      <Button
                        type="button"
                        onClick$={prevStep}
                        look="secondary"
                        class="flex-[1] py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider transition-colors"
                      >
                        Atrás
                      </Button>
                      <Button
                        type="button"
                        onClick$={nextStep}
                        look="primary"
                        class="flex-[2] py-4 rounded-xl bg-emerald-500 text-white font-black uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                      >
                        Siguiente Paso
                      </Button>
                    </div>
                  </div>

                  <div class={["space-y-6 animate-fade-in", currentStep.value !== 3 && "hidden"]}>
                    <div>
                      <h4 class="text-lg font-black text-white mb-4">Servicios Adicionales (Opcional)</h4>
                      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {((settings?.extraServices as any[]) || []).map((extra) => {
                          const isSelected = selectedExtras.value.some((e) => e.name === extra.name);
                          return (
                            <button
                              key={extra.name}
                              type="button"
                              onClick$={() => toggleExtra({ name: extra.name, price: Number(extra.price) })}
                              class={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${isSelected ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(0,20,7,0.35)]" : "bg-slate-800 border-white/10 text-slate-400 hover:border-emerald-500/50 hover:bg-slate-800/80"}`}
                            >
                              <span class="text-2xl">{extra.icon}</span>
                              <div class="text-center">
                                <div class="text-[10px] font-bold uppercase leading-tight text-white mb-1">{extra.name}</div>
                                <div class="text-xs font-black text-emerald-400">+${extra.price}</div>
                              </div>
                            </button>
                          );
                        })}
                        {((settings?.extraServices as any[]) || []).length === 0 && (
                          <div class="col-span-full text-center text-slate-500 text-sm py-4 border border-dashed border-white/10 rounded-xl">
                            No hay servicios adicionales configurados.
                          </div>
                        )}
                      </div>
                    </div>

                    <div class="bg-slate-800/50 rounded-xl p-4 border border-emerald-500/20 mt-6">
                      <div class="space-y-2 mb-4 pb-4 border-b border-white/5">
                        <div class="flex justify-between items-center">
                          <span class="text-sm text-slate-400">Precio de la Cancha:</span>
                          <span class="text-sm font-medium text-white">${dynamicPrice.value}</span>
                        </div>
                        {extrasTotal.value > 0 && (
                          <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-400">Servicios Adicionales:</span>
                            <span class="text-sm font-medium text-white">${extrasTotal.value}</span>
                          </div>
                        )}
                        <div class="flex justify-between items-center pt-2 border-t border-white/5">
                          <span class="text-sm font-bold text-emerald-400">Total general:</span>
                          <span class="text-2xl font-black text-white">${totalPrice.value}</span>
                        </div>
                      </div>

                      <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Método de Pago</label>
                      <div class="flex flex-wrap gap-2 mb-6">
                        {(settings?.paymentMethods || [])
                          .filter((pm: any) => pm.isActive)
                          .map((pm: any) => (
                            <label
                              key={pm.id}
                              class="flex-1 min-w-[120px] text-center p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10"
                            >
                              <input
                                type="radio"
                                name="paymentMethod"
                                value={pm.id}
                                checked={paymentMethod.value === pm.id}
                                onInput$={() => paymentMethod.value = pm.id}
                                class="hidden"
                              />
                              <span class="text-sm font-bold text-white">{pm.name}</span>
                            </label>
                          ))}
                        {(settings?.paymentMethods || []).filter((pm: any) => pm.isActive).length === 0 && (
                          <>
                            <label class="flex-1 text-center p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                              <input
                                type="radio"
                                name="paymentMethod"
                                value="CASH"
                                checked={paymentMethod.value === "CASH"}
                                onInput$={() => paymentMethod.value = "CASH"}
                                class="hidden"
                              />
                              <span class="text-sm font-bold text-white">Efectivo</span>
                            </label>
                            <label class="flex-1 text-center p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                              <input
                                type="radio"
                                name="paymentMethod"
                                value="TRANSFER"
                                checked={paymentMethod.value === "TRANSFER"}
                                onInput$={() => paymentMethod.value = "TRANSFER"}
                                class="hidden"
                              />
                              <span class="text-sm font-bold text-white">Transferencia</span>
                            </label>
                          </>
                        )}
                      </div>

                      {paymentMethod.value === "TRANSFER" && (
                        <div class="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          <p class="text-sm text-emerald-100 mb-2">Para confirmar tu reserva, envía la transferencia al siguiente alias:</p>
                          <div class="text-lg font-black text-emerald-400 mb-3 bg-slate-900/50 p-2 rounded text-center select-all">
                            {settings?.bankAlias || "No configurado"}
                          </div>
                          <p class="text-xs text-emerald-200/70">
                            Por favor, envía el comprobante por WhatsApp al: <br />
                            <a
                              href={`https://wa.me/${settings?.whatsappNumber?.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              class="font-bold text-emerald-400 hover:underline"
                            >
                              {settings?.whatsappNumber || "No configurado"}
                            </a>
                          </p>
                        </div>
                      )}

                      <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Modalidad de Pago</label>
                      <div class="space-y-2">
                        {paymentMethod.value === "CASH" && (
                          <label class="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                            <input
                              type="radio"
                              name="paymentOption"
                              value="LATER"
                              checked={paymentOption.value === "LATER"}
                              onInput$={() => paymentOption.value = "LATER"}
                              class="text-emerald-400 focus:ring-emerald-500 bg-slate-900 border-white/20"
                            />
                            <span class="text-sm font-medium text-white flex-1">Abonar en el club</span>
                          </label>
                        )}
                        <label class="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                          <input
                            type="radio"
                            name="paymentOption"
                            value="SENA"
                            checked={paymentOption.value === "SENA"}
                            onInput$={() => paymentOption.value = "SENA"}
                            class="text-emerald-400 focus:ring-emerald-500 bg-slate-900 border-white/20"
                          />
                          <div class="flex-1">
                            <span class="text-sm font-medium text-white block">Abonar Seña ({senaLabel.value})</span>
                            <span class="text-xs text-slate-400">Pagas hoy: ${senaAmount.value}</span>
                          </div>
                        </label>
                        <label class="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                          <input
                            type="radio"
                            name="paymentOption"
                            value="TOTAL"
                            checked={paymentOption.value === "TOTAL"}
                            onInput$={() => paymentOption.value = "TOTAL"}
                            class="text-emerald-400 focus:ring-emerald-500 bg-slate-900 border-white/20"
                          />
                          <div class="flex-1">
                            <span class="text-sm font-medium text-white block">Abonar Total</span>
                            <span class="text-xs text-slate-400">Pagas hoy: ${totalPrice.value}</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div class="flex gap-4 pt-4 border-t border-white/5">
                      <Button
                        type="button"
                        onClick$={prevStep}
                        look="secondary"
                        class="flex-[1] py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider transition-colors"
                      >
                        Atrás
                      </Button>
                      <Button
                        type="submit"
                        disabled={userAction.isRunning || guestAction.isRunning}
                        look="primary"
                        class="flex-[2] py-4 rounded-xl bg-emerald-500 text-white font-black uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                      >
                        {(userAction.isRunning || guestAction.isRunning) ? "Procesando..." : "Confirmar Reserva"}
                      </Button>
                    </div>
                  </div>
                </Form>
              </div>
            )}
          </div>
        </Modal.Panel>
      </Modal.Root>
    );
  },
);
