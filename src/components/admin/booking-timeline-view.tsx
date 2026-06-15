import {
  component$,
  $,
  useSignal,
  useComputed$,
  useVisibleTask$,
  type PropFunction,
} from "@builder.io/qwik";
import { cn } from "@qwik-ui/utils";
import { getBAHoursAndMinutes } from "~/routes/admin/calendar/utils";

type Pitch = {
  id: string;
  name: string;
  type: string;
  overlapPitchIds?: string[];
};

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
    isSubscription: boolean;
    bookingType?: string;
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
  onEmptySlotDragEnd$?: PropFunction<
    (pitchId: string, time: string, durationMin: number) => void
  >;
};

const ALL_TYPES = [
  {
    key: "EVENTUAL",
    label: "Eventual",
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-800 border-blue-200",
    active: "bg-blue-500 text-white border-blue-600",
  },
  {
    key: "FIXED",
    label: "Fijo",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    active: "bg-emerald-500 text-white border-emerald-600",
  },
  {
    key: "BIRTHDAY",
    label: "Cumpleaños",
    dot: "bg-violet-500",
    chip: "bg-violet-50 text-violet-800 border-violet-200",
    active: "bg-violet-500 text-white border-violet-600",
  },
  {
    key: "SCHOOL",
    label: "Escuelita",
    dot: "bg-orange-500",
    chip: "bg-orange-50 text-orange-800 border-orange-200",
    active: "bg-orange-500 text-white border-orange-600",
  },
  {
    key: "TOURNAMENT",
    label: "Torneo",
    dot: "bg-pink-500",
    chip: "bg-pink-50 text-pink-800 border-pink-200",
    active: "bg-pink-500 text-white border-pink-600",
  },
] as const;

const ALL_STATUSES = [
  {
    key: "CONFIRMED",
    label: "Confirmado",
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-300",
    active: "bg-emerald-500 text-white border-emerald-600",
  },
  {
    key: "PENDING_APPROVAL",
    label: "Pendiente",
    dot: "bg-amber-400",
    chip: "bg-amber-100 text-amber-800 border-amber-300",
    active: "bg-amber-400 text-white border-amber-500",
  },
  {
    key: "PENDING_PAYMENT",
    label: "Pendiente Pago",
    dot: "bg-orange-500",
    chip: "bg-orange-100 text-orange-800 border-orange-300",
    active: "bg-orange-500 text-white border-orange-600",
  },
  {
    key: "CANCELLED",
    label: "Cancelado",
    dot: "bg-red-400",
    chip: "bg-red-100 text-red-800 border-red-300",
    active: "bg-red-500 text-white border-red-600",
  },
  {
    key: "COMPLETED",
    label: "Completado",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700 border-slate-300",
    active: "bg-slate-600 text-white border-slate-700",
  },
] as const;

const STATUS_ACTIVE_STYLE: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  CONFIRMED: { bg: "#10b981", text: "#fff", border: "#059669" },
  PENDING_APPROVAL: { bg: "#fbbf24", text: "#fff", border: "#f59e0b" },
  PENDING_PAYMENT: { bg: "#f97316", text: "#fff", border: "#ea580c" },
  CANCELLED: { bg: "#ef4444", text: "#fff", border: "#dc2626" },
  COMPLETED: { bg: "#475569", text: "#fff", border: "#334155" },
};

const TYPE_CARD: Record<string, string> = {
  EVENTUAL:   "bg-white border-l-blue-500   border-y-blue-100   border-r-blue-100",
  FIXED:      "bg-white border-l-emerald-500 border-y-emerald-100 border-r-emerald-100",
  BIRTHDAY:   "bg-white border-l-violet-500  border-y-violet-100  border-r-violet-100",
  TOURNAMENT: "bg-white border-l-rose-500    border-y-rose-100    border-r-rose-100",
  SCHOOL:     "bg-white border-l-orange-500  border-y-orange-100  border-r-orange-100",
};

const STATUS_CARD: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-50  border-l-amber-500  border-y-amber-100  border-r-amber-100",
  PENDING_PAYMENT:  "bg-orange-50 border-l-orange-500 border-y-orange-100 border-r-orange-100",
  CONFIRMED:        "bg-white     border-l-emerald-500 border-y-emerald-100 border-r-emerald-100",
  CANCELLED:        "bg-red-50   border-l-red-400     border-y-red-100     border-r-red-100",
  COMPLETED:        "bg-slate-50  border-l-slate-400   border-y-slate-100  border-r-slate-100",
};

