import { component$, useSignal, useTask$, useVisibleTask$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
  server$,
} from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import {
  pitchSubscriptions,
  pitches,
  bookings,
  users,
  groups,
  guestRequests,
  siteSettings,
} from "~/db/schema";
import {
  HORIZON_WEEKS,
  createSubscriptionWithBookings,
  extendActiveSubscriptions,
  findDuplicateActiveSubscription,
  generateOccurrences,
  getHorizonEndDate,
} from "~/lib/admin/subscriptions";
import {
  getBADayOfWeek,
  getBAFormatDate,
  getBAHoursAndMinutes,
  parseDatabaseDate,
  toBALocalISOString,
} from "~/routes/admin/calendar/utils";
import { isPitchAvailable } from "~/utils/availability";
import { Button, Modal } from "~/components/ui";

export const useSubscriptionsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  const { data: allPitches, error: pitchesErr } = await db
    .from(pitches)
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (pitchesErr) throw pitchesErr;

  const { data: subsData, error: subsErr } = await db
    .from(pitchSubscriptions)
    .select(`
      *,
      pitch:pitches(*),
      user:users(*),
      group:groups(*)
    `)
    .order("created_at", { ascending: false });

  if (subsErr) throw subsErr;
  const subscriptions = camelize<any[]>(subsData || []);

  // Per-subscription stats: future bookings, last generated date, conflicts.
  // Compare against the START of today in BA: an occurrence scheduled for
  // today is still "today" even if its hour has already passed, otherwise
  // the badge would show a phantom conflict between the booking's hour and
  // midnight.
  const now = new Date();
  const startOfTodayBA = new Date(
    `${getBAFormatDate(now)}T00:00:00-03:00`,
  );
  const { data: futureData, error: futureErr } = await db
    .from(bookings)
    .select("notes, start_time, status")
    .like("notes", "subscription:%")
    .gte("start_time", toBALocalISOString(startOfTodayBA));

  if (futureErr) throw futureErr;
  const futureRows = camelize<any[]>(futureData || []);

  const bySub: Record<
    string,
    { dates: Set<string>; futureCount: number; lastDateStr: string | null }
  > = {};
  for (const row of futureRows) {
    const subId = String(row.notes || "").replace("subscription:", "");
    if (!subId) continue;
    const dateStr = getBAFormatDate(parseDatabaseDate(row.startTime));
    if (!bySub[subId]) {
      bySub[subId] = { dates: new Set(), futureCount: 0, lastDateStr: null };
    }
    bySub[subId].dates.add(dateStr);
    if (row.status === "CONFIRMED") bySub[subId].futureCount++;
    if (!bySub[subId].lastDateStr || dateStr > bySub[subId].lastDateStr!) {
      bySub[subId].lastDateStr = dateStr;
    }
  }

  const stats: Record<
    string,
    { futureCount: number; lastDateStr: string | null; conflictCount: number }
  > = {};
  for (const sub of subscriptions) {
    const agg = bySub[sub.id];
    if (!agg || !agg.lastDateStr) {
      stats[sub.id] = { futureCount: 0, lastDateStr: null, conflictCount: 0 };
      continue;
    }
    // Expected occurrences between today and last generated date that have
    // no booking row at all → they were skipped due to a conflict.
    const lastDate = new Date(`${agg.lastDateStr}T12:00:00-03:00`);
    const expected = generateOccurrences(sub, startOfTodayBA, lastDate);
    const conflictCount = expected.filter(
      (o) => !agg.dates.has(o.dateStr),
    ).length;
    stats[sub.id] = {
      futureCount: agg.futureCount,
      lastDateStr: agg.lastDateStr,
      conflictCount,
    };
  }

  return {
    pitches: camelize<any[]>(allPitches || []),
    subscriptions,
    stats,
  };
});

type ConflictReason =
  | { type: "BOOKING"; pitchName: string; customer: string; range: string }
  | { type: "SCHOOL"; categoryName: string; range: string }
  | { type: "CLOSED"; note: string }
  | { type: "UNKNOWN" };

export interface SubscriptionConflictDetail {
  dateStr: string; // YYYY-MM-DD in BA
  reasons: ConflictReason[];
}

