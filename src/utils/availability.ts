import { and, eq, lt, or, ne, inArray, gt } from "drizzle-orm";
import { bookings, pitchOverlaps } from "~/db/schema";

/**
 * Checks if a pitch (and its overlapping counterparts) is available for a given time range.
 */
export async function isPitchAvailable(db: any, {
  pitchId,
  startTime,
  endTime,
  excludeBookingId
}: {
  pitchId: string;
  startTime: Date;
  endTime: Date;
  excludeBookingId?: string;
}) {
  // 1. Find all related pitch IDs (bidirectional)
  const relatedOverlaps = await db.select().from(pitchOverlaps).where(
    or(
      eq(pitchOverlaps.pitchId, pitchId),
      eq(pitchOverlaps.overlapPitchId, pitchId)
    )
  );

  const relatedPitchIds = [
    pitchId,
    ...relatedOverlaps.map((o: any) => o.pitchId === pitchId ? o.overlapPitchId : o.pitchId)
  ];

  // 2. Check for any booking on any of these pitches that overlaps with the requested time
  // Logic: (NewStart < ExistingEnd) AND (NewEnd > ExistingStart)
  const filters = [
    inArray(bookings.pitchId, relatedPitchIds),
    lt(bookings.startTime, endTime),
    gt(bookings.endTime, startTime),
    inArray(bookings.status, ["CONFIRMED", "PENDING_APPROVAL", "COMPLETED"])
  ];

  if (excludeBookingId) {
    filters.push(ne(bookings.id, excludeBookingId));
  }



  const conflicts = await db.query.bookings.findMany({
    where: and(...filters),
    with: {
      pitch: true
    }
  });

  return {
    available: conflicts.length === 0,
    conflicts
  };
}
