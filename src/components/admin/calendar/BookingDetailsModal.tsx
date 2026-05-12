import { component$, type Signal } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { Modal, Button } from "~/components/ui";
import { Alert } from "~/components/ui/alert/alert";
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

  return (
    <Modal.Root bind:show={isModalOpen}>
      <Modal.Panel class="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[95vh] overflow-y-auto p-6">
        <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <Modal.Title class="text-xl font-black tracking-tight text-slate-800">Detalles de Reserva</Modal.Title>
          <Modal.Close class="text-slate-400 hover:text-slate-800 transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </Modal.Close>
        </div>

        {selectedBookingDetails ? (
          <div class="space-y-6">
            {/* Header: Client & WhatsApp */}
            <div class="flex items-start justify-between bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <div class="space-y-1">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</div>
                <div class="text-xl font-black text-slate-800">
                  {selectedBookingDetails.guest?.name || selectedBookingDetails.user?.name || "Desconocido"}
                </div>
                <div class="flex items-center gap-2 text-sm font-bold text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  {selectedBookingDetails.guest?.phone || selectedBookingDetails.user?.phone || "Sin teléfono"}
                </div>
              </div>
              <a 
                href={`https://wa.me/${(selectedBookingDetails.guest?.phone || selectedBookingDetails.user?.phone || "").replace(/\D/g, "")}`}
                target="_blank"
                class="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12A10 10 0 1 1 12 2a10 10 0 0 1 10 10Z"/><path d="M17 12a5 5 0 0 0-5-5"/><path d="M12 17a5 5 0 0 0 5-5"/></svg>
                WhatsApp
              </a>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cancha</div>
                <div class="font-bold text-slate-800">
                  {calendarData.pitches.find((p: any) => p.id === selectedBookingDetails.booking.pitchId)?.name || "Cancha"}
                </div>
                <div class="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded inline-block mt-1 uppercase tracking-widest">
                  {calendarData.pitches.find((p: any) => p.id === selectedBookingDetails.booking.pitchId)?.type}
                </div>
              </div>
              <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Horario</div>
                <div class="font-bold text-slate-800">
                  {new Date(selectedBookingDetails.booking.startTime).toLocaleDateString("es-AR", { day: 'numeric', month: 'short' })}
                </div>
                <div class="text-xs font-black text-emerald-600 uppercase tracking-widest mt-1">
                  {new Date(selectedBookingDetails.booking.startTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })} -
                  {new Date(selectedBookingDetails.booking.endTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </div>
              </div>
            </div>

            {/* Bloque Financiero */}
            <div class="bg-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-900/20 space-y-4 relative overflow-hidden">
              <div class="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
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
              <div class="flex justify-between items-center pt-2">
                <div class="text-[11px] font-black text-white uppercase tracking-[0.2em]">Saldo Restante</div>
                <div class="text-3xl font-black text-white bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/20">
                  ${Math.round(selectedBookingDetails.booking.totalPrice - selectedBookingDetails.booking.paidAmount)}
                </div>
              </div>
            </div>

            {selectedBookingDetails.booking.paymentStatus !== "PAID" && (
              <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
                <div class="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Registrar Pago Adicional
                </div>
                {!calendarData.openRegister ? (
                  <div class="text-xs font-bold text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    Caja cerrada. Abre la caja para cobrar.
                  </div>
                ) : (
                  <Form action={addPaymentAction} class="space-y-4">
                    <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                    <div class="flex gap-3">
                      <div class="flex-1 relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                        <input 
                          type="number" 
                          name="amount" 
                          min="1" 
                          max={selectedBookingDetails.booking.totalPrice - selectedBookingDetails.booking.paidAmount} 
                          placeholder="Monto" 
                          required 
                          class="w-full pl-8 pr-4 py-3 bg-white border border-emerald-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                        />
                      </div>
                      <select name="paymentMethod" class="flex-1 px-4 py-3 bg-white border border-emerald-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none">
                        <option value="CASH">Efectivo</option>
                        <option value="TRANSFER">Transferencia</option>
                        <option value="MERCADO_PAGO">Mercado Pago</option>
                        <option value="CURRENT_ACCOUNT">Cuenta Corriente</option>
                      </select>
                    </div>
                    <button type="submit" disabled={addPaymentAction.isRunning} class="w-full py-3 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                      {addPaymentAction.isRunning ? "Registrando..." : "Confirmar Pago en Caja"}
                    </button>
                  </Form>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div class="space-y-4 pt-4 border-t border-slate-100">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestión de Reserva</div>
              <div class="flex flex-wrap gap-2">
                {[
                  { value: "CONFIRMED", label: "Confirmar", color: "emerald" },
                  { value: "CANCELLED", label: "Anular Reserva", color: "red" },
                  { value: "COMPLETED", label: "Finalizar", color: "slate" },
                ].map((s) => {
                  const isCurrent = selectedBookingDetails.booking.status === s.value;
                  if (isCurrent && s.value !== "CANCELLED") return null;
                  
                  return (
                    <Form action={updateStatusAction} key={s.value} class="flex-1 min-w-[140px]">
                      <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                      <input type="hidden" name="status" value={s.value} />
                      <button 
                        type="submit" 
                        disabled={updateStatusAction.isRunning} 
                        class={cn(
                          "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                          s.color === "emerald" ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-500 hover:text-white" :
                          s.color === "red" ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-500 hover:text-white" :
                          "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-700 hover:text-white"
                        )}
                      >
                        {s.label}
                      </button>
                    </Form>
                  );
                })}
              </div>
              <Button look="secondary" onClick$={() => isModalOpen.value = false} class="w-full py-3 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
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
