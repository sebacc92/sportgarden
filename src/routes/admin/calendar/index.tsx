import { component$, useSignal, useVisibleTask$, useTask$, $, useComputed$, Fragment } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z, Link, useNavigate, Form, server$ } from "@builder.io/qwik-city";
import { Button, Modal, Alert } from "~/components/ui";
import { cn } from "@qwik-ui/utils";
import { eq, and, gte, lte, lt } from "drizzle-orm";
import { getDB } from "~/db";
import { bookings, pitches, users, guestRequests } from "~/db/schema";
import { BookingSlot } from "~/components/admin/booking-slot";
import { BookingListView } from "~/components/admin/booking-list-view";
import { BookingTimelineView } from "~/components/admin/booking-timeline-view";

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

const getBAFormatDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d);

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

export const useCreateAdminBookingAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    // Parse start date
    const startDate = new Date(`${data.date}T12:00:00`);

    // Parse end date if recurring
    let endDate = startDate;
    if (data.isSubscription && data.endDate) {
      endDate = new Date(`${data.endDate}T12:00:00`);

      const maxDate = new Date(startDate);
      maxDate.setFullYear(maxDate.getFullYear() + 1);

      if (endDate > maxDate) {
        endDate = maxDate; // Limit to 1 year max
      }

      if (endDate < startDate) {
        return { success: false, failed: true, message: "La fecha de fin debe ser posterior a la de inicio" };
      }
    }

    // Generate all dates (weekly)
    const datesToBook: string[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      datesToBook.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 7);
    }

    const firstBookingId = crypto.randomUUID();

    for (let i = 0; i < datesToBook.length; i++) {
      const d = datesToBook[i];
      const startDateTime = new Date(`${d}T${data.startTime}:00`);
      const endDateTime = new Date(`${d}T${data.endTime}:00`);
      const isFirst = i === 0;
      const bookingId = isFirst ? firstBookingId : crypto.randomUUID();

      await db.insert(bookings).values({
        id: bookingId,
        userId: data.userId || null,
        pitchId: data.pitchId,
        startTime: startDateTime,
        endTime: endDateTime,
        status: "CONFIRMED",
        totalPrice: Number(data.price),
        paidAmount: isFirst ? (Number(data.paidAmount) || 0) : 0,
        paymentStatus: isFirst ? ((Number(data.paidAmount) || 0) >= Number(data.price) ? "PAID" : (Number(data.paidAmount) || 0) > 0 ? "PARTIAL" : "PENDING") : "PENDING",
        paymentMethod: data.paymentMethod as any,
        isSubscription: data.isSubscription,
        notes: data.notes || null,
        extras: data.extras ? JSON.parse(data.extras) : null,
      });

      // Only create guest request if no userId was provided
      if (!data.userId) {
        await db.insert(guestRequests).values({
          id: crypto.randomUUID(),
          bookingId: bookingId,
          name: data.customerName || "Invitado",
          phone: data.customerPhone || "",
        });
      }
    }

    return { success: true, bookingId: firstBookingId };
  },
  zod$({
    pitchId: z.string(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    userId: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    price: z.string(),
    paidAmount: z.string().optional(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "MERCADO_PAGO"]).default("CASH"),
    notes: z.string().optional(),
    extras: z.string().optional(),
    isSubscription: z.coerce.boolean().optional(),
    endDate: z.string().optional(),
  })
);

export const useCalendarData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const dateStr = requestEvent.url.searchParams.get("date");
  const viewStr = requestEvent.url.searchParams.get("view") || "day"; // "day", "week", "month"

  if (!dateStr) {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
    throw requestEvent.redirect(302, `?date=${todayStr}&view=${viewStr}`);
  }

  // Auto-complete past bookings
  const now = new Date();
  await db.update(bookings)
    .set({ status: "COMPLETED" })
    .where(
      and(
        eq(bookings.status, "CONFIRMED"),
        lt(bookings.endTime, now)
      )
    );

  const settings = await db.query.siteSettings.findFirst();
  const extraServices = (settings?.extraServices || []) as { name: string; price: number; icon: string }[];

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
      booking: {
        id: bookings.id,
        pitchId: bookings.pitchId,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
        totalPrice: bookings.totalPrice,
        paidAmount: bookings.paidAmount,
        paymentStatus: bookings.paymentStatus,
      },
      user: {
        id: users.id,
        name: users.name,
        phone: users.phone,
      },
      guest: {
        id: guestRequests.id,
        name: guestRequests.name,
        phone: guestRequests.phone,
      },
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
    extraServices,
    settings: settings ? {
      ...settings,
      extraServices: (settings.extraServices || []) as any[],
      operatingHours: (settings.operatingHours || []) as any[],
      services: (settings.services || []) as string[],
      galleryImages: (settings.galleryImages || []) as string[],
    } : null,
  };
});

