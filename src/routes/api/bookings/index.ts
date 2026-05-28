// Polyfill process properties for Vercel Edge Runtime compatibility with Mercado Pago SDK
if (typeof process === "undefined") {
  (globalThis as any).process = {
    env: {},
    version: "v20.0.0",
    versions: { node: "20.0.0" },
    arch: "x64",
    platform: "linux",
  };
} else {
  if (!process.version) {
    (process as any).version = "v20.0.0";
  }
  if (!process.arch) {
    (process as any).arch = "x64";
  }
  if (!process.platform) {
    (process as any).platform = "linux";
  }
}

// Polyfill global Headers prototype for compatibility with node-fetch's raw() method
if (typeof globalThis.Headers !== "undefined" && !(globalThis.Headers.prototype as any).raw) {
  (globalThis.Headers.prototype as any).raw = function () {
    const rawHeaders: Record<string, string[]> = {};
    this.forEach((value: string, name: string) => {
      rawHeaders[name] = value.split(",").map((v) => v.trim());
    });
    return rawHeaders;
  };
}

import { routeAction$, zod$, z } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { bookings, guestRequests, pitches, mercadoPagoCredentials } from "~/db/schema";
import { isPitchAvailable } from "~/utils/availability";
import { MercadoPagoConfig, Preference } from "mercadopago";

const parseDateTime = (dateStr: string, timeStr: string) => {
  return new Date(`${dateStr}T${timeStr}:00`);
};

const isValidOperatingHours = (
  dateStr: string,
  timeStr: string,
  durationMins: number,
  settings: any,
) => {
  if (!settings) return true;

  const isHoliday = (settings.holidays || []).some((h: any) => h.date === dateStr);
  const [year, month, day] = dateStr.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = isHoliday ? 7 : localDate.getDay();

  const operatingHours = (() => {
    try {
      if (typeof settings.operatingHours === "string") {
        return JSON.parse(settings.operatingHours);
      }
      if (Array.isArray(settings.operatingHours)) {
        return settings.operatingHours;
      }
      return [];
    } catch {
      return [];
    }
  })();

  const schedule = operatingHours.find((h: any) => h.day === dayOfWeek);
  const isOpen = schedule ? schedule.isOpen : true;
  if (!isOpen) return false;

  const openTime = schedule?.openTime || "08:00";
  const closeTime = schedule?.closeTime || "23:00";

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const slotStartMin = timeToMinutes(timeStr);
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  const slotEndMin = slotStartMin + durationMins;

  return slotStartMin >= openMin && slotEndMin <= closeMin;
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

    // Verify operating hours
    if (!isValidOperatingHours(data.date, data.time, data.duration, settings)) {
      return requestEvent.fail(400, {
        message: "El club está cerrado en el horario seleccionado (o la duración excede la hora de cierre).",
      });
    }

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

    // Verify operating hours
    if (!isValidOperatingHours(data.date, data.time, data.duration, settings)) {
      return requestEvent.fail(400, {
        message: "El club está cerrado en el horario seleccionado (o la duración excede la hora de cierre).",
      });
    }

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
    let amountToCharge = 0;
    let paymentMethod = "CASH";
    let bookingStatus: "CONFIRMED" | "PENDING_APPROVAL" = "CONFIRMED";

    if (data.paymentOption === "SENA") {
      amountToCharge =
        pitch.depositType === "FIXED"
          ? pitch.depositAmount
          : (pitch.depositAmount / 100) * totalPrice;
      paymentMethod = "MERCADOPAGO";
      bookingStatus = "PENDING_APPROVAL";
    } else if (data.paymentOption === "TOTAL") {
      amountToCharge = totalPrice;
      paymentMethod = "MERCADOPAGO";
      bookingStatus = "PENDING_APPROVAL";
    }

    const bookingId = crypto.randomUUID();
    let checkoutUrl: string | null = null;

    if (amountToCharge > 0) {
      // 1. Obtener las credenciales de la base de datos para el ID "1" si existen
      const [credentials] = await db
        .select()
        .from(mercadoPagoCredentials)
        .where(eq(mercadoPagoCredentials.id, "1"))
        .limit(1);

      const mpAccessToken = credentials?.accessToken || requestEvent.env.get("MP_ACCESS_TOKEN");

      if (!mpAccessToken) {
        return requestEvent.fail(500, {
          message: "Configuración incorrecta: falta el token de acceso de Mercado Pago en el servidor.",
        });
      }

      try {
        const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
        const preference = new Preference(client);

        // 2. Resolver host de forma segura con headers de reenvío
        const headers = requestEvent.request.headers;
        const proto = headers.get("x-forwarded-proto") || "https";
        const host = headers.get("x-forwarded-host") || headers.get("host") || requestEvent.url.host;
        const origin = host.includes("localhost") || host.includes("127.0.0.1")
          ? "https://www.gardenclub.com.ar"
          : `${proto}://${host}`;

        const response = await preference.create({
          body: {
            items: [
              {
                id: bookingId,
                title: `Seña / Pago Reserva Cancha ${pitch.name} - Garden Club`,
                quantity: 1,
                unit_price: amountToCharge,
                currency_id: "ARS",
              },
            ],
            external_reference: bookingId,
            back_urls: {
              success: `${origin}/pago/exitoso`,
              failure: `${origin}/pago/fallido`,
              pending: `${origin}/pago/pendiente`,
            },
            auto_return: "approved",
            notification_url: `${origin}/api/mercadopago/webhooks`,
            statement_descriptor: "GARDEN CLUB",
          },
        });

        checkoutUrl = response.init_point || null;
      } catch (mpError: any) {
        console.error("Error al crear preferencia de Mercado Pago:", mpError);
        return requestEvent.fail(500, {
          message: "No se pudo iniciar el proceso de pago online de Mercado Pago. Intenta nuevamente.",
        });
      }
    }

    // Insert booking
    await db.insert(bookings).values({
      id: bookingId,
      userId,
      pitchId: data.pitchId,
      startTime: startTimeDate,
      endTime: endTimeDate,
      status: bookingStatus,
      totalPrice,
      paidAmount: 0,
      paymentStatus: "PENDING",
      paymentMethod: data.paymentMethod || paymentMethod,
      extras: data.extras
        ? data.extras.map((e: string) => JSON.parse(e))
        : null,
    });

    return { success: true, bookingId, checkoutUrl };
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
