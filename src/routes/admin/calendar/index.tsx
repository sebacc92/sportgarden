import {
  component$,
  useSignal,
  useVisibleTask$,
  useTask$,
  $,
  useComputed$,
  useStore,
  useStyles$,
} from "@builder.io/qwik";
import { routeLoader$, useNavigate } from "@builder.io/qwik-city";
import { createClient } from "@supabase/supabase-js";
import { getDB, camelize } from "~/db";
import { bookings, pitches, guestRequests, users, cashRegisters, siteSettings } from "~/db/schema";
import { BookingListView } from "~/components/admin/booking-list-view";
import { BookingTimelineView } from "~/components/admin/booking-timeline-view";
import { cn } from "@qwik-ui/utils";
import { CalendarToolbar } from "~/components/admin/calendar/CalendarToolbar";
import { CalendarWeekView } from "~/components/admin/calendar/CalendarWeekView";
import { CalendarMonthView } from "~/components/admin/calendar/CalendarMonthView";
import { BookingDetailsModal } from "~/components/admin/calendar/BookingDetailsModal";
import { CreateBookingModal } from "~/components/admin/calendar/CreateBookingModal";
import { PrintModal } from "~/components/admin/calendar/PrintModal";

import {
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  getBAFormatDate,
  getBADayOfWeek,
  playNotificationBeep,
  toBALocalISOString,
  parseDatabaseDate,
} from "./utils";

import printStyles from "./calendar.css?inline";

// Re-export server actions and functions so components can import from this route module
export {
  useUpdateBookingStatusAction,
  useCreateAdminBookingAction,
  useAddBookingPaymentAction,
  useConfirmAttendanceAction,
  fetchRealtimeBookingDetails,
  getAdminDailyBookings,
  searchUsersServer,
} from "./calendar.actions";

import {
  useUpdateBookingStatusAction,
  useCreateAdminBookingAction,
  useAddBookingPaymentAction,
  useConfirmAttendanceAction,
  fetchRealtimeBookingDetails,
} from "./calendar.actions";

