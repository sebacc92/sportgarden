import { component$, type PropFunction } from "@builder.io/qwik";
import { cn } from "@qwik-ui/utils";

interface CalendarMonthViewProps {
  calendarData: any;
  monthDays: Date[];
  onBookingClick$: PropFunction<(id: string) => void>;
}

export const CalendarMonthView = component$<CalendarMonthViewProps>((props) => {
  const { calendarData, monthDays, onBookingClick$ } = props;

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
          const isToday = new Date().toDateString() === day.toDateString();

          const dayBookings = calendarData.bookings.filter((b: any) => {
            const bDate = new Date(b.booking.startTime);
            return bDate.toDateString() === day.toDateString();
          });

          return (
            <div
              key={idx}
              class={cn(
                "bg-white p-2 overflow-y-auto overflow-x-hidden flex flex-col gap-1",
                !isCurrentMonth ? "bg-slate-50 opacity-50" : "",
                isToday ? "bg-emerald-50/30" : ""
              )}
            >
              <div class={cn(
                "text-xs font-black self-end w-6 h-6 flex items-center justify-center rounded-full mb-1",
                isToday ? "bg-emerald-500 text-white shadow-md" : "text-slate-400"
              )}>
                {day.getDate()}
              </div>

              {dayBookings.map(({ booking, user, guest }: any) => {
                const customerName = guest?.name || user?.name || "Desconocido";
                const pitchName = calendarData.pitches.find((p: any) => p.id === booking.pitchId)?.name || "Cancha";
                const time = new Date(booking.startTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

                const statusColors = {
                  PENDING_APPROVAL: "bg-amber-100 text-amber-800 border-l-2 border-amber-400",
                  CONFIRMED: "bg-emerald-100 text-emerald-800 border-l-2 border-emerald-400",
                  CANCELLED: "bg-red-100 text-red-800 border-l-2 border-red-400",
                  COMPLETED: "bg-slate-100 text-slate-800 border-l-2 border-slate-400",
                };

                return (
                  <div
                    key={booking.id}
                    onClick$={() => onBookingClick$(booking.id)}
                    class={cn("text-[9px] p-1 rounded-sm leading-tight truncate shadow-sm cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all", statusColors[booking.status as keyof typeof statusColors])}
                    title={`${time} - ${customerName} (${pitchName})`}
                  >
                    <span class="font-bold opacity-70 mr-1">{time}</span>
                    <span class="font-black">{customerName}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});