export const getAdminDailyBookings = server$(async function (pitchId: string, dateStr: string) {
  const db = getDB(this);
  if (!pitchId || !dateStr) return [];
  const startOfDay = new Date(`${dateStr}T00:00:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59`);
  const { inArray, lt } = await import("drizzle-orm");
  const daily = await db.query.bookings.findMany({
    where: and(
      eq(bookings.pitchId, pitchId),
      gte(bookings.startTime, startOfDay),
      lt(bookings.startTime, endOfDay),
      inArray(bookings.status, ["CONFIRMED", "PENDING_APPROVAL", "COMPLETED"] as any)
    ),
    columns: { startTime: true, endTime: true },
  });
  return daily.map(b => ({ startTime: b.startTime.toISOString(), endTime: b.endTime.toISOString() }));
});

export const searchUsersServer = server$(async function (query: string) {
  if (!query || query.length < 2) return [];
  const db = getDB(this as any);
  const { ilike, or } = await import("drizzle-orm");
  const pattern = `%${query}%`;

  const results = await db.query.users.findMany({
    where: or(
      ilike(users.name, pattern),
      ilike(users.email, pattern),
      ilike(users.phone, pattern)
    ),
    columns: { id: true, name: true, phone: true, email: true },
    limit: 5,
  });

  return results;
});

