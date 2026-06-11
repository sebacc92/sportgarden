import {
  component$,
  useTask$,
  useComputed$,
  type Signal,
} from "@builder.io/qwik";
import { Form, Link } from "@builder.io/qwik-city";
import { Modal, Button } from "~/components/ui";
import { cn } from "@qwik-ui/utils";
import {
  searchUsersServer,
  getAdminDailyBookings,
} from "~/routes/admin/calendar";
import { calculateProportionalPrice } from "~/utils/pricing";

interface CreateBookingModalProps {
  isCreateModalOpen: Signal<boolean>;
  calendarData: any;
  createBookingAction: any;
  // Form signals
  adminFormPitchId: Signal<string>;
  adminFormDate: Signal<string>;
  adminFormTime: Signal<string>;
  adminFormDuration: Signal<string>;
  adminIsSubscription: Signal<boolean>;
  adminBookingType: Signal<
    "EVENTUAL" | "FIXED" | "BIRTHDAY" | "TOURNAMENT" | "SCHOOL"
  >;
  adminEndDate: Signal<string>;
  adminNotes: Signal<string>;
  adminOccupiedSlots: Signal<{ startTime: string; endTime: string }[]>;
  adminIsChecking: Signal<boolean>;
  adminSubSchedules: {
    slots: {
      id: string;
      dayOfWeek: number;
      startTime: string;
      duration: string;
      pitchId: string;
    }[];
  };
  adminSearchTerm: Signal<string>;
  adminSearchResults: Signal<any[]>;
  adminSelectedUserId: Signal<string>;
  adminSelectedUserName: Signal<string>;
  adminSelectedUserPhone: Signal<string>;
  adminSelectedUserEmail: Signal<string>;
  adminIsSearching: Signal<boolean>;
  adminApplyDiscount: Signal<boolean>;
  adminDiscountAmount: Signal<number | "">;
  adminDiscountType: Signal<"FIXED" | "PERCENTAGE">;
  adminSelectedExtras: Signal<string[]>;
  adminIsFullPayment: Signal<boolean>;
  adminPaidAmount: Signal<number | "">;
}