export const getSubscriptionConflicts = server$(async function (
  subscriptionId: string,
): Promise<SubscriptionConflictDetail[]> {
  const db = getDB(this as any);

  const { data: subData, error: subErr } = await db
    .from(pitchSubscriptions)
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (subErr) throw subErr;
  if (!subData) return [];
  const sub = camelize<any>(subData);

  const { data: settingsData } = await db
    .from(siteSettings)
    .select("*")
    .maybeSingle();
  const settings = camelize<any>(settingsData);
  const schoolCategories = (settings?.schoolCategories || []) as any[];
  const operatingHours = (() => {
    try {
      if (typeof settings?.operatingHours === "string")
        return JSON.parse(settings.operatingHours);
      if (Array.isArray(settings?.operatingHours))
        return settings.operatingHours;
      return [];
    } catch {
      return [];
    }
  })();
  const holidays = (settings?.holidays || []) as any[];

  // Related pitch IDs (bidirectional overlaps)
  const { data: overlapsData } = await db
    .from("pitch_overlaps")
    .select("*")
    .or(
      `pitch_id.eq.${sub.pitchId},overlap_pitch_id.eq.${sub.pitchId}`,
    );
  const overlaps = camelize<any[]>(overlapsData || []);
  const relatedPitchIds = [
    sub.pitchId,
    ...overlaps.map((o: any) =>
      o.pitchId === sub.pitchId ? o.overlapPitchId : o.pitchId,
    ),
  ];

  const { data: pitchesData } = await db
    .from(pitches)
    .select("id, name");
  const pitchById = new Map(
    camelize<any[]>(pitchesData || []).map((p: any) => [p.id, p.name]),
  );

  // Already-created bookings for this subscription
  const { data: existingData } = await db
    .from(bookings)
    .select("start_time")
    .eq("notes", `subscription:${sub.id}`);
  const existingDates = new Set(
    camelize<any[]>(existingData || []).map((r: any) =>
      getBAFormatDate(parseDatabaseDate(r.startTime)),
    ),
  );

  // Build expected occurrences from the start of today (BA) to the rolling
  // horizon. Using start-of-today keeps today's occurrence in scope even if
  // its scheduled hour has already passed.
  const now = new Date();
  const startOfTodayBA = new Date(
    `${getBAFormatDate(now)}T00:00:00-03:00`,
  );
  const horizonEnd = getHorizonEndDate(now);
  const occurrences = generateOccurrences(
    sub,
    startOfTodayBA,
    horizonEnd,
  );
  const missing = occurrences.filter((o) => !existingDates.has(o.dateStr));
  if (missing.length === 0) return [];

  // Pre-fetch all blocking bookings in a single query
  const minStart = missing[0].start;
  const maxEnd = missing[missing.length - 1].end;
  const { data: blockingData } = await db
    .from(bookings)
    .select(
      "id, pitch_id, start_time, end_time, status, user_id, notes",
    )
    .in("pitch_id", relatedPitchIds)
    .lt("start_time", toBALocalISOString(maxEnd))
    .gt("end_time", toBALocalISOString(minStart))
    .in("status", [
      "CONFIRMED",
      "PENDING_APPROVAL",
      "PENDING_PAYMENT",
      "COMPLETED",
    ])
    .neq("notes", `subscription:${sub.id}`);
  const blocking = camelize<any[]>(blockingData || []).map((b: any) => ({
    ...b,
    _start: parseDatabaseDate(b.startTime),
    _end: parseDatabaseDate(b.endTime),
  }));

  // Resolve customer names in bulk
  const userIds = Array.from(
    new Set(blocking.map((b) => b.userId).filter(Boolean)),
  );
  const bookingIds = blocking.map((b) => b.id);
  const [{ data: usersData }, { data: guestsData }] = await Promise.all([
    userIds.length > 0
      ? db.from(users).select("id, name").in("id", userIds)
      : Promise.resolve({ data: [] as any[] }),
    bookingIds.length > 0
      ? db
          .from(guestRequests)
          .select("booking_id, name")
          .in("booking_id", bookingIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const userById = new Map(
    camelize<any[]>(usersData || []).map((u: any) => [u.id, u.name]),
  );
  const guestByBooking = new Map(
    camelize<any[]>(guestsData || []).map((g: any) => [g.bookingId, g.name]),
  );

  const fmtHHMM = (d: Date) => {
    const p = getBAHoursAndMinutes(d);
    return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  };

  const details: SubscriptionConflictDetail[] = [];
  for (const occ of missing) {
    const reasons: ConflictReason[] = [];

    // 1. Closed (holiday or no operating hours)
    const isHoliday = holidays.some((h: any) => h.date === occ.dateStr);
    const dayOfWeek = isHoliday ? 7 : getBADayOfWeek(occ.start);
    const schedule = operatingHours.find((h: any) => h.day === dayOfWeek);
    if (!schedule || schedule.isClosed) {
      reasons.push({
        type: "CLOSED",
        note: isHoliday ? "Feriado" : "Club cerrado ese día",
      });
    } else {
      // Check fits within operating hours
      const [openH, openM] = (schedule.openTime || "0:0").split(":").map(Number);
      const [closeH, closeM] = (schedule.closeTime || "24:0")
        .split(":")
        .map(Number);
      const openMins = openH * 60 + (openM || 0);
      let closeMins = closeH * 60 + (closeM || 0);
      if (closeMins === 0) closeMins = 24 * 60;
      const startMins = sub.startTime
        .split(":")
        .map(Number)
        .reduce((acc: number, n: number, i: number) =>
          i === 0 ? n * 60 : acc + n,
        );
      const endMins = sub.endTime
        .split(":")
        .map(Number)
        .reduce((acc: number, n: number, i: number) =>
          i === 0 ? n * 60 : acc + n,
        );
      if (startMins < openMins || endMins > closeMins) {
        reasons.push({
          type: "CLOSED",
          note: "Fuera del horario de atención del club",
        });
      }
    }

    // 2. Overlapping bookings
    for (const b of blocking) {
      const overlaps = b._start < occ.end && b._end > occ.start;
      if (!overlaps) continue;
      const customer =
        guestByBooking.get(b.id) ||
        (b.userId ? userById.get(b.userId) : null) ||
        "Reserva sin titular";
      reasons.push({
        type: "BOOKING",
        pitchName: pitchById.get(b.pitchId) || "Cancha",
        customer,
        range: `${fmtHHMM(b._start)} - ${fmtHHMM(b._end)}`,
      });
    }

    // 3. School class overlap
    for (const cat of schoolCategories) {
      if (!cat.schedules) continue;
      for (const sched of cat.schedules) {
        if (
          sched.day === dayOfWeek &&
          sched.pitchId &&
          relatedPitchIds.includes(sched.pitchId) &&
          sub.startTime < sched.endTime &&
          sub.endTime > sched.startTime
        ) {
          reasons.push({
            type: "SCHOOL",
            categoryName: cat.name || "Escuelita",
            range: `${sched.startTime} - ${sched.endTime}`,
          });
        }
      }
    }

    if (reasons.length === 0) {
      reasons.push({ type: "UNKNOWN" });
    }

    details.push({ dateStr: occ.dateStr, reasons });
  }

  return details;
});

export const searchOwnersServer = server$(async function (
  query: string,
  type: "USER" | "GROUP",
) {
  if (!query || query.length < 2) return [];
  const db = getDB(this as any);
  const pattern = `%${query}%`;

  if (type === "USER") {
    const { data, error } = await db
      .from(users)
      .select("id, name, phone, email")
      .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
      .limit(10);
    if (error) throw error;
    return camelize<any[]>(data || []);
  } else {
    const { data, error } = await db
      .from(groups)
      .select("id, name, contact_name, contact_phone")
      .or(`name.ilike.${pattern},contact_name.ilike.${pattern},contact_phone.ilike.${pattern}`)
      .limit(10);
    if (error) throw error;
    return camelize<any[]>(data || []);
  }
});

export const useCreateSubscriptionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    if (data.startTime >= data.endTime) {
      return {
        failed: true,
        message: "La hora de inicio debe ser anterior a la hora de fin.",
      };
    }

    const days = data.daysOfWeek
      .split(",")
      .map((d) => Number(d.trim()))
      .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6);

    if (days.length === 0) {
      return {
        failed: true,
        message: "Seleccioná al menos un día de la semana.",
      };
    }

    const startDate = new Date(`${data.startDate}T12:00:00-03:00`);
    const userId = data.ownerType === "USER" ? data.ownerId : null;
    const groupId = data.ownerType === "GROUP" ? data.ownerId : null;

    let totalCreated = 0;
    const totalSkipped: string[] = [];
    const subIds: string[] = [];
    const duplicateDays: string[] = [];
    const dayLabels = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];

    for (const dayOfWeek of days) {
      const duplicate = await findDuplicateActiveSubscription(db, {
        pitchId: data.pitchId,
        dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
      });

      if (duplicate) {
        duplicateDays.push(dayLabels[dayOfWeek]);
        continue;
      }

      const { subId, created, skipped } = await createSubscriptionWithBookings(
        db,
        {
          pitchId: data.pitchId,
          userId,
          groupId,
          dayOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          startDate,
          pricePerMatch: Number(data.pricePerMatch),
        },
      );

      subIds.push(subId);
      totalCreated += created;
      totalSkipped.push(...skipped);
    }

    if (subIds.length === 0) {
      return {
        failed: true,
        message:
          duplicateDays.length > 0
            ? `No se creó ningún abono: ya existe uno activo en esa cancha y horario para ${duplicateDays.join(", ")}.`
            : "No se pudo crear ningún abono.",
      };
    }

    return {
      success: true,
      created: totalCreated,
      skipped: totalSkipped,
      subscriptionsCreated: subIds.length,
      duplicateDays,
    };
  },
  zod$({
    pitchId: z.string().min(1),
    ownerType: z.enum(["USER", "GROUP"]),
    ownerId: z.string().min(1),
    daysOfWeek: z.string().min(1),
    startTime: z.string(),
    endTime: z.string(),
    startDate: z.string(),
    pricePerMatch: z.string(),
  }),
);

