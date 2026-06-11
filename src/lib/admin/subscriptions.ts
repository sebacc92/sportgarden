import { camelize } from "~/db";
import { bookings, pitchSubscriptions } from "~/db/schema";
import { isPitchAvailable } from "~/utils/availability";
import {
  getBADayOfWeek,
  getBAFormatDate,
  parseDatabaseDate,
  toBALocalISOString,
} from "~/routes/admin/calendar/utils";

/**
 * Rolling horizon for fixed subscriptions (abonos fijos).
 * Subscriptions have no end date: bookings are materialized this many weeks
 * ahead and topped up weekly by /api/cron/subscriptions (or manually from
 * the admin subscriptions page).
 */
export const HORIZON_WEEKS = 12;

const BOOKING_CHUNK_SIZE = 50;

export interface SubscriptionLike {
  id: string;
  pitchId: string;
  userId: string | null;
  groupId: string | null;
  dayOfWeek: number;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  pricePerMatch: number;
}

export interface Occurrence {
  dateStr: string; // YYYY-MM-DD (BA)
  start: Date;
  end: Date;
}

export const getHorizonEndDate = (from: Date = new Date()): Date => {
  const d = new Date(from);
  d.setDate(d.getDate() + HORIZON_WEEKS * 7);
  return d;
};

/**
 * Weekly occurrences of a subscription schedule between two dates (inclusive),
 * computed in Buenos Aires time.
 */
export function generateOccurrences(
  schedule: { dayOfWeek: number; startTime: string; endTime: string },
  fromDate: Date,
  untilDate: Date,
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  // Normalize cursor to noon BA so DST/UTC edges can't shift the day
  let cursor = new Date(`${getBAFormatDate(fromDate)}T12:00:00-03:00`);
  let guard = 0;
  while (getBADayOfWeek(cursor) !== Number(schedule.dayOfWeek) && guard < 8) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    guard++;
  }
  while (cursor <= untilDate) {
    const dateStr = getBAFormatDate(cursor);
    occurrences.push({
      dateStr,
      start: new Date(`${dateStr}T${schedule.startTime}:00-03:00`),
      end: new Date(`${dateStr}T${schedule.endTime}:00-03:00`),
    });
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return occurrences;
}

/**
 * Returns an active subscription on the same pitch/day with an overlapping
 * time range, or null. Used to prevent accidental duplicates.
 */
export async function findDuplicateActiveSubscription(
  db: any,
  params: {
    pitchId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  },
): Promise<any | null> {
  const { data, error } = await db
    .from(pitchSubscriptions)
    .select("*")
    .eq("pitch_id", params.pitchId)
    .eq("day_of_week", params.dayOfWeek)
    .eq("is_active", true)
    .lt("start_time", params.endTime)
    .gt("end_time", params.startTime)
    .limit(1);

  if (error) throw error;
  const rows = camelize<any[]>(data || []);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Creates the missing bookings of a subscription within [fromDate, untilDate].
 * Dates that already have a booking row (any status, including CANCELLED) are
 * left untouched; dates with pitch conflicts are skipped and reported.
 */
export async function materializeOccurrences(
  db: any,
  sub: SubscriptionLike,
  fromDate: Date,
  untilDate: Date,
): Promise<{ created: number; skipped: string[] }> {
  const { data: existingData, error: existingErr } = await db
    .from(bookings)
    .select("start_time")
    .eq("notes", `subscription:${sub.id}`);

  if (existingErr) throw existingErr;
  const existingDates = new Set(
    camelize<any[]>(existingData || []).map((r) =>
      getBAFormatDate(parseDatabaseDate(r.startTime)),
    ),
  );

  const occurrences = generateOccurrences(sub, fromDate, untilDate);
  const rowsToInsert: any[] = [];
  const skipped: string[] = [];

  for (const occ of occurrences) {
    if (existingDates.has(occ.dateStr)) continue;

    const { available } = await isPitchAvailable(db, {
      pitchId: sub.pitchId,
      startTime: occ.start,
      endTime: occ.end,
    });

    if (!available) {
      skipped.push(occ.dateStr);
      continue;
    }

    rowsToInsert.push({
      id: crypto.randomUUID(),
      user_id: sub.userId,
      group_id: sub.groupId,
      pitch_id: sub.pitchId,
      start_time: toBALocalISOString(occ.start),
      end_time: toBALocalISOString(occ.end),
      status: "CONFIRMED",
      booking_type: "FIXED",
      is_subscription: true,
      total_price: Number(sub.pricePerMatch),
      paid_amount: 0,
      payment_status: "PENDING",
      payment_method: "CASH",
      notes: `subscription:${sub.id}`,
    });
  }

  for (let i = 0; i < rowsToInsert.length; i += BOOKING_CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + BOOKING_CHUNK_SIZE);
    const { error: insertErr } = await db.from(bookings).insert(chunk);
    if (insertErr) throw insertErr;
  }

  return { created: rowsToInsert.length, skipped };
}

