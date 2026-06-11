import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  useComputed$,
  useStore,
  useStyles$,
  useTask$,
} from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  zod$,
  z,
  useNavigate,
  server$,
} from "@builder.io/qwik-city";
import { createClient } from "@supabase/supabase-js";
import { getDB, camelize } from "~/db";
import {
  bookings,
  pitches,
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
import { BookingListView } from "~/components/admin/booking-list-view";
import { BookingTimelineView } from "~/components/admin/booking-timeline-view";
import { cn } from "@qwik-ui/utils";

// New Components
import { Modal, Button } from "~/components/ui";
import { CalendarToolbar } from "~/components/admin/calendar/CalendarToolbar";
import { CalendarWeekView } from "~/components/admin/calendar/CalendarWeekView";
import { CalendarMonthView } from "~/components/admin/calendar/CalendarMonthView";
import { BookingDetailsModal } from "~/components/admin/calendar/BookingDetailsModal";
import { CreateBookingModal } from "~/components/admin/calendar/CreateBookingModal";
import { PrintDayView } from "~/components/admin/calendar/PrintDayView";

import {
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  getBAFormatDate,
  getBADayOfWeek,
  getBAHoursAndMinutes,
  playNotificationBeep,
  toBALocalISOString,
  parseDatabaseDate,
} from "./utils";


export const useUpdateBookingStatusAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    // Fetch current booking
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

    // Handle Transfer Logic
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
        // TRANSFER_CUSTOM
        if (!data.newDate || !data.newStartTime || !data.newEndTime) {
          return {
            success: false,
            message: "Datos de transferencia incompletos.",
          };
        }
        // Assuming date is in YYYY-MM-DD format
        newStart = new Date(`${data.newDate}T${data.newStartTime}:00-03:00`);
        newEnd = new Date(`${data.newDate}T${data.newEndTime}:00-03:00`);
      }

      // Check conflict including overlaps
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

    // Handle Cancellation with Refund
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

        // Record expense in cash register
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

        // Mark as cancelled and reset paid amount
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

    // Standard status update
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

    // Parse start date
    const startDate = new Date(`${data.date}T12:00:00-03:00`);

    // Parse end date if recurring. Without an explicit end date the
    // subscription uses the rolling horizon and is later extended weekly
    // by /api/cron/subscriptions.
    let endDate = startDate;
    if (data.isSubscription) {
      if (data.endDate) {
        endDate = new Date(`${data.endDate}T12:00:00-03:00`);

        const maxDate = new Date(startDate);
        maxDate.setFullYear(maxDate.getFullYear() + 1);

        if (endDate > maxDate) {
          endDate = maxDate; // Limit to 1 year max
        }

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

    // Generate all dates
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
      schedulesWithIds = parsedSchedules.map(s => ({...s, subId: crypto.randomUUID()}));

      if (schedulesWithIds.length === 0) {
        return {
          success: false,
          failed: true,
          message:
            "Debe seleccionar al menos un día de la semana para el turno fijo.",
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
          break; // Single booking only
        }
      }
    }

    const firstBookingId = crypto.randomUUID();
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

    // Handle guest registration if no userId provided but customer info exists
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
        // Create new guest user
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

    // Perform queries sequentially instead of inside a Drizzle transaction
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
    const skippedDates: string[] = [];
    let bookingsCount = 0;

    for (let i = 0; i < datesToBook.length; i++) {
      const item = datesToBook[i];
      const startDateTime = new Date(`${item.date}T${item.startTime}:00-03:00`);
      const endDateTime = new Date(`${item.date}T${item.endTime}:00-03:00`);
      // The first successfully created booking carries the payment info
      const isFirstCreated = bookingsCount === 0;
      const bookingId = isFirstCreated ? firstBookingId : crypto.randomUUID();

      // Validate operating hours
      const holidaysList = (settings?.holidays as any[]) || [];
      const isHoliday = holidaysList.some((h: any) => h.date === item.date);
      const dayOfWeek = isHoliday ? 7 : getBADayOfWeek(startDateTime);
      const schedule = operatingHours.find((h: any) => h.day === dayOfWeek);

      if (!schedule || schedule.isClosed) {
        if (data.isSubscription) {
          skippedDates.push(item.date);
          continue;
        }
        throw new Error(
          `El club está cerrado el día seleccionado (${item.date}).`,
        );
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
          skippedDates.push(item.date);
          continue;
        }
        throw new Error(
          `El horario seleccionado (${item.startTime} - ${item.endTime}) está fuera del horario de atención del club para el día ${item.date}.`,
        );
      }

      // Check conflict including overlaps
      const { available, conflicts } = await isPitchAvailable(db, {
        pitchId: item.pitchId,
        startTime: startDateTime,
        endTime: endDateTime,
      });

      if (!available) {
        if (data.isSubscription) {
          skippedDates.push(item.date);
          continue;
        }
        throw new Error(
          `Conflicto de horario: ${item.date} ${item.startTime} - ${item.endTime} en ${conflicts[0].pitch.name}.`,
        );
      }

      bookingsToInsert.push({
        id: bookingId,
        user_id: finalUserId,
        pitch_id: item.pitchId,
        start_time: toBALocalISOString(startDateTime),
        end_time: toBALocalISOString(endDateTime),
        status: "CONFIRMED",
        total_price: item.price,
        paid_amount: isFirstCreated ? Number(data.paidAmount) || 0 : 0,
        payment_status: isFirstCreated
          ? data.paymentStatus ||
            ((Number(data.paidAmount) || 0) >= Number(data.price)
              ? "PAID"
              : (Number(data.paidAmount) || 0) > 0
                ? "PARTIAL"
                : "PENDING")
          : "PENDING",
        payment_method: data.paymentMethod,
        is_subscription: data.isSubscription,
        booking_type:
          data.bookingType || (data.isSubscription ? "FIXED" : "EVENTUAL"),
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

      if (isFirstCreated && firstPaidAmount > 0 && openRegisterId) {
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

      // Add to in-memory to prevent conflicts within the same batch
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

    // If it's a subscription, we should insert the pitchSubscriptions records too
    if (data.isSubscription) {
      if (schedulesWithIds.length > 0) {
        const subsToInsert = schedulesWithIds.map(s => ({
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
          skippedDates.length > 0
            ? `No se pudo crear ninguna reserva: todas las fechas (${skippedDates.length}) tienen conflicto de horario o el club está cerrado.`
            : "No se pudo crear ninguna reserva. Verifique conflictos de horario.",
      };
    }

    return {
      success: true,
      bookingId: firstBookingId,
      skippedDates,
      message:
        `Se crearon ${bookingsCount} reservas.` +
        (skippedDates.length > 0
          ? ` ${skippedDates.length} fechas no se generaron por conflicto: ${skippedDates.join(", ")}.`
          : ""),
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
        message:
          "No hay una caja abierta. Abre la caja antes de registrar el pago.",
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
    const newPaymentStatus =
      newPaidAmount >= booking.totalPrice ? "PAID" : "PARTIAL";

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

    // 1. Update booking status to ATTENDED
    const { error: updBookErr } = await db
      .from(bookings)
      .update({ status: "ATTENDED" })
      .eq("id", booking.id);

    if (updBookErr) throw updBookErr;

    // 2. Generate debt transaction in the customer's current account if there is a group and unpaid balance
    if (booking.groupId) {
      const debtAmount = booking.totalPrice - booking.paidAmount;
      if (debtAmount > 0) {
        // Insert debt charge in group transactions
        const { error: insTxErr } = await db.from(groupTransactions).insert({
          id: crypto.randomUUID(),
          group_id: booking.groupId,
          type: "CHARGE",
          amount: debtAmount,
          description: `Turno asistido: ${booking.id.slice(0, 8)}`,
          booking_id: booking.id,
        });

        if (insTxErr) throw insTxErr;

        // Deduct from group balance to increase debt
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
export const fetchRealtimeBookingDetails = server$(async function (bookingId: string, userId: string | null) {
  const adminId = this.cookie.get("auth_session")?.value;
  if (!adminId) {
    throw new Error("Unauthorized");
  }
  const db = getDB(this);

  let user = null;
  if (userId) {
    const { data: userData } = await db
      .from(users)
      .select("id, name, phone")
      .eq("id", userId)
      .maybeSingle();
    if (userData) {
      user = camelize<any>(userData);
    }
  }

  let guest = null;
  const { data: guestData } = await db
    .from(guestRequests)
    .select("id, booking_id, name, phone")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (guestData) {
    guest = camelize<any>(guestData);
  }

  return { user, guest };
});

export const useCalendarData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const dateStr = requestEvent.url.searchParams.get("date");
  const viewStr = requestEvent.url.searchParams.get("view") || "day"; // "day", "week", "month"

  if (!dateStr) {
    const todayStr = getBAFormatDate(new Date());
    throw requestEvent.redirect(302, `?date=${todayStr}&view=${viewStr}`);
  }

  // Auto-complete past bookings (excluding Cuenta Corriente turnos)
  const now = new Date();
  const { error: completeErr } = await db
    .from(bookings)
    .update({ status: "COMPLETED" })
    .eq("status", "CONFIRMED")
    .lt("end_time", toBALocalISOString(now))
    .not("payment_method", "in", '("CUENTA_CORRIENTE","CURRENT_ACCOUNT")');

  if (completeErr) throw completeErr;

  const { data: settingsData, error: settingsErr } = await db
    .from(siteSettings)
    .select("*")
    .maybeSingle();

  if (settingsErr) throw settingsErr;
  const settings = camelize<any>(settingsData);

  const extraServices = (settings?.extraServices || []) as {
    name: string;
    price: number;
    icon: string;
  }[];

  const { data: openRegisterData, error: regErr } = await db
    .from(cashRegisters)
    .select("*")
    .eq("status", "OPEN")
    .maybeSingle();

  if (regErr) throw regErr;
  const openRegister = camelize<any>(openRegisterData);

  // Create selectedDate in BA timezone (UTC-3)
  const selectedDate = new Date(`${dateStr}T12:00:00-03:00`);

  let startDate: Date;
  let endDate: Date;

  if (viewStr === "week") {
    startDate = getStartOfWeek(selectedDate);
    endDate = getEndOfWeek(selectedDate);
    // Adjust week boundaries to BA time if they were created in local time
    startDate = new Date(`${getBAFormatDate(startDate)}T00:00:00-03:00`);
    endDate = new Date(`${getBAFormatDate(endDate)}T23:59:59-03:00`);
  } else if (viewStr === "month") {
    startDate = getStartOfMonth(selectedDate);
    endDate = getEndOfMonth(selectedDate);
    // Adjust month boundaries to BA time
    startDate = new Date(`${getBAFormatDate(startDate)}T00:00:00-03:00`);
    endDate = new Date(`${getBAFormatDate(endDate)}T23:59:59-03:00`);
  } else {
    // Day view - explicitly in BA time
    startDate = new Date(`${dateStr}T00:00:00-03:00`);
    endDate = new Date(`${dateStr}T23:59:59-03:00`);
  }

  const { data: pitchesData, error: pitchesErr } = await db
    .from(pitches)
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (pitchesErr) throw pitchesErr;
  const pitchesRaw = camelize<any[]>(pitchesData || []);

  const { data: pricingRulesData, error: pricingErr } = await db
    .from("pitch_pricing_rules")
    .select("*");

  if (pricingErr) throw pricingErr;
  const pricingRulesRaw = camelize<any[]>(pricingRulesData || []);

  const { data: overlapsData, error: overlapsErr } = await db
    .from("pitch_overlaps")
    .select("*");

  if (overlapsErr) throw overlapsErr;
  const overlapsRaw = camelize<any[]>(overlapsData || []);

  const allPitches = pitchesRaw.map((p) => {
    const pricingRules = pricingRulesRaw.filter((rule) => rule.pitchId === p.id);
    const overlaps = overlapsRaw.filter((o) => o.pitchId === p.id);
    const overlappedBy = overlapsRaw.filter((o) => o.overlapPitchId === p.id);

    const overlapIds = new Set<string>();
    overlaps.forEach((o: any) => overlapIds.add(o.overlapPitchId));
    overlappedBy.forEach((o: any) => overlapIds.add(o.pitchId));

    return {
      ...p,
      pricingRules,
      overlaps,
      overlappedBy,
      overlapPitchIds: Array.from(overlapIds),
    };
  });

  let dailyBookings: any = [];
  const monthCounts: Record<string, number> = {};

  if (viewStr === "month") {
    // Optimized month query: only get IDs and start times
    const { data: allMonthBookingsData, error: monthErr } = await db
      .from(bookings)
      .select("id, start_time")
      .gte("start_time", toBALocalISOString(startDate))
      .lte("start_time", toBALocalISOString(endDate));

    if (monthErr) throw monthErr;
    const allMonthBookings = camelize<any[]>(allMonthBookingsData || []);

    for (const b of allMonthBookings) {
      const parsedStart = parseDatabaseDate(b.startTime);
      const dStr = getBAFormatDate(parsedStart);
      monthCounts[dStr] = (monthCounts[dStr] || 0) + 1;
    }
  } else {
    // Normal query for day/week
    const { data: bookingsData, error: bookingsErr } = await db
      .from(bookings)
      .select("*")
      .gte("start_time", toBALocalISOString(startDate))
      .lte("start_time", toBALocalISOString(endDate));

    if (bookingsErr) throw bookingsErr;

    const sanitizedBookings = (bookingsData || []).map((b: any) => ({
      ...b,
      start_time: parseDatabaseDate(b.start_time).toISOString(),
      end_time: parseDatabaseDate(b.end_time).toISOString(),
    }));

    const bookingsRaw = camelize<any[]>(sanitizedBookings);

    if (bookingsRaw.length > 0) {
      const userIds = Array.from(new Set(bookingsRaw.map((b) => b.userId).filter(Boolean)));
      const bookingIds = bookingsRaw.map((b) => b.id);

      const { data: usersData, error: usersErr } = await db
        .from(users)
        .select("id, name, phone")
        .in("id", userIds);

      if (usersErr) throw usersErr;
      const usersRaw = camelize<any[]>(usersData || []);

      const { data: guestsData, error: guestsErr } = await db
        .from(guestRequests)
        .select("id, booking_id, name, phone")
        .in("booking_id", bookingIds);

      if (guestsErr) throw guestsErr;
      const guestsRaw = camelize<any[]>(guestsData || []);

      dailyBookings = bookingsRaw.map((b) => {
        const u = usersRaw.find((usr) => usr.id === b.userId) || null;
        const g = guestsRaw.find((gst) => gst.bookingId === b.id) || null;
        return {
          booking: b,
          user: u,
          guest: g,
        };
      });
    }
  }

  // Inject School Classes (Virtual Bookings)
  if (settings && settings.schoolCategories) {
    const schoolCategories = settings.schoolCategories as any[];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = getBADayOfWeek(currentDate);
      const dateStr = getBAFormatDate(currentDate);

      for (const cat of schoolCategories) {
        if (cat.schedules) {
          for (const sched of cat.schedules) {
            if (
              sched.day === dayOfWeek &&
              sched.pitchId &&
              sched.startTime &&
              sched.endTime
            ) {
              if (viewStr === "month") {
                monthCounts[dateStr] = (monthCounts[dateStr] || 0) + 1;
              } else {
                // Keep BA offset semantics
                const startDateTime = new Date(`${dateStr}T${sched.startTime.padStart(5, "0")}:00-03:00`);
                const endDateTime = new Date(`${dateStr}T${sched.endTime.padStart(5, "0")}:00-03:00`);

                dailyBookings.push({
                  booking: {
                    id: `school-${cat.id}-${dateStr}`,
                    pitchId: sched.pitchId,
                    startTime: startDateTime,
                    endTime: endDateTime,
                    status: "CONFIRMED",
                    totalPrice: 0,
                    paidAmount: 0,
                    paymentStatus: "PAID",
                    isSubscription: true,
                    bookingType: "SCHOOL",
                    isSchool: true, // Identify as school for UI
                  },
                  user: {
                    id: "school",
                    name: `Esc. ${cat.name}`,
                    phone: null,
                  },
                  guest: null,
                });
              }
            }
          }
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  const prevDate = new Date(selectedDate);
  const nextDate = new Date(selectedDate);

  if (viewStr === "week") {
    prevDate.setDate(prevDate.getDate() - 7);
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (viewStr === "month") {
    prevDate.setMonth(prevDate.getMonth() - 1);
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else {
    prevDate.setDate(prevDate.getDate() - 1);
    nextDate.setDate(nextDate.getDate() + 1);
  }

  return {
    selectedDateStr: getBAFormatDate(selectedDate),
    todayStr: getBAFormatDate(new Date()),
    prevDateStr: getBAFormatDate(prevDate),
    nextDateStr: getBAFormatDate(nextDate),
    view: viewStr,
    pitches: allPitches,
    bookings: dailyBookings,
    monthCounts: monthCounts,
    startDateStr: startDate.toISOString(),
    endDateStr: endDate.toISOString(),
    extraServices,
    settings: settings
      ? {
          id: settings.id,
          clubName: settings.clubName,
          clubAddress: settings.clubAddress,
          clubPhone: settings.clubPhone,
          bankAlias: settings.bankAlias,
          extraServices: (settings.extraServices || []) as any[],
          operatingHours: (settings.operatingHours || []) as any[],
          services: (settings.services || []) as string[],
          galleryImages: (settings.galleryImages || []) as string[],
          schoolCategories: (settings.schoolCategories || []) as any[],
          paymentMethods: (settings.paymentMethods || []) as {
            id: string;
            name: string;
            isActive: boolean;
          }[],
          holidays: (settings.holidays || []) as any[],
        }
      : null,
    openRegister: openRegister
      ? {
          id: openRegister.id,
          openedAt: new Date(openRegister.openedAt).toISOString(),
        }
      : null,
  };
});

export const getAdminDailyBookings = server$(async function (
  pitchId: string,
  dateStr: string,
) {
  const db = getDB(this);
  if (!pitchId || !dateStr) return [];
  const startOfDay = new Date(`${dateStr}T00:00:00-03:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59-03:00`);

  // Get related pitch IDs (bidirectional)
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

export default component$(() => {
  const calendarData = useCalendarData();
  const updateStatusAction = useUpdateBookingStatusAction();
  const createBookingAction = useCreateAdminBookingAction();
  const addPaymentAction = useAddBookingPaymentAction();
  const confirmAttendanceAction = useConfirmAttendanceAction();
  const nav = useNavigate();
  const isSoundEnabled = useSignal(false);
  const localBookings = useSignal<any[]>([]);

  useTask$(({ track }) => {
    const b = track(() => calendarData.value.bookings);
    localBookings.value = [...(b || [])];
  });

  useStyles$(`
    @media print {
      @page { size: A4 landscape; margin: 10mm; }
      body * { visibility: hidden; }
      .print-area, .print-area * { visibility: visible; }
      .print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        border: none !important;
        box-shadow: none !important;
        background: #fff !important;
      }
      .no-print { display: none !important; }
      .print-day-view, .print-day-view * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }

    /* Print day view styles (also used as on-screen preview) */
    .print-day-view {
      color: #0f172a;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      background: #fff;
      padding: 4mm;
    }
    .print-day-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .print-day-club { font-size: 16px; font-weight: 900; letter-spacing: -0.01em; }
    .print-day-club-sub { font-size: 10px; color: #475569; }
    .print-day-header-right { text-align: right; }
    .print-day-date {
      font-size: 14px;
      font-weight: 800;
      text-transform: capitalize;
    }
    .print-day-meta { font-size: 9px; color: #64748b; }

    .print-day-grid-wrap {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .print-day-grid {
      display: grid;
      grid-template-rows: 26px auto;
      width: 100%;
    }
    .print-day-corner {
      background: #f1f5f9;
      border-right: 1px solid #e2e8f0;
      border-bottom: 1.5px solid #cbd5e1;
    }
    .print-day-pitch-head {
      background: #f1f5f9;
      border-right: 1px solid #e2e8f0;
      border-bottom: 1.5px solid #cbd5e1;
      text-align: center;
      padding: 2px;
    }
    .print-day-pitch-head:last-child { border-right: 0; }
    .print-day-pitch-name { font-size: 11px; font-weight: 800; }
    .print-day-pitch-sub { font-size: 8px; color: #64748b; font-weight: 700; }

    .print-day-hours {
      position: relative;
      border-right: 1px solid #e2e8f0;
      background: #fff;
    }
    .print-day-hour-label {
      position: absolute;
      right: 4px;
      transform: translateY(-50%);
      font-size: 9px;
      font-weight: 700;
      color: #94a3b8;
    }
    .print-day-col {
      position: relative;
      border-right: 1px solid #e2e8f0;
    }
    .print-day-col:last-child { border-right: 0; }
    .print-day-gridline {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 1px dashed #e2e8f0;
    }
    .print-day-booking {
      position: absolute;
      left: 2px;
      right: 2px;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-left: 3px solid #3b82f6;
      border-radius: 3px;
      padding: 2px 4px;
      overflow: hidden;
      font-size: 9px;
    }
    .print-day-booking-time { font-weight: 700; color: #334155; font-size: 8px; }
    .print-day-booking-tag {
      display: inline-block;
      background: #f1f5f9;
      color: #475569;
      padding: 0 3px;
      border-radius: 2px;
      font-size: 7px;
      font-weight: 800;
      margin-left: 2px;
    }
    .print-day-booking-name {
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .print-day-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 9px;
      color: #475569;
      margin: 4px 0 8px;
    }
    .print-day-legend span { display: inline-flex; align-items: center; gap: 4px; }
    .print-day-legend i {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
    .print-day-legend-note { font-style: italic; color: #64748b; }

    .print-day-detail-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 3px;
      color: #334155;
    }
    .print-day-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .print-day-table th {
      text-align: left;
      background: #f1f5f9;
      padding: 3px 6px;
      border-bottom: 1px solid #cbd5e1;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 8px;
      color: #475569;
      letter-spacing: 0.04em;
    }
    .print-day-table td {
      padding: 3px 6px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .print-day-row-school td { color: #9a3412; background: #fff7ed; }
    .print-day-row-tag {
      background: #e2e8f0;
      color: #334155;
      padding: 0 3px;
      border-radius: 2px;
      font-size: 8px;
      font-weight: 800;
    }
    .print-day-paid { font-weight: 800; color: #047857; }
    .print-day-owes { font-weight: 800; color: #b45309; }
    .print-day-empty { padding: 16px; color: #94a3b8; font-style: italic; }

    .print-day-totals {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1.5px solid #0f172a;
      font-size: 10px;
    }
    .print-day-totals span { margin-right: 10px; }
    .print-day-totals strong { font-size: 11px; }
  `);

  // Layout mode: 'timeline' (pitches×time) | 'list' (table)
  const layoutMode = useSignal<"timeline" | "list">("timeline");

  const clubSettings = calendarData.value.settings;

  const operatingHours = (() => {
    try {
      if (typeof clubSettings?.operatingHours === "string")
        return JSON.parse(clubSettings.operatingHours);
      if (Array.isArray(clubSettings?.operatingHours))
        return clubSettings.operatingHours;
      return [];
    } catch {
      return [];
    }
  })();

  const isHoliday = (clubSettings as any)?.holidays?.some(
    (h: any) => h.date === calendarData.value.selectedDateStr,
  );
  const dayOfWeek = isHoliday ? 7 : getBADayOfWeek(calendarData.value.selectedDateStr);

  const todaySchedule = operatingHours.find((h: any) => h.day === dayOfWeek);

  const CALENDAR_START_HOUR = todaySchedule?.openTime
    ? parseInt(todaySchedule.openTime.split(":")[0], 10) +
      parseInt(todaySchedule.openTime.split(":")[1] || "0", 10) / 60
    : 8;
  const CALENDAR_END_HOUR = todaySchedule?.closeTime
    ? parseInt(todaySchedule.closeTime.split(":")[0], 10) +
      parseInt(todaySchedule.closeTime.split(":")[1] || "0", 10) / 60
    : 23;
  const PIXELS_PER_HOUR = 140;

  const hours = Array.from(
    { length: Math.ceil(CALENDAR_END_HOUR - CALENDAR_START_HOUR) },
    (_, i) => CALENDAR_START_HOUR + i,
  );

  // Current Time Indicator Logic
  const currentTimePosition = useSignal(0);
  const showCurrentTimeLine = useSignal(false);
  const scrollContainerRef = useSignal<HTMLElement>();

  // Modal State
  const isModalOpen = useSignal(false);
  const selectedBookingId = useSignal("");
  const isCreateModalOpen = useSignal(false);
  const isPrintModalOpen = useSignal(false);

  // Admin create form state
  const adminFormPitchId = useSignal("");
  const adminFormDate = useSignal("");
  const adminFormTime = useSignal("");
  const adminFormDuration = useSignal("60");
  const adminIsSubscription = useSignal(false);
  const adminBookingType = useSignal<
    "EVENTUAL" | "FIXED" | "BIRTHDAY" | "TOURNAMENT" | "SCHOOL"
  >("EVENTUAL");
  const adminEndDate = useSignal("");
  const adminNotes = useSignal("");
  const adminOccupiedSlots = useSignal<
    { startTime: string; endTime: string }[]
  >([]);
  const adminIsChecking = useSignal(false);

  const adminSubSchedules = useStore<{
    slots: {
      id: string;
      dayOfWeek: number;
      startTime: string;
      duration: string;
      pitchId: string;
    }[];
  }>({
    slots: [],
  });

  // Search user state
  const adminSearchTerm = useSignal("");
  const adminSearchResults = useSignal<any[]>([]);
  const adminSelectedUserId = useSignal("");
  const adminSelectedUserName = useSignal("");
  const adminSelectedUserPhone = useSignal("");
  const adminSelectedUserEmail = useSignal("");
  const adminIsSearching = useSignal(false);

  // Pricing & Extras
  const adminApplyDiscount = useSignal(false);
  const adminDiscountAmount = useSignal<number | "">(0);
  const adminDiscountType = useSignal<"FIXED" | "PERCENTAGE">("FIXED");
  const adminSelectedExtras = useSignal<string[]>([]);
  const adminIsFullPayment = useSignal(false);
  const adminPaidAmount = useSignal<number | "">("");

  const handleBookingClick = $((id: string) => {
    selectedBookingId.value = id;
    isModalOpen.value = true;
  });

  const selectedBookingDetails = localBookings.value.find(
    (b: any) => b.booking?.id === selectedBookingId.value,
  );

  const selectedDateStr = calendarData.value.selectedDateStr;
  const view = calendarData.value.view;
  const startDateStr = calendarData.value.startDateStr;
  const endDateStr = calendarData.value.endDateStr;

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const updateTimeIndicator = () => {
      const now = new Date();
      const isToday = getBAFormatDate(now) === selectedDateStr;

      let shouldShow = false;
      if (view === "day" && isToday) shouldShow = true;
      if (view === "week") {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        if (now >= start && now <= end) shouldShow = true;
      }

      showCurrentTimeLine.value = shouldShow;

      if (shouldShow) {
        const hoursObj = now.getHours() + now.getMinutes() / 60;
        currentTimePosition.value =
          (hoursObj - CALENDAR_START_HOUR) * PIXELS_PER_HOUR;
      }
    };

    updateTimeIndicator();

    if (scrollContainerRef.value && showCurrentTimeLine.value) {
      setTimeout(() => {
        const container = scrollContainerRef.value;
        if (container) {
          const containerHeight = container.clientHeight;
          container.scrollTo({
            top: Math.max(0, currentTimePosition.value - containerHeight / 2),
            behavior: "smooth",
          });
        }
      }, 100);
    }

    const interval = setInterval(updateTimeIndicator, 60000);
    cleanup(() => clearInterval(interval));
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const successUpdate = track(() => updateStatusAction.value?.success);
    if (successUpdate) isModalOpen.value = false;

    const successCreate = track(() => createBookingAction.value?.success);
    if (successCreate) {
      isCreateModalOpen.value = false;
      adminFormDate.value = "";
      adminFormTime.value = "";
      adminOccupiedSlots.value = [];
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const stored = localStorage.getItem("calendar_sound_enabled");
    if (stored !== null) {
      isSoundEnabled.value = stored === "true";
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const val = track(() => isSoundEnabled.value);
    localStorage.setItem("calendar_sound_enabled", String(val));
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    
    console.log("[Realtime SDK] Initializing realtime subscription...");
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[Realtime SDK] Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY env variables on the client!");
      return;
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const mapDbBookingToEntry = async (raw: any) => {
      const b = {
        id: raw.id,
        userId: raw.user_id,
        pitchId: raw.pitch_id,
        startTime: parseDatabaseDate(raw.start_time).toISOString(),
        endTime: parseDatabaseDate(raw.end_time).toISOString(),
        status: raw.status,
        totalPrice: Number(raw.total_price) || 0,
        paidAmount: Number(raw.paid_amount) || 0,
        paymentStatus: raw.payment_status,
        paymentMethod: raw.payment_method,
        isSubscription: !!raw.is_subscription,
        bookingType: raw.booking_type,
        notes: raw.notes,
        extras: raw.extras,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      };

      try {
        const details = await fetchRealtimeBookingDetails(b.id, b.userId);
        return { booking: b, user: details.user, guest: details.guest };
      } catch (err) {
        console.error("[Realtime SDK] Failed to fetch booking details:", err);
        return { booking: b, user: null, guest: null };
      }
    };

    const channel = supabaseClient
      .channel("bookings-realtime-admin")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
        },
        async (payload) => {
          console.log("[Realtime SDK] Event received:", payload);

          if (payload.eventType === "INSERT") {
            if (isSoundEnabled.value) {
              playNotificationBeep();
            }

            const entry = await mapDbBookingToEntry(payload.new);
            
            // Check if within current view range
            const bookingDate = new Date(entry.booking.startTime);
            const viewStart = new Date(calendarData.value.startDateStr);
            const viewEnd = new Date(calendarData.value.endDateStr);
            if (bookingDate >= viewStart && bookingDate <= viewEnd) {
              if (!localBookings.value.some((item) => item.booking.id === entry.booking.id)) {
                localBookings.value = [
                  ...localBookings.value,
                  entry,
                ];
              }
            }
          } else if (payload.eventType === "UPDATE") {
            const entry = await mapDbBookingToEntry(payload.new);
            
            const bookingDate = new Date(entry.booking.startTime);
            const viewStart = new Date(calendarData.value.startDateStr);
            const viewEnd = new Date(calendarData.value.endDateStr);

            if (bookingDate >= viewStart && bookingDate <= viewEnd) {
              const exists = localBookings.value.some((item) => item.booking.id === entry.booking.id);
              if (exists) {
                localBookings.value = localBookings.value.map((item) => 
                  item.booking.id === entry.booking.id ? entry : item
                );
              } else {
                localBookings.value = [
                  ...localBookings.value,
                  entry,
                ];
              }
            } else {
              localBookings.value = localBookings.value.filter(
                (item) => item.booking.id !== entry.booking.id
              );
            }
          } else if (payload.eventType === "DELETE") {
            const deletedRaw = payload.old as any;
            localBookings.value = localBookings.value.filter(
              (item) => item.booking.id !== deletedRaw.id
            );
          }
        }
      )
      .subscribe((status, err) => {
        console.log("[Realtime SDK] Subscription status:", status, err || "");
      });

    cleanup(() => {
      supabaseClient.removeChannel(channel);
    });
  });

  const handleNewBooking = $(() => {
    adminFormPitchId.value = "";
    adminFormDate.value = calendarData.value.selectedDateStr;
    adminFormTime.value = "";
    adminFormDuration.value = "60";
    adminIsSubscription.value = false;
    adminEndDate.value = "";
    adminNotes.value = "";
    adminDiscountAmount.value = "";
    adminDiscountType.value = "FIXED";
    adminSelectedExtras.value = [];
    adminSelectedUserId.value = "";
    adminSelectedUserName.value = "";
    adminSelectedUserPhone.value = "";
    adminSelectedUserEmail.value = "";
    adminIsFullPayment.value = false;
    adminPaidAmount.value = "";
    isCreateModalOpen.value = true;
  });

  const handleViewChange = $((newView: string) => {
    nav(`?date=${selectedDateStr}&view=${newView}`);
  });

  // Remove useTask$ for grid forcing

  // Generate days for Week View
  const weekDays = useComputed$(() => {
    const days = [];
    if (view === "week") {
      const current = new Date(startDateStr);
      const end = new Date(endDateStr);
      while (current <= end) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }
    return days;
  });

  // Generate days for Month View
  const monthDays = useComputed$(() => {
    const days = [];
    if (view === "month") {
      const current = new Date(startDateStr);
      while (current.getDay() !== 1) current.setDate(current.getDate() - 1);
      const startRender = new Date(current);

      const endMonth = new Date(endDateStr);
      while (endMonth.getDay() !== 0) endMonth.setDate(endMonth.getDate() + 1);

      const renderCursor = new Date(startRender);
      while (renderCursor <= endMonth) {
        days.push(new Date(renderCursor));
        renderCursor.setDate(renderCursor.getDate() + 1);
      }
    }
    return days;
  });

  return (
    <div class="flex h-full flex-col overflow-hidden bg-slate-50 font-sans text-slate-900">
      <CalendarToolbar
        calendarData={calendarData.value}
        layoutMode={layoutMode}
        isCreateModalOpen={isCreateModalOpen}
        isPrintModalOpen={isPrintModalOpen}
        isSoundEnabled={isSoundEnabled}
        onViewChange$={handleViewChange}
        onNewBooking$={handleNewBooking}
      />

      {calendarData.value.view === "day" ? (
        layoutMode.value === "list" ? (
          <main class="flex-1 overflow-auto p-6">
            <div class="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <BookingListView
                pitches={calendarData.value.pitches}
                bookings={localBookings.value as any}
                onBookingClick$={handleBookingClick}
              />
            </div>
          </main>
        ) : (
          <main class="flex-1 overflow-auto p-6">
            <div class="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <BookingTimelineView
                pitches={calendarData.value.pitches}
                bookings={localBookings.value as any}
                slotMinutes={30}
                startHour={CALENDAR_START_HOUR}
                endHour={CALENDAR_END_HOUR}
                onBookingClick$={handleBookingClick}
                onEmptySlotDragEnd$={(pitchId, time, duration) => {
                  adminFormPitchId.value = pitchId;
                  adminFormDate.value = getBAFormatDate(
                    new Date(selectedDateStr + "T12:00:00-03:00"),
                  );
                  adminFormTime.value = time;
                  adminFormDuration.value = String(duration);
                  adminIsSubscription.value = false;
                  adminEndDate.value = "";
                  adminNotes.value = "";
                  adminDiscountAmount.value = "";
                  adminDiscountType.value = "FIXED";
                  adminSelectedExtras.value = [];
                  isCreateModalOpen.value = true;
                }}
              />
            </div>
          </main>
        )
      ) : (
        <main class="relative flex-1 overflow-auto p-6">
          <div
            class={cn(
              "flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
              calendarData.value.view !== "month"
                ? "min-w-[900px]"
                : "min-w-[700px]",
            )}
          >
            {calendarData.value.view === "week" && (
              <CalendarWeekView
                calendarData={calendarData.value}
                weekDays={weekDays.value}
                hours={hours}
                pixelsPerHour={PIXELS_PER_HOUR}
                calendarStartHour={CALENDAR_START_HOUR}
                showCurrentTimeLine={showCurrentTimeLine}
                currentTimePosition={currentTimePosition}
                scrollContainerRef={scrollContainerRef}
                onBookingClick$={handleBookingClick}
                onEmptySlotClick$={(pitchId, time) => {
                  adminFormPitchId.value = pitchId;
                  adminFormDate.value = selectedDateStr;
                  adminFormTime.value = time;
                  adminFormDuration.value = "60";
                  isCreateModalOpen.value = true;
                }}
              />
            )}
            {calendarData.value.view === "month" && (
              <CalendarMonthView
                calendarData={calendarData.value}
                monthDays={monthDays.value}
                onDayClick$={(dateStr) => {
                  nav(`?date=${dateStr}&view=day`);
                }}
              />
            )}
          </div>
        </main>
      )}

      <BookingDetailsModal
        isModalOpen={isModalOpen}
        selectedBookingDetails={selectedBookingDetails}
        calendarData={calendarData.value}
        addPaymentAction={addPaymentAction}
        updateStatusAction={updateStatusAction}
        confirmAttendanceAction={confirmAttendanceAction}
      />

      {/* Modal para Imprimir Agenda */}
      <Modal.Root bind:show={isPrintModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-8">
            <div class="no-print mb-6 flex items-center justify-between">
              <h3 class="flex items-center gap-2 text-xl font-black text-slate-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Imprimir Agenda del Día
              </h3>
              <button
                onClick$={() => (isPrintModalOpen.value = false)}
                class="p-2 text-slate-400 hover:text-slate-600"
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

            <div class="print-area max-h-[70vh] overflow-auto rounded-2xl border shadow-sm">
              <PrintDayView
                selectedDateStr={calendarData.value.selectedDateStr}
                bookings={localBookings.value}
                pitches={calendarData.value.pitches}
                settings={calendarData.value.settings}
                todaySchedule={todaySchedule}
              />
            </div>

            <div class="no-print mt-8 flex justify-end gap-3">
              <Button
                onClick$={() => (isPrintModalOpen.value = false)}
                look="ghost"
                class="font-bold text-slate-500"
              >
                Cancelar
              </Button>
              <Button
                onClick$={() => {
                  window.print();
                  isPrintModalOpen.value = false;
                }}
                class="flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-3 font-black text-white shadow-lg transition-all hover:bg-slate-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Imprimir Ahora
              </Button>
            </div>
          </div>
        </Modal.Panel>
      </Modal.Root>

      <CreateBookingModal
        isCreateModalOpen={isCreateModalOpen}
        calendarData={calendarData.value}
        createBookingAction={createBookingAction}
        adminFormPitchId={adminFormPitchId}
        adminFormDate={adminFormDate}
        adminFormTime={adminFormTime}
        adminFormDuration={adminFormDuration}
        adminIsSubscription={adminIsSubscription}
        adminBookingType={adminBookingType}
        adminEndDate={adminEndDate}
        adminNotes={adminNotes}
        adminOccupiedSlots={adminOccupiedSlots}
        adminIsChecking={adminIsChecking}
        adminSubSchedules={adminSubSchedules}
        adminSearchTerm={adminSearchTerm}
        adminSearchResults={adminSearchResults}
        adminSelectedUserId={adminSelectedUserId}
        adminSelectedUserName={adminSelectedUserName}
        adminSelectedUserPhone={adminSelectedUserPhone}
        adminSelectedUserEmail={adminSelectedUserEmail}
        adminIsSearching={adminIsSearching}
        adminApplyDiscount={adminApplyDiscount}
        adminDiscountAmount={adminDiscountAmount}
        adminDiscountType={adminDiscountType}
        adminSelectedExtras={adminSelectedExtras}
        adminIsFullPayment={adminIsFullPayment}
        adminPaidAmount={adminPaidAmount}
      />
    </div>
  );
});

export const head = {
  title: "Reservas - GardenClubFutbol",
};
