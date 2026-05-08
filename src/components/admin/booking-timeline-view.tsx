import { component$, $, useSignal, useComputed$, useVisibleTask$, type PropFunction } from "@builder.io/qwik";

type Pitch = { id: string; name: string; type: string };

type BookingEntry = {
  booking: {
    id: string;
    pitchId: string;
    startTime: Date;
    endTime: Date;
    status: "PENDING_APPROVAL" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
    totalPrice: number;
    paidAmount: number;
    paymentStatus: string;
  };
  user: { id: string; name: string; phone: string | null } | null;
  guest: { id: string; name: string; phone: string } | null;
};

type Props = {
  pitches: Pitch[];
  bookings: BookingEntry[];
  startHour?: number;
  endHour?: number;
  slotMinutes?: number;
  onBookingClick$?: PropFunction<(id: string) => void>;
};

const ALL_STATUSES = [
  { key: "CONFIRMED",        label: "Confirmado",   dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 border-emerald-300",  active: "bg-emerald-500 text-white border-emerald-600" },
  { key: "PENDING_APPROVAL", label: "Pendiente",    dot: "bg-amber-400",   chip: "bg-amber-100 text-amber-800 border-amber-300",         active: "bg-amber-400 text-white border-amber-500" },
  { key: "CANCELLED",        label: "Cancelado",    dot: "bg-red-400",     chip: "bg-red-100 text-red-800 border-red-300",               active: "bg-red-500 text-white border-red-600" },
  { key: "COMPLETED",        label: "Completado",   dot: "bg-slate-400",   chip: "bg-slate-100 text-slate-700 border-slate-300",         active: "bg-slate-600 text-white border-slate-700" },
] as const;

const STATUS_CARD: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 border-amber-300 text-amber-900",
  CONFIRMED:        "bg-emerald-100 border-emerald-300 text-emerald-900",
  CANCELLED:        "bg-red-100 border-red-300 text-red-900",
  COMPLETED:        "bg-slate-100 border-slate-300 text-slate-700",
};
const STATUS_BAR: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-400",
  CONFIRMED:        "bg-emerald-500",
  CANCELLED:        "bg-red-400",
  COMPLETED:        "bg-slate-400",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Pendiente",
  CONFIRMED:        "Confirmado",
  CANCELLED:        "Cancelado",
  COMPLETED:        "Completado",
};

const SLOT_MIN_WIDTH_PX = 150; // ~25% wider than the previous 120px
const PITCH_COL_WIDTH_PX = 148;

