import { bookings, pitchOverlaps, siteSettings } from "~/db/schema";
import { camelize } from "~/db";

/**
 * Checks if a pitch (and its overlapping counterparts) is available for a given time range.
 */
export async function isPitchAvailable(
  db: any,
  {
    pitchId,
    startTime,
    endTime,
    excludeBookingId,
  }: {
    pitchId: string;
    startTime: Date;
    endTime: Date;
    excludeBookingId?: string;
  },
) {
  // 1. Find all related pitch IDs (bidirectional)
  const { data: relatedOverlapsData, error: overlapErr } = await db
    .from(pitchOverlaps)
    .select("*")
    .or(`pitch_id.eq.${pitchId},overlap_pitch_id.eq.${pitchId}`);

  if (overlapErr) {
    throw new Error(overlapErr.message);
  }
  const relatedOverlaps = camelize<any[]>(relatedOverlapsData);

  const relatedPitchIds = [
    pitchId,
    ...relatedOverlaps.map((o: any) =>
      o.pitchId === pitchId ? o.overlapPitchId : o.pitchId,
    ),
  ];

  // 2. Check for any booking on any of these pitches that overlaps with the requested time
  // Logic: (NewStart < ExistingEnd) AND (NewEnd > ExistingStart)
  let query = db
    .from(bookings)
    .select(`
      *,
      pitch:pitches(*)
    `)
    .in("pitch_id", relatedPitchIds)
    .lt("start_time", endTime.toISOString())
    .gt("end_time", startTime.toISOString())
    .in("status", ["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT", "COMPLETED"]);

  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }

  const { data: conflictsData, error: conflictsErr } = await query;
  if (conflictsErr) {
    throw new Error(conflictsErr.message);
  }
  const conflicts = camelize<any[]>(conflictsData);

  // 3. Check for overlapping school classes
  const { data: settingsData, error: settingsErr } = await db
    .from(siteSettings)
    .select("*")
    .limit(1)
    .maybeSingle();

  if (settingsErr) {
    throw new Error(settingsErr.message);
  }
  const settings = camelize<any>(settingsData);

  let hasSchoolConflict = false;
  if (settings && settings.schoolCategories) {
    const schoolCategories = settings.schoolCategories as any[];
    const reqDay = startTime.getDay(); // 0-6
    // Time to string (e.g., "15:30")
    const pad = (n: number) => n.toString().padStart(2, "0");
    const reqStartStr = `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}`;
    const reqEndStr = `${pad(endTime.getHours())}:${pad(endTime.getMinutes())}`;

    for (const cat of schoolCategories) {
      if (cat.schedules) {
        for (const sched of cat.schedules) {
          if (
            sched.day === reqDay &&
            sched.pitchId &&
            relatedPitchIds.includes(sched.pitchId)
          ) {
            // Overlap logic: (NewStart < ExistingEnd) AND (NewEnd > ExistingStart)
            if (reqStartStr < sched.endTime && reqEndStr > sched.startTime) {
              hasSchoolConflict = true;
              break;
            }
          }
        }
      }
      if (hasSchoolConflict) break;
    }
  }

  return {
    available: conflicts.length === 0 && !hasSchoolConflict,
    conflicts,
  };
}
