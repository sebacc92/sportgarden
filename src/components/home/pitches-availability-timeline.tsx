import {
  component$,
  useSignal,
  useComputed$,
  useVisibleTask$,
  useTask$,
  $,
} from "@builder.io/qwik";
import type { QRL } from "@builder.io/qwik";
import { getAllPitchesBookings } from "~/lib/home-page/loaders";
import { calculateProportionalPrice } from "~/utils/pricing";

const SLOT_MIN = 30;
const SLOT_PX = 72;
const PITCH_COL_W = 144;

type PricingRule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  price: number;
};

type Pitch = {
  id: string;
  name: string;
  type: string;
  isCovered: boolean;
  pricePerHour?: number;
  pricingRules?: PricingRule[];
};

type OperatingHour = {
  day: number;
  isClosed?: boolean;
  isOpen?: boolean;
  openTime?: string;
  closeTime?: string;
};

type Props = {
  pitches: Pitch[];
  operatingHours?: OperatingHour[];
  holidays?: { date: string; name: string }[];
  theme?: "light" | "dark";
  filter: "ALL" | "COVERED" | "UNCOVERED";
  onSlotClick$: QRL<(pitchId: string, dateStr: string, time: string, durationMins?: number) => void>;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayStr(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minToTimeStr(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dateLabel(dateStr: string): string {
  const today = todayStr();
  const tomorrow = todayStr(1);
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const short = `${days[d.getDay()]} ${day}/${month}`;
  if (dateStr === today) return `Hoy · ${short}`;
  if (dateStr === tomorrow) return `Mañana · ${short}`;
  return short;
}

function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function minHourlyPriceForDay(
  dateStr: string,
  basePrice: number,
  rules: PricingRule[] | undefined,
  holidayDates: string[],
): number {
  if (!rules || rules.length === 0) return basePrice;
  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  const dayOfWeek = holidayDates.includes(dateStr) ? 7 : d.getDay();
  const dayRules = rules.filter((r) => r.dayOfWeek === dayOfWeek);
  if (dayRules.length === 0) return basePrice;
  return Math.min(basePrice, ...dayRules.map((r) => r.price));
}

const DAY_ABBR = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function slotBooked(
  slots: { startTime: string; endTime: string }[],
  dateStr: string,
  slotTimeStr: string,
): boolean {
  const start = new Date(`${dateStr}T${slotTimeStr}:00`).getTime();
  const end = start + SLOT_MIN * 60_000;
  return slots.some((b) => {
    const bs = new Date(b.startTime).getTime();
    const be = new Date(b.endTime).getTime();
    return start < be && end > bs;
  });
}

function slotBookedForDuration(
  slots: { startTime: string; endTime: string }[],
  dateStr: string,
  slotTimeStr: string,
  durationMin = 60,
): boolean {
  const start = new Date(`${dateStr}T${slotTimeStr}:00`).getTime();
  const end = start + durationMin * 60_000;
  return slots.some((b) => {
    const bs = new Date(b.startTime).getTime();
    const be = new Date(b.endTime).getTime();
    return start < be && end > bs;
  });
}

function slotPast(dateStr: string, slotTimeStr: string): boolean {
  return new Date(`${dateStr}T${slotTimeStr}:00`) <= new Date();
}

// ─── component ────────────────────────────────────────────────────────────────

export const PitchesAvailabilityTimeline = component$<Props>((props) => {
  const selectedDate = useSignal(todayStr());
  const bookingsMap = useSignal<Record<string, { startTime: string; endTime: string }[]>>({});
  const isLoading = useSignal(true);
  const nowMinutes = useSignal(0);
  const selectedMobilePitch = useSignal(props.pitches[0]?.id || "");
  const scrollContainerRef = useSignal<Element>();

  // Drag state for the desktop gantt
  const dragState = useSignal<{
    pitchId: string;
    startIdx: number;
    endIdx: number;
  } | null>(null);

  const isLight = props.theme !== "dark";

  const holidayDates = useComputed$(() =>
    (props.holidays || []).map((h) => h.date)
  );

  const schedule = useComputed$(() => {
    const dateStr = selectedDate.value;
    const isHoliday = (props.holidays || []).some((h) => h.date === dateStr);
    const [year, month, day] = dateStr.split("-").map(Number);
    const dayOfWeek = isHoliday ? 7 : new Date(year, month - 1, day).getDay();
    const hours = props.operatingHours || [];
    const sched = hours.find((h) => h.day === dayOfWeek);
    const isClosed = !!(sched?.isClosed || (sched && sched.isOpen === false));

    const openMin = timeToMin(sched?.openTime || "08:00");
    let closeMin = timeToMin(sched?.closeTime || "23:00");
    if (closeMin === 0) closeMin = 24 * 60;

    const slotCount = Math.ceil((closeMin - openMin) / SLOT_MIN);
    const slots = Array.from({ length: slotCount }, (_, i) => {
      const m = openMin + i * SLOT_MIN;
      return { time: minToTimeStr(m), minutes: m };
    });

    const hours_labels: { time: string; slotIndex: number }[] = [];
    slots.forEach((s, i) => {
      if (i % 2 === 0) hours_labels.push({ time: s.time, slotIndex: i });
    });

    return { isClosed, openMin, closeMin, slots, hours_labels };
  });

  const filteredPitches = useComputed$(() => {
    const f = props.filter;
    if (f === "COVERED") return props.pitches.filter((p) => p.isCovered);
    if (f === "UNCOVERED") return props.pitches.filter((p) => !p.isCovered);
    return props.pitches;
  });

  // Reset mobile pitch selection when filter changes
  useTask$(({ track }) => {
    const pitched = track(() => filteredPitches.value);
    if (!pitched.some((p) => p.id === selectedMobilePitch.value)) {
      selectedMobilePitch.value = pitched[0]?.id || "";
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const date = track(() => selectedDate.value);
    isLoading.value = true;
    getAllPitchesBookings(date).then((data) => {
      bookingsMap.value = data;
      isLoading.value = false;
    });

    const update = () => {
      const now = new Date();
      nowMinutes.value = now.getHours() * 60 + now.getMinutes();
    };
    update();
    const interval = setInterval(update, 60_000);
    cleanup(() => clearInterval(interval));
  });

  // Auto-scroll to current time on today, or to start for future dates
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => isLoading.value);
    track(() => selectedDate.value);
    if (isLoading.value) return;

    const container = scrollContainerRef.value as HTMLElement | undefined;
    if (!container) return;

    if (selectedDate.value !== todayStr()) {
      container.scrollLeft = 0;
      return;
    }

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const openMin = timeToMin(
      (props.operatingHours || []).find((h) => {
        const isHoliday = (props.holidays || []).some((hol) => hol.date === selectedDate.value);
        const [yr, mo, dy] = selectedDate.value.split("-").map(Number);
        const dow = isHoliday ? 7 : new Date(yr, mo - 1, dy).getDay();
        return h.day === dow;
      })?.openTime || "08:00",
    );

    // Scroll so that ~1 hour before now is at the left edge
    const nowOffsetPx = ((nowMin - openMin) / SLOT_MIN) * SLOT_PX;
    container.scrollLeft = Math.max(0, nowOffsetPx - SLOT_PX * 2);
  });

  // Global mouseup → finalize drag and open booking modal
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const handleMouseUp = () => {
      const drag = dragState.value;
      if (!drag) return;
      const minIdx = Math.min(drag.startIdx, drag.endIdx);
      const maxIdx = Math.max(drag.startIdx, drag.endIdx);
      // Single click = 1 slot = default 60 min; drag = exact duration
      const durationMins = minIdx === maxIdx ? 60 : (maxIdx - minIdx + 1) * SLOT_MIN;
      const startSlot = schedule.value.slots[minIdx];
      if (startSlot) {
        props.onSlotClick$(drag.pitchId, selectedDate.value, startSlot.time, durationMins);
      }
      dragState.value = null;
    };
    window.addEventListener("mouseup", handleMouseUp);
    cleanup(() => window.removeEventListener("mouseup", handleMouseUp));
  });

  const navigateDate = $((dir: 1 | -1) => {
    const [y, mo, d] = selectedDate.value.split("-").map(Number);
    const next = new Date(y, mo - 1, d + dir);
    const minDate = new Date(todayStr());
    const maxDate = new Date(todayStr(6));
    if (next < minDate || next > maxDate) return;
    selectedDate.value = [
      next.getFullYear(),
      String(next.getMonth() + 1).padStart(2, "0"),
      String(next.getDate()).padStart(2, "0"),
    ].join("-");
  });

  const isToday = useComputed$(() => selectedDate.value === todayStr());
  const timelineWidth = useComputed$(() => schedule.value.slots.length * SLOT_PX);

  // Mobile: hourly slots only
  const mobileSlots = useComputed$(() =>
    schedule.value.slots.filter((s) => s.minutes % 60 === 0),
  );
  const mobilePitchBookings = useComputed$(
    () => bookingsMap.value[selectedMobilePitch.value] || [],
  );
  const mobilePitch = useComputed$(() =>
    filteredPitches.value.find((p) => p.id === selectedMobilePitch.value),
  );

  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const s = todayStr(i);
    const [y, mo, d] = s.split("-").map(Number);
    const jsD = new Date(y, mo - 1, d);
    return { dateStr: s, dayAbbr: DAY_ABBR[jsD.getDay()], day: d, monthAbbr: MONTH_ABBR[mo - 1] };
  });

  return (
    <div class="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* ═══════════════════════════════════════════════════════════
          MOBILE VIEW  (< md)
          ═══════════════════════════════════════════════════════════ */}
      <div class="block md:hidden">

        {/* Date strip */}
        <div class="overflow-x-auto border-b border-slate-100">
          <div class="flex gap-2 px-4 py-3" style="min-width: max-content">
            {dateStrip.map(({ dateStr, dayAbbr, day, monthAbbr }) => {
              const active = dateStr === selectedDate.value;
              return (
                <button
                  key={dateStr}
                  onClick$={() => (selectedDate.value = dateStr)}
                  class={[
                    "flex flex-col items-center rounded-xl px-3.5 py-2 transition-all",
                    active
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  ]}
                >
                  <span class="text-[10px] font-bold uppercase tracking-wider">
                    {dateStr === todayStr() ? "HOY" : dayAbbr}
                  </span>
                  <span class="text-2xl font-black leading-tight">{day}</span>
                  <span class="text-[10px] font-semibold uppercase">{monthAbbr}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pitch tabs */}
        {filteredPitches.value.length > 0 && (
          <div class="overflow-x-auto border-b border-slate-100 bg-slate-50">
            <div class="flex gap-2 px-4 py-2.5" style="min-width: max-content">
              {filteredPitches.value.map((pitch) => {
                const active = pitch.id === selectedMobilePitch.value;
                return (
                  <button
                    key={pitch.id}
                    onClick$={() => (selectedMobilePitch.value = pitch.id)}
                    class={[
                      "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all",
                      active
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300",
                    ]}
                  >
                    {pitch.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {schedule.value.isClosed && (
          <div class="flex flex-col items-center justify-center gap-2 py-14 text-slate-400">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            <p class="text-sm font-semibold">El club está cerrado este día</p>
          </div>
        )}

        {!schedule.value.isClosed && isLoading.value && (
          <div class="flex items-center justify-center gap-2 py-14 text-slate-400">
            <svg class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span class="text-sm font-medium">Cargando disponibilidad…</span>
          </div>
        )}

        {!schedule.value.isClosed && !isLoading.value && filteredPitches.value.length === 0 && (
          <div class="py-12 text-center text-sm text-slate-400">No hay canchas con ese filtro.</div>
        )}

        {!schedule.value.isClosed && !isLoading.value && filteredPitches.value.length > 0 && (
          <div class="p-4">
            {mobilePitch.value && (
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <p class="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {mobilePitch.value.type}
                    {mobilePitch.value.isCovered ? " · Techada" : " · Descubierta"}
                  </p>
                  <p class="text-sm font-black text-slate-800">{mobilePitch.value.name}</p>
                </div>
                {mobilePitch.value.pricePerHour && (
                  <div class="text-right">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Desde</p>
                    <p class="text-lg font-black text-slate-900">
                      ${minHourlyPriceForDay(
                        selectedDate.value,
                        mobilePitch.value.pricePerHour,
                        mobilePitch.value.pricingRules,
                        holidayDates.value,
                      ).toLocaleString("es-AR")}
                      <span class="text-xs font-semibold text-slate-400">/h</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div class="grid grid-cols-3 gap-2">
              {mobileSlots.value.map((slot) => {
                const booked = slotBookedForDuration(mobilePitchBookings.value, selectedDate.value, slot.time, 60);
                const past = slotPast(selectedDate.value, slot.time);
                const available = !booked && !past;
                return (
                  <button
                    key={slot.time}
                    disabled={!available}
                    onClick$={
                      available
                        ? $(() => props.onSlotClick$(selectedMobilePitch.value, selectedDate.value, slot.time, 60))
                        : undefined
                    }
                    class={[
                      "rounded-xl py-3.5 text-sm font-bold transition-all",
                      booked
                        ? "cursor-default bg-slate-100 text-slate-300"
                        : past
                          ? "cursor-not-allowed bg-slate-50 text-slate-200"
                          : "cursor-pointer border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white active:scale-95",
                    ]}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3">
              <span class="flex items-center gap-1.5 text-xs text-slate-400">
                <span class="inline-block h-3 w-5 rounded-sm bg-slate-100" />
                Ocupado
              </span>
              <span class="flex items-center gap-1.5 text-xs text-slate-400">
                <span class="inline-block h-3 w-5 rounded-sm border border-emerald-200 bg-emerald-50" />
                Disponible
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DESKTOP GANTT  (≥ md) — con drag para seleccionar duración
          ═══════════════════════════════════════════════════════════ */}
      <div class="hidden md:block">

        {/* Date navigation */}
        <div
          class={[
            "flex items-center justify-between border-b px-5 py-3",
            isLight ? "border-slate-100 bg-slate-50" : "border-white/5 bg-slate-900",
          ]}
        >
          <button
            onClick$={() => navigateDate(-1)}
            disabled={selectedDate.value === todayStr()}
            class={[
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              selectedDate.value === todayStr()
                ? "cursor-not-allowed text-slate-300"
                : isLight
                  ? "text-slate-600 hover:bg-slate-200"
                  : "text-slate-400 hover:bg-slate-800",
            ]}
            aria-label="Día anterior"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>

          <div class="flex flex-col items-center gap-0.5">
            <span class={["text-sm font-bold tracking-wide", isLight ? "text-slate-800" : "text-white"]}>
              {dateLabel(selectedDate.value)}
            </span>
            {!dragState.value && (
              <span class="text-[11px] text-slate-400">Click para reservar · Arrastrá para elegir duración</span>
            )}
            {dragState.value && (() => {
              const minI = Math.min(dragState.value.startIdx, dragState.value.endIdx);
              const maxI = Math.max(dragState.value.startIdx, dragState.value.endIdx);
              const dur = minI === maxI ? 60 : (maxI - minI + 1) * SLOT_MIN;
              return (
                <span class="text-[11px] font-bold text-emerald-600">
                  Seleccionando {durationLabel(dur)} — soltá para reservar
                </span>
              );
            })()}
          </div>

          <button
            onClick$={() => navigateDate(1)}
            disabled={selectedDate.value === todayStr(6)}
            class={[
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              selectedDate.value === todayStr(6)
                ? "cursor-not-allowed text-slate-300"
                : isLight
                  ? "text-slate-600 hover:bg-slate-200"
                  : "text-slate-400 hover:bg-slate-800",
            ]}
            aria-label="Día siguiente"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        {/* Closed day */}
        {schedule.value.isClosed && (
          <div class="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
            <p class="font-semibold">El club está cerrado este día</p>
          </div>
        )}

        {/* Loading */}
        {!schedule.value.isClosed && isLoading.value && (
          <div class="flex items-center justify-center gap-3 py-12 text-slate-400">
            <svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            <span class="text-sm font-medium">Cargando disponibilidad…</span>
          </div>
        )}

        {/* Timeline */}
        {!schedule.value.isClosed && !isLoading.value && (
          <div
            ref={scrollContainerRef}
            class={dragState.value ? "overflow-x-auto select-none" : "overflow-x-auto"}
          >
            <div style={`min-width: ${PITCH_COL_W + timelineWidth.value + 1}px`}>
              {/* Hour labels header */}
              <div class="flex border-b border-slate-100">
                <div
                  class="shrink-0 border-r border-slate-100 bg-slate-50"
                  style={`width: ${PITCH_COL_W}px`}
                />
                <div class="relative flex" style={`width: ${timelineWidth.value}px`}>
                  {schedule.value.hours_labels.map((lbl) => (
                    <div
                      key={lbl.time}
                      class="absolute top-0 flex h-full items-center justify-start pl-1.5"
                      style={`left: ${lbl.slotIndex * SLOT_PX}px; width: ${SLOT_PX * 2}px`}
                    >
                      <span class="text-[11px] font-bold text-slate-400">{lbl.time}</span>
                    </div>
                  ))}
                  <div class="h-7 w-full" />
                </div>
              </div>

              {/* Pitch rows */}
              {filteredPitches.value.length === 0 ? (
                <div class="py-12 text-center text-sm text-slate-400">No hay canchas con ese filtro.</div>
              ) : (
                filteredPitches.value.map((pitch, rowIdx) => {
                  const bookedSlots = bookingsMap.value[pitch.id] || [];

                  // Compute drag bounds for this pitch row
                  const drag = dragState.value;
                  const dragMinI = drag && drag.pitchId === pitch.id ? Math.min(drag.startIdx, drag.endIdx) : -1;
                  const dragMaxI = drag && drag.pitchId === pitch.id ? Math.max(drag.startIdx, drag.endIdx) : -1;
                  const isDraggingThisRow = dragMinI >= 0;

                  return (
                    <div
                      key={pitch.id}
                      class={[
                        "flex border-b last:border-b-0",
                        isLight ? "border-slate-100" : "border-white/5",
                        rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50",
                      ]}
                    >
                      {/* Pitch name — sticky */}
                      <div
                        class={[
                          "sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r px-4 py-3",
                          isLight ? "border-slate-100 bg-inherit" : "border-white/5 bg-slate-950",
                        ]}
                        style={`width: ${PITCH_COL_W}px`}
                      >
                        <span class={["text-sm font-black leading-tight", isLight ? "text-slate-800" : "text-white"]}>
                          {pitch.name}
                        </span>
                        <span class="text-[11px] font-semibold text-slate-400">
                          {pitch.type}{pitch.isCovered ? " · Techada" : ""}
                        </span>
                      </div>

                      {/* Slots */}
                      <div class="relative flex" style={`width: ${timelineWidth.value}px`}>
                        {schedule.value.slots.map((slot, si) => {
                          const booked = slotBooked(bookedSlots, selectedDate.value, slot.time);
                          const past = slotPast(selectedDate.value, slot.time);
                          const available = !booked && !past;
                          const isHourBoundary = si % 2 === 0;
                          const inDragRange = isDraggingThisRow && si >= dragMinI && si <= dragMaxI;

                          return (
                            <div
                              key={slot.time}
                              class={[
                                "group relative shrink-0 transition-colors",
                                isHourBoundary
                                  ? isLight ? "border-l border-slate-200" : "border-l border-white/10"
                                  : isLight ? "border-l border-slate-100" : "border-l border-white/5",
                                inDragRange
                                  ? "cursor-crosshair bg-emerald-200"
                                  : booked
                                    ? "cursor-default bg-slate-200"
                                    : past
                                      ? "cursor-not-allowed bg-slate-100"
                                      : available
                                        ? "cursor-crosshair hover:bg-emerald-50 active:bg-emerald-100"
                                        : "",
                              ]}
                              style={`width: ${SLOT_PX}px; height: 52px`}
                              title={
                                inDragRange
                                  ? undefined
                                  : booked
                                    ? "Ocupado"
                                    : past
                                      ? "Horario pasado"
                                      : `Reservar ${pitch.name} a las ${slot.time} — arrastrá para elegir duración`
                              }
                              onMouseDown$={
                                available
                                  ? $(() => {
                                      dragState.value = { pitchId: pitch.id, startIdx: si, endIdx: si };
                                    })
                                  : undefined
                              }
                              onMouseEnter$={$(() => {
                                if (dragState.value && dragState.value.pitchId === pitch.id) {
                                  dragState.value = { ...dragState.value, endIdx: si };
                                }
                              })}
                            >
                              {/* "Ocupado" label */}
                              {booked && si % 2 === 0 && (
                                <span class="pointer-events-none absolute inset-0 hidden items-center justify-center text-[10px] font-bold text-slate-400 sm:flex">
                                  Ocupado
                                </span>
                              )}
                              {/* Price hint on hover */}
                              {!booked && !past && !inDragRange && pitch.pricePerHour && (
                                <span class="pointer-events-none absolute inset-0 hidden items-center justify-center text-[10px] font-black text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
                                  ${calculateProportionalPrice(
                                    selectedDate.value,
                                    slot.time,
                                    SLOT_MIN,
                                    pitch.pricePerHour,
                                    pitch.pricingRules || [],
                                    holidayDates.value,
                                  ).toLocaleString("es-AR")}
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {/* Drag duration badge */}
                        {isDraggingThisRow && (() => {
                          const rawDur = (dragMaxI - dragMinI + 1) * SLOT_MIN;
                          const dur = dragMinI === dragMaxI ? 60 : rawDur;
                          const leftPx = dragMinI * SLOT_PX;
                          const widthPx = (dragMaxI - dragMinI + 1) * SLOT_PX;
                          return (
                            <div
                              class="pointer-events-none absolute inset-y-0 z-30 flex items-center justify-center"
                              style={`left: ${leftPx}px; width: ${widthPx}px`}
                            >
                              <span class="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[12px] font-black text-white shadow-lg ring-2 ring-white">
                                {durationLabel(dur)}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Current time indicator */}
                        {isToday.value && (() => {
                          const { openMin, closeMin } = schedule.value;
                          if (nowMinutes.value < openMin || nowMinutes.value > closeMin) return null;
                          const leftPx = ((nowMinutes.value - openMin) / SLOT_MIN) * SLOT_PX;
                          return (
                            <div
                              class="pointer-events-none absolute top-0 z-20 h-full w-0.5 bg-emerald-500 shadow-sm shadow-emerald-300"
                              style={`left: ${leftPx}px`}
                            >
                              <div class="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-emerald-500" />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        {!schedule.value.isClosed && !isLoading.value && (
          <div class="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 px-5 py-3">
            <span class="flex items-center gap-1.5 text-xs text-slate-500">
              <span class="inline-block h-3 w-5 rounded-sm bg-slate-200" />
              Ocupado
            </span>
            <span class="flex items-center gap-1.5 text-xs text-slate-500">
              <span class="inline-block h-3 w-5 rounded-sm border border-emerald-200 bg-emerald-50" />
              Disponible — click o arrastrá para elegir duración
            </span>
            <span class="flex items-center gap-1.5 text-xs text-slate-500">
              <span class="inline-block h-3 w-5 rounded-sm bg-emerald-200" />
              Seleccionado
            </span>
            {isToday.value && (
              <span class="flex items-center gap-1.5 text-xs text-slate-500">
                <span class="inline-block h-3 w-0.5 rounded-full bg-emerald-500" />
                Ahora
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
