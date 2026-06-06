import {
  component$,
  useSignal,
  useComputed$,
  useTask$,
} from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
  Link,
} from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { cashRegisters, cashMovements, bookings, students, cashSessions, transactions, pitches, users, guestRequests, siteSettings } from "~/db/schema";
import { Button, Modal } from "~/components/ui";
import { cn } from "@qwik-ui/utils";
import { CashSectionNav } from "~/components/admin/cash/CashSectionNav";
import {
  resolveMovementCategories,
  resolvePaymentMethodsForAnalytics,
} from "~/lib/admin/cash-settings-defaults";

const BILL_DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 100];

export const useCashData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const url = new URL(requestEvent.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 25;
  const offset = (page - 1) * limit;

  // 1. Fetch latest open register or latest register
  const { data: openRegisterData, error: openRegErr } = await db
    .from(cashRegisters)
    .select("*")
    .eq("status", "OPEN")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openRegErr) throw openRegErr;
  let latestRegister = camelize<any>(openRegisterData);

  if (!latestRegister) {
    const { data: latestRegData, error: latestRegErr } = await db
      .from(cashRegisters)
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRegErr) throw latestRegErr;
    latestRegister = camelize<any>(latestRegData);
  }

  let allMovements: any[] = [];
  let paginatedMovements: any[] = [];
  let totalCount = 0;
  let digitalTransactions: any[] = [];

  if (latestRegister) {
    const { data: movementsData, error: movementsErr } = await db
      .from(cashMovements)
      .select("*")
      .eq("register_id", latestRegister.id);

    if (movementsErr) throw movementsErr;
    const cashMovementsList = camelize<any[]>(movementsData || []);

    const { data: txsData, error: txsErr } = await db
      .from(transactions)
      .select("*")
      .eq("cash_session_id", latestRegister.id);

    if (txsErr) throw txsErr;
    digitalTransactions = camelize<any[]>(txsData || []);

    // Map digital transactions to match standard movement structure
    const mappedDigital = digitalTransactions.map((t) => ({
      id: t.id,
      registerId: t.cashSessionId,
      type: t.type,
      category: t.category, // e.g. "RESERVA_MP"
      amount: t.amount,
      description: t.description,
      paymentMethod: t.paymentMethod || "MERCADOPAGO",
      referenceId: t.referenceId,
      createdAt: t.createdAt,
      isDigital: true,
    }));

    // Merge standard movements and digital transactions
    allMovements = [...cashMovementsList, ...mappedDigital];
    // Sort all by createdAt descending
    allMovements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    totalCount = allMovements.length;
    paginatedMovements = allMovements.slice(offset, offset + limit);

    // Fetch related bookings for either BOOKING or RESERVA_MP category
    const bookingIds = paginatedMovements
      .filter((m) => (m.category === "BOOKING" || m.category === "RESERVA_MP") && m.referenceId)
      .map((m) => m.referenceId);

    if (bookingIds.length > 0) {
      const { data: booksData, error: booksErr } = await db
        .from(bookings)
        .select("*")
        .in("id", bookingIds);

      if (booksErr) throw booksErr;
      const bookingsRaw = camelize<any[]>(booksData || []);

      let relatedBookings: any[] = [];
      if (bookingsRaw.length > 0) {
        const pitchIds = Array.from(new Set(bookingsRaw.map((b) => b.pitchId).filter(Boolean)));
        const userIds = Array.from(new Set(bookingsRaw.map((b) => b.userId).filter(Boolean)));

        const { data: pitchesData, error: pitchesErr } = await db
          .from(pitches)
          .select("*")
          .in("id", pitchIds);
        if (pitchesErr) throw pitchesErr;
        const pitchesRaw = camelize<any[]>(pitchesData || []);

        const { data: usersData, error: usersErr } = await db
          .from(users)
          .select("id, name, phone")
          .in("id", userIds);
        if (usersErr) throw usersErr;
        const usersRaw = camelize<any[]>(usersData || []);

        const { data: guestsData, error: guestsErr } = await db
          .from(guestRequests)
          .select("*")
          .in("booking_id", bookingIds);
        if (guestsErr) throw guestsErr;
        const guestsRaw = camelize<any[]>(guestsData || []);

        relatedBookings = bookingsRaw.map((b) => ({
          ...b,
          pitch: pitchesRaw.find((p) => p.id === b.pitchId) || null,
          user: usersRaw.find((u) => u.id === b.userId) || null,
          guestRequest: guestsRaw.find((g) => g.bookingId === b.id) || null,
        }));
      }

      // Attach booking info to movements
      paginatedMovements = paginatedMovements.map((m) => {
        if ((m.category === "BOOKING" || m.category === "RESERVA_MP") && m.referenceId) {
          const booking = relatedBookings.find((b) => b.id === m.referenceId);
          return { ...m, booking };
        }
        return m;
      });
    }

    // Fetch related students for SCHOOL category
    const studentIds = paginatedMovements
      .filter((m) => m.category === "SCHOOL" && m.referenceId)
      .map((m) => m.referenceId);

    if (studentIds.length > 0) {
      const { data: studentsData, error: studentsErr } = await db
        .from(students)
        .select("*")
        .in("id", studentIds);

      if (studentsErr) throw studentsErr;
      const relatedStudents = camelize<any[]>(studentsData || []);

      paginatedMovements = paginatedMovements.map((m) => {
        if (m.category === "SCHOOL" && m.referenceId) {
          const student = relatedStudents.find((s) => s.id === m.referenceId);
          return { ...m, student };
        }
        return m;
      });
    }
  }

  const totalIncomes = allMovements
    .filter((m) => m.type === "INCOME")
    .reduce((a, m) => a + m.amount, 0);

  const totalExpenses = allMovements
    .filter((m) => m.type === "EXPENSE")
    .reduce((a, m) => a + m.amount, 0);

  const currentBalance =
    (latestRegister?.openingBalance || 0) + totalIncomes - totalExpenses;

  const { data: settingsData, error: settingsErr } = await db
    .from(siteSettings)
    .select("*")
    .maybeSingle();

  if (settingsErr) throw settingsErr;
  const settings = camelize<any>(settingsData);

  const availableMethods = resolvePaymentMethodsForAnalytics(
    settings?.paymentMethods,
  );

  // Desglose por método de pago
  const byMethod: Record<string, { incomes: number; expenses: number }> = {};

  availableMethods.forEach((pm) => {
    byMethod[pm.id] = { incomes: 0, expenses: 0 };
  });

  for (const m of allMovements) {
    if (!byMethod[m.paymentMethod]) {
      byMethod[m.paymentMethod] = { incomes: 0, expenses: 0 };
    }
    if (m.type === "INCOME") byMethod[m.paymentMethod].incomes += m.amount;
    else byMethod[m.paymentMethod].expenses += m.amount;
  }

  // Cargar transacciones en suspenso (mientras la caja está cerrada actualmente)
  const { data: pendingTxsData, error: pendingTxsErr } = await db
    .from(transactions)
    .select("*")
    .is("cash_session_id", null);

  if (pendingTxsErr) throw pendingTxsErr;
  const pendingTransactions = camelize<any[]>(pendingTxsData || []);

  const pendingDigital = {
    count: pendingTransactions.length,
    total: pendingTransactions.reduce((sum, t) => sum + t.amount, 0),
  };

  // Cargar transacciones que ingresaron fuera de horario para el turno actual
  const closedPeriodPayments = latestRegister && latestRegister.status === "OPEN"
    ? digitalTransactions.filter((t) => new Date(t.createdAt).getTime() < new Date(latestRegister!.openedAt).getTime())
    : [];

  const closedPeriodDigital = {
    count: closedPeriodPayments.length,
    total: closedPeriodPayments.reduce((sum, t) => sum + t.amount, 0),
  };

  // Check for unconfirmed Cuenta Corriente bookings for today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const { data: unconfirmedData, error: unconfirmedErr } = await db
    .from(bookings)
    .select("*")
    .in("payment_method", ["CUENTA_CORRIENTE", "CURRENT_ACCOUNT"])
    .in("status", ["CONFIRMED", "PENDING_APPROVAL"])
    .gte("start_time", startOfToday.toISOString())
    .lte("start_time", endOfToday.toISOString());

  if (unconfirmedErr) throw unconfirmedErr;
  const unconfirmedRaw = camelize<any[]>(unconfirmedData || []);

  let unconfirmedTodayBookings: any[] = [];
  if (unconfirmedRaw.length > 0) {
    const pitchIds = Array.from(new Set(unconfirmedRaw.map((b) => b.pitchId).filter(Boolean)));
    const { data: pitchesData, error: pitchesErr } = await db
      .from(pitches)
      .select("*")
      .in("id", pitchIds);

    if (pitchesErr) throw pitchesErr;
    const pitchesRaw = camelize<any[]>(pitchesData || []);

    unconfirmedTodayBookings = unconfirmedRaw.map((b) => ({
      ...b,
      pitch: pitchesRaw.find((p) => p.id === b.pitchId) || null,
    }));
  }

  return {
    latestRegister,
    movements: paginatedMovements,
    totalIncomes,
    totalExpenses,
    currentBalance,
    byMethod,
    paymentMethods: availableMethods,
    movementCategories: resolveMovementCategories(settings?.movementCategories),
    unconfirmedTodayBookings,
    pendingDigital,
    closedPeriodDigital,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    },
  };
});

