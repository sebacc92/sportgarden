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
    <div class="flex h-full flex-col overflow-hidden">
      {/* Days Header */}
      <div class="grid shrink-0 grid-cols-7 border-b border-slate-200 bg-slate-50">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div
            key={d}
            class="border-r border-slate-200 py-3 text-center text-[10px] font-black tracking-widest text-slate-400 uppercase last:border-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Month Grid */}
      <div class="grid flex-1 grid-cols-7 grid-rows-5 gap-[1px] bg-slate-200">
        {monthDays.map((day, idx) => {
          const isCurrentMonth =
            day.getMonth() === new Date(calendarData.startDateStr).getMonth();
          const isToday = getBAFormatDate(new Date()) === getBAFormatDate(day);
          const dateStr = getBAFormatDate(day);

          const totalBookings = calendarData.monthCounts?.[dateStr] || 0;

          return (
            <div
              key={idx}
              class={cn(
                "group flex cursor-pointer flex-col justify-between bg-white p-3 transition-colors hover:bg-slate-50",
                !isCurrentMonth ? "bg-slate-50 opacity-50" : "",
                isToday ? "bg-emerald-50/30" : "",
              )}
              onClick$={() => {
                onDayClick$(dateStr);
              }}
            >
              <div class="flex items-start justify-end">
                <div
                  class={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition-transform group-hover:scale-110",
                    isToday
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-400 group-hover:bg-slate-200",
                  )}
                >
                  {day.getDate()}
                </div>
              </div>

              <div class="mt-auto">
                {totalBookings > 0 ? (
                  <div class="w-full truncate rounded-lg border border-emerald-200 bg-emerald-100 px-2 py-1.5 text-center text-xs font-black text-emerald-700 shadow-sm">
                    {totalBookings} Reserva{totalBookings !== 1 && "s"}
                  </div>
                ) : (
                  <div class="w-full px-2 py-1.5 text-center text-[10px] font-bold tracking-widest text-slate-300 uppercase opacity-0 transition-opacity group-hover:opacity-100">
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
