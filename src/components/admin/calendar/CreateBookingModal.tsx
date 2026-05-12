import { component$, useTask$, useComputed$, type Signal } from "@builder.io/qwik";
import { Form, Link } from "@builder.io/qwik-city";
import { Modal, Button } from "~/components/ui";
import { cn } from "@qwik-ui/utils";
import { searchUsersServer, getAdminDailyBookings } from "~/routes/admin/calendar";

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
  adminEndDate: Signal<string>;
  adminNotes: Signal<string>;
  adminOccupiedSlots: Signal<{ startTime: string; endTime: string }[]>;
  adminIsChecking: Signal<boolean>;
  adminSubDays: any; // Record<number, { active: boolean, startTime: string, duration: string }>
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

export const CreateBookingModal = component$<CreateBookingModalProps>((props) => {
  const {
    isCreateModalOpen,
    calendarData,
    createBookingAction,
    adminFormPitchId,
    adminFormDate,
    adminFormTime,
    adminFormDuration,
    adminIsSubscription,
    adminEndDate,
    adminNotes,
    adminOccupiedSlots,
    adminIsChecking,
    adminSubDays,
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
    adminPaidAmount
  } = props;

  const subscriptionSchedulesJSON = useComputed$(() => {
    const schedules: { dayOfWeek: number, startTime: string, endTime: string, price: number }[] = [];
    const pitch = calendarData.pitches.find((p: any) => p.id === adminFormPitchId.value);
    const basePrice = pitch ? pitch.pricePerHour : 0;

    for (let i = 0; i <= 6; i++) {
      if (adminSubDays[i].active) {
        const d = adminSubDays[i];
        const sTime = d.startTime || adminFormTime.value || "18:00";
        const duration = parseInt(d.duration, 10);

        const startHour = parseInt(sTime.split(":")[0], 10);
        const startMin = parseInt(sTime.split(":")[1], 10);
        const totalStartMins = startHour * 60 + startMin;
        const totalEndMins = totalStartMins + duration;
        const endHour = Math.floor(totalEndMins / 60);
        const endMin = totalEndMins % 60;
        const eTime = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

        const schedulePrice = (basePrice / 60) * duration;

        schedules.push({
          dayOfWeek: i,
          startTime: sTime,
          endTime: eTime,
          price: schedulePrice
        });
      }
    }
    return JSON.stringify(schedules);
  });

  const adminTimeOptions: string[] = [];
  for (let h = 8; h <= 23; h++) {
    adminTimeOptions.push(`${String(h).padStart(2, "0")}:00`);
    adminTimeOptions.push(`${String(h).padStart(2, "0")}:30`);
  }

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
        searchUsersServer(term).then(res => {
          adminSearchResults.value = res;
          adminIsSearching.value = false;
        }).catch(() => {
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

  // Load availability
  useTask$(({ track }) => {
    const pitchId = track(() => adminFormPitchId.value);
    const date = track(() => adminFormDate.value);
    if (pitchId && date) {
      adminIsChecking.value = true;
      adminFormTime.value = "";
      getAdminDailyBookings(pitchId, date).then(slots => {
        adminOccupiedSlots.value = slots;
        adminIsChecking.value = false;
      });
    } else {
      adminOccupiedSlots.value = [];
    }
  });

  return (
    <Modal.Root bind:show={isCreateModalOpen}>
      <Modal.Panel position="right" class="fixed right-0 top-0 inset-y-0 p-0 w-[700px] max-w-[95vw] overflow-hidden bg-white shadow-2xl">
        <div class="flex flex-col h-[100dvh] w-full">
          {(() => {
            const pitch = calendarData.pitches.find((p: any) => p.id === adminFormPitchId.value);
            const dateStr = adminFormDate.value;
            const nowBAStr = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'America/Argentina/Buenos_Aires',
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
            }).format(new Date()).replace(', ', 'T');
            const formDateStr = `${dateStr}T${adminFormTime.value}`;
            const isPast = dateStr && adminFormTime.value ? formDateStr < nowBAStr : false;

            const basePrice = pitch ? pitch.pricePerHour * (parseInt(adminFormDuration.value) / 60) : 0;
            const extrasCost = adminSelectedExtras.value.reduce((acc, name) => {
              const extra = calendarData.extraServices.find((e: any) => e.name === name);
              return acc + (extra ? extra.price : 0);
            }, 0);
            const discount = adminDiscountType.value === "FIXED"
              ? (Number(adminDiscountAmount.value) || 0)
              : basePrice * ((Number(adminDiscountAmount.value) || 0) / 100);
            const finalPrice = Math.max(0, basePrice - discount) + extrasCost;

            const openRegister = calendarData.openRegister;

            if (!openRegister) {
              return (
                <div class="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50 text-center">
                  <div class="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mb-6 text-red-600 shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
                  </div>
                  <h2 class="text-3xl font-black text-slate-800 mb-3 tracking-tighter uppercase">Caja Cerrada</h2>
                  <p class="text-slate-500 font-medium mb-10 max-w-sm leading-relaxed text-sm">
                    No es posible crear nuevas reservas mientras la caja esté cerrada. Esto asegura que todos los cobros queden registrados correctamente.
                  </p>
                  <div class="flex flex-col gap-3 w-full max-w-xs">
                    <Link 
                      href="/admin/cash/" 
                      class="w-full py-4 bg-emerald-500 text-slate-950 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 text-center"
                    >
                      Ir a Abrir Caja
                    </Link>
                    <button 
                      onClick$={() => isCreateModalOpen.value = false} 
                      class="w-full py-4 bg-white text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <>
                <div class="bg-white border-b border-slate-200 px-8 pt-8 pb-6 shrink-0 relative">
                  {isPast && (
                    <div class="bg-amber-100 border border-amber-200 text-amber-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 mb-4 w-full">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                      Horario Pasado o en Curso
                    </div>
                  )}
                  <div class="flex justify-between items-center">
                    <Modal.Title class="text-[28px] font-black text-slate-800 tracking-tighter leading-none">
                      Nueva Reserva
                    </Modal.Title>
                    <Modal.Close class="text-slate-400 hover:text-slate-800 transition-colors p-1.5 -mr-1.5 rounded-full hover:bg-slate-200">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </Modal.Close>
                  </div>
                </div>

                <div class="flex-1 overflow-y-auto px-8 py-6 bg-slate-50">
                  <Form action={createBookingAction} id="create-booking-form" class="space-y-6 pb-10" onSubmitCompleted$={() => { if (createBookingAction.value?.success) isCreateModalOpen.value = false; }}>

                    {/* ---------------------------
                        BLOQUE 1: Datos del Cliente
                    --------------------------- */}
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <h3 class="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Datos del Organizador
                      </h3>

                      <div class="relative">
                        <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Buscar Cliente Registrado</label>
                        <div class="relative">
                          <svg xmlns="http://www.w3.org/2000/svg" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                          <input
                            type="text"
                            value={adminSearchTerm.value}
                            onInput$={(_, el) => adminSearchTerm.value = el.value}
                            placeholder="Buscar por nombre, teléfono o email..."
                            class="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                          />
                          {adminIsSearching.value && (
                            <div class="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin"></div>
                          )}
                        </div>

                        {adminSearchTerm.value.length >= 2 && !adminSelectedUserId.value && (
                          <div class="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {adminSearchResults.value.length > 0 ? (
                              adminSearchResults.value.map(user => (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick$={() => {
                                    adminSelectedUserId.value = user.id;
                                    adminSelectedUserName.value = user.name;
                                    adminSelectedUserPhone.value = user.phone || "";
                                    adminSelectedUserEmail.value = user.email || "";
                                    adminSearchTerm.value = "";
                                    adminSearchResults.value = [];
                                  }}
                                  class="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col"
                                >
                                  <span class="text-sm font-bold text-slate-800">{user.name}</span>
                                  <span class="text-xs text-slate-500">{user.phone || user.email}</span>
                                </button>
                              ))
                            ) : !adminIsSearching.value ? (
                              <div class="px-4 py-4 text-center">
                                <p class="text-sm text-slate-500 font-medium mb-2">Cliente no encontrado</p>
                                <button
                                  type="button"
                                  onClick$={() => {
                                    adminSelectedUserName.value = adminSearchTerm.value;
                                    adminSearchTerm.value = "";
                                    adminSearchResults.value = [];
                                    document.querySelector<HTMLInputElement>('input[name="customerName"]')?.focus();
                                  }}
                                  class="text-xs font-bold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                                >
                                  Registrar como nuevo cliente
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <input type="hidden" name="userId" value={adminSelectedUserId.value} />

                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre Completo <span class="text-emerald-500">*</span></label>
                          <input
                            type="text"
                            name="customerName"
                            required={!adminSelectedUserId.value}
                            value={adminSelectedUserName.value}
                            onInput$={(_, el) => adminSelectedUserName.value = el.value}
                            readOnly={!!adminSelectedUserId.value}
                            placeholder="Ej: Juan Pérez"
                            class={["w-full px-4 py-2.5 border rounded-xl focus:outline-none text-sm font-medium", adminSelectedUserId.value ? "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed" : "bg-white border-slate-200 focus:border-emerald-500"]}
                          />
                        </div>
                        <div>
                          <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Teléfono <span class="text-emerald-500">*</span></label>
                          <input
                            type="tel"
                            name="customerPhone"
                            required={!adminSelectedUserId.value}
                            value={adminSelectedUserPhone.value}
                            onInput$={(_, el) => adminSelectedUserPhone.value = el.value}
                            readOnly={!!adminSelectedUserId.value}
                            placeholder="Ej: 1123456789"
                            class={["w-full px-4 py-2.5 border rounded-xl focus:outline-none text-sm font-medium", adminSelectedUserId.value ? "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed" : "bg-white border-slate-200 focus:border-emerald-500"]}
                          />
                        </div>
                      </div>

                      {!adminSelectedUserId.value && (
                        <div>
                          <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email <span class="text-slate-300 font-normal normal-case">(Opcional)</span></label>
                          <input
                            type="email"
                            name="customerEmail"
                            value={adminSelectedUserEmail.value}
                            onInput$={(_, el) => adminSelectedUserEmail.value = el.value}
                            placeholder="ejemplo@correo.com"
                            class="w-full px-4 py-2.5 border bg-white border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-sm font-medium"
                          />
                        </div>
                      )}

                      {adminSelectedUserId.value && (
                        <div class="pt-2 flex justify-end">
                          <button type="button" onClick$={() => { adminSelectedUserId.value = ""; adminSearchTerm.value = ""; adminSelectedUserName.value = ""; adminSelectedUserPhone.value = ""; adminSelectedUserEmail.value = ""; }} class="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase">
                            Ingresar datos manualmente (No registrado)
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ---------------------------
                        BLOQUE 2: Detalles del Turno
                    --------------------------- */}
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <h3 class="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                        Detalles del Turno
                      </h3>

                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cancha</label>
                          <select
                            name="pitchId"
                            class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 hover:bg-slate-50 transition-colors text-sm font-medium"
                            value={adminFormPitchId.value}
                            onChange$={(_, el) => adminFormPitchId.value = el.value}
                            required
                          >
                            <option value="">Seleccionar cancha</option>
                            {calendarData.pitches.map((p: any) => <option key={p.id} value={p.id}>{`${p.name} ${p.type}`}</option>)}
                          </select>
                        </div>
                        <div>
                          <div class="flex items-center justify-between mb-1">
                            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fecha</label>
                            <button
                              type="button"
                              onClick$={() => {
                                const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
                                adminFormDate.value = today;
                              }}
                              class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                            >
                              HOY
                            </button>
                          </div>
                          <input
                            type="date"
                            name="date"
                            value={adminFormDate.value}
                            onChange$={(_, el) => adminFormDate.value = el.value}
                            required
                            class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 hover:bg-slate-50 transition-colors text-sm font-medium"
                          />
                        </div>
                      </div>

                      {!adminIsSubscription.value ? (
                        <div class="grid grid-cols-2 gap-4">
                          <div>
                            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hora Inicio</label>
                            <select
                              name="startTime"
                              class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 hover:bg-slate-50 transition-colors text-sm font-medium font-mono"
                              value={adminFormTime.value}
                              onChange$={(_, el) => adminFormTime.value = el.value}
                              required
                            >
                              <option value="">--:-- hs</option>
                              {adminTimeOptions.map(t => <option key={t} value={t}>{`${t} hs`}</option>)}
                            </select>
                          </div>
                          <div>
                            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hora Fin</label>
                            <input type="hidden" name="endTime" value={adminEndTime.value} />
                            <select
                              class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 hover:bg-slate-50 transition-colors text-sm font-medium font-mono"
                              value={adminFormDuration.value}
                              onChange$={(_, el) => adminFormDuration.value = el.value}
                            >
                              <option value="30">30 min</option>
                              <option value="60">1 hora</option>
                              <option value="90">1.5 horas</option>
                              <option value="120">2 horas</option>
                              <option value="150">2.5 horas</option>
                              <option value="180">3 horas</option>
                              <option value="210">3.5 horas</option>
                              <option value="240">4 horas</option>
                            </select>
                          </div>
                        </div>
                      ) : (
                        <>
                          <input type="hidden" name="startTime" value={adminFormTime.value || "18:00"} />
                          <input type="hidden" name="endTime" value={adminEndTime.value || "19:00"} />
                        </>
                      )}

                      <div class="pt-2">
                        <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tipo de Turno</label>
                        <div class="flex gap-4">
                          <label class="flex-1 flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                            <input type="radio" name="isSubscriptionDisplay" checked={!adminIsSubscription.value} onChange$={() => adminIsSubscription.value = false} class="w-4 h-4 accent-blue-600 cursor-pointer" />
                            <span class="text-sm font-bold text-slate-700">Turno Eventual</span>
                          </label>
                          <label class="flex-1 flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                            <input type="radio" name="isSubscriptionDisplay" checked={adminIsSubscription.value} onChange$={() => adminIsSubscription.value = true} class="w-4 h-4 accent-blue-600 cursor-pointer" />
                            <span class="text-sm font-bold text-slate-700">Turno Fijo</span>
                          </label>
                          <input type="hidden" name="isSubscription" value={adminIsSubscription.value ? "true" : "false"} />
                        </div>
                      </div>

                      {adminIsSubscription.value && (
                        <div class="animate-in fade-in slide-in-from-top-2 duration-300 mt-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                          <div>
                            <label class="block text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-2">Días y Horarios</label>
                            <input type="hidden" name="subscriptionSchedules" value={subscriptionSchedulesJSON.value} />
                            <div class="space-y-2">
                              {[{ id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' }, { id: 3, label: 'Miércoles' }, { id: 4, label: 'Jueves' }, { id: 5, label: 'Viernes' }, { id: 6, label: 'Sábado' }, { id: 0, label: 'Domingo' }].map(day => (
                                <div key={day.id} class="flex items-center gap-3 p-3 bg-white border border-blue-200 rounded-xl">
                                  <label class="flex items-center gap-2 cursor-pointer min-w-[100px]">
                                    <input type="checkbox" checked={adminSubDays[day.id].active} onChange$={(_, el) => adminSubDays[day.id].active = el.checked} class="w-4 h-4 accent-blue-600 rounded" />
                                    <span class="text-sm font-bold text-slate-700">{day.label}</span>
                                  </label>

                                  {adminSubDays[day.id].active && (
                                    <div class="flex-1 flex gap-2 animate-in fade-in slide-in-from-left-2">
                                      <select
                                        class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-xs font-medium font-mono"
                                        value={adminSubDays[day.id].startTime || adminFormTime.value || "18:00"}
                                        onChange$={(_, el) => adminSubDays[day.id].startTime = el.value}
                                      >
                                        <option value="">--:-- hs</option>
                                        {adminTimeOptions.map(t => <option key={t} value={t}>{`${t} hs`}</option>)}
                                      </select>
                                      <select
                                        class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-xs font-medium font-mono"
                                        value={adminSubDays[day.id].duration}
                                        onChange$={(_, el) => adminSubDays[day.id].duration = el.value}
                                      >
                                        <option value="30">30 min</option>
                                        <option value="60">1 hora</option>
                                        <option value="90">1.5 horas</option>
                                        <option value="120">2 horas</option>
                                        <option value="150">2.5 horas</option>
                                        <option value="180">3 horas</option>
                                        <option value="210">3.5 horas</option>
                                        <option value="240">4 horas</option>
                                      </select>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label class="block text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-1">Repetir hasta (Fecha final)</label>
                            <input type="date" name="endDate" value={adminEndDate.value} onInput$={(_, el) => adminEndDate.value = el.value} class="w-full px-3 py-2.5 border border-blue-200 rounded-xl bg-white focus:outline-none focus:border-blue-500 text-sm font-semibold text-slate-700" />
                            <p class="text-[11px] text-blue-600/70 mt-2 font-medium leading-tight">La reserva se repetirá los días seleccionados en su horario correspondiente desde el {adminFormDate.value || '-'} hasta la fecha seleccionada. Si se deja vacío, se renovará mensualmente por 1 año.</p>
                          </div>
                        </div>
                      )}

                      {/* Notas */}
                      <div class="pt-2">
                        <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notas Internas</label>
                        <textarea
                          name="notes"
                          value={adminNotes.value}
                          onInput$={(_, el) => adminNotes.value = el.value}
                          placeholder="Sólo será visible por el complejo..."
                          rows={2}
                          class="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white text-sm resize-none"
                        ></textarea>
                      </div>
                    </div>

                    {/* ---------------------------
                        BLOQUE 3: Finanzas y Pagos
                    --------------------------- */}
                    <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm space-y-5 text-white">
                      <h3 class="text-sm font-black text-slate-200 uppercase tracking-widest flex items-center gap-2 mb-2">
                        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Finanzas y Pagos
                      </h3>

                      {calendarData.extraServices.length > 0 && (
                        <div>
                          <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Servicios Extra</label>
                          <div class="flex flex-wrap gap-2">
                            {calendarData.extraServices.map((extra: any) => {
                              const isSelected = adminSelectedExtras.value.includes(extra.name);
                              return (
                                <button
                                  key={extra.name}
                                  type="button"
                                  onClick$={() => {
                                    if (isSelected) {
                                      adminSelectedExtras.value = adminSelectedExtras.value.filter(e => e !== extra.name);
                                    } else {
                                      adminSelectedExtras.value = [...adminSelectedExtras.value, extra.name];
                                    }
                                  }}
                                  class={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
                                    isSelected ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700"
                                  )}
                                >
                                  <span class="text-sm">{extra.icon}</span>
                                  <span>{extra.name} (+${extra.price})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div class="flex items-center justify-between border-b border-slate-700 pb-4">
                        <label class="flex items-center gap-2 cursor-pointer group">
                          <div class="relative">
                            <input type="checkbox" class="sr-only" checked={adminApplyDiscount.value} onChange$={(_, el) => { adminApplyDiscount.value = el.checked; if (!el.checked) adminDiscountAmount.value = 0; }} />
                            <div class={cn("block w-10 h-6 rounded-full transition-colors", adminApplyDiscount.value ? "bg-emerald-500" : "bg-slate-600")}></div>
                            <div class={cn("dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform", adminApplyDiscount.value && "transform translate-x-4")}></div>
                          </div>
                          <span class="text-xs font-bold text-slate-300 uppercase tracking-wider group-hover:text-white transition-colors">Aplicar Descuento</span>
                        </label>

                        <div class="flex items-center gap-3">
                          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Costo Total</div>
                          <div class="text-3xl font-black text-emerald-400">${finalPrice.toLocaleString('es-AR')}</div>
                          <input type="hidden" name="price" value={finalPrice} />
                          <input type="hidden" name="extras" value={JSON.stringify(adminSelectedExtras.value)} />
                        </div>
                      </div>

                      {adminApplyDiscount.value && (
                        <div class="flex gap-4 animate-in fade-in slide-in-from-top-1 duration-300">
                          <div class="flex-1">
                            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Dto.</label>
                            <select
                              value={adminDiscountType.value}
                              onChange$={(_, el) => adminDiscountType.value = el.value as any}
                              class="w-full px-3 py-2.5 border border-slate-600 rounded-xl bg-slate-700 focus:outline-none focus:border-emerald-500 text-sm font-bold text-white transition-all appearance-none"
                            >
                              <option value="FIXED">Monto Fijo ($)</option>
                              <option value="PERCENTAGE">Porcentaje (%)</option>
                            </select>
                          </div>
                          <div class="flex-1">
                            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Valor a descontar</label>
                            <div class="relative">
                              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{adminDiscountType.value === 'FIXED' ? '$' : '%'}</span>
                              <input
                                type="number"
                                value={adminDiscountAmount.value}
                                onInput$={(_, el) => adminDiscountAmount.value = el.value ? Number(el.value) : ""}
                                min="0"
                                placeholder="0"
                                class="w-full pl-8 pr-4 py-2.5 border border-slate-600 rounded-xl bg-slate-700 focus:outline-none focus:border-emerald-500 text-sm font-bold text-white transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div class="grid grid-cols-2 gap-4">
                        <div class="col-span-2 md:col-span-1">
                          <div class="flex items-center justify-between mb-1">
                            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monto Señado</label>
                            <label class="flex items-center gap-1.5 cursor-pointer group">
                              <div class="relative">
                                <input type="checkbox" class="sr-only" checked={adminIsFullPayment.value} onChange$={(_, el) => adminIsFullPayment.value = el.checked} />
                                <div class={cn("block w-6 h-3.5 rounded-full transition-colors", adminIsFullPayment.value ? "bg-emerald-500" : "bg-slate-600")}></div>
                                <div class={cn("dot absolute left-0.5 top-0.5 bg-white w-2.5 h-2.5 rounded-full transition-transform", adminIsFullPayment.value && "transform translate-x-2.5")}></div>
                              </div>
                              <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Pago Total</span>
                            </label>
                          </div>
                          <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-black">$</span>
                            <input
                              type="number"
                              name="paidAmount"
                              value={adminIsFullPayment.value ? finalPrice : adminPaidAmount.value}
                              onInput$={(_, el) => { if (!adminIsFullPayment.value) adminPaidAmount.value = el.value ? Number(el.value) : ""; }}
                              readOnly={adminIsFullPayment.value}
                              placeholder="0"
                              min="0"
                              class={cn("w-full pl-8 pr-4 py-2.5 border border-slate-600 rounded-xl bg-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-black transition-all placeholder:text-slate-500", adminIsFullPayment.value ? "text-emerald-300 bg-slate-800/50 cursor-not-allowed" : "text-emerald-400")}
                            />
                          </div>
                        </div>

                        <div class="col-span-2 md:col-span-1">
                          <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Medio de Pago</label>
                          <select name="paymentMethod" class="w-full px-3 py-2.5 border border-slate-600 rounded-xl bg-slate-700 focus:outline-none focus:border-emerald-500 text-sm font-bold text-white transition-all appearance-none">
                            <option value="CASH">Efectivo</option>
                            <option value="TRANSFER">Transferencia</option>
                            <option value="MERCADO_PAGO">Mercado Pago</option>
                          </select>
                        </div>
                      </div>

                    </div>

                    {createBookingAction.value?.failed && (
                      <div class="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-bold mt-4">
                        {createBookingAction.value.message || "Error al crear la reserva. Verificá los campos."}
                      </div>
                    )}
                    <button type="submit" id="hidden-submit-btn" class="hidden">Submit</button>
                  </Form>
                </div>

                {/* Footer Flotante */}
                <div class="bg-white border-t border-slate-200 p-6 shrink-0 flex justify-end gap-3 z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                  <Button type="button" onClick$={() => isCreateModalOpen.value = false} look="outline" class="font-bold rounded-xl px-6 border-slate-200 text-slate-600 hover:bg-slate-50">Cancelar</Button>
                  <Button type="button" onClick$={() => document.getElementById('hidden-submit-btn')?.click()} look="primary" disabled={createBookingAction.isRunning || !adminFormTime.value || !adminFormDate.value || !adminFormPitchId.value} class="font-bold rounded-xl px-8 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 border-none shadow-md shadow-emerald-600/20">
                    {createBookingAction.isRunning ? "Guardando..." : "Crear Reserva"}
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      </Modal.Panel>
    </Modal.Root>
  );
});
