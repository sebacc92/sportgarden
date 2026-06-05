import { and, eq, lt, or, ne, inArray, gt } from "drizzle-orm";
import { bookings, pitchOverlaps } from "~/db/schema";

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
  const relatedOverlaps = await db
    .select()
    .from(pitchOverlaps)
    .where(
      or(
        eq(pitchOverlaps.pitchId, pitchId),
        eq(pitchOverlaps.overlapPitchId, pitchId),
      ),
    );

  const relatedPitchIds = [
    pitchId,
    ...relatedOverlaps.map((o: any) =>
      o.pitchId === pitchId ? o.overlapPitchId : o.pitchId,
    ),
  ];

  // 2. Check for any booking on any of these pitches that overlaps with the requested time
  // Logic: (NewStart < ExistingEnd) AND (NewEnd > ExistingStart)
  const filters = [
    inArray(bookings.pitchId, relatedPitchIds),
    lt(bookings.startTime, endTime),
    gt(bookings.endTime, startTime),
    inArray(bookings.status, ["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT", "COMPLETED"]),
  ];

  if (excludeBookingId) {
    filters.push(ne(bookings.id, excludeBookingId));
  }

  const conflicts = await db.query.bookings.findMany({
    where: and(...filters),
    with: {
      pitch: true,
    },
  });

  // 3. Check for overlapping school classes
  const settings = await db.query.siteSettings.findFirst();
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
