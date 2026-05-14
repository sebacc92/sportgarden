import { component$, useSignal, useVisibleTask$, useTask$, $, useComputed$, useStore } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z, useNavigate, server$ } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { bookings, pitches, users, guestRequests, cashRegisters, cashMovements } from "~/db/schema";
import { eq, and, gte, lte, lt, inArray } from "drizzle-orm";
import { BookingListView } from "~/components/admin/booking-list-view";
import { BookingTimelineView } from "~/components/admin/booking-timeline-view";
import { cn } from "@qwik-ui/utils";

// New Components
import { CalendarToolbar } from "~/components/admin/calendar/CalendarToolbar";
import { CalendarDayView } from "~/components/admin/calendar/CalendarDayView";
import { CalendarWeekView } from "~/components/admin/calendar/CalendarWeekView";
import { CalendarMonthView } from "~/components/admin/calendar/CalendarMonthView";
import { BookingDetailsModal } from "~/components/admin/calendar/BookingDetailsModal";
import { CreateBookingModal } from "~/components/admin/calendar/CreateBookingModal";

// Utilities
import {
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  getBAFormatDate
} from "./utils";

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
    status: z.enum(["PENDING_APPROVAL", "CONFIRMED", "CANCELLED", "COMPLETED"]),
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

    // Generate all dates
    const datesToBook: { date: string, startTime: string, endTime: string, price: number, pitchId: string }[] = [];
    const current = new Date(startDate);
    const globalPrice = Number(data.price);

    if (data.isSubscription && data.subscriptionSchedules) {
      const schedules = JSON.parse(data.subscriptionSchedules) as { dayOfWeek: number, startTime: string, endTime: string, price: number, pitchId?: string }[];
      if (schedules.length === 0) {
        return { success: false, failed: true, message: "Debe seleccionar al menos un día de la semana para el turno fijo." };
      }

      while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const daySchedules = schedules.filter(s => s.dayOfWeek === dayOfWeek);

        for (const schedule of daySchedules) {
          datesToBook.push({
            date: current.toISOString().split("T")[0],
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            price: schedule.price,
            pitchId: schedule.pitchId || data.pitchId
          });
        }
        current.setDate(current.getDate() + 1);
      }
    } else {
      while (current <= endDate) {
        datesToBook.push({
          date: current.toISOString().split("T")[0],
          startTime: data.startTime,
          endTime: data.endTime,
          price: globalPrice,
          pitchId: data.pitchId
        });
        if (data.isSubscription) {
          current.setDate(current.getDate() + 7);
        } else {
          break; // Single booking only
        }
      }
    }

    const firstBookingId = crypto.randomUUID();
    const firstPaidAmount = Number(data.paidAmount) || 0;
    let openRegisterId: string | null = null;

    if (firstPaidAmount > 0) {
      const openRegister = await db.query.cashRegisters.findFirst({
        where: eq(cashRegisters.status, "OPEN"),
      });

      if (!openRegister) {
        return { failed: true, message: "No hay una caja abierta. Por favor, abre la caja desde el módulo de Caja antes de cobrar." };
      }
      openRegisterId = openRegister.id;
    }

    let finalUserId = data.userId || null;

    // Handle guest registration if no userId provided but customer info exists
    if (!finalUserId && data.customerPhone) {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.phone, data.customerPhone)
      });

      if (existingUser) {
        finalUserId = existingUser.id;
      } else {
        // Create new guest user
        const newUserId = crypto.randomUUID();
        await db.insert(users).values({
          id: newUserId,
          name: data.customerName || "Invitado",
          phone: data.customerPhone,
          email: data.customerEmail || null,
          role: "GUEST",
        });
        finalUserId = newUserId;
      }
    }

    const results = await db.transaction(async (tx) => {
      // Fetch all existing bookings for the relevant period to check conflicts in-memory
      const allExistingBookings = await tx.select().from(bookings).where(
        and(
          inArray(bookings.pitchId, Array.from(new Set(datesToBook.map(d => d.pitchId)))),
          gte(bookings.startTime, startDate),
          lte(bookings.endTime, endDate)
        )
      );

      const bookingsToInsert: any[] = [];
      const guestsToInsert: any[] = [];
      let bookingsCount = 0;

      for (let i = 0; i < datesToBook.length; i++) {
        const item = datesToBook[i];
        const startDateTime = new Date(`${item.date}T${item.startTime}:00`);
        const endDateTime = new Date(`${item.date}T${item.endTime}:00`);
        const bookingId = i === 0 ? firstBookingId : crypto.randomUUID();

        // In-memory conflict check
        const hasConflict = allExistingBookings.some(existing => {
          if (existing.pitchId !== item.pitchId) return false;

          const exStart = existing.startTime.getTime();
          const exEnd = existing.endTime.getTime();
          const itStart = startDateTime.getTime();
          const itEnd = endDateTime.getTime();

          return (
            (itStart >= exStart && itStart < exEnd) ||
            (itEnd > exStart && itEnd <= exEnd) ||
            (exStart >= itStart && exStart < itEnd)
          );
        });

        if (hasConflict) continue;

        bookingsToInsert.push({
          id: bookingId,
          userId: finalUserId,
          pitchId: item.pitchId,
          startTime: startDateTime,
          endTime: endDateTime,
          status: "CONFIRMED",
          totalPrice: item.price,
          paidAmount: i === 0 ? (Number(data.paidAmount) || 0) : 0,
          paymentStatus: i === 0 ? (data.paymentStatus || ((Number(data.paidAmount) || 0) >= Number(data.price) ? "PAID" : (Number(data.paidAmount) || 0) > 0 ? "PARTIAL" : "PENDING")) : "PENDING",
          paymentMethod: data.paymentMethod as any,
          isSubscription: data.isSubscription,
          notes: data.notes || null,
          extras: data.extras ? JSON.parse(data.extras) : null,
        });

        if (!data.userId) {
          guestsToInsert.push({
            id: crypto.randomUUID(),
            bookingId: bookingId,
            name: data.customerName || "Invitado",
            phone: data.customerPhone || "",
            email: data.customerEmail || null,
          });
        }

        if (i === 0 && firstPaidAmount > 0 && openRegisterId) {
          await tx.insert(cashMovements).values({
            id: crypto.randomUUID(),
            registerId: openRegisterId,
            type: "INCOME",
            category: "BOOKING",
            amount: firstPaidAmount,
            description: `Pago reserva: ${data.customerName || "Invitado"}`,
            paymentMethod: data.paymentMethod as any,
            referenceId: bookingId,
          });
        }

        // Add to in-memory to prevent conflicts within the same batch
        allExistingBookings.push({
          pitchId: item.pitchId,
          startTime: startDateTime,
          endTime: endDateTime,
        } as any);

        bookingsCount++;
      }

      if (bookingsToInsert.length > 0) {
        // SQLite has a limit on parameters per insert, so we chunk if needed
        const CHUNK_SIZE = 50;
        for (let i = 0; i < bookingsToInsert.length; i += CHUNK_SIZE) {
          await tx.insert(bookings).values(bookingsToInsert.slice(i, i + CHUNK_SIZE));
        }
      }

      if (guestsToInsert.length > 0) {
        const CHUNK_SIZE = 50;
        for (let i = 0; i < guestsToInsert.length; i += CHUNK_SIZE) {
          await tx.insert(guestRequests).values(guestsToInsert.slice(i, i + CHUNK_SIZE));
        }
      }

      return { success: true, count: bookingsCount };
    });

    if (results.count === 0) {
      return { failed: true, message: "No se pudo crear ninguna reserva. Verifique conflictos de horario." };
    }

    return { success: true, bookingId: firstBookingId, message: `Se crearon ${results.count} reservas.` };
  },
  zod$({
    pitchId: z.string(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    userId: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().optional(),
    price: z.string(),
    paidAmount: z.string().optional(),
    paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
    paymentMethod: z.string().default("CASH"),
    notes: z.string().optional(),
    extras: z.string().optional(),
    isSubscription: z.coerce.boolean().optional(),
    subscriptionSchedules: z.string().optional(),
    endDate: z.string().optional(),
  })
);

