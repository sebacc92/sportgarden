import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  useComputed$,
  useStore,
  useStyles$,
} from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  zod$,
  z,
  useNavigate,
  server$,
} from "@builder.io/qwik-city";
import { getDB } from "~/db";
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
} from "~/db/schema";
import { eq, and, gte, lte, lt, inArray, notInArray } from "drizzle-orm";
import { isPitchAvailable } from "~/utils/availability";
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

// Utilities
import {
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  getBAFormatDate,
} from "./utils";

export const useUpdateBookingStatusAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    // Fetch current booking
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, data.bookingId),
    });

    if (!booking) {
      return { success: false, message: "Reserva no encontrada." };
    }

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

      await db
        .update(bookings)
        .set({
          startTime: newStart,
          endTime: newEnd,
          status: "CONFIRMED",
        })
        .where(eq(bookings.id, booking.id));

      return { success: true, message: "Reserva transferida con éxito." };
    }

    // Handle Cancellation with Refund
    if (data.status === "CANCELLED" && data.cancellationOption === "RETURN") {
      if (booking.paidAmount > 0) {
        const openRegister = await db.query.cashRegisters.findFirst({
          where: eq(cashRegisters.status, "OPEN"),
        });

        if (!openRegister) {
          return {
            success: false,
            message: "No hay una caja abierta para realizar la devolución.",
          };
        }

        // Record expense in cash register
        await db.insert(cashMovements).values({
          id: crypto.randomUUID(),
          registerId: openRegister.id,
          type: "EXPENSE",
          category: "CANCELACION",
          amount: booking.paidAmount,
          description: `Devolución seña reserva anulada: ${booking.id.slice(0, 8)}`,
          paymentMethod: booking.paymentMethod as any,
          referenceId: booking.id,
        });

        // Mark as cancelled and reset paid amount
        await db
          .update(bookings)
          .set({
            status: "CANCELLED",
            paidAmount: 0,
            paymentStatus: "PENDING",
          })
          .where(eq(bookings.id, booking.id));

        return {
          success: true,
          message: "Reserva anulada y seña devuelta en caja.",
        };
      }
    }

    // Standard status update
    await db
      .update(bookings)
      .set({ status: data.status as any })
      .where(eq(bookings.id, data.bookingId));

    return { success: true };
  },
  zod$({
    bookingId: z.string(),
    status: z.enum(["PENDING_APPROVAL", "CONFIRMED", "CANCELLED", "COMPLETED"]),
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

    // Parse end date if recurring
    let endDate = startDate;
    if (data.isSubscription && data.endDate) {
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
    }

    // Generate all dates
    const datesToBook: {
      date: string;
      startTime: string;
      endTime: string;
      price: number;
      pitchId: string;
    }[] = [];
    const current = new Date(startDate);
    const globalPrice = Number(data.price);

    if (data.isSubscription && data.subscriptionSchedules) {
      const schedules = JSON.parse(data.subscriptionSchedules) as {
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        price: number;
        pitchId?: string;
      }[];
      if (schedules.length === 0) {
        return {
          success: false,
          failed: true,
          message:
            "Debe seleccionar al menos un día de la semana para el turno fijo.",
        };
      }

      while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek);

        for (const schedule of daySchedules) {
          datesToBook.push({
            date: current.toISOString().split("T")[0],
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            price: schedule.price,
            pitchId: schedule.pitchId || data.pitchId,
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
      const openRegister = await db.query.cashRegisters.findFirst({
        where: eq(cashRegisters.status, "OPEN"),
      });

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
      const existingUser = await db.query.users.findFirst({
        where: eq(users.phone, data.customerPhone),
      });

      if (existingUser) {
        finalUserId = existingUser.id;
      } else {
        // Create new guest user
        const newUserId = crypto.randomUUID();
        await db.insert(users).values({
          id: newUserId,
          name: data.customerName || "Invitado",
          phone: data.customerPhone,
          email: data.customerEmail || null,
          role: "GUEST",
        });
        finalUserId = newUserId;
      }
    }

    const settings = await db.query.siteSettings.findFirst();
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

    const results = await db.transaction(async (tx) => {
      // Fetch all existing bookings for the relevant period to check conflicts in-memory
      const allExistingBookings = await tx
        .select()
        .from(bookings)
        .where(
          and(
            inArray(
              bookings.pitchId,
              Array.from(new Set(datesToBook.map((d) => d.pitchId))),
            ),
            gte(bookings.startTime, startDate),
            lte(bookings.endTime, endDate),
          ),
        );

      const bookingsToInsert: any[] = [];
      const guestsToInsert: any[] = [];
      let bookingsCount = 0;

      for (let i = 0; i < datesToBook.length; i++) {
        const item = datesToBook[i];
        const startDateTime = new Date(`${item.date}T${item.startTime}:00-03:00`);
        const endDateTime = new Date(`${item.date}T${item.endTime}:00-03:00`);
        const bookingId = i === 0 ? firstBookingId : crypto.randomUUID();

        // Validate operating hours
        const holidaysList = (settings?.holidays as any[]) || [];
        const isHoliday = holidaysList.some((h: any) => h.date === item.date);
        const dayOfWeek = isHoliday ? 7 : startDateTime.getDay();
        const schedule = operatingHours.find((h: any) => h.day === dayOfWeek);

        if (!schedule || schedule.isClosed) {
          throw new Error(
            `El club está cerrado el día seleccionado (${item.date}).`,
          );
        }

        const startMins =
          startDateTime.getHours() * 60 + startDateTime.getMinutes();
        let endMins = endDateTime.getHours() * 60 + endDateTime.getMinutes();
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
          throw new Error(
            `El horario seleccionado (${item.startTime} - ${item.endTime}) está fuera del horario de atención del club para el día ${item.date}.`,
          );
        }

        // Check conflict including overlaps
        const { available, conflicts } = await isPitchAvailable(tx, {
          pitchId: item.pitchId,
          startTime: startDateTime,
          endTime: endDateTime,
        });

        if (!available) {
          throw new Error(
            `Conflicto de horario: ${item.date} ${item.startTime} - ${item.endTime} en ${conflicts[0].pitch.name}.`,
          );
        }

        bookingsToInsert.push({
          id: bookingId,
          userId: finalUserId,
          pitchId: item.pitchId,
          startTime: startDateTime,
          endTime: endDateTime,
          status: "CONFIRMED",
          totalPrice: item.price,
          paidAmount: i === 0 ? Number(data.paidAmount) || 0 : 0,
          paymentStatus:
            i === 0
              ? data.paymentStatus ||
                ((Number(data.paidAmount) || 0) >= Number(data.price)
                  ? "PAID"
                  : (Number(data.paidAmount) || 0) > 0
                    ? "PARTIAL"
                    : "PENDING")
              : "PENDING",
          paymentMethod: data.paymentMethod as any,
          isSubscription: data.isSubscription,
          bookingType:
            data.bookingType || (data.isSubscription ? "FIXED" : "EVENTUAL"),
          notes: data.notes || null,
          extras: data.extras ? JSON.parse(data.extras) : null,
        });

        if (!data.userId) {
          guestsToInsert.push({
            id: crypto.randomUUID(),
            bookingId: bookingId,
            name: data.customerName || "Invitado",
            phone: data.customerPhone || "",
            email: data.customerEmail || null,
          });
        }

        if (i === 0 && firstPaidAmount > 0 && openRegisterId) {
          await tx.insert(cashMovements).values({
            id: crypto.randomUUID(),
            registerId: openRegisterId,
            type: "INCOME",
            category: "BOOKING",
            amount: firstPaidAmount,
            description: `Pago reserva: ${data.customerName || "Invitado"}`,
            paymentMethod: data.paymentMethod as any,
            referenceId: bookingId,
          });
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
        // SQLite has a limit on parameters per insert, so we chunk if needed
        const CHUNK_SIZE = 50;
        for (let i = 0; i < bookingsToInsert.length; i += CHUNK_SIZE) {
          await tx
            .insert(bookings)
            .values(bookingsToInsert.slice(i, i + CHUNK_SIZE));
        }
      }

      if (guestsToInsert.length > 0) {
        const CHUNK_SIZE = 50;
        for (let i = 0; i < guestsToInsert.length; i += CHUNK_SIZE) {
          await tx
            .insert(guestRequests)
            .values(guestsToInsert.slice(i, i + CHUNK_SIZE));
        }
      }

      return { success: true, count: bookingsCount };
    });

    if (results.count === 0) {
      return {
        failed: true,
        message:
          "No se pudo crear ninguna reserva. Verifique conflictos de horario.",
      };
    }

    return {
      success: true,
      bookingId: firstBookingId,
      message: `Se crearon ${results.count} reservas.`,
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

    const openRegister = await db.query.cashRegisters.findFirst({
      where: eq(cashRegisters.status, "OPEN"),
    });

    if (!openRegister) {
      return {
        failed: true,
        message:
          "No hay una caja abierta. Abre la caja antes de registrar el pago.",
      };
    }

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, data.bookingId),
    });

    if (!booking) return { failed: true, message: "Reserva no encontrada." };

    const newPaidAmount = (booking.paidAmount || 0) + amount;
    const newPaymentStatus =
      newPaidAmount >= booking.totalPrice ? "PAID" : "PARTIAL";

    await db
      .update(bookings)
      .set({ paidAmount: newPaidAmount, paymentStatus: newPaymentStatus })
      .where(eq(bookings.id, booking.id));

    await db.insert(cashMovements).values({
      id: crypto.randomUUID(),
      registerId: openRegister.id,
      type: "INCOME",
      category: "BOOKING",
      amount: amount,
      description: `Pago adicional reserva: ${booking.id.slice(0, 8)}`,
      paymentMethod: data.paymentMethod as any,
      referenceId: booking.id,
    });

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
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, data.bookingId),
    });

    if (!booking) {
      return { failed: true, message: "Reserva no encontrada." };
    }

    if (booking.status === "ATTENDED") {
      return { failed: true, message: "La asistencia ya fue confirmada." };
    }

    await db.transaction(async (tx) => {
      // 1. Update booking status to ATTENDED
      await tx
        .update(bookings)
        .set({ status: "ATTENDED" })
        .where(eq(bookings.id, booking.id));

      // 2. Generate debt transaction in the customer's current account if there is a group and unpaid balance
      if (booking.groupId) {
        const debtAmount = booking.totalPrice - booking.paidAmount;
        if (debtAmount > 0) {
          // Insert debt charge in group transactions
          await tx.insert(groupTransactions).values({
            id: crypto.randomUUID(),
            groupId: booking.groupId,
            type: "CHARGE",
            amount: debtAmount,
            description: `Turno asistido: ${booking.id.slice(0, 8)}`,
            bookingId: booking.id,
          });

          // Deduct from group balance to increase debt
          const group = await tx.query.groups.findFirst({
            where: eq(groups.id, booking.groupId),
          });
          if (group) {
            await tx
              .update(groups)
              .set({ balance: group.balance - debtAmount })
              .where(eq(groups.id, booking.groupId));
          }
        }
      }
    });

    return { success: true };
  },
  zod$({
    bookingId: z.string(),
  }),
);

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
  await db
    .update(bookings)
    .set({ status: "COMPLETED" })
    .where(
      and(
        eq(bookings.status, "CONFIRMED"),
        lt(bookings.endTime, now),
        notInArray(bookings.paymentMethod, ["CUENTA_CORRIENTE", "CURRENT_ACCOUNT"])
      )
    );

  const settings = await db.query.siteSettings.findFirst();
  const extraServices = (settings?.extraServices || []) as {
    name: string;
    price: number;
    icon: string;
  }[];

  const openRegister = await db.query.cashRegisters.findFirst({
    where: eq(cashRegisters.status, "OPEN"),
  });

  // Create selectedDate in BA timezone (UTC-3)
  const selectedDate = new Date(`${dateStr}T12:00:00-03:00`);

  let startDate = new Date(selectedDate);
  let endDate = new Date(selectedDate);

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

  const allPitchesData = await db.query.pitches.findMany({
    where: eq(pitches.isActive, true),
    orderBy: (pitches, { asc }) => [asc(pitches.name)],
    with: { pricingRules: true, overlaps: true, overlappedBy: true },
  });

  const allPitches = allPitchesData.map((p) => {
    const overlapIds = new Set<string>();
    if (p.overlaps)
      p.overlaps.forEach((o: any) => overlapIds.add(o.overlapPitchId));
    if (p.overlappedBy)
      p.overlappedBy.forEach((o: any) => overlapIds.add(o.pitchId));
    return {
      ...p,
      overlapPitchIds: Array.from(overlapIds),
    };
  });

  let dailyBookings: any = [];
  const monthCounts: Record<string, number> = {};

  if (viewStr === "month") {
    // Optimized month query: only get IDs and start times
    const allMonthBookings = await db
      .select({
        id: bookings.id,
        startTime: bookings.startTime,
      })
      .from(bookings)
      .where(
        and(
          gte(bookings.startTime, startDate),
          lte(bookings.startTime, endDate),
        ),
      );

    for (const b of allMonthBookings) {
      const dStr = getBAFormatDate(b.startTime);
      monthCounts[dStr] = (monthCounts[dStr] || 0) + 1;
    }
  } else {
    // Normal query for day/week
    dailyBookings = await db
      .select({
        booking: {
          id: bookings.id,
          pitchId: bookings.pitchId,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
          totalPrice: bookings.totalPrice,
          paidAmount: bookings.paidAmount,
          paymentStatus: bookings.paymentStatus,
          isSubscription: bookings.isSubscription,
          bookingType: bookings.bookingType,
        },
        user: {
          id: users.id,
          name: users.name,
          phone: users.phone,
        },
        guest: {
          id: guestRequests.id,
          name: guestRequests.name,
          phone: guestRequests.phone,
        },
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.userId, users.id))
      .leftJoin(guestRequests, eq(bookings.id, guestRequests.bookingId))
      .where(
        and(
          gte(bookings.startTime, startDate),
          lte(bookings.startTime, endDate),
        ),
      );
  }

  // Inject School Classes (Virtual Bookings)
  if (settings && settings.schoolCategories) {
    const schoolCategories = settings.schoolCategories as any[];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
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
                const [sH, sM] = sched.startTime.split(":");
                const [eH, eM] = sched.endTime.split(":");

                // Keep BA offset semantics
                const startDateTime = new Date(`${dateStr}T00:00:00-03:00`);
                startDateTime.setHours(Number(sH), Number(sM), 0, 0);

                const endDateTime = new Date(`${dateStr}T00:00:00-03:00`);
                endDateTime.setHours(Number(eH), Number(eM), 0, 0);

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
          openedAt: openRegister.openedAt.toISOString(),
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
  const { inArray, lt, or } = await import("drizzle-orm");

  // Get related pitch IDs (bidirectional)
  const overlaps = await db
    .select()
    .from(pitchOverlaps)
    .where(
      or(
        eq(pitchOverlaps.pitchId, pitchId),
        eq(pitchOverlaps.overlapPitchId, pitchId),
      ),
    );
  const relatedIds = [
    pitchId,
    ...overlaps.map((o: any) =>
      o.pitchId === pitchId ? o.overlapPitchId : o.pitchId,
    ),
  ];

  const daily = await db.query.bookings.findMany({
    where: and(
      inArray(bookings.pitchId, relatedIds),
      gte(bookings.startTime, startOfDay),
      lt(bookings.startTime, endOfDay),
      inArray(bookings.status, [
        "CONFIRMED",
        "PENDING_APPROVAL",
        "COMPLETED",
      ] as any),
    ),
    columns: { startTime: true, endTime: true },
  });
  return daily.map((b) => ({
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
  }));
});

