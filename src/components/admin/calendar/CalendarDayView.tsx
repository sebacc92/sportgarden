import {
  component$,
  type Signal,
  type PropFunction,
  Fragment,
} from "@builder.io/qwik";
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
    onEmptySlotClick$,
  } = props;

  return (
    <>
      {/* Pitches Header Row */}
      <div class="sticky top-0 z-30 flex border-b border-slate-200 bg-slate-50">
        <div class="flex w-16 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-100">
          <span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
            Hora
          </span>
        </div>
        {calendarData.pitches.map((pitch: any) => {
          const pitchBookingCount = calendarData.bookings.filter(
            (b: any) => b.booking.pitchId === pitch.id,
          ).length;
          return (
            <div
              key={pitch.id}
              class="flex-1 border-r border-slate-200 py-3 text-center last:border-0"
            >
              <div class="text-sm font-black text-slate-800">{pitch.name}</div>
              <div class="mt-0.5 flex items-center justify-center gap-2">
                <span class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  {pitch.type}
                </span>
                {pitchBookingCount > 0 && (
                  <span class="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-600">
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
        class="relative flex flex-1 overflow-y-auto bg-slate-50/30"
      >
        {/* Time Column */}
        <div class="relative z-20 w-16 shrink-0 border-r border-slate-200 bg-white">
          {hours.map((hour) => (
            <div
              key={hour}
              class="absolute -mt-2 w-full pr-2 text-right text-[11px] font-bold text-slate-300"
              style={{
                top: `${(hour - calendarStartHour) * pixelsPerHour}px`,
              }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Main Grid and Columns */}
        <div class="relative flex flex-1">
          {/* Current Time Indicator */}
          {showCurrentTimeLine.value && (
            <div
              class="pointer-events-none absolute right-0 left-0 z-20 flex items-center"
              style={{ top: `${currentTimePosition.value}px` }}
            >
              <div class="-ml-1 h-2 w-2 rounded-full bg-red-500"></div>
              <div class="flex-1 border-t-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
            </div>
          )}

          {/* Horizontal Grid Lines */}
          {hours.map((hour) => (
            <Fragment key={`grid-${hour}`}>
              <div
                class="pointer-events-none absolute w-full border-t border-slate-200"
                style={{
                  top: `${(hour - calendarStartHour) * pixelsPerHour}px`,
                }}
              ></div>
              <div
                class="pointer-events-none absolute w-full border-t border-dashed"
                style={{
                  top: `${(hour - calendarStartHour + 0.5) * pixelsPerHour}px`,
                  borderColor: "rgba(148,163,184,0.2)",
                }}
              ></div>
            </Fragment>
          ))}

          {/* Pitch Columns */}
          {calendarData.pitches.map((pitch: any) => {
            const pitchBookings = calendarData.bookings.filter(
              (b: any) => b.booking.pitchId === pitch.id,
            );
            return (
              <div
                key={pitch.id}
                class="relative flex-1 border-r border-slate-200 last:border-0"
              >
                {/* Interactive background cells for express creation */}
                {hours.map((hour) => (
                  <div
                    key={`empty-${hour}`}
                    onClick$={() => {
                      const time = `${String(hour).padStart(2, "0")}:00`;
                      onEmptySlotClick$(pitch.id, time);
                    }}
                    class="group absolute right-0 left-0 flex cursor-pointer items-center justify-center border-b border-slate-100/50 transition-all last:border-0 hover:bg-slate-100/80"
                    style={{
                      top: `${(hour - calendarStartHour) * pixelsPerHour}px`,
                      height: `${pixelsPerHour}px`,
                    }}
                  >
                    <div class="flex h-8 w-8 scale-75 items-center justify-center rounded-full bg-white/80 text-slate-400 opacity-0 shadow-sm transition-all group-hover:scale-100 group-hover:opacity-100">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
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

                {pitchBookings.map(({ booking, user, guest }: any) => {
                  const customerName =
                    guest?.name || user?.name || "Desconocido";
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