const TYPE_META: Record<string, { abbr: string; nameColor: string; pillBg: string; pillText: string }> = {
  EVENTUAL:   { abbr: "EVT",  nameColor: "text-blue-900",    pillBg: "bg-blue-100",    pillText: "text-blue-700" },
  FIXED:      { abbr: "FIJO", nameColor: "text-emerald-900", pillBg: "bg-emerald-100", pillText: "text-emerald-700" },
  BIRTHDAY:   { abbr: "CUMP", nameColor: "text-violet-900",  pillBg: "bg-violet-100",  pillText: "text-violet-700" },
  TOURNAMENT: { abbr: "TORN", nameColor: "text-rose-900",    pillBg: "bg-rose-100",    pillText: "text-rose-700" },
  SCHOOL:     { abbr: "ESC",  nameColor: "text-orange-900",  pillBg: "bg-orange-100",  pillText: "text-orange-700" },
};

const STATUS_BADGE: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-400 text-white",
  PENDING_PAYMENT:  "bg-orange-500 text-white",
  CONFIRMED:        "bg-emerald-100 text-emerald-700",
  CANCELLED:        "bg-red-100 text-red-700",
  COMPLETED:        "bg-slate-200 text-slate-600",
};

const STATUS_LABEL_SHORT: Record<string, string> = {
  PENDING_APPROVAL: "Pendiente",
  PENDING_PAYMENT:  "Pend. Pago",
  CONFIRMED:        "Confirmado",
  CANCELLED:        "Cancelado",
  COMPLETED:        "Completado",
};

const SLOT_MIN_WIDTH_PX = 110;
const PITCH_COL_WIDTH_PX = 148;

