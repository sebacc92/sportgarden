import { routeAction$, zod$, z } from "@builder.io/qwik-city";
import { eq, and, lt, gt, inArray } from "drizzle-orm";
import { getDB } from "~/db";
import { bookings, guestRequests, pitches } from "~/db/schema";

const parseDateTime = (dateStr: string, timeStr: string) => {
  return new Date(`${dateStr}T${timeStr}:00`);
};

export const calculateDynamicPrice = (
  startTimeDate: Date,
  durationMins: number,
  pricePerHour: number,
  peakHourStart: string | null,
  peakPricePerHour: number | null
) => {
  if (!peakHourStart || !peakPricePerHour) {
    return pricePerHour * (durationMins / 60);
  }

  const startHour = startTimeDate.getHours() + startTimeDate.getMinutes() / 60;
  
  const [peakH, peakM] = peakHourStart.split(":").map(Number);
  const peakStartHour = peakH + peakM / 60;

  let normalHours = 0;
  let peakHours = 0;

  // We loop over each 30 minute block
  for (let i = 0; i < durationMins; i += 30) {
    const currentBlockStart = startHour + (i / 60);
    if (currentBlockStart >= peakStartHour) {
      peakHours += 0.5;
    } else {
      normalHours += 0.5;
    }
  }

  return (normalHours * pricePerHour) + (peakHours * peakPricePerHour);
};

// Action for Guest Users
export const useGuestBookingAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    
    const startTimeDate = parseDateTime(data.date, data.time);
    const endTimeDate = new Date(startTimeDate.getTime() + data.duration * 60000);

    // Check if pitch exists to calculate price
    const pitch = await db.query.pitches.findFirst({
      where: eq(pitches.id, data.pitchId),
    });

    if (!pitch) {
      return requestEvent.fail(404, {
        message: "Pitch not found",
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
        message: "La cancha ya está reservada en ese horario.",
      });
    }

    const totalPrice = calculateDynamicPrice(
      startTimeDate,
      data.duration,
      pitch.pricePerHour,
      pitch.peakHourStart,
      pitch.peakPricePerHour
    );

    const bookingId = crypto.randomUUID();

    // Create booking and guest request
    await db.insert(bookings).values({
      id: bookingId,
      pitchId: data.pitchId,
      startTime: startTimeDate,
      endTime: endTimeDate,
      status: "PENDING_APPROVAL",
      totalPrice,
      paidAmount: 0,
      paymentStatus: "PENDING",
      paymentMethod: data.paymentMethod || "CASH",
      extras: data.extras ? data.extras.map((e: string) => JSON.parse(e)) : null,
    });

    await db.insert(guestRequests).values({
      id: crypto.randomUUID(),
      bookingId,
      name: data.guestName,
      phone: data.guestPhone,
      email: data.guestEmail || null,
    });

    return { success: true, bookingId };
  },
  zod$({
    pitchId: z.string().min(1),
    guestName: z.string().min(2),
    guestPhone: z.string().min(8),
    guestEmail: z.string().email().optional().or(z.literal("")),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido"),
    duration: z.coerce.number().min(30),
    paymentMethod: z.string().optional(),
    extras: z.array(z.string()).optional(),
  })
);

// Action for Registered Users
export const useUserBookingAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    
    const user = requestEvent.sharedMap.get("user");
    if (!user) {
       return requestEvent.fail(401, { message: "Unauthorized. Please log in." });
    }
    const userId = user.userId;

    const startTimeDate = parseDateTime(data.date, data.time);
    const endTimeDate = new Date(startTimeDate.getTime() + data.duration * 60000);

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
        message: "La cancha ya está reservada en ese horario.",
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

    const totalPrice = calculateDynamicPrice(
      startTimeDate,
      data.duration,
      pitch.pricePerHour,
      pitch.peakHourStart,
      pitch.peakPricePerHour
    );
    
    // Calculate paid amount based on preference
    let paidAmount = 0;
    let paymentStatus: "PENDING" | "PARTIAL" | "PAID" = "PENDING";
    
    if (data.paymentOption === "SENA") {
      paidAmount = pitch.depositType === "FIXED"
        ? pitch.depositAmount
        : (pitch.depositAmount / 100) * totalPrice;
      paymentStatus = "PARTIAL";
    } else if (data.paymentOption === "TOTAL") {
      paidAmount = totalPrice;
      paymentStatus = "PAID";
    }

    const bookingId = crypto.randomUUID();

    // Insert booking (auto-confirmed for registered users in this flow)
    await db.insert(bookings).values({
      id: bookingId,
      userId,
      pitchId: data.pitchId,
      startTime: startTimeDate,
      endTime: endTimeDate,
      status: "CONFIRMED",
      totalPrice,
      paidAmount,
      paymentStatus,
      paymentMethod: data.paymentMethod || "CASH",
      extras: data.extras ? data.extras.map((e: string) => JSON.parse(e)) : null,
    });

    return { success: true, bookingId };
  },
  zod$({
    pitchId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido"),
    duration: z.coerce.number().min(30),
    paymentOption: z.enum(["LATER", "SENA", "TOTAL"]),
    paymentMethod: z.string().optional(),
    extras: z.array(z.string()).optional(),
  })
);