export const useCalendarData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const dateStr = requestEvent.url.searchParams.get("date");
  const viewStr = requestEvent.url.searchParams.get("view") || "day";

  if (!dateStr) {
    const todayStr = getBAFormatDate(new Date());
    throw requestEvent.redirect(302, `?date=${todayStr}&view=${viewStr}`);
  }

  const now = new Date();
  const { error: completeErr } = await db
    .from(bookings)
    .update({ status: "COMPLETED" })
    .eq("status", "CONFIRMED")
    .lt("end_time", toBALocalISOString(now))
    .not("payment_method", "in", '("CUENTA_CORRIENTE","CURRENT_ACCOUNT")');

  if (completeErr) throw completeErr;

  const { data: settingsData, error: settingsErr } = await db
    .from(siteSettings)
    .select("*")
    .maybeSingle();

  if (settingsErr) throw settingsErr;
  const settings = camelize<any>(settingsData);

  const { data: openRegisterData, error: regErr } = await db
    .from(cashRegisters)
    .select("*")
    .eq("status", "OPEN")
    .maybeSingle();

  if (regErr) throw regErr;
  const openRegister = camelize<any>(openRegisterData);

  const selectedDate = new Date(`${dateStr}T12:00:00-03:00`);

  let startDate: Date;
  let endDate: Date;

  if (viewStr === "week") {
    startDate = new Date(`${getBAFormatDate(getStartOfWeek(selectedDate))}T00:00:00-03:00`);
    endDate = new Date(`${getBAFormatDate(getEndOfWeek(selectedDate))}T23:59:59-03:00`);
  } else if (viewStr === "month") {
    startDate = new Date(`${getBAFormatDate(getStartOfMonth(selectedDate))}T00:00:00-03:00`);
    endDate = new Date(`${getBAFormatDate(getEndOfMonth(selectedDate))}T23:59:59-03:00`);
  } else {
    startDate = new Date(`${dateStr}T00:00:00-03:00`);
    endDate = new Date(`${dateStr}T23:59:59-03:00`);
  }

  const { data: pitchesData, error: pitchesErr } = await db
    .from(pitches)
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (pitchesErr) throw pitchesErr;
  const pitchesRaw = camelize<any[]>(pitchesData || []);

  const { data: pricingRulesData, error: pricingErr } = await db
    .from("pitch_pricing_rules")
    .select("*");

  if (pricingErr) throw pricingErr;
  const pricingRulesRaw = camelize<any[]>(pricingRulesData || []);

  const { data: overlapsData, error: overlapsErr } = await db
    .from("pitch_overlaps")
    .select("*");

  if (overlapsErr) throw overlapsErr;
  const overlapsRaw = camelize<any[]>(overlapsData || []);

  const allPitches = pitchesRaw.map((p) => {
    const pricingRules = pricingRulesRaw.filter((rule) => rule.pitchId === p.id);
    const overlaps = overlapsRaw.filter((o) => o.pitchId === p.id);
    const overlappedBy = overlapsRaw.filter((o) => o.overlapPitchId === p.id);
    const overlapIds = new Set<string>();
    overlaps.forEach((o: any) => overlapIds.add(o.overlapPitchId));
    overlappedBy.forEach((o: any) => overlapIds.add(o.pitchId));
    return { ...p, pricingRules, overlaps, overlappedBy, overlapPitchIds: Array.from(overlapIds) };
  });

  let dailyBookings: any = [];
  const monthCounts: Record<string, number> = {};

  if (viewStr === "month") {
    const { data: allMonthBookingsData, error: monthErr } = await db
      .from(bookings)
      .select("id, start_time")
      .gte("start_time", toBALocalISOString(startDate))
      .lte("start_time", toBALocalISOString(endDate));

    if (monthErr) throw monthErr;
    const allMonthBookings = camelize<any[]>(allMonthBookingsData || []);

    for (const b of allMonthBookings) {
      const dStr = getBAFormatDate(parseDatabaseDate(b.startTime));
      monthCounts[dStr] = (monthCounts[dStr] || 0) + 1;
    }
  } else {
    const { data: bookingsData, error: bookingsErr } = await db
      .from(bookings)
      .select("*")
      .gte("start_time", toBALocalISOString(startDate))
      .lte("start_time", toBALocalISOString(endDate));

    if (bookingsErr) throw bookingsErr;

    const bookingsRaw = camelize<any[]>(
      (bookingsData || []).map((b: any) => ({
        ...b,
        start_time: parseDatabaseDate(b.start_time).toISOString(),
        end_time: parseDatabaseDate(b.end_time).toISOString(),
      })),
    );

    if (bookingsRaw.length > 0) {
      const userIds = Array.from(new Set(bookingsRaw.map((b) => b.userId).filter(Boolean)));
      const bookingIds = bookingsRaw.map((b) => b.id);

      const [{ data: usersData, error: usersErr }, { data: guestsData, error: guestsErr }] =
        await Promise.all([
          db.from(users).select("id, name, phone").in("id", userIds),
          db.from(guestRequests).select("id, booking_id, name, phone").in("booking_id", bookingIds),
        ]);

      if (usersErr) throw usersErr;
      if (guestsErr) throw guestsErr;

      const usersRaw = camelize<any[]>(usersData || []);
      const guestsRaw = camelize<any[]>(guestsData || []);

      dailyBookings = bookingsRaw.map((b) => ({
        booking: b,
        user: usersRaw.find((u) => u.id === b.userId) || null,
        guest: guestsRaw.find((g) => g.bookingId === b.id) || null,
      }));
    }
  }

  if (settings?.schoolCategories) {
    const schoolCategories = settings.schoolCategories as any[];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = getBADayOfWeek(currentDate);
      const dStr = getBAFormatDate(currentDate);

      for (const cat of schoolCategories) {
        for (const sched of cat.schedules || []) {
          if (sched.day === dayOfWeek && sched.pitchId && sched.startTime && sched.endTime) {
            if (viewStr === "month") {
              monthCounts[dStr] = (monthCounts[dStr] || 0) + 1;
            } else {
              dailyBookings.push({
                booking: {
                  id: `school-${cat.id}-${dStr}`,
                  pitchId: sched.pitchId,
                  startTime: new Date(`${dStr}T${sched.startTime.padStart(5, "0")}:00-03:00`),
                  endTime: new Date(`${dStr}T${sched.endTime.padStart(5, "0")}:00-03:00`),
                  status: "CONFIRMED",
                  totalPrice: 0,
                  paidAmount: 0,
                  paymentStatus: "PAID",
                  isSubscription: true,
                  bookingType: "SCHOOL",
                  isSchool: true,
                },
                user: { id: "school", name: `Esc. ${cat.name}`, phone: null },
                guest: null,
              });
            }
          }
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
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
    monthCounts,
    startDateStr: startDate.toISOString(),
    endDateStr: endDate.toISOString(),
    extraServices: (settings?.extraServices || []) as { name: string; price: number; icon: string }[],
    settings: settings
      ? {
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
          paymentMethods: (settings.paymentMethods || []) as { id: string; name: string; isActive: boolean }[],
          holidays: (settings.holidays || []) as any[],
        }
      : null,
    openRegister: openRegister
      ? { id: openRegister.id, openedAt: new Date(openRegister.openedAt).toISOString() }
      : null,
  };
});