export const BookingTimelineView = component$<Props>(
  ({
    pitches,
    bookings,
    startHour = 7,
    endHour = 23,
    slotMinutes = 60,
    onBookingClick$,
    onEmptySlotDragEnd$,
  }) => {
    const activeTypes = useSignal<Set<string>>(
      new Set(ALL_TYPES.map((s) => s.key)),
    );
    const activeStatuses = useSignal<Set<string>>(
      new Set(ALL_STATUSES.map((s) => s.key)),
    );
    const currentTimePx = useSignal<number | null>(null);
    const scrollRef = useSignal<HTMLElement>();

    // Dragging state
    const dragStart = useSignal<{
      pitchId: string;
      timeMin: number;
      slot: string;
    } | null>(null);
    const dragEnd = useSignal<{ timeMin: number } | null>(null);

    // Build time slots
    const slots: string[] = [];
    for (let h = startHour; h < endHour; h += slotMinutes / 60) {
      slots.push(
        `${Math.floor(h).toString().padStart(2, "0")}:${((h % 1) * 60).toString().padStart(2, "0")}`,
      );
    }

    // Current time position & Auto-scroll
    useVisibleTask$(({ cleanup }) => {
      const compute = () => {
        const now = new Date();
        const { hour, minute } = getBAHoursAndMinutes(now);
        const h = hour + minute / 60;
        if (h < startHour || h > endHour) {
          currentTimePx.value = null;
          return;
        }
        currentTimePx.value =
          (((h - startHour) * 60) / slotMinutes) * SLOT_MIN_WIDTH_PX;
      };
      compute();

      // Scroll to middle on initial load
      if (scrollRef.value && currentTimePx.value !== null) {
        setTimeout(() => {
          const containerWidth = scrollRef.value?.clientWidth || 0;
          scrollRef.value?.scrollTo({
            left:
              (currentTimePx.value || 0) +
              PITCH_COL_WIDTH_PX -
              containerWidth / 2,
            behavior: "smooth",
          });
        }, 100);
      }

      const id = setInterval(compute, 60_000);
      cleanup(() => clearInterval(id));
    });

    // Toggle a type filter
    const toggleType = $((key: string) => {
      const next = new Set(activeTypes.value);
      if (next.has(key) && next.size === 1) {
        ALL_TYPES.forEach((s) => next.add(s.key));
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      activeTypes.value = next;
    });

    const toggleStatus = $((key: string) => {
      const next = new Set(activeStatuses.value);
      if (next.has(key) && next.size === 1) {
        ALL_STATUSES.forEach((s) => next.add(s.key));
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      activeStatuses.value = next;
    });

    // Filtered bookings
    const visibleBookings = useComputed$(() =>
      bookings.filter((b) => {
        const type =
          b.booking.bookingType ||
          (b.booking.isSubscription ? "FIXED" : "EVENTUAL");
        return (
          activeTypes.value.has(type) &&
          activeStatuses.value.has(b.booking.status)
        );
      }),
    );

    const fmt = (d: Date) =>
      new Date(d).toLocaleTimeString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

    return (
      <div
        class="flex h-full flex-col overflow-hidden"
        onMouseUp$={() => {
          if (dragStart.value && dragEnd.value && onEmptySlotDragEnd$) {
            const startMin = Math.min(
              dragStart.value.timeMin,
              dragEnd.value.timeMin,
            );
            const endMin =
              Math.max(dragStart.value.timeMin, dragEnd.value.timeMin) +
              slotMinutes;
            const duration = endMin - startMin;
            const startSlot = `${Math.floor(startMin / 60)
              .toString()
              .padStart(
                2,
                "0",
              )}:${(startMin % 60).toString().padStart(2, "0")}`;
            onEmptySlotDragEnd$(dragStart.value.pitchId, startSlot, duration);
          }
          dragStart.value = null;
          dragEnd.value = null;
        }}
      >
        {/* ── Type filter chips ── */}
        <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <span class="mr-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
            Reservas:
          </span>

          <button
            onClick$={() => {
              activeTypes.value = new Set(ALL_TYPES.map((s) => s.key));
            }}
            class={[
              "rounded-full border px-3 py-1 text-[11px] font-black transition-all",
              activeTypes.value.size === ALL_TYPES.length
                ? "border-slate-900 bg-slate-800 text-white"
                : "border-slate-300 bg-white text-slate-500 hover:border-slate-500",
            ]}
          >
            Todas
          </button>

          {ALL_TYPES.map((t) => {
            const isActive = activeTypes.value.has(t.key);
            return (
              <button
                key={t.key}
                onClick$={() => toggleType(t.key)}
                class={[
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black transition-all",
                  isActive ? t.active : t.chip,
                  isActive ? "" : "opacity-50",
                ]}
              >
                <span
                  class={[
                    "h-2 w-2 shrink-0 rounded-full",
                    isActive ? "bg-white/80" : t.dot,
                  ]}
                />
                {t.label}
              </button>
            );
          })}

          <div class="mx-2 h-4 w-px bg-slate-200"></div>

          <span class="mr-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
            Estados:
          </span>
          {ALL_STATUSES.map((s) => {
            const isActive = activeStatuses.value.has(s.key);
            const activeStyle = STATUS_ACTIVE_STYLE[s.key];
            return (
              <button
                key={s.key}
                onClick$={() => toggleStatus(s.key)}
                class={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black transition-all",
                  !isActive && s.chip,
                  !isActive && "opacity-60",
                )}
                style={
                  isActive
                    ? {
                        backgroundColor: activeStyle.bg,
                        color: activeStyle.text,
                        borderColor: activeStyle.border,
                      }
                    : undefined
                }
              >
                <span
                  class={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    !isActive && s.dot,
                  )}
                  style={
                    isActive
                      ? { backgroundColor: "rgba(255,255,255,0.7)" }
                      : undefined
                  }
                />
                {s.label}
              </button>
            );
          })}

          <div class="ml-auto text-xs font-bold text-slate-400">
            <span class="font-black text-slate-700">
              {visibleBookings.value.length}
            </span>{" "}
            de {bookings.length}
          </div>
        </div>

        {/* ── Timeline grid ── */}
        <div ref={scrollRef} class="flex-1 overflow-auto bg-slate-50">
          <div
            class="relative"
            style={`width: ${PITCH_COL_WIDTH_PX + slots.length * SLOT_MIN_WIDTH_PX}px`}
          >
            {/* Current-time vertical line */}
            {currentTimePx.value !== null && (
              <div
                class="pointer-events-none absolute top-0 bottom-0 z-30"
                style={`left: ${PITCH_COL_WIDTH_PX + currentTimePx.value}px`}
              >
                <div class="h-full w-0.5 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                <div class="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-red-500" />
              </div>
            )}

            <table
              class="w-full border-collapse select-none"
              style="table-layout: fixed;"
            >
              <thead class="sticky top-0 z-50">
                <tr>
                  <th
                    class="sticky left-0 z-60 border-r-2 border-b-2 border-slate-200 bg-slate-100 px-4 py-3 text-left text-[10px] font-black tracking-widest text-slate-400 uppercase"
                    style={`min-width: ${PITCH_COL_WIDTH_PX}px; width: ${PITCH_COL_WIDTH_PX}px`}
                  >
                    Cancha
                  </th>
                  {slots.map((slot) => (
                    <th
                      key={slot}
                      class="border-r border-b-2 border-slate-200 bg-slate-50 py-3 text-center text-sm font-black whitespace-nowrap text-slate-500"
                      style={`min-width: ${SLOT_MIN_WIDTH_PX}px; width: ${SLOT_MIN_WIDTH_PX}px`}
                    >
                      {slot}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {pitches.map((pitch, idx) => {
                  const pitchBookings = visibleBookings.value.filter(
                    (b) => b.booking.pitchId === pitch.id,
                  );
                  return (
                    <tr
                      key={pitch.id}
                      class={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}
                    >
                      <td
                        class={cn(
                          "sticky left-0 z-40 border-r-2 border-b border-slate-200 px-4 py-3 align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50",
                        )}
                        style={`min-width: ${PITCH_COL_WIDTH_PX}px; width: ${PITCH_COL_WIDTH_PX}px`}
                      >
                        <div class="text-sm leading-tight font-black text-slate-800">
                          {pitch.name}
                        </div>
                        <div class="mt-0.5 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                          {pitch.type}
                        </div>
                      </td>

                      <td
                        colSpan={slots.length}
                        class="relative z-10 border-b border-slate-200 p-0 align-top"
                      >
                        <div class="relative flex h-[110px]">
                          {/* Background Grid Cells */}
                          {slots.map((slot) => {
                            const timeMin =
                              Number(slot.split(":")[0]) * 60 +
                              Number(slot.split(":")[1]);
                            const isDragging =
                              dragStart.value?.pitchId === pitch.id &&
                              timeMin >=
                                Math.min(
                                  dragStart.value.timeMin,
                                  dragEnd.value?.timeMin ??
                                    dragStart.value.timeMin,
                                ) &&
                              timeMin <=
                                Math.max(
                                  dragStart.value.timeMin,
                                  dragEnd.value?.timeMin ??
                                    dragStart.value.timeMin,
                                );

                            return (
                              <div
                                key={slot}
                                class="relative h-full shrink-0 border-r border-slate-100"
                                style={`min-width: ${SLOT_MIN_WIDTH_PX}px; width: ${SLOT_MIN_WIDTH_PX}px`}
                              >
                                {slotMinutes > 30 && (
                                  <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px border-l border-dashed opacity-20" />
                                )}
                                <div
                                  class={cn(
                                    "group/cell flex h-full w-full cursor-pointer items-center justify-center transition-all",
                                    isDragging
                                      ? "bg-emerald-100/80"
                                      : "hover:bg-slate-200/40",
                                  )}
                                  onMouseDown$={() => {
                                    dragStart.value = {
                                      pitchId: pitch.id,
                                      timeMin,
                                      slot,
                                    };
                                    dragEnd.value = { timeMin };
                                  }}
                                  onMouseOver$={() => {
                                    if (dragStart.value?.pitchId === pitch.id) {
                                      dragEnd.value = { timeMin };
                                    }
                                  }}
                                >
                                  <div class="pointer-events-none flex h-6 w-6 scale-75 items-center justify-center rounded-full bg-white/80 text-slate-400 opacity-0 shadow-sm transition-all group-hover/cell:scale-100 group-hover/cell:opacity-100">
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
                                      <line
                                        x1="12"
                                        y1="5"
                                        x2="12"
                                        y2="19"
                                      ></line>
                                      <line
                                        x1="5"
                                        y1="12"
                                        x2="19"
                                        y2="12"
                                      ></line>
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Bookings Overlay Layer */}
                          {/* Bookings Overlay Layer (Overlapping Pitches) */}
                          {(() => {
                            // Find bookings that affect THIS pitch (bidirectional overlaps)
                            const affectingBookings =
                              visibleBookings.value.filter((b) => {
                                if (b.booking.pitchId === pitch.id)
                                  return false; // Handled by standard logic
                                if (
                                  pitch.overlapPitchIds &&
                                  pitch.overlapPitchIds.includes(
                                    b.booking.pitchId,
                                  )
                                ) {
                                  return true;
                                }
                                return false;
                              });

                            return affectingBookings.map(({ booking }) => {
                              const s = new Date(booking.startTime);
                              const e = new Date(booking.endTime);
                              const sBA = getBAHoursAndMinutes(s);
                              const eBA = getBAHoursAndMinutes(e);
                              const bStart = sBA.hour * 60 + sBA.minute;
                              const bEnd = eBA.hour * 60 + eBA.minute;
                              const timelineStart = startHour * 60;
                              const left =
                                ((bStart - timelineStart) / slotMinutes) *
                                SLOT_MIN_WIDTH_PX;
                              const width =
                                ((bEnd - bStart) / slotMinutes) *
                                SLOT_MIN_WIDTH_PX;

                              return (
                                <div
                                  key={`blocked-${booking.id}`}
                                  style={{
                                    left: `${left}px`,
                                    width: `${width}px`,
                                    top: "12px",
                                    height: "calc(100% - 24px)",
                                  }}
                                  class="group pointer-events-none absolute z-15 flex items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-100/50 shadow-inner"
                                >
                                  <div class="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 opacity-60 shadow-sm transition-opacity group-hover:opacity-100">
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
                                      class="text-slate-400"
                                    >
                                      <rect
                                        x="3"
                                        y="11"
                                        width="18"
                                        height="11"
                                        rx="2"
                                        ry="2"
                                      ></rect>
                                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                    <span class="text-[9px] font-black tracking-tighter whitespace-nowrap text-slate-500 uppercase">
                                      Bloqueado por solapamiento
                                    </span>
                                  </div>
                                </div>
                              );
                            });
                          })()}

                          {/* Standard Bookings Layer */}
                          {pitchBookings.map(({ booking, user, guest }) => {
                            const s = new Date(booking.startTime);
                            const e = new Date(booking.endTime);
                            const sBA = getBAHoursAndMinutes(s);
                            const eBA = getBAHoursAndMinutes(e);
                            const bStart = sBA.hour * 60 + sBA.minute;
                            const bEnd = eBA.hour * 60 + eBA.minute;

                            const timelineStart = startHour * 60;
                            const left = ((bStart - timelineStart) / slotMinutes) * SLOT_MIN_WIDTH_PX;
                            const width = ((bEnd - bStart) / slotMinutes) * SLOT_MIN_WIDTH_PX;

                            const name = guest?.name || user?.name || "—";
                            const isSubscription = booking.isSubscription;
                            const typeKey = booking.bookingType || (isSubscription ? "FIXED" : null);
                            const meta = typeKey ? TYPE_META[typeKey] : null;
                            const balance = booking.totalPrice - booking.paidAmount;
                            const cardClass = typeKey
                              ? TYPE_CARD[typeKey]
                              : STATUS_CARD[booking.status] || "border-slate-200 bg-white";

                            return (
                              <div
                                key={booking.id}
                                onClick$={() => onBookingClick$ && onBookingClick$(booking.id)}
                                style={{
                                  left: `${left}px`,
                                  width: `${width}px`,
                                  top: "8px",
                                  height: "calc(100% - 16px)",
                                }}
                                class={[
                                  "group absolute z-20 flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border-y border-r border-l-4 px-2.5 py-2 shadow-sm transition-all hover:z-30 hover:scale-[1.02] hover:shadow-lg",
                                  cardClass,
                                ]}
                              >
                                {/* Top: type pill + name + subscription icon */}
                                <div class="flex items-start justify-between gap-1 min-w-0">
                                  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                                    {meta && (
                                      <span class={["w-max rounded px-1 py-0 text-[8px] font-black tracking-widest uppercase", meta.pillBg, meta.pillText]}>
                                        {meta.abbr}
                                      </span>
                                    )}
                                    <span class={["truncate text-[12px] leading-tight font-black", meta ? meta.nameColor : "text-slate-800"]}>
                                      {name}
                                    </span>
                                  </div>
                                  {isSubscription && (
                                    <div class="mt-0.5 shrink-0 text-slate-400" title="Turno Fijo">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3M15.5 7.5 14 6" />
                                        <path d="M21 7V2h-5" />
                                      </svg>
                                    </div>
                                  )}
                                </div>

                                {/* Time */}
                                <div class="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  {fmt(booking.startTime)} — {fmt(booking.endTime)}
                                </div>

                                {/* Bottom: status badge + price */}
                                <div class="flex items-center justify-between gap-1">
                                  <span class={["rounded px-1.5 py-0.5 text-[8px] font-black tracking-wide uppercase whitespace-nowrap", STATUS_BADGE[booking.status] || "bg-slate-100 text-slate-600"]}>
                                    {STATUS_LABEL_SHORT[booking.status] || booking.status}
                                  </span>
                                  <div class="shrink-0 text-right">
                                    {balance > 0 ? (
                                      <span class="text-[11px] font-black text-amber-600">
                                        ${balance.toLocaleString("es-AR")}
                                        <span class="ml-0.5 text-[8px] font-bold text-slate-400 line-through">
                                          /{booking.totalPrice.toLocaleString("es-AR")}
                                        </span>
                                      </span>
                                    ) : (
                                      <span class={["text-[11px] font-black", booking.totalPrice === 0 ? "text-slate-400" : "text-emerald-600"]}>
                                        ${booking.totalPrice.toLocaleString("es-AR")}
                                      </span>
                                    )}
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
  },
);
