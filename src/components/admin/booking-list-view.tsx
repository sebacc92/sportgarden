import { component$, type PropFunction } from "@builder.io/qwik";

type Pitch = {
  id: string;
  name: string;
  type: string;
};

type BookingEntry = {
  booking: {
    id: string;
    pitchId: string;
    startTime: Date;
    endTime: Date;
    status: "PENDING_APPROVAL" | "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
    totalPrice: number;
    paidAmount: number;
    paymentStatus: string;
  };
  user: { id: string; name: string; phone: string | null } | null;
  guest: { id: string; name: string; phone: string } | null;
};

export type BookingListViewProps = {
  pitches: Pitch[];
  bookings: BookingEntry[];
  calendarStartHour?: number;
  calendarEndHour?: number;
  onBookingClick$?: PropFunction<(id: string) => void>;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-400",
  PENDING_PAYMENT: "bg-orange-500",
  CONFIRMED: "bg-emerald-500",
  CANCELLED: "bg-red-400",
  COMPLETED: "bg-slate-400",
};

const STATUS_TEXT: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-800 border border-amber-300",
  PENDING_PAYMENT: "bg-orange-100 text-orange-800 border border-orange-300",
  CONFIRMED: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  CANCELLED: "bg-red-100 text-red-800 border border-red-300",
  COMPLETED: "bg-slate-100 text-slate-800 border border-slate-300",
};

const STATUS_ROW: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-50 hover:bg-amber-100/60",
  PENDING_PAYMENT: "bg-orange-50 hover:bg-orange-100/60",
  CONFIRMED: "bg-emerald-50 hover:bg-emerald-100/60",
  CANCELLED: "bg-red-50 hover:bg-red-100/60",
  COMPLETED: "bg-slate-50 hover:bg-slate-100/60",
};

export const BookingListView = component$<BookingListViewProps>(
  ({ pitches, bookings, onBookingClick$ }) => {
    // Group bookings by pitch, sorted by startTime
    const byPitch = pitches.map((pitch) => {
      const pitchBookings = bookings
        .filter((b) => b.booking.pitchId === pitch.id)
        .sort(
          (a, b) =>
            new Date(a.booking.startTime).getTime() -
            new Date(b.booking.startTime).getTime(),
        );
      return { pitch, bookings: pitchBookings };
    });

    const totalBookings = bookings.length;

    return (
      <div class="flex h-full flex-col overflow-hidden">
        {totalBookings === 0 ? (
          <div class="flex flex-1 items-center justify-center">
            <div class="space-y-2 text-center">
              <div class="text-4xl">📋</div>
              <p class="font-bold text-slate-500">
                No hay reservas para este día.
              </p>
            </div>
          </div>
        ) : (
          <div class="flex-1 overflow-auto">
            <table class="w-full border-collapse text-left">
              <thead class="sticky top-0 z-10">
                <tr class="border-b-2 border-slate-200 bg-slate-50">
                  <th class="w-44 border-r border-slate-200 p-4 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Cancha
                  </th>
                  <th class="border-r border-slate-200 p-4 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Horario
                  </th>
                  <th class="border-r border-slate-200 p-4 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Cliente
                  </th>
                  <th class="border-r border-slate-200 p-4 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Estado
                  </th>
                  <th class="border-r border-slate-200 p-4 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Total
                  </th>
                  <th class="p-4 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Seña
                  </th>
                </tr>
              </thead>
              <tbody>
                {byPitch.map(({ pitch, bookings: pb }) => {
                  if (pb.length === 0) return null;
                  return (
                    <>
                      {pb.map((entry, idx) => {
                        const { booking, user, guest } = entry;
                        const customerName =
                          guest?.name || user?.name || "Desconocido";
                        const customerPhone =
                          guest?.phone || user?.phone || "—";
                        const start = new Date(booking.startTime);
                        const end = new Date(booking.endTime);
                        const timeStr = `${start.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false })} — ${end.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false })}`;
                        const durationH =
                          (end.getTime() - start.getTime()) / 3600000;
                        const rowBg = STATUS_ROW[booking.status] || "";

                        return (
                          <tr
                            key={booking.id}
                            class={[
                              "cursor-pointer border-b border-slate-100 transition-colors",
                              rowBg,
                            ]}
                            onClick$={() =>
                              onBookingClick$ && onBookingClick$(booking.id)
                            }
                          >
                            {/* Pitch cell — only on first row of pitch group */}
                            {idx === 0 ? (
                              <td
                                rowSpan={pb.length}
                                class="border-r border-slate-200 bg-white p-4 align-top"
                              >
                                <div class="flex items-center gap-2">
                                  <div
                                    class={[
                                      "h-12 w-1.5 shrink-0 rounded-full",
                                      STATUS_COLORS[booking.status],
                                    ]}
                                  />
                                  <div>
                                    <div class="text-sm font-black text-slate-800">
                                      {pitch.name}
                                    </div>
                                    <div class="mt-0.5 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                                      {pitch.type}
                                    </div>
                                    <div class="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">
                                      {pb.length} reserva
                                      {pb.length !== 1 ? "s" : ""}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            ) : null}

                            <td class="border-r border-slate-200 p-4">
                              <div class="text-sm font-black text-slate-800 tabular-nums">
                                {timeStr}
                              </div>
                              <div class="mt-0.5 text-xs text-slate-400">
                                {durationH}h
                              </div>
                            </td>

                            <td class="border-r border-slate-200 p-4">
                              <div class="text-sm font-bold text-slate-800">
                                {customerName}
                              </div>
                              <div class="text-xs text-slate-400">
                                {customerPhone}
                              </div>
                            </td>

                            <td class="border-r border-slate-200 p-4">
                              <span
                                class={[
                                  "rounded-full px-2 py-1 text-[10px] font-black tracking-wider uppercase",
                                  STATUS_TEXT[booking.status],
                                ]}
                              >
                                 {booking.status === "PENDING_APPROVAL"
                                  ? "Por confirmar"
                                  : booking.status === "PENDING_PAYMENT"
                                    ? "Pendiente Pago"
                                    : booking.status === "CONFIRMED"
                                      ? "Confirmado"
                                      : booking.status === "CANCELLED"
                                        ? "Cancelado"
                                        : "Completado"}
                              </span>
                            </td>

                            <td class="border-r border-slate-200 p-4 tabular-nums">
                              <div class="font-black text-slate-800">
                                ${booking.totalPrice}
                              </div>
                            </td>

                            <td class="p-4 tabular-nums">
                              <div
                                class={
                                  booking.paidAmount > 0
                                    ? "font-black text-emerald-600"
                                    : "font-bold text-slate-400"
                                }
                              >
                                {booking.paidAmount > 0
                                  ? `$${booking.paidAmount}`
                                  : "—"}
                              </div>
                              {booking.paidAmount > 0 && (
                                <div class="text-[10px] font-bold text-slate-400 uppercase">
                                  {booking.paymentStatus === "PARTIAL"
                                    ? `Resta $${booking.totalPrice - booking.paidAmount}`
                                    : "Pagado"}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  },
);
