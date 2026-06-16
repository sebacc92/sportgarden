import { component$, type Signal, useSignal, useTask$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { Modal, Button } from "~/components/ui";
import { cn } from "@qwik-ui/utils";

function buildWhatsAppUrl(phone: string, message?: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("549") && digits.length >= 12) {
    // already correct international format
  } else if (digits.startsWith("54")) {
    digits = "549" + digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = "549" + digits.slice(1);
  } else {
    digits = "549" + digits;
  }
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

interface BookingDetailsModalProps {
  isModalOpen: Signal<boolean>;
  selectedBookingDetails: any;
  calendarData: any;
  addPaymentAction: any;
  updateStatusAction: any;
  confirmAttendanceAction: any;
}

export const BookingDetailsModal = component$<BookingDetailsModalProps>(
  (props) => {
    const {
      isModalOpen,
      selectedBookingDetails,
      calendarData,
      addPaymentAction,
      updateStatusAction,
      confirmAttendanceAction,
    } = props;

    const showCancelOptions = useSignal(false);
    const selectedCancelOption = useSignal<
      "RETURN" | "KEEP" | "TRANSFER_NEXT_WEEK" | "TRANSFER_CUSTOM" | ""
    >("");
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
        <Modal.Panel class="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          {/* Modal Header */}
          <div class="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div class="flex items-center gap-3">
              <Modal.Title class="text-2xl font-black tracking-tight text-slate-800">
                Detalles de Reserva
              </Modal.Title>
              {selectedBookingDetails?.booking &&
                (() => {
                  const type =
                    selectedBookingDetails.booking.bookingType ||
                    (selectedBookingDetails.booking.isSubscription
                      ? "FIXED"
                      : "EVENTUAL");
                  const label =
                    selectedBookingDetails.booking.bookingType === "BIRTHDAY"
                      ? "Cumpleaños"
                      : selectedBookingDetails.booking.bookingType === "SCHOOL"
                        ? "Escuela"
                        : selectedBookingDetails.booking.bookingType ===
                            "TOURNAMENT"
                          ? "Torneo"
                          : selectedBookingDetails.booking.bookingType ===
                              "FIXED"
                            ? "Fijo"
                            : "Eventual";
                  const colors: Record<string, string> = {
                    EVENTUAL: "bg-blue-50 text-blue-700 border-blue-200",
                    FIXED: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    BIRTHDAY: "bg-violet-50 text-violet-700 border-violet-200",
                    TOURNAMENT: "bg-pink-50 text-pink-700 border-pink-200",
                    SCHOOL: "bg-orange-50 text-orange-700 border-orange-200",
                  };
                  return (
                    <span
                      class={cn(
                        "rounded-full border px-3 py-1 text-xs font-black tracking-wider uppercase",
                        colors[type],
                      )}
                    >
                      {label}
                    </span>
                  );
                })()}
              {String(selectedBookingDetails?.booking?.notes || "").startsWith(
                "subscription:",
              ) && (
                <a
                  href="/admin/subscriptions/"
                  class="text-xs font-bold text-emerald-600 hover:underline"
                >
                  Ver abono →
                </a>
              )}
            </div>
            <Modal.Close
              class="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-800"
              style="cursor: pointer !important;"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Modal.Close>
          </div>

          {selectedBookingDetails ? (
            <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
              {/* Left Column: Info & Financials */}
              <div class="space-y-6">
                {/* Client & Contact Card */}
                <div class="flex h-auto flex-col justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                  <div class="space-y-1">
                    <div class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Cliente
                    </div>
                    <div class="text-lg leading-tight font-black text-slate-800">
                      {selectedBookingDetails.guest?.name ||
                        selectedBookingDetails.user?.name ||
                        "Desconocido"}
                    </div>
                    <div class="flex items-center gap-2 pt-1 text-sm font-bold text-slate-500">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 text-slate-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {selectedBookingDetails.guest?.phone ||
                        selectedBookingDetails.user?.phone ||
                        "Sin teléfono"}
                    </div>
                  </div>
                  {(() => {
                    const phone = selectedBookingDetails.guest?.phone || selectedBookingDetails.user?.phone || "";
                    const name = selectedBookingDetails.guest?.name || selectedBookingDetails.user?.name || "";
                    const pitchName = calendarData.pitches.find((p: any) => p.id === selectedBookingDetails.booking.pitchId)?.name || "la cancha";
                    const startIso = selectedBookingDetails.booking.startTime;
                    const msg = phone
                      ? `Hola ${name}! Te escribimos desde Garden Club en relación a tu reserva del ${fmtDate(startIso)} a las ${fmtTime(startIso)} en ${pitchName}.`
                      : "";
                    const href = phone ? buildWhatsAppUrl(phone, msg) : "#";
                    return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    class={cn(
                      "flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/5 py-2 text-xs font-bold tracking-wider text-[#128C7E] uppercase transition-all hover:bg-[#25D366]/10 active:scale-[0.98]",
                      !phone && "pointer-events-none opacity-40",
                    )}
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
                    );
                  })()}
                </div>

                {/* Cancha & Horario Details */}
                <div class="grid grid-cols-2 gap-4">
                  <div class="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span class="mb-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Cancha
                    </span>
                    <div>
                      <h4 class="text-base font-black text-slate-800">
                        {calendarData.pitches.find(
                          (p: any) =>
                            p.id === selectedBookingDetails.booking.pitchId,
                        )?.name || "Cancha"}
                      </h4>
                      <span class="mt-1 inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black tracking-wider text-emerald-800 uppercase">
                        {
                          calendarData.pitches.find(
                            (p: any) =>
                              p.id === selectedBookingDetails.booking.pitchId,
                          )?.type
                        }
                      </span>
                    </div>
                  </div>
                  <div class="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span class="mb-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Horario
                    </span>
                    <div>
                      <h4 class="text-base font-black text-slate-800">
                        {new Date(selectedBookingDetails.booking.startTime).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                          timeZone: "America/Argentina/Buenos_Aires",
                        })}
                      </h4>
                      <span class="mt-1 inline-flex items-center gap-1 text-[10px] font-black tracking-wider text-emerald-600 uppercase">
                        {fmtTime(selectedBookingDetails.booking.startTime)}
                        {selectedBookingDetails.booking.endTime && (
                          <> → {fmtTime(selectedBookingDetails.booking.endTime)}</>
                        )}
                        {" hs"}
                      </span>
                      {selectedBookingDetails.booking.endTime && (() => {
                        const mins = Math.round(
                          (new Date(selectedBookingDetails.booking.endTime).getTime() -
                            new Date(selectedBookingDetails.booking.startTime).getTime()) / 60000
                        );
                        const h = Math.floor(mins / 60);
                        const m = mins % 60;
                        return (
                          <span class="mt-0.5 block text-[9px] font-bold text-slate-400">
                            {h > 0 ? `${h}h` : ""}{m > 0 ? ` ${m}min` : ""}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Financial Box */}
                <div class="relative space-y-4 overflow-hidden rounded-3xl bg-slate-900 p-6 shadow-xl shadow-slate-900/10">
                  <div class="pointer-events-none absolute top-0 right-0 p-8 opacity-5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="120"
                      height="120"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      stroke-width="1"
                    >
                      <path d="M12 2v20" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <div class="flex justify-between border-b border-white/10 pb-4">
                    <div>
                      <div class="mb-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                        Costo Total
                      </div>
                      <div class="text-xl font-bold text-white">
                        ${Math.round(selectedBookingDetails.booking.totalPrice)}
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="mb-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                        Abonado
                      </div>
                      <div class="text-xl font-bold text-emerald-400">
                        ${Math.round(selectedBookingDetails.booking.paidAmount)}
                      </div>
                    </div>
                  </div>
                  {/* Extras breakdown */}
                  {Array.isArray(selectedBookingDetails.booking.extras) &&
                    selectedBookingDetails.booking.extras.length > 0 && (
                      <div class="space-y-1.5 border-b border-white/10 py-3">
                        <div class="mb-2 text-[9px] font-black tracking-widest text-slate-400 uppercase">
                          Servicios Adicionales
                        </div>
                        {selectedBookingDetails.booking.extras.map((extra: any) => (
                          <div key={extra.name} class="flex justify-between text-xs">
                            <span class="text-slate-300">{extra.name}</span>
                            <span class="font-bold text-white">+${Math.round(Number(extra.price))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  <div class="space-y-3 border-t border-white/10 pt-4">
                    <div class="flex items-baseline justify-between">
                      <span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                        Saldo Restante
                      </span>
                      <span class="text-3xl leading-none font-black text-white">
                        $
                        {Math.round(
                          selectedBookingDetails.booking.totalPrice -
                            selectedBookingDetails.booking.paidAmount,
                        )}
                      </span>
                    </div>
                    <div class="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-3.5 py-2.5">
                      <span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                        Estado del Pago
                      </span>
                      {(() => {
                        const status =
                          selectedBookingDetails.booking.paymentStatus;
                        return (
                          <span
                            class={cn(
                              "inline-flex items-center rounded border px-2.5 py-0.5 text-[9px] font-black tracking-wider whitespace-nowrap uppercase",
                              status === "PAID"
                                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                                : status === "PARTIAL"
                                  ? "border-amber-500/25 bg-amber-500/10 text-amber-400"
                                  : "border-red-500/25 bg-red-500/10 text-red-400",
                            )}
                          >
                            {status === "PAID"
                              ? "PAGADO"
                              : status === "PARTIAL"
                                ? "SEÑA REGISTRADA"
                                : "PENDIENTE DE PAGO"}
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
                  <div class="space-y-4 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-6">
                    <div class="flex items-center gap-2 text-[10px] font-black tracking-widest text-emerald-600 uppercase">
                      <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      Alquiler & Cobros
                    </div>

                    {!calendarData.openRegister ? (
                      <div class="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-700">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
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
                        Caja cerrada. Abre la caja para registrar cobros.
                      </div>
                    ) : (
                      <div class="space-y-4">
                        {/* One-Click Fast Rent Button */}
                        <Form action={addPaymentAction}>
                          <input
                            type="hidden"
                            name="bookingId"
                            value={selectedBookingDetails.booking.id}
                          />
                          <input
                            type="hidden"
                            name="amount"
                            value={
                              selectedBookingDetails.booking.totalPrice -
                              selectedBookingDetails.booking.paidAmount
                            }
                          />
                          <input
                            type="hidden"
                            name="paymentMethod"
                            value="CASH"
                          />
                          <button
                            type="submit"
                            disabled={addPaymentAction.isRunning}
                            class="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold tracking-wider text-white uppercase shadow-md shadow-[#10B981]/20 transition-all active:scale-[0.98]"
                            style="background-color: #10B981 !important; color: #ffffff !important; cursor: pointer !important;"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-4.5 w-4.5 shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <rect width="20" height="14" x="2" y="5" rx="2" />
                              <line x1="2" x2="22" y1="10" y2="10" />
                            </svg>
                            Cobrar Total en Efectivo
                          </button>
                        </Form>

                        <div class="relative flex items-center py-2">
                          <div class="flex-grow border-t border-emerald-200/50"></div>
                          <span class="mx-4 flex-shrink text-[9px] font-black tracking-widest text-emerald-600/50 uppercase">
                            O registrar pago parcial
                          </span>
                          <div class="flex-grow border-t border-emerald-200/50"></div>
                        </div>

                        {/* Custom Payment Form */}
                        <Form action={addPaymentAction} class="space-y-3">
                          <input
                            type="hidden"
                            name="bookingId"
                            value={selectedBookingDetails.booking.id}
                          />
                          <div class="grid grid-cols-2 gap-3">
                            <div class="relative w-full">
                              <span class="absolute top-1/2 left-3.5 -translate-y-1/2 text-xs font-extrabold text-slate-400">
                                $
                              </span>
                              <input
                                type="number"
                                name="amount"
                                min="1"
                                max={
                                  selectedBookingDetails.booking.totalPrice -
                                  selectedBookingDetails.booking.paidAmount
                                }
                                placeholder="Monto"
                                required
                                class="w-full rounded-xl border border-slate-200 bg-white py-3 pr-3 pl-7 text-sm font-bold text-slate-800 transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                              />
                            </div>
                            <select
                              name="paymentMethod"
                              class="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800 transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                              style="cursor: pointer !important;"
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
                          </div>
                          <button
                            type="submit"
                            disabled={addPaymentAction.isRunning}
                            class="w-full rounded-xl bg-slate-800 py-3.5 text-xs font-bold tracking-widest text-white uppercase transition-all hover:bg-slate-900 active:scale-[0.98]"
                            style="cursor: pointer !important;"
                          >
                            {addPaymentAction.isRunning
                              ? "Registrando..."
                              : "Registrar Pago"}
                          </button>
                        </Form>
                      </div>
                    )}
                  </div>
                )}

                {/* Cancellation options if triggered */}
                {showCancelOptions.value && (
                  <div class="animate-in fade-in slide-in-from-top-4 space-y-4 rounded-3xl border border-red-100 bg-red-50 p-5">
                    <div class="mb-2 flex items-center justify-between">
                      <div class="flex items-center gap-2 text-[10px] font-black tracking-widest text-red-600 uppercase">
                        <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                        Anular Reserva
                      </div>
                      <button
                        onClick$={() => (showCancelOptions.value = false)}
                        class="text-red-400 hover:text-red-600"
                        style="cursor: pointer !important;"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>

                    <p class="text-xs leading-relaxed font-bold text-red-900/70">
                      Esta reserva tiene una seña de{" "}
                      <span class="font-black text-red-600">
                        ${Math.round(selectedBookingDetails.booking.paidAmount)}
                      </span>
                      .
                    </p>

                    <div class="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick$={() =>
                          (selectedCancelOption.value = "TRANSFER_NEXT_WEEK")
                        }
                        class={cn(
                          "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                          selectedCancelOption.value === "TRANSFER_NEXT_WEEK"
                            ? "border-red-500 bg-white shadow-md ring-1 ring-red-500"
                            : "border-red-100 bg-white/50 hover:border-red-300",
                        )}
                        style="cursor: pointer !important;"
                      >
                        <div class="space-y-0.5">
                          <div class="text-[9px] font-black text-red-700 uppercase">
                            Traspasar
                          </div>
                          <div class="text-xs font-bold text-red-900">
                            A la siguiente semana (fijo)
                          </div>
                        </div>
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
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick$={() =>
                          (selectedCancelOption.value = "TRANSFER_CUSTOM")
                        }
                        class={cn(
                          "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                          selectedCancelOption.value === "TRANSFER_CUSTOM"
                            ? "border-red-500 bg-white shadow-md ring-1 ring-red-500"
                            : "border-red-100 bg-white/50 hover:border-red-300",
                        )}
                        style="cursor: pointer !important;"
                      >
                        <div class="space-y-0.5">
                          <div class="text-[9px] font-black text-red-700 uppercase">
                            Traspasar
                          </div>
                          <div class="text-xs font-bold text-red-900">
                            Nueva fecha y hora personalizada
                          </div>
                        </div>
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
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick$={() => (selectedCancelOption.value = "RETURN")}
                        class={cn(
                          "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                          selectedCancelOption.value === "RETURN"
                            ? "border-red-500 bg-white shadow-md ring-1 ring-red-500"
                            : "border-red-100 bg-white/50 hover:border-red-300",
                        )}
                        style="cursor: pointer !important;"
                      >
                        <div class="space-y-0.5">
                          <div class="text-[9px] font-black text-red-700 uppercase">
                            Devolver Seña
                          </div>
                          <div class="text-xs font-bold text-red-900">
                            Se reintegra al cliente
                          </div>
                        </div>
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
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick$={() => (selectedCancelOption.value = "KEEP")}
                        class={cn(
                          "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                          selectedCancelOption.value === "KEEP"
                            ? "border-red-500 bg-white shadow-md ring-1 ring-red-500"
                            : "border-red-100 bg-white/50 hover:border-red-300",
                        )}
                        style="cursor: pointer !important;"
                      >
                        <div class="space-y-0.5">
                          <div class="text-[9px] font-black text-red-700 uppercase">
                            Retener Seña
                          </div>
                          <div class="text-xs font-bold text-red-900">
                            El cliente pierde la seña
                          </div>
                        </div>
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
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    </div>

                    {selectedCancelOption.value === "TRANSFER_CUSTOM" && (
                      <div class="space-y-3 rounded-xl border border-red-100 bg-white/40 p-4 pt-2">
                        <div class="grid grid-cols-1 gap-3">
                          <div class="space-y-1">
                            <label class="ml-1 text-[10px] font-black text-red-700 uppercase">
                              Nueva Fecha
                            </label>
                            <input
                              type="date"
                              bind:value={newDate}
                              class="w-full rounded-xl border border-red-200 px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                            />
                          </div>
                          <div class="grid grid-cols-2 gap-2">
                            <div class="space-y-1">
                              <label class="ml-1 text-[10px] font-black text-red-700 uppercase">
                                Hora Inicio
                              </label>
                              <input
                                type="time"
                                bind:value={newStartTime}
                                class="w-full rounded-xl border border-red-200 px-3 py-2.5 text-xs font-black focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                              />
                            </div>
                            <div class="space-y-1">
                              <label class="ml-1 text-[10px] font-black text-red-700 uppercase">
                                Hora Fin
                              </label>
                              <input
                                type="time"
                                bind:value={newEndTime}
                                class="w-full rounded-xl border border-red-200 px-3 py-2.5 text-xs font-black focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedCancelOption.value === "RETURN" &&
                      !calendarData.openRegister && (
                        <div class="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] font-bold text-amber-700">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
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
                          Caja cerrada. Abre la caja para devolver la seña.
                        </div>
                      )}

                    <Form action={updateStatusAction} class="pt-2">
                      <input
                        type="hidden"
                        name="bookingId"
                        value={selectedBookingDetails.booking.id}
                      />
                      <input
                        type="hidden"
                        name="status"
                        value={
                          selectedCancelOption.value.startsWith("TRANSFER")
                            ? "CONFIRMED"
                            : "CANCELLED"
                        }
                      />
                      <input
                        type="hidden"
                        name="cancellationOption"
                        value={selectedCancelOption.value}
                      />
                      {selectedCancelOption.value === "TRANSFER_CUSTOM" && (
                        <>
                          <input
                            type="hidden"
                            name="newDate"
                            value={newDate.value}
                          />
                          <input
                            type="hidden"
                            name="newStartTime"
                            value={newStartTime.value}
                          />
                          <input
                            type="hidden"
                            name="newEndTime"
                            value={newEndTime.value}
                          />
                        </>
                      )}
                      <button
                        type="submit"
                        disabled={
                          !selectedCancelOption.value ||
                          (selectedCancelOption.value === "RETURN" &&
                            !calendarData.openRegister) ||
                          updateStatusAction.isRunning
                        }
                        class="w-full rounded-xl bg-red-600 py-3 text-xs font-black tracking-widest text-white uppercase shadow-lg shadow-red-600/20 transition-all hover:bg-red-700 disabled:opacity-50"
                        style="cursor: pointer !important;"
                      >
                        {updateStatusAction.isRunning
                          ? "Procesando..."
                          : "Confirmar Acción"}
                      </button>
                    </Form>
                  </div>
                )}

                {/* Status & Operations Center */}
                <div class="space-y-4 rounded-3xl border border-slate-100 bg-slate-50 p-6">
                  <div class="flex items-center justify-between text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    <span>Gestión de Estado</span>
                    {(() => {
                      const status = selectedBookingDetails.booking.status;
                      return (
                        <span
                          class={cn(
                            "rounded-full border px-2 py-0.5 text-[9px] font-black",
                            status === "CONFIRMED"
                              ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                              : status === "COMPLETED"
                                ? "border-slate-300 bg-slate-200 text-slate-800"
                                : status === "CANCELLED"
                                  ? "border-red-200 bg-red-100 text-red-800"
                                  : status === "ATTENDED"
                                    ? "border-indigo-200 bg-indigo-100 text-indigo-800"
                                    : "border-amber-200 bg-amber-100 text-amber-800",
                          )}
                        >
                          {status === "CONFIRMED"
                            ? "Confirmada"
                            : status === "COMPLETED"
                              ? "Finalizada"
                              : status === "CANCELLED"
                                ? "Anulada"
                                : status === "ATTENDED"
                                  ? "Asistió"
                                  : "Pendiente"}
                        </span>
                      );
                    })()}
                  </div>

                  <div class="flex flex-col gap-2">
                    {/* Confirmar Asistencia (Cuenta Corriente) */}
                    {(selectedBookingDetails.booking.paymentMethod === "CUENTA_CORRIENTE" ||
                      selectedBookingDetails.booking.paymentMethod === "CURRENT_ACCOUNT") &&
                      selectedBookingDetails.booking.status !== "ATTENDED" && (
                        <Form action={confirmAttendanceAction} class="w-full">
                          <input
                            type="hidden"
                            name="bookingId"
                            value={selectedBookingDetails.booking.id}
                          />
                          <button
                            type="submit"
                            disabled={confirmAttendanceAction.isRunning}
                            class="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-black tracking-widest text-white uppercase shadow-lg transition-all active:scale-[0.98]"
                            style="background-color: #6366F1 !important; color: #ffffff !important; cursor: pointer !important;"
                          >
                            {confirmAttendanceAction.isRunning ? (
                              <>
                                <svg
                                  class="h-4 w-4 animate-spin text-white"
                                  xmlns="http://www.w3.org/2000/svg"
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
                                  ></circle>
                                  <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                                Confirmando Asistencia...
                              </>
                            ) : (
                              "Confirmar Asistencia"
                            )}
                          </button>
                        </Form>
                      )}

                    {/* Confirm Action */}
                    {selectedBookingDetails.booking.status ===
                      "PENDING_APPROVAL" && (
                      <Form action={updateStatusAction} class="w-full">
                        <input
                          type="hidden"
                          name="bookingId"
                          value={selectedBookingDetails.booking.id}
                        />
                        <input type="hidden" name="status" value="CONFIRMED" />
                        <button
                          type="submit"
                          disabled={updateStatusAction.isRunning}
                          class="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-black tracking-widest text-white uppercase shadow-lg transition-all active:scale-[0.98]"
                          style="background-color: #10B981 !important; color: #ffffff !important; cursor: pointer !important;"
                        >
                          {updateStatusAction.isRunning ? (
                            <>
                              <svg
                                class="h-4 w-4 animate-spin text-white"
                                xmlns="http://www.w3.org/2000/svg"
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
                                ></circle>
                                <path
                                  class="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
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
                        <input
                          type="hidden"
                          name="bookingId"
                          value={selectedBookingDetails.booking.id}
                        />
                        <input type="hidden" name="status" value="COMPLETED" />
                        <button
                          type="submit"
                          disabled={updateStatusAction.isRunning}
                          class="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-xs font-black tracking-widest text-white uppercase shadow-md shadow-slate-800/10 transition-all hover:bg-slate-900"
                          style="cursor: pointer !important;"
                        >
                          {updateStatusAction.isRunning ? (
                            <>
                              <svg
                                class="h-4 w-4 animate-spin text-white"
                                xmlns="http://www.w3.org/2000/svg"
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
                                ></circle>
                                <path
                                  class="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
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
                    {selectedBookingDetails.booking.status !== "CANCELLED" &&
                      selectedBookingDetails.booking.status !== "COMPLETED" && (
                        <div class="w-full">
                          {selectedBookingDetails.booking.paidAmount > 0 ? (
                            <button
                              type="button"
                              onClick$={() => (showCancelOptions.value = true)}
                              class="w-full rounded-xl border border-red-200 bg-white py-3 text-xs font-black tracking-widest text-red-600 uppercase transition-all hover:bg-red-50"
                              style="cursor: pointer !important;"
                            >
                              Anular Reserva
                            </button>
                          ) : (
                            <Form action={updateStatusAction} class="w-full">
                              <input
                                type="hidden"
                                name="bookingId"
                                value={selectedBookingDetails.booking.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value="CANCELLED"
                              />
                              <button
                                type="submit"
                                disabled={updateStatusAction.isRunning}
                                class="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white py-3 text-xs font-black tracking-widest text-red-600 uppercase transition-all hover:bg-red-50"
                                style="cursor: pointer !important;"
                              >
                                {updateStatusAction.isRunning ? (
                                  <>
                                    <svg
                                      class="h-4 w-4 animate-spin text-red-600"
                                      xmlns="http://www.w3.org/2000/svg"
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
                                      ></circle>
                                      <path
                                        class="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                      ></path>
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
                  onClick$={() => (isModalOpen.value = false)}
                  class="w-full rounded-xl border-none bg-slate-100 py-3 text-xs font-black tracking-widest text-slate-500 uppercase transition-all hover:bg-slate-200"
                  style="cursor: pointer !important;"
                >
                  Cerrar Panel
                </Button>
              </div>
            </div>
          ) : (
            <div class="space-y-4 py-20 text-center">
              <div class="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              <div class="text-sm font-black tracking-widest text-slate-400 uppercase">
                Cargando detalles...
              </div>
            </div>
          )}
        </Modal.Panel>
      </Modal.Root>
    );
  },
);
