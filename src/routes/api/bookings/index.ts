import { routeAction$, zod$, z } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { bookings, guestRequests, pitches } from "~/db/schema";
import { isPitchAvailable } from "~/utils/availability";

const parseDateTime = (dateStr: string, timeStr: string) => {
  return new Date(`${dateStr}T${timeStr}:00`);
};

import { calculateProportionalPrice } from "~/utils/pricing";

// Action for Guest Users
export const useGuestBookingAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const startTimeDate = parseDateTime(data.date, data.time);
    const endTimeDate = new Date(
      startTimeDate.getTime() + data.duration * 60000,
    );

    // Check if pitch exists to calculate price
    const pitch = await db.query.pitches.findFirst({
      where: eq(pitches.id, data.pitchId),
      with: { pricingRules: true },
    });

    if (!pitch) {
      return requestEvent.fail(404, {
        message: "Pitch not found",
      });
    }

    // Check for overlap including overlapping pitches
    const { available, conflicts } = await isPitchAvailable(db, {
      pitchId: data.pitchId,
      startTime: startTimeDate,
      endTime: endTimeDate,
    });

    if (!available) {
      return requestEvent.fail(409, {
        message: `La cancha ya está reservada (o solapada con ${conflicts[0].pitch.name}) en ese horario.`,
      });
    }

    const settings = await db.query.siteSettings.findFirst();
    const holidays =
      (settings?.holidays as any[])?.map((h: any) => h.date) || [];

    const totalPrice = calculateProportionalPrice(
      data.date,
      data.time,
      data.duration,
      pitch.pricePerHour,
      pitch.pricingRules,
      holidays,
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
      extras: data.extras
        ? data.extras.map((e: string) => JSON.parse(e))
        : null,
    });

    await db.insert(guestRequests).values({
      id: crypto.randomUUID(),
      bookingId,
      name: data.guestName,
      phone: data.guestPhone,
      email: data.guestEmail || null,
    });

    return {
      success: true,
      bookingId,
      message:
        "¡Reserva recibida! Un agente se pondrá en contacto contigo pronto por WhatsApp",
    };
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
  }),
);

// Action for Registered Users
export const useUserBookingAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const user = requestEvent.sharedMap.get("user");
    if (!user) {
      return requestEvent.fail(401, {
        message: "Unauthorized. Please log in.",
      });
    }
    const userId = user.userId;

    const startTimeDate = parseDateTime(data.date, data.time);
    const endTimeDate = new Date(
      startTimeDate.getTime() + data.duration * 60000,
    );

    // Check for overlap including overlapping pitches
    const { available, conflicts } = await isPitchAvailable(db, {
      pitchId: data.pitchId,
      startTime: startTimeDate,
      endTime: endTimeDate,
    });

    if (!available) {
      return requestEvent.fail(409, {
        message: `La cancha ya está reservada (o solapada con ${conflicts[0].pitch.name}) en ese horario.`,
      });
    }

    const pitch = await db.query.pitches.findFirst({
      where: eq(pitches.id, data.pitchId),
      with: { pricingRules: true },
    });

    if (!pitch) {
      return requestEvent.fail(404, {
        message: "Pitch not found",
      });
    }

    const settings = await db.query.siteSettings.findFirst();
    const holidays =
      (settings?.holidays as any[])?.map((h: any) => h.date) || [];

    const totalPrice = calculateProportionalPrice(
      data.date,
      data.time,
      data.duration,
      pitch.pricePerHour,
      pitch.pricingRules,
      holidays,
    );

    // Calculate paid amount based on preference
    let paidAmount = 0;
    let paymentStatus: "PENDING" | "PARTIAL" | "PAID" = "PENDING";

    if (data.paymentOption === "SENA") {
      paidAmount =
        pitch.depositType === "FIXED"
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
      extras: data.extras
        ? data.extras.map((e: string) => JSON.parse(e))
        : null,
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
  }),
);
