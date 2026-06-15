import { routeAction$, zod$, z, server$ } from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import {
  bookings,
  users,
  guestRequests,
  cashRegisters,
  cashMovements,
  pitchOverlaps,
  groups,
  groupTransactions,
  pitchSubscriptions,
  siteSettings,
} from "~/db/schema";
import { isPitchAvailable } from "~/utils/availability";
import { HORIZON_WEEKS } from "~/lib/admin/subscriptions";
import {
  getBADayOfWeek,
  getBAHoursAndMinutes,
  toBALocalISOString,
  parseDatabaseDate,
} from "./utils";

export const useUpdateBookingStatusAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const { data: bookingData, error: bookingErr } = await db
      .from(bookings)
      .select("*")
      .eq("id", data.bookingId)
      .maybeSingle();

    if (bookingErr) throw bookingErr;
    if (!bookingData) {
      return { success: false, message: "Reserva no encontrada." };
    }
    const booking = camelize<any>(bookingData);

    if (
      data.cancellationOption === "TRANSFER_NEXT_WEEK" ||
      data.cancellationOption === "TRANSFER_CUSTOM"
    ) {
      let newStart: Date;
      let newEnd: Date;

      if (data.cancellationOption === "TRANSFER_NEXT_WEEK") {
        newStart = new Date(booking.startTime);
        newStart.setDate(newStart.getDate() + 7);
        newEnd = new Date(booking.endTime);
        newEnd.setDate(newEnd.getDate() + 7);
      } else {
        if (!data.newDate || !data.newStartTime || !data.newEndTime) {
          return {
            success: false,
            message: "Datos de transferencia incompletos.",
          };
        }
        newStart = new Date(`${data.newDate}T${data.newStartTime}:00-03:00`);
        newEnd = new Date(`${data.newDate}T${data.newEndTime}:00-03:00`);
      }

      const { available } = await isPitchAvailable(db, {
        pitchId: booking.pitchId,
        startTime: newStart,
        endTime: newEnd,
        excludeBookingId: booking.id,
      });

      if (!available) {
        return {
          success: false,
          message:
            "El horario seleccionado ya está ocupado (o solapado) en la nueva fecha.",
        };
      }

      const { error: updErr } = await db
        .from(bookings)
        .update({
          start_time: toBALocalISOString(newStart),
          end_time: toBALocalISOString(newEnd),
          status: "CONFIRMED",
        })
        .eq("id", booking.id);

      if (updErr) throw updErr;
      return { success: true, message: "Reserva transferida con éxito." };
    }

    if (data.status === "CANCELLED" && data.cancellationOption === "RETURN") {
      if (booking.paidAmount > 0) {
        const { data: openRegisterData, error: regErr } = await db
          .from(cashRegisters)
          .select("*")
          .eq("status", "OPEN")
          .maybeSingle();

        if (regErr) throw regErr;
        const openRegister = camelize<any>(openRegisterData);

        if (!openRegister) {
          return {
            success: false,
            message: "No hay una caja abierta para realizar la devolución.",
          };
        }

        const { error: insMovErr } = await db.from(cashMovements).insert({
          id: crypto.randomUUID(),
          register_id: openRegister.id,
          type: "EXPENSE",
          category: "CANCELACION",
          amount: booking.paidAmount,
          description: `Devolución seña reserva anulada: ${booking.id.slice(0, 8)}`,
          payment_method: booking.paymentMethod,
          reference_id: booking.id,
        });

        if (insMovErr) throw insMovErr;

        const { error: updBookErr } = await db
          .from(bookings)
          .update({
            status: "CANCELLED",
            paid_amount: 0,
            payment_status: "PENDING",
          })
          .eq("id", booking.id);

        if (updBookErr) throw updBookErr;

        return {
          success: true,
          message: "Reserva anulada y seña devuelta en caja.",
        };
      }
    }

    const { error: updBookErr } = await db
      .from(bookings)
      .update({ status: data.status })
      .eq("id", data.bookingId);

    if (updBookErr) throw updBookErr;
    return { success: true };
  },
  zod$({
    bookingId: z.string(),
    status: z.enum(["PENDING_APPROVAL", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "COMPLETED"]),
    cancellationOption: z
      .enum(["RETURN", "KEEP", "TRANSFER_NEXT_WEEK", "TRANSFER_CUSTOM"])
      .optional(),
    newDate: z.string().optional(),
    newStartTime: z.string().optional(),
    newEndTime: z.string().optional(),
  }),
);