export const useDeleteSubscriptionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const { data: subData, error: getSubErr } = await db
      .from(pitchSubscriptions)
      .select("id, is_active")
      .eq("id", data.subscriptionId)
      .maybeSingle();

    if (getSubErr) throw getSubErr;
    if (!subData) {
      return { failed: true, message: "Abono no encontrado." };
    }
    const sub = camelize<any>(subData);

    if (sub.isActive) {
      return {
        failed: true,
        message:
          "El abono está activo. Dalo de baja antes de eliminarlo definitivamente.",
      };
    }

    // Bookings without historical value are removed too so the calendar
    // grid stops showing them: CANCELLED rows with no money attached, and
    // any future row (CONFIRMED / pending) without payment that never made
    // it through. Rows with paid_amount > 0 (balances) or that were
    // actually played (COMPLETED / ATTENDED) are preserved.
    const startOfTodayBA = new Date(
      `${getBAFormatDate(new Date())}T00:00:00-03:00`,
    );

    const { data: deletedCancelled, error: delCancelledErr } = await db
      .from(bookings)
      .delete()
      .eq("notes", `subscription:${sub.id}`)
      .eq("status", "CANCELLED")
      .eq("paid_amount", 0)
      .select("id");

    if (delCancelledErr) throw delCancelledErr;

    const { data: deletedFuture, error: delFutureErr } = await db
      .from(bookings)
      .delete()
      .eq("notes", `subscription:${sub.id}`)
      .in("status", ["CONFIRMED", "PENDING_PAYMENT", "PENDING_APPROVAL"])
      .eq("paid_amount", 0)
      .gte("start_time", toBALocalISOString(startOfTodayBA))
      .select("id");

    if (delFutureErr) throw delFutureErr;

    const deletedBookings =
      (deletedCancelled?.length || 0) + (deletedFuture?.length || 0);

    // Whatever remains is real history we keep on the calendar
    const { count: keptCount, error: countErr } = await db
      .from(bookings)
      .select("id", { count: "exact", head: true })
      .eq("notes", `subscription:${sub.id}`);

    if (countErr) throw countErr;

    const { error: delErr } = await db
      .from(pitchSubscriptions)
      .delete()
      .eq("id", sub.id);

    if (delErr) throw delErr;

    return {
      success: true,
      deletedBookings,
      keptBookings: keptCount || 0,
    };
  },
  zod$({
    subscriptionId: z.string().min(1),
  }),
);

export const useUpdateSubscriptionPriceAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const price = Number(data.pricePerMatch);

    if (!price || price <= 0) {
      return { failed: true, message: "El precio debe ser mayor a 0." };
    }

    const { error: updSubErr } = await db
      .from(pitchSubscriptions)
      .update({ price_per_match: price })
      .eq("id", data.subscriptionId);

    if (updSubErr) throw updSubErr;

    let updatedBookings = 0;
    if (data.applyToFuture === "true") {
      const { data: updData, error: updBookErr } = await db
        .from(bookings)
        .update({ total_price: price })
        .eq("notes", `subscription:${data.subscriptionId}`)
        .gte("start_time", toBALocalISOString(new Date()))
        .eq("payment_status", "PENDING")
        .neq("status", "CANCELLED")
        .select("id");

      if (updBookErr) throw updBookErr;
      updatedBookings = (updData || []).length;
    }

    return { success: true, updatedBookings };
  },
  zod$({
    subscriptionId: z.string().min(1),
    pricePerMatch: z.string(),
    applyToFuture: z.string().optional(),
  }),
);

export const useExtendSubscriptionsAction = routeAction$(
  async (_data, requestEvent) => {
    const db = getDB(requestEvent);
    const summary = await extendActiveSubscriptions(db);
    return { success: true, ...summary };
  },
);

export const useCreateOwnerAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const name = data.name.trim();

    if (!name) {
      return { failed: true, message: "El nombre es obligatorio." };
    }

    if (data.type === "USER") {
      const phone = data.phone?.trim() || null;
      const email = data.email?.trim() || null;

      if (phone) {
        const { data: existingByPhone } = await db
          .from(users)
          .select("id, name")
          .eq("phone", phone)
          .maybeSingle();
        if (existingByPhone) {
          const u = camelize<any>(existingByPhone);
          return {
            success: true,
            id: u.id,
            name: u.name,
            existed: true,
          };
        }
      }

      const id = crypto.randomUUID();
      const { error } = await db.from(users).insert({
        id,
        name,
        phone,
        email,
        role: "GUEST",
      });
      if (error) {
        return { failed: true, message: error.message };
      }
      return { success: true, id, name, existed: false };
    }

    // GROUP
    const id = crypto.randomUUID();
    const { error } = await db.from(groups).insert({
      id,
      name,
      contact_name: data.contactName?.trim() || null,
      contact_phone: data.contactPhone?.trim() || null,
      contact_email: data.contactEmail?.trim() || null,
      balance: 0,
    });
    if (error) {
      return { failed: true, message: error.message };
    }
    return { success: true, id, name, existed: false };
  },
  zod$({
    type: z.enum(["USER", "GROUP"]),
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().optional(),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().optional(),
  }),
);

export const useToggleSubscriptionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const { data: subData, error: getSubErr } = await db
      .from(pitchSubscriptions)
      .select("*")
      .eq("id", data.subscriptionId)
      .maybeSingle();

    if (getSubErr) throw getSubErr;

    if (subData) {
      const sub = camelize<any>(subData);
      const newIsActive = !sub.isActive;

      const { error: updSubErr } = await db
        .from(pitchSubscriptions)
        .update({
          is_active: newIsActive,
          end_date: newIsActive ? null : new Date().toISOString(),
        })
        .eq("id", sub.id);

      if (updSubErr) throw updSubErr;

      const now = new Date().toISOString();

      if (!newIsActive) {
        // Cancelling: Set all future un-paid bookings for this sub to CANCELLED
        const { error: cancelErr } = await db
          .from(bookings)
          .update({ status: "CANCELLED" })
          .eq("notes", `subscription:${sub.id}`)
          .gte("start_time", now)
          .eq("payment_status", "PENDING")
          .eq("status", "CONFIRMED");

        if (cancelErr) throw cancelErr;
      } else {
        // Reactivating: Set future CANCELLED bookings back to CONFIRMED if available
        const { data: futureBookingsData, error: getFutureErr } = await db
          .from(bookings)
          .select("*")
          .eq("notes", `subscription:${sub.id}`)
          .gte("start_time", now)
          .eq("status", "CANCELLED");

        if (getFutureErr) throw getFutureErr;

        const futureBookings = camelize<any[]>(futureBookingsData || []);

        for (const b of futureBookings) {
          const { available } = await isPitchAvailable(db, {
            pitchId: b.pitchId,
            startTime: new Date(b.startTime),
            endTime: new Date(b.endTime),
            excludeBookingId: b.id,
          });
          if (available) {
            const { error: reactivateErr } = await db
              .from(bookings)
              .update({ status: "CONFIRMED" })
              .eq("id", b.id);
            if (reactivateErr) throw reactivateErr;
          }
        }
      }
    }

    return { success: true };
  },
  zod$({
    subscriptionId: z.string(),
  }),
);