/**
 * Creates a subscription record plus its first HORIZON_WEEKS of bookings.
 */
export async function createSubscriptionWithBookings(
  db: any,
  params: {
    pitchId: string;
    userId: string | null;
    groupId: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    startDate: Date;
    pricePerMatch: number;
  },
): Promise<{ subId: string; created: number; skipped: string[] }> {
  const subId = crypto.randomUUID();

  const { error: subErr } = await db.from(pitchSubscriptions).insert({
    id: subId,
    pitch_id: params.pitchId,
    user_id: params.userId,
    group_id: params.groupId,
    day_of_week: Number(params.dayOfWeek),
    start_time: params.startTime,
    end_time: params.endTime,
    start_date: params.startDate.toISOString(),
    price_per_match: Number(params.pricePerMatch),
    is_active: true,
  });

  if (subErr) throw subErr;

  const sub: SubscriptionLike = {
    id: subId,
    pitchId: params.pitchId,
    userId: params.userId,
    groupId: params.groupId,
    dayOfWeek: Number(params.dayOfWeek),
    startTime: params.startTime,
    endTime: params.endTime,
    pricePerMatch: Number(params.pricePerMatch),
  };

  const horizonEnd = getHorizonEndDate(
    params.startDate > new Date() ? params.startDate : new Date(),
  );
  const { created, skipped } = await materializeOccurrences(
    db,
    sub,
    params.startDate,
    horizonEnd,
  );

  return { subId, created, skipped };
}

/**
 * Tops up every active subscription so each one has bookings generated up to
 * the rolling horizon. Safe to run repeatedly (idempotent per date).
 */
export async function extendActiveSubscriptions(db: any): Promise<{
  processed: number;
  created: number;
  skipped: number;
  details: { subscriptionId: string; created: number; skipped: string[] }[];
}> {
  const { data: subsData, error: subsErr } = await db
    .from(pitchSubscriptions)
    .select("*")
    .eq("is_active", true);

  if (subsErr) throw subsErr;
  const subs = camelize<any[]>(subsData || []);

  const now = new Date();
  const horizonEnd = getHorizonEndDate(now);
  const details: {
    subscriptionId: string;
    created: number;
    skipped: string[];
  }[] = [];
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const sub of subs) {
    const startDate = sub.startDate ? parseDatabaseDate(sub.startDate) : now;
    const fromDate = startDate > now ? startDate : now;
    const result = await materializeOccurrences(db, sub, fromDate, horizonEnd);
    totalCreated += result.created;
    totalSkipped += result.skipped.length;
    if (result.created > 0 || result.skipped.length > 0) {
      details.push({
        subscriptionId: sub.id,
        created: result.created,
        skipped: result.skipped,
      });
    }
  }

  return {
    processed: subs.length,
    created: totalCreated,
    skipped: totalSkipped,
    details,
  };
}