export const useCreateAdminBookingAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const startDate = new Date(`${data.date}T12:00:00-03:00`);

    let endDate = startDate;
    if (data.isSubscription) {
      if (data.endDate) {
        endDate = new Date(`${data.endDate}T12:00:00-03:00`);
        const maxDate = new Date(startDate);
        maxDate.setFullYear(maxDate.getFullYear() + 1);
        if (endDate > maxDate) endDate = maxDate;
        if (endDate < startDate) {
          return {
            success: false,
            failed: true,
            message: "La fecha de fin debe ser posterior a la de inicio",
          };
        }
      } else {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + HORIZON_WEEKS * 7);
      }
    }

    const datesToBook: {
      date: string;
      startTime: string;
      endTime: string;
      price: number;
      pitchId: string;
      subId?: string;
    }[] = [];
    const current = new Date(startDate);
    const globalPrice = Number(data.price);
    const singleSubId = crypto.randomUUID();
    let schedulesWithIds: any[] = [];

    if (data.isSubscription && data.subscriptionSchedules) {
      const parsedSchedules = JSON.parse(data.subscriptionSchedules) as any[];
      schedulesWithIds = parsedSchedules.map((s) => ({ ...s, subId: crypto.randomUUID() }));

      if (schedulesWithIds.length === 0) {
        return {
          success: false,
          failed: true,
          message: "Debe seleccionar al menos un día de la semana para el turno fijo.",
        };
      }

      while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const daySchedules = schedulesWithIds.filter((s) => s.dayOfWeek === dayOfWeek);
        for (const schedule of daySchedules) {
          datesToBook.push({
            date: current.toISOString().split("T")[0],
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            price: schedule.price,
            pitchId: schedule.pitchId || data.pitchId,
            subId: schedule.subId,
          });
        }
        current.setDate(current.getDate() + 1);
      }
    } else {
      while (current <= endDate) {
        datesToBook.push({
          date: current.toISOString().split("T")[0],
          startTime: data.startTime,
          endTime: data.endTime,
          price: globalPrice,
          pitchId: data.pitchId,
          subId: data.isSubscription ? singleSubId : undefined,
        });
        if (data.isSubscription) {
          current.setDate(current.getDate() + 7);
        } else {
          break;
        }
      }
    }

    const firstPaidAmount = Number(data.paidAmount) || 0;
    let openRegisterId: string | null = null;

    if (firstPaidAmount > 0) {
      const { data: openRegisterData, error: regErr } = await db
        .from(cashRegisters)
        .select("*")
        .eq("status", "OPEN")
        .maybeSingle();

      if (regErr) throw regErr;
      const openRegister = camelize<any>(openRegisterData);

      if (!openRegister) {
        return {
          failed: true,
          message:
            "No hay una caja abierta. Por favor, abre la caja desde el módulo de Caja antes de cobrar.",
        };
      }
      openRegisterId = openRegister.id;
    }

    let finalUserId = data.userId || null;

    if (!finalUserId && data.customerPhone) {
      const { data: existingUserData, error: userErr } = await db
        .from(users)
        .select("*")
        .eq("phone", data.customerPhone)
        .maybeSingle();

      if (userErr) throw userErr;
      const existingUser = camelize<any>(existingUserData);

      if (existingUser) {
        finalUserId = existingUser.id;
      } else {
        const newUserId = crypto.randomUUID();
        const { error: insUserErr } = await db.from(users).insert({
          id: newUserId,
          name: data.customerName || "Invitado",
          phone: data.customerPhone,
          email: data.customerEmail || null,
          role: "GUEST",
        });
        if (insUserErr) throw insUserErr;
        finalUserId = newUserId;
      }
    }

    const { data: settingsData, error: settingsErr } = await db
      .from(siteSettings)
      .select("*")
      .maybeSingle();

    if (settingsErr) throw settingsErr;
    const settings = camelize<any>(settingsData);

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

    const pitchIds = Array.from(new Set(datesToBook.map((d) => d.pitchId)));
    const { data: existingData, error: existErr } = await db
      .from(bookings)
      .select("*")
      .in("pitch_id", pitchIds)
      .gte("start_time", toBALocalISOString(startDate))
      .lte("end_time", toBALocalISOString(endDate));

    if (existErr) throw existErr;
    const allExistingBookings = camelize<any[]>(existingData || []);

    const bookingsToInsert: any[] = [];
    const guestsToInsert: any[] = [];
    const warnings: string[] = [];
    let bookingsCount = 0;
    let actualFirstBookingId = "";

    for (let i = 0; i < datesToBook.length; i++) {
      const item = datesToBook[i];
      const startDateTime = new Date(`${item.date}T${item.startTime}:00-03:00`);
      const endDateTime = new Date(`${item.date}T${item.endTime}:00-03:00`);
      const bookingId = crypto.randomUUID();

      const holidaysList = (settings?.holidays as any[]) || [];
      const isHoliday = holidaysList.some((h: any) => h.date === item.date);
      const dayOfWeek = isHoliday ? 7 : getBADayOfWeek(startDateTime);
      const schedule = operatingHours.find((h: any) => h.day === dayOfWeek);

      if (!schedule || schedule.isClosed) {
        if (data.isSubscription) {
          const formattedDate = item.date.split("-").reverse().join("/");
          warnings.push(`${formattedDate} (Club cerrado)`);
          continue;
        } else {
          throw new Error(`El club está cerrado el día seleccionado (${item.date}).`);
        }
      }

      const startBA = getBAHoursAndMinutes(startDateTime);
      const endBA = getBAHoursAndMinutes(endDateTime);
      const startMins = startBA.hour * 60 + startBA.minute;
      let endMins = endBA.hour * 60 + endBA.minute;
      if (endMins === 0 && startMins > 0) endMins = 24 * 60;

      const [openH, openM] = schedule.openTime
        ? schedule.openTime.split(":").map(Number)
        : [8, 0];
      const [closeH, closeM] = schedule.closeTime
        ? schedule.closeTime.split(":").map(Number)
        : [23, 0];

      const openMins = openH * 60 + (openM || 0);
      let closeMins = closeH * 60 + (closeM || 0);
      if (closeMins === 0) closeMins = 24 * 60;

      if (startMins < openMins || endMins > closeMins) {
        if (data.isSubscription) {
          const formattedDate = item.date.split("-").reverse().join("/");
          warnings.push(`${formattedDate} ${item.startTime} - ${item.endTime} (Fuera de horario)`);
          continue;
        } else {
          throw new Error(
            `El horario seleccionado (${item.startTime} - ${item.endTime}) está fuera del horario de atención del club para el día ${item.date}.`,
          );
        }
      }

      const { available, conflicts } = await isPitchAvailable(db, {
        pitchId: item.pitchId,
        startTime: startDateTime,
        endTime: endDateTime,
      });

      if (!available) {
        if (data.isSubscription) {
          const formattedDate = item.date.split("-").reverse().join("/");
          warnings.push(`${formattedDate} ${item.startTime} - ${item.endTime} (Ya reservado)`);
          continue;
        } else {
          throw new Error(
            `Conflicto de horario: ${item.date} ${item.startTime} - ${item.endTime} en ${conflicts[0].pitch.name}.`,
          );
        }
      }

      if (!actualFirstBookingId) actualFirstBookingId = bookingId;

      bookingsToInsert.push({
        id: bookingId,
        user_id: finalUserId,
        pitch_id: item.pitchId,
        start_time: toBALocalISOString(startDateTime),
        end_time: toBALocalISOString(endDateTime),
        status: "CONFIRMED",
        total_price: item.price,
        paid_amount: bookingsCount === 0 ? Number(data.paidAmount) || 0 : 0,
        payment_status:
          bookingsCount === 0
            ? data.paymentStatus ||
              ((Number(data.paidAmount) || 0) >= Number(data.price)
                ? "PAID"
                : (Number(data.paidAmount) || 0) > 0
                  ? "PARTIAL"
                  : "PENDING")
            : "PENDING",
        payment_method: data.paymentMethod,
        is_subscription: data.isSubscription,
        booking_type: data.bookingType || (data.isSubscription ? "FIXED" : "EVENTUAL"),
        notes: item.subId ? `subscription:${item.subId}` : (data.notes || null),
        extras: data.extras ? JSON.parse(data.extras) : null,
      });

      if (!data.userId) {
        guestsToInsert.push({
          id: crypto.randomUUID(),
          booking_id: bookingId,
          name: data.customerName || "Invitado",
          phone: data.customerPhone || "",
          email: data.customerEmail || null,
        });
      }

      if (bookingsCount === 0 && firstPaidAmount > 0 && openRegisterId) {
        const { error: insMovErr } = await db.from(cashMovements).insert({
          id: crypto.randomUUID(),
          register_id: openRegisterId,
          type: "INCOME",
          category: "BOOKING",
          amount: firstPaidAmount,
          description: `Pago reserva: ${data.customerName || "Invitado"}`,
          payment_method: data.paymentMethod,
          reference_id: bookingId,
        });
        if (insMovErr) throw insMovErr;
      }

      allExistingBookings.push({
        pitchId: item.pitchId,
        startTime: startDateTime,
        endTime: endDateTime,
      } as any);

      bookingsCount++;
    }

    if (bookingsToInsert.length > 0) {
      const { error: insBookErr } = await db.from(bookings).insert(bookingsToInsert);
      if (insBookErr) throw insBookErr;
    }

    if (data.isSubscription) {
      if (schedulesWithIds.length > 0) {
        const subsToInsert = schedulesWithIds.map((s) => ({
          id: s.subId,
          pitch_id: s.pitchId || data.pitchId,
          user_id: finalUserId,
          group_id: null,
          day_of_week: Number(s.dayOfWeek),
          start_time: s.startTime,
          end_time: s.endTime,
          start_date: toBALocalISOString(startDate).split("T")[0],
          price_per_match: Number(s.price),
          is_active: true,
        }));
        const { error: insSubErr } = await db.from(pitchSubscriptions).insert(subsToInsert);
        if (insSubErr) throw insSubErr;
      } else {
        const { error: insSubErr } = await db.from(pitchSubscriptions).insert({
          id: singleSubId,
          pitch_id: data.pitchId,
          user_id: finalUserId,
          group_id: null,
          day_of_week: startDate.getDay(),
          start_time: data.startTime,
          end_time: data.endTime,
          start_date: toBALocalISOString(startDate).split("T")[0],
          price_per_match: globalPrice,
          is_active: true,
        });
        if (insSubErr) throw insSubErr;
      }
    }

    if (guestsToInsert.length > 0) {
      const { error: insGuestErr } = await db.from(guestRequests).insert(guestsToInsert);
      if (insGuestErr) throw insGuestErr;
    }

    if (bookingsCount === 0) {
      return {
        failed: true,
        message:
          "No se pudo crear ninguna reserva. Todos los turnos del rango horario están ocupados.",
      };
    }

    return {
      success: true,
      bookingId: actualFirstBookingId,
      message: `Se crearon ${bookingsCount} reservas.`,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
  zod$({
    pitchId: z.string(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    userId: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().optional(),
    price: z.string(),
    paidAmount: z.string().optional(),
    paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
    paymentMethod: z.string().default("CASH"),
    notes: z.string().optional(),
    extras: z.string().optional(),
    isSubscription: z.coerce.boolean().optional(),
    bookingType: z
      .enum(["EVENTUAL", "FIXED", "BIRTHDAY", "TOURNAMENT", "SCHOOL"])
      .optional(),
    subscriptionSchedules: z.string().optional(),
    endDate: z.string().optional(),
  }),
);

export const useAddBookingPaymentAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const amount = Number(data.amount);

    if (amount <= 0)
      return { failed: true, message: "El monto debe ser mayor a 0." };

    const { data: openRegisterData, error: regErr } = await db
      .from(cashRegisters)
      .select("*")
      .eq("status", "OPEN")
      .maybeSingle();

    if (regErr) throw regErr;
    const openRegister = camelize<any>(openRegisterData);

    if (!openRegister) {
      return {
        failed: true,
        message: "No hay una caja abierta. Abre la caja antes de registrar el pago.",
      };
    }

    const { data: bookingData, error: bookingErr } = await db
      .from(bookings)
      .select("*")
      .eq("id", data.bookingId)
      .maybeSingle();

    if (bookingErr) throw bookingErr;
    if (!bookingData) return { failed: true, message: "Reserva no encontrada." };
    const booking = camelize<any>(bookingData);

    const newPaidAmount = (booking.paidAmount || 0) + amount;
    const newPaymentStatus = newPaidAmount >= booking.totalPrice ? "PAID" : "PARTIAL";

    const { error: updBookErr } = await db
      .from(bookings)
      .update({ paid_amount: newPaidAmount, payment_status: newPaymentStatus })
      .eq("id", booking.id);

    if (updBookErr) throw updBookErr;

    const { error: insMovErr } = await db.from(cashMovements).insert({
      id: crypto.randomUUID(),
      register_id: openRegister.id,
      type: "INCOME",
      category: "BOOKING",
      amount: amount,
      description: `Pago adicional reserva: ${booking.id.slice(0, 8)}`,
      payment_method: data.paymentMethod,
      reference_id: booking.id,
    });

    if (insMovErr) throw insMovErr;
    return { success: true };
  },
  zod$({
    bookingId: z.string(),
    amount: z.string(),
    paymentMethod: z.string(),
  }),
);

