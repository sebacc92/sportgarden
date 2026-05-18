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
  holidays?: { date: string; name: string }[];
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

    // Form inputs state for validation to enable steps
    const guestName = useSignal("");
    const guestPhone = useSignal("");
    const guestEmail = useSignal("");

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

    useTask$((ctx) => {
      const open = ctx.track(() => isOpen.value);
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
        guestName.value = "";
        guestPhone.value = "";
        guestEmail.value = "";
        return;
      }
      ctx.track(() => selectedPitchId.value);
      dateStr.value = "";
      timeStr.value = "";
      durationStr.value = "60";
      occupiedSlots.value = [];
      selectedExtras.value = [];
    });

    useTask$((ctx) => {
      const open = ctx.track(() => isOpen.value);
      const pitchId = ctx.track(() => selectedPitchId.value);
      const date = ctx.track(() => dateStr.value);

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
      const holidays = (settings.holidays || []).map((h: any) => h.date);

      return calculateProportionalPrice(
        dateStr.value,
        timeStr.value,
        durationMins,
        sp.pricePerHour,
        (sp as any).pricingRules || [],
        holidays
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

    // Auto-set the payment option for registered users if deposit amount exists
    useTask$((ctx) => {
      ctx.track(() => senaAmount.value);
      if (user && senaAmount.value > 0) {
        paymentOption.value = "SENA";
      } else {
        paymentOption.value = "LATER";
      }
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

    const isStep2Enabled = useComputed$(() => {
      return !!dateStr.value && !!timeStr.value && !isOverlapping.value;
    });

    const isStep3Enabled = useComputed$(() => {
      if (!isStep2Enabled.value) return false;
      if (!user) {
        return !!guestName.value && !!guestPhone.value;
      }
      return true;
    });

    const timeGridUI = (
      <div class="space-y-3">
        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between">
          <span>Horario disponible</span>
          {isCheckingAvailability.value && <span class="text-emerald-400 animate-pulse text-xs font-bold">Cargando disponibilidad...</span>}
        </label>

        {!dateStr.value ? (
          <div class="text-sm text-slate-400 font-medium p-6 bg-slate-900/50 rounded-2xl border border-white/5 text-center">
            Selecciona una fecha para ver los horarios.
          </div>
        ) : (
          <div class="grid grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1">
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
                    "py-2.5 px-1 text-sm font-bold rounded-xl border transition-all text-center",
                    disabled
                      ? "opacity-20 border-white/5 bg-slate-950 cursor-not-allowed text-slate-600 line-through"
                      : selected
                        ? "bg-emerald-500 border-emerald-300 text-white shadow-lg shadow-emerald-500/20 scale-105"
                        : "bg-slate-800 border-white/5 text-slate-300 hover:border-emerald-500/50 hover:bg-slate-700/80 hover:text-white",
                  ]}
                >
                  {time}
                </button>
              );
            })}
          </div>
        )}
        {isOverlapping.value && timeStr.value && (
          <div class="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-bold flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            El horario seleccionado coincide con un turno reservado.
          </div>
        )}
      </div>
    );

    return (
      <Modal.Root bind:show={isOpen}>
        <Modal.Panel class="bg-[#0b1710] border border-white/10 rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-7 text-white shadow-2xl">
          <div class="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
            <div>
              <Modal.Title class="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Solicitar Reserva
                {selectedPitch.value && (
                  <span class="text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {selectedPitch.value.name}
                  </span>
                )}
              </Modal.Title>
              <Modal.Description class="text-slate-400 text-xs font-semibold mt-1">Completa los pasos para reservar tu cancha en Garden Club.</Modal.Description>
            </div>
            <Modal.Close class="text-slate-400 hover:text-white transition-colors p-2 bg-slate-900/60 rounded-full hover:bg-slate-800 border border-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Modal.Close>
          </div>

          <div>
            {(guestAction.value?.success || userAction.value?.success) ? (
              <div class="text-center py-10 max-w-md mx-auto">
                <div class="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-lg shadow-emerald-950">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 class="text-2xl font-black text-white mb-2">¡Reserva Solicitada!</h3>
                <div class="text-slate-300 text-sm mb-8 space-y-3 leading-relaxed">
                  {guestAction.value?.success ? (
                    <div class="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl p-4 text-left">
                      <p class="font-bold mb-1 text-base">⚠️ Turno Pendiente de Confirmación</p>
                      <p class="text-slate-300 text-xs font-medium">Al reservar como <span class="text-amber-400 font-bold">Invitado</span>, tu solicitud queda en revisión. El encargado del club se contactará contigo por WhatsApp para confirmar la disponibilidad y darte de alta.</p>
                    </div>
                  ) : (
                    <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-2xl p-4 text-left">
                      <p class="font-bold mb-1 text-base">✅ Reserva Confirmada al Instante</p>
                      <p class="text-slate-300 text-xs font-medium">¡Excelente! Tu turno ha sido agendado exitosamente bajo tu usuario. Te enviamos los detalles a tu casilla de correo. ¡Te esperamos en el club!</p>
                    </div>
                  )}
                </div>
                <Button
                  onClick$={onClose}
                  look="secondary"
                  class="w-full py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider border border-white/5 transition-all"
                >
                  Entendido / Cerrar
                </Button>
              </div>
            ) : (
              <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                
                {/* LEFT COLUMN: THE WIZARD FORM */}
                <div class="md:col-span-7 lg:col-span-8 bg-slate-900/40 p-4 sm:p-6 rounded-2xl border border-white/5 space-y-6">
                  
                  {/* Clickable Wizard Progress Steps Bar */}
                  <div class="flex items-center justify-between mb-8 relative px-4 max-w-sm mx-auto">
                    <div class="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-800 -z-10 rounded-full"></div>
                    <div
                      class="absolute left-8 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 -z-10 transition-all duration-300 rounded-full"
                      style={{ width: `calc(${(currentStep.value - 1) * 50}%)` }}
                    ></div>

                    {[1, 2, 3].map((step) => {
                      const isCompletedOrCurrent = currentStep.value >= step;
                      const isClickable = step === 1 || (step === 2 && isStep2Enabled.value) || (step === 3 && isStep3Enabled.value);
                      return (
                        <button
                          key={step}
                          type="button"
                          disabled={!isClickable}
                          onClick$={() => {
                            currentStep.value = step;
                          }}
                          class={[
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border-4 border-[#0b1710] transition-all relative z-10",
                            currentStep.value === step
                              ? "bg-emerald-500 text-white ring-4 ring-emerald-500/20 scale-110 font-black"
                              : isClickable
                                ? "bg-emerald-800 text-slate-100 hover:bg-emerald-700 cursor-pointer"
                                : "bg-slate-800 text-slate-500 cursor-not-allowed",
                          ]}
                          title={`Ir al paso ${step}`}
                        >
                          {step}
                        </button>
                      );
                    })}
                  </div>

                  <Form action={(user ? userAction : guestAction) as any} class="space-y-6">
                    <input type="hidden" name="pitchId" value={selectedPitchId.value} />
                    <input type="hidden" name="time" value={timeStr.value} />
                    {selectedExtras.value.map((ext) => (
                      <input key={ext.name} type="hidden" name="extras[]" value={JSON.stringify(ext)} />
                    ))}

                    {((userAction.value as any)?.message || (guestAction.value as any)?.message) && (
                      <Alert.Root look="alert" class="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                        <Alert.Description>{(userAction.value as any)?.message || (guestAction.value as any)?.message}</Alert.Description>
                      </Alert.Root>
                    )}

                    {/* STEP 1: DATE AND TIME */}
                    <div class={["space-y-6 animate-fade-in", currentStep.value !== 1 && "hidden"]}>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div class="flex justify-between items-center mb-2">
                            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest">Fecha del turno</label>
                            <div class="flex gap-1.5">
                              <button
                                type="button"
                                onClick$={() => {
                                  const today = new Date();
                                  const yyyy = today.getFullYear();
                                  const mm = String(today.getMonth() + 1).padStart(2, "0");
                                  const dd = String(today.getDate()).padStart(2, "0");
                                  dateStr.value = `${yyyy}-${mm}-${dd}`;
                                }}
                                class="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 px-2 py-0.5 border border-emerald-500/20 hover:border-emerald-500/40 rounded bg-emerald-500/5 transition-all uppercase tracking-wider"
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
                                class="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 px-2 py-0.5 border border-emerald-500/20 hover:border-emerald-500/40 rounded bg-emerald-500/5 transition-all uppercase tracking-wider"
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
                            class="w-full bg-slate-850 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-semibold"
                          />
                        </div>
                        <div>
                          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Duración</label>
                          <select
                            name="duration"
                            required
                            bind:value={durationStr}
                            class="w-full bg-slate-850 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-semibold appearance-none cursor-pointer"
                          >
                            <option value="60">60 min (1 hora)</option>
                            <option value="90">90 min (1.5 horas)</option>
                            <option value="120">120 min (2 horas)</option>
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
                          class="w-full py-4 rounded-xl bg-emerald-500 text-white font-black uppercase tracking-wider hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
                        >
                          Continuar a Datos
                        </Button>
                      </div>
                    </div>

                    {/* STEP 2: USER IDENTIFICATION / CONTACT FORM */}
                    <div class={["space-y-6 animate-fade-in", currentStep.value !== 2 && "hidden"]}>
                      
                      {!user ? (
                        <div class="space-y-5">
                          {/* Login / Register Prominent Box */}
                          <div class="bg-gradient-to-br from-emerald-950/40 to-slate-900 p-5 rounded-2xl border border-emerald-500/20 space-y-3.5 relative overflow-hidden shadow-md">
                            <div class="absolute -right-6 -top-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
                            <div class="flex items-start gap-3">
                              <span class="text-2xl mt-0.5">⚡</span>
                              <div>
                                <h5 class="text-sm font-bold text-white uppercase tracking-wider">¡Obtén Confirmación Instantánea!</h5>
                                <p class="text-slate-300 text-xs mt-1 leading-relaxed font-semibold">
                                  Los usuarios registrados pueden reservar con confirmación instantánea pagando solo la seña mínima.
                                </p>
                              </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3 pt-2">
                              <Link
                                href="/auth/register"
                                target="_blank"
                                class="text-center bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all shadow-md shadow-emerald-950"
                              >
                                Crear Cuenta
                              </Link>
                              <Link
                                href="/auth/login"
                                target="_blank"
                                class="text-center bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider py-2.5 rounded-xl border border-white/5 transition-all"
                              >
                                Iniciar Sesión
                              </Link>
                            </div>
                            <p class="text-[10px] text-slate-400 text-center font-bold italic pt-1">
                              * Si ya te registraste en la otra pestaña, simplemente vuelve aquí y continúa.
                            </p>
                          </div>

                          <div class="relative flex py-2 items-center">
                            <div class="flex-grow border-t border-white/5"></div>
                            <span class="flex-shrink mx-4 text-slate-500 text-xs uppercase font-black tracking-widest">O continúa como Invitado</span>
                            <div class="flex-grow border-t border-white/5"></div>
                          </div>

                          <div class="space-y-4">
                            <div>
                              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nombre Completo *</label>
                              <input
                                type="text"
                                name="guestName"
                                placeholder="Ej: Juan Pérez"
                                required
                                bind:value={guestName}
                                class="w-full bg-slate-850 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-semibold"
                              />
                            </div>
                            <div>
                              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Teléfono (WhatsApp) *</label>
                              <input
                                type="tel"
                                name="guestPhone"
                                placeholder="Ej: 1112345678"
                                required
                                bind:value={guestPhone}
                                class="w-full bg-slate-850 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-semibold"
                              />
                            </div>
                            <div>
                              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email (Opcional)</label>
                              <input
                                type="email"
                                name="guestEmail"
                                placeholder="juan@ejemplo.com"
                                bind:value={guestEmail}
                                class="w-full bg-slate-850 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-semibold"
                              />
                            </div>
                          </div>

                          <div class="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-4 text-xs leading-relaxed font-semibold">
                            <strong class="font-black block mb-1">ℹ️ Nota de Confirmación:</strong>
                            Al no tener sesión activa, tu reserva quedará <span class="text-amber-400 font-bold underline">Pendiente de Aprobación</span>. Deberás aguardar a que el club verifique y apruebe tu turno para que sea válido.
                          </div>
                        </div>
                      ) : (
                        <div class="space-y-4">
                          <div class="bg-emerald-950/30 p-6 rounded-2xl border border-emerald-500/20 text-center space-y-3">
                            <div class="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl font-black border border-emerald-500/20">
                              {user.name?.[0] ?? "U"}
                            </div>
                            <div>
                              <h5 class="text-white font-bold text-base">Usuario Registrado</h5>
                              <p class="text-slate-400 text-xs font-semibold mt-1">
                                {user.name} ({user.email})
                              </p>
                            </div>
                            <span class="inline-block bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                              ⚡ Confirmación Instantánea
                            </span>
                          </div>
                          <div class="p-4 bg-slate-900/50 rounded-xl border border-white/5 text-xs text-slate-400 leading-relaxed font-semibold">
                            Cargaremos automáticamente los datos de contacto de tu cuenta para esta reserva. ¡No tienes que llenar nada!
                          </div>
                        </div>
                      )}

                      <div class="flex gap-4 pt-4 border-t border-white/5">
                        <Button
                          type="button"
                          onClick$={prevStep}
                          look="secondary"
                          class="flex-[1] py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider border border-white/5 transition-colors"
                        >
                          Atrás
                        </Button>
                        <Button
                          type="button"
                          onClick$={nextStep}
                          disabled={!isStep3Enabled.value}
                          look="primary"
                          class="flex-[2] py-4 rounded-xl bg-emerald-500 text-white font-black uppercase tracking-wider hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
                        >
                          Continuar a Pago
                        </Button>
                      </div>
                    </div>

                    {/* STEP 3: ADDONS & PAYMENT METHODS */}
                    <div class={["space-y-6 animate-fade-in", currentStep.value !== 3 && "hidden"]}>
                      
                      {/* Optional Addons */}
                      <div>
                        <h4 class="text-sm font-black text-slate-400 uppercase tracking-widest mb-3.5">Servicios Adicionales (Opcionales)</h4>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {((settings?.extraServices as any[]) || []).map((extra) => {
                            const isSelected = selectedExtras.value.some((e) => e.name === extra.name);
                            return (
                              <button
                                key={extra.name}
                                type="button"
                                onClick$={() => toggleExtra({ name: extra.name, price: Number(extra.price) })}
                                class={[
                                  "p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5",
                                  isSelected
                                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                    : "bg-slate-850 border-white/5 text-slate-400 hover:border-emerald-500/50 hover:bg-slate-800",
                                ]}
                              >
                                <span class="text-xl">{extra.icon}</span>
                                <div class="text-center">
                                  <div class="text-[10px] font-bold uppercase leading-tight text-white mb-0.5">{extra.name}</div>
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

                      {/* Payment Settings block */}
                      <div class="bg-slate-850/60 rounded-2xl p-5 border border-white/5 mt-4 space-y-5">
                        
                        {/* 1. Payment Methods Selection (Alias/Cash/etc) */}
                        <div>
                          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Método de Pago Preferido</label>
                          <div class="flex flex-wrap gap-2">
                            {(settings?.paymentMethods || [])
                              .filter((pm: any) => pm.isActive)
                              .map((pm: any) => (
                                <label
                                  key={pm.id}
                                  class={[
                                    "flex-1 min-w-[110px] text-center p-3 rounded-xl border cursor-pointer transition-all font-bold text-sm",
                                    paymentMethod.value === pm.id
                                      ? "border-emerald-500 bg-emerald-500/10 text-white"
                                      : "border-white/10 hover:bg-slate-800 text-slate-300",
                                  ]}
                                >
                                  <input
                                    type="radio"
                                    name="paymentMethod"
                                    value={pm.id}
                                    checked={paymentMethod.value === pm.id}
                                    onInput$={() => (paymentMethod.value = pm.id)}
                                    class="hidden"
                                  />
                                  <span>{pm.name}</span>
                                </label>
                              ))}
                            {(settings?.paymentMethods || []).filter((pm: any) => pm.isActive).length === 0 && (
                              <>
                                <label
                                  class={[
                                    "flex-1 text-center p-3 rounded-xl border cursor-pointer transition-all font-bold text-sm",
                                    paymentMethod.value === "CASH"
                                      ? "border-emerald-500 bg-emerald-500/10 text-white"
                                      : "border-white/10 hover:bg-slate-800 text-slate-300",
                                  ]}
                                >
                                  <input
                                    type="radio"
                                    name="paymentMethod"
                                    value="CASH"
                                    checked={paymentMethod.value === "CASH"}
                                    onInput$={() => (paymentMethod.value = "CASH")}
                                    class="hidden"
                                  />
                                  <span>Efectivo</span>
                                </label>
                                <label
                                  class={[
                                    "flex-1 text-center p-3 rounded-xl border cursor-pointer transition-all font-bold text-sm",
                                    paymentMethod.value === "TRANSFER"
                                      ? "border-emerald-500 bg-emerald-500/10 text-white"
                                      : "border-white/10 hover:bg-slate-800 text-slate-300",
                                  ]}
                                >
                                  <input
                                    type="radio"
                                    name="paymentMethod"
                                    value="TRANSFER"
                                    checked={paymentMethod.value === "TRANSFER"}
                                    onInput$={() => (paymentMethod.value = "TRANSFER")}
                                    class="hidden"
                                  />
                                  <span>Transferencia</span>
                                </label>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Alias Display for Transfer */}
                        {paymentMethod.value === "TRANSFER" && (
                          <div class="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                            <p class="text-xs text-emerald-200">Envía la transferencia al alias oficial del club:</p>
                            <div class="text-base font-black text-emerald-400 bg-slate-900/80 p-2.5 rounded-lg text-center select-all border border-emerald-500/10">
                              {settings?.bankAlias || "No configurado"}
                            </div>
                            <p class="text-[10px] text-slate-400 leading-relaxed">
                              Una vez realizada, puedes enviar el comprobante por WhatsApp al{" "}
                              <a
                                href={`https://wa.me/${settings?.whatsappNumber?.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                class="font-bold text-emerald-400 underline hover:text-emerald-300"
                              >
                                {settings?.whatsappNumber || "No configurado"}
                              </a>
                            </p>
                          </div>
                        )}

                        {/* 2. Payment Modality Options (Sena, Total, Later) */}
                        <div>
                          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Modalidad de Pago</label>
                          
                          {!user ? (
                            // Guest Payment view: Restricted! Clear warning.
                            <div class="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 space-y-2 text-xs text-amber-200 leading-relaxed font-semibold">
                              <p class="font-bold text-sm text-amber-300">📌 Pago sujeto a Aprobación</p>
                              <p>Como <span class="font-black">Invitado</span>, no necesitas pagar nada ahora. Primero, registraremos tu solicitud.</p>
                              <p>Una vez que el encargado del club confirme la disponibilidad, te contactará para coordinar el pago de la seña o el total.</p>
                              <input type="hidden" name="paymentOption" value="LATER" />
                            </div>
                          ) : (
                            // Registered User payment view: Clear choices, deposit rules
                            <div class="space-y-2.5">
                              {senaAmount.value > 0 && (
                                <label
                                  class={[
                                    "flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all",
                                    paymentOption.value === "SENA"
                                      ? "border-emerald-500 bg-emerald-500/10"
                                      : "border-white/10 hover:bg-slate-800",
                                  ]}
                                >
                                  <input
                                    type="radio"
                                    name="paymentOption"
                                    value="SENA"
                                    checked={paymentOption.value === "SENA"}
                                    onInput$={() => (paymentOption.value = "SENA")}
                                    class="text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/20 h-4.5 w-4.5"
                                  />
                                  <div class="flex-grow">
                                    <span class="text-sm font-bold text-white flex items-center gap-1.5">
                                      Abonar Seña Mínima
                                      <span class="text-[10px] font-black bg-emerald-500/25 text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        Seña: {senaLabel.value}
                                      </span>
                                    </span>
                                    <span class="text-xs text-slate-400 block mt-0.5">Pagas hoy: <span class="font-bold text-emerald-400">${senaAmount.value}</span>. El saldo restante se cancela en el club.</span>
                                  </div>
                                </label>
                              )}

                              <label
                                class={[
                                  "flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all",
                                  paymentOption.value === "TOTAL"
                                    ? "border-emerald-500 bg-emerald-500/10"
                                    : "border-white/10 hover:bg-slate-800",
                                ]}
                              >
                                <input
                                  type="radio"
                                  name="paymentOption"
                                  value="TOTAL"
                                  checked={paymentOption.value === "TOTAL"}
                                  onInput$={() => (paymentOption.value = "TOTAL")}
                                  class="text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/20 h-4.5 w-4.5"
                                />
                                <div class="flex-grow">
                                  <span class="text-sm font-bold text-white block">Abonar el Total del Turno</span>
                                  <span class="text-xs text-slate-400 block mt-0.5">Pagas hoy: <span class="font-bold text-emerald-400">${totalPrice.value}</span>. Quedas 100% al día.</span>
                                </div>
                              </label>

                              {senaAmount.value === 0 && (
                                <label
                                  class={[
                                    "flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all",
                                    paymentOption.value === "LATER"
                                      ? "border-emerald-500 bg-emerald-500/10"
                                      : "border-white/10 hover:bg-slate-800",
                                  ]}
                                >
                                  <input
                                    type="radio"
                                    name="paymentOption"
                                    value="LATER"
                                    checked={paymentOption.value === "LATER"}
                                    onInput$={() => (paymentOption.value = "LATER")}
                                    class="text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/20 h-4.5 w-4.5"
                                  />
                                  <div class="flex-grow">
                                    <span class="text-sm font-bold text-white block font-semibold">Abonar en el club</span>
                                    <span class="text-xs text-slate-400 block mt-0.5">Sin pago online. Cancelas el total en ventanilla el día del partido.</span>
                                  </div>
                                </label>
                              )}
                              
                              {senaAmount.value > 0 && (
                                <div class="p-3.5 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-[11px] text-slate-400 leading-relaxed font-semibold">
                                  📌 <span class="text-white font-bold">Nota de Confirmación Instantánea</span>: Al ser usuario registrado y seleccionar la seña mínima o el total, tu reserva queda <span class="text-emerald-400 font-bold">CONFIRMADA DIRECTAMENTE</span> en nuestro sistema de forma inmediata.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step Actions */}
                      <div class="flex gap-4 pt-4 border-t border-white/5">
                        <Button
                          type="button"
                          onClick$={prevStep}
                          look="secondary"
                          class="flex-[1] py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider border border-white/5 transition-colors"
                        >
                          Atrás
                        </Button>
                        <Button
                          type="submit"
                          disabled={userAction.isRunning || guestAction.isRunning}
                          look="primary"
                          class="flex-[2] py-4 rounded-xl bg-emerald-500 text-white font-black uppercase tracking-wider hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                        >
                          {(userAction.isRunning || guestAction.isRunning) ? "Procesando..." : !user ? "Enviar Solicitud" : "Confirmar Reserva"}
                        </Button>
                      </div>
                    </div>
                  </Form>
                </div>

                {/* RIGHT COLUMN: GORGEOUS STICKY SUMMARY CARD (DESKTOP) */}
                <div class="md:col-span-5 bg-slate-900/60 p-5 rounded-2xl border border-white/5 space-y-5 md:sticky md:top-4 h-fit">
                  <h4 class="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2.5">Resumen de Reserva</h4>
                  
                  {/* Selected Pitch Info */}
                  {selectedPitch.value ? (
                    <div class="space-y-3">
                      {selectedPitch.value.imageUrl && (
                        <img
                          src={selectedPitch.value.imageUrl}
                          alt={selectedPitch.value.name}
                          class="w-full h-32 object-cover rounded-xl border border-white/10 shadow-md"
                        />
                      )}
                      <div>
                        <div class="flex justify-between items-start">
                          <div>
                            <h5 class="text-base font-black text-white">{selectedPitch.value.name}</h5>
                            <span class="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded uppercase tracking-widest inline-block mt-1">
                              {selectedPitch.value.type} ({selectedPitch.value.surface})
                            </span>
                          </div>
                          <span class="text-sm font-black text-white">${selectedPitch.value.pricePerHour}/hr</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p class="text-xs text-slate-500 font-bold">No se ha seleccionado ninguna cancha.</p>
                  )}

                  {/* Date, Time, Duration Details */}
                  {(dateStr.value || timeStr.value) && (
                    <div class="bg-slate-850/60 p-3.5 rounded-xl border border-white/5 space-y-2 text-xs text-slate-300 font-bold">
                      {dateStr.value && (
                        <div class="flex justify-between">
                          <span class="text-slate-500 font-medium">Fecha:</span>
                          <span class="text-white">{dateStr.value}</span>
                        </div>
                      )}
                      {timeStr.value && (
                        <div class="flex justify-between">
                          <span class="text-slate-500 font-medium">Horario:</span>
                          <span class="text-white font-extrabold text-emerald-400">{timeStr.value} hs</span>
                        </div>
                      )}
                      {durationStr.value && (
                        <div class="flex justify-between">
                          <span class="text-slate-500 font-medium">Duración:</span>
                          <span class="text-white">{durationStr.value} minutos</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected Extras List */}
                  {selectedExtras.value.length > 0 && (
                    <div class="space-y-1.5">
                      <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Adicionales contratados</p>
                      <div class="space-y-1">
                        {selectedExtras.value.map((extra) => (
                          <div key={extra.name} class="flex justify-between text-xs text-slate-300 font-bold bg-slate-950/30 px-3 py-1.5 rounded-lg border border-white/5">
                            <span>{extra.name}</span>
                            <span class="text-white">+${extra.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Booking confirmation status alert */}
                  <div class="pt-3 border-t border-white/5 space-y-4">
                    
                    {/* Prices Breakdown */}
                    <div class="space-y-2.5">
                      {extrasTotal.value > 0 && (
                        <div class="flex justify-between text-xs text-slate-400 font-semibold">
                          <span>Cancha ({durationStr.value}m):</span>
                          <span>${dynamicPrice.value}</span>
                        </div>
                      )}
                      {extrasTotal.value > 0 && (
                        <div class="flex justify-between text-xs text-slate-400 font-semibold">
                          <span>Adicionales:</span>
                          <span>${extrasTotal.value}</span>
                        </div>
                      )}
                      <div class="flex justify-between items-center bg-slate-800/40 p-3 rounded-xl border border-white/5">
                        <span class="text-xs font-black text-emerald-400 uppercase tracking-widest">Total:</span>
                        <span class="text-xl font-black text-white">${totalPrice.value}</span>
                      </div>
                    </div>

                    {/* Sena/Deposit details when applicable */}
                    {senaAmount.value > 0 && (
                      <div class="bg-emerald-950/20 border border-emerald-500/10 p-3 rounded-xl space-y-1.5 text-xs">
                        <div class="flex justify-between text-slate-300 font-bold">
                          <span>Seña Requerida:</span>
                          <span class="text-emerald-400 font-black">${senaAmount.value}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 leading-normal font-semibold">
                          * Los usuarios registrados pueden confirmar el turno al instante abonando este monto de seña.
                        </p>
                      </div>
                    )}

                    {/* Info Card / Status depending on guest/user */}
                    {!user ? (
                      <div class="bg-amber-500/5 border border-amber-500/15 p-3.5 rounded-xl text-[10px] text-amber-200 leading-relaxed font-semibold">
                        <p class="font-bold text-xs text-amber-300 mb-1 flex items-center gap-1">
                          ⚠️ Requiere Aprobación
                        </p>
                        Sin cuenta de usuario, esta solicitud se registrará como <span class="font-bold text-amber-400 underline">Pendiente</span>. Recibirás respuesta por WhatsApp una vez sea verificada.
                      </div>
                    ) : (
                      <div class="bg-emerald-500/5 border border-emerald-500/15 p-3.5 rounded-xl text-[10px] text-emerald-200 leading-relaxed font-semibold">
                        <p class="font-bold text-xs text-emerald-300 mb-1 flex items-center gap-1">
                          ⚡ Confirmación Inmediata
                        </p>
                        Como usuario registrado, tu turno quedará <span class="font-bold text-emerald-400">Confirmado automáticamente</span> al abonar la seña mínima o el total.
                      </div>
                    )}

                  </div>
                </div>

              </div>
            )}
          </div>
        </Modal.Panel>
      </Modal.Root>
    );
  }
);