export const useAddBookingPaymentAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const amount = Number(data.amount);

    if (amount <= 0) return { failed: true, message: "El monto debe ser mayor a 0." };

    const openRegister = await db.query.cashRegisters.findFirst({
      where: eq(cashRegisters.status, "OPEN"),
    });

    if (!openRegister) {
      return { failed: true, message: "No hay una caja abierta. Abre la caja antes de registrar el pago." };
    }

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, data.bookingId),
    });

    if (!booking) return { failed: true, message: "Reserva no encontrada." };

    const newPaidAmount = (booking.paidAmount || 0) + amount;
    const newPaymentStatus = newPaidAmount >= booking.totalPrice ? "PAID" : "PARTIAL";

    await db.update(bookings)
      .set({ paidAmount: newPaidAmount, paymentStatus: newPaymentStatus })
      .where(eq(bookings.id, booking.id));

    await db.insert(cashMovements).values({
      id: crypto.randomUUID(),
      registerId: openRegister.id,
      type: "INCOME",
      category: "BOOKING",
      amount: amount,
      description: `Pago adicional reserva: ${booking.id.slice(0, 8)}`,
      paymentMethod: data.paymentMethod as any,
      referenceId: booking.id,
    });

    return { success: true };
  },
  zod$({
    bookingId: z.string(),
    amount: z.string(),
    paymentMethod: z.string(),
  })
);