export const useConfirmAttendanceAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { data: bookingData, error: bookingErr } = await db
      .from(bookings)
      .select("*")
      .eq("id", data.bookingId)
      .maybeSingle();

    if (bookingErr) throw bookingErr;
    if (!bookingData) {
      return { failed: true, message: "Reserva no encontrada." };
    }
    const booking = camelize<any>(bookingData);

    if (booking.status === "ATTENDED") {
      return { failed: true, message: "La asistencia ya fue confirmada." };
    }

    const { error: updBookErr } = await db
      .from(bookings)
      .update({ status: "ATTENDED" })
      .eq("id", booking.id);

    if (updBookErr) throw updBookErr;

    if (booking.groupId) {
      const debtAmount = booking.totalPrice - booking.paidAmount;
      if (debtAmount > 0) {
        const { error: insTxErr } = await db.from(groupTransactions).insert({
          id: crypto.randomUUID(),
          group_id: booking.groupId,
          type: "CHARGE",
          amount: debtAmount,
          description: `Turno asistido: ${booking.id.slice(0, 8)}`,
          booking_id: booking.id,
        });

        if (insTxErr) throw insTxErr;

        const { data: groupData, error: groupErr } = await db
          .from(groups)
          .select("*")
          .eq("id", booking.groupId)
          .maybeSingle();

        if (groupErr) throw groupErr;
        const group = camelize<any>(groupData);

        if (group) {
          const { error: updGroupErr } = await db
            .from(groups)
            .update({ balance: group.balance - debtAmount })
            .eq("id", booking.groupId);

          if (updGroupErr) throw updGroupErr;
        }
      }
    }

    return { success: true };
  },
  zod$({
    bookingId: z.string(),
  }),
);

