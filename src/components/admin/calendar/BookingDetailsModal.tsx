import { component$, type Signal, useSignal, useTask$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { Modal, Button } from "~/components/ui";
import { cn } from "@qwik-ui/utils";

interface BookingDetailsModalProps {
  isModalOpen: Signal<boolean>;
  selectedBookingDetails: any;
  calendarData: any;
  addPaymentAction: any;
  updateStatusAction: any;
}

export const BookingDetailsModal = component$<BookingDetailsModalProps>((props) => {
  const { isModalOpen, selectedBookingDetails, calendarData, addPaymentAction, updateStatusAction } = props;

  const showCancelOptions = useSignal(false);
  const selectedCancelOption = useSignal<"RETURN" | "KEEP" | "TRANSFER_NEXT_WEEK" | "TRANSFER_CUSTOM" | "">("");
  const newDate = useSignal("");
  const newStartTime = useSignal("");
  const newEndTime = useSignal("");

  useTask$(({ track }) => {
    track(() => selectedBookingDetails?.booking.id);
    showCancelOptions.value = false;
    selectedCancelOption.value = "";
    newDate.value = "";
    newStartTime.value = "";
    newEndTime.value = "";
  });

  return (
    <Modal.Root bind:show={isModalOpen}>
      <Modal.Panel class="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[95vh] overflow-y-auto p-6 md:p-8">
        {/* Modal Header */}
        <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <div class="flex items-center gap-3">
            <Modal.Title class="text-2xl font-black tracking-tight text-slate-800">Detalles de Reserva</Modal.Title>
            {selectedBookingDetails?.booking && (() => {
              const type = selectedBookingDetails.booking.bookingType || (selectedBookingDetails.booking.isSubscription ? "FIXED" : "EVENTUAL");
              const label = selectedBookingDetails.booking.bookingType === "BIRTHDAY" ? "Cumpleaños" :
                            selectedBookingDetails.booking.bookingType === "SCHOOL" ? "Escuela" :
                            selectedBookingDetails.booking.bookingType === "TOURNAMENT" ? "Torneo" :
                            selectedBookingDetails.booking.bookingType === "FIXED" ? "Fijo" : "Eventual";
              const colors: Record<string, string> = {
                EVENTUAL: "bg-blue-50 text-blue-700 border-blue-200",
                FIXED: "bg-emerald-50 text-emerald-700 border-emerald-200",
                BIRTHDAY: "bg-violet-50 text-violet-700 border-violet-200",
                TOURNAMENT: "bg-pink-50 text-pink-700 border-pink-200",
                SCHOOL: "bg-orange-50 text-orange-700 border-orange-200",
              };
              return (
                <span class={cn("px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full border", colors[type])}>
                  {label}
                </span>
              );
            })()}
          </div>
          <Modal.Close class="text-slate-400 hover:text-slate-800 transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer" style="cursor: pointer !important;">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </Modal.Close>
        </div>

        {selectedBookingDetails ? (
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Info & Financials */}
            <div class="space-y-6">
              {/* Client & Contact Card */}
              <div class="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between h-auto gap-4">
                <div class="space-y-1">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</div>
                  <div class="text-lg font-black text-slate-800 leading-tight">
                    {selectedBookingDetails.guest?.name || selectedBookingDetails.user?.name || "Desconocido"}
                  </div>
                  <div class="flex items-center gap-2 text-sm font-bold text-slate-500 pt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                    {selectedBookingDetails.guest?.phone || selectedBookingDetails.user?.phone || "Sin teléfono"}
                  </div>
                </div>
                <a
                  href={`https://wa.me/${(selectedBookingDetails.guest?.phone || selectedBookingDetails.user?.phone || "").replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="w-full flex items-center justify-center gap-2 py-2 border border-[#25D366]/40 bg-[#25D366]/5 text-[#128C7E] hover:bg-[#25D366]/10 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98]"
                  style="cursor: pointer !important;"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="h-4.5 w-4.5 fill-current"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  Contactar por WhatsApp
                </a>
              </div>

              {/* Cancha & Horario Details */}
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cancha</span>
                  <div>
                    <h4 class="font-black text-slate-800 text-base">
                      {calendarData.pitches.find((p: any) => p.id === selectedBookingDetails.booking.pitchId)?.name || "Cancha"}
                    </h4>
                    <span class="inline-flex items-center px-2 py-0.5 mt-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded uppercase tracking-wider">
                      {calendarData.pitches.find((p: any) => p.id === selectedBookingDetails.booking.pitchId)?.type}
                    </span>
                  </div>
                </div>
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Horario</span>
                  <div>
                    <h4 class="font-black text-slate-800 text-base">
                      {new Date(selectedBookingDetails.booking.startTime).toLocaleDateString("es-AR", { day: 'numeric', month: 'short' })}
                    </h4>
                    <span class="inline-flex items-center mt-1 text-[10px] font-black text-emerald-600 uppercase tracking-wider">
                      {new Date(selectedBookingDetails.booking.startTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })} hs
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Box */}
              <div class="bg-slate-900 p-6 rounded-3xl shadow-xl shadow-slate-900/10 space-y-4 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                </div>
                <div class="flex justify-between border-b border-white/10 pb-4">
                  <div>
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo Total</div>
                    <div class="text-xl font-bold text-white">${Math.round(selectedBookingDetails.booking.totalPrice)}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Abonado</div>
                    <div class="text-xl font-bold text-emerald-400">${Math.round(selectedBookingDetails.booking.paidAmount)}</div>
                  </div>
                </div>
                <div class="pt-4 border-t border-white/10 space-y-3">
                  <div class="flex justify-between items-baseline">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Restante</span>
                    <span class="text-3xl font-black text-white leading-none">
                      ${Math.round(selectedBookingDetails.booking.totalPrice - selectedBookingDetails.booking.paidAmount)}
                    </span>
                  </div>
                  <div class="flex justify-between items-center bg-white/5 px-3.5 py-2.5 rounded-2xl border border-white/5">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado del Pago</span>
                    {(() => {
                      const status = selectedBookingDetails.booking.paymentStatus;
                      return (
                        <span class={cn(
                          "px-2.5 py-0.5 text-[9px] font-black rounded uppercase tracking-wider border whitespace-nowrap inline-flex items-center",
                          status === "PAID" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" :
                          status === "PARTIAL" ? "bg-amber-500/10 text-amber-400 border-amber-500/25" :
                          "bg-red-500/10 text-red-400 border-red-500/25"
                        )}>
                          {status === "PAID" ? "PAGADO" : status === "PARTIAL" ? "SEÑA REGISTRADA" : "PENDIENTE DE PAGO"}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Actions */}
            <div class="space-y-6">
              {/* Rent / Payment Box */}
              {selectedBookingDetails.booking.paymentStatus !== "PAID" && (
                <div class="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 space-y-4">
                  <div class="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Alquiler & Cobros
                  </div>

                  {!calendarData.openRegister ? (
                    <div class="text-xs font-bold text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                      Caja cerrada. Abre la caja para registrar cobros.
                    </div>
                  ) : (
                    <div class="space-y-4">
                      {/* One-Click Fast Rent Button */}
                      <Form action={addPaymentAction}>
                        <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                        <input
                          type="hidden"
                          name="amount"
                          value={selectedBookingDetails.booking.totalPrice - selectedBookingDetails.booking.paidAmount}
                        />
                        <input type="hidden" name="paymentMethod" value="CASH" />
                        <button
                          type="submit"
                          disabled={addPaymentAction.isRunning}
                          class="w-full py-3 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-[#10B981]/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                          style="background-color: #10B981 !important; color: #ffffff !important; cursor: pointer !important;"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="20" height="14" x="2" y="5" rx="2" />
                            <line x1="2" x2="22" y1="10" y2="10" />
                          </svg>
                          Cobrar Total en Efectivo
                        </button>
                      </Form>

                      <div class="relative flex py-2 items-center">
                        <div class="flex-grow border-t border-emerald-200/50"></div>
                        <span class="flex-shrink mx-4 text-[9px] font-black text-emerald-600/50 uppercase tracking-widest">O registrar pago parcial</span>
                        <div class="flex-grow border-t border-emerald-200/50"></div>
                      </div>

                      {/* Custom Payment Form */}
                      <Form action={addPaymentAction} class="space-y-3">
                        <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                        <div class="grid grid-cols-2 gap-3">
                          <div class="relative w-full">
                            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-xs">$</span>
                            <input
                              type="number"
                              name="amount"
                              min="1"
                              max={selectedBookingDetails.booking.totalPrice - selectedBookingDetails.booking.paidAmount}
                              placeholder="Monto"
                              required
                              class="w-full pl-7 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
                            />
                          </div>
                          <select name="paymentMethod" class="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer text-slate-800" style="cursor: pointer !important;">
                            {(calendarData.settings?.paymentMethods || [])
                              .filter((pm: any) => pm.isActive)
                              .map((pm: any) => (
                                <option key={pm.id} value={pm.id}>{pm.name}</option>
                              ))
                            }
                            {(calendarData.settings?.paymentMethods || []).filter((pm: any) => pm.isActive).length === 0 && (
                              <>
                                <option value="CASH">Efectivo</option>
                                <option value="TRANSFER">Transferencia</option>
                                <option value="MERCADO_PAGO">Mercado Pago</option>
                                <option value="CURRENT_ACCOUNT">Cuenta Corriente</option>
                              </>
                            )}
                          </select>
                        </div>
                        <button type="submit" disabled={addPaymentAction.isRunning} class="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98]" style="cursor: pointer !important;">
                          {addPaymentAction.isRunning ? "Registrando..." : "Registrar Pago"}
                        </button>
                      </Form>
                    </div>
                  )}
                </div>
              )}

              {/* Cancellation options if triggered */}
              {showCancelOptions.value && (
                <div class="bg-red-50 p-5 rounded-3xl border border-red-100 space-y-4 animate-in fade-in slide-in-from-top-4">
                  <div class="flex justify-between items-center mb-2">
                    <div class="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2">
                      <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      Anular Reserva
                    </div>
                    <button onClick$={() => showCancelOptions.value = false} class="text-red-400 hover:text-red-600" style="cursor: pointer !important;">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>

                  <p class="text-xs font-bold text-red-900/70 leading-relaxed">
                    Esta reserva tiene una seña de <span class="text-red-600 font-black">${Math.round(selectedBookingDetails.booking.paidAmount)}</span>.
                  </p>

                  <div class="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick$={() => selectedCancelOption.value = "TRANSFER_NEXT_WEEK"}
                      class={cn("flex items-center justify-between p-3 rounded-xl border text-left transition-all", selectedCancelOption.value === "TRANSFER_NEXT_WEEK" ? "bg-white border-red-500 shadow-md ring-1 ring-red-500" : "bg-white/50 border-red-100 hover:border-red-300")}
                      style="cursor: pointer !important;"
                    >
                      <div class="space-y-0.5">
                        <div class="text-[9px] font-black uppercase text-red-700">Traspasar</div>
                        <div class="text-xs font-bold text-red-900">A la siguiente semana (fijo)</div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>

                    <button
                      type="button"
                      onClick$={() => selectedCancelOption.value = "TRANSFER_CUSTOM"}
                      class={cn("flex items-center justify-between p-3 rounded-xl border text-left transition-all", selectedCancelOption.value === "TRANSFER_CUSTOM" ? "bg-white border-red-500 shadow-md ring-1 ring-red-500" : "bg-white/50 border-red-100 hover:border-red-300")}
                      style="cursor: pointer !important;"
                    >
                      <div class="space-y-0.5">
                        <div class="text-[9px] font-black uppercase text-red-700">Traspasar</div>
                        <div class="text-xs font-bold text-red-900">Nueva fecha y hora personalizada</div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>

                    <button
                      type="button"
                      onClick$={() => selectedCancelOption.value = "RETURN"}
                      class={cn("flex items-center justify-between p-3 rounded-xl border text-left transition-all", selectedCancelOption.value === "RETURN" ? "bg-white border-red-500 shadow-md ring-1 ring-red-500" : "bg-white/50 border-red-100 hover:border-red-300")}
                      style="cursor: pointer !important;"
                    >
                      <div class="space-y-0.5">
                        <div class="text-[9px] font-black uppercase text-red-700">Devolver Seña</div>
                        <div class="text-xs font-bold text-red-900">Se reintegra al cliente</div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>

                    <button
                      type="button"
                      onClick$={() => selectedCancelOption.value = "KEEP"}
                      class={cn("flex items-center justify-between p-3 rounded-xl border text-left transition-all", selectedCancelOption.value === "KEEP" ? "bg-white border-red-500 shadow-md ring-1 ring-red-500" : "bg-white/50 border-red-100 hover:border-red-300")}
                      style="cursor: pointer !important;"
                    >
                      <div class="space-y-0.5">
                        <div class="text-[9px] font-black uppercase text-red-700">Retener Seña</div>
                        <div class="text-xs font-bold text-red-900">El cliente pierde la seña</div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>

                  {selectedCancelOption.value === "TRANSFER_CUSTOM" && (
                    <div class="space-y-3 pt-2 bg-white/40 p-4 rounded-xl border border-red-100">
                      <div class="grid grid-cols-1 gap-3">
                        <div class="space-y-1">
                          <label class="text-[10px] font-black uppercase text-red-700 ml-1">Nueva Fecha</label>
                          <input
                            type="date"
                            bind:value={newDate}
                            class="w-full px-3 py-2.5 rounded-xl border border-red-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20"
                          />
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                          <div class="space-y-1">
                             <label class="text-[10px] font-black uppercase text-red-700 ml-1">Hora Inicio</label>
                             <input
                               type="time"
                               bind:value={newStartTime}
                               class="w-full px-3 py-2.5 rounded-xl border border-red-200 text-xs font-black focus:outline-none focus:ring-2 focus:ring-red-500/20"
                             />
                          </div>
                          <div class="space-y-1">
                             <label class="text-[10px] font-black uppercase text-red-700 ml-1">Hora Fin</label>
                             <input
                               type="time"
                               bind:value={newEndTime}
                               class="w-full px-3 py-2.5 rounded-xl border border-red-200 text-xs font-black focus:outline-none focus:ring-2 focus:ring-red-500/20"
                             />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedCancelOption.value === "RETURN" && !calendarData.openRegister && (
                    <div class="text-[10px] font-bold text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                      Caja cerrada. Abre la caja para devolver la seña.
                    </div>
                  )}

                  <Form action={updateStatusAction} class="pt-2">
                     <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                     <input type="hidden" name="status" value={selectedCancelOption.value.startsWith("TRANSFER") ? "CONFIRMED" : "CANCELLED"} />
                     <input type="hidden" name="cancellationOption" value={selectedCancelOption.value} />
                     {selectedCancelOption.value === "TRANSFER_CUSTOM" && (
                       <>
                          <input type="hidden" name="newDate" value={newDate.value} />
                          <input type="hidden" name="newStartTime" value={newStartTime.value} />
                          <input type="hidden" name="newEndTime" value={newEndTime.value} />
                       </>
                     )}
                     <button
                       type="submit"
                       disabled={!selectedCancelOption.value || (selectedCancelOption.value === "RETURN" && !calendarData.openRegister) || updateStatusAction.isRunning}
                       class="w-full py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
                       style="cursor: pointer !important;"
                     >
                       {updateStatusAction.isRunning ? "Procesando..." : "Confirmar Acción"}
                     </button>
                  </Form>
                </div>
              )}

              {/* Status & Operations Center */}
              <div class="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Gestión de Estado</span>
                  {(() => {
                    const status = selectedBookingDetails.booking.status;
                    return (
                      <span class={cn(
                        "px-2 py-0.5 text-[9px] font-black rounded-full border",
                        status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                        status === "COMPLETED" ? "bg-slate-200 text-slate-800 border-slate-300" :
                        status === "CANCELLED" ? "bg-red-100 text-red-800 border-red-200" :
                        "bg-amber-100 text-amber-800 border-amber-200"
                      )}>
                        {status === "CONFIRMED" ? "Confirmada" : status === "COMPLETED" ? "Finalizada" : status === "CANCELLED" ? "Anulada" : "Pendiente"}
                      </span>
                    );
                  })()}
                </div>

                <div class="flex flex-col gap-2">
                  {/* Confirm Action */}
                  {selectedBookingDetails.booking.status === "PENDING_APPROVAL" && (
                    <Form action={updateStatusAction} class="w-full">
                      <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                      <input type="hidden" name="status" value="CONFIRMED" />
                      <button
                        type="submit"
                        disabled={updateStatusAction.isRunning}
                        class="w-full py-3.5 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
                        style="background-color: #10B981 !important; color: #ffffff !important; cursor: pointer !important;"
                      >
                        {updateStatusAction.isRunning ? (
                          <>
                            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Confirmando...
                          </>
                        ) : (
                          "Confirmar Reserva"
                        )}
                      </button>
                    </Form>
                  )}

                  {/* Complete Action */}
                  {selectedBookingDetails.booking.status === "CONFIRMED" && (
                    <Form action={updateStatusAction} class="w-full">
                      <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                      <input type="hidden" name="status" value="COMPLETED" />
                      <button
                        type="submit"
                        disabled={updateStatusAction.isRunning}
                        class="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-slate-800/10 flex items-center justify-center gap-2"
                        style="cursor: pointer !important;"
                      >
                        {updateStatusAction.isRunning ? (
                          <>
                            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Finalizando...
                          </>
                        ) : (
                          "Finalizar Turno"
                        )}
                      </button>
                    </Form>
                  )}

                  {/* Cancel/Anular Action */}
                  {selectedBookingDetails.booking.status !== "CANCELLED" && selectedBookingDetails.booking.status !== "COMPLETED" && (
                    <div class="w-full">
                      {selectedBookingDetails.booking.paidAmount > 0 ? (
                        <button
                          type="button"
                          onClick$={() => showCancelOptions.value = true}
                          class="w-full py-3 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                          style="cursor: pointer !important;"
                        >
                          Anular Reserva
                        </button>
                      ) : (
                        <Form action={updateStatusAction} class="w-full">
                          <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                          <input type="hidden" name="status" value="CANCELLED" />
                          <button
                            type="submit"
                            disabled={updateStatusAction.isRunning}
                            class="w-full py-3 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            style="cursor: pointer !important;"
                          >
                            {updateStatusAction.isRunning ? (
                              <>
                                <svg class="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Anulando...
                              </>
                            ) : (
                              "Anular Reserva"
                            )}
                          </button>
                        </Form>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <Button
                look="secondary"
                onClick$={() => isModalOpen.value = false}
                class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest transition-all border-none"
                style="cursor: pointer !important;"
              >
                Cerrar Panel
              </Button>
            </div>
          </div>
        ) : (
          <div class="py-20 text-center space-y-4">
            <div class="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div class="text-sm font-black text-slate-400 uppercase tracking-widest">Cargando detalles...</div>
          </div>
        )}
      </Modal.Panel>
    </Modal.Root>
  );
});