export const useCalendarData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const dateStr = requestEvent.url.searchParams.get("date");
  const viewStr = requestEvent.url.searchParams.get("view") || "day"; // "day", "week", "month"

  if (!dateStr) {
    const todayStr = getBAFormatDate(new Date());
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

  const openRegister = await db.query.cashRegisters.findFirst({
    where: eq(cashRegisters.status, "OPEN"),
  });

  // Create selectedDate in BA timezone (UTC-3)
  const selectedDate = new Date(`${dateStr}T12:00:00-03:00`);


  let startDate = new Date(selectedDate);
  let endDate = new Date(selectedDate);

  if (viewStr === "week") {
    startDate = getStartOfWeek(selectedDate);
    endDate = getEndOfWeek(selectedDate);
    // Adjust week boundaries to BA time if they were created in local time
    startDate = new Date(`${getBAFormatDate(startDate)}T00:00:00-03:00`);
    endDate = new Date(`${getBAFormatDate(endDate)}T23:59:59-03:00`);
  } else if (viewStr === "month") {
    startDate = getStartOfMonth(selectedDate);
    endDate = getEndOfMonth(selectedDate);
    // Adjust month boundaries to BA time
    startDate = new Date(`${getBAFormatDate(startDate)}T00:00:00-03:00`);
    endDate = new Date(`${getBAFormatDate(endDate)}T23:59:59-03:00`);
  } else {
    // Day view - explicitly in BA time
    startDate = new Date(`${dateStr}T00:00:00-03:00`);
    endDate = new Date(`${dateStr}T23:59:59-03:00`);
  }

  const allPitches = await db.query.pitches.findMany({
    where: eq(pitches.isActive, true),
    orderBy: (pitches, { asc }) => [asc(pitches.name)],
  });

  let dailyBookings: any = [];
  let monthCounts: Record<string, number> = {};

  if (viewStr === "month") {
    // Optimized month query: only get IDs and start times
    const allMonthBookings = await db
      .select({
        id: bookings.id,
        startTime: bookings.startTime,
      })
      .from(bookings)
      .where(
        and(
          gte(bookings.startTime, startDate),
          lte(bookings.startTime, endDate)
        )
      );

    for (const b of allMonthBookings) {
      const dStr = getBAFormatDate(b.startTime);
      monthCounts[dStr] = (monthCounts[dStr] || 0) + 1;
    }
  } else {
    // Normal query for day/week
    dailyBookings = await db
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
          isSubscription: bookings.isSubscription,
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
  }

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



  return {
    selectedDateStr: getBAFormatDate(selectedDate),
    todayStr: getBAFormatDate(new Date()),
    prevDateStr: getBAFormatDate(prevDate),
    nextDateStr: getBAFormatDate(nextDate),
    view: viewStr,
    pitches: allPitches,
    bookings: dailyBookings,
    monthCounts: monthCounts,
    startDateStr: startDate.toISOString(),
    endDateStr: endDate.toISOString(),
    extraServices,
    settings: settings ? {
      id: settings.id,
      clubName: settings.clubName,
      clubAddress: settings.clubAddress,
      clubPhone: settings.clubPhone,
      bankAlias: settings.bankAlias,
      extraServices: (settings.extraServices || []) as any[],
      operatingHours: (settings.operatingHours || []) as any[],
      services: (settings.services || []) as string[],
      galleryImages: (settings.galleryImages || []) as string[],
      schoolCategories: (settings.schoolCategories || []) as any[],
      paymentMethods: (settings.paymentMethods || []) as { id: string, name: string, isActive: boolean }[],
    } : null,
    openRegister: openRegister ? {
      id: openRegister.id,
      openedAt: openRegister.openedAt.toISOString(),
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
  const addPaymentAction = useAddBookingPaymentAction();
  const nav = useNavigate();

  // Layout mode: 'timeline' (pitches×time) | 'list' (table)
  const layoutMode = useSignal<'timeline' | 'list'>('timeline');

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

  const adminSubSchedules = useStore<{ slots: { id: string, dayOfWeek: number, startTime: string, duration: string, pitchId: string }[] }>({
    slots: []
  });

  // Search user state
  const adminSearchTerm = useSignal("");
  const adminSearchResults = useSignal<any[]>([]);
  const adminSelectedUserId = useSignal("");
  const adminSelectedUserName = useSignal("");
  const adminSelectedUserPhone = useSignal("");
  const adminSelectedUserEmail = useSignal("");
  const adminIsSearching = useSignal(false);

  // Pricing & Extras
  const adminApplyDiscount = useSignal(false);
  const adminDiscountAmount = useSignal<number | "">(0);
  const adminDiscountType = useSignal<"FIXED" | "PERCENTAGE">("FIXED");
  const adminSelectedExtras = useSignal<string[]>([]);
  const adminIsFullPayment = useSignal(false);
  const adminPaidAmount = useSignal<number | "">("");

  const handleBookingClick = $((id: string) => {
    selectedBookingId.value = id;
    isModalOpen.value = true;
  });

  const selectedBookingDetails = calendarData.value.bookings.find(
    (b: any) => b.booking?.id === selectedBookingId.value
  );

  const selectedDateStr = calendarData.value.selectedDateStr;
  const view = calendarData.value.view;
  const startDateStr = calendarData.value.startDateStr;
  const endDateStr = calendarData.value.endDateStr;

  const viewSignal = useComputed$(() => calendarData.value.view);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const updateTimeIndicator = () => {
      const now = new Date();
      const isToday = getBAFormatDate(now) === selectedDateStr;

      let shouldShow = false;
      if (view === "day" && isToday) shouldShow = true;
      if (view === "week") {
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

    if (scrollContainerRef.value && showCurrentTimeLine.value) {
      setTimeout(() => {
        const container = scrollContainerRef.value;
        if (container) {
          const containerHeight = container.clientHeight;
          container.scrollTo({
            top: Math.max(0, currentTimePosition.value - (containerHeight / 2)),
            behavior: "smooth"
          });
        }
      }, 100);
    }

    const interval = setInterval(updateTimeIndicator, 60000);
    cleanup(() => clearInterval(interval));
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const successUpdate = track(() => updateStatusAction.value?.success);
    if (successUpdate) isModalOpen.value = false;

    const successCreate = track(() => createBookingAction.value?.success);
    if (successCreate) {
      isCreateModalOpen.value = false;
      adminFormDate.value = "";
      adminFormTime.value = "";
      adminOccupiedSlots.value = [];
    }
  });

  const handleNewBooking = $(() => {
    adminFormPitchId.value = "";
    adminFormDate.value = calendarData.value.selectedDateStr;
    adminFormTime.value = "";
    adminFormDuration.value = "60";
    adminIsSubscription.value = false;
    adminEndDate.value = "";
    adminNotes.value = "";
    adminDiscountAmount.value = "";
    adminDiscountType.value = "FIXED";
    adminSelectedExtras.value = [];
    adminSelectedUserId.value = "";
    adminSelectedUserName.value = "";
    adminSelectedUserPhone.value = "";
    adminSelectedUserEmail.value = "";
    adminIsFullPayment.value = false;
    adminPaidAmount.value = "";
    isCreateModalOpen.value = true;
  });

  const handleViewChange = $((newView: string) => {
    nav(`?date=${selectedDateStr}&view=${newView}`);
  });

  // Remove useTask$ for grid forcing

  // Generate days for Week View
  const weekDays = useComputed$(() => {
    const days = [];
    if (view === "week") {
      const current = new Date(startDateStr);
      const end = new Date(endDateStr);
      while (current <= end) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }
    return days;
  });

  // Generate days for Month View
  const monthDays = useComputed$(() => {
    const days = [];
    if (view === "month") {
      const current = new Date(startDateStr);
      while (current.getDay() !== 1) current.setDate(current.getDate() - 1);
      const startRender = new Date(current);

      const endMonth = new Date(endDateStr);
      while (endMonth.getDay() !== 0) endMonth.setDate(endMonth.getDate() + 1);

      const renderCursor = new Date(startRender);
      while (renderCursor <= endMonth) {
        days.push(new Date(renderCursor));
        renderCursor.setDate(renderCursor.getDate() + 1);
      }
    }
    return days;
  });

  return (
    <div class="flex flex-col h-full overflow-hidden bg-slate-50 text-slate-900 font-sans">
      <CalendarToolbar
        calendarData={calendarData.value}
        layoutMode={layoutMode}
        isCreateModalOpen={isCreateModalOpen}
        onViewChange$={handleViewChange}
        onNewBooking$={handleNewBooking}
      />

      {calendarData.value.view === "day" ? (
        layoutMode.value === 'list' ? (
          <main class="flex-1 overflow-auto p-6">
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
              <BookingListView
                pitches={calendarData.value.pitches}
                bookings={calendarData.value.bookings as any}
                onBookingClick$={handleBookingClick}
              />
            </div>
          </main>
        ) : (
          <main class="flex-1 overflow-auto p-6">
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
              <BookingTimelineView
                pitches={calendarData.value.pitches}
                bookings={calendarData.value.bookings as any}
                slotMinutes={30}
                startHour={CALENDAR_START_HOUR}
                endHour={CALENDAR_END_HOUR}
                onBookingClick$={handleBookingClick}
                onEmptySlotDragEnd$={(pitchId, time, duration) => {
                  adminFormPitchId.value = pitchId;
                  adminFormDate.value = getBAFormatDate(new Date(selectedDateStr + 'T12:00:00'));
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
            </div>
          </main>
        )
      ) : (
        <main class="flex-1 overflow-auto p-6 relative">
          <div class={cn(
            "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full",
            calendarData.value.view !== "month" ? "min-w-[900px]" : "min-w-[700px]"
          )}>
            {calendarData.value.view === "week" && (
              <CalendarWeekView
                calendarData={calendarData.value}
                weekDays={weekDays.value}
                hours={hours}
                pixelsPerHour={PIXELS_PER_HOUR}
                calendarStartHour={CALENDAR_START_HOUR}
                showCurrentTimeLine={showCurrentTimeLine}
                currentTimePosition={currentTimePosition}
                scrollContainerRef={scrollContainerRef}
                onBookingClick$={handleBookingClick}
                onEmptySlotClick$={(pitchId, time) => {
                  adminFormPitchId.value = pitchId;
                  adminFormDate.value = selectedDateStr;
                  adminFormTime.value = time;
                  adminFormDuration.value = "60";
                  isCreateModalOpen.value = true;
                }}
              />
            )}
            {calendarData.value.view === "month" && (
              <CalendarMonthView
                calendarData={calendarData.value}
                monthDays={monthDays.value}
                onDayClick$={(dateStr) => {
                  nav(`?date=${dateStr}&view=day`);
                }}
              />
            )}
          </div>
        </main>
      )}

      <BookingDetailsModal
        isModalOpen={isModalOpen}
        selectedBookingDetails={selectedBookingDetails}
        calendarData={calendarData.value}
        addPaymentAction={addPaymentAction}
        updateStatusAction={updateStatusAction}
      />

      <CreateBookingModal
        isCreateModalOpen={isCreateModalOpen}
        calendarData={calendarData.value}
        createBookingAction={createBookingAction}
        adminFormPitchId={adminFormPitchId}
        adminFormDate={adminFormDate}
        adminFormTime={adminFormTime}
        adminFormDuration={adminFormDuration}
        adminIsSubscription={adminIsSubscription}
        adminEndDate={adminEndDate}
        adminNotes={adminNotes}
        adminOccupiedSlots={adminOccupiedSlots}
        adminIsChecking={adminIsChecking}
        adminSubSchedules={adminSubSchedules}
        adminSearchTerm={adminSearchTerm}
        adminSearchResults={adminSearchResults}
        adminSelectedUserId={adminSelectedUserId}
        adminSelectedUserName={adminSelectedUserName}
        adminSelectedUserPhone={adminSelectedUserPhone}
        adminSelectedUserEmail={adminSelectedUserEmail}
        adminIsSearching={adminIsSearching}
        adminApplyDiscount={adminApplyDiscount}
        adminDiscountAmount={adminDiscountAmount}
        adminDiscountType={adminDiscountType}
        adminSelectedExtras={adminSelectedExtras}
        adminIsFullPayment={adminIsFullPayment}
        adminPaidAmount={adminPaidAmount}
      />
    </div>
  );
});

export const head = {
  title: "Reservas - GardenClubFutbol",
};
