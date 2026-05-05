import { routeAction$, zod$, z } from "@builder.io/qwik-city";
import { eq, and, lt, gt, inArray } from "drizzle-orm";
import { getDB } from "~/db";
import { bookings, guestRequests, pitches } from "~/db/schema";

// Action for Guest Users
export const useGuestBookingAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const startTimeDate = new Date(data.startTime);
    const endTimeDate = new Date(data.endTime);

    // Validate times
    if (endTimeDate <= startTimeDate) {
      return requestEvent.fail(400, {
        message: "End time must be after start time",
      });
    }

    // Check if pitch exists to calculate price
    const pitch = await db.query.pitches.findFirst({
      where: eq(pitches.id, data.pitchId),
    });

    if (!pitch) {
      return requestEvent.fail(404, {
        message: "Pitch not found",
      });
    }

    const durationHours =
      (endTimeDate.getTime() - startTimeDate.getTime()) / (1000 * 60 * 60);
    const totalPrice = pitch.pricePerHour * durationHours;

    const bookingId = crypto.randomUUID();

    // Create booking and guest request in a transaction or sequentially
    await db.insert(bookings).values({
      id: bookingId,
      pitchId: data.pitchId,
      startTime: startTimeDate,
      endTime: endTimeDate,
      status: "PENDING_APPROVAL",
      totalPrice,
      paidAmount: 0,
      paymentStatus: "PENDING",
    });

    await db.insert(guestRequests).values({
      id: crypto.randomUUID(),
      bookingId,
      name: data.guestName,
      phone: data.guestPhone,
      email: data.guestEmail, // Optional
    });

    return { success: true, bookingId };
  },
  zod$({
    pitchId: z.string().min(1),
    guestName: z.string().min(2),
    guestPhone: z.string().min(8),
    guestEmail: z.string().email().optional().or(z.literal("")),
    startTime: z.string().datetime(), // ISO string expected
    endTime: z.string().datetime(),
  })
);

// Action for Registered Users
export const useUserBookingAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    
    // TODO: Replace with actual session check when auth is implemented
    // Mocking user ID for now
    const userId = requestEvent.sharedMap.get("userId") || "MOCK_USER_ID";
    if (!userId) {
       return requestEvent.fail(401, { message: "Unauthorized" });
    }

    const startTimeDate = new Date(data.startTime);
    const endTimeDate = new Date(data.endTime);

    if (endTimeDate <= startTimeDate) {
      return requestEvent.fail(400, {
        message: "End time must be after start time",
      });
    }

    // Check for overlap
    const overlappingBooking = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.pitchId, data.pitchId),
        lt(bookings.startTime, endTimeDate),
        gt(bookings.endTime, startTimeDate),
        inArray(bookings.status, ["CONFIRMED", "PENDING_APPROVAL", "COMPLETED"])
      ),
    });

    if (overlappingBooking) {
      return requestEvent.fail(409, {
        message: "The pitch is already booked for this time slot.",
      });
    }

    const pitch = await db.query.pitches.findFirst({
      where: eq(pitches.id, data.pitchId),
    });

    if (!pitch) {
      return requestEvent.fail(404, {
        message: "Pitch not found",
      });
    }

    const durationHours =
      (endTimeDate.getTime() - startTimeDate.getTime()) / (1000 * 60 * 60);
    const totalPrice = pitch.pricePerHour * durationHours;

    const bookingId = crypto.randomUUID();

    // Insert booking
    await db.insert(bookings).values({
      id: bookingId,
      userId,
      pitchId: data.pitchId,
      startTime: startTimeDate,
      endTime: endTimeDate,
      status: "CONFIRMED",
      totalPrice,
      paidAmount: 0,
      paymentStatus: "PENDING",
    });

    return { success: true, bookingId };
  },
  zod$({
    pitchId: z.string().min(1),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    extras: z.array(z.string()).optional(),
  })
);