export default component$(() => {
  const calendarData = useCalendarData();
  const updateStatusAction = useUpdateBookingStatusAction();
  const createBookingAction = useCreateAdminBookingAction();
  const nav = useNavigate();

  // Layout mode: 'timeline' (pitches×time) | 'list' (table) | 'grid' (time-grid per pitch)
  const layoutMode = useSignal<'timeline' | 'list' | 'grid'>('timeline');

  const clubSettings = calendarData.value.settings;
  const selectedDateBA = new Date(calendarData.value.selectedDateStr + "T12:00:00");
  const dayOfWeek = selectedDateBA.getDay();
  
  const operatingHours = (() => {
    try {
      if (typeof clubSettings?.operatingHours === 'string') return JSON.parse(clubSettings.operatingHours);
      if (Array.isArray(clubSettings?.operatingHours)) return clubSettings.operatingHours;
      return [];
    } catch { return []; }
  })();

  const todaySchedule = operatingHours.find((h: any) => h.day === dayOfWeek);

  const CALENDAR_START_HOUR = todaySchedule?.openTime ? parseInt(todaySchedule.openTime.split(":")[0], 10) : 8;
  const CALENDAR_END_HOUR = todaySchedule?.closeTime ? parseInt(todaySchedule.closeTime.split(":")[0], 10) : 23;
  const PIXELS_PER_HOUR = 140;

  const hours = Array.from(
    { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
    (_, i) => CALENDAR_START_HOUR + i
  );

  // Current Time Indicator Logic
  const currentTimePosition = useSignal(0);
  const showCurrentTimeLine = useSignal(false);
  const scrollContainerRef = useSignal<HTMLElement>();

  // Modal State
  const isModalOpen = useSignal(false);
  const selectedBookingId = useSignal("");

  const isCreateModalOpen = useSignal(false);

  // Admin create form state
  const adminFormPitchId = useSignal("");
  const adminFormDate = useSignal("");
  const adminFormTime = useSignal("");
  const adminFormDuration = useSignal("60");
  const adminIsSubscription = useSignal(false);
  const adminEndDate = useSignal("");
  const adminNotes = useSignal("");
  const adminOccupiedSlots = useSignal<{ startTime: string; endTime: string }[]>([]);
  const adminIsChecking = useSignal(false);

  // Search user state
  const adminSearchTerm = useSignal("");
  const adminSearchResults = useSignal<any[]>([]);
  const adminSelectedUserId = useSignal("");
  const adminSelectedUserName = useSignal("");
  const adminSelectedUserPhone = useSignal("");
  const adminIsSearching = useSignal(false);

  // Pricing & Extras
  const adminDiscountAmount = useSignal<number | "">(0);
  const adminDiscountType = useSignal<"FIXED" | "PERCENTAGE">("FIXED");
  const adminSelectedExtras = useSignal<string[]>([]);

  useTask$(({ track }) => {
    const term = track(() => adminSearchTerm.value);
    if (term.length >= 2) {
      adminIsSearching.value = true;
      searchUsersServer(term).then(res => {
        adminSearchResults.value = res;
        adminIsSearching.value = false;
      });
    } else {
      adminSearchResults.value = [];
    }
  });

  const incrementDuration = $(() => {
    const current = parseInt(adminFormDuration.value, 10);
    if (current < 360) adminFormDuration.value = String(current + 30);
  });
  const decrementDuration = $(() => {
    const current = parseInt(adminFormDuration.value, 10);
    if (current > 30) adminFormDuration.value = String(current - 30);
  });

  const adminTimeOptions: string[] = [];
  for (let h = 8; h <= 23; h++) {
    adminTimeOptions.push(`${String(h).padStart(2, "0")}:00`);
    adminTimeOptions.push(`${String(h).padStart(2, "0")}:30`);
  }

  const adminEndTime = useComputed$(() => {
    if (!adminFormTime.value) return "";
    const [h, m] = adminFormTime.value.split(":").map(Number);
    const totalMins = h * 60 + m + parseInt(adminFormDuration.value, 10);
    return `${String(Math.floor(totalMins / 60) % 24).padStart(2, "0")}:${String(totalMins % 60).padStart(2, "0")}`;
  });

  const handleBookingClick = $((id: string) => {
    selectedBookingId.value = id;
    isModalOpen.value = true;
  });

  const selectedBookingDetails = calendarData.value.bookings.find(
    (b) => b.booking.id === selectedBookingId.value
  );

  const selectedDateStr = calendarData.value.selectedDateStr;
  const calendarView = calendarData.value.view;
  const startDateStr = calendarData.value.startDateStr;
  const endDateStr = calendarData.value.endDateStr;

  useVisibleTask$(({ cleanup }) => {
    const updateTimeIndicator = () => {
      const now = new Date();
      const selected = new Date(selectedDateStr + "T00:00:00");

      const isToday = now.toDateString() === selected.toDateString();

      let shouldShow = false;
      if (calendarView === "day" && isToday) shouldShow = true;
      if (calendarView === "week") {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        if (now >= start && now <= end) shouldShow = true;
      }

      showCurrentTimeLine.value = shouldShow;

      if (shouldShow) {
        const hoursObj = now.getHours() + now.getMinutes() / 60;
        currentTimePosition.value = (hoursObj - CALENDAR_START_HOUR) * PIXELS_PER_HOUR;
      }
    };

    updateTimeIndicator();

    // Auto scroll to current time on initial load
    if (scrollContainerRef.value && showCurrentTimeLine.value) {
      setTimeout(() => {
        const container = scrollContainerRef.value;
        if (container) {
          const containerHeight = container.clientHeight;
          // Center the line in the container
          container.scrollTo({
            top: Math.max(0, currentTimePosition.value - (containerHeight / 2)),
            behavior: "smooth"
          });
        }
      }, 100);
    }

    const interval = setInterval(updateTimeIndicator, 60000); // Update every minute
    cleanup(() => clearInterval(interval));
  });

  // Automatically close modals if action succeeds
  useVisibleTask$(({ track }) => {
    const successUpdate = track(() => updateStatusAction.value?.success);
    if (successUpdate) {
      isModalOpen.value = false;
    }
    const successCreate = track(() => createBookingAction.value?.success);
    if (successCreate) {
      isCreateModalOpen.value = false;
      adminFormDate.value = "";
      adminFormTime.value = "";
      adminOccupiedSlots.value = [];
    }
  });

  // Load availability when pitch or date changes in admin form
  useTask$(({ track }) => {
    const pitchId = track(() => adminFormPitchId.value);
    const date = track(() => adminFormDate.value);
    if (pitchId && date) {
      adminIsChecking.value = true;
      adminFormTime.value = "";
      getAdminDailyBookings(pitchId, date).then(slots => {
        adminOccupiedSlots.value = slots;
        adminIsChecking.value = false;
      });
    } else {
      adminOccupiedSlots.value = [];
    }
  });


  const calendarViewComputed = useComputed$(() => calendarData.value.view);
  const selectedDateStrComputed = useComputed$(() => calendarData.value.selectedDateStr);

  // Force grid layout for week/month views as timeline/list are day-only
  useTask$(({ track }) => {
    const view = track(() => calendarViewComputed.value);
    if (view !== "day" && layoutMode.value !== "grid") {
      layoutMode.value = "grid";
    }
  });


  const getWeekName = (startStr: string, endStr: string) => {
    const s = new Date(startStr);
    const e = new Date(endStr);
    return `${s.getDate()} de ${s.toLocaleDateString('es-ES', { month: 'short' })} - ${e.getDate()} de ${e.toLocaleDateString('es-ES', { month: 'short' })}`;
  };

  const getMonthName = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  };

  const handleViewChange = $((newView: string) => {
    nav(`?date=${selectedDateStrComputed.value}&view=${newView}`);
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
      <div class="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0 gap-4">

        {/* Left: Title + count */}
        <div class="flex items-center gap-3 shrink-0">
          <h1 class="text-base font-black text-slate-800">Reservas</h1>
          <div class="w-px h-5 bg-slate-200"></div>
          <span class="text-xs font-bold text-slate-400">
            <span class="text-slate-800 font-black">{calendarData.value.bookings.length}</span> reservas
          </span>
        </div>

        {/* Center: Big date with flanking arrows */}
        <div class="flex items-center gap-3">
          <Link
            href={`?date=${calendarData.value.prevDateStr}&view=${calendarData.value.view}`}
            class="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-500 hover:text-slate-800 transition-all shadow-sm"
            title="Anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </Link>

          <div class="text-center min-w-[280px]">
            {calendarData.value.view === "day" && (
              <div class="text-2xl font-black text-slate-800 capitalize leading-tight">
                {new Date(calendarData.value.selectedDateStr + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            )}
            {calendarData.value.view === "week" && (
              <div class="text-xl font-black text-slate-800 leading-tight">
                {getWeekName(calendarData.value.startDateStr, calendarData.value.endDateStr)}
              </div>
            )}
            {calendarData.value.view === "month" && (
              <div class="text-xl font-black text-slate-800 capitalize leading-tight">
                {getMonthName(calendarData.value.selectedDateStr)}
              </div>
            )}
            {calendarData.value.selectedDateStr === getBAFormatDate(new Date()) && (
              <div class="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-black uppercase tracking-wider">
                Hoy
              </div>
            )}
          </div>

          <Link
            href={`?date=${calendarData.value.nextDateStr}&view=${calendarData.value.view}`}
            class="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-500 hover:text-slate-800 transition-all shadow-sm"
            title="Siguiente"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </Link>
        </div>

        {/* Right: Go to today + Layout toggle + View Switcher + New Reservation */}
        <div class="flex items-center gap-3 shrink-0">
          <button
            onClick$={() => isCreateModalOpen.value = true}
            class="px-4 py-1.5 text-xs font-black text-white bg-emerald-500 rounded-lg shadow-sm hover:bg-emerald-600 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            Nueva Reserva
          </button>

          {calendarData.value.selectedDateStr !== getBAFormatDate(new Date()) && (
            <Link
              href={`?date=${getBAFormatDate(new Date())}&view=${calendarData.value.view}`}
              class="px-3 py-1.5 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Ir a Hoy
            </Link>
          )}

          {/* Layout Mode Toggle */}
          <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick$={() => layoutMode.value = 'timeline'}
              disabled={calendarData.value.view !== 'day'}
              class={cn(
                "w-8 h-8 flex items-center justify-center rounded-md transition-all",
                layoutMode.value === 'timeline' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-700",
                calendarData.value.view !== 'day' && "opacity-30 cursor-not-allowed"
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
              disabled={calendarData.value.view !== 'day'}
              class={cn(
                "w-8 h-8 flex items-center justify-center rounded-md transition-all",
                layoutMode.value === 'list' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-700",
                calendarData.value.view !== 'day' && "opacity-30 cursor-not-allowed"
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
              onClick$={() => handleViewChange("day")}
              class={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", calendarData.value.view === "day" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800")}
            >
              Día
            </button>
            <button
              onClick$={() => handleViewChange("week")}
              class={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", calendarData.value.view === "week" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800")}
            >
              Semana
            </button>
            <button
              onClick$={() => handleViewChange("month")}
              class={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-colors", calendarData.value.view === "month" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-800")}
            >
              Mes
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Area: conditionally render grid, list or timeline */}
      {layoutMode.value === 'list' ? (
        <main class="flex-1 overflow-auto p-6">
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
            <BookingListView
              pitches={calendarData.value.pitches}
              bookings={calendarData.value.bookings as any}
              onBookingClick$={handleBookingClick}
            />
          </div>
        </main>
      ) : layoutMode.value === 'timeline' ? (
        <main class="flex-1 overflow-auto p-6">
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
            {(() => {
              return (
                <BookingTimelineView
                  pitches={calendarData.value.pitches}
                  bookings={calendarData.value.bookings as any}
                  slotMinutes={30}
                  startHour={CALENDAR_START_HOUR}
                  endHour={CALENDAR_END_HOUR}
                  onBookingClick$={(id) => {
                    selectedBookingId.value = id;
                    isModalOpen.value = true;
                  }}
              onEmptySlotDragEnd$={(pitchId, time, duration) => {
                adminFormPitchId.value = pitchId;
                adminFormDate.value = getBAFormatDate(new Date(calendarData.value.selectedDateStr + 'T12:00:00'));
                adminFormTime.value = time;
                adminFormDuration.value = String(duration);
                adminIsSubscription.value = false;
                adminEndDate.value = "";
                adminNotes.value = "";
                adminDiscountAmount.value = "";
                adminDiscountType.value = "FIXED";
                adminSelectedExtras.value = [];
                isCreateModalOpen.value = true;
              }}
                />
              );
            })()}
          </div>
        </main>
      ) : (
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
                  <div class="w-16 shrink-0 border-r border-slate-200 flex items-center justify-center bg-slate-100">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora</span>
                  </div>
                  {calendarData.value.pitches.map((pitch) => {
                    const pitchBookingCount = calendarData.value.bookings.filter(b => b.booking.pitchId === pitch.id).length;
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
                      <Fragment key={`grid-${hour}`}>
                        <div
                          class="absolute w-full border-t border-slate-200 pointer-events-none"
                          style={{
                            top: `${(hour - CALENDAR_START_HOUR) * PIXELS_PER_HOUR}px`,
                          }}
                        ></div>
                        <div
                          class="absolute w-full border-t border-dashed pointer-events-none"
                          style={{
                            top: `${(hour - CALENDAR_START_HOUR + 0.5) * PIXELS_PER_HOUR}px`,
                            borderColor: 'rgba(148,163,184,0.2)',
                          }}
                        ></div>
                      </Fragment>
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
                  ref={scrollContainerRef}
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
                      <div key={`line-half-${hour}`} class="absolute w-full border-t border-dashed pointer-events-none" style={{ top: `${(hour - CALENDAR_START_HOUR + 0.5) * PIXELS_PER_HOUR}px`, borderColor: 'rgba(148,163,184,0.2)' }}></div>
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
      )}

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
            <div class="py-12 text-center text-slate-500">Cargando detalles...</div>
          )}
        </Modal.Panel>
      </Modal.Root>

      {/* Create Admin Booking Modal */}
      <Modal.Root bind:show={isCreateModalOpen}>
        <Modal.Panel position="right" class="fixed right-0 top-0 inset-y-0 p-0 w-[700px] max-w-[95vw] overflow-hidden bg-white shadow-2xl">
          <div class="flex flex-col h-[100dvh] w-full">
            {(() => {
              const pitch = calendarData.value.pitches.find(p => p.id === adminFormPitchId.value);
              const dateStr = adminFormDate.value;
              const durHrs = Math.floor(parseInt(adminFormDuration.value) / 60);
              const durMins = parseInt(adminFormDuration.value) % 60;
              const nowBAStr = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Argentina/Buenos_Aires',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
              }).format(new Date()).replace(', ', 'T');
              const formDateStr = `${dateStr}T${adminFormTime.value}`;
              const isPast = dateStr && adminFormTime.value ? formDateStr < nowBAStr : false;

              const basePrice = pitch ? pitch.pricePerHour * (parseInt(adminFormDuration.value) / 60) : 0;
              const extrasCost = adminSelectedExtras.value.reduce((acc, name) => {
                const extra = calendarData.value.extraServices.find((e: any) => e.name === name);
                return acc + (extra ? extra.price : 0);
              }, 0);
              const discount = adminDiscountType.value === "FIXED"
                ? (Number(adminDiscountAmount.value) || 0)
                : basePrice * ((Number(adminDiscountAmount.value) || 0) / 100);
              const finalPrice = Math.max(0, basePrice - discount) + extrasCost;

              return (
                <>
                  <div class="bg-slate-50 border-b border-slate-200 px-8 pt-8 pb-6 flex flex-col gap-3 shrink-0 relative">
                    {isPast && (
                      <div class="bg-amber-100 border border-amber-200 text-amber-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 mb-2 w-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                        Horario Pasado o en Curso
                      </div>
                    )}
                    <div class="flex justify-between items-start">
                      <Modal.Title class="text-[28px] font-black text-slate-800 tracking-tighter leading-none">
                        Nueva Reserva
                      </Modal.Title>
                      <Modal.Close class="text-slate-400 hover:text-slate-800 transition-colors p-1.5 -mr-1.5 rounded-full hover:bg-slate-200">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </Modal.Close>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-[14px] text-slate-600 font-semibold tracking-tight mt-2">
                      <select
                        class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 hover:bg-slate-50 transition-colors"
                        value={adminFormPitchId.value}
                        onChange$={(_, el) => adminFormPitchId.value = el.value}
                      >
                        <option value="">Seleccionar cancha</option>
                        {calendarData.value.pitches.map(p => <option key={p.id} value={p.id}>{`${p.name} ${p.type}`}</option>)}
                      </select>

                      <input
                        type="date"
                        value={adminFormDate.value}
                        onChange$={(_, el) => adminFormDate.value = el.value}
                        class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 hover:bg-slate-50 transition-colors"
                      />

                      <select
                        class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 hover:bg-slate-50 transition-colors font-mono"
                        value={adminFormTime.value}
                        onChange$={(_, el) => adminFormTime.value = el.value}
                      >
                        <option value="">--:-- hs</option>
                        {adminTimeOptions.map(t => <option key={t} value={t}>{`${t} hs`}</option>)}
                      </select>
                    </div>
                  </div>

                  <div class="flex-1 overflow-y-auto overflow-x-hidden px-8 py-8">
                    <Form action={createBookingAction} id="create-booking-form" class="space-y-8 pb-10" onSubmitCompleted$={() => { if (createBookingAction.value?.success) isCreateModalOpen.value = false; }}>
                      <input type="hidden" name="date" value={adminFormDate.value} />
                      <input type="hidden" name="startTime" value={adminFormTime.value} />
                      <input type="hidden" name="endTime" value={adminEndTime.value} />
                      <input type="hidden" name="pitchId" value={adminFormPitchId.value} />
                      <input type="hidden" name="isSubscription" value={adminIsSubscription.value ? "true" : "false"} />

                      {/* Fila: Tipo de Turno / Precio / Fin */}
                      <div class="grid grid-cols-2 gap-8">
                        {/* Tipo de Turno */}
                        <div class="flex flex-col gap-2">
                          <div class="flex bg-slate-100 p-1 rounded-full border border-slate-200 shadow-inner">
                            <button
                              type="button"
                              onClick$={() => adminIsSubscription.value = false}
                              class={cn("flex-1 py-1.5 text-sm font-bold rounded-full transition-all text-center", !adminIsSubscription.value ? "bg-emerald-800 text-white shadow-md" : "text-slate-500 hover:text-slate-700")}
                            >
                              Turno único
                            </button>
                            <button
                              type="button"
                              onClick$={() => adminIsSubscription.value = true}
                              class={cn("flex-1 py-1.5 text-sm font-bold rounded-full transition-all text-center", adminIsSubscription.value ? "bg-emerald-800 text-white shadow-md" : "text-slate-500 hover:text-slate-700")}
                            >
                              Turno fijo
                            </button>
                          </div>

                          {/* Duración */}
                          <div class="mt-4 flex flex-col items-center">
                            <label class="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Duración</label>
                            <div class="flex items-center gap-4">
                              <button type="button" onClick$={decrementDuration} class="w-10 h-10 rounded-xl border-2 border-emerald-600 text-emerald-700 flex items-center justify-center hover:bg-emerald-50 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /></svg>
                              </button>
                              <div class="flex gap-1 items-baseline">
                                <div class="flex flex-col items-center">
                                  <span class="text-2xl font-black text-slate-800">{String(durHrs).padStart(2, '0')}</span>
                                  <span class="text-[10px] text-slate-400 font-bold uppercase">Hs</span>
                                </div>
                                <span class="text-2xl font-black text-slate-300 -mt-1">:</span>
                                <div class="flex flex-col items-center">
                                  <span class="text-2xl font-black text-slate-800">{String(durMins).padStart(2, '0')}</span>
                                  <span class="text-[10px] text-slate-400 font-bold uppercase">Min</span>
                                </div>
                              </div>
                              <button type="button" onClick$={incrementDuration} class="w-10 h-10 rounded-xl border-2 border-emerald-600 text-emerald-700 flex items-center justify-center hover:bg-emerald-50 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Lado derecho: Precio y Fin */}
                        <div class="flex flex-col gap-6">
                          <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Precio Total</label>
                            <div class="flex flex-col gap-2">
                              <div class="flex items-center justify-between text-sm text-slate-500 font-medium px-1">
                                <span>Precio Base:</span>
                                <span>${basePrice.toLocaleString('es-AR')}</span>
                              </div>

                              <div class="flex flex-col gap-2 mt-1">
                                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aplicar Descuento</label>
                                <div class="flex gap-2">
                                  <select
                                    value={adminDiscountType.value}
                                    onChange$={(_, el) => adminDiscountType.value = el.value as any}
                                    class="flex-1 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold text-slate-600 transition-all"
                                  >
                                    <option value="FIXED">Monto Fijo ($)</option>
                                    <option value="PERCENTAGE">Porcentaje (%)</option>
                                  </select>
                                  <input
                                    type="number"
                                    value={adminDiscountAmount.value}
                                    onInput$={(_, el) => adminDiscountAmount.value = el.value ? Number(el.value) : ""}
                                    min="0"
                                    placeholder="0"
                                    class="flex-1 px-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-800 transition-all"
                                  />
                                </div>
                              </div>

                              {calendarData.value.extraServices.length > 0 && (
                                <div class="mt-2 space-y-2">
                                  <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Extras</label>
                                  <div class="flex flex-wrap gap-2">
                                    {calendarData.value.extraServices.map((extra: any) => {
                                      const isSelected = adminSelectedExtras.value.includes(extra.name);
                                      return (
                                        <button
                                          key={extra.name}
                                          type="button"
                                          onClick$={() => {
                                            if (isSelected) {
                                              adminSelectedExtras.value = adminSelectedExtras.value.filter(e => e !== extra.name);
                                            } else {
                                              adminSelectedExtras.value = [...adminSelectedExtras.value, extra.name];
                                            }
                                          }}
                                          class={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5",
                                            isSelected ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                          )}
                                        >
                                          <span class="text-sm">{extra.icon}</span>
                                          <span>{extra.name} (+${extra.price})</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div class="pt-2 mt-1 border-t border-slate-200 flex items-center justify-between">
                                <span class="text-sm font-black text-slate-800">Total a Pagar:</span>
                                <span class="text-xl font-black text-emerald-600">${finalPrice.toLocaleString('es-AR')}</span>
                              </div>
                              <input type="hidden" name="price" value={finalPrice} />
                              <input type="hidden" name="extras" value={JSON.stringify(adminSelectedExtras.value)} />
                            </div>
                          </div>

                          {adminIsSubscription.value && (
                            <div class="animate-in fade-in slide-in-from-top-2 duration-300">
                              <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de finalización</label>
                              <input type="date" name="endDate" value={adminEndDate.value} onInput$={(_, el) => adminEndDate.value = el.value} class="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 text-sm font-semibold text-slate-700" />
                              {!adminEndDate.value && <p class="text-[10px] text-slate-400 mt-1 font-medium">Sin definir - Se renovará automáticamente.</p>}
                            </div>
                          )}
                        </div>
                      </div>

                      <hr class="border-slate-100" />

                      {/* Organizador */}
                      <div class="space-y-4">
                        <div class="flex items-center justify-between">
                          <h3 class="text-sm font-black text-slate-800 flex items-center gap-2">
                            Organizador <span class="text-xs font-semibold text-slate-400 font-sans">(obligatorio)</span>
                          </h3>
                          {adminSelectedUserId.value && (
                            <button type="button" onClick$={() => { adminSelectedUserId.value = ""; adminSearchTerm.value = ""; adminSelectedUserName.value = ""; adminSelectedUserPhone.value = ""; }} class="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase">
                              Cambiar Cliente
                            </button>
                          )}
                        </div>

                        <input type="hidden" name="userId" value={adminSelectedUserId.value} />

                        <div class="grid grid-cols-2 gap-4">
                          <div class="col-span-2 relative">
                            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Buscar Cliente Registrado (Opcional)</label>
                            <div class="relative">
                              <svg xmlns="http://www.w3.org/2000/svg" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                              <input
                                type="text"
                                value={adminSearchTerm.value}
                                onInput$={(_, el) => adminSearchTerm.value = el.value}
                                placeholder="Buscar por nombre, teléfono o email..."
                                class="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                              />
                              {adminIsSearching.value && (
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin"></div>
                              )}
                            </div>

                            {adminSearchResults.value.length > 0 && !adminSelectedUserId.value && (
                              <div class="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {adminSearchResults.value.map(user => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick$={() => {
                                      adminSelectedUserId.value = user.id;
                                      adminSelectedUserName.value = user.name;
                                      adminSelectedUserPhone.value = user.phone || "";
                                      adminSearchTerm.value = "";
                                      adminSearchResults.value = [];
                                    }}
                                    class="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col"
                                  >
                                    <span class="text-sm font-bold text-slate-800">{user.name}</span>
                                    <span class="text-xs text-slate-500">{user.phone || user.email}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                            <input
                              type="text"
                              name="customerName"
                              required={!adminSelectedUserId.value}
                              value={adminSelectedUserName.value}
                              onInput$={(_, el) => adminSelectedUserName.value = el.value}
                              readOnly={!!adminSelectedUserId.value}
                              placeholder="Ej: Juan Pérez"
                              class={["w-full px-4 py-2.5 border rounded-xl focus:outline-none text-sm font-medium", adminSelectedUserId.value ? "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed" : "bg-white border-slate-200 focus:border-emerald-500"]}
                            />
                          </div>
                          <div>
                            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Teléfono</label>
                            <input
                              type="tel"
                              name="customerPhone"
                              required={!adminSelectedUserId.value}
                              value={adminSelectedUserPhone.value}
                              onInput$={(_, el) => adminSelectedUserPhone.value = el.value}
                              readOnly={!!adminSelectedUserId.value}
                              placeholder="Ej: 1123456789"
                              class={["w-full px-4 py-2.5 border rounded-xl focus:outline-none text-sm font-medium", adminSelectedUserId.value ? "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed" : "bg-white border-slate-200 focus:border-emerald-500"]}
                            />
                          </div>
                        </div>
                      </div>

                      <hr class="border-slate-100" />

                      {/* Notas */}
                      <div class="space-y-4">
                        <h3 class="text-sm font-black text-slate-800">Notas</h3>
                        <textarea name="notes" placeholder="Sólo será visible por el complejo" rows={3} class="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-emerald-500 text-sm resize-none"></textarea>
                      </div>

                      {createBookingAction.value?.failed && (
                        <div class="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-bold mt-4">
                          {createBookingAction.value.message || "Error al crear la reserva. Verificá los campos."}
                        </div>
                      )}
                    </Form>
                  </div>

                  {/* Footer Flotante */}
                  <div class="bg-white border-t border-slate-100 p-6 shrink-0 flex justify-end gap-3 z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                    <Button type="button" onClick$={() => isCreateModalOpen.value = false} look="outline" class="font-bold rounded-xl px-6 border-slate-200 text-slate-600">Cancelar</Button>
                    <Button type="button" onClick$={() => document.getElementById('create-booking-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))} look="primary" disabled={createBookingAction.isRunning || !adminFormTime.value || !adminFormDate.value || !adminFormPitchId.value} class="font-bold rounded-xl px-8 bg-emerald-800 text-white hover:bg-emerald-900 disabled:opacity-50">
                      {createBookingAction.isRunning ? "Guardando..." : "Crear Reserva"}
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal.Panel>
      </Modal.Root>

    </div>
  );
});

export const head = {
  title: "Reservas - SportGardenFutbol",
};
