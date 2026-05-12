import { component$, type Signal, type PropFunction } from "@builder.io/qwik";
import { cn } from "@qwik-ui/utils";
import { BookingSlot } from "~/components/admin/booking-slot";

interface CalendarWeekViewProps {
  calendarData: any;
  weekDays: Date[];
  hours: number[];
  pixelsPerHour: number;
  calendarStartHour: number;
  showCurrentTimeLine: Signal<boolean>;
  currentTimePosition: Signal<number>;
  scrollContainerRef: Signal<HTMLElement | undefined>;
  onBookingClick$: PropFunction<(id: string) => void>;
}

export const CalendarWeekView = component$<CalendarWeekViewProps>((props) => {
  const { 
    calendarData, 
    weekDays, 
    hours, 
    pixelsPerHour, 
    calendarStartHour, 
    showCurrentTimeLine, 
    currentTimePosition, 
    scrollContainerRef, 
    onBookingClick$ 
  } = props;

  return (
    <>
      {/* Days Header Row */}
      <div class="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
        <div class="w-20 shrink-0 border-r border-slate-200 flex items-center justify-center bg-slate-100">
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora</span>
        </div>
        {weekDays.map((day, idx) => {
          const isToday = new Date().toDateString() === day.toDateString();
          return (
            <div
              key={idx}
              class={cn(
                "flex-1 text-center py-4 border-r border-slate-200 last:border-0",
                isToday ? "bg-emerald-50/50" : ""
              )}
            >
              <div class={cn("font-black uppercase tracking-tight", isToday ? "text-emerald-700" : "text-slate-800")}>
                {day.toLocaleDateString('es-ES', { weekday: 'short' })}
              </div>
              <div class={cn("text-[20px] font-black mt-1", isToday ? "text-emerald-600" : "text-slate-400")}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar Grid Body */}
      <div
        ref={scrollContainerRef}
        class="flex relative bg-slate-50/30 overflow-y-auto"
        style={{ height: `${hours.length * pixelsPerHour}px` }}
      >
        {/* Time Column */}
        <div class="w-20 shrink-0 border-r border-slate-200 relative bg-slate-50/80 backdrop-blur-sm z-20">
          {hours.map((hour) => (
            <div
              key={hour}
              class="absolute w-full text-right pr-3 text-xs font-bold text-slate-400 -mt-2"
              style={{
                top: `${(hour - calendarStartHour) * pixelsPerHour}px`,
              }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Main Grid and Columns */}
        <div class="flex flex-1 relative">
          {showCurrentTimeLine.value && (
            <div
              class="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
              style={{ top: `${currentTimePosition.value}px` }}
            >
              <div class="w-2 h-2 rounded-full bg-red-500 -ml-1"></div>
              <div class="flex-1 border-t-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
            </div>
          )}

          {hours.map((hour) => (
            <div key={`line-${hour}`} class="absolute w-full border-t border-slate-200 pointer-events-none" style={{ top: `${(hour - calendarStartHour) * pixelsPerHour}px` }}></div>
          ))}
          {hours.map((hour) => (
            <div key={`line-half-${hour}`} class="absolute w-full border-t border-dashed pointer-events-none" style={{ top: `${(hour - calendarStartHour + 0.5) * pixelsPerHour}px`, borderColor: 'rgba(148,163,184,0.2)' }}></div>
          ))}

          {/* Day Columns */}
          {weekDays.map((day, idx) => {
            const dayBookings = calendarData.bookings.filter((b: any) => {
              const bDate = new Date(b.booking.startTime);
              return bDate.toDateString() === day.toDateString();
            });

            const isToday = new Date().toDateString() === day.toDateString();

            return (
              <div
                key={idx}
                class={cn("flex-1 border-r border-slate-200 last:border-0 relative hover:bg-slate-50/80 transition-colors", isToday ? "bg-emerald-50/10" : "")}
              >
                {dayBookings.map(({ booking, user, guest }: any) => {
                  const customerName = guest?.name || user?.name || "Desconocido";
                  const customerPhone = guest?.phone || user?.phone || "";
                  const pitchName = calendarData.pitches.find((p: any) => p.id === booking.pitchId)?.name || "Cancha";
                  return (
                    <BookingSlot
                      key={booking.id}
                      id={booking.id}
                      startTime={booking.startTime}
                      endTime={booking.endTime}
                      status={booking.status}
                      customerName={customerName}
                      customerPhone={customerPhone}
                      pitchName={pitchName}
                      calendarStartHour={calendarStartHour}
                      pixelsPerHour={pixelsPerHour}
                      onClick$={onBookingClick$}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
});
