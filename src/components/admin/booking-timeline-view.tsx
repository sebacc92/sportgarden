import { component$, $, useSignal, useComputed$, useVisibleTask$, type PropFunction } from "@builder.io/qwik";
import { cn } from "@qwik-ui/utils";

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
  onEmptySlotDragEnd$?: PropFunction<(pitchId: string, time: string, durationMin: number) => void>;
};

const ALL_STATUSES = [
  { key: "CONFIRMED",        label: "Confirmado",   dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 border-emerald-300",  active: "bg-emerald-500 text-white border-emerald-600" },
  { key: "PENDING_APPROVAL", label: "Pendiente",    dot: "bg-amber-400",   chip: "bg-amber-100 text-amber-800 border-amber-300",         active: "bg-amber-400 text-white border-amber-500" },
  { key: "CANCELLED",        label: "Cancelado",    dot: "bg-red-400",     chip: "bg-red-100 text-red-800 border-red-300",               active: "bg-red-500 text-white border-red-600" },
  { key: "COMPLETED",        label: "Completado",   dot: "bg-slate-400",   chip: "bg-slate-100 text-slate-700 border-slate-300",         active: "bg-slate-600 text-white border-slate-700" },
] as const;

const STATUS_CARD: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-50 border-amber-200 text-amber-900",
  CONFIRMED:        "bg-emerald-50 border-emerald-200 text-emerald-900",
  CANCELLED:        "bg-red-50 border-red-200 text-red-900",
  COMPLETED:        "bg-slate-50 border-slate-200 text-slate-700",
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

const SLOT_MIN_WIDTH_PX = 150; 
const PITCH_COL_WIDTH_PX = 148;

export const BookingTimelineView = component$<Props>(
  ({ pitches, bookings, startHour = 7, endHour = 23, slotMinutes = 60, onBookingClick$, onEmptySlotDragEnd$ }) => {

    const activeStatuses = useSignal<Set<string>>(new Set(ALL_STATUSES.map(s => s.key)));
    const currentTimePx = useSignal<number | null>(null);
    const scrollRef = useSignal<HTMLElement>();

    // Dragging state
    const dragStart = useSignal<{ pitchId: string; timeMin: number; slot: string } | null>(null);
    const dragEnd = useSignal<{ timeMin: number } | null>(null);

    // Build time slots
    const slots: string[] = [];
    for (let h = startHour; h < endHour; h += slotMinutes / 60) {
      slots.push(`${Math.floor(h).toString().padStart(2, "0")}:${((h % 1) * 60).toString().padStart(2, "0")}`);
    }

    // Current time position & Auto-scroll
    useVisibleTask$(({ cleanup }) => {
      const compute = () => {
        const now = new Date();
        const h = now.getHours() + now.getMinutes() / 60;
        if (h < startHour || h > endHour) {
          currentTimePx.value = null;
          return;
        }
        currentTimePx.value = ((h - startHour) * 60 / slotMinutes) * SLOT_MIN_WIDTH_PX;
      };
      compute();
      
      // Scroll to middle on initial load
      if (scrollRef.value && currentTimePx.value !== null) {
        setTimeout(() => {
          const containerWidth = scrollRef.value?.clientWidth || 0;
          scrollRef.value?.scrollTo({
            left: (currentTimePx.value || 0) + PITCH_COL_WIDTH_PX - containerWidth / 2,
            behavior: 'smooth'
          });
        }, 100);
      }

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

    const fmt = (d: Date) =>
      new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

    return (
      <div 
        class="flex flex-col h-full overflow-hidden"
        onMouseUp$={() => {
          if (dragStart.value && dragEnd.value && onEmptySlotDragEnd$) {
            const startMin = Math.min(dragStart.value.timeMin, dragEnd.value.timeMin);
            const endMin = Math.max(dragStart.value.timeMin, dragEnd.value.timeMin) + slotMinutes;
            const duration = endMin - startMin;
            const startSlot = `${Math.floor(startMin / 60).toString().padStart(2, "0")}:${(startMin % 60).toString().padStart(2, "0")}`;
            onEmptySlotDragEnd$(dragStart.value.pitchId, startSlot, duration);
          }
          dragStart.value = null;
          dragEnd.value = null;
        }}
      >

        {/* ── Status filter chips ── */}
        <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0 flex-wrap">
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Filtrar:</span>

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

            <table class="border-collapse w-full select-none">
              <thead class="sticky top-0 z-20">
                <tr>
                  <th
                    class="sticky left-0 z-40 bg-slate-100 border-b-2 border-r-2 border-slate-200 px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left"
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
                {pitches.map((pitch, idx) => {
                  const pitchBookings = visibleBookings.value.filter(b => b.booking.pitchId === pitch.id);
                  return (
                    <tr key={pitch.id} class={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                      <td
                        class="sticky left-0 z-40 bg-inherit border-b border-r-2 border-slate-200 px-4 py-3 align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                        style={`min-width: ${PITCH_COL_WIDTH_PX}px; width: ${PITCH_COL_WIDTH_PX}px`}
                      >
                        <div class="font-black text-slate-800 text-sm leading-tight">{pitch.name}</div>
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{pitch.type}</div>
                      </td>

                      <td colSpan={slots.length} class="p-0 border-b border-slate-200 relative align-top">
                        <div class="flex h-[110px] relative">
                          {/* Background Grid Cells */}
                          {slots.map(slot => {
                            const timeMin = Number(slot.split(":")[0]) * 60 + Number(slot.split(":")[1]);
                            const isDragging = dragStart.value?.pitchId === pitch.id &&
                                               timeMin >= Math.min(dragStart.value.timeMin, dragEnd.value?.timeMin ?? dragStart.value.timeMin) &&
                                               timeMin <= Math.max(dragStart.value.timeMin, dragEnd.value?.timeMin ?? dragStart.value.timeMin);

                            return (
                              <div
                                key={slot}
                                class="border-r border-slate-100 relative h-full shrink-0"
                                style={`min-width: ${SLOT_MIN_WIDTH_PX}px; width: ${SLOT_MIN_WIDTH_PX}px`}
                              >
                                {slotMinutes > 30 && <div class="absolute inset-y-0 left-1/2 w-px border-l border-dashed pointer-events-none opacity-20" />}
                                <div
                                  class={cn("h-full w-full transition-colors cursor-pointer", isDragging ? "bg-emerald-100/80" : "hover:bg-slate-200/40")}
                                  onMouseDown$={() => {
                                    dragStart.value = { pitchId: pitch.id, timeMin, slot };
                                    dragEnd.value = { timeMin };
                                  }}
                                  onMouseOver$={() => {
                                    if (dragStart.value?.pitchId === pitch.id) {
                                      dragEnd.value = { timeMin };
                                    }
                                  }}
                                />
                              </div>
                            );
                          })}

                          {/* Bookings Overlay Layer */}
                          {pitchBookings.map(({ booking, user, guest }) => {
                            const s = new Date(booking.startTime);
                            const e = new Date(booking.endTime);
                            
                            const bStart = s.getHours() * 60 + s.getMinutes();
                            const bEnd = e.getHours() * 60 + e.getMinutes();
                            
                            const timelineStart = startHour * 60;
                            const left = ((bStart - timelineStart) / slotMinutes) * SLOT_MIN_WIDTH_PX;
                            const width = ((bEnd - bStart) / slotMinutes) * SLOT_MIN_WIDTH_PX;

                            const name = guest?.name || user?.name || "—";
                            const phone = guest?.phone || user?.phone || "";

                            return (
                              <div
                                key={booking.id}
                                onClick$={() => onBookingClick$ && onBookingClick$(booking.id)}
                                style={{
                                  left: `${left}px`,
                                  width: `${width}px`,
                                  top: '8px',
                                  height: 'calc(100% - 16px)'
                                }}
                                class={[
                                  "absolute z-20 rounded-xl border px-3 py-2 cursor-pointer hover:scale-[1.01] hover:shadow-lg transition-all overflow-hidden flex flex-col justify-between group",
                                  STATUS_CARD[booking.status] || "bg-white border-slate-200"
                                ]}
                              >
                                <div class={["absolute top-0 left-0 right-0 h-1", STATUS_BAR[booking.status]]} />
                                
                                <div class="flex flex-col gap-0.5">
                                  <div class="flex items-center justify-between gap-2">
                                    <span class="font-black text-xs truncate">{name}</span>
                                    <span class="text-[8px] font-black opacity-50 uppercase tracking-tighter shrink-0">
                                      {STATUS_LABEL[booking.status]}
                                    </span>
                                  </div>
                                  <div class="text-[10px] font-bold opacity-60 flex items-center gap-1">
                                    {fmt(booking.startTime)} — {fmt(booking.endTime)}
                                  </div>
                                </div>

                                <div class="flex items-end justify-between mt-auto pt-1 gap-2">
                                  <div class="text-[9px] font-bold opacity-40 truncate flex-1">{phone}</div>
                                  <div class="text-[11px] font-black text-right shrink-0">
                                    ${booking.totalPrice.toLocaleString('es-AR')}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
);
