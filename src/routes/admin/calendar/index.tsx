import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z, Link, useNavigate, Form } from "@builder.io/qwik-city";
import { buttonVariants } from "~/components/ui/button/button";
import { Button, Modal, Alert } from "~/components/ui";
import { cn } from "@qwik-ui/utils";
import { eq, and, gte, lte } from "drizzle-orm";
import { getDB } from "~/db";
import { bookings, pitches, users, guestRequests } from "~/db/schema";
import { BookingSlot } from "~/components/admin/booking-slot";

// Helper functions for date manipulation
const getStartOfWeek = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getEndOfWeek = (d: Date) => {
  const date = getStartOfWeek(d);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
};

const getStartOfMonth = (d: Date) => {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
};

const getEndOfMonth = (d: Date) => {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

export const useUpdateBookingStatusAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    await db
      .update(bookings)
      .set({ status: data.status as any })
      .where(eq(bookings.id, data.bookingId));
    
    return { success: true };
  },
  zod$({
    bookingId: z.string(),
    status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED"]),
  })
);

export const useCalendarData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const dateStr = requestEvent.url.searchParams.get("date");
  const viewStr = requestEvent.url.searchParams.get("view") || "day"; // "day", "week", "month"

  if (!dateStr) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    throw requestEvent.redirect(302, `?date=${yyyy}-${mm}-${dd}&view=${viewStr}`);
  }

  let selectedDate = new Date();
  const [year, month, day] = dateStr.split("-").map(Number);
  if (year && month && day) {
    selectedDate = new Date(year, month - 1, day);
  }

  let startDate = new Date(selectedDate);
  let endDate = new Date(selectedDate);

  if (viewStr === "week") {
    startDate = getStartOfWeek(selectedDate);
    endDate = getEndOfWeek(selectedDate);
  } else if (viewStr === "month") {
    startDate = getStartOfMonth(selectedDate);
    endDate = getEndOfMonth(selectedDate);
  } else {
    // Day view
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  }

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
        gte(bookings.startTime, startDate),
        lte(bookings.startTime, endDate)
      )
    );

  const yyyy = selectedDate.getFullYear();
  const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
  const dd = String(selectedDate.getDate()).padStart(2, "0");

  const prevDate = new Date(selectedDate);
  const nextDate = new Date(selectedDate);

  if (viewStr === "week") {
    prevDate.setDate(prevDate.getDate() - 7);
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (viewStr === "month") {
    prevDate.setMonth(prevDate.getMonth() - 1);
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else {
    prevDate.setDate(prevDate.getDate() - 1);
    nextDate.setDate(nextDate.getDate() + 1);
  }

  const formatDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return {
    selectedDateStr: `${yyyy}-${mm}-${dd}`,
    prevDateStr: formatDateStr(prevDate),
    nextDateStr: formatDateStr(nextDate),
    view: viewStr,
    pitches: allPitches,
    bookings: dailyBookings,
    startDateStr: startDate.toISOString(),
    endDateStr: endDate.toISOString(),
  };
});

