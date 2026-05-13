import { component$, type Signal, type PropFunction } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { cn } from "@qwik-ui/utils";
import { getBAFormatDate, getWeekName, getMonthName } from "~/routes/admin/calendar/utils";

interface CalendarToolbarProps {
  calendarData: any;
  layoutMode: Signal<'timeline' | 'list' | 'grid'>;
  isCreateModalOpen: Signal<boolean>;
  onViewChange$: PropFunction<(newView: string) => void>;
  onNewBooking$: PropFunction<() => void>;
}

export const CalendarToolbar = component$<CalendarToolbarProps>((props) => {
  const { calendarData, layoutMode, onViewChange$, onNewBooking$ } = props;

  return (
    <div class="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0 gap-4">
      {/* Left: Title + count */}
      <div class="flex items-center gap-3 shrink-0">
        <h1 class="text-base font-black text-slate-800">Reservas</h1>
        <div class="w-px h-5 bg-slate-200"></div>
        <span class="text-xs font-bold text-slate-400">
          <span class="text-slate-800 font-black">{calendarData.bookings.length}</span> reservas
        </span>
      </div>

      {/* Center: Big date with flanking arrows */}
      <div class="flex items-center gap-3">
        <Link
          href={`?date=${calendarData.prevDateStr}&view=${calendarData.view}`}
          class="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-500 hover:text-slate-800 transition-all shadow-sm"
          title="Anterior"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </Link>

        <div class="text-center min-w-[280px]">
          {calendarData.view === "day" && (
            <div class="text-2xl font-black text-slate-800 capitalize leading-tight">
              {new Date(calendarData.selectedDateStr + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          )}
          {calendarData.view === "week" && (
            <div class="text-xl font-black text-slate-800 leading-tight">
              {getWeekName(calendarData.startDateStr, calendarData.endDateStr)}
            </div>
          )}
          {calendarData.view === "month" && (
            <div class="text-xl font-black text-slate-800 capitalize leading-tight">
              {getMonthName(calendarData.selectedDateStr)}
            </div>
          )}
        </div>

        <Link
          href={`?date=${calendarData.nextDateStr}&view=${calendarData.view}`}
          class="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-500 hover:text-slate-800 transition-all shadow-sm"
          title="Siguiente"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </Link>

        {calendarData.selectedDateStr !== calendarData.todayStr && (
          <Link
            href={`?date=${calendarData.todayStr}&view=${calendarData.view}`}
            class="px-3 py-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all uppercase tracking-widest ml-1"
          >
            Hoy
          </Link>
        )}
      </div>

      {/* Right: Layout toggle + View Switcher + New Reservation */}
      <div class="flex items-center gap-3 shrink-0">
        <button
          onClick$={() => onNewBooking$()}
          class="px-4 py-1.5 text-xs font-black text-white bg-emerald-500 rounded-lg shadow-sm hover:bg-emerald-600 transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
          Nueva Reserva
        </button>

        {/* Layout Mode Toggle */}
        <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick$={() => layoutMode.value = 'timeline'}
            disabled={calendarData.view !== 'day'}
            class={cn(
              "w-8 h-8 flex items-center justify-center rounded-md transition-all",
              layoutMode.value === 'timeline' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-700",
              calendarData.view !== 'day' && "opacity-30 cursor-not-allowed"
            )}
            title="Vista cronograma"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <rect x="3" y="10" width="11" height="4" rx="1" />
              <rect x="3" y="16" width="15" height="4" rx="1" />
            </svg>
          </button>
          <button
            onClick$={() => layoutMode.value = 'list'}
            disabled={calendarData.view !== 'day'}
            class={cn(
              "w-8 h-8 flex items-center justify-center rounded-md transition-all",
              layoutMode.value === 'list' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-700",
              calendarData.view !== 'day' && "opacity-30 cursor-not-allowed"
            )}
            title="Vista lista"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <button
            onClick$={() => layoutMode.value = 'grid'}
            class={cn("w-8 h-8 flex items-center justify-center rounded-md transition-all", layoutMode.value === 'grid' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-700")}
            title="Vista grilla"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
        </div>

        <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick$={() => onViewChange$("day")}
            class={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", calendarData.view === "day" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800")}
          >
            Día
          </button>
          <button
            onClick$={() => onViewChange$("week")}
            class={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", calendarData.view === "week" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800")}
          >
            Semana
          </button>
          <button
            onClick$={() => onViewChange$("month")}
            class={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", calendarData.view === "month" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800")}
          >
            Mes
          </button>
        </div>
      </div>
    </div>
  );
});
