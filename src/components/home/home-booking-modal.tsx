import {
  component$,
  useSignal,
  $,
  useTask$,
  useComputed$,
  useVisibleTask$,
} from "@builder.io/qwik";
import type { QRL, Signal } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { InferSelectModel } from "drizzle-orm";
import { pitches } from "~/db/schema";
import { Button, Modal, Alert } from "~/components/ui";
import { calculateProportionalPrice } from "~/utils/pricing";
import PaywayCheckout from "~/components/payway/PaywayCheckout";
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
  operatingHours?: { day: number; isOpen: boolean; openTime: string; closeTime: string }[];
  paywayPublicKey?: string | null;
  isPaywayActive?: boolean | null;
  paywayEnvironment?: string | null;
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
  confirmarPagoPaywayAction: any;
};

export const isWithinOperatingHoursHelper = (
  time: string,
  dateStr: string | null,
  settings: SiteSettingsShape,
) => {
  if (!dateStr) return false;

  const isHoliday = (settings.holidays || []).some((h: any) => h.date === dateStr);
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = isHoliday ? 7 : localDate.getDay();

  const operatingHours = (() => {
    try {
      if (typeof settings?.operatingHours === "string") {
        return JSON.parse(settings.operatingHours);
      }
      if (Array.isArray(settings?.operatingHours)) {
        return settings.operatingHours;
      }
      return [];
    } catch {
      return [];
    }
  })();

  const schedule = operatingHours.find((h: any) => h.day === dayOfWeek);
  const isOpen = schedule ? schedule.isOpen : true;
  if (!isOpen) return false;

  const openTime = schedule?.openTime || "08:00";
  const closeTime = schedule?.closeTime || "23:00";

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const slotStartMin = timeToMinutes(time);
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);

  return slotStartMin >= openMin && slotStartMin < closeMin;
};

export const isSlotDisabledHelper = (
  time: string,
  dateStr: string | null,
  durationStr: string,
  occupiedSlots: any[],
  settings: SiteSettingsShape,
) => {
  if (!dateStr) return true;

  // 1. Check if the slot is in the past
  const now = new Date();
  const slotDateTime = new Date(`${dateStr}T${time}:00-03:00`);
  if (slotDateTime <= now) {
    return true;
  }

  // 2. Check operating hours and duration boundaries
  const isHoliday = (settings.holidays || []).some((h: any) => h.date === dateStr);
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = isHoliday ? 7 : localDate.getDay();

  const operatingHours = (() => {
    try {
      if (typeof settings?.operatingHours === "string") {
        return JSON.parse(settings.operatingHours);
      }
      if (Array.isArray(settings?.operatingHours)) {
        return settings.operatingHours;
      }
      return [];
    } catch {
      return [];
    }
  })();

  const schedule = operatingHours.find((h: any) => h.day === dayOfWeek);
  const isOpen = schedule ? schedule.isOpen : true;
  if (!isOpen) return true;

  const openTime = schedule?.openTime || "08:00";
  const closeTime = schedule?.closeTime || "23:00";

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const slotStartMin = timeToMinutes(time);
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  const durationMin = parseInt(durationStr, 10);
  const slotEndMin = slotStartMin + durationMin;

  // Must start on or after opening, and end on or before closing
  if (slotStartMin < openMin || slotEndMin > closeMin) {
    return true;
  }

  // 3. Check overlaps with occupied bookings
  const start = new Date(`${dateStr}T${time}:00`).getTime();
  const end = start + durationMin * 60000;

  return occupiedSlots.some((slot) => {
    const slotStart = new Date(slot.startTime).getTime();
    const slotEnd = new Date(slot.endTime).getTime();
    return start < slotEnd && end > slotStart;
  });
};

export const isTransfer = (method: string | undefined | null) => {
  if (!method) return false;
  const m = method.toUpperCase();
  return m === "TRANSFER" || m === "TRANSFERENCIA" || m.includes("TRANSFER") || m.includes("BANK");
};

export const isTransferMethod = (id: string, name: string) => {
  const idLower = id.toLowerCase();
  const nameLower = name.toLowerCase();
  return (
    idLower.includes("transfer") ||
    nameLower.includes("transfer") ||
    idLower.includes("cbu") ||
    nameLower.includes("cbu") ||
    idLower.includes("alias") ||
    nameLower.includes("alias")
  );
};