export default component$(() => {
  const calendarData = useCalendarData();
  const updateStatusAction = useUpdateBookingStatusAction();
  const createBookingAction = useCreateAdminBookingAction();
  const addPaymentAction = useAddBookingPaymentAction();
  const confirmAttendanceAction = useConfirmAttendanceAction();
  const nav = useNavigate();

  useStyles$(printStyles);

  const isSoundEnabled = useSignal(false);
  const localBookings = useSignal<any[]>([]);
  const layoutMode = useSignal<"timeline" | "list">("timeline");

  // Modal state
  const isModalOpen = useSignal(false);
  const selectedBookingId = useSignal("");
  const isCreateModalOpen = useSignal(false);
  const isPrintModalOpen = useSignal(false);

  // Admin form state
  const adminFormPitchId = useSignal("");
  const adminFormDate = useSignal("");
  const adminFormTime = useSignal("");
  const adminFormDuration = useSignal("60");
  const adminIsSubscription = useSignal(false);
  const adminBookingType = useSignal<"EVENTUAL" | "FIXED" | "BIRTHDAY" | "TOURNAMENT" | "SCHOOL">("EVENTUAL");
  const adminEndDate = useSignal("");
  const adminNotes = useSignal("");
  const adminOccupiedSlots = useSignal<{ startTime: string; endTime: string }[]>([]);
  const adminIsChecking = useSignal(false);
  const adminSubSchedules = useStore<{
    slots: { id: string; dayOfWeek: number; startTime: string; duration: string; pitchId: string }[];
  }>({ slots: [] });

  // User search state
  const adminSearchTerm = useSignal("");
  const adminSearchResults = useSignal<any[]>([]);
  const adminSelectedUserId = useSignal("");
  const adminSelectedUserName = useSignal("");
  const adminSelectedUserPhone = useSignal("");
  const adminSelectedUserEmail = useSignal("");
  const adminIsSearching = useSignal(false);

  // Pricing state
  const adminApplyDiscount = useSignal(false);
  const adminDiscountAmount = useSignal<number | "">(0);
  const adminDiscountType = useSignal<"FIXED" | "PERCENTAGE">("FIXED");
  const adminSelectedExtras = useSignal<string[]>([]);
  const adminIsFullPayment = useSignal(false);
  const adminPaidAmount = useSignal<number | "">("");

  // Calendar display
  const currentTimePosition = useSignal(0);
  const showCurrentTimeLine = useSignal(false);
  const scrollContainerRef = useSignal<HTMLElement>();

  // Keep localBookings in sync with loader data
  useTask$(({ track }) => {
    const b = track(() => calendarData.value.bookings);
    localBookings.value = [...(b || [])];
  });

  // Close modals on action success — useTask$ is correct here (no DOM needed)
  useTask$(({ track }) => {
    const success = track(() => updateStatusAction.value?.success);
    if (success) isModalOpen.value = false;
  });

  useTask$(({ track }) => {
    const success = track(() => createBookingAction.value?.success);
    if (!success) return;
    const warnings = (createBookingAction.value as any)?.warnings as string[] | undefined;
    if (warnings?.length) {
      alert(
        `Abono creado con éxito.\n\n⚠️ Se omitieron las siguientes fechas por conflicto o club cerrado/fuera de horario:\n- ${warnings.join("\n- ")}`,
      );
    }
    isCreateModalOpen.value = false;
    adminFormDate.value = "";
    adminFormTime.value = "";
    adminOccupiedSlots.value = [];
  });

  // Sound preference — requires localStorage (browser-only)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const stored = localStorage.getItem("calendar_sound_enabled");
    if (stored !== null) isSoundEnabled.value = stored === "true";
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    localStorage.setItem("calendar_sound_enabled", String(track(() => isSoundEnabled.value)));
  });

  // Current time indicator — requires DOM + setInterval (browser-only)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const { view, selectedDateStr, startDateStr, endDateStr } = calendarData.value;

    const updateTimeIndicator = () => {
      const now = new Date();
      let shouldShow = false;
      if (view === "day") shouldShow = getBAFormatDate(now) === selectedDateStr;
      if (view === "week") {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        shouldShow = now >= start && now <= end;
      }
      showCurrentTimeLine.value = shouldShow;
      if (shouldShow) {
        currentTimePosition.value =
          (now.getHours() + now.getMinutes() / 60 - CALENDAR_START_HOUR) * PIXELS_PER_HOUR;
      }
    };

    updateTimeIndicator();

    if (scrollContainerRef.value && showCurrentTimeLine.value) {
      setTimeout(() => {
        const container = scrollContainerRef.value;
        if (container) {
          container.scrollTo({
            top: Math.max(0, currentTimePosition.value - container.clientHeight / 2),
            behavior: "smooth",
          });
        }
      }, 100);
    }

    const interval = setInterval(updateTimeIndicator, 60000);
    cleanup(() => clearInterval(interval));
  });

  // Supabase Realtime subscription — browser-only
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[Realtime] Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY");
      return;
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const mapDbBookingToEntry = async (raw: any) => {
      const b = {
        id: raw.id,
        userId: raw.user_id,
        pitchId: raw.pitch_id,
        startTime: parseDatabaseDate(raw.start_time).toISOString(),
        endTime: parseDatabaseDate(raw.end_time).toISOString(),
        status: raw.status,
        totalPrice: Number(raw.total_price) || 0,
        paidAmount: Number(raw.paid_amount) || 0,
        paymentStatus: raw.payment_status,
        paymentMethod: raw.payment_method,
        isSubscription: !!raw.is_subscription,
        bookingType: raw.booking_type,
        notes: raw.notes,
        extras: raw.extras,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      };
      try {
        const details = await fetchRealtimeBookingDetails(b.id, b.userId);
        return { booking: b, user: details.user, guest: details.guest };
      } catch {
        return { booking: b, user: null, guest: null };
      }
    };

    const { startDateStr, endDateStr } = calendarData.value;

    const channel = supabaseClient
      .channel("bookings-realtime-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, async (payload) => {
        if (payload.eventType === "INSERT") {
          if (isSoundEnabled.value) playNotificationBeep();
          const entry = await mapDbBookingToEntry(payload.new);
          const bookingDate = new Date(entry.booking.startTime);
          if (bookingDate >= new Date(startDateStr) && bookingDate <= new Date(endDateStr)) {
            if (!localBookings.value.some((item) => item.booking.id === entry.booking.id)) {
              localBookings.value = [...localBookings.value, entry];
            }
          }
        } else if (payload.eventType === "UPDATE") {
          const entry = await mapDbBookingToEntry(payload.new);
          const bookingDate = new Date(entry.booking.startTime);
          const inRange = bookingDate >= new Date(startDateStr) && bookingDate <= new Date(endDateStr);
          if (inRange) {
            const exists = localBookings.value.some((item) => item.booking.id === entry.booking.id);
            localBookings.value = exists
              ? localBookings.value.map((item) => (item.booking.id === entry.booking.id ? entry : item))
              : [...localBookings.value, entry];
          } else {
            localBookings.value = localBookings.value.filter((item) => item.booking.id !== entry.booking.id);
          }
        } else if (payload.eventType === "DELETE") {
          localBookings.value = localBookings.value.filter(
            (item) => item.booking.id !== (payload.old as any).id,
          );
        }
      })
      .subscribe();

    cleanup(() => supabaseClient.removeChannel(channel));
  });

  const clubSettings = calendarData.value.settings;
  const operatingHours = (() => {
    try {
      if (typeof clubSettings?.operatingHours === "string")
        return JSON.parse(clubSettings.operatingHours);
      if (Array.isArray(clubSettings?.operatingHours)) return clubSettings.operatingHours;
      return [];
    } catch {
      return [];
    }
  })();

  const isHoliday = (clubSettings as any)?.holidays?.some(
    (h: any) => h.date === calendarData.value.selectedDateStr,
  );
  const dayOfWeek = isHoliday ? 7 : getBADayOfWeek(calendarData.value.selectedDateStr);
  const todaySchedule = operatingHours.find((h: any) => h.day === dayOfWeek);

  const CALENDAR_START_HOUR = todaySchedule?.openTime
    ? parseInt(todaySchedule.openTime.split(":")[0], 10) +
      parseInt(todaySchedule.openTime.split(":")[1] || "0", 10) / 60
    : 8;
  const CALENDAR_END_HOUR = todaySchedule?.closeTime
    ? parseInt(todaySchedule.closeTime.split(":")[0], 10) +
      parseInt(todaySchedule.closeTime.split(":")[1] || "0", 10) / 60
    : 23;
  const PIXELS_PER_HOUR = 140;

  const hours = Array.from(
    { length: Math.ceil(CALENDAR_END_HOUR - CALENDAR_START_HOUR) },
    (_, i) => CALENDAR_START_HOUR + i,
  );

  const selectedDateStr = calendarData.value.selectedDateStr;
  const view = calendarData.value.view;

  const selectedBookingDetails = localBookings.value.find(
    (b: any) => b.booking?.id === selectedBookingId.value,
  );

  const weekDays = useComputed$(() => {
    if (view !== "week") return [];
    const days = [];
    const current = new Date(calendarData.value.startDateStr);
    const end = new Date(calendarData.value.endDateStr);
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  });

  const monthDays = useComputed$(() => {
    if (view !== "month") return [];
    const days = [];
    const current = new Date(calendarData.value.startDateStr);
    while (current.getDay() !== 1) current.setDate(current.getDate() - 1);
    const endMonth = new Date(calendarData.value.endDateStr);
    while (endMonth.getDay() !== 0) endMonth.setDate(endMonth.getDate() + 1);
    const cursor = new Date(current);
    while (cursor <= endMonth) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  });

  const handleBookingClick = $((id: string) => {
    selectedBookingId.value = id;
    isModalOpen.value = true;
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

  return (
    <div class="flex h-full flex-col overflow-hidden bg-slate-50 font-sans text-slate-900">
      <CalendarToolbar
        calendarData={calendarData.value}
        layoutMode={layoutMode}
        isCreateModalOpen={isCreateModalOpen}
        isPrintModalOpen={isPrintModalOpen}
        isSoundEnabled={isSoundEnabled}
        onViewChange$={handleViewChange}
        onNewBooking$={handleNewBooking}
      />

      {view === "day" ? (
        <main class="flex-1 overflow-auto p-6">
          <div class="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {layoutMode.value === "list" ? (
              <BookingListView
                pitches={calendarData.value.pitches}
                bookings={localBookings.value as any}
                onBookingClick$={handleBookingClick}
              />
            ) : (
              <BookingTimelineView
                pitches={calendarData.value.pitches}
                bookings={localBookings.value as any}
                slotMinutes={30}
                startHour={CALENDAR_START_HOUR}
                endHour={CALENDAR_END_HOUR}
                onBookingClick$={handleBookingClick}
                onEmptySlotDragEnd$={(pitchId, time, duration) => {
                  adminFormPitchId.value = pitchId;
                  adminFormDate.value = getBAFormatDate(new Date(selectedDateStr + "T12:00:00-03:00"));
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
            )}
          </div>
        </main>
      ) : (
        <main class="relative flex-1 overflow-auto p-6">
          <div
            class={cn(
              "flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
              view !== "month" ? "min-w-[900px]" : "min-w-[700px]",
            )}
          >
            {view === "week" && (
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
            {view === "month" && (
              <CalendarMonthView
                calendarData={calendarData.value}
                monthDays={monthDays.value}
                onDayClick$={(dateStr) => nav(`?date=${dateStr}&view=day`)}
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
        confirmAttendanceAction={confirmAttendanceAction}
      />

      <PrintModal
        isPrintModalOpen={isPrintModalOpen}
        selectedDateStr={calendarData.value.selectedDateStr}
        bookings={localBookings.value}
        pitches={calendarData.value.pitches}
        settings={calendarData.value.settings}
        todaySchedule={todaySchedule}
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
        adminBookingType={adminBookingType}
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
