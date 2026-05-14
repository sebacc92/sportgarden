import { component$, type PropFunction } from "@builder.io/qwik";
import { cn } from "@qwik-ui/utils";
import { getBAFormatDate } from "~/routes/admin/calendar/utils";

interface CalendarMonthViewProps {
  calendarData: any;
  monthDays: Date[];
  onDayClick$: PropFunction<(dateStr: string) => void>;
}

export const CalendarMonthView = component$<CalendarMonthViewProps>((props) => {
  const { calendarData, monthDays, onDayClick$ } = props;

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Days Header */}
      <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50 shrink-0">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
          <div key={d} class="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 last:border-0">
            {d}
          </div>
        ))}
      </div>

      {/* Month Grid */}
      <div class="flex-1 grid grid-cols-7 grid-rows-5 bg-slate-200 gap-[1px]">
        {monthDays.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === new Date(calendarData.startDateStr).getMonth();
          const isToday = getBAFormatDate(new Date()) === getBAFormatDate(day);
          const dateStr = getBAFormatDate(day);
          
          const totalBookings = calendarData.monthCounts?.[dateStr] || 0;

          return (
            <div
              key={idx}
              class={cn(
                "bg-white p-3 flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors group",
                !isCurrentMonth ? "bg-slate-50 opacity-50" : "",
                isToday ? "bg-emerald-50/30" : ""
              )}
              onClick$={() => {
                onDayClick$(dateStr);
              }}
            >
              <div class="flex items-start justify-end">
                <div class={cn(
                  "text-xs font-black w-7 h-7 flex items-center justify-center rounded-full transition-transform group-hover:scale-110",
                  isToday ? "bg-emerald-500 text-white shadow-md" : "text-slate-400 bg-slate-100 group-hover:bg-slate-200"
                )}>
                  {day.getDate()}
                </div>
              </div>

              <div class="mt-auto">
                {totalBookings > 0 ? (
                  <div class="w-full text-center py-1.5 px-2 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm text-xs font-black truncate">
                    {totalBookings} Reserva{totalBookings !== 1 && 's'}
                  </div>
                ) : (
                  <div class="w-full text-center py-1.5 px-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Sin reservas
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
