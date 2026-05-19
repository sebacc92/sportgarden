import { component$, type Signal, type PropFunction } from "@builder.io/qwik";
import { cn } from "@qwik-ui/utils";
import { BookingSlot } from "~/components/admin/booking-slot";
import { getBAFormatDate } from "~/routes/admin/calendar/utils";

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
  onEmptySlotClick$: PropFunction<(dateStr: string, time: string) => void>;
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
    onBookingClick$,
    onEmptySlotClick$,
  } = props;

  return (
    <>
      {/* Days Header Row */}
      <div class="sticky top-0 z-30 flex border-b border-slate-200 bg-slate-50">
        <div class="flex w-20 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-100">
          <span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
            Hora
          </span>
        </div>
        {weekDays.map((day, idx) => {
          const isToday = getBAFormatDate(new Date()) === getBAFormatDate(day);
          return (
            <div
              key={idx}
              class={cn(
                "flex-1 border-r border-slate-200 py-4 text-center last:border-0",
                isToday ? "bg-emerald-50/50" : "",
              )}
            >
              <div
                class={cn(
                  "font-black tracking-tight uppercase",
                  isToday ? "text-emerald-700" : "text-slate-800",
                )}
              >
                {day.toLocaleDateString("es-ES", { weekday: "short" })}
              </div>
              <div
                class={cn(
                  "mt-1 text-[20px] font-black",
                  isToday ? "text-emerald-600" : "text-slate-400",
                )}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar Grid Body */}
      <div
        ref={scrollContainerRef}
        class="relative flex overflow-y-auto bg-slate-50/30"
        style={{ height: `${hours.length * pixelsPerHour}px` }}
      >
        {/* Time Column */}
        <div class="relative z-20 w-20 shrink-0 border-r border-slate-200 bg-slate-50/80 backdrop-blur-sm">
          {hours.map((hour) => {
            const h = Math.floor(hour);
            const m = Math.round((hour % 1) * 60);
            return (
              <div
                key={hour}
                class="absolute -mt-2 w-full pr-3 text-right text-xs font-bold text-slate-400"
                style={{
                  top: `${(hour - calendarStartHour) * pixelsPerHour}px`,
                }}
              >
                {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
              </div>
            );
          })}
        </div>

        {/* Main Grid and Columns */}
        <div class="relative flex flex-1">
          {showCurrentTimeLine.value && (
            <div
              class="pointer-events-none absolute right-0 left-0 z-20 flex items-center"
              style={{ top: `${currentTimePosition.value}px` }}
            >
              <div class="-ml-1 h-2 w-2 rounded-full bg-red-500"></div>
              <div class="flex-1 border-t-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
            </div>
          )}

          {hours.map((hour) => (
            <div
              key={`line-${hour}`}
              class="pointer-events-none absolute w-full border-t border-slate-200"
              style={{ top: `${(hour - calendarStartHour) * pixelsPerHour}px` }}
            ></div>
          ))}
          {hours.map((hour) => (
            <div
              key={`line-half-${hour}`}
              class="pointer-events-none absolute w-full border-t border-dashed"
              style={{
                top: `${(hour - calendarStartHour + 0.5) * pixelsPerHour}px`,
                borderColor: "rgba(148,163,184,0.2)",
              }}
            ></div>
          ))}

          {/* Day Columns */}
          {weekDays.map((day, idx) => {
            const dayBookings = calendarData.bookings.filter((b: any) => {
              const bDate = new Date(b.booking.startTime);
              return getBAFormatDate(bDate) === getBAFormatDate(day);
            });

            const isToday =
              getBAFormatDate(new Date()) === getBAFormatDate(day);

            return (
              <div
                key={idx}
                class={cn(
                  "relative flex-1 border-r border-slate-200 last:border-0",
                  isToday ? "bg-emerald-50/10" : "",
                )}
              >
                {/* Interactive background cells for express creation */}
                {hours.map((hour) => (
                  <div
                    key={`empty-${hour}`}
                    onClick$={() => {
                      const time = `${String(hour).padStart(2, "0")}:00`;
                      const dateStr = getBAFormatDate(day);
                      onEmptySlotClick$(dateStr, time);
                    }}
                    class="group absolute right-0 left-0 flex cursor-pointer items-center justify-center border-b border-slate-100/50 transition-all last:border-0 hover:bg-slate-100/80"
                    style={{
                      top: `${(hour - calendarStartHour) * pixelsPerHour}px`,
                      height: `${pixelsPerHour}px`,
                    }}
                  >
                    <div class="flex h-6 w-6 scale-75 items-center justify-center rounded-full bg-white/80 text-slate-400 opacity-0 shadow-sm transition-all group-hover:scale-100 group-hover:opacity-100">
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
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </div>
                  </div>
                ))}

                {dayBookings.map(({ booking, user, guest }: any) => {
                  const customerName =
                    guest?.name || user?.name || "Desconocido";
                  const customerPhone = guest?.phone || user?.phone || "";
                  const pitchName =
                    calendarData.pitches.find(
                      (p: any) => p.id === booking.pitchId,
                    )?.name || "Cancha";
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
                      isSubscription={booking.isSubscription}
                      bookingType={booking.bookingType}
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