export const fetchRealtimeBookingDetails = server$(async function (
  bookingId: string,
  userId: string | null,
) {
  const adminId = this.cookie.get("auth_session")?.value;
  if (!adminId) throw new Error("Unauthorized");
  const db = getDB(this);

  let user = null;
  if (userId) {
    const { data: userData } = await db
      .from(users)
      .select("id, name, phone")
      .eq("id", userId)
      .maybeSingle();
    if (userData) user = camelize<any>(userData);
  }

  let guest = null;
  const { data: guestData } = await db
    .from(guestRequests)
    .select("id, booking_id, name, phone")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (guestData) guest = camelize<any>(guestData);

  return { user, guest };
});

export const getAdminDailyBookings = server$(async function (
  pitchId: string,
  dateStr: string,
) {
  const db = getDB(this);
  if (!pitchId || !dateStr) return [];

  const startOfDay = new Date(`${dateStr}T00:00:00-03:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59-03:00`);

  const { data: overlapsData, error: overlapsErr } = await db
    .from(pitchOverlaps)
    .select("*")
    .or(`pitch_id.eq.${pitchId},overlap_pitch_id.eq.${pitchId}`);

  if (overlapsErr) throw overlapsErr;
  const overlaps = camelize<any[]>(overlapsData || []);

  const relatedIds = [
    pitchId,
    ...overlaps.map((o: any) =>
      o.pitchId === pitchId ? o.overlapPitchId : o.pitchId,
    ),
  ];

  const { data: dailyData, error: dailyErr } = await db
    .from(bookings)
    .select("start_time, end_time")
    .in("pitch_id", relatedIds)
    .gte("start_time", toBALocalISOString(startOfDay))
    .lt("start_time", toBALocalISOString(endOfDay))
    .in("status", ["CONFIRMED", "PENDING_APPROVAL", "COMPLETED"]);

  if (dailyErr) throw dailyErr;
  const daily = camelize<any[]>(dailyData || []);

  return daily.map((b) => ({
    startTime: parseDatabaseDate(b.startTime).toISOString(),
    endTime: parseDatabaseDate(b.endTime).toISOString(),
  }));
});

export const searchUsersServer = server$(async function (query: string) {
  if (!query || query.length < 2) return [];
  const db = getDB(this as any);

  const { data, error } = await db
    .from(users)
    .select("id, name, phone, email")
    .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(5);

  if (error) throw error;
  return camelize<any[]>(data || []);
});