export default component$(() => {
  const calendarData = useCalendarData();
  const updateStatusAction = useUpdateBookingStatusAction();
  const nav = useNavigate();

  const CALENDAR_START_HOUR = 0;
  const CALENDAR_END_HOUR = 24;
  const PIXELS_PER_HOUR = 140;

  const hours = Array.from(
    { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
    (_, i) => CALENDAR_START_HOUR + i
  );

  // Current Time Indicator Logic
  const currentTimePosition = useSignal(0);
  const showCurrentTimeLine = useSignal(false);

  // Modal State
  const isModalOpen = useSignal(false);
  const selectedBookingId = useSignal("");

  const handleBookingClick = $((id: string) => {
    selectedBookingId.value = id;
    isModalOpen.value = true;
  });

  const selectedBookingDetails = calendarData.value.bookings.find(
    (b) => b.booking.id === selectedBookingId.value
  );

  useVisibleTask$(({ cleanup }) => {
    const updateTimeIndicator = () => {
      const now = new Date();
      const selected = new Date(calendarData.value.selectedDateStr + "T00:00:00");
      
      const isToday = now.toDateString() === selected.toDateString();
      
      let shouldShow = false;
      if (calendarData.value.view === "day" && isToday) shouldShow = true;
      if (calendarData.value.view === "week") {
         const start = new Date(calendarData.value.startDateStr);
         const end = new Date(calendarData.value.endDateStr);
         if (now >= start && now <= end) shouldShow = true;
      }

      showCurrentTimeLine.value = shouldShow;

      if (shouldShow) {
        const hoursObj = now.getHours() + now.getMinutes() / 60;
        currentTimePosition.value = (hoursObj - CALENDAR_START_HOUR) * PIXELS_PER_HOUR;
      }
    };

    updateTimeIndicator();
    const interval = setInterval(updateTimeIndicator, 60000); // Update every minute
    cleanup(() => clearInterval(interval));
  });

  // Automatically close modal if action succeeds
  useVisibleTask$(({ track }) => {
    const success = track(() => updateStatusAction.value?.success);
    if (success) {
      isModalOpen.value = false;
    }
  });

  const getDayName = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const getWeekName = (startStr: string, endStr: string) => {
    const s = new Date(startStr);
    const e = new Date(endStr);
    return `${s.getDate()} de ${s.toLocaleDateString('es-ES', {month: 'short'})} - ${e.getDate()} de ${e.toLocaleDateString('es-ES', {month: 'short'})}`;
  };

  const getMonthName = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  };

  const handleViewChange = $((newView: string) => {
    nav(`?date=${calendarData.value.selectedDateStr}&view=${newView}`);
  });

  // Generate days for Week View
  const weekDays = [];
  if (calendarData.value.view === "week") {
    const current = new Date(calendarData.value.startDateStr);
    const end = new Date(calendarData.value.endDateStr);
    while (current <= end) {
      weekDays.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  }

  // Generate days for Month View
  const monthDays = [];
  if (calendarData.value.view === "month") {
    const current = new Date(calendarData.value.startDateStr);
    // Pad start of month to Monday
    while (current.getDay() !== 1) { // 1 is Monday
      current.setDate(current.getDate() - 1);
    }
    const startRender = new Date(current);
    
    const endMonth = new Date(calendarData.value.endDateStr);
    // Pad end of month to Sunday
    while (endMonth.getDay() !== 0) { // 0 is Sunday
      endMonth.setDate(endMonth.getDate() + 1);
    }
    
    const renderCursor = new Date(startRender);
    while (renderCursor <= endMonth) {
      monthDays.push(new Date(renderCursor));
      renderCursor.setDate(renderCursor.getDate() + 1);
    }
  }

  return (
    <div class="flex flex-col h-full overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Date Navigation Toolbar */}
      <div class="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
        <div class="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button 
            onClick$={() => handleViewChange("day")}
            class={cn("px-4 py-1.5 text-sm font-bold rounded-md transition-colors", calendarData.value.view === "day" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800")}
          >
            Día
          </button>
          <button 
            onClick$={() => handleViewChange("week")}
            class={cn("px-4 py-1.5 text-sm font-bold rounded-md transition-colors", calendarData.value.view === "week" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800")}
          >
            Semana
          </button>
          <button 
            onClick$={() => handleViewChange("month")}
            class={cn("px-4 py-1.5 text-sm font-bold rounded-md transition-colors", calendarData.value.view === "month" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800")}
          >
            Mes
          </button>
        </div>

        <div class="flex items-center gap-4 bg-slate-50 rounded-lg p-1 border border-slate-200">
          <Link
            href={`?date=${calendarData.value.prevDateStr}&view=${calendarData.value.view}`}
            class={cn(buttonVariants({ look: "ghost", size: "sm" }), "p-2 hover:bg-slate-200")}
            title="Anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </Link>
          <div class="font-black text-sm min-w-[200px] text-center text-slate-800 uppercase tracking-wider">
            {calendarData.value.view === "day" && getDayName(calendarData.value.selectedDateStr)}
            {calendarData.value.view === "week" && getWeekName(calendarData.value.startDateStr, calendarData.value.endDateStr)}
            {calendarData.value.view === "month" && getMonthName(calendarData.value.selectedDateStr)}
          </div>
          <Link
            href={`?date=${calendarData.value.nextDateStr}&view=${calendarData.value.view}`}
            class={cn(buttonVariants({ look: "ghost", size: "sm" }), "p-2 hover:bg-slate-200")}
            title="Siguiente"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </Link>
        </div>
      </div>

      {/* Calendar Area */}
      <main class="flex-1 overflow-auto p-6 relative">
        <div class={cn(
            "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full",
            calendarData.value.view !== "month" ? "min-w-[900px]" : "min-w-[700px]"
          )}
        >
          {/* ===================== DAY VIEW ===================== */}
          {calendarData.value.view === "day" && (
            <>
              {/* Pitches Header Row */}
              <div class="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
                <div class="w-20 shrink-0 border-r border-slate-200 flex items-center justify-center bg-slate-100">
                  <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora</span>
                </div>
                {calendarData.value.pitches.map((pitch) => (
                  <div
                    key={pitch.id}
                    class="flex-1 text-center py-4 border-r border-slate-200 last:border-0"
                  >
                    <div class="font-black text-slate-800 uppercase tracking-tight">{pitch.name}</div>
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {pitch.type}
                    </div>
                  </div>
                ))}
              </div>

              {/* Calendar Grid Body */}
              <div
                class="flex relative bg-slate-50/30 overflow-y-auto"
                style={{ height: `${hours.length * PIXELS_PER_HOUR}px` }}
              >
                {/* Time Column */}
                <div class="w-20 shrink-0 border-r border-slate-200 relative bg-slate-50/80 backdrop-blur-sm z-20">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      class="absolute w-full text-right pr-3 text-xs font-bold text-slate-400 -mt-2"
                      style={{
                        top: `${(hour - CALENDAR_START_HOUR) * PIXELS_PER_HOUR}px`,
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
                    <div
                      key={`line-${hour}`}
                      class="absolute w-full border-t border-slate-200 pointer-events-none"
                      style={{
                        top: `${(hour - CALENDAR_START_HOUR) * PIXELS_PER_HOUR}px`,
                      }}
                    ></div>
                  ))}
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
                              calendarStartHour={CALENDAR_START_HOUR}
                              pixelsPerHour={PIXELS_PER_HOUR}
                              onClick$={handleBookingClick}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ===================== WEEK VIEW ===================== */}
          {calendarData.value.view === "week" && (
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
                class="flex relative bg-slate-50/30 overflow-y-auto"
                style={{ height: `${hours.length * PIXELS_PER_HOUR}px` }}
              >
                {/* Time Column */}
                <div class="w-20 shrink-0 border-r border-slate-200 relative bg-slate-50/80 backdrop-blur-sm z-20">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      class="absolute w-full text-right pr-3 text-xs font-bold text-slate-400 -mt-2"
                      style={{
                        top: `${(hour - CALENDAR_START_HOUR) * PIXELS_PER_HOUR}px`,
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
                    <div key={`line-${hour}`} class="absolute w-full border-t border-slate-200 pointer-events-none" style={{ top: `${(hour - CALENDAR_START_HOUR) * PIXELS_PER_HOUR}px` }}></div>
                  ))}
                  {hours.map((hour) => (
                    <div key={`line-half-${hour}`} class="absolute w-full border-t border-slate-100 border-dashed pointer-events-none" style={{ top: `${(hour - CALENDAR_START_HOUR + 0.5) * PIXELS_PER_HOUR}px` }}></div>
                  ))}

                  {/* Day Columns */}
                  {weekDays.map((day, idx) => {
                    const dayBookings = calendarData.value.bookings.filter((b) => {
                      const bDate = new Date(b.booking.startTime);
                      return bDate.toDateString() === day.toDateString();
                    });

                    const isToday = new Date().toDateString() === day.toDateString();

                    return (
                      <div
                        key={idx}
                        class={cn("flex-1 border-r border-slate-200 last:border-0 relative hover:bg-slate-50/80 transition-colors", isToday ? "bg-emerald-50/10" : "")}
                      >
                        {dayBookings.map(({ booking, user, guest }) => {
                          const customerName = guest?.name || user?.name || "Desconocido";
                          const customerPhone = guest?.phone || user?.phone || "";
                          const pitchName = calendarData.value.pitches.find(p => p.id === booking.pitchId)?.name || "Cancha";
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
                              calendarStartHour={CALENDAR_START_HOUR}
                              pixelsPerHour={PIXELS_PER_HOUR}
                              onClick$={handleBookingClick}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ===================== MONTH VIEW ===================== */}
          {calendarData.value.view === "month" && (
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
                  const isCurrentMonth = day.getMonth() === new Date(calendarData.value.startDateStr).getMonth();
                  const isToday = new Date().toDateString() === day.toDateString();
                  
                  const dayBookings = calendarData.value.bookings.filter((b) => {
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
                      
                      {dayBookings.map(({ booking, user, guest }) => {
                        const customerName = guest?.name || user?.name || "Desconocido";
                        const pitchName = calendarData.value.pitches.find(p => p.id === booking.pitchId)?.name || "Cancha";
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
                            onClick$={() => handleBookingClick(booking.id)}
                            class={cn("text-[9px] p-1 rounded-sm leading-tight truncate shadow-sm cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all", statusColors[booking.status])}
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
          )}

        </div>
      </main>

      {/* Booking Details Modal */}
      <Modal.Root bind:show={isModalOpen}>
        <Modal.Panel class="bg-white border border-slate-200 rounded-3xl max-w-lg w-full">
          <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <Modal.Title class="text-xl font-black tracking-tight text-slate-800">Detalles de Reserva</Modal.Title>
            <Modal.Close class="text-slate-400 hover:text-slate-800 transition-colors p-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </Modal.Close>
          </div>

          {selectedBookingDetails ? (
            <div class="space-y-6">
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</div>
                  <div class="font-bold text-slate-800">
                    {selectedBookingDetails.guest?.name || selectedBookingDetails.user?.name || "Desconocido"}
                  </div>
                  <div class="text-xs text-slate-500 mt-1">
                    {selectedBookingDetails.guest?.phone || selectedBookingDetails.user?.phone || "Sin teléfono"}
                  </div>
                </div>
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cancha</div>
                  <div class="font-bold text-slate-800">
                    {calendarData.value.pitches.find(p => p.id === selectedBookingDetails.booking.pitchId)?.name || "Cancha"}
                  </div>
                  <div class="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded inline-block mt-1">
                    {calendarData.value.pitches.find(p => p.id === selectedBookingDetails.booking.pitchId)?.type}
                  </div>
                </div>
              </div>

              <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                <div>
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Horario</div>
                  <div class="font-bold text-slate-800">
                    {new Date(selectedBookingDetails.booking.startTime).toLocaleDateString("es-AR")}
                  </div>
                  <div class="text-sm font-semibold text-emerald-600">
                    {new Date(selectedBookingDetails.booking.startTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })} - 
                    {new Date(selectedBookingDetails.booking.endTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado</div>
                  <div class={cn(
                    "font-bold text-sm px-2 py-1 rounded",
                    selectedBookingDetails.booking.status === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-800" :
                    selectedBookingDetails.booking.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" :
                    selectedBookingDetails.booking.status === "COMPLETED" ? "bg-slate-200 text-slate-800" :
                    "bg-red-100 text-red-800"
                  )}>
                    {selectedBookingDetails.booking.status === "PENDING_APPROVAL" ? "Por confirmar" :
                     selectedBookingDetails.booking.status === "CONFIRMED" ? "Confirmado" :
                     selectedBookingDetails.booking.status === "COMPLETED" ? "Completado" : "Cancelado"}
                  </div>
                </div>
              </div>

              <div class="border-t border-slate-100 pt-4 pb-2">
                <div class="flex justify-between items-end mb-2">
                  <div class="text-sm font-bold text-slate-600">Total</div>
                  <div class="text-2xl font-black text-slate-800">${selectedBookingDetails.booking.totalPrice}</div>
                </div>
                <div class="flex justify-between items-end">
                  <div class="text-sm font-bold text-slate-600">Abonado ({selectedBookingDetails.booking.paymentStatus})</div>
                  <div class="text-lg font-black text-emerald-600">${selectedBookingDetails.booking.paidAmount}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div class="border-t border-slate-100 pt-6">
                {updateStatusAction.value?.failed && (
                  <Alert.Root look="alert" class="bg-red-50 border-red-200 text-red-600 rounded-lg mb-4">
                    <Alert.Description>Ocurrió un error al actualizar.</Alert.Description>
                  </Alert.Root>
                )}

                {selectedBookingDetails.booking.status === "PENDING_APPROVAL" && (
                  <div class="flex gap-4">
                    <Form action={updateStatusAction} class="flex-1">
                      <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                      <input type="hidden" name="status" value="CANCELLED" />
                      <Button look="secondary" type="submit" disabled={updateStatusAction.isRunning} class="w-full py-3 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl font-bold">
                        Rechazar
                      </Button>
                    </Form>
                    <Form action={updateStatusAction} class="flex-1">
                      <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                      <input type="hidden" name="status" value="CONFIRMED" />
                      <Button look="primary" type="submit" disabled={updateStatusAction.isRunning} class="w-full py-3 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold">
                        Confirmar
                      </Button>
                    </Form>
                  </div>
                )}

                {selectedBookingDetails.booking.status === "CONFIRMED" && (
                  <div class="flex gap-4">
                    <Form action={updateStatusAction} class="flex-1">
                      <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                      <input type="hidden" name="status" value="CANCELLED" />
                      <Button look="secondary" type="submit" disabled={updateStatusAction.isRunning} class="w-full py-3 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl font-bold">
                        Cancelar Reserva
                      </Button>
                    </Form>
                    <Form action={updateStatusAction} class="flex-1">
                      <input type="hidden" name="bookingId" value={selectedBookingDetails.booking.id} />
                      <input type="hidden" name="status" value="COMPLETED" />
                      <Button look="primary" type="submit" disabled={updateStatusAction.isRunning} class="w-full py-3 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold">
                        Marcar Completada
                      </Button>
                    </Form>
                  </div>
                )}

                {(selectedBookingDetails.booking.status === "CANCELLED" || selectedBookingDetails.booking.status === "COMPLETED") && (
                  <Button look="secondary" onClick$={() => isModalOpen.value = false} class="w-full py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold">
                    Cerrar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div class="py-8 text-center text-slate-500">Cargando detalles...</div>
          )}
        </Modal.Panel>
      </Modal.Root>

    </div>
  );
});

export const head = {
  title: "Calendario - SportGardenFutbol",
};