export const useToggleRegisterAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { action, balance, registerId, notes } = data;
    if (action === "OPEN") {
      const id = crypto.randomUUID();

      const { error: insRegErr } = await db.from(cashRegisters).insert({
        id,
        opening_balance: Number(balance) || 0,
        status: "OPEN",
        notes: notes || null,
      });
      if (insRegErr) throw insRegErr;

      const { error: insSesErr } = await db.from(cashSessions).insert({
        id,
        opened_at: new Date().toISOString(),
        status: "OPEN",
      });
      if (insSesErr) throw insSesErr;

      const { error: updTxErr } = await db
        .from(transactions)
        .update({ cash_session_id: id })
        .is("cash_session_id", null);
      if (updTxErr) throw updTxErr;

      return { success: true };
    } else if (action === "CLOSE") {
      // Parse billCount from JSON string
      let billCount: Record<string, number> | null = null;
      if (data.billCountJson) {
        try {
          billCount = JSON.parse(data.billCountJson as string);
        } catch {
          // Ignorar error de parseo si el JSON es inválido
        }
      }

      const { error: updRegErr } = await db
        .from(cashRegisters)
        .update({
          status: "CLOSED",
          closing_balance: Number(balance) || 0,
          closed_at: new Date().toISOString(),
          bill_count: billCount ?? null,
          notes: notes || null,
        })
        .eq("id", registerId!);
      if (updRegErr) throw updRegErr;

      const { error: updSesErr } = await db
        .from(cashSessions)
        .update({
          status: "CLOSED",
          closed_at: new Date().toISOString(),
        })
        .eq("id", registerId!);
      if (updSesErr) throw updSesErr;

      return { success: true };
    }
    return { success: false };
  },
  zod$({
    action: z.enum(["OPEN", "CLOSE"]),
    balance: z.string().optional(),
    registerId: z.string().optional(),
    notes: z.string().optional(),
    billCountJson: z.string().optional(),
  }),
);