export const CreateBookingModal = component$<CreateBookingModalProps>(
  (props) => {
    const {
      isCreateModalOpen,
      calendarData,
      createBookingAction,
      adminFormPitchId,
      adminFormDate,
      adminFormTime,
      adminFormDuration,
      adminIsSubscription,
      adminBookingType,
      adminEndDate,
      adminNotes,
      adminOccupiedSlots,
      adminIsChecking,
      adminSubSchedules,
      adminSearchTerm,
      adminSearchResults,
      adminSelectedUserId,
      adminSelectedUserName,
      adminSelectedUserPhone,
      adminSelectedUserEmail,
      adminIsSearching,
      adminApplyDiscount,
      adminDiscountAmount,
      adminDiscountType,
      adminSelectedExtras,
      adminIsFullPayment,
      adminPaidAmount,
    } = props;

    const subscriptionSchedulesJSON = useComputed$(() => {
      const schedules: {
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        price: number;
        pitchId: string;
      }[] = [];

      for (const slot of adminSubSchedules.slots) {
        const pitch =
          calendarData.pitches.find((p: any) => p.id === slot.pitchId) ||
          calendarData.pitches.find(
            (p: any) => p.id === adminFormPitchId.value,
          );
        const basePrice = pitch ? pitch.pricePerHour : 0;

        const sTime = slot.startTime || "18:00";
        const duration = parseInt(slot.duration, 10);

        const [startHour, startMin] = sTime.split(":").map(Number);
        const totalStartMins = startHour * 60 + startMin;
        const totalEndMins = totalStartMins + duration;
        const endHour = Math.floor(totalEndMins / 60);
        const endMin = totalEndMins % 60;
        const eTime = `${String(endHour % 24).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

        const schedulePrice = (basePrice / 60) * duration;

        schedules.push({
          dayOfWeek: slot.dayOfWeek,
          startTime: sTime,
          endTime: eTime,
          price: schedulePrice,
          pitchId: slot.pitchId,
        });
      }
      return JSON.stringify(schedules);
    });

    const adminTimeOptions = useComputed$(() => {
      let startHour = 8;
      let endHour = 23;
      let startMin = 0;

      if (adminFormDate.value && calendarData.settings?.operatingHours) {
        const selectedDate = new Date(`${adminFormDate.value}T12:00:00`);
        const holidays = (calendarData.settings?.holidays as any[]) || [];
        const isHoliday = holidays.some(
          (h: any) => h.date === adminFormDate.value,
        );
        const dayOfWeek = isHoliday ? 7 : selectedDate.getDay();

        let operatingHours = [];
        try {
          if (typeof calendarData.settings.operatingHours === "string") {
            operatingHours = JSON.parse(calendarData.settings.operatingHours);
          } else if (Array.isArray(calendarData.settings.operatingHours)) {
            operatingHours = calendarData.settings.operatingHours;
          }
        } catch {
          // Safe fallback
        }

        const todaySchedule = operatingHours.find(
          (h: any) => h.day === dayOfWeek,
        );
        if (todaySchedule && !todaySchedule.isClosed) {
          if (todaySchedule.openTime) {
            const [h, m] = todaySchedule.openTime.split(":").map(Number);
            startHour = h;
            startMin = m || 0;
          }
          if (todaySchedule.closeTime) {
            endHour = parseInt(todaySchedule.closeTime.split(":")[0], 10);
          }
        }
      }

      const options: string[] = [];
      for (let h = 0; h <= 23; h++) {
        if (h < startHour || h > endHour) continue;

        if (h === startHour) {
          if (startMin <= 0) options.push(`${String(h).padStart(2, "0")}:00`);
          if (startMin <= 30) options.push(`${String(h).padStart(2, "0")}:30`);
        } else {
          options.push(`${String(h).padStart(2, "0")}:00`);
          options.push(`${String(h).padStart(2, "0")}:30`);
        }
      }
      return options;
    });

    const adminEndTime = useComputed$(() => {
      if (!adminFormTime.value) return "";
      const [h, m] = adminFormTime.value.split(":").map(Number);
      const totalMins = h * 60 + m + parseInt(adminFormDuration.value, 10);
      return `${String(Math.floor(totalMins / 60) % 24).padStart(2, "0")}:${String(totalMins % 60).padStart(2, "0")}`;
    });

    // Search user logic
    useTask$(({ track, cleanup }) => {
      const term = track(() => adminSearchTerm.value);
      if (term.length >= 2) {
        adminIsSearching.value = true;
        const id = setTimeout(() => {
          searchUsersServer(term)
            .then((res) => {
              adminSearchResults.value = res;
              adminIsSearching.value = false;
            })
            .catch(() => {
              adminSearchResults.value = [];
              adminIsSearching.value = false;
            });
        }, 400);
        cleanup(() => clearTimeout(id));
      } else {
        adminSearchResults.value = [];
        adminIsSearching.value = false;
      }
    });

    useTask$(({ track }) => {
      const pitchId = track(() => adminFormPitchId.value);
      const date = track(() => adminFormDate.value);
      if (pitchId && date) {
        adminIsChecking.value = true;
        getAdminDailyBookings(pitchId, date).then((slots) => {
          adminOccupiedSlots.value = slots;
          adminIsChecking.value = false;
        });
      } else {
        adminOccupiedSlots.value = [];
      }
    });

    return (
      <Modal.Root bind:show={isCreateModalOpen}>
        <Modal.Panel
          position="right"
          class="fixed inset-y-0 top-0 right-0 w-[700px] max-w-[95vw] overflow-hidden bg-white p-0 shadow-2xl"
        >
          <div class="flex h-[100dvh] w-full flex-col">
            {(() => {
              const pitch = calendarData.pitches.find(
                (p: any) => p.id === adminFormPitchId.value,
              );
              const dateStr = adminFormDate.value;
              const nowBAStr = new Intl.DateTimeFormat("en-CA", {
                timeZone: "America/Argentina/Buenos_Aires",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              })
                .format(new Date())
                .replace(", ", "T");
              const formDateStr = `${dateStr}T${adminFormTime.value}`;
              const isPast =
                dateStr && adminFormTime.value ? formDateStr < nowBAStr : false;

              let basePrice = 0;
              if (adminIsSubscription.value) {
                const schedules = JSON.parse(subscriptionSchedulesJSON.value);
                basePrice = schedules.reduce(
                  (acc: number, s: any) => acc + s.price,
                  0,
                );
              } else if (pitch) {
                const holidays =
                  (calendarData.settings?.holidays as any[])?.map(
                    (h: any) => h.date,
                  ) || [];
                basePrice = calculateProportionalPrice(
                  dateStr,
                  adminFormTime.value,
                  parseInt(adminFormDuration.value),
                  pitch.pricePerHour,
                  pitch.pricingRules || [],
                  holidays,
                );
              }

              const extrasCost = adminSelectedExtras.value.reduce(
                (acc, name) => {
                  const extra = calendarData.extraServices.find(
                    (e: any) => e.name === name,
                  );
                  return acc + (extra ? extra.price : 0);
                },
                0,
              );
              const discount =
                adminDiscountType.value === "FIXED"
                  ? Number(adminDiscountAmount.value) || 0
                  : basePrice *
                    ((Number(adminDiscountAmount.value) || 0) / 100);
              const finalPrice = Math.max(0, basePrice - discount) + extrasCost;

              const openRegister = calendarData.openRegister;

              if (!openRegister) {
                return (
                  <div class="flex flex-1 flex-col items-center justify-center bg-slate-50 p-12 text-center">
                    <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-100 text-red-600 shadow-inner">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <rect width="20" height="12" x="2" y="6" rx="2" />
                        <circle cx="12" cy="12" r="2" />
                        <path d="M6 12h.01M18 12h.01" />
                      </svg>
                    </div>
                    <h2 class="mb-3 text-3xl font-black tracking-tighter text-slate-800 uppercase">
                      Caja Cerrada
                    </h2>
                    <p class="mb-10 max-w-sm text-sm leading-relaxed font-medium text-slate-500">
                      No es posible crear nuevas reservas mientras la caja esté
                      cerrada. Esto asegura que todos los cobros queden
                      registrados correctamente.
                    </p>
                    <div class="flex w-full max-w-xs flex-col gap-3">
                      <Link
                        href="/admin/cash/"
                        class="w-full rounded-2xl bg-emerald-500 py-4 text-center text-xs font-black tracking-widest text-white uppercase shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600"
                      >
                        Ir a Abrir Caja
                      </Link>
                      <button
                        onClick$={() => (isCreateModalOpen.value = false)}
                        class="w-full rounded-2xl border border-slate-200 bg-white py-4 text-xs font-black tracking-widest text-slate-500 uppercase transition-all hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <>
                  <div class="relative shrink-0 border-b border-slate-200 bg-white px-8 pt-8 pb-6">
                    {isPast && (
                      <div class="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-100 px-4 py-2.5 text-xs font-black tracking-widest text-amber-700 uppercase shadow-sm">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                          <path d="M12 9v4" />
                          <path d="M12 17h.01" />
                        </svg>
                        Horario Pasado o en Curso
                      </div>
                    )}
                    <div class="flex items-center justify-between">
                      <Modal.Title class="text-[28px] leading-none font-black tracking-tighter text-slate-800">
                        Nueva Reserva
                      </Modal.Title>
                      <Modal.Close class="-mr-1.5 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-800">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </Modal.Close>
                    </div>
                  </div>

                  <div class="flex-1 overflow-y-auto bg-slate-50 px-8 py-6">
                    <Form
                      action={createBookingAction}
                      id="create-booking-form"
                      class="space-y-6 pb-10"
                      onSubmitCompleted$={() => {
                        if (createBookingAction.value?.success)
                          isCreateModalOpen.value = false;
                      }}
                    >
                      {/* ---------------------------
                        BLOQUE 1: Datos del Cliente
                    --------------------------- */}
                      <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 class="mb-4 flex items-center gap-2 text-sm font-black tracking-widest text-slate-800 uppercase">
                          <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                          Datos del Organizador
                        </h3>

                        <div class="relative">
                          <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                            Buscar Cliente Registrado
                          </label>
                          <div class="relative">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <circle cx="11" cy="11" r="8" />
                              <path d="m21 21-4.3-4.3" />
                            </svg>
                            <input
                              type="text"
                              value={adminSearchTerm.value}
                              onInput$={(_, el) =>
                                (adminSearchTerm.value = el.value)
                              }
                              placeholder="Buscar por nombre, teléfono o email..."
                              class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-9 text-sm font-medium focus:border-emerald-500 focus:outline-none"
                            />
                            {adminIsSearching.value && (
                              <div class="absolute top-1/2 right-3 h-3 w-3 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500"></div>
                            )}
                          </div>

                          {adminSearchTerm.value.length >= 2 &&
                            !adminSelectedUserId.value && (
                              <div class="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                                {adminSearchResults.value.length > 0 ? (
                                  adminSearchResults.value.map((user) => (
                                    <button
                                      key={user.id}
                                      type="button"
                                      onClick$={() => {
                                        adminSelectedUserId.value = user.id;
                                        adminSelectedUserName.value = user.name;
                                        adminSelectedUserPhone.value =
                                          user.phone || "";
                                        adminSelectedUserEmail.value =
                                          user.email || "";
                                        adminSearchTerm.value = "";
                                        adminSearchResults.value = [];
                                      }}
                                      class="flex w-full flex-col border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                                    >
                                      <span class="text-sm font-bold text-slate-800">
                                        {user.name}
                                      </span>
                                      <span class="text-xs text-slate-500">
                                        {user.phone || user.email}
                                      </span>
                                    </button>
                                  ))
                                ) : !adminIsSearching.value ? (
                                  <div class="px-4 py-4 text-center">
                                    <p class="mb-2 text-sm font-medium text-slate-500">
                                      Cliente no encontrado
                                    </p>
                                    <button
                                      type="button"
                                      onClick$={() => {
                                        adminSelectedUserName.value =
                                          adminSearchTerm.value;
                                        adminSearchTerm.value = "";
                                        adminSearchResults.value = [];
                                        document
                                          .querySelector<HTMLInputElement>(
                                            'input[name="customerName"]',
                                          )
                                          ?.focus();
                                      }}
                                      class="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100"
                                    >
                                      Registrar como nuevo cliente
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            )}
                        </div>

                        <input
                          type="hidden"
                          name="userId"
                          value={adminSelectedUserId.value}
                        />

                        <div class="grid grid-cols-2 gap-4">
                          <div>
                            <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                              Nombre Completo{" "}
                              <span class="text-emerald-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="customerName"
                              required={!adminSelectedUserId.value}
                              value={adminSelectedUserName.value}
                              onInput$={(_, el) =>
                                (adminSelectedUserName.value = el.value)
                              }
                              readOnly={!!adminSelectedUserId.value}
                              placeholder="Ej: Juan Pérez"
                              class={[
                                "w-full rounded-xl border px-4 py-2.5 text-sm font-medium focus:outline-none",
                                adminSelectedUserId.value
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600"
                                  : "border-slate-200 bg-white focus:border-emerald-500",
                              ]}
                            />
                          </div>
                          <div>
                            <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                              Teléfono <span class="text-emerald-500">*</span>
                            </label>
                            <input
                              type="tel"
                              name="customerPhone"
                              required={!adminSelectedUserId.value}
                              value={adminSelectedUserPhone.value}
                              onInput$={(_, el) =>
                                (adminSelectedUserPhone.value = el.value)
                              }
                              readOnly={!!adminSelectedUserId.value}
                              placeholder="Ej: 1123456789"
                              class={[
                                "w-full rounded-xl border px-4 py-2.5 text-sm font-medium focus:outline-none",
                                adminSelectedUserId.value
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600"
                                  : "border-slate-200 bg-white focus:border-emerald-500",
                              ]}
                            />
                          </div>
                        </div>

                        {!adminSelectedUserId.value && (
                          <div>
                            <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                              Email{" "}
                              <span class="font-normal text-slate-300 normal-case">
                                (Opcional)
                              </span>
                            </label>
                            <input
                              type="email"
                              name="customerEmail"
                              value={adminSelectedUserEmail.value}
                              onInput$={(_, el) =>
                                (adminSelectedUserEmail.value = el.value)
                              }
                              placeholder="ejemplo@correo.com"
                              class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium focus:border-emerald-500 focus:outline-none"
                            />
                          </div>
                        )}

                        {adminSelectedUserId.value && (
                          <div class="flex justify-end pt-2">
                            <button
                              type="button"
                              onClick$={() => {
                                adminSelectedUserId.value = "";
                                adminSearchTerm.value = "";
                                adminSelectedUserName.value = "";
                                adminSelectedUserPhone.value = "";
                                adminSelectedUserEmail.value = "";
                              }}
                              class="text-[10px] font-bold text-emerald-600 uppercase hover:text-emerald-700"
                            >
                              Ingresar datos manualmente (No registrado)
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ---------------------------
                        BLOQUE 2: Detalles del Turno
                    --------------------------- */}
                      <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 class="mb-4 flex items-center gap-2 text-sm font-black tracking-widest text-slate-800 uppercase">
                          <span class="h-2 w-2 rounded-full bg-blue-500"></span>
                          Detalles del Turno
                        </h3>

                        <div class="pt-2">
                          <label class="mb-2 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                            Categoría de Reserva
                          </label>
                          <div class="flex flex-wrap gap-2">
                            {[
                              {
                                id: "EVENTUAL",
                                label: "Eventual",
                                color: "blue",
                                class:
                                  "bg-blue-500 border-blue-500 shadow-blue-500/20",
                              },
                              {
                                id: "FIXED",
                                label: "Fijo",
                                color: "emerald",
                                class:
                                  "bg-emerald-500 border-emerald-500 shadow-emerald-500/20",
                              },
                              {
                                id: "BIRTHDAY",
                                label: "Cumple",
                                color: "violet",
                                class:
                                  "bg-violet-500 border-violet-500 shadow-violet-500/20",
                              },
                              {
                                id: "SCHOOL",
                                label: "Escuelita",
                                color: "orange",
                                class:
                                  "bg-orange-500 border-orange-500 shadow-orange-500/20",
                              },
                              {
                                id: "TOURNAMENT",
                                label: "Torneo",
                                color: "pink",
                                class:
                                  "bg-pink-500 border-pink-500 shadow-pink-500/20",
                              },
                            ].map((type) => (
                              <button
                                key={type.id}
                                type="button"
                                onClick$={() => {
                                  adminBookingType.value = type.id as any;
                                  adminIsSubscription.value =
                                    type.id === "FIXED" || type.id === "SCHOOL";
                                }}
                                class={cn(
                                  "rounded-xl border px-3 py-2 text-[10px] font-black tracking-widest uppercase transition-all",
                                  adminBookingType.value === type.id
                                    ? `text-white ${type.class} shadow-lg`
                                    : "border-slate-200 bg-white text-slate-400 hover:border-slate-300",
                                )}
                              >
                                {type.label}
                              </button>
                            ))}
                          </div>
                          <input
                            type="hidden"
                            name="bookingType"
                            value={adminBookingType.value}
                          />
                          <input
                            type="hidden"
                            name="isSubscription"
                            value={adminIsSubscription.value ? "true" : "false"}
                          />
                        </div>

                        {!adminIsSubscription.value && (
                          <div class="grid grid-cols-2 gap-4">
                            <div>
                              <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                                Cancha
                              </label>
                              <select
                                name="pitchId"
                                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50 focus:border-blue-500 focus:outline-none"
                                value={adminFormPitchId.value}
                                onChange$={(_, el) =>
                                  (adminFormPitchId.value = el.value)
                                }
                                required={!adminIsSubscription.value}
                              >
                                <option value="">Seleccionar cancha</option>
                                {calendarData.pitches.map((p: any) => (
                                  <option
                                    key={p.id}
                                    value={p.id}
                                  >{`${p.name} ${p.type}`}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div class="mb-1 flex items-center justify-between">
                                <label class="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                                  Fecha
                                </label>
                                <button
                                  type="button"
                                  onClick$={() => {
                                    const today = new Intl.DateTimeFormat(
                                      "en-CA",
                                      {
                                        timeZone:
                                          "America/Argentina/Buenos_Aires",
                                      },
                                    ).format(new Date());
                                    adminFormDate.value = today;
                                  }}
                                  class="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 transition-colors hover:bg-blue-100"
                                >
                                  HOY
                                </button>
                              </div>
                              <input
                                type="date"
                                name="date"
                                value={adminFormDate.value}
                                onChange$={(_, el) =>
                                  (adminFormDate.value = el.value)
                                }
                                required={!adminIsSubscription.value}
                                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50 focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {!adminIsSubscription.value ? (
                          <div class="grid grid-cols-2 gap-4">
                            <div>
                              <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                                Hora Inicio
                              </label>
                              <select
                                name="startTime"
                                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm font-medium transition-colors hover:bg-slate-50 focus:border-blue-500 focus:outline-none"
                                value={adminFormTime.value}
                                onChange$={(_, el) =>
                                  (adminFormTime.value = el.value)
                                }
                                required={!adminIsSubscription.value}
                              >
                                <option value="">--:-- hs</option>
                                {adminTimeOptions.value.map((t) => (
                                  <option key={t} value={t}>{`${t} hs`}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                                Duración
                              </label>
                              <input
                                type="hidden"
                                name="endTime"
                                value={adminEndTime.value}
                              />
                              <select
                                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm font-medium transition-colors hover:bg-slate-50 focus:border-blue-500 focus:outline-none"
                                value={adminFormDuration.value}
                                onChange$={(_, el) =>
                                  (adminFormDuration.value = el.value)
                                }
                              >
                                <option value="30">30 min</option>
                                <option value="60">1 hora</option>
                                <option value="90">1.5 horas</option>
                                <option value="120">2 horas</option>
                                <option value="150">2.5 horas</option>
                                <option value="180">3 horas</option>
                                <option value="210">3.5 horas</option>
                                <option value="240">4 horas</option>
                                <option value="270">4.5 horas</option>
                                <option value="300">5 horas</option>
                                <option value="330">5.5 horas</option>
                                <option value="360">6 horas</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <>
                            <input
                              type="hidden"
                              name="startTime"
                              value={adminFormTime.value || "18:00"}
                            />
                            <input
                              type="hidden"
                              name="endTime"
                              value={adminEndTime.value || "19:00"}
                            />
                          </>
                        )}

                        {adminIsSubscription.value && (
                          <input
                            type="hidden"
                            name="pitchId"
                            value={adminSubSchedules.slots[0]?.pitchId || ""}
                          />
                        )}

                        {adminIsSubscription.value && (
                          <div class="animate-in fade-in slide-in-from-top-2 mt-2 space-y-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 duration-300">
                            <div>
                              <div class="mb-3 flex items-center justify-between">
                                <label class="block text-[11px] font-bold tracking-wider text-blue-700 uppercase">
                                  Configuración de Horarios Fijos
                                </label>
                                <button
                                  type="button"
                                  onClick$={() => {
                                    adminSubSchedules.slots = [
                                      ...adminSubSchedules.slots,
                                      {
                                        id: crypto.randomUUID(),
                                        dayOfWeek: 1,
                                        startTime: "18:00",
                                        duration: "60",
                                        pitchId:
                                          adminFormPitchId.value ||
                                          calendarData.pitches[0]?.id,
                                      },
                                    ];
                                  }}
                                  class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-black tracking-widest text-white uppercase shadow-sm transition-all hover:bg-blue-700"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="3"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                  >
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                  </svg>
                                  Agregar Turno
                                </button>
                              </div>

                              <input
                                type="hidden"
                                name="subscriptionSchedules"
                                value={subscriptionSchedulesJSON.value}
                              />

                              <div class="space-y-3">
                                {adminSubSchedules.slots.length === 0 && (
                                  <div class="rounded-2xl border-2 border-dashed border-blue-200 bg-white/50 py-10 text-center">
                                    <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-500">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2.5"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                      >
                                        <rect
                                          width="18"
                                          height="18"
                                          x="3"
                                          y="4"
                                          rx="2"
                                          ry="2"
                                        />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                      </svg>
                                    </div>
                                    <p class="text-xs font-black tracking-widest text-blue-800 uppercase">
                                      Sin horarios definidos
                                    </p>
                                    <p class="mt-1 text-[10px] font-medium text-blue-400 italic">
                                      Perfecto para escuelas con múltiples
                                      horarios y canchas.
                                    </p>
                                  </div>
                                )}

                                {adminSubSchedules.slots.map((slot) => (
                                  <div
                                    key={slot.id}
                                    class="group/slot animate-in zoom-in-95 relative space-y-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm duration-200"
                                  >
                                    <button
                                      type="button"
                                      onClick$={() => {
                                        adminSubSchedules.slots =
                                          adminSubSchedules.slots.filter(
                                            (s) => s.id !== slot.id,
                                          );
                                      }}
                                      class="absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-colors hover:bg-red-600"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="3"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                      >
                                        <line
                                          x1="18"
                                          y1="6"
                                          x2="6"
                                          y2="18"
                                        ></line>
                                        <line
                                          x1="6"
                                          y1="6"
                                          x2="18"
                                          y2="18"
                                        ></line>
                                      </svg>
                                    </button>

                                    <div class="grid grid-cols-12 gap-3">
                                      <div class="col-span-4">
                                        <label class="mb-1 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                          Día
                                        </label>
                                        <select
                                          class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                                          value={slot.dayOfWeek}
                                          onChange$={(_, el) =>
                                            (slot.dayOfWeek = parseInt(
                                              el.value,
                                              10,
                                            ))
                                          }
                                        >
                                          {[
                                            { id: 1, label: "Lunes" },
                                            { id: 2, label: "Martes" },
                                            { id: 3, label: "Miércoles" },
                                            { id: 4, label: "Jueves" },
                                            { id: 5, label: "Viernes" },
                                            { id: 6, label: "Sábado" },
                                            { id: 0, label: "Domingo" },
                                          ].map((day) => (
                                            <option key={day.id} value={day.id}>
                                              {day.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div class="col-span-8">
                                        <label class="mb-1 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                          Cancha
                                        </label>
                                        <select
                                          class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                                          value={slot.pitchId}
                                          onChange$={(_, el) =>
                                            (slot.pitchId = el.value)
                                          }
                                        >
                                          {calendarData.pitches.map(
                                            (p: any) => (
                                              <option
                                                key={p.id}
                                                value={p.id}
                                              >{`${p.name} (${p.type})`}</option>
                                            ),
                                          )}
                                        </select>
                                      </div>
                                      <div class="col-span-6">
                                        <label class="mb-1 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                          Inicio
                                        </label>
                                        <select
                                          class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 font-mono text-xs font-black text-slate-700 focus:border-blue-500 focus:outline-none"
                                          value={slot.startTime}
                                          onChange$={(_, el) =>
                                            (slot.startTime = el.value)
                                          }
                                        >
                                          {adminTimeOptions.value.map((t) => (
                                            <option
                                              key={t}
                                              value={t}
                                            >{`${t} hs`}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div class="col-span-6">
                                        <label class="mb-1 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                          Duración
                                        </label>
                                        <select
                                          class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:outline-none"
                                          value={slot.duration}
                                          onChange$={(_, el) =>
                                            (slot.duration = el.value)
                                          }
                                        >
                                          <option value="30">30 min</option>
                                          <option value="60">1 hora</option>
                                          <option value="90">1.5 h</option>
                                          <option value="120">2 h</option>
                                          <option value="150">2.5 h</option>
                                          <option value="180">3 h</option>
                                          <option value="210">3.5 h</option>
                                          <option value="240">4 h</option>
                                          <option value="270">4.5 h</option>
                                          <option value="300">5 h</option>
                                          <option value="330">5.5 h</option>
                                          <option value="360">6 h</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div class="grid grid-cols-2 gap-4 border-t border-blue-100 pt-4">
                              <div>
                                <label class="mb-1 block text-[11px] font-black tracking-wider text-blue-700 uppercase">
                                  Fecha de Inicio
                                </label>
                                <input
                                  type="date"
                                  name="date"
                                  value={adminFormDate.value}
                                  onChange$={(_, el) =>
                                    (adminFormDate.value = el.value)
                                  }
                                  required={adminIsSubscription.value}
                                  class="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-black text-slate-700 focus:border-blue-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label class="mb-1 block text-[11px] font-black tracking-wider text-blue-700 uppercase">
                                  Repetir hasta{" "}
                                  <span class="font-bold text-blue-400 normal-case">
                                    (opcional)
                                  </span>
                                </label>
                                <input
                                  type="date"
                                  name="endDate"
                                  value={adminEndDate.value}
                                  onInput$={(_, el) =>
                                    (adminEndDate.value = el.value)
                                  }
                                  class="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-black text-slate-700 focus:border-blue-500 focus:outline-none"
                                />
                              </div>
                            </div>
                            <p class="flex items-start gap-1.5 text-[10px] leading-tight font-bold text-blue-500">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="3"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="mt-0.5 shrink-0"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                              Si no indicás fecha límite, el abono se genera
                              por 12 semanas y se extiende automáticamente cada
                              semana hasta que lo des de baja desde Abonos
                              Fijos. Las fechas con conflicto se saltean y se
                              informan al crear.
                            </p>
                          </div>
                        )}

                        {/* Notas */}
                        <div class="pt-2">
                          <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                            Notas Internas
                          </label>
                          <textarea
                            name="notes"
                            value={adminNotes.value}
                            onInput$={(_, el) => (adminNotes.value = el.value)}
                            placeholder="Sólo será visible por el complejo..."
                            rows={2}
                            class="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none"
                          ></textarea>
                        </div>
                      </div>

                      {/* ---------------------------
                        BLOQUE 3: Finanzas y Pagos
                    --------------------------- */}
                      <div class="space-y-5 rounded-2xl border border-slate-700 bg-slate-800 p-6 text-white shadow-sm">
                        <h3 class="mb-2 flex items-center gap-2 text-sm font-black tracking-widest text-slate-200 uppercase">
                          <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
                          Finanzas y Pagos
                        </h3>

                        {calendarData.extraServices.length > 0 && (
                          <div>
                            <label class="mb-2 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                              Servicios Extra
                            </label>
                            <div class="flex flex-wrap gap-2">
                              {calendarData.extraServices.map((extra: any) => {
                                const isSelected =
                                  adminSelectedExtras.value.includes(
                                    extra.name,
                                  );
                                return (
                                  <button
                                    key={extra.name}
                                    type="button"
                                    onClick$={() => {
                                      if (isSelected) {
                                        adminSelectedExtras.value =
                                          adminSelectedExtras.value.filter(
                                            (e) => e !== extra.name,
                                          );
                                      } else {
                                        adminSelectedExtras.value = [
                                          ...adminSelectedExtras.value,
                                          extra.name,
                                        ];
                                      }
                                    }}
                                    class={cn(
                                      "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all",
                                      isSelected
                                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                                        : "border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700",
                                    )}
                                  >
                                    <span class="text-sm">{extra.icon}</span>
                                    <span>
                                      {extra.name} (+${extra.price})
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div class="flex items-center justify-between border-b border-slate-700 pb-4">
                          <label class="group flex cursor-pointer items-center gap-2">
                            <div class="relative">
                              <input
                                type="checkbox"
                                class="sr-only"
                                checked={adminApplyDiscount.value}
                                onChange$={(_, el) => {
                                  adminApplyDiscount.value = el.checked;
                                  if (!el.checked)
                                    adminDiscountAmount.value = 0;
                                }}
                              />
                              <div
                                class={cn(
                                  "block h-6 w-10 rounded-full transition-colors",
                                  adminApplyDiscount.value
                                    ? "bg-emerald-500"
                                    : "bg-slate-600",
                                )}
                              ></div>
                              <div
                                class={cn(
                                  "dot absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform",
                                  adminApplyDiscount.value &&
                                    "translate-x-4 transform",
                                )}
                              ></div>
                            </div>
                            <span class="text-xs font-bold tracking-wider text-slate-300 uppercase transition-colors group-hover:text-white">
                              Aplicar Descuento
                            </span>
                          </label>

                          <div class="flex items-center gap-3">
                            <div class="text-right text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                              Costo Total
                            </div>
                            <div class="text-3xl font-black text-emerald-400">
                              ${finalPrice.toLocaleString("es-AR")}
                            </div>
                            <input
                              type="hidden"
                              name="price"
                              value={finalPrice}
                            />
                            <input
                              type="hidden"
                              name="extras"
                              value={JSON.stringify(adminSelectedExtras.value)}
                            />
                          </div>
                        </div>

                        {adminApplyDiscount.value && (
                          <div class="animate-in fade-in slide-in-from-top-1 flex gap-4 duration-300">
                            <div class="flex-1">
                              <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                                Tipo de Dto.
                              </label>
                              <select
                                value={adminDiscountType.value}
                                onChange$={(_, el) =>
                                  (adminDiscountType.value = el.value as any)
                                }
                                class="w-full appearance-none rounded-xl border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm font-bold text-white transition-all focus:border-emerald-500 focus:outline-none"
                              >
                                <option value="FIXED">Monto Fijo ($)</option>
                                <option value="PERCENTAGE">
                                  Porcentaje (%)
                                </option>
                              </select>
                            </div>
                            <div class="flex-1">
                              <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                                Valor a descontar
                              </label>
                              <div class="relative">
                                <span class="absolute top-1/2 left-3 -translate-y-1/2 font-bold text-slate-400">
                                  {adminDiscountType.value === "FIXED"
                                    ? "$"
                                    : "%"}
                                </span>
                                <input
                                  type="number"
                                  value={adminDiscountAmount.value}
                                  onInput$={(_, el) =>
                                    (adminDiscountAmount.value = el.value
                                      ? Number(el.value)
                                      : "")
                                  }
                                  min="0"
                                  placeholder="0"
                                  class="w-full rounded-xl border border-slate-600 bg-slate-700 py-2.5 pr-4 pl-8 text-sm font-bold text-white transition-all focus:border-emerald-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <div class="grid grid-cols-2 gap-4">
                          <div class="col-span-2 md:col-span-1">
                            <div class="mb-1 flex items-center justify-between">
                              <label class="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                                Monto Señado
                              </label>
                              <label class="group flex cursor-pointer items-center gap-1.5">
                                <div class="relative">
                                  <input
                                    type="checkbox"
                                    class="sr-only"
                                    checked={adminIsFullPayment.value}
                                    onChange$={(_, el) =>
                                      (adminIsFullPayment.value = el.checked)
                                    }
                                  />
                                  <div
                                    class={cn(
                                      "block h-3.5 w-6 rounded-full transition-colors",
                                      adminIsFullPayment.value
                                        ? "bg-emerald-500"
                                        : "bg-slate-600",
                                    )}
                                  ></div>
                                  <div
                                    class={cn(
                                      "dot absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform",
                                      adminIsFullPayment.value &&
                                        "translate-x-2.5 transform",
                                    )}
                                  ></div>
                                </div>
                                <span class="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                                  Pago Total
                                </span>
                              </label>
                            </div>
                            <div class="relative">
                              <span class="absolute top-1/2 left-3 -translate-y-1/2 font-black text-emerald-500">
                                $
                              </span>
                              <input
                                type="number"
                                name="paidAmount"
                                value={
                                  adminIsFullPayment.value
                                    ? finalPrice
                                    : adminPaidAmount.value
                                }
                                onInput$={(_, el) => {
                                  if (!adminIsFullPayment.value)
                                    adminPaidAmount.value = el.value
                                      ? Number(el.value)
                                      : "";
                                }}
                                readOnly={adminIsFullPayment.value}
                                placeholder="0"
                                min="0"
                                class={cn(
                                  "w-full rounded-xl border border-slate-600 bg-slate-700 py-2.5 pr-4 pl-8 text-sm font-black transition-all placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none",
                                  adminIsFullPayment.value
                                    ? "cursor-not-allowed bg-slate-800/50 text-emerald-300"
                                    : "text-emerald-400",
                                )}
                              />
                            </div>
                          </div>

                          <div class="col-span-2 md:col-span-1">
                            <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                              Medio de Pago
                            </label>
                            <select
                              name="paymentMethod"
                              class="w-full appearance-none rounded-xl border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm font-bold text-white transition-all focus:border-emerald-500 focus:outline-none"
                            >
                              {(calendarData.settings?.paymentMethods || [])
                                .filter((pm: any) => pm.isActive)
                                .map((pm: any) => (
                                  <option key={pm.id} value={pm.id}>
                                    {pm.name}
                                  </option>
                                ))}
                              {(
                                calendarData.settings?.paymentMethods || []
                              ).filter((pm: any) => pm.isActive).length ===
                                0 && (
                                <>
                                  <option value="CASH">Efectivo</option>
                                  <option value="TRANSFER">
                                    Transferencia
                                  </option>
                                  <option value="MERCADO_PAGO">
                                    Mercado Pago
                                  </option>
                                  <option value="CURRENT_ACCOUNT">
                                    Cuenta Corriente
                                  </option>
                                </>
                              )}
                            </select>
                            <p class="mt-2 text-[10px] leading-snug font-medium text-slate-400">
                              Podés activar, desactivar o agregar medios de pago
                              en{" "}
                              <Link
                                href="/admin/cash/medios-de-pago/"
                                class="text-emerald-400/90 underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-300"
                              >
                                Caja → Medios de pago
                              </Link>
                              .
                            </p>
                          </div>
                        </div>
                      </div>

                      {createBookingAction.value?.failed && (
                        <div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                          {createBookingAction.value.message ||
                            "Error al crear la reserva. Verificá los campos."}
                        </div>
                      )}
                      <button
                        type="submit"
                        id="hidden-submit-btn"
                        class="hidden"
                      >
                        Submit
                      </button>
                    </Form>
                  </div>

                  {/* Footer Flotante */}
                  <div class="z-10 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white p-6 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                    <Button
                      type="button"
                      onClick$={() => (isCreateModalOpen.value = false)}
                      look="outline"
                      class="rounded-xl border-slate-200 px-6 font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick$={() =>
                        document.getElementById("hidden-submit-btn")?.click()
                      }
                      look="primary"
                      disabled={
                        createBookingAction.isRunning ||
                        (adminIsSubscription.value
                          ? adminSubSchedules.slots.length === 0 ||
                            !adminFormDate.value
                          : !adminFormTime.value ||
                            !adminFormDate.value ||
                            !adminFormPitchId.value)
                      }
                      class="rounded-xl border-none bg-emerald-600 px-8 font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {createBookingAction.isRunning
                        ? "Guardando..."
                        : "Crear Reserva"}
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal.Panel>
      </Modal.Root>
    );
  },
);
