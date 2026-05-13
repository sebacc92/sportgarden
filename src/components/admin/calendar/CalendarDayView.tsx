import { component$, type Signal, type PropFunction, Fragment } from "@builder.io/qwik";
import { BookingSlot } from "~/components/admin/booking-slot";

interface CalendarDayViewProps {
  calendarData: any;
  hours: number[];
  pixelsPerHour: number;
  calendarStartHour: number;
  showCurrentTimeLine: Signal<boolean>;
  currentTimePosition: Signal<number>;
  scrollContainerRef: Signal<HTMLElement | undefined>;
  onBookingClick$: PropFunction<(id: string) => void>;
  onEmptySlotClick$: PropFunction<(pitchId: string, time: string) => void>;
}

export const CalendarDayView = component$<CalendarDayViewProps>((props) => {
  const { 
    calendarData, 
    hours, 
    pixelsPerHour, 
    calendarStartHour, 
    showCurrentTimeLine, 
    currentTimePosition, 
    scrollContainerRef, 
    onBookingClick$,
    onEmptySlotClick$
  } = props;

  return (
    <>
      {/* Pitches Header Row */}
      <div class="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
        <div class="w-16 shrink-0 border-r border-slate-200 flex items-center justify-center bg-slate-100">
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora</span>
        </div>
        {calendarData.pitches.map((pitch: any) => {
          const pitchBookingCount = calendarData.bookings.filter((b: any) => b.booking.pitchId === pitch.id).length;
          return (
            <div
              key={pitch.id}
              class="flex-1 text-center py-3 border-r border-slate-200 last:border-0"
            >
              <div class="font-black text-slate-800 text-sm">{pitch.name}</div>
              <div class="flex items-center justify-center gap-2 mt-0.5">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{pitch.type}</span>
                {pitchBookingCount > 0 && (
                  <span class="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    {pitchBookingCount} res.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar Grid Body */}
      <div
        ref={scrollContainerRef}
        class="flex relative bg-slate-50/30 overflow-y-auto flex-1"
      >
        {/* Time Column */}
        <div class="w-16 shrink-0 border-r border-slate-200 relative bg-white z-20">
          {hours.map((hour) => (
            <div
              key={hour}
              class="absolute w-full text-right pr-2 text-[11px] font-bold text-slate-300 -mt-2"
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
          {/* Current Time Indicator */}
          {showCurrentTimeLine.value && (
            <div
              class="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
              style={{ top: `${currentTimePosition.value}px` }}
            >
              <div class="w-2 h-2 rounded-full bg-red-500 -ml-1"></div>
              <div class="flex-1 border-t-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
            </div>
          )}

          {/* Horizontal Grid Lines */}
          {hours.map((hour) => (
            <Fragment key={`grid-${hour}`}>
              <div
                class="absolute w-full border-t border-slate-200 pointer-events-none"
                style={{
                  top: `${(hour - calendarStartHour) * pixelsPerHour}px`,
                }}
              ></div>
              <div
                class="absolute w-full border-t border-dashed pointer-events-none"
                style={{
                  top: `${(hour - calendarStartHour + 0.5) * pixelsPerHour}px`,
                  borderColor: 'rgba(148,163,184,0.2)',
                }}
              ></div>
            </Fragment>
          ))}

          {/* Pitch Columns */}
          {calendarData.pitches.map((pitch: any) => {
            const pitchBookings = calendarData.bookings.filter(
              (b: any) => b.booking.pitchId === pitch.id
            );
            return (
              <div
                key={pitch.id}
                class="flex-1 border-r border-slate-200 last:border-0 relative"
              >
                {/* Interactive background cells for express creation */}
                {hours.map((hour) => (
                  <div
                    key={`empty-${hour}`}
                    onClick$={() => {
                      const time = `${String(hour).padStart(2, "0")}:00`;
                      onEmptySlotClick$(pitch.id, time);
                    }}
                    class="absolute left-0 right-0 group cursor-pointer hover:bg-slate-100/80 flex items-center justify-center transition-all border-b border-slate-100/50 last:border-0"
                    style={{
                      top: `${(hour - calendarStartHour) * pixelsPerHour}px`,
                      height: `${pixelsPerHour}px`,
                    }}
                  >
                    <div class="w-8 h-8 rounded-full bg-white/80 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                  </div>
                ))}

                {pitchBookings.map(({ booking, user, guest }: any) => {
                  const customerName = guest?.name || user?.name || "Desconocido";
                  const customerPhone = guest?.phone || user?.phone || "";
                  return (
                    <BookingSlot
                      key={booking.id}
                      id={booking.id}
                      startTime={booking.startTime}
                      endTime={booking.endTime}
                      status={booking.status}
                      customerName={customerName}
                      customerPhone={customerPhone}
                      isSubscription={booking.isSubscription}
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
