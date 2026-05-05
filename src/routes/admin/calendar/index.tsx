import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { buttonVariants } from "~/components/ui/button/button";
import { cn } from "@qwik-ui/utils";
import { eq, and, gte, lte } from "drizzle-orm";
import { getDB } from "~/db";
import { bookings, pitches, users, guestRequests } from "~/db/schema";
import { BookingSlot } from "~/components/admin/booking-slot";

export const useCalendarData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const dateStr = requestEvent.url.searchParams.get("date");

  let selectedDate = new Date();
  if (dateStr) {
    // Using a more robust local parser to avoid offset issues
    const [year, month, day] = dateStr.split("-").map(Number);
    if (year && month && day) {
      selectedDate = new Date(year, month - 1, day);
    }
  }

  // Set start and end bounds
  const startOfDay = new Date(selectedDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(selectedDate);
  endOfDay.setHours(23, 59, 59, 999);

  const allPitches = await db.query.pitches.findMany({
    where: eq(pitches.isActive, true),
    orderBy: (pitches, { asc }) => [asc(pitches.name)],
  });

  const dailyBookings = await db
    .select({
      booking: bookings,
      user: users,
      guest: guestRequests,
    })
    .from(bookings)
    .leftJoin(users, eq(bookings.userId, users.id))
    .leftJoin(guestRequests, eq(bookings.id, guestRequests.bookingId))
    .where(
      and(
        gte(bookings.startTime, startOfDay),
        lte(bookings.startTime, endOfDay)
      )
    );

  // Format date string for the URL
  const yyyy = selectedDate.getFullYear();
  const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
  const dd = String(selectedDate.getDate()).padStart(2, "0");

  const prevDate = new Date(selectedDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(selectedDate);
  nextDate.setDate(nextDate.getDate() + 1);

  return {
    selectedDateStr: `${yyyy}-${mm}-${dd}`,
    prevDateStr: `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(prevDate.getDate()).padStart(2, "0")}`,
    nextDateStr: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`,
    pitches: allPitches,
    bookings: dailyBookings,
  };
});

export default component$(() => {
  const calendarData = useCalendarData();

  const CALENDAR_START_HOUR = 14; // 14:00
  const CALENDAR_END_HOUR = 24; // 00:00 next day
  const PIXELS_PER_HOUR = 80;

  const hours = Array.from(
    { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
    (_, i) => CALENDAR_START_HOUR + i
  );

  return (
    <div class="flex flex-col h-full overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Date Navigation Toolbar */}
      <div class="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-10">
        <h1 class="text-xl font-bold text-slate-800">Vista Diaria</h1>
        <div class="flex items-center gap-4 bg-slate-50 rounded-lg p-1 border border-slate-200">
          <Link
            href={`?date=${calendarData.value.prevDateStr}`}
            class={cn(buttonVariants({ look: "ghost", size: "sm" }), "p-2")}
            title="Día anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </Link>
          <div class="font-semibold text-sm min-w-[140px] text-center text-slate-700">
            {new Date(calendarData.value.selectedDateStr + "T00:00:00").toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <Link
            href={`?date=${calendarData.value.nextDateStr}`}
            class={cn(buttonVariants({ look: "ghost", size: "sm" }), "p-2")}
            title="Día siguiente"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </Link>
        </div>
      </div>

      {/* Calendar Area */}
      <main class="flex-1 overflow-auto p-6">
        <div class="min-w-[900px] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">

          {/* Pitches Header Row */}
          <div class="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
            <div class="w-20 shrink-0 border-r border-slate-200 flex items-center justify-center bg-slate-100">
              <span class="text-xs font-semibold text-slate-500 uppercase">Hora</span>
            </div>
            {calendarData.value.pitches.map((pitch) => (
              <div
                key={pitch.id}
                class="flex-1 text-center py-4 font-semibold text-slate-700 border-r border-slate-200 last:border-0"
              >
                {pitch.name}{" "}
                <span class="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full ml-1">
                  {pitch.type}
                </span>
              </div>
            ))}
          </div>

          {/* Calendar Grid Body */}
          <div
            class="flex relative bg-slate-50/50"
            style={{ height: `${hours.length * PIXELS_PER_HOUR}px` }}
          >
            {/* Time Column */}
            <div class="w-20 shrink-0 border-r border-slate-200 relative bg-white z-10">
              {hours.map((hour) => (
                <div
                  key={hour}
                  class="absolute w-full text-right pr-3 text-sm font-medium text-slate-500 -mt-2.5"
                  style={{
                    top: `${(hour - CALENDAR_START_HOUR) * PIXELS_PER_HOUR}px`,
                  }}
                >
                  {hour}:00
                </div>
              ))}
            </div>

            {/* Main Grid and Columns */}
            <div class="flex flex-1 relative">
              {/* Horizontal Grid Lines */}
              {hours.map((hour) => (
                <div
                  key={`line-${hour}`}
                  class="absolute w-full border-t border-slate-200 pointer-events-none"
                  style={{
                    top: `${(hour - CALENDAR_START_HOUR) * PIXELS_PER_HOUR}px`,
                  }}
                ></div>
              ))}

              {/* Sub-hour Grid Lines (Half hours) */}
              {hours.map((hour) => (
                <div
                  key={`line-half-${hour}`}
                  class="absolute w-full border-t border-slate-100 border-dashed pointer-events-none"
                  style={{
                    top: `${(hour - CALENDAR_START_HOUR + 0.5) * PIXELS_PER_HOUR}px`,
                  }}
                ></div>
              ))}

              {/* Pitch Columns */}
              {calendarData.value.pitches.map((pitch) => {
                const pitchBookings = calendarData.value.bookings.filter(
                  (b) => b.booking.pitchId === pitch.id
                );
                return (
                  <div
                    key={pitch.id}
                    class="flex-1 border-r border-slate-200 last:border-0 relative hover:bg-slate-50/80 transition-colors"
                  >
                    {pitchBookings.map(({ booking, user, guest }) => {
                      const customerName = guest?.name || user?.name || "Desconocido";
                      return (
                        <BookingSlot
                          key={booking.id}
                          id={booking.id}
                          startTime={booking.startTime}
                          endTime={booking.endTime}
                          status={booking.status}
                          customerName={customerName}
                          calendarStartHour={CALENDAR_START_HOUR}
                          pixelsPerHour={PIXELS_PER_HOUR}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
});

export const head = {
  title: "Calendario - SportGardenFutbol",
};