export const searchUsersServer = server$(async function (query: string) {
  if (!query || query.length < 2) return [];
  const db = getDB(this as any);
  const { ilike, or } = await import("drizzle-orm");
  const pattern = `%${query}%`;

  const results = await db.query.users.findMany({
    where: or(
      ilike(users.name, pattern),
      ilike(users.email, pattern),
      ilike(users.phone, pattern),
    ),
    columns: { id: true, name: true, phone: true, email: true },
    limit: 5,
  });

  return results;
});

export default component$(() => {
  const calendarData = useCalendarData();
  const updateStatusAction = useUpdateBookingStatusAction();
  const createBookingAction = useCreateAdminBookingAction();
  const addPaymentAction = useAddBookingPaymentAction();
  const confirmAttendanceAction = useConfirmAttendanceAction();
  const nav = useNavigate();

  useStyles$(`
    @media print {
      body * { visibility: hidden; }
      .print-area, .print-area * { visibility: visible; }
      .print-area { 
        position: absolute; 
        left: 0; 
        top: 0; 
        width: 100%; 
        border: none !important;
        shadow: none !important;
      }
      .no-print { display: none !important; }
    }
  `);

  // Layout mode: 'timeline' (pitches×time) | 'list' (table)
  const layoutMode = useSignal<"timeline" | "list">("timeline");

  const clubSettings = calendarData.value.settings;
  const selectedDateBA = new Date(
    calendarData.value.selectedDateStr + "T12:00:00",
  );

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
  const dayOfWeek = isHoliday ? 7 : selectedDateBA.getDay();

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

  const selectedBookingDetails = calendarData.value.bookings.find(
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
        onViewChange$={handleViewChange}
        onNewBooking$={handleNewBooking}
      />

      {calendarData.value.view === "day" ? (
        layoutMode.value === "list" ? (
          <main class="flex-1 overflow-auto p-6">
            <div class="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <BookingListView
                pitches={calendarData.value.pitches}
                bookings={calendarData.value.bookings as any}
                onBookingClick$={handleBookingClick}
              />
            </div>
          </main>
        ) : (
          <main class="flex-1 overflow-auto p-6">
            <div class="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <BookingTimelineView
                pitches={calendarData.value.pitches}
                bookings={calendarData.value.bookings as any}
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
        <Modal.Panel class="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
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

            <div class="print-area overflow-hidden rounded-2xl border shadow-sm">
              <div class="flex items-center justify-between bg-slate-900 p-6 text-white">
                <div>
                  <h1 class="text-2xl font-black tracking-tight uppercase">
                    Agenda de Reservas
                  </h1>
                  <p class="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                    {calendarData.value.settings?.clubName ||
                      "SportGarden Futbol"}
                  </p>
                </div>
                <div class="text-right">
                  <div class="text-xl font-black">
                    {new Date(
                      calendarData.value.selectedDateStr + "T12:00:00",
                    ).toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                  <div class="text-[10px] font-bold text-slate-400 uppercase">
                    Reporte Generado: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>

              <div class="p-0">
                <table class="w-full border-collapse text-left">
                  <thead>
                    <tr class="border-b border-slate-200 bg-slate-100">
                      <th class="px-4 py-3 text-[10px] font-black tracking-widest text-slate-500 uppercase">
                        Hora
                      </th>
                      <th class="px-4 py-3 text-[10px] font-black tracking-widest text-slate-500 uppercase">
                        Cancha
                      </th>
                      <th class="px-4 py-3 text-[10px] font-black tracking-widest text-slate-500 uppercase">
                        Cliente / Contacto
                      </th>
                      <th class="px-4 py-3 text-right text-[10px] font-black tracking-widest text-slate-500 uppercase">
                        Saldo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarData.value.bookings
                      .sort(
                        (a: any, b: any) =>
                          new Date(a.booking.startTime).getTime() -
                          new Date(b.booking.startTime).getTime(),
                      )
                      .map((b: any) => (
                        <tr
                          key={b.booking.id}
                          class="border-b border-slate-100 transition-colors hover:bg-slate-50"
                        >
                          <td class="px-4 py-4">
                            <div class="text-sm font-black whitespace-nowrap text-slate-800">
                              {new Date(b.booking.startTime).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )}{" "}
                              -{" "}
                              {new Date(b.booking.endTime).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </div>
                          </td>
                          <td class="px-4 py-4">
                            <div class="text-xs font-bold text-slate-600">
                              {calendarData.value.pitches.find(
                                (p: any) => p.id === b.booking.pitchId,
                              )?.name || "Cancha"}
                            </div>
                          </td>
                          <td class="px-4 py-4">
                            <div class="text-sm font-black text-slate-800">
                              {b.user?.name || b.guest?.name || "S/N"}
                            </div>
                            <div class="text-[10px] font-bold text-slate-500">
                              {b.user?.phone || b.guest?.phone || "-"}
                            </div>
                          </td>
                          <td class="px-4 py-4 text-right">
                            <div
                              class={cn(
                                "inline-block rounded px-2 py-1 text-[10px] font-black tracking-tighter uppercase",
                                b.booking.paymentStatus === "PAID"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700",
                              )}
                            >
                              {b.booking.paymentStatus === "PAID"
                                ? "PAGADO"
                                : `RESTA $${(b.booking.totalPrice - b.booking.paidAmount).toLocaleString()}`}
                            </div>
                          </td>
                        </tr>
                      ))}
                    {calendarData.value.bookings.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          class="px-4 py-12 text-center font-bold text-slate-400 italic"
                        >
                          No hay reservas para este día.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