export const useAddMovementAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { error } = await db.from(cashMovements).insert({
      id: crypto.randomUUID(),
      register_id: data.registerId,
      type: data.type,
      category: data.category,
      amount: data.amount,
      description: data.description,
      payment_method: data.paymentMethod,
    });
    if (error) throw error;
    return { success: true };
  },
  zod$({
    registerId: z.string(),
    type: z.enum(["INCOME", "EXPENSE"]),
    category: z.string().min(1, "La categoría es requerida"),
    amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
    description: z.string().min(1, "La descripción / concepto es requerida"),
    paymentMethod: z.string(),
  }),
);

export default component$(() => {
  const cashData = useCashData();
  const toggleAction = useToggleRegisterAction();
  const addMovementAction = useAddMovementAction();
  const currentPage = cashData.value.pagination.currentPage;
  const totalPages = cashData.value.pagination.totalPages;
  const isOpen = cashData.value.latestRegister?.status === "OPEN";
  const showCloseModal = useSignal(false);
  const isMovementModalOpen = useSignal(false);
  const selectedMovement = useSignal<any>(null);
  const isDetailModalOpen = useSignal(false);
  const movementType = useSignal<"INCOME" | "EXPENSE">("INCOME");

  // Arqueo de billetes
  const bills = useSignal<Record<number, number>>(
    Object.fromEntries(BILL_DENOMINATIONS.map((d) => [d, 0])),
  );
  const billTotal = useComputed$(() =>
    BILL_DENOMINATIONS.reduce((sum, d) => sum + d * (bills.value[d] || 0), 0),
  );

  const reg = cashData.value.latestRegister;
  const openedAtStr = reg?.openedAt
    ? new Date(reg.openedAt).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

  // Close modal when movement is added
  useTask$(({ track }) => {
    track(() => addMovementAction.value);
    if (addMovementAction.value?.success) {
      isMovementModalOpen.value = false;
    }
  });

  // Close close modal when register is toggled (closed)
  useTask$(({ track }) => {
    track(() => toggleAction.value);
    if (toggleAction.value?.success) {
      showCloseModal.value = false;
    }
  });

  return (
    <div class="min-h-full bg-slate-50 p-4 font-sans md:p-6 print:bg-white print:p-0">
      <style>{`
        @media print {
          @page { margin: 1cm; }
          body { background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .shadow-sm, .shadow-md, .shadow-xl { box-shadow: none !important; }
          .rounded-2xl, .rounded-3xl { border-radius: 4px !important; }
          .border { border-color: #e2e8f0 !important; }
        }
      `}</style>

      <div class="mx-auto max-w-6xl space-y-5">
        {/* Print-only Header */}
        <div class="mb-6 hidden border-b border-slate-900 pb-4 print:block">
          <h1 class="text-xl font-black">GardenClubFutbol - Reporte de Caja</h1>
          <p class="text-xs font-bold text-slate-500 uppercase">
            {new Date().toLocaleString("es-AR")}
          </p>
        </div>

        <CashSectionNav />

        {cashData.value.unconfirmedTodayBookings &&
          cashData.value.unconfirmedTodayBookings.length > 0 && (
            <div class="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm print:hidden">
              <div class="flex items-start gap-4">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-800">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div class="space-y-1">
                  <h3 class="text-sm font-black text-yellow-800 uppercase tracking-wide">
                    Atención: Turnos de Cuenta Corriente sin confirmar
                  </h3>
                  <p class="text-xs font-semibold leading-relaxed text-yellow-700">
                    Tienes {cashData.value.unconfirmedTodayBookings.length} turno(s) de Cuenta Corriente programados para hoy sin confirmar. 
                    Por favor, confirma la asistencia en el calendario para generar la deuda correspondiente antes de realizar el cierre de caja.
                  </p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    {cashData.value.unconfirmedTodayBookings.map((b: any) => (
                      <Link
                        key={b.id}
                        href="/admin/calendar"
                        class="inline-flex items-center gap-1.5 rounded-lg bg-yellow-100 px-3 py-1 text-[11px] font-bold text-yellow-800 hover:bg-yellow-200 transition-colors"
                      >
                        <span>
                          {b.pitch?.name || "Cancha"} - {new Date(b.startTime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}hs
                        </span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        {!isOpen && cashData.value.pendingDigital && cashData.value.pendingDigital.count > 0 && (
          <div class="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm print:hidden">
            <div class="flex items-start gap-4">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <div class="space-y-1">
                <h3 class="text-sm font-black text-blue-800 uppercase tracking-wide">
                  Pagos Online en Espera ({cashData.value.pendingDigital.count})
                </h3>
                <p class="text-xs font-semibold leading-relaxed text-blue-700">
                  Se recibieron <strong>{cashData.value.pendingDigital.count}</strong> pagos digitales por un total de <strong>${cashData.value.pendingDigital.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong> mientras la caja física estaba cerrada (fuera de horario / madrugada).
                  Se asignarán de forma automática a la próxima apertura de caja de tu complejo.
                </p>
              </div>
            </div>
          </div>
        )}

        {isOpen && cashData.value.closedPeriodDigital && cashData.value.closedPeriodDigital.count > 0 && (
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm print:hidden">
            <div class="flex items-start gap-4">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div class="space-y-1">
                <h3 class="text-sm font-black text-emerald-800 uppercase tracking-wide">
                  Pagos fuera de horario incorporados ({cashData.value.closedPeriodDigital.count})
                </h3>
                <p class="text-xs font-semibold leading-relaxed text-emerald-700">
                  Se han detectado e incorporado <strong>{cashData.value.closedPeriodDigital.count}</strong> pagos online recibidos en suspenso mientras la caja estaba cerrada (madrugada / fuera de turno), por un total de <strong>${cashData.value.closedPeriodDigital.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong>. Se muestran correctamente en el listado de movimientos cronológicos de este turno.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div class="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-slate-300 print:shadow-none">
          <div>
            <h1 class="text-2xl font-black tracking-tight text-slate-800">
              Caja Actual
            </h1>
            {isOpen ? (
              <p class="mt-1 text-sm text-slate-500">
                Abierta el{" "}
                <span class="font-semibold text-slate-700">{openedAtStr}</span>
              </p>
            ) : (
              <p class="mt-1 text-sm text-slate-400">
                Caja cerrada · Ábrela para comenzar a operar.
              </p>
            )}
          </div>

          <div class="flex gap-3 print:hidden">
            {isOpen ? (
              <>
                <button
                  onClick$={() => (isMovementModalOpen.value = true)}
                  class="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Nuevo Movimiento
                </button>
                <button
                  onClick$={() => window.print()}
                  class="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect width="12" height="8" x="6" y="14" />
                  </svg>
                  Reporte del Día
                </button>
                <button
                  onClick$={() => (showCloseModal.value = true)}
                  class="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
                >
                  Cerrar Caja
                </button>
              </>
            ) : (
              <Form action={toggleAction} class="flex items-center gap-2">
                <input type="hidden" name="action" value="OPEN" />
                <input
                  type="number"
                  name="balance"
                  placeholder="Monto Inicial $"
                  required
                  class="w-44 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
                <Button
                  look="primary"
                  type="submit"
                  class="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-600"
                >
                  Abrir Caja
                </Button>
              </Form>
            )}
          </div>
        </div>

        {/* Close Modal */}
        {showCloseModal.value && (
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
            <div class="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-2xl">
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-black text-slate-800">Cerrar Caja</h2>
                <button
                  onClick$={() => (showCloseModal.value = false)}
                  class="text-2xl leading-none text-slate-400 hover:text-slate-600"
                >
                  &times;
                </button>
              </div>

              <div>
                <h3 class="mb-3 text-sm font-bold tracking-wider text-slate-700 uppercase">
                  Arqueo de Billetes
                </h3>
                <div class="space-y-2">
                  {BILL_DENOMINATIONS.map((d) => (
                    <div key={d} class="flex items-center gap-3">
                      <span class="w-24 text-right text-sm font-bold text-slate-600">
                        ${d.toLocaleString("es-AR")}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={bills.value[d] || 0}
                        onInput$={(e) => {
                          const v =
                            parseInt((e.target as HTMLInputElement).value) || 0;
                          bills.value = { ...bills.value, [d]: v };
                        }}
                        class="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-center text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                      <span class="text-sm font-medium text-slate-500">
                        = ${((bills.value[d] || 0) * d).toLocaleString("es-AR")}
                      </span>
                    </div>
                  ))}
                </div>
                <div class="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <span class="text-sm font-bold text-emerald-700">
                    Total en Efectivo
                  </span>
                  <span class="text-xl font-black text-emerald-800">
                    ${billTotal.value.toLocaleString("es-AR")}
                  </span>
                </div>
              </div>

              <Form action={toggleAction} class="space-y-3">
                <input type="hidden" name="action" value="CLOSE" />
                <input
                  type="hidden"
                  name="registerId"
                  value={cashData.value.latestRegister?.id}
                />
                <input
                  type="hidden"
                  name="balance"
                  value={billTotal.value.toString()}
                />
                <input
                  type="hidden"
                  name="billCountJson"
                  value={JSON.stringify(bills.value)}
                />
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Observaciones del turno
                  </label>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="Ej: turno tranquilo, falta cambio..."
                    class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div class="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick$={() => (showCloseModal.value = false)}
                    class="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <Button
                    look="primary"
                    type="submit"
                    class="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white hover:bg-red-600"
                  >
                    Confirmar Cierre
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        )}

        {isOpen && (
          <div class="space-y-6">
            {/* Stats Overview */}
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-2">
              <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div class="mb-3 flex items-center gap-3">
                  <div class="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      <polyline points="17 6 23 6 23 12" />
                    </svg>
                  </div>
                  <div class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Ingresos Totales
                  </div>
                </div>
                <div class="text-2xl font-black text-emerald-600">
                  $
                  {cashData.value.totalIncomes.toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div class="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
                  {Object.entries(cashData.value.byMethod)
                    .filter(([, v]) => v.incomes > 0)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        class="flex justify-between text-[10px] font-bold tracking-tight text-slate-500 uppercase"
                      >
                        <span>
                          {cashData.value.paymentMethods.find(
                            (pm: any) => pm.id === k,
                          )?.name || k}
                        </span>
                        <span class="text-emerald-600">
                          +$
                          {v.incomes.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div class="mb-3 flex items-center gap-3">
                  <div class="rounded-lg bg-rose-50 p-2 text-rose-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                      <polyline points="17 18 23 18 23 12" />
                    </svg>
                  </div>
                  <div class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Egresos Totales
                  </div>
                </div>
                <div class="text-2xl font-black text-rose-600">
                  $
                  {cashData.value.totalExpenses.toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div class="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
                  {Object.entries(cashData.value.byMethod)
                    .filter(([, v]) => v.expenses > 0)
                    .map(([k, v]) => (
                      <div
                        key={k}
                        class="flex justify-between text-[10px] font-bold tracking-tight text-slate-500 uppercase"
                      >
                        <span>
                          {cashData.value.paymentMethods.find(
                            (pm: any) => pm.id === k,
                          )?.name || k}
                        </span>
                        <span class="text-rose-600">
                          -$
                          {v.expenses.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div class="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white shadow-xl sm:col-span-2">
                <div class="mb-4 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="rounded-lg bg-white/10 p-2 text-emerald-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                        <path d="M12 18V6" />
                      </svg>
                    </div>
                    <div class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Balance del Turno
                    </div>
                  </div>
                  <div class="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                    Inicial: $
                    {cashData.value.latestRegister?.openingBalance?.toLocaleString(
                      "es-AR",
                    )}
                  </div>
                </div>
                <div class="flex items-baseline gap-2">
                  <div class="text-4xl font-black text-emerald-400">
                    $
                    {cashData.value.currentBalance.toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div class="text-sm font-bold tracking-widest text-slate-500 uppercase">
                    AR$
                  </div>
                </div>
                <div class="mt-4 flex gap-2">
                  {Object.entries(cashData.value.byMethod).map(([k, v]) => {
                    const bal = v.incomes - v.expenses;
                    if (bal === 0 && k !== "CASH") return null;
                    return (
                      <div
                        key={k}
                        class="flex flex-col rounded-lg border border-white/5 bg-white/5 px-3 py-1"
                      >
                        <span class="text-[8px] font-black text-slate-500 uppercase">
                          {cashData.value.paymentMethods.find(
                            (pm: any) => pm.id === k,
                          )?.name || k}
                        </span>
                        <span
                          class={cn(
                            "text-[10px] font-bold",
                            bal >= 0 ? "text-emerald-400" : "text-rose-400",
                          )}
                        >
                          ${bal.toLocaleString("es-AR")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Movements List - Full Width */}
            <div class="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5 print:bg-white print:p-0 print:pb-3">
                <div class="flex items-center gap-3">
                  <h2 class="text-lg font-black text-slate-800">
                    Movimientos del Turno
                  </h2>
                  <div class="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-black tracking-widest text-slate-600 uppercase print:hidden">
                    {cashData.value.pagination.totalCount} registros
                  </div>
                </div>
                <button
                  onClick$={() => (isMovementModalOpen.value = true)}
                  class="flex items-center gap-2 text-xs font-black tracking-widest text-emerald-600 uppercase transition-colors hover:text-emerald-700 print:hidden"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Agregar Movimiento
                </button>
              </div>

              <div class="flex-1 overflow-auto">
                <table class="w-full min-w-[800px] border-collapse text-left">
                  <thead>
                    <tr class="border-b border-slate-200 bg-slate-50/80 text-xs font-black tracking-widest text-slate-400 uppercase">
                      <th class="p-4 pl-6">Hora</th>
                      <th class="p-4">Categoría</th>
                      <th class="p-4">Descripción</th>
                      <th class="p-4">Método</th>
                      <th class="p-4 text-right">Monto</th>
                      <th class="p-4 pr-6 text-center print:hidden">Info</th>
                    </tr>
                  </thead>
                  <tbody class="text-sm text-slate-700">
                    {cashData.value.movements.length === 0 ? (
                      <tr>
                        <td colSpan={5} class="p-16 text-center">
                          <div class="flex flex-col items-center gap-3">
                            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-300">
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
                                <rect
                                  width="18"
                                  height="18"
                                  x="3"
                                  y="3"
                                  rx="2"
                                />
                                <path d="M3 9h18" />
                                <path d="M9 21V9" />
                              </svg>
                            </div>
                            <p class="font-medium text-slate-400">
                              No hay movimientos aún en este turno.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      cashData.value.movements.map((m) => {
                        const mc = cashData.value.movementCategories.find(
                          (c) => c.id === m.category,
                        );
                        const label = mc ? mc.name : m.category;
                        const icon = mc ? mc.icon : "📌";
                        const typeColor =
                          m.type === "INCOME"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-rose-50 text-rose-700 border-rose-100";

                        return (
                          <tr
                            key={m.id}
                            class="group border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50"
                          >
                            <td class="p-4 pl-6 text-xs font-bold whitespace-nowrap text-slate-500">
                              {new Date(m.createdAt).toLocaleTimeString(
                                "es-AR",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </td>
                            <td class="p-4">
                              <span
                                class={`rounded-md border px-2 py-0.5 text-[10px] font-black tracking-tight uppercase ${typeColor}`}
                              >
                                <span class="mr-1">{icon}</span>
                                {label}
                              </span>
                            </td>
                            <td class="max-w-md truncate p-4 font-medium text-slate-600">
                              {m.description || (
                                <span class="text-slate-300">—</span>
                              )}
                            </td>
                            <td class="p-4">
                              <div class="flex items-center gap-2">
                                <span class="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                                <span class="text-xs font-bold tracking-widest text-slate-500 uppercase">
                                  {cashData.value.paymentMethods.find(
                                    (pm: any) => pm.id === m.paymentMethod,
                                  )?.name || m.paymentMethod}
                                </span>
                              </div>
                            </td>
                            <td
                              class={`p-4 text-right text-base font-black whitespace-nowrap ${m.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}`}
                            >
                              {m.type === "INCOME" ? "+ $" : "- $"}
                              {m.amount.toLocaleString("es-AR", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td class="p-4 pr-6 text-center print:hidden">
                              {((m.category === "BOOKING" || m.category === "RESERVA_MP") && m.booking) ||
                              (m.category === "SCHOOL" && m.student) ? (
                                <button
                                  onClick$={() => {
                                    selectedMovement.value = m;
                                    isDetailModalOpen.value = true;
                                  }}
                                  class="rounded-xl p-2 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600 active:scale-90"
                                  title="Ver detalle"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                  </svg>
                                </button>
                              ) : (
                                <span class="text-slate-200">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-4 print:hidden">
                  <div class="text-xs font-bold tracking-widest text-slate-400 uppercase">
                    Página {currentPage} de{" "}
                    {totalPages}
                  </div>
                  <div class="flex gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick$={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set(
                          "page",
                          (currentPage - 1).toString(),
                        );
                        window.location.href = url.toString();
                      }}
                      class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black tracking-widest text-slate-600 uppercase transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick$={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set(
                          "page",
                          (currentPage + 1).toString(),
                        );
                        window.location.href = url.toString();
                      }}
                      class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black tracking-widest text-slate-600 uppercase transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal.Root bind:show={isDetailModalOpen}>
        <Modal.Panel class="max-w-md overflow-hidden rounded-3xl border-none p-0 shadow-2xl">
          {selectedMovement.value && (
            <div class="flex flex-col">
              <div class="relative bg-emerald-600 p-8 text-white">
                <button
                  onClick$={() => (isDetailModalOpen.value = false)}
                  class="absolute top-6 right-6 text-white/60 transition-colors hover:text-white"
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
                <div class="mb-2 text-[10px] font-black tracking-widest text-emerald-200 uppercase">
                  Detalle de Operación
                </div>
                <h2 class="mb-1 text-2xl font-black tracking-tighter uppercase">
                  {cashData.value.movementCategories.find(
                    (mc) => mc.id === selectedMovement.value?.category,
                  )?.name || "Movimiento"}
                </h2>
                <div class="flex items-center gap-2 text-xs font-bold text-emerald-100">
                  <span>
                    {new Date(
                      selectedMovement.value.createdAt,
                    ).toLocaleDateString("es-AR")}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(
                      selectedMovement.value.createdAt,
                    ).toLocaleTimeString("es-AR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              <div class="space-y-8 bg-white p-8">
                {/* Movement Info */}
                <div class="flex items-end justify-between border-b border-slate-100 pb-6">
                  <div>
                    <div class="mb-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Monto Registrado
                    </div>
                    <div
                      class={`text-3xl font-black ${selectedMovement.value.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {selectedMovement.value.type === "INCOME" ? "+ $" : "- $"}
                      {selectedMovement.value.amount.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="mb-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Método
                    </div>
                    <div class="text-sm font-black tracking-tight text-slate-700 uppercase">
                      {cashData.value.paymentMethods.find(
                        (pm: any) =>
                          pm.id === selectedMovement.value.paymentMethod,
                      )?.name || selectedMovement.value.paymentMethod}
                    </div>
                  </div>
                </div>

                {/* Booking Info if available */}
                {selectedMovement.value.booking && (
                  <div class="space-y-6">
                    <div class="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                      <div class="flex items-center gap-3">
                        <div class="rounded-xl border border-slate-100 bg-white p-2 text-emerald-600 shadow-sm">
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
                            <path d="m2 22 1-1h3l9-9" />
                            <path d="M3 21v-3l9-9" />
                            <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l-3-3Z" />
                          </svg>
                        </div>
                        <div>
                          <div class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                            Cancha / Turno
                          </div>
                          <div class="text-sm font-black text-slate-800">
                            {selectedMovement.value.booking.pitch?.name}
                          </div>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <div class="mb-0.5 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                            Fecha
                          </div>
                          <div class="text-xs font-bold text-slate-600">
                            {new Date(
                              selectedMovement.value.booking.startTime,
                            ).toLocaleDateString("es-AR", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                          </div>
                        </div>
                        <div>
                          <div class="mb-0.5 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                            Horario
                          </div>
                          <div class="text-xs font-bold text-slate-600">
                            {new Date(
                              selectedMovement.value.booking.startTime,
                            ).toLocaleTimeString("es-AR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            -{" "}
                            {new Date(
                              selectedMovement.value.booking.endTime,
                            ).toLocaleTimeString("es-AR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="space-y-4">
                      <div class="flex items-center gap-3">
                        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <div>
                          <div class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                            Cliente
                          </div>
                          <div class="text-sm font-bold text-slate-800">
                            {selectedMovement.value.booking.user?.name ||
                              selectedMovement.value.booking.guestRequest
                                ?.name ||
                              "Cliente Final"}
                          </div>
                          <div class="text-[10px] font-medium text-slate-500">
                            {selectedMovement.value.booking.user?.email ||
                              selectedMovement.value.booking.guestRequest
                                ?.phone ||
                              "Sin contacto"}
                          </div>
                        </div>
                      </div>

                      {selectedMovement.value.booking.extras &&
                        selectedMovement.value.booking.extras.length > 0 && (
                          <div class="pt-2">
                            <div class="mb-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                              Servicios Extra
                            </div>
                            <div class="flex flex-wrap gap-2">
                              {selectedMovement.value.booking.extras.map(
                                (extra: string) => (
                                  <span
                                    key={extra}
                                    class="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-black tracking-tight text-blue-600 uppercase"
                                  >
                                    {extra}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* School Info if available */}
                {selectedMovement.value.category === "SCHOOL" &&
                  selectedMovement.value.student && (
                    <div class="space-y-6">
                      <div class="rounded-2xl border border-blue-100 bg-blue-50 p-6">
                        <div class="mb-4 flex items-center gap-4">
                          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
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
                              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                              <path d="M6 12v5c3 3 9 3 12 0v-5" />
                            </svg>
                          </div>
                          <div>
                            <div class="text-[10px] font-black tracking-widest text-blue-400 uppercase">
                              Alumno / Escuelita
                            </div>
                            <div class="text-base leading-tight font-black text-blue-900">
                              {selectedMovement.value.student.name}
                            </div>
                          </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                          <div>
                            <div class="mb-1 text-[10px] font-black tracking-widest text-blue-400 uppercase">
                              Categoría
                            </div>
                            <div class="inline-block rounded-lg border border-blue-100 bg-white px-3 py-1 text-xs font-black text-blue-600">
                              {selectedMovement.value.student.category}
                            </div>
                          </div>
                          <div>
                            <div class="mb-1 text-[10px] font-black tracking-widest text-blue-400 uppercase">
                              Tutor
                            </div>
                            <div class="text-xs font-bold text-blue-800">
                              {selectedMovement.value.student.guardianName ||
                                "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Info button for other school payments that don't have student attached yet */}
                {selectedMovement.value.category === "SCHOOL" &&
                  !selectedMovement.value.student && (
                    <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                      <p class="text-xs leading-relaxed font-bold text-slate-400">
                        Pago de escuelita registrado manualmente. No tiene un
                        alumno vinculado automáticamente.
                      </p>
                    </div>
                  )}

                {!selectedMovement.value.booking &&
                  selectedMovement.value.category !== "SCHOOL" && (
                    <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                      <p class="text-xs leading-relaxed font-bold text-slate-400">
                        Este es un movimiento manual registrado directamente en
                        caja. No tiene una operación vinculada automáticamente.
                      </p>
                    </div>
                  )}

                <div class="pt-4">
                  <button
                    onClick$={() => (isDetailModalOpen.value = false)}
                    class="w-full rounded-2xl bg-slate-900 py-4 text-xs font-black tracking-widest text-white uppercase shadow-xl shadow-slate-900/10 transition-all hover:bg-slate-800"
                  >
                    Cerrar Detalle
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal.Panel>
      </Modal.Root>

      {/* New Movement Modal */}
      <Modal.Root bind:show={isMovementModalOpen}>
        <Modal.Panel class="max-w-md overflow-hidden rounded-3xl border-none p-0 shadow-2xl">
          <div class="relative bg-slate-900 p-8 text-white">
            <button
              onClick$={() => (isMovementModalOpen.value = false)}
              class="absolute top-6 right-6 text-slate-400 transition-colors hover:text-white"
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
            <h2 class="mb-1 text-2xl font-black tracking-tighter uppercase">
              Nuevo Movimiento
            </h2>
            <p class="text-sm font-medium text-slate-400">
              Registra un ingreso o egreso de caja
            </p>
          </div>

          <div class="bg-white p-8">
            <Form action={addMovementAction} class="space-y-5">
              <input
                type="hidden"
                name="registerId"
                value={cashData.value.latestRegister?.id}
              />

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Tipo
                  </label>
                  <select
                    name="type"
                    value={movementType.value}
                    onChange$={(e) =>
                      (movementType.value = (e.target as HTMLSelectElement)
                        .value as any)
                    }
                    class="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  >
                    <option value="INCOME">📈 Ingreso</option>
                    <option value="EXPENSE">📉 Egreso</option>
                  </select>
                </div>

                <div class="space-y-1.5">
                  <label class="block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Categoría
                  </label>
                  <select
                    name="category"
                    required
                    class="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  >
                    <option value="" disabled selected>
                      Seleccione...
                    </option>
                    {cashData.value.movementCategories
                      .filter((mc) => mc.type === movementType.value)
                      .map((mc) => (
                        <option
                          key={mc.id}
                          value={mc.id}
                        >{`${mc.icon} ${mc.name}`}</option>
                      ))}
                  </select>
                </div>
              </div>

              <p class="text-[10px] leading-snug font-medium text-slate-500">
                Podés agregar o editar categorías en{" "}
                <Link
                  href="/admin/cash/categorias-movimientos-caja/"
                  class="font-bold text-emerald-700 underline decoration-emerald-600/30 underline-offset-2 hover:text-emerald-900"
                >
                  Caja → Categorías (caja)
                </Link>
                .
              </p>

              <div class="space-y-1.5">
                <label class="block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                  Monto ($)
                </label>
                <div class="relative">
                  <span class="absolute top-1/2 left-4 -translate-y-1/2 font-black text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="1"
                    name="amount"
                    required
                    placeholder="0"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-4 pl-8 text-sm font-black text-slate-800 transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                  Método de Pago
                </label>
                <select
                  name="paymentMethod"
                  class="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                >
                  {cashData.value.paymentMethods
                    .filter((pm: any) => pm.isActive)
                    .map((pm: any) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name}
                      </option>
                    ))}
                </select>
              </div>

              <p class="text-[10px] leading-snug font-medium text-slate-500">
                Activá o agregá medios de pago en{" "}
                <Link
                  href="/admin/cash/medios-de-pago/"
                  class="font-bold text-emerald-700 underline decoration-emerald-600/30 underline-offset-2 hover:text-emerald-900"
                >
                  Caja → Medios de pago
                </Link>
                .
              </p>

              <div class="space-y-1.5">
                <label class="block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                  Descripción / Concepto
                </label>
                <textarea
                  name="description"
                  rows={2}
                  required
                  placeholder="Ej: Pago de luz, Venta de gaseosas..."
                  class="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div class="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick$={() => (isMovementModalOpen.value = false)}
                  class="flex-1 py-4 text-xs font-black tracking-widest text-slate-400 uppercase transition-colors hover:text-slate-600"
                >
                  Cancelar
                </button>
                <Button
                  look="primary"
                  type="submit"
                  disabled={addMovementAction.isRunning}
                  class="flex-[2] rounded-2xl bg-slate-900 py-4 text-xs font-black tracking-widest text-white uppercase shadow-xl shadow-slate-900/10 hover:bg-slate-800 disabled:opacity-50"
                >
                  {addMovementAction.isRunning
                    ? "Registrando..."
                    : "Confirmar Movimiento"}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>
    </div>
  );
});

export const head = {
  title: "Caja - GardenClubFutbol",
};
