import { component$, type Signal, type PropFunction } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { cn } from "@qwik-ui/utils";
import { getWeekName, getMonthName, playNotificationBeep } from "~/routes/admin/calendar/utils";

interface CalendarToolbarProps {
  calendarData: any;
  layoutMode: Signal<"timeline" | "list" | "grid">;
  isCreateModalOpen: Signal<boolean>;
  isPrintModalOpen: Signal<boolean>;
  isSoundEnabled: Signal<boolean>;
  onViewChange$: PropFunction<(newView: string) => void>;
  onNewBooking$: PropFunction<() => void>;
}

export const CalendarToolbar = component$<CalendarToolbarProps>((props) => {
  const {
    calendarData,
    layoutMode,
    isPrintModalOpen,
    isSoundEnabled,
    onViewChange$,
    onNewBooking$,
  } = props;

  return (
    <div class="z-10 flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
      {/* Left: Title + count */}
      <div class="flex shrink-0 items-center gap-3">
        <h1 class="text-base font-black text-slate-800">Reservas</h1>
        <div class="h-5 w-px bg-slate-200"></div>
        <span class="text-sm font-bold text-slate-400">
          <span class="text-lg font-black text-slate-800">
            {calendarData.bookings.length}
          </span>{" "}
          reservas
        </span>
      </div>

      {/* Center: Big date with flanking arrows */}
      <div class="flex items-center gap-3">
        <Link
          href={`?date=${calendarData.prevDateStr}&view=${calendarData.view}`}
          class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
          title="Anterior"
        >
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
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>

        <div class="min-w-[280px] text-center">
          {calendarData.view === "day" && (
            <div class="text-2xl leading-tight font-black text-slate-800 capitalize">
              {new Date(
                calendarData.selectedDateStr + "T00:00:00",
              ).toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          )}
          {calendarData.view === "week" && (
            <div class="text-xl leading-tight font-black text-slate-800">
              {getWeekName(calendarData.startDateStr, calendarData.endDateStr)}
            </div>
          )}
          {calendarData.view === "month" && (
            <div class="text-xl leading-tight font-black text-slate-800 capitalize">
              {getMonthName(calendarData.selectedDateStr)}
            </div>
          )}
        </div>

        <Link
          href={`?date=${calendarData.nextDateStr}&view=${calendarData.view}`}
          class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
          title="Siguiente"
        >
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
        </Link>

        {calendarData.selectedDateStr !== calendarData.todayStr && (
          <Link
            href={`?date=${calendarData.todayStr}&view=${calendarData.view}`}
            class="ml-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black tracking-widest text-emerald-700 uppercase transition-all hover:bg-emerald-100"
          >
            Ir a HOY
          </Link>
        )}
      </div>

      {/* Right: Layout toggle + View Switcher + New Reservation */}
      <div class="flex shrink-0 items-center gap-3">
        {/* Sound Notifications Toggle */}
        <button
          type="button"
          onClick$={() => {
            isSoundEnabled.value = !isSoundEnabled.value;
            if (isSoundEnabled.value) {
              playNotificationBeep();
            }
          }}
          class={cn(
            "flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold shadow-sm transition-all",
            isSoundEnabled.value
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 font-black"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
          )}
          title={isSoundEnabled.value ? "Desactivar alertas sonoras" : "Activar alertas sonoras"}
        >
          {isSoundEnabled.value ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
              <span>Alertas: ON</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
              <span>Alertas: OFF</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick$={() => onNewBooking$()}
          class="flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-600"
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
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          Nueva Reserva
        </button>

        {calendarData.view === "day" && (
          <button
            type="button"
            onClick$={() => (isPrintModalOpen.value = true)}
            class="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
            title="Imprimir agenda del día"
          >
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
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Imprimir
          </button>
        )}

        {/* Layout Mode Toggle */}
        <div class="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            onClick$={() => (layoutMode.value = "timeline")}
            disabled={calendarData.view !== "day"}
            class={cn(
              "flex h-8 w-8 items-center justify-center rounded-md transition-all",
              layoutMode.value === "timeline"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-400 hover:text-slate-700",
              calendarData.view !== "day" && "cursor-not-allowed opacity-30",
            )}
            title="Vista cronograma"
          >
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
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <rect x="3" y="10" width="11" height="4" rx="1" />
              <rect x="3" y="16" width="15" height="4" rx="1" />
            </svg>
          </button>
          <button
            onClick$={() => (layoutMode.value = "list")}
            disabled={calendarData.view !== "day"}
            class={cn(
              "flex h-8 w-8 items-center justify-center rounded-md transition-all",
              layoutMode.value === "list"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-400 hover:text-slate-700",
              calendarData.view !== "day" && "cursor-not-allowed opacity-30",
            )}
            title="Vista lista"
          >
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
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none" />
              <circle
                cx="3"
                cy="12"
                r="1.5"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="3"
                cy="18"
                r="1.5"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </button>
        </div>

        <div class="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            onClick$={() => onViewChange$("day")}
            class={cn(
              "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
              calendarData.view === "day"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            Día
          </button>
          <button
            onClick$={() => onViewChange$("week")}
            class={cn(
              "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
              calendarData.view === "week"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            Semana
          </button>
          <button
            onClick$={() => onViewChange$("month")}
            class={cn(
              "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
              calendarData.view === "month"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            Mes
          </button>
        </div>
      </div>
    </div>
  );
});