export const HomeBookingModal = component$<HomeBookingModalProps>(
  ({
    isOpen,
    selectedPitchId,
    onClose,
    pitches: pitchesRows,
    user,
    settings,
    guestAction,
    userAction,
    confirmarPagoPaywayAction,
  }) => {
    const getLocalDateString = (offset = 0) => {
      const d = new Date();
      if (offset !== 0) d.setDate(d.getDate() + offset);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    const dateStr = useSignal("");
    const timeStr = useSignal("");
    const occupiedSlots = useSignal<{ startTime: string; endTime: string }[]>(
      [],
    );
    const isCheckingAvailability = useSignal(false);

    const currentStep = useSignal(1);
    const selectedExtras = useSignal<{ name: string; price: number }[]>([]);
    const paymentMethod = useSignal("CASH");
    const paymentOption = useSignal("LATER");

    const durationStr = useSignal("60");

    // Payway modal flow signals
    const showPaywayModal = useSignal(false);
    const paywayBookingId = useSignal<string | null>(null);
    const paywayAmount = useSignal<number>(0);
    const paywayPaymentSuccess = useSignal(false);

    // Form inputs state for validation to enable steps
    const guestName = useSignal("");
    const guestPhone = useSignal("");
    const guestEmail = useSignal("");

    const copiedSignal = useSignal(false);
    const timeLeft = useSignal(15 * 60);

    const copyAlias = $((alias: string) => {
      if (!alias) return;
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(alias).then(() => {
          copiedSignal.value = true;
          setTimeout(() => {
            copiedSignal.value = false;
          }, 2000);
        });
      }
    });

    const formatTimeLeft = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    useVisibleTask$(({ cleanup }) => {
      const timer = setInterval(() => {
        if (userAction.value?.success && isTransfer(userAction.value.paymentMethod)) {
          if (timeLeft.value > 0) {
            timeLeft.value--;
          } else {
            clearInterval(timer);
          }
        }
      }, 1000);
      cleanup(() => clearInterval(timer));
    });

    const toggleExtra = $((extra: { name: string; price: number }) => {
      const exists = selectedExtras.value.find((e) => e.name === extra.name);
      if (exists) {
        selectedExtras.value = selectedExtras.value.filter(
          (e) => e.name !== extra.name,
        );
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

    const selectedPitch = useComputed$(() =>
      pitchesRows.find((p) => p.id === selectedPitchId.value),
    );

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
        showPaywayModal.value = false;
        paywayBookingId.value = null;
        paywayAmount.value = 0;
        paywayPaymentSuccess.value = false;
        timeLeft.value = 15 * 60;
        return;
      }
      ctx.track(() => selectedPitchId.value);
      dateStr.value = "";
      timeStr.value = "";
      durationStr.value = "60";
      occupiedSlots.value = [];
      selectedExtras.value = [];
      showPaywayModal.value = false;
      paywayBookingId.value = null;
      paywayAmount.value = 0;
      paywayPaymentSuccess.value = false;
      timeLeft.value = 15 * 60;
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

    const isSubmitDisabled = useComputed$(
      () => isOverlapping.value || isCheckingAvailability.value,
    );

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
        holidays,
      );
    });

    const extrasTotal = useComputed$(() =>
      selectedExtras.value.reduce((acc, extra) => acc + extra.price, 0),
    );

    const totalPrice = useComputed$(
      () => dynamicPrice.value + extrasTotal.value,
    );

    const senaAmount = useComputed$(() => {
      const sp = selectedPitch.value;
      if (!sp) return 0;
      const depositType = (sp as any).depositType ?? "PERCENTAGE";
      const depositAmount = (sp as any).depositAmount ?? 0;
      return depositType === "FIXED"
        ? depositAmount
        : (depositAmount / 100) * totalPrice.value;
    });

    const senaLabel = useComputed$(() => {
      const sp = selectedPitch.value;
      if (!sp) return "0%";
      const depositType = (sp as any).depositType ?? "PERCENTAGE";
      const depositAmount = (sp as any).depositAmount ?? 0;
      return depositType === "FIXED"
        ? `$${depositAmount}`
        : `${depositAmount}%`;
    });

    // Auto-set the payment option for registered users if deposit amount exists
    useTask$((ctx) => {
      ctx.track(() => senaAmount.value);
      if (showPaywayModal.value) return;
      if (user && senaAmount.value > 0) {
        paymentOption.value = "SENA";
      } else {
        paymentOption.value = "LATER";
      }
    });

    // Redirect to Mercado Pago or show Payway Modal if online payment is chosen
    useTask$((ctx) => {
      const userResult = ctx.track(() => userAction.value);
      const guestResult = ctx.track(() => guestAction.value);
      const actionResult = user ? userResult : guestResult;

      if (showPaywayModal.value || paywayPaymentSuccess.value) {
        return;
      }

      if (actionResult?.success) {
        if (actionResult.checkoutUrl) {
          if (typeof window !== "undefined") {
            window.location.href = actionResult.checkoutUrl;
          }
        } else if (actionResult.paymentMethod === "PAYWAY" && actionResult.amountToCharge > 0) {
          paywayBookingId.value = actionResult.bookingId;
          paywayAmount.value = actionResult.amountToCharge;
          showPaywayModal.value = true;
        }
      }
    });

    // Auto-reset the selected time if it becomes disabled (e.g. by changing date or duration)
    useTask$((ctx) => {
      const date = ctx.track(() => dateStr.value);
      const time = ctx.track(() => timeStr.value);
      const duration = ctx.track(() => durationStr.value);
      const occupied = ctx.track(() => occupiedSlots.value);

      if (!time || !date) return;
      if (showPaywayModal.value) return;

      if (
        isSlotDisabledHelper(
          time,
          date,
          duration,
          occupied,
          settings,
        )
      ) {
        timeStr.value = "";
      }
    });

    const isStep2Enabled = useComputed$(() => {
      return (
        !!dateStr.value &&
        !!timeStr.value &&
        !isSlotDisabledHelper(
          timeStr.value,
          dateStr.value,
          durationStr.value,
          occupiedSlots.value,
          settings,
        )
      );
    });

    const isStep3Enabled = useComputed$(() => {
      if (!isStep2Enabled.value) return false;
      if (!user) {
        return !!guestName.value && !!guestPhone.value;
      }
      return true;
    });

    const TIME_PERIODS = [
      { label: "🌅 Mañana", from: "06:00", to: "11:59" },
      { label: "☀️ Tarde", from: "12:00", to: "17:59" },
      { label: "🌙 Noche", from: "18:00", to: "23:59" },
    ];

    const timeGridUI = (
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <label class="text-xs font-black tracking-widest text-slate-400 uppercase">
            Horario disponible
          </label>
          {isCheckingAvailability.value && (
            <span class="flex animate-pulse items-center gap-1 text-[10px] font-bold text-emerald-400">
              <svg class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Verificando...
            </span>
          )}
        </div>

        {!dateStr.value ? (
          <div class="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/8 bg-slate-900/40 p-8 text-center">
            <svg
              class="h-8 w-8 text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p class="text-sm font-semibold text-slate-500">
              Seleccioná una fecha para ver los turnos disponibles
            </p>
          </div>
        ) : (
          <div class="space-y-4">
            {TIME_PERIODS.map((period) => {
              const slotsInPeriod = TIME_SLOT_OPTIONS.filter(
                (t) =>
                  t >= period.from &&
                  t <= period.to &&
                  isWithinOperatingHoursHelper(t, dateStr.value, settings),
              );
              const availableInPeriod = slotsInPeriod.filter(
                (t) =>
                  !isSlotDisabledHelper(
                    t,
                    dateStr.value,
                    durationStr.value,
                    occupiedSlots.value,
                    settings,
                  ),
              );
              if (slotsInPeriod.length === 0) return null;
              return (
                <div key={period.label}>
                  <div class="mb-2 flex items-center gap-2">
                    <span class="text-[10px] font-black tracking-wider text-slate-500 uppercase">
                      {period.label}
                    </span>
                    <div class="h-px flex-grow bg-white/5"></div>
                    {availableInPeriod.length === 0 && (
                      <span class="text-[9px] font-bold text-slate-600 uppercase">
                        Sin disponibilidad
                      </span>
                    )}
                  </div>
                  <div class="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
                    {slotsInPeriod.map((time) => {
                      const disabled =
                        isSlotDisabledHelper(
                          time,
                          dateStr.value,
                          durationStr.value,
                          occupiedSlots.value,
                          settings,
                        ) || isCheckingAvailability.value;
                      const selected = timeStr.value === time;
                      return (
                        <button
                          key={time}
                          type="button"
                          disabled={disabled}
                          onClick$={() => (timeStr.value = time)}
                          class={[
                            "flex h-11 items-center justify-center rounded-xl border text-xs font-black transition-all sm:h-9 sm:px-3 active:scale-95",
                            disabled
                              ? "cursor-not-allowed border-white/5 bg-transparent text-slate-600 line-through opacity-20"
                              : selected
                                ? "scale-105 border-[#F5F2EB]/60 bg-[#F5F2EB] text-slate-900 shadow-md ring-2 shadow-[#F5F2EB]/10 ring-[#F5F2EB]/20"
                                : "cursor-pointer border-white/8 bg-slate-800/80 text-slate-300 hover:border-[#F5F2EB]/30 hover:bg-slate-700 hover:text-white",
                          ]}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {isOverlapping.value && timeStr.value && (
          <div class="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-bold text-red-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
            Ese horario ya está ocupado. Elegí otro.
          </div>
        )}
      </div>
    );

    return (
      <>
        <Modal.Root bind:show={isOpen}>
        <Modal.Panel class="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0b1710] p-4 text-white shadow-2xl sm:p-7">
          <div class="mb-6 flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <Modal.Title class="flex items-center gap-2 text-2xl font-black tracking-tight text-white">
                Solicitar Reserva
                {selectedPitch.value && (
                  <span class="rounded-full border border-emerald-500/20 bg-emerald-500/20 px-2.5 py-1 text-sm font-bold tracking-wider text-emerald-400 uppercase">
                    {selectedPitch.value.name}
                  </span>
                )}
              </Modal.Title>
              <Modal.Description class="mt-1 text-xs font-semibold text-slate-400">
                Completa los pasos para reservar tu cancha en Garden Club.
              </Modal.Description>
            </div>
            <Modal.Close class="rounded-full border border-white/5 bg-slate-900/60 p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Modal.Close>
          </div>

          <div>
            {((guestAction.value?.success && (guestAction.value.paymentMethod !== "PAYWAY" || guestAction.value.amountToCharge === 0 || paywayPaymentSuccess.value)) || (userAction.value?.success && (userAction.value.paymentMethod !== "PAYWAY" || userAction.value.amountToCharge === 0 || paywayPaymentSuccess.value))) ? (
              <div class="mx-auto max-w-md py-8">
                {guestAction.value?.success && !paywayPaymentSuccess.value ? (
                  isTransfer(guestAction.value.paymentMethod) ? (
                    /* Guest Transfer Success screen - amber/orange themed */
                    <div class="space-y-5">
                      <div class="text-center">
                        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-lg">
                          <svg
                            viewBox="0 0 24 24"
                            class="h-8 w-8 fill-amber-450"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor" />
                          </svg>
                        </div>
                        <h3 class="text-xl font-black text-white">
                          ¡Solicitud Enviada!
                        </h3>
                        <p class="mt-1 text-xs font-bold uppercase tracking-wider text-amber-400">
                          Pendiente de Aprobación
                        </p>
                      </div>

                      <div class="overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
                        <div class="flex items-center justify-between border-b border-amber-500/10 pb-2">
                          <span class="text-[10px] font-black tracking-widest text-amber-400 uppercase">
                            Instrucciones de Pago
                          </span>
                          <span class="text-xs font-black text-white">
                            Total: ${dynamicPrice.value}
                          </span>
                        </div>
                        
                        <div class="space-y-2">
                          <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-300">Copiar alias de transferencia:</span>
                            {copiedSignal.value && (
                              <span class="text-[10px] font-bold text-emerald-400 animate-pulse">¡Copiado!</span>
                            )}
                          </div>
                          <div class="flex items-center gap-2">
                            <div class="flex-1 rounded-xl border border-amber-500/10 bg-slate-950/60 py-2.5 px-3 font-mono text-sm font-black text-amber-400 text-center select-all">
                              {settings?.bankAlias || "No configurado"}
                            </div>
                            <button
                              type="button"
                              onClick$={() => copyAlias(settings?.bankAlias || "")}
                              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 transition-all hover:bg-amber-500/20 active:scale-95"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-4.5 w-4.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="2.5"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                                />
                              </svg>
                            </button>
                          </div>
                          <p class="text-[10px] leading-relaxed text-slate-450">
                            Para confirmar tu reserva, realiza la transferencia bancaria al alias y luego envía el comprobante por WhatsApp.
                          </p>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-3">
                        {settings?.whatsappNumber && (
                          <a
                            href={`https://wa.me/${(settings.whatsappNumber || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                              `Hola! Envíe una solicitud de reserva por Transferencia:\n- ID Reserva: ${guestAction.value?.bookingId || ""}\n- Nombre: ${guestName.value}\n- Cancha: ${selectedPitch.value?.name || ""}\n- Fecha: ${dateStr.value.split("-").reverse().join("/")}\n- Horario: ${timeStr.value} (${durationStr.value} min)\n- Total: $${dynamicPrice.value}\n\nAdjunto el comprobante de transferencia.`
                            )}`}
                            target="_blank"
                            class="flex items-center justify-center gap-2 rounded-xl border border-[#25D366]/20 bg-[#25D366]/10 py-3 text-xs font-black tracking-wider text-[#4ADE80] uppercase transition-all hover:bg-[#25D366]/20"
                          >
                            <svg class="h-4 w-4 fill-[#25D366]" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                            WhatsApp
                          </a>
                        )}
                        <Button
                          onClick$={onClose}
                          look="secondary"
                          class={[
                            "rounded-xl border border-white/5 bg-slate-800 py-3 text-xs font-bold tracking-wider text-white uppercase transition-all hover:bg-slate-700",
                            !settings?.whatsappNumber && "col-span-2",
                          ]}
                        >
                          Entendido
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Guest success - amber themed with WhatsApp CTA */
                    <div class="space-y-5">
                      <div class="text-center">
                        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-lg">
                          <svg
                            viewBox="0 0 24 24"
                            class="h-8 w-8 fill-[#25D366]"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                          </svg>
                        </div>
                        <h3 class="text-xl font-black text-white">
                          ¡Solicitud Enviada!
                        </h3>
                        <p class="mt-1 text-xs font-medium text-slate-400">
                          Te contactaremos pronto para confirmar tu turno.
                        </p>
                      </div>

                      <div class="overflow-hidden rounded-2xl border border-white/8 bg-slate-900/60">
                        <div class="border-b border-white/5 px-4 pt-4 pb-3">
                          <p class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                            Próximos pasos
                          </p>
                        </div>
                        <div class="space-y-3 p-4">
                          <div class="flex items-center gap-3">
                            <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-black text-amber-400">
                              1
                            </div>
                            <p class="text-xs font-medium text-slate-300">
                              Tu reserva quedó en estado{" "}
                              <span class="font-bold text-amber-400">
                                Pendiente
                              </span>{" "}
                              en nuestro sistema.
                            </p>
                          </div>
                          <div class="flex items-center gap-3">
                            <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10">
                              <svg
                                class="h-3 w-3 fill-[#25D366]"
                                viewBox="0 0 24 24"
                              >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                              </svg>
                            </div>
                            <p class="text-xs font-medium text-slate-300">
                              Te escribimos por{" "}
                              <span class="font-bold text-[#4ADE80]">
                                WhatsApp
                              </span>{" "}
                              para coordinar el pago y confirmar.
                            </p>
                          </div>
                          <div class="flex items-center gap-3">
                            <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-black text-emerald-400">
                              ✓
                            </div>
                            <p class="text-xs font-medium text-slate-300">
                              ¡Listo! El turno queda{" "}
                              <span class="font-bold text-emerald-400">
                                Confirmado
                              </span>
                              .
                            </p>
                          </div>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-3">
                        {settings?.whatsappNumber && (
                          <a
                            href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent("Hola! Acabo de enviar una solicitud de reserva desde la web.")}`}
                            target="_blank"
                            class="flex items-center justify-center gap-2 rounded-xl border border-[#25D366]/20 bg-[#25D366]/10 py-3 text-xs font-black tracking-wider text-[#4ADE80] uppercase transition-all hover:bg-[#25D366]/20"
                          >
                            <svg
                              class="h-4 w-4 fill-[#25D366]"
                              viewBox="0 0 24 24"
                            >
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                            WhatsApp
                          </a>
                        )}
                        <Button
                          onClick$={onClose}
                          look="secondary"
                          class={[
                            "rounded-xl border border-white/5 bg-slate-800 py-3 text-xs font-bold tracking-wider text-white uppercase transition-all hover:bg-slate-700",
                            !settings?.whatsappNumber && "col-span-2",
                          ]}
                        >
                          Entendido
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  userAction.value?.success && isTransfer(userAction.value.paymentMethod) ? (
                    /* Registered user Transfer Success screen - pending payment countdown */
                    <div class="space-y-5 text-center">
                      <div>
                        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400 shadow-lg shadow-orange-955">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-8 w-8 animate-pulse text-orange-450"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <h3 class="text-xl font-black text-white">
                          ¡Turno Reservado!
                        </h3>
                        <p class="mt-1 text-xs font-bold uppercase tracking-wider text-orange-400">
                          Pendiente de Pago
                        </p>
                      </div>

                      <div class="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-center">
                        <p class="text-sm font-bold text-orange-300 mb-1">
                          ⏰ Tiempo Límite de Pago
                        </p>
                        <div class="text-3xl font-black tracking-widest text-white font-mono animate-pulse">
                          {formatTimeLeft(timeLeft.value)}
                        </div>
                        <p class="mt-2 text-[10px] leading-relaxed text-slate-300 font-medium">
                          Realiza la transferencia bancaria y envía el comprobante antes de que expire el tiempo para asegurar tu lugar.
                        </p>
                      </div>

                      <div class="overflow-hidden rounded-2xl border border-white/8 bg-slate-900/60 p-4 text-left space-y-4">
                        <div class="flex items-center justify-between border-b border-white/5 pb-2">
                          <span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                            Instrucciones de Pago
                          </span>
                          <span class="text-xs font-black text-emerald-400">
                            Monto: ${paymentOption.value === "SENA" ? senaAmount.value : dynamicPrice.value}
                          </span>
                        </div>

                        <div class="space-y-2">
                          <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-350">Copiar alias de transferencia:</span>
                            {copiedSignal.value && (
                              <span class="text-[10px] font-bold text-emerald-400 animate-pulse">¡Copiado!</span>
                            )}
                          </div>
                          <div class="flex items-center gap-2">
                            <div class="flex-1 rounded-xl border border-white/5 bg-slate-950/60 py-2.5 px-3 font-mono text-sm font-black text-emerald-400 text-center select-all">
                              {settings?.bankAlias || "No configurado"}
                            </div>
                            <button
                              type="button"
                              onClick$={() => copyAlias(settings?.bankAlias || "")}
                              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-800 text-white transition-all hover:bg-slate-700 active:scale-95"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-4.5 w-4.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="2.5"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-3">
                        {settings?.whatsappNumber && (
                          <a
                            href={`https://wa.me/${(settings.whatsappNumber || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                              `Hola! Realicé la transferencia para mi reserva:\n- ID Reserva: ${userAction.value?.bookingId || ""}\n- Nombre: ${user?.name || ""}\n- Cancha: ${selectedPitch.value?.name || ""}\n- Fecha: ${dateStr.value.split("-").reverse().join("/")}\n- Horario: ${timeStr.value} (${durationStr.value} min)\n- Opción: ${paymentOption.value === "SENA" ? `Seña ($${senaAmount.value})` : `Total ($${dynamicPrice.value})`}\n\nAdjunto el comprobante de transferencia.`
                            )}`}
                            target="_blank"
                            class="flex items-center justify-center gap-2 rounded-xl border border-[#25D366]/20 bg-[#25D366]/10 py-3.5 text-xs font-black tracking-wider text-[#4ADE80] uppercase transition-all hover:bg-[#25D366]/20"
                          >
                            <svg class="h-4 w-4 fill-[#25D366]" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                            Enviar Comprobante
                          </a>
                        )}
                        <Button
                          onClick$={onClose}
                          look="secondary"
                          class={[
                            "rounded-xl border border-white/5 bg-slate-800 py-3.5 font-bold tracking-wider text-white uppercase transition-all hover:bg-slate-700",
                            !settings?.whatsappNumber && "col-span-2",
                          ]}
                        >
                          Cerrar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Registered user success - emerald themed */
                    <div class="space-y-5 text-center">
                      <div>
                        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-950">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2.5"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <h3 class="text-xl font-black text-white">
                          ¡Reserva Confirmada!
                        </h3>
                        <p class="mt-1 text-xs font-medium text-slate-400">
                          Tu turno fue agendado exitosamente.
                        </p>
                      </div>
                      <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-left text-emerald-300">
                        <p class="mb-1 text-sm font-bold">
                          ✅ Confirmación Instantánea
                        </p>
                        <p class="text-xs font-medium text-slate-300">
                          {user
                            ? "¡Excelente! Tu turno ha sido agendado bajo tu usuario. ¡Te esperamos en el club!"
                            : "¡Excelente! Tu turno ha sido agendado y confirmado. ¡Te esperamos en el club!"}
                        </p>
                      </div>
                      {confirmarPagoPaywayAction.value?.success && (
                        <div class="rounded-2xl border border-white/5 bg-slate-950/60 p-5 text-left space-y-3 font-mono text-xs text-slate-400 animate-fade-in">
                          <p class="text-[10px] font-black tracking-widest text-slate-500 uppercase border-b border-white/5 pb-2">
                            Comprobante de Pago (Payway)
                          </p>
                          <div class="flex justify-between">
                            <span>ID TRANSACCIÓN:</span>
                            <span class="font-bold text-white">{confirmarPagoPaywayAction.value.paymentId}</span>
                          </div>
                          <div class="flex justify-between">
                            <span>REF INTERNA:</span>
                            <span class="font-bold text-white">{confirmarPagoPaywayAction.value.site_transaction_id}</span>
                          </div>
                          <div class="flex justify-between">
                            <span>Nº TICKET:</span>
                            <span class="font-bold text-white">{confirmarPagoPaywayAction.value.ticket}</span>
                          </div>
                          <div class="flex justify-between">
                            <span>FECHA:</span>
                            <span class="font-bold text-white">
                              {new Date(confirmarPagoPaywayAction.value.date).toLocaleString("es-AR")}
                            </span>
                          </div>
                          <div class="border-t border-white/5 pt-3 flex justify-between text-sm">
                            <span class="font-bold text-slate-300">MONTO DEBITADO:</span>
                            <span class="font-black text-emerald-400">
                              ${confirmarPagoPaywayAction.value.amount.toLocaleString("es-AR")} ARS
                            </span>
                          </div>
                        </div>
                      )}
                      <Button
                        onClick$={onClose}
                        look="secondary"
                        class="w-full rounded-xl border border-white/5 bg-slate-800 py-3.5 font-bold tracking-wider text-white uppercase transition-all hover:bg-slate-700"
                      >
                        Entendido / Cerrar
                      </Button>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                {/* LEFT COLUMN: THE WIZARD FORM */}
                <div class="space-y-6 rounded-2xl border border-white/5 bg-slate-900/40 p-4 sm:p-6 lg:col-span-8">
                  {/* Clickable Wizard Progress Steps Bar with Labels */}
                  <div class="relative mx-auto mb-6 flex max-w-sm items-start justify-between px-4">
                    <div class="absolute top-5 right-8 left-8 -z-10 h-0.5 -translate-y-1/2 rounded-full bg-slate-800"></div>
                    <div
                      class="absolute top-5 left-8 -z-10 h-0.5 -translate-y-1/2 rounded-full bg-emerald-500 transition-all duration-500"
                      style={{
                        width: `calc(${(currentStep.value - 1) * 50}%)`,
                      }}
                    ></div>

                    {(
                      [
                        { n: 1, label: "Horario" },
                        { n: 2, label: "Contacto" },
                        { n: 3, label: "Pago" },
                      ] as const
                    ).map(({ n: step, label }) => {
                      const isClickable =
                        !showPaywayModal.value &&
                        (step === 1 ||
                          (step === 2 && isStep2Enabled.value) ||
                          (step === 3 && isStep3Enabled.value));
                      const isDone = currentStep.value > step;
                      return (
                        <button
                          key={step}
                          type="button"
                          disabled={!isClickable}
                          onClick$={() => {
                            currentStep.value = step;
                          }}
                          class="group flex flex-col items-center gap-1.5"
                          title={`Ir al paso ${step}`}
                        >
                          <div
                            class={[
                              "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-[#0b1710] text-sm font-black transition-all",
                              currentStep.value === step
                                ? "scale-110 bg-emerald-500 text-white ring-4 ring-emerald-500/20"
                                : isDone
                                  ? "cursor-pointer border-emerald-900 bg-emerald-700 text-emerald-200 hover:bg-emerald-600"
                                  : isClickable
                                    ? "cursor-pointer bg-emerald-800 text-slate-200 hover:bg-emerald-700"
                                    : "cursor-not-allowed bg-slate-800 text-slate-600",
                            ]}
                          >
                            {isDone ? (
                              <svg
                                class="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="3"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              step
                            )}
                          </div>
                          <span
                            class={[
                              "text-[9px] font-black tracking-wider uppercase transition-colors",
                              currentStep.value === step
                                ? "text-emerald-400"
                                : "text-slate-600",
                            ]}
                          >
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <form
                    id="booking-form"
                    class="space-y-6"
                    preventdefault:submit
                    onSubmit$={$(async () => {
                      if (user) {
                        await userAction.submit({
                          pitchId: selectedPitchId.value,
                          date: dateStr.value,
                          time: timeStr.value,
                          duration: parseInt(durationStr.value, 10),
                          paymentOption: paymentOption.value as any,
                          paymentMethod: paymentMethod.value,
                          extras: selectedExtras.value.map((e) => JSON.stringify(e)),
                        });
                      } else {
                        await guestAction.submit({
                          pitchId: selectedPitchId.value,
                          guestName: guestName.value,
                          guestPhone: guestPhone.value,
                          guestEmail: guestEmail.value,
                          date: dateStr.value,
                          time: timeStr.value,
                          duration: parseInt(durationStr.value, 10),
                          paymentMethod: paymentMethod.value,
                          extras: selectedExtras.value.map((e) => JSON.stringify(e)),
                        });
                      }
                    })}
                  >
                    <input
                      type="hidden"
                      name="pitchId"
                      value={selectedPitchId.value}
                    />
                    <input type="hidden" name="time" value={timeStr.value} />
                    {!user && (
                      <input
                        type="hidden"
                        name="paymentOption"
                        value={paymentMethod.value === "PAYWAY" ? "TOTAL" : "LATER"}
                      />
                    )}
                    {selectedExtras.value.map((ext) => (
                      <input
                        key={ext.name}
                        type="hidden"
                        name="extras[]"
                        value={JSON.stringify(ext)}
                      />
                    ))}

                    {(((userAction.value as any)?.message && !(userAction.value as any)?.success) ||
                      ((guestAction.value as any)?.message && !(guestAction.value as any)?.success)) && (
                        <Alert.Root
                          look="alert"
                          class="rounded-xl border border-red-500/20 bg-red-500/10 text-red-400"
                        >
                          <Alert.Description>
                            {(userAction.value as any)?.message ||
                              (guestAction.value as any)?.message}
                          </Alert.Description>
                        </Alert.Root>
                      )}

                    {/* STEP 1: DATE AND TIME */}
                    <div
                      class={[
                        "animate-fade-in space-y-6",
                        currentStep.value !== 1 && "hidden",
                      ]}
                    >
                      <div class="space-y-4">
                        {/* Date input row */}
                        <div>
                          <div class="mb-2.5 flex items-center justify-between">
                            <label class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                              Fecha del turno
                            </label>
                            <div class="flex gap-1.5">
                              {(
                                [
                                  { label: "Hoy", offset: 0 },
                                  { label: "Mañana", offset: 1 },
                                  { label: "Pasado", offset: 2 },
                                ] as const
                              ).map(({ label, offset }) => {
                                const targetDate = getLocalDateString(offset);
                                const isSelected = dateStr.value === targetDate;
                                return (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick$={() => {
                                      dateStr.value = targetDate;
                                    }}
                                    class={[
                                      "rounded-full border px-3 py-1.5 text-[9px] font-black tracking-wider uppercase transition-all active:scale-95",
                                      isSelected
                                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-extrabold shadow-sm shadow-emerald-500/10"
                                        : "border-white/8 bg-slate-800 text-slate-400 hover:border-white/20 hover:bg-slate-700 hover:text-white",
                                    ]}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <input
                            type="date"
                            name="date"
                            required
                            bind:value={dateStr}
                            min={getLocalDateString(0)}
                            class="w-full rounded-xl border border-white/8 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-white [color-scheme:dark] transition-all focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none"
                          />
                        </div>

                        {/* Duration Stepper */}
                        <div>
                          <label class="mb-2 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                            Duración
                          </label>
                          <input
                            type="hidden"
                            name="duration"
                            value={durationStr.value}
                          />
                          <div class="flex items-center gap-3 rounded-xl border border-white/8 bg-slate-900/60 px-4 py-3">
                            {/* Minus button */}
                            <button
                              type="button"
                              disabled={parseInt(durationStr.value, 10) <= 30}
                              onClick$={() => {
                                const cur = parseInt(durationStr.value, 10);
                                if (cur > 30) durationStr.value = String(cur - 30);
                              }}
                              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-800 text-slate-300 transition-all hover:border-[#F5F2EB]/40 hover:bg-slate-700 hover:text-[#F5F2EB] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4" />
                              </svg>
                            </button>
                            {/* Value display */}
                            <div class="flex flex-1 flex-col items-center">
                              <span class="text-base font-black text-white">
                                {durationStr.value} min
                              </span>
                              <span class="text-[10px] font-semibold text-slate-500">
                                {parseInt(durationStr.value, 10) >= 60
                                  ? `${parseInt(durationStr.value, 10) / 60} ${parseInt(durationStr.value, 10) === 60 ? "hora" : "horas"}`
                                  : "30 min"}
                              </span>
                            </div>
                            {/* Plus button */}
                            <button
                              type="button"
                              disabled={parseInt(durationStr.value, 10) >= 240}
                              onClick$={() => {
                                const cur = parseInt(durationStr.value, 10);
                                if (cur < 240) durationStr.value = String(cur + 30);
                              }}
                              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-800 text-slate-300 transition-all hover:border-[#F5F2EB]/40 hover:bg-slate-700 hover:text-[#F5F2EB] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      {timeGridUI}

                      {/* Slot selected confirmation badge */}
                      {timeStr.value && !isOverlapping.value && (
                        <div class="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/8 py-2 text-xs font-bold text-emerald-400">
                          <svg
                            class="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2.5"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Turno seleccionado: {timeStr.value} hs · {durationStr.value} min
                        </div>
                      )}
                    </div>

                    {/* STEP 2: USER IDENTIFICATION / CONTACT FORM */}
                    <div
                      class={[
                        "animate-fade-in space-y-6",
                        currentStep.value !== 2 && "hidden",
                      ]}
                    >
                      {!user ? (
                        <div class="space-y-5">
                          {/* Login / Register Prominent Box */}
                          <div class="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/50 to-slate-900/80 p-4">
                            <div class="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-emerald-500/5 blur-2xl"></div>
                            <div class="mb-3 flex items-center gap-3">
                              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/15 text-base text-emerald-400">
                                ⚡
                              </div>
                              <div>
                                <h5 class="text-xs font-black tracking-wider text-white uppercase">
                                  ¡Confirmación Instantánea!
                                </h5>
                                <p class="mt-0.5 text-[10px] leading-tight font-medium text-slate-400">
                                  Registrate y pagá solo la seña mínima para
                                  confirmar al instante.
                                </p>
                              </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                              <Link
                                href="/auth/register"
                                target="_blank"
                                class="rounded-xl bg-emerald-500 py-2.5 text-center text-[11px] font-black tracking-wider text-white uppercase transition-all hover:bg-emerald-600 active:scale-95 flex items-center justify-center h-10 shadow-sm"
                              >
                                Crear Cuenta
                              </Link>
                              <Link
                                href="/auth/login"
                                target="_blank"
                                class="rounded-xl border border-white/8 bg-slate-800 py-2.5 text-center text-[11px] font-black tracking-wider text-white uppercase transition-all hover:bg-slate-700 active:scale-95 flex items-center justify-center h-10"
                              >
                                Iniciar Sesión
                              </Link>
                            </div>
                          </div>

                          <div class="relative flex items-center py-1">
                            <div class="flex-grow border-t border-white/5"></div>
                            <span class="mx-3 flex-shrink text-[10px] font-black tracking-widest text-slate-500 uppercase">
                              O continuá como Invitado
                            </span>
                            <div class="flex-grow border-t border-white/5"></div>
                          </div>

                          {/* Guest contact fields - premium style */}
                          <div class="space-y-3">
                            <div class="group">
                              <label class="mb-1.5 flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                <svg
                                  class="h-3 w-3 text-slate-500"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                                Nombre Completo{" "}
                                <span class="text-emerald-500">*</span>
                              </label>
                              <input
                                type="text"
                                name="guestName"
                                placeholder="Ej: Juan Pérez"
                                required
                                bind:value={guestName}
                                class="w-full rounded-xl border border-white/8 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-white placeholder-slate-600 transition-all focus:border-emerald-500/60 focus:bg-slate-900 focus:ring-1 focus:ring-emerald-500/30 focus:outline-none"
                              />
                            </div>
                            <div class="group">
                              <label class="mb-1.5 flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                <svg
                                  class="h-3 w-3 fill-[#25D366]"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                WhatsApp <span class="text-emerald-500">*</span>
                              </label>
                              <input
                                type="tel"
                                name="guestPhone"
                                placeholder="Ej: 1112345678"
                                required
                                bind:value={guestPhone}
                                class="w-full rounded-xl border border-white/8 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-white placeholder-slate-600 transition-all focus:border-[#25D366]/50 focus:bg-slate-900 focus:ring-1 focus:ring-[#25D366]/20 focus:outline-none"
                              />
                              <p class="mt-1 ml-1 text-[10px] font-medium text-slate-500">
                                El club te contactará aquí para confirmar la
                                disponibilidad.
                              </p>
                            </div>
                            <div class="group">
                              <label class="mb-1.5 flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                <svg
                                  class="h-3 w-3 text-slate-500"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                  />
                                </svg>
                                Email{" "}
                                <span class="font-medium tracking-normal text-slate-600 normal-case">
                                  (opcional)
                                </span>
                              </label>
                              <input
                                type="email"
                                name="guestEmail"
                                placeholder="juan@ejemplo.com"
                                bind:value={guestEmail}
                                class="w-full rounded-xl border border-white/8 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-white placeholder-slate-600 transition-all focus:border-emerald-500/60 focus:bg-slate-900 focus:ring-1 focus:ring-emerald-500/30 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Pending notice - compact */}
                          <div class="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-500/8 p-3.5">
                            <span class="mt-0.5 shrink-0 text-base text-amber-400">
                              ⏳
                            </span>
                            <div>
                              <p class="mb-0.5 text-xs font-black text-amber-300">
                                Turno Pendiente de Aprobación
                              </p>
                              <p class="text-[10px] leading-relaxed font-medium text-slate-400">
                                Tu solicitud quedará en revisión. El club
                                confirmará la disponibilidad y te avisará por{" "}
                                <span class="font-bold text-[#4ADE80]">
                                  WhatsApp
                                </span>
                                .
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div class="space-y-4">
                          <div class="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/30 p-6 text-center">
                            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xl font-black text-emerald-400">
                              {user.name?.[0] ?? "U"}
                            </div>
                            <div>
                              <h5 class="text-base font-bold text-white">
                                Usuario Registrado
                              </h5>
                              <p class="mt-1 text-xs font-semibold text-slate-400">
                                {user.name} ({user.email})
                              </p>
                            </div>
                            <span class="inline-block rounded-full border border-emerald-500/20 bg-emerald-500/15 px-3 py-1 text-xs font-bold tracking-wider text-emerald-400 uppercase">
                              ⚡ Confirmación Instantánea
                            </span>
                          </div>
                          <div class="rounded-xl border border-white/5 bg-slate-900/50 p-4 text-xs leading-relaxed font-semibold text-slate-400">
                            Cargaremos automáticamente los datos de contacto de
                            tu cuenta para esta reserva. ¡No tienes que llenar
                            nada!
                          </div>
                        </div>
                      )}

                      <div class="flex gap-3 border-t border-white/5 pt-4">
                        <button
                          type="button"
                          onClick$={prevStep}
                          class="flex flex-[1] items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-slate-800/80 py-3.5 text-xs font-bold tracking-wider text-slate-300 uppercase transition-all hover:bg-slate-700 hover:text-white"
                        >
                          <svg
                            class="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2.5"
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                          Atrás
                        </button>
                        <button
                          type="button"
                          onClick$={nextStep}
                          disabled={!isStep3Enabled.value}
                          class="hidden lg:flex flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-black tracking-wider text-white uppercase shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Continuar a Pago
                          <svg
                            class="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2.5"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* STEP 3: ADDONS & PAYMENT METHODS */}
                    <div
                      class={[
                        "animate-fade-in space-y-6",
                        currentStep.value !== 3 && "hidden",
                      ]}
                    >
                      {showPaywayModal.value ? (
                        <div class="space-y-5 rounded-2xl border border-white/5 bg-[#0b1710]/40 p-5">
                          <div class="flex items-center gap-2.5 border-b border-white/5 pb-4 mb-4">
                            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                            </div>
                            <div>
                              <h4 class="text-sm font-black tracking-widest text-white uppercase">
                                Pago Seguro con Tarjeta
                              </h4>
                              <p class="text-[10px] font-semibold text-slate-400 mt-0.5">
                                Cifrado y procesado de forma segura a través de Payway
                              </p>
                            </div>
                          </div>

                          {confirmarPagoPaywayAction.value?.message && (
                            <Alert.Root
                              look="alert"
                              class="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400"
                            >
                              <Alert.Description>
                                {confirmarPagoPaywayAction.value.message}
                              </Alert.Description>
                            </Alert.Root>
                          )}

                          <div class="relative">
                            {confirmarPagoPaywayAction.isRunning && (
                              <div class="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-[#0b1710]/95 backdrop-blur-sm transition-all duration-300">
                                <div class="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
                                <p class="mt-4 text-sm font-bold text-white">Liquidando Pago...</p>
                                <p class="mt-1 text-center text-xs text-slate-400 max-w-xs leading-relaxed">
                                  Estamos procesando la autorización de su tarjeta. Por favor, no recargue ni cierre esta ventana.
                                </p>
                              </div>
                            )}

                            <PaywayCheckout
                              publicApiKey={settings.paywayPublicKey || "019e6f79-1a83-71d9-98fc-53bb42253"}
                              environment={settings.paywayEnvironment as any}
                              amount={paywayAmount.value}
                              onSuccess$={$(async (token: string, paymentMethodId: number) => {
                                const res = await confirmarPagoPaywayAction.submit({
                                  bookingId: paywayBookingId.value!,
                                  token,
                                  paymentMethodId,
                                  amount: paywayAmount.value,
                                });
                                if (res.status === 200 && res.value?.success) {
                                  paywayPaymentSuccess.value = true;
                                  showPaywayModal.value = false;
                                }
                              })}
                              onError$={$(async (msg: string) => {
                                console.error("Payway tokenization failed:", msg);
                              })}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Optional Addons */}
                      <div>
                        <h4 class="mb-3.5 text-sm font-black tracking-widest text-slate-400 uppercase">
                          Servicios Adicionales (Opcionales)
                        </h4>
                        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                          {((settings?.extraServices as any[]) || []).map(
                            (extra) => {
                              const isSelected = selectedExtras.value.some(
                                (e) => e.name === extra.name,
                              );
                              return (
                                <button
                                  key={extra.name}
                                  type="button"
                                  onClick$={() =>
                                    toggleExtra({
                                      name: extra.name,
                                      price: Number(extra.price),
                                    })
                                  }
                                  class={[
                                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all",
                                    isSelected
                                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                      : "bg-slate-850 border-white/5 text-slate-400 hover:border-emerald-500/50 hover:bg-slate-800",
                                  ]}
                                >
                                  <span class="text-xl">{extra.icon}</span>
                                  <div class="text-center">
                                    <div class="mb-0.5 text-[10px] leading-tight font-bold text-white uppercase">
                                      {extra.name}
                                    </div>
                                    <div class="text-xs font-black text-emerald-400">
                                      +${extra.price}
                                    </div>
                                  </div>
                                </button>
                              );
                            },
                          )}
                          {((settings?.extraServices as any[]) || []).length ===
                            0 && (
                              <div class="col-span-full rounded-xl border border-dashed border-white/10 py-4 text-center text-sm text-slate-500">
                                No hay servicios adicionales configurados.
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Payment Settings block */}
                      <div class="bg-slate-850/60 mt-4 space-y-5 rounded-2xl border border-white/5 p-5">
                        {/* 1. Payment Methods Selection (Alias/Cash/etc) */}
                        <div>
                          <label class="mb-3 block text-xs font-black tracking-widest text-slate-400 uppercase">
                            Método de Pago Preferido
                          </label>
                          <div class="grid grid-cols-2 gap-2">
                            {[
                              ...(settings?.paymentMethods || []).filter((pm: any) => {
                                if (!pm.isActive) return false;
                                if (pm.id === "COHEN") return false;
                                if (!user && pm.id === "CURRENT_ACCOUNT") return false;
                                if (isTransferMethod(pm.id, pm.name)) {
                                  return !!(settings?.bankAlias && settings.bankAlias.trim() !== "");
                                }
                                return true;
                              }),
                              ...(settings?.isPaywayActive ? [{ id: "PAYWAY", name: "Tarjeta (Payway)", isActive: true }] : [])
                            ].map((pm: any) => {
                                const isSelected = paymentMethod.value === pm.id;
                                const icon = pm.id.toLowerCase().includes("cash") || pm.id.toLowerCase().includes("efectivo")
                                  ? "💵"
                                  : isTransferMethod(pm.id, pm.name)
                                    ? "🏦"
                                    : "💳";
                                return (
                                  <label
                                    key={pm.id}
                                    class={[
                                      "flex flex-col items-center justify-center cursor-pointer rounded-2xl border p-3.5 text-center transition-all select-none active:scale-[0.98]",
                                      isSelected
                                        ? "border-emerald-500 bg-emerald-500/10 text-white shadow-md shadow-emerald-950/20"
                                        : "border-white/8 bg-slate-900/50 text-slate-400 hover:border-white/20 hover:bg-slate-800",
                                    ]}
                                  >
                                    <input
                                      type="radio"
                                      name="paymentMethod"
                                      value={pm.id}
                                      checked={isSelected}
                                      onInput$={() => (paymentMethod.value = pm.id)}
                                      class="hidden"
                                    />
                                    <span class="text-lg mb-1">{icon}</span>
                                    <span class="text-xs font-black tracking-wider uppercase">{pm.name}</span>
                                  </label>
                                );
                              })}
                            {((settings?.paymentMethods || []).filter(
                              (pm: any) => pm.isActive,
                            ).length === 0 && !settings?.isPaywayActive) && (
                                <>
                                  <label
                                    class={[
                                      "flex flex-col items-center justify-center cursor-pointer rounded-2xl border p-3.5 text-center transition-all select-none active:scale-[0.98]",
                                      paymentMethod.value === "CASH"
                                        ? "border-emerald-500 bg-emerald-500/10 text-white shadow-md shadow-emerald-950/20"
                                        : "border-white/8 bg-slate-900/50 text-slate-400 hover:border-white/20 hover:bg-slate-800",
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
                                    <span class="text-lg mb-1">💵</span>
                                    <span class="text-xs font-black tracking-wider uppercase">Efectivo</span>
                                  </label>
                                  {settings?.bankAlias && settings.bankAlias.trim() !== "" && (
                                    <label
                                      class={[
                                        "flex flex-col items-center justify-center cursor-pointer rounded-2xl border p-3.5 text-center transition-all select-none active:scale-[0.98]",
                                        paymentMethod.value === "TRANSFER"
                                          ? "border-emerald-500 bg-emerald-500/10 text-white shadow-md shadow-emerald-950/20"
                                          : "border-white/8 bg-slate-900/50 text-slate-400 hover:border-white/20 hover:bg-slate-800",
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
                                      <span class="text-lg mb-1">🏦</span>
                                      <span class="text-xs font-black tracking-wider uppercase">Transferencia</span>
                                    </label>
                                  )}
                                </>
                              )}
                          </div>
                        </div>

                        {/* Alias Display for Transfer with copy utility */}
                        {isTransfer(paymentMethod.value) && (
                          <div class="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 animate-fade-in">
                            <div class="flex items-center justify-between">
                              <p class="text-xs font-semibold text-emerald-300">
                                Alias de Transferencia Bancaria
                              </p>
                              {copiedSignal.value && (
                                <span class="text-[10px] font-bold text-emerald-400 animate-pulse">
                                  ¡Copiado!
                                </span>
                              )}
                            </div>
                            <div class="flex items-center gap-2">
                              <div class="flex-1 rounded-xl border border-emerald-500/10 bg-slate-950/60 py-2.5 px-3 font-mono text-sm font-black text-emerald-400 text-center select-all">
                                {settings?.bankAlias || "No configurado"}
                              </div>
                              <button
                                type="button"
                                onClick$={() => copyAlias(settings?.bankAlias || "")}
                                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-4.5 w-4.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  stroke-width="2.5"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                                  />
                                </svg>
                              </button>
                            </div>
                            <p class="text-[10px] leading-relaxed text-slate-400">
                              Una vez confirmada la solicitud, deberás transferir a esta cuenta y enviar el comprobante.
                            </p>
                          </div>
                        )}

                        {/* 2. Payment Modality Options (Sena, Total, Later) */}
                        <div>
                          <label class="mb-3 block text-xs font-black tracking-widest text-slate-400 uppercase">
                            Modalidad de Pago
                          </label>

                          {!user ? (
                            // Guest Payment view: Premium WhatsApp next-steps card
                            <div class="space-y-3">
                              <div class="overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-slate-800/80 to-slate-900/60">
                                <div class="border-b border-white/5 px-4 pt-4 pb-3">
                                  <p class="text-xs font-black tracking-wider text-white uppercase">
                                    ¿Qué pasa luego de enviar?
                                  </p>
                                </div>
                                <div class="space-y-3.5 p-4">
                                  <div class="flex items-start gap-3">
                                    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/15 bg-emerald-500/10 text-sm font-black text-emerald-400">
                                      1
                                    </div>
                                    <div>
                                      <p class="text-xs font-bold text-white">
                                        Registramos tu solicitud
                                      </p>
                                      <p class="mt-0.5 text-[10px] font-medium text-slate-400">
                                        Tu turno queda en estado{" "}
                                        <span class="font-bold text-amber-400">
                                          Pendiente
                                        </span>{" "}
                                        en el sistema.
                                      </p>
                                    </div>
                                  </div>
                                  <div class="flex items-start gap-3">
                                    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#25D366]/15 bg-[#25D366]/10">
                                      <svg
                                        class="h-3.5 w-3.5 fill-[#25D366]"
                                        viewBox="0 0 24 24"
                                      >
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p class="text-xs font-bold text-white">
                                        Te contactamos por WhatsApp
                                      </p>
                                      <p class="mt-0.5 text-[10px] font-medium text-slate-400">
                                        El encargado confirmará disponibilidad y
                                        coordinará el pago contigo.
                                      </p>
                                    </div>
                                  </div>
                                  <div class="flex items-start gap-3">
                                    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/15 bg-emerald-500/10 text-sm font-black text-emerald-400">
                                      ✓
                                    </div>
                                    <div>
                                      <p class="text-xs font-bold text-white">
                                        ¡Tu turno queda confirmado!
                                      </p>
                                      <p class="mt-0.5 text-[10px] font-medium text-slate-400">
                                        Podés abonar la seña o el total al
                                        momento de la confirmación.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <input
                                type="hidden"
                                name="paymentOption"
                                value="LATER"
                              />
                            </div>
                          ) : (
                            // Registered User payment view: Clear choices, deposit rules
                            <div class="space-y-2.5">
                              {senaAmount.value > 0 && (
                                <label
                                  class={[
                                    "flex cursor-pointer items-center gap-3.5 rounded-xl border p-3.5 transition-all",
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
                                    onInput$={() =>
                                      (paymentOption.value = "SENA")
                                    }
                                    class="h-4.5 w-4.5 border-white/20 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                                  />
                                  <div class="flex-grow">
                                    <span class="flex items-center gap-1.5 text-sm font-bold text-white">
                                      Abonar Seña Mínima
                                      <span class="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-black tracking-wider text-emerald-300 uppercase">
                                        Seña: {senaLabel.value}
                                      </span>
                                    </span>
                                    <span class="mt-0.5 block text-xs text-slate-400">
                                      Pagas hoy:{" "}
                                      <span class="font-bold text-emerald-400">
                                        ${senaAmount.value}
                                      </span>
                                      . El saldo restante se cancela en el club.
                                    </span>
                                  </div>
                                </label>
                              )}

                              <label
                                class={[
                                  "flex cursor-pointer items-center gap-3.5 rounded-xl border p-3.5 transition-all",
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
                                  onInput$={() =>
                                    (paymentOption.value = "TOTAL")
                                  }
                                  class="h-4.5 w-4.5 border-white/20 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                                />
                                <div class="flex-grow">
                                  <span class="block text-sm font-bold text-white">
                                    Abonar el Total del Turno
                                  </span>
                                  <span class="mt-0.5 block text-xs text-slate-400">
                                    Pagas hoy:{" "}
                                    <span class="font-bold text-emerald-400">
                                      ${totalPrice.value}
                                    </span>
                                    . Quedas 100% al día.
                                  </span>
                                </div>
                              </label>

                              {senaAmount.value === 0 && (
                                <label
                                  class={[
                                    "flex cursor-pointer items-center gap-3.5 rounded-xl border p-3.5 transition-all",
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
                                    onInput$={() =>
                                      (paymentOption.value = "LATER")
                                    }
                                    class="h-4.5 w-4.5 border-white/20 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                                  />
                                  <div class="flex-grow">
                                    <span class="block text-sm font-bold font-semibold text-white">
                                      Abonar en el club
                                    </span>
                                    <span class="mt-0.5 block text-xs text-slate-400">
                                      Sin pago online. Cancelas el total en
                                      ventanilla el día del partido.
                                    </span>
                                  </div>
                                </label>
                              )}

                              {senaAmount.value > 0 && (
                                <div class="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3.5 text-[11px] leading-relaxed font-semibold text-slate-400">
                                  📌{" "}
                                  <span class="font-bold text-white">
                                    Nota de Confirmación Instantánea
                                  </span>
                                  : Al ser usuario registrado y seleccionar la
                                  seña mínima o el total, tu reserva queda{" "}
                                  <span class="font-bold text-emerald-400">
                                    CONFIRMADA DIRECTAMENTE
                                  </span>{" "}
                                  en nuestro sistema de forma inmediata.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step Actions */}
                      <div class="flex gap-3 border-t border-white/5 pt-4">
                        <button
                          type="button"
                          onClick$={prevStep}
                          class="flex flex-[1] items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-slate-800/80 py-3.5 text-xs font-bold tracking-wider text-slate-300 uppercase transition-all hover:bg-slate-700 hover:text-white"
                        >
                          <svg
                            class="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2.5"
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                          Atrás
                        </button>
                        <button
                          type="submit"
                          disabled={
                            userAction.isRunning || guestAction.isRunning
                          }
                          class={[
                            "hidden lg:flex flex-[2] items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black tracking-wider uppercase shadow-lg transition-all",
                            !user
                              ? "bg-[#25D366] text-white shadow-[#25D366]/20 hover:bg-[#1ea952] active:scale-[0.98]"
                              : "bg-emerald-500 text-white shadow-emerald-500/25 hover:bg-emerald-600 active:scale-[0.98]",
                            (userAction.isRunning || guestAction.isRunning) &&
                            "cursor-wait opacity-70",
                          ]}
                        >
                          {userAction.isRunning || guestAction.isRunning ? (
                            <>
                              <svg
                                class="h-4 w-4 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  class="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  stroke-width="4"
                                />
                                <path
                                  class="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                              </svg>
                              Procesando...
                            </>
                          ) : !user ? (
                            <>
                              <svg
                                class="h-4 w-4 fill-white"
                                viewBox="0 0 24 24"
                              >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                              </svg>
                              Enviar Solicitud
                            </>
                          ) : (
                            <>
                              <svg
                                class="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2.5"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Confirmar Reserva
                            </>
                          )}
                        </button>
                      </div>
                      </>
                      )}
                    </div>
                  </form>
                </div>

                {/* RIGHT COLUMN: GORGEOUS STICKY SUMMARY CARD (DESKTOP) */}
                <div class="hidden lg:block h-fit space-y-4 lg:sticky lg:top-4 lg:col-span-4">
                  {/* Pitch card */}
                  <div class="overflow-hidden rounded-2xl border border-white/8 bg-slate-900/70">
                    {selectedPitch.value?.imageUrl && (
                      <div class="relative h-28 overflow-hidden">
                        <img
                          src={selectedPitch.value.imageUrl}
                          alt={selectedPitch.value.name}
                          class="h-full w-full object-cover"
                        />
                        <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                        <div class="absolute right-3 bottom-2 left-3 flex items-end justify-between">
                          <div>
                            <h5 class="text-sm leading-tight font-black text-white">
                              {selectedPitch.value?.name}
                            </h5>
                            <span class="rounded border border-emerald-500/20 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black tracking-widest text-emerald-400 uppercase">
                              {selectedPitch.value?.type} ·{" "}
                              {selectedPitch.value?.surface}
                            </span>
                          </div>
                          <span class="rounded-lg bg-black/50 px-2 py-1 text-xs font-black text-white">
                            ${selectedPitch.value?.pricePerHour}/hr
                          </span>
                        </div>
                      </div>
                    )}
                    {!selectedPitch.value?.imageUrl && selectedPitch.value && (
                      <div class="flex items-center justify-between p-4">
                        <div>
                          <h5 class="text-sm font-black text-white">
                            {selectedPitch.value.name}
                          </h5>
                          <span class="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black tracking-widest text-emerald-400 uppercase">
                            {selectedPitch.value.type} ·{" "}
                            {selectedPitch.value.surface}
                          </span>
                        </div>
                        <span class="text-xs font-black text-white">
                          ${selectedPitch.value.pricePerHour}/hr
                        </span>
                      </div>
                    )}

                    {/* Booking details */}
                    <div class="space-y-2 border-t border-white/5 p-4">
                      <p class="mb-2 text-[9px] font-black tracking-widest text-slate-500 uppercase">
                        Detalles del turno
                      </p>

                      <div class="flex items-center justify-between text-xs">
                        <span class="flex items-center gap-1.5 font-medium text-slate-500">
                          <svg
                            class="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          Fecha
                        </span>
                        <span
                          class={[
                            "font-semibold",
                            dateStr.value ? "text-white" : "text-slate-600",
                          ]}
                        >
                          {dateStr.value
                            ? new Date(
                              dateStr.value + "T12:00:00",
                            ).toLocaleDateString("es-AR", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })
                            : "—"}
                        </span>
                      </div>

                      <div class="flex items-center justify-between text-xs">
                        <span class="flex items-center gap-1.5 font-medium text-slate-500">
                          <svg
                            class="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Horario
                        </span>
                        {timeStr.value ? (
                          <span class="font-black text-emerald-400">
                            {timeStr.value} hs
                          </span>
                        ) : (
                          <span class="text-[10px] font-medium text-slate-600">
                            Pendiente
                          </span>
                        )}
                      </div>

                      <div class="flex items-center justify-between text-xs">
                        <span class="flex items-center gap-1.5 font-medium text-slate-500">
                          <svg
                            class="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Duración
                        </span>
                        <span class="font-semibold text-white">
                          {durationStr.value} min
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Extras if any */}
                  {selectedExtras.value.length > 0 && (
                    <div class="space-y-1.5 rounded-xl border border-white/8 bg-slate-900/70 p-3">
                      <p class="text-[9px] font-black tracking-widest text-slate-500 uppercase">
                        Adicionales
                      </p>
                      {selectedExtras.value.map((extra) => (
                        <div
                          key={extra.name}
                          class="flex justify-between text-xs font-semibold text-slate-300"
                        >
                          <span>{extra.name}</span>
                          <span class="font-bold text-white">
                            +${extra.price}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total */}
                  <div class="space-y-3 rounded-xl border border-white/8 bg-slate-900/70 p-4">
                    {extrasTotal.value > 0 && (
                      <div class="space-y-1.5 border-b border-white/5 pb-3">
                        <div class="flex justify-between text-xs font-medium text-slate-400">
                          <span>Cancha ({durationStr.value}m)</span>
                          <span>${dynamicPrice.value}</span>
                        </div>
                        <div class="flex justify-between text-xs font-medium text-slate-400">
                          <span>Adicionales</span>
                          <span>${extrasTotal.value}</span>
                        </div>
                      </div>
                    )}
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-black tracking-wider text-slate-400 uppercase">
                        Total
                      </span>
                      <span class="text-2xl font-black text-white">
                        ${totalPrice.value}
                      </span>
                    </div>
                    {senaAmount.value > 0 && !user && (
                      <div class="border-t border-white/5 pt-1 text-[10px] font-medium text-slate-500">
                        Seña mín.{" "}
                        <span class="font-bold text-emerald-400">
                          ${senaAmount.value}
                        </span>{" "}
                        · solo usuarios registrados
                      </div>
                    )}
                    {senaAmount.value > 0 && user && (
                      <div class="flex items-center justify-between border-t border-white/5 pt-2">
                        <span class="text-[10px] font-medium text-slate-400">
                          Seña mínima
                        </span>
                        <span class="text-xs font-black text-emerald-400">
                          ${senaAmount.value}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Step 1 CTA — only shown on step 1 */}
                  {currentStep.value === 1 && (
                    <button
                      type="button"
                      onClick$={nextStep}
                      disabled={!timeStr.value || isSubmitDisabled.value}
                      class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F5F2EB] py-4 text-sm font-black tracking-wider text-slate-900 uppercase shadow-lg shadow-[#F5F2EB]/10 transition-all hover:bg-[#EDE9E1] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Continuar a Datos
                      <svg
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2.5"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  )}

                  {/* Guest/user status badge */}
                  {!user ? (
                    <div class="flex items-start gap-2.5 rounded-xl border border-amber-500/12 bg-amber-500/6 p-3">
                      <span class="shrink-0 text-sm text-amber-400">⏳</span>
                      <div>
                        <p class="text-[10px] font-black tracking-wide text-amber-300 uppercase">
                          Requiere Aprobación
                        </p>
                        <p class="mt-0.5 text-[10px] leading-relaxed font-medium text-slate-500">
                          Te contactaremos por{" "}
                          <span class="font-bold text-[#4ADE80]">WhatsApp</span>{" "}
                          para confirmar.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div class="flex items-start gap-2.5 rounded-xl border border-emerald-500/12 bg-emerald-500/6 p-3">
                      <span class="shrink-0 text-sm text-emerald-400">⚡</span>
                      <div>
                        <p class="text-[10px] font-black tracking-wide text-emerald-300 uppercase">
                          Confirmación Instantánea
                        </p>
                        <p class="mt-0.5 text-[10px] leading-relaxed font-medium text-slate-500">
                          Tu turno se confirma al abonar la seña o el total.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* MOBILE STICKY BOTTOM BAR */}
          {!guestAction.value?.success && !userAction.value?.success && (
            <div class="sticky bottom-0 z-30 -mx-4 -mb-4 border-t border-white/10 bg-[#0b1710]/95 p-4 backdrop-blur-md shadow-[0_-10px_25px_rgba(0,0,0,0.6)] sm:-mx-7 sm:-mb-7 lg:hidden flex items-center justify-between gap-4">
              {/* Left Column: Summary Info */}
              <div class="flex flex-col">
                {timeStr.value ? (
                  <span class="text-[10px] font-black tracking-wide text-emerald-400 uppercase leading-none mb-1">
                    {dateStr.value
                      ? new Date(dateStr.value + "T12:00:00").toLocaleDateString("es-AR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })
                      : ""} · {timeStr.value} hs
                  </span>
                ) : (
                  <span class="text-[10px] font-bold text-slate-500 uppercase leading-none mb-1">
                    Paso {currentStep.value} de 3
                  </span>
                )}
                <div class="flex items-baseline gap-1">
                  <span class="text-[10px] font-black text-slate-500 uppercase">Total:</span>
                  <span class="text-xl font-black text-white">${totalPrice.value}</span>
                </div>
              </div>

              {/* Right Column: Button Actions */}
              <div class="flex-1 max-w-[200px]">
                {currentStep.value === 1 && (
                  <button
                    type="button"
                    onClick$={nextStep}
                    disabled={!timeStr.value || isSubmitDisabled.value}
                    class="w-full h-11 flex items-center justify-center gap-1.5 rounded-xl bg-[#F5F2EB] text-slate-900 text-xs font-black tracking-widest uppercase transition-all shadow-md shadow-[#F5F2EB]/10 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continuar
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {currentStep.value === 2 && (
                  <button
                    type="button"
                    onClick$={nextStep}
                    disabled={!isStep3Enabled.value}
                    class="w-full h-11 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-white text-xs font-black tracking-widest uppercase transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continuar a Pago
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {currentStep.value === 3 && (
                  <button
                    type="submit"
                    form="booking-form"
                    disabled={userAction.isRunning || guestAction.isRunning}
                    class={[
                      "w-full h-11 flex items-center justify-center gap-1.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md active:scale-95",
                      !user
                        ? "bg-[#25D366] text-white shadow-[#25D366]/20 hover:bg-[#1ea952]"
                        : "bg-emerald-500 text-white shadow-emerald-500/25 hover:bg-emerald-600",
                      (userAction.isRunning || guestAction.isRunning) && "cursor-wait opacity-70",
                    ]}
                  >
                    {userAction.isRunning || guestAction.isRunning ? (
                      <span class="flex items-center gap-1 animate-pulse">⏳...</span>
                    ) : !user ? (
                      <>
                        <svg class="h-3.5 w-3.5 fill-white" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                        Enviar Solicitud
                      </>
                    ) : (
                      <>Confirmar Reserva</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal.Panel>
      </Modal.Root>
    </>
  );
});