export default component$(() => {
  const data = useSubscriptionsData();
  const createSubAction = useCreateSubscriptionAction();
  const toggleSubAction = useToggleSubscriptionAction();
  const updatePriceAction = useUpdateSubscriptionPriceAction();
  const extendAction = useExtendSubscriptionsAction();
  const deleteSubAction = useDeleteSubscriptionAction();
  const createOwnerAction = useCreateOwnerAction();

  const isModalOpen = useSignal(false);
  const ownerType = useSignal<"USER" | "GROUP">("USER");
  const searchTerm = useSignal("");
  const searchResults = useSignal<any[]>([]);
  const isSearching = useSignal(false);
  const selectedOwnerId = useSignal("");
  const selectedOwnerName = useSignal("");

  // New subscription form state
  const formPitchId = useSignal("");
  const formStartTime = useSignal("");
  const formEndTime = useSignal("");
  const formPrice = useSignal("");
  const priceTouched = useSignal(false);
  const selectedDays = useSignal<number[]>([]);

  // Edit price modal state
  const isEditModalOpen = useSignal(false);
  const editingSubId = useSignal("");
  const editingSubLabel = useSignal("");
  const editingSubPrice = useSignal("");
  const editApplyToFuture = useSignal(true);

  // Confirmation modal state (dar de baja / reactivar)
  const isConfirmModalOpen = useSignal(false);
  const pendingToggleSub = useSignal<any>(null);
  const confirmActionType = useSignal<"deactivate" | "reactivate">("deactivate");
  // Monotonic token: incremented on click after data is set. A visible task
  // (runs AFTER the content render) flips the modal open, so the dialog never
  // opens before its content is in the DOM (avoids the first-open QRL race flash).
  const confirmOpenToken = useSignal(0);

  useVisibleTask$(({ track }) => {
    track(() => confirmOpenToken.value);
    if (confirmOpenToken.value > 0) {
      isConfirmModalOpen.value = true;
    }
  });

  // Delete modal state
  const isDeleteModalOpen = useSignal(false);
  const pendingDeleteSub = useSignal<any>(null);

  // Conflict-detail modal state
  const isConflictModalOpen = useSignal(false);
  const inspectingSub = useSignal<any>(null);
  const conflictDetails = useSignal<SubscriptionConflictDetail[] | null>(null);
  const conflictLoading = useSignal(false);

  useTask$(({ track }) => {
    const open = track(() => isConflictModalOpen.value);
    const sub = track(() => inspectingSub.value);
    if (!open || !sub) return;
    conflictLoading.value = true;
    conflictDetails.value = null;
    getSubscriptionConflicts(sub.id)
      .then((res) => {
        conflictDetails.value = res;
        conflictLoading.value = false;
      })
      .catch(() => {
        conflictDetails.value = [];
        conflictLoading.value = false;
      });
  });

  // Create owner sub-modal state
  const isCreateOwnerModalOpen = useSignal(false);
  const newOwnerName = useSignal("");
  const newOwnerPhone = useSignal("");
  const newOwnerEmail = useSignal("");
  const newOwnerContactName = useSignal("");
  const newOwnerContactPhone = useSignal("");
  const newOwnerContactEmail = useSignal("");

  // After owner creation succeeds: auto-select and close sub-modal
  useTask$(({ track }) => {
    const result = track(() => createOwnerAction.value);
    if (result?.success && result.id && result.name) {
      const displayName =
        ownerType.value === "USER"
          ? `${result.name}${newOwnerPhone.value ? ` (${newOwnerPhone.value})` : ""}`.trim()
          : result.name;
      selectedOwnerId.value = result.id;
      selectedOwnerName.value = displayName;
      searchTerm.value = "";
      searchResults.value = [];
      isCreateOwnerModalOpen.value = false;
      newOwnerName.value = "";
      newOwnerPhone.value = "";
      newOwnerEmail.value = "";
      newOwnerContactName.value = "";
      newOwnerContactPhone.value = "";
      newOwnerContactEmail.value = "";
    }
  });

  // Close confirm modal on success
  useTask$(({ track }) => {
    const success = track(() => toggleSubAction.value?.success);
    if (success) {
      isConfirmModalOpen.value = false;
    }
  });

  // Close delete modal on success
  useTask$(({ track }) => {
    const success = track(() => deleteSubAction.value?.success);
    if (success) {
      isDeleteModalOpen.value = false;
      pendingDeleteSub.value = null;
    }
  });

  // Reset form when opening the create modal
  useTask$(({ track }) => {
    const open = track(() => isModalOpen.value);
    if (open) {
      formPitchId.value = "";
      formStartTime.value = "";
      formEndTime.value = "";
      formPrice.value = "";
      priceTouched.value = false;
      selectedDays.value = [];
    }
  });

  // Auto-fill price when pitch / start / end change (unless the user typed it)
  useTask$(({ track }) => {
    const pitchId = track(() => formPitchId.value);
    const start = track(() => formStartTime.value);
    const end = track(() => formEndTime.value);
    if (priceTouched.value) return;
    if (!pitchId || !start || !end || start >= end) return;
    const pitch = data.value.pitches.find((p: any) => p.id === pitchId);
    if (!pitch?.pricePerHour) return;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const durationMins = eh * 60 + em - (sh * 60 + sm);
    if (durationMins <= 0) return;
    const computed = Math.round(
      (durationMins / 60) * Number(pitch.pricePerHour),
    );
    formPrice.value = String(computed);
  });

  // Search owner logic with debounce
  useTask$(({ track, cleanup }) => {
    const term = track(() => searchTerm.value);
    const type = track(() => ownerType.value);
    if (term.length >= 2) {
      isSearching.value = true;
      const id = setTimeout(() => {
        searchOwnersServer(term, type)
          .then((res) => {
            searchResults.value = res;
            isSearching.value = false;
          })
          .catch(() => {
            searchResults.value = [];
            isSearching.value = false;
          });
      }, 400);
      cleanup(() => clearTimeout(id));
    } else {
      searchResults.value = [];
      isSearching.value = false;
    }
  });

  const daysOfWeek = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const h = Math.floor(i / 2);
    const m = (i % 2) * 30;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });

  const formatDayOfWeek = (dayIdx: number) => {
    const day = daysOfWeek[dayIdx];
    if (!day) return "Día Desconocido";
    if (day.endsWith("s")) return day;
    return day + "s";
  };

  const formatShortDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div class="min-h-full bg-slate-50 p-6 font-sans">
      <div class="mx-auto max-w-6xl space-y-6">
        <div class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div class="min-w-0">
            <h1 class="text-3xl font-black tracking-tight text-slate-800">
              Abonos de Canchas
            </h1>
            <p class="mt-1 text-slate-500">
              Reservas recurrentes fijas. Se generan {HORIZON_WEEKS} semanas
              hacia adelante y se extienden automáticamente cada semana.
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <Button
              look="ghost"
              onClick$={() => extendAction.submit({})}
              disabled={extendAction.isRunning}
              class="rounded-xl px-4 py-3 text-sm font-bold whitespace-nowrap text-slate-500 hover:bg-slate-100"
            >
              {extendAction.isRunning ? "Extendiendo..." : "↻ Extender ahora"}
            </Button>
            <Button
              look="primary"
              onClick$={() => (isModalOpen.value = true)}
              class="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-bold whitespace-nowrap text-white shadow-md shadow-emerald-100 transition-all hover:scale-[1.02] hover:bg-emerald-600 active:scale-95"
            >
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
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nuevo Abono Fijo
            </Button>
          </div>
        </div>

        {/* Result banners */}
        {createSubAction.value?.success && (
          <div class="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            {(createSubAction.value.subscriptionsCreated ?? 1) > 1
              ? `Se crearon ${createSubAction.value.subscriptionsCreated} abonos con ${createSubAction.value.created} reservas en total.`
              : `Abono creado: se generaron ${createSubAction.value.created} reservas.`}
            {(createSubAction.value.duplicateDays?.length ?? 0) > 0 && (
              <span class="mt-1 block font-semibold text-amber-700">
                Se omitieron días con un abono activo superpuesto:{" "}
                {createSubAction.value.duplicateDays.join(", ")}.
              </span>
            )}
            {(createSubAction.value.skipped?.length ?? 0) > 0 && (
              <span class="mt-1 block font-semibold text-amber-700">
                {createSubAction.value.skipped.length} fechas no se generaron
                por conflicto de horario:{" "}
                {createSubAction.value.skipped
                  .map((d: string) => formatShortDate(d))
                  .join(", ")}
                . Resolvelas desde el calendario.
              </span>
            )}
          </div>
        )}
        {deleteSubAction.value?.success && (
          <div class="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            Abono eliminado.{" "}
            {(deleteSubAction.value.deletedBookings ?? 0) > 0
              ? `Se quitaron ${deleteSubAction.value.deletedBookings} reservas sin valor histórico del calendario`
              : "No había reservas para limpiar"}
            {(deleteSubAction.value.keptBookings ?? 0) > 0
              ? ` y se conservaron ${deleteSubAction.value.keptBookings} con pago o asistencia confirmada.`
              : "."}
          </div>
        )}
        {deleteSubAction.value?.failed && deleteSubAction.value?.message && (
          <div class="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">
            {deleteSubAction.value.message}
          </div>
        )}
        {createSubAction.value?.failed && createSubAction.value?.message && (
          <div class="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">
            {createSubAction.value.message}
          </div>
        )}
        {updatePriceAction.value?.success && (
          <div class="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            Precio actualizado.
            {(updatePriceAction.value.updatedBookings ?? 0) > 0 &&
              ` Se aplicó a ${updatePriceAction.value.updatedBookings} reservas futuras pendientes.`}
          </div>
        )}
        {extendAction.value?.success && (
          <div class="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-700">
            Abonos extendidos: {extendAction.value.processed} procesados,{" "}
            {extendAction.value.created} reservas nuevas
            {extendAction.value.skipped > 0 &&
              `, ${extendAction.value.skipped} fechas con conflicto`}
            .
          </div>
        )}

        {/* Subscriptions List */}
        <div class="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div class="overflow-auto p-0">
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50/80 text-xs font-black tracking-widest text-slate-400 uppercase">
                  <th class="p-4">Cancha</th>
                  <th class="p-4">Horario Fijo</th>
                  <th class="p-4">Titular</th>
                  <th class="p-4">Precio/Turno</th>
                  <th class="p-4">Vigencia</th>
                  <th class="p-4">Estado</th>
                  <th class="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="text-sm font-semibold text-slate-700">
                {data.value.subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} class="p-8 text-center text-slate-500">
                      No hay abonos registrados.
                    </td>
                  </tr>
                ) : (
                  data.value.subscriptions.map((sub: any) => {
                    const stat = data.value.stats[sub.id];
                    const subLabel = `${sub.pitch?.name || "Cancha"} · ${formatDayOfWeek(sub.dayOfWeek)} ${sub.startTime}-${sub.endTime} · ${sub.user?.name || sub.group?.name || ""}`;
                    return (
                      <tr
                        key={sub.id}
                        class={`border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50 ${!sub.isActive ? "opacity-60" : ""}`}
                      >
                        <td class="p-4">
                          <div class="font-black text-slate-800">
                            {sub.pitch?.name}
                          </div>
                          <div class="text-[10px] font-bold text-slate-400 uppercase">
                            {sub.pitch?.type}
                          </div>
                        </td>
                        <td class="p-4">
                          <div class="font-bold text-emerald-600">
                            Todos los {formatDayOfWeek(sub.dayOfWeek)}
                          </div>
                          <div class="text-xs font-bold text-slate-500">
                            {sub.startTime} - {sub.endTime}
                          </div>
                        </td>
                        <td class="p-4">
                          <div class="font-bold">
                            {sub.user
                              ? sub.user.name
                              : sub.group
                                ? sub.group.name
                                : "Desconocido"}
                          </div>
                          <div class="text-[10px] font-bold text-slate-400 uppercase">
                            {sub.user ? "USUARIO" : "GRUPO"}
                          </div>
                        </td>
                        <td class="p-4">
                          <div class="font-black text-slate-800">
                            ${Number(sub.pricePerMatch).toLocaleString("es-AR")}
                          </div>
                        </td>
                        <td class="p-4">
                          {!sub.isActive ? (
                            <span class="text-xs text-slate-400">—</span>
                          ) : stat?.lastDateStr ? (
                            <div>
                              <div class="text-xs font-bold text-slate-600">
                                hasta {formatShortDate(stat.lastDateStr)}
                              </div>
                              <div class="text-[10px] font-bold text-slate-400">
                                {stat.futureCount} turnos futuros
                              </div>
                              {stat.conflictCount > 0 && (
                                <button
                                  type="button"
                                  onClick$={() => {
                                    inspectingSub.value = sub;
                                    conflictDetails.value = null;
                                    isConflictModalOpen.value = true;
                                  }}
                                  class="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 uppercase transition-colors hover:bg-amber-200"
                                >
                                  {stat.conflictCount} con conflicto
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="3"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                  >
                                    <polyline points="9 18 15 12 9 6" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span class="rounded-md bg-red-100 px-2 py-1 text-[10px] font-bold tracking-wider text-red-700 uppercase">
                              Sin reservas
                            </span>
                          )}
                        </td>
                        <td class="p-4">
                          <span
                            class={`rounded-md px-2 py-1 text-[10px] font-bold tracking-wider uppercase ${sub.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                          >
                            {sub.isActive ? "ACTIVO" : "CANCELADO"}
                          </span>
                        </td>
                        <td class="p-4">
                          <div class="flex items-center justify-center gap-2">
                            {sub.isActive ? (
                              <>
                                <Button
                                  look="secondary"
                                  type="button"
                                  onClick$={() => {
                                    editingSubId.value = sub.id;
                                    editingSubLabel.value = subLabel;
                                    editingSubPrice.value = String(
                                      sub.pricePerMatch,
                                    );
                                    editApplyToFuture.value = true;
                                    isEditModalOpen.value = true;
                                  }}
                                  class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold tracking-wide text-slate-600 hover:bg-slate-200"
                                >
                                  Editar
                                </Button>
                                <Button
                                  look="secondary"
                                  type="button"
                                  onClick$={() => {
                                    confirmActionType.value = "deactivate";
                                    pendingToggleSub.value = sub;
                                    confirmOpenToken.value++;
                                  }}
                                  class="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold tracking-wide text-red-600 hover:bg-red-100"
                                >
                                  Dar de baja
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  look="primary"
                                  type="button"
                                  onClick$={() => {
                                    confirmActionType.value = "reactivate";
                                    pendingToggleSub.value = sub;
                                    confirmOpenToken.value++;
                                  }}
                                  class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold tracking-wide text-white hover:bg-emerald-600"
                                >
                                  Reactivar
                                </Button>
                                <Button
                                  look="secondary"
                                  type="button"
                                  onClick$={() => {
                                    pendingDeleteSub.value = sub;
                                    isDeleteModalOpen.value = true;
                                  }}
                                  class="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold tracking-wide text-red-600 hover:bg-red-100"
                                >
                                  Eliminar
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación (dar de baja / reactivar) */}
      <Modal.Root bind:show={isConfirmModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <div class="mb-5 flex items-start gap-4">
              <div
                class={`flex-shrink-0 rounded-xl p-3 ${confirmActionType.value === "deactivate" ? "bg-red-100" : "bg-emerald-100"}`}
              >
                {confirmActionType.value === "deactivate" ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-red-600"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-emerald-600"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div>
                <h3 class="text-lg font-black text-slate-800">
                  {confirmActionType.value === "deactivate"
                    ? "¿Dar de baja el abono?"
                    : "¿Reactivar el abono?"}
                </h3>
                <p class="mt-1 text-sm text-slate-500">
                  {confirmActionType.value === "deactivate"
                    ? `Se cancelarán las reservas futuras pendientes de pago de este abono${
                        data.value.stats[pendingToggleSub.value?.id]
                          ?.futureCount != null
                          ? ` (${data.value.stats[pendingToggleSub.value.id].futureCount} turnos)`
                          : ""
                      }.`
                    : "Se reactivarán las reservas futuras disponibles de este abono y volverá a extenderse automáticamente."}
                </p>
                {pendingToggleSub.value && (
                  <div class="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm">
                    <div class="font-bold text-slate-800">
                      {pendingToggleSub.value.pitch?.name}
                    </div>
                    <div class="text-xs text-slate-500">
                      {formatDayOfWeek(pendingToggleSub.value.dayOfWeek)} ·{" "}
                      {pendingToggleSub.value.startTime} -{" "}
                      {pendingToggleSub.value.endTime}
                    </div>
                    <div class="text-xs text-slate-500">
                      {pendingToggleSub.value.user?.name ||
                        pendingToggleSub.value.group?.name ||
                        "Desconocido"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Form action={toggleSubAction} class="flex flex-col gap-3">
              <input
                type="hidden"
                name="subscriptionId"
                value={pendingToggleSub.value?.id ?? ""}
              />
              <div class="flex gap-3">
                <Button
                  type="button"
                  look="ghost"
                  onClick$={() => {
                    isConfirmModalOpen.value = false;
                  }}
                  class="flex-1 rounded-xl border border-slate-200 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={toggleSubAction.isRunning}
                  class={`flex-1 rounded-xl py-2.5 font-bold text-white ${confirmActionType.value === "deactivate" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
                >
                  {toggleSubAction.isRunning
                    ? "Procesando..."
                    : confirmActionType.value === "deactivate"
                      ? "Sí, dar de baja"
                      : "Sí, reactivar"}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Modal de Conflictos del Abono */}
      <Modal.Root bind:show={isConflictModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <div class="mb-4 flex items-start justify-between">
              <div>
                <h3 class="text-xl font-black text-slate-800">
                  Fechas con conflicto
                </h3>
                {inspectingSub.value && (
                  <p class="mt-0.5 text-xs font-semibold text-slate-500">
                    {inspectingSub.value.pitch?.name} ·{" "}
                    {formatDayOfWeek(inspectingSub.value.dayOfWeek)}{" "}
                    {inspectingSub.value.startTime}-
                    {inspectingSub.value.endTime}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick$={() => (isConflictModalOpen.value = false)}
                class="p-2 text-slate-400 transition-colors hover:text-slate-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {conflictLoading.value ? (
              <div class="py-10 text-center text-sm font-semibold text-slate-400">
                Buscando conflictos…
              </div>
            ) : (conflictDetails.value?.length ?? 0) === 0 ? (
              <div class="py-10 text-center text-sm font-semibold text-slate-400">
                No se encontraron conflictos pendientes.
              </div>
            ) : (
              <ul class="max-h-[60vh] space-y-3 overflow-y-auto">
                {conflictDetails.value!.map((d) => {
                  const dateLabel = new Date(
                    `${d.dateStr}T12:00:00-03:00`,
                  ).toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                  return (
                    <li
                      key={d.dateStr}
                      class="rounded-xl border border-amber-100 bg-amber-50/40 p-4"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                          <div class="text-sm font-black text-slate-800 capitalize">
                            {dateLabel}
                          </div>
                          <ul class="mt-2 space-y-1.5 text-xs font-semibold text-slate-600">
                            {d.reasons.map((r, idx) => (
                              <li key={idx} class="flex items-start gap-2">
                                {r.type === "BOOKING" && (
                                  <>
                                    <span class="mt-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-blue-700 uppercase">
                                      Reserva
                                    </span>
                                    <span>
                                      {r.range} en{" "}
                                      <strong>{r.pitchName}</strong> —{" "}
                                      {r.customer}
                                    </span>
                                  </>
                                )}
                                {r.type === "SCHOOL" && (
                                  <>
                                    <span class="mt-0.5 rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-orange-700 uppercase">
                                      Escuelita
                                    </span>
                                    <span>
                                      {r.range} — {r.categoryName}
                                    </span>
                                  </>
                                )}
                                {r.type === "CLOSED" && (
                                  <>
                                    <span class="mt-0.5 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-slate-700 uppercase">
                                      Cerrado
                                    </span>
                                    <span>{r.note}</span>
                                  </>
                                )}
                                {r.type === "UNKNOWN" && (
                                  <>
                                    <span class="mt-0.5 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-slate-700 uppercase">
                                      ?
                                    </span>
                                    <span>
                                      Motivo no identificado. Revisá la grilla.
                                    </span>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <a
                          href={`/admin/calendar/?date=${d.dateStr}&view=day`}
                          class="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-black tracking-wider text-white uppercase transition-colors hover:bg-slate-900"
                        >
                          Ver día →
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <p class="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed font-semibold text-blue-700">
              Resolvé el conflicto desde el calendario (cancelando o cambiando
              la reserva bloqueante) y después hacé click en{" "}
              <strong>"↻ Extender ahora"</strong> arriba para que el sistema
              cree los turnos faltantes.
            </p>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Modal de Eliminación Definitiva */}
      <Modal.Root bind:show={isDeleteModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <div class="mb-5 flex items-start gap-4">
              <div class="flex-shrink-0 rounded-xl bg-red-100 p-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-red-600"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-black text-slate-800">
                  ¿Eliminar el abono definitivamente?
                </h3>
                <p class="mt-1 text-sm text-slate-500">
                  Esta acción no se puede deshacer. Se borran las reservas
                  canceladas y las futuras sin pago; las reservas con plata
                  cobrada o asistencia confirmada{" "}
                  <strong>se conservan</strong> en el calendario.
                </p>
                {pendingDeleteSub.value && (
                  <div class="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm">
                    <div class="font-bold text-slate-800">
                      {pendingDeleteSub.value.pitch?.name}
                    </div>
                    <div class="text-xs text-slate-500">
                      {formatDayOfWeek(pendingDeleteSub.value.dayOfWeek)} ·{" "}
                      {pendingDeleteSub.value.startTime} -{" "}
                      {pendingDeleteSub.value.endTime}
                    </div>
                    <div class="text-xs text-slate-500">
                      {pendingDeleteSub.value.user?.name ||
                        pendingDeleteSub.value.group?.name ||
                        "Desconocido"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Form action={deleteSubAction} class="flex flex-col gap-3">
              <input
                type="hidden"
                name="subscriptionId"
                value={pendingDeleteSub.value?.id ?? ""}
              />
              <div class="flex gap-3">
                <Button
                  type="button"
                  look="ghost"
                  onClick$={() => {
                    isDeleteModalOpen.value = false;
                    pendingDeleteSub.value = null;
                  }}
                  class="flex-1 rounded-xl border border-slate-200 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={deleteSubAction.isRunning}
                  class="flex-1 rounded-xl bg-red-500 py-2.5 font-bold text-white hover:bg-red-600"
                >
                  {deleteSubAction.isRunning ? "Eliminando..." : "Sí, eliminar"}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Modal para Editar Abono (precio) */}
      <Modal.Root bind:show={isEditModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-xl font-black text-slate-800">Editar Abono</h3>
              <button
                onClick$={() => (isEditModalOpen.value = false)}
                class="p-2 text-slate-400 transition-colors hover:text-slate-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div class="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              {editingSubLabel.value}
            </div>

            <Form
              action={updatePriceAction}
              class="space-y-4"
              onSubmitCompleted$={() => {
                if (updatePriceAction.value?.success) {
                  isEditModalOpen.value = false;
                }
              }}
            >
              <input
                type="hidden"
                name="subscriptionId"
                value={editingSubId.value}
              />
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Precio por Turno *
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="pricePerMatch"
                  required
                  value={editingSubPrice.value}
                  onInput$={(_, el) => (editingSubPrice.value = el.value)}
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <label class="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="applyToFuture"
                  value="true"
                  checked={editApplyToFuture.value}
                  onChange$={(_, el) =>
                    (editApplyToFuture.value = el.checked)
                  }
                  class="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                />
                Actualizar precio en reservas futuras pendientes
              </label>
              <div class="flex justify-end gap-3 pt-2">
                <Button
                  look="ghost"
                  type="button"
                  onClick$={() => (isEditModalOpen.value = false)}
                  class="rounded-xl px-5 py-2.5 font-bold text-slate-500"
                >
                  Cancelar
                </Button>
                <Button
                  look="primary"
                  type="submit"
                  disabled={updatePriceAction.isRunning}
                  class="rounded-xl bg-slate-800 px-6 py-2.5 font-bold text-white hover:bg-slate-900"
                >
                  {updatePriceAction.isRunning
                    ? "Guardando..."
                    : "Guardar cambios"}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Sub-modal: Crear Cliente / Grupo desde el flujo de abono */}
      <Modal.Root bind:show={isCreateOwnerModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <div class="mb-5 flex items-start justify-between">
              <div>
                <h3 class="text-xl font-black text-slate-800">
                  Nuevo {ownerType.value === "USER" ? "Cliente" : "Grupo"}
                </h3>
                <p class="mt-0.5 text-xs font-semibold text-slate-500">
                  Se va a guardar y seleccionar automáticamente para el abono.
                </p>
              </div>
              <button
                type="button"
                onClick$={() => (isCreateOwnerModalOpen.value = false)}
                class="p-2 text-slate-400 transition-colors hover:text-slate-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {createOwnerAction.value?.failed &&
              createOwnerAction.value?.message && (
                <div class="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600">
                  {createOwnerAction.value.message}
                </div>
              )}

            <Form action={createOwnerAction} class="space-y-4">
              <input
                type="hidden"
                name="type"
                value={ownerType.value}
              />

              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  {ownerType.value === "USER"
                    ? "Nombre completo *"
                    : "Nombre del grupo *"}
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={newOwnerName.value}
                  onInput$={(_, el) => (newOwnerName.value = el.value)}
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {ownerType.value === "USER" ? (
                <>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={newOwnerPhone.value}
                        onInput$={(_, el) => (newOwnerPhone.value = el.value)}
                        placeholder="Ej: 1144796321"
                        class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={newOwnerEmail.value}
                        onInput$={(_, el) => (newOwnerEmail.value = el.value)}
                        placeholder="opcional"
                        class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <p class="text-[11px] font-semibold text-slate-400">
                    Recomendado al menos teléfono para poder identificarlo
                    después.
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                      Nombre del contacto
                    </label>
                    <input
                      type="text"
                      name="contactName"
                      value={newOwnerContactName.value}
                      onInput$={(_, el) =>
                        (newOwnerContactName.value = el.value)
                      }
                      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                        Teléfono contacto
                      </label>
                      <input
                        type="tel"
                        name="contactPhone"
                        value={newOwnerContactPhone.value}
                        onInput$={(_, el) =>
                          (newOwnerContactPhone.value = el.value)
                        }
                        class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                        Email contacto
                      </label>
                      <input
                        type="email"
                        name="contactEmail"
                        value={newOwnerContactEmail.value}
                        onInput$={(_, el) =>
                          (newOwnerContactEmail.value = el.value)
                        }
                        class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div class="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  look="ghost"
                  onClick$={() => (isCreateOwnerModalOpen.value = false)}
                  class="rounded-xl px-5 py-2.5 font-bold text-slate-500"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createOwnerAction.isRunning}
                  class="rounded-xl bg-emerald-500 px-6 py-2.5 font-bold text-white hover:bg-emerald-600"
                >
                  {createOwnerAction.isRunning
                    ? "Creando..."
                    : `Crear y seleccionar`}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Modal para Crear Abono Fijo */}
      <Modal.Root bind:show={isModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <div class="mb-6 flex items-center justify-between">
              <h3 class="text-xl font-black text-slate-800">
                Nuevo Abono Fijo
              </h3>
              <button
                onClick$={() => (isModalOpen.value = false)}
                class="p-2 text-slate-400 transition-colors hover:text-slate-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <Form
              action={createSubAction}
              class="space-y-4"
              onSubmitCompleted$={() => {
                if (createSubAction.value?.success) {
                  isModalOpen.value = false;
                  selectedOwnerId.value = "";
                  selectedOwnerName.value = "";
                  searchTerm.value = "";
                }
              }}
            >
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Cancha *
                </label>
                <select
                  name="pitchId"
                  required
                  value={formPitchId.value}
                  onChange$={(_, el) => (formPitchId.value = el.value)}
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Seleccionar cancha...
                  </option>
                  {data.value.pitches.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                    >{`${p.name} (${p.type})`}</option>
                  ))}
                </select>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Tipo Titular
                  </label>
                  <select
                    name="ownerType"
                    id="ownerType"
                    value={ownerType.value}
                    onChange$={(e, el) => {
                      ownerType.value = el.value as "USER" | "GROUP";
                      selectedOwnerId.value = "";
                      selectedOwnerName.value = "";
                      searchTerm.value = "";
                      searchResults.value = [];
                    }}
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="USER">Usuario</option>
                    <option value="GROUP">Grupo/Escuela</option>
                  </select>
                </div>

                <div class="relative">
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Buscar Titular *
                  </label>
                  <div class="relative">
                    <input
                      type="text"
                      value={searchTerm.value}
                      onInput$={(_, el) => (searchTerm.value = el.value)}
                      placeholder={
                        ownerType.value === "USER"
                          ? "Buscar por nombre o tel..."
                          : "Buscar por nombre..."
                      }
                      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    {isSearching.value && (
                      <div class="absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500"></div>
                    )}
                  </div>

                  {searchTerm.value.length >= 2 && !selectedOwnerId.value && (
                    <div class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {searchResults.value.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick$={() => {
                            selectedOwnerId.value = item.id;
                            selectedOwnerName.value =
                              ownerType.value === "USER"
                                ? `${item.name} ${item.phone ? `(${item.phone})` : ""}`.trim()
                                : item.name;
                            searchTerm.value = "";
                            searchResults.value = [];
                          }}
                          class="flex w-full flex-col border-b border-slate-50 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                        >
                          <span class="text-sm font-bold text-slate-800">
                            {item.name}
                          </span>
                          {ownerType.value === "USER" && (
                            <span class="text-[11px] text-slate-400">
                              {item.phone || item.email}
                            </span>
                          )}
                          {ownerType.value === "GROUP" && item.contactName && (
                            <span class="text-[11px] text-slate-400">
                              Contacto: {item.contactName}
                            </span>
                          )}
                        </button>
                      ))}
                      {!isSearching.value && (
                        <button
                          type="button"
                          onClick$={() => {
                            newOwnerName.value = searchTerm.value;
                            newOwnerPhone.value = "";
                            newOwnerEmail.value = "";
                            newOwnerContactName.value = "";
                            newOwnerContactPhone.value = "";
                            newOwnerContactEmail.value = "";
                            isCreateOwnerModalOpen.value = true;
                          }}
                          class={`flex w-full items-center gap-2 px-4 py-3 text-left font-bold text-emerald-700 hover:bg-emerald-50 ${
                            searchResults.value.length > 0
                              ? "border-t border-slate-100"
                              : ""
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          <span class="text-xs">
                            {searchResults.value.length === 0
                              ? `Crear ${ownerType.value === "USER" ? "nuevo cliente" : "nuevo grupo"}: `
                              : `Crear nuevo ${ownerType.value === "USER" ? "cliente" : "grupo"}: `}
                            <span class="font-black">"{searchTerm.value}"</span>
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {selectedOwnerId.value && (
                <div class="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-2.5">
                  <div class="min-w-0 flex-1">
                    <div class="text-[10px] font-bold text-slate-400 uppercase">
                      Titular Seleccionado
                    </div>
                    <div class="truncate text-sm font-bold text-slate-800">
                      {selectedOwnerName.value}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick$={() => {
                      selectedOwnerId.value = "";
                      selectedOwnerName.value = "";
                      searchTerm.value = "";
                    }}
                    class="ml-2 rounded-lg bg-white p-1 text-slate-400 shadow-sm transition-colors hover:text-red-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
              <input
                type="hidden"
                name="ownerId"
                value={selectedOwnerId.value}
                required
              />

              <div>
                <label class="mb-2 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Días Fijos *
                </label>
                <div class="flex flex-wrap gap-2">
                  {daysOfWeek.map((day, idx) => {
                    const checked = selectedDays.value.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick$={() => {
                          selectedDays.value = checked
                            ? selectedDays.value.filter((d) => d !== idx)
                            : [...selectedDays.value, idx].sort((a, b) => a - b);
                        }}
                        class={`rounded-full border px-3.5 py-1.5 text-xs font-bold tracking-wide transition-all ${
                          checked
                            ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
                <p class="mt-1.5 text-[11px] font-semibold text-slate-400">
                  Si elegís más de uno se crea un abono por día.
                </p>
                <input
                  type="hidden"
                  name="daysOfWeek"
                  value={selectedDays.value.join(",")}
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Hora Inicio *
                  </label>
                  <select
                    name="startTime"
                    required
                    value={formStartTime.value}
                    onChange$={(_, el) => (formStartTime.value = el.value)}
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="" disabled>
                      --:-- hs
                    </option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {`${t} hs`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Hora Fin *
                  </label>
                  <select
                    name="endTime"
                    required
                    value={formEndTime.value}
                    onChange$={(_, el) => (formEndTime.value = el.value)}
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="" disabled>
                      --:-- hs
                    </option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {`${t} hs`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Fecha Inicio *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    value={getBAFormatDate(new Date())}
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="mb-1 flex items-center justify-between text-xs font-bold tracking-wider text-slate-500 uppercase">
                    <span>Precio por Turno *</span>
                    {priceTouched.value && formPitchId.value && (
                      <button
                        type="button"
                        onClick$={() => {
                          priceTouched.value = false;
                          // re-trigger the autofill task by nudging a tracked signal
                          const s = formStartTime.value;
                          formStartTime.value = "";
                          formStartTime.value = s;
                        }}
                        class="text-[10px] font-bold text-emerald-600 normal-case hover:underline"
                      >
                        Volver al precio sugerido
                      </button>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="pricePerMatch"
                    required
                    value={formPrice.value}
                    onInput$={(_, el) => {
                      formPrice.value = el.value;
                      priceTouched.value = true;
                    }}
                    placeholder={formPitchId.value ? "0" : "Elegí cancha y horario"}
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p class="mt-1 text-[11px] font-semibold text-slate-400">
                    Sugerido por hora de cancha; editalo si el abonado tiene un
                    precio especial.
                  </p>
                </div>
              </div>

              <p class="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed font-semibold text-blue-700">
                El abono no tiene fecha de fin: se generan las próximas{" "}
                {HORIZON_WEEKS} semanas de reservas y el sistema las extiende
                automáticamente cada semana hasta que lo des de baja.
              </p>

              {createSubAction.value?.failed &&
                createSubAction.value?.message && (
                  <div class="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600">
                    {createSubAction.value.message}
                  </div>
                )}

              <Button
                look="primary"
                type="submit"
                disabled={createSubAction.isRunning}
                class="mt-2 w-full rounded-xl bg-slate-800 py-3 font-bold text-white hover:bg-slate-900"
              >
                {createSubAction.isRunning ? "Creando..." : "Crear Abono Fijo"}
              </Button>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>
    </div>
  );
});

export const head = {
  title: "Abonos - GardenClubFutbol",
};
