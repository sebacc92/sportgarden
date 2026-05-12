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
      <Modal.Panel class="bg-white border border-slate-200 rounded-3xl max-w-lg w-full">
        <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <Modal.Title class="text-xl font-black tracking-tight text-slate-800">Detalles de Reserva</Modal.Title>
          <Modal.Close class="text-slate-400 hover:text-slate-800 transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </Modal.Close>
        </div>

        {selectedBookingDetails ? (
          <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</div>
                <div class="font-bold text-slate-800">
                  {selectedBookingDetails.guest?.name || selectedBookingDetails.user?.name || "Desconocido"}
                </div>
                <div class="text-xs text-slate-500 mt-1">
                  {selectedBookingDetails.guest?.phone || selectedBookingDetails.user?.phone || "Sin teléfono"}
                </div>
              </div>
              <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cancha</div>
                <div class="font-bold text-slate-800">
                  {calendarData.pitches.find((p: any) => p.id === selectedBookingDetails.booking.pitchId)?.name || "Cancha"}
                </div>
                <div class="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded inline-block mt-1">
                  {calendarData.pitches.find((p: any) => p.id === selectedBookingDetails.booking.pitchId)?.type}
                </div>
              </div>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
              <div>
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Horario</div>
                <div class="font-bold text-slate-800">
                  {new Date(selectedBookingDetails.booking.startTime).toLocaleDateString("es-AR")}
                </div>
                <div class="text-sm font-semibold text-emerald-600">
                  {new Date(selectedBookingDetails.booking.startTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })} -
                  {new Date(selectedBookingDetails.booking.endTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </div>
              </div>
              <div class="text-right">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado</div>
                <div class={cn(
                  "font-bold text-sm px-2 py-1 rounded",
                  selectedBookingDetails.booking.status === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-800" :
                    selectedBookingDetails.booking.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" :
                      selectedBookingDetails.booking.status === "COMPLETED" ? "bg-slate-200 text-slate-800" :
                        "bg-red-100 text-red-800"
                )}>
                  {selectedBookingDetails.booking.status === "PENDING_APPROVAL" ? "Por confirmar" :
                    selectedBookingDetails.booking.status === "CONFIRMED" ? "Confirmado" :
                      selectedBookingDetails.booking.status === "COMPLETED" ? "Completado" : "Cancelado"}
                </div>
              </div>
            </div>

            <div class="border-t border-slate-100 pt-4 pb-2">
              <div class="flex justify-between items-end mb-2">
                <div class="text-sm font-bold text-slate-600">Total</div>
                <div class="text-2xl font-black text-slate-800">${selectedBookingDetails.booking.totalPrice}</div>
              </div>
              <div class="flex justify-between items-end">
                <div class="text-sm font-bold text-slate-600">Abonado ({selectedBookingDetails.booking.paymentStatus})</div>
                <div class="text-lg font-black text-emerald-600">${selectedBookingDetails.booking.paidAmount}</div>
              </div>
            </div>

            {selectedBookingDetails.booking.paymentStatus !== "PAID" && (
              <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mt-4">
                <div class="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">Registrar Pago Adicional</div>
                {!calendarData.openRegister ? (
                  <div class="text-xs font-bold text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    Caja cerrada. Abre la caja para cobrar.
                  </div>
                ) : (
                  <Form action={addPaymentAction} class="space-y-3">
                  <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                  <div class="flex gap-2">
                    <div class="flex-1 relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                      <input type="number" name="amount" min="1" max={selectedBookingDetails.booking.totalPrice - selectedBookingDetails.booking.paidAmount} placeholder="Monto" required class="w-full pl-7 pr-3 py-2 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
                    </div>
                    <select name="paymentMethod" class="flex-1 px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-white">
                      <option value="CASH">Efectivo</option>
                      <option value="TRANSFER">Transferencia</option>
                      <option value="MERCADO_PAGO">Mercado Pago</option>
                    </select>
                  </div>
                  {addPaymentAction.value?.failed && (
                    <div class="text-xs font-bold text-red-600 bg-red-50 p-2 rounded border border-red-200">
                      {addPaymentAction.value.message}
                    </div>
                  )}
                  <button type="submit" disabled={addPaymentAction.isRunning} class="w-full py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm">
                    {addPaymentAction.isRunning ? "Registrando..." : "Registrar Pago en Caja"}
                  </button>
                </Form>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div class="border-t border-slate-100 pt-6">
              {updateStatusAction.value?.failed && (
                <Alert.Root look="alert" class="bg-red-50 border-red-200 text-red-600 rounded-lg mb-4">
                  <Alert.Description>Ocurrió un error al actualizar.</Alert.Description>
                </Alert.Root>
              )}

              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cambiar Estado</div>
              <div class="flex flex-wrap gap-2 mb-4">
                {[
                  { value: "CONFIRMED", label: "Confirmado", color: "emerald" },
                  { value: "PENDING_APPROVAL", label: "Pendiente", color: "amber" },
                  { value: "CANCELLED", label: "Cancelado", color: "red" },
                  { value: "COMPLETED", label: "Completado", color: "slate" },
                ].map((s) => {
                  const isCurrent = selectedBookingDetails.booking.status === s.value;
                  let btnClass = "px-4 py-2 rounded-full text-xs font-bold transition-colors border flex items-center gap-2 ";
                  
                  if (s.color === "emerald") {
                    btnClass += isCurrent ? "bg-emerald-500 text-white border-emerald-600" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
                  } else if (s.color === "amber") {
                    btnClass += isCurrent ? "bg-amber-500 text-white border-amber-600" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100";
                  } else if (s.color === "red") {
                    btnClass += isCurrent ? "bg-red-500 text-white border-red-600" : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
                  } else if (s.color === "slate") {
                    btnClass += isCurrent ? "bg-slate-700 text-white border-slate-800" : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200";
                  }

                  return (
                    <Form action={updateStatusAction} key={s.value}>
                      <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                      <input type="hidden" name="status" value={s.value} />
                      <button type="submit" disabled={isCurrent || updateStatusAction.isRunning} class={btnClass + (isCurrent || updateStatusAction.isRunning ? " opacity-80 cursor-default" : "")}>
                        <span class={`w-2 h-2 rounded-full ${isCurrent ? 'bg-white' : (s.color === 'emerald' ? 'bg-emerald-500' : s.color === 'amber' ? 'bg-amber-500' : s.color === 'red' ? 'bg-red-500' : 'bg-slate-500')}`}></span>
                        {s.label}
                      </button>
                    </Form>
                  );
                })}
              </div>
              <Button look="secondary" onClick$={() => isModalOpen.value = false} class="w-full py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold">
                Cerrar Detalles
              </Button>
            </div>
          </div>
        ) : (
          <div class="py-12 text-center text-slate-500">Cargando detalles...</div>
        )}
      </Modal.Panel>
    </Modal.Root>
  );
});