export const BookingTimelineView = component$<Props>(
  ({ pitches, bookings, startHour = 7, endHour = 23, slotMinutes = 60, onBookingClick$ }) => {

    // Filters: set of active statuses (all active by default)
    const activeStatuses = useSignal<Set<string>>(new Set(ALL_STATUSES.map(s => s.key)));
    const currentTimePx = useSignal<number | null>(null);
    const scrollRef = useSignal<HTMLElement>();

    // Build time slots
    const slots: string[] = [];
    for (let h = startHour; h < endHour; h += slotMinutes / 60) {
      slots.push(`${Math.floor(h).toString().padStart(2, "0")}:${((h % 1) * 60).toString().padStart(2, "0")}`);
    }

    // Current time position
    useVisibleTask$(({ cleanup }) => {
      const compute = () => {
        const now = new Date();
        const h = now.getHours() + now.getMinutes() / 60;
        if (h < startHour || h > endHour) {
          currentTimePx.value = null;
          return;
        }
        currentTimePx.value = (h - startHour) * SLOT_MIN_WIDTH_PX;
      };
      compute();
      const id = setInterval(compute, 60_000);
      cleanup(() => clearInterval(id));
    });

    // Toggle a status filter
    const toggleStatus = $((key: string) => {
      const next = new Set(activeStatuses.value);
      if (next.has(key) && next.size === 1) {
        ALL_STATUSES.forEach(s => next.add(s.key));
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      activeStatuses.value = next;
    });

    // Filtered bookings
    const visibleBookings = useComputed$(() =>
      bookings.filter(b => activeStatuses.value.has(b.booking.status))
    );

    const getSlotBookings = (pitchId: string, slot: string) => {
      const [hh, mm] = slot.split(":").map(Number);
      const slotStart = hh * 60 + mm;
      const slotEnd = slotStart + slotMinutes;
      return visibleBookings.value.filter(b => {
        if (b.booking.pitchId !== pitchId) return false;
        const s = new Date(b.booking.startTime);
        const e = new Date(b.booking.endTime);
        const bStart = s.getHours() * 60 + s.getMinutes();
        const bEnd   = e.getHours() * 60 + e.getMinutes();
        return bStart < slotEnd && bEnd > slotStart;
      });
    };

    const fmt = (d: Date) =>
      new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

    return (
      <div class="flex flex-col h-full overflow-hidden">

        {/* ── Status filter chips ── */}
        <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0 flex-wrap">
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Filtrar:</span>

          {/* "Todos" shortcut */}
          <button
            onClick$={() => { activeStatuses.value = new Set(ALL_STATUSES.map(s => s.key)); }}
            class={[
              "px-3 py-1 rounded-full text-[11px] font-black border transition-all",
              activeStatuses.value.size === ALL_STATUSES.length
                ? "bg-slate-800 text-white border-slate-900"
                : "bg-white text-slate-500 border-slate-300 hover:border-slate-500",
            ]}
          >
            Todos
          </button>

          {ALL_STATUSES.map(s => {
            const isActive = activeStatuses.value.has(s.key);
            return (
              <button
                key={s.key}
                onClick$={() => toggleStatus(s.key)}
                class={[
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border transition-all",
                  isActive ? s.active : s.chip,
                  isActive ? "" : "opacity-50",
                ]}
              >
                <span class={["w-2 h-2 rounded-full shrink-0", isActive ? "bg-white/80" : s.dot]} />
                {s.label}
              </button>
            );
          })}

          <div class="ml-auto text-xs text-slate-400 font-bold">
            <span class="text-slate-700 font-black">{visibleBookings.value.length}</span> de {bookings.length} reservas
          </div>
        </div>

        {/* ── Timeline grid ── */}
        <div ref={scrollRef} class="overflow-auto flex-1">
          <div class="relative" style={`min-width: ${PITCH_COL_WIDTH_PX + slots.length * SLOT_MIN_WIDTH_PX}px`}>

            {/* Current-time vertical line */}
            {currentTimePx.value !== null && (
              <div
                class="absolute top-0 bottom-0 z-30 pointer-events-none"
                style={`left: ${PITCH_COL_WIDTH_PX + currentTimePx.value}px`}
              >
                <div class="w-0.5 h-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500" />
              </div>
            )}

            <table class="border-collapse w-full">
              <thead class="sticky top-0 z-20">
                <tr>
                  {/* Corner */}
                  <th
                    class="sticky left-0 z-30 bg-slate-100 border-b-2 border-r-2 border-slate-200 px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left"
                    style={`min-width: ${PITCH_COL_WIDTH_PX}px; width: ${PITCH_COL_WIDTH_PX}px`}
                  >
                    Cancha
                  </th>
                  {slots.map(slot => (
                    <th
                      key={slot}
                      class="bg-slate-50 border-b-2 border-r border-slate-200 py-3 text-[11px] font-black text-slate-500 text-center whitespace-nowrap"
                      style={`min-width: ${SLOT_MIN_WIDTH_PX}px; width: ${SLOT_MIN_WIDTH_PX}px`}
                    >
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {pitches.map((pitch, idx) => (
                  <tr key={pitch.id} class={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                    {/* Pitch label */}
                    <td
                      class="sticky left-0 z-10 bg-inherit border-b border-r-2 border-slate-200 px-4 py-3 align-middle"
                      style={`min-width: ${PITCH_COL_WIDTH_PX}px; width: ${PITCH_COL_WIDTH_PX}px`}
                    >
                      <div class="font-black text-slate-800 text-sm leading-tight">{pitch.name}</div>
                      <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{pitch.type}</div>
                    </td>

                    {slots.map(slot => {
                      const cells = getSlotBookings(pitch.id, slot);
                      return (
                        <td
                          key={slot}
                          class="border-b border-r border-slate-100 p-1 align-top"
                          style={`min-width: ${SLOT_MIN_WIDTH_PX}px; width: ${SLOT_MIN_WIDTH_PX}px; height: 80px`}
                        >
                          {cells.length === 0 ? (
                            <div class="h-full w-full rounded-lg hover:bg-slate-100/60 transition-colors" />
                          ) : (
                            <div class="flex flex-col gap-1 h-full">
                              {cells.map(({ booking, user, guest }) => {
                                const name = guest?.name || user?.name || "—";
                                const phone = guest?.phone || user?.phone || "";
                                return (
                                  <div
                                    key={booking.id}
                                    onClick$={() => onBookingClick$ && onBookingClick$(booking.id)}
                                    class={[
                                      "flex-1 rounded-lg border px-2 py-1.5 cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all overflow-hidden flex flex-col gap-0.5",
                                      STATUS_CARD[booking.status],
                                    ]}
                                    title={`${name} · ${fmt(booking.startTime)} - ${fmt(booking.endTime)}`}
                                  >
                                    <div class={["h-1 w-full rounded-full mb-1 shrink-0", STATUS_BAR[booking.status]]} />
                                    <div class="font-black text-[11px] leading-tight truncate">{name}</div>
                                    <div class="text-[10px] font-semibold opacity-70 truncate">
                                      {fmt(booking.startTime)} — {fmt(booking.endTime)}
                                    </div>
                                    <div class="mt-auto flex items-center justify-between gap-1">
                                      <span class="text-[9px] font-black uppercase opacity-60 truncate">
                                        {STATUS_LABEL[booking.status]}
                                      </span>
                                      <span class="text-[10px] font-black shrink-0">${booking.totalPrice}</span>
                                    </div>
                                    {phone && (
                                      <div class="text-[9px] opacity-50 truncate">{phone}</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
);
