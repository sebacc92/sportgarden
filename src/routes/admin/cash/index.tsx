import { component$, useSignal, useComputed$, useTask$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$ } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { cashRegisters, cashMovements, bookings, students } from "~/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { Button, Modal } from "~/components/ui";
import { cn } from "@qwik-ui/utils";

const BILL_DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 100];

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  BOOKING: { label: "Reserva", color: "bg-emerald-100 text-emerald-800" },
  SCHOOL: { label: "Escuelita", color: "bg-blue-100 text-blue-800" },
  GROUP_PAYMENT: { label: "Cuenta Cte.", color: "bg-purple-100 text-purple-800" },
  MAINTENANCE: { label: "Mantenimiento", color: "bg-orange-100 text-orange-800" },
  SALARY: { label: "Sueldo", color: "bg-red-100 text-red-800" },
  SERVICES: { label: "Servicios", color: "bg-yellow-100 text-yellow-800" },
  OTHER: { label: "Otro", color: "bg-slate-100 text-slate-700" },
};

const METHOD_META: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  MERCADO_PAGO: "Mercado Pago",
};

export const useCashData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const url = new URL(requestEvent.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 25;
  const offset = (page - 1) * limit;

  const registers = await db.query.cashRegisters.findMany({
    orderBy: [desc(cashRegisters.openedAt)],
    limit: 1,
  });
  const latestRegister = registers[0] || null;
  let allMovements: any[] = [];
  let paginatedMovements: any[] = [];
  let totalCount = 0;

  if (latestRegister) {
    allMovements = await db.query.cashMovements.findMany({
      where: eq(cashMovements.registerId, latestRegister.id),
      orderBy: [desc(cashMovements.createdAt)],
    });

    totalCount = allMovements.length;
    paginatedMovements = allMovements.slice(offset, offset + limit);

    // Fetch related bookings for the current page
    const bookingIds = paginatedMovements
      .filter((m) => m.category === "BOOKING" && m.referenceId)
      .map((m) => m.referenceId);

    if (bookingIds.length > 0) {
      const relatedBookings = await db.query.bookings.findMany({
        where: inArray(bookings.id, bookingIds),
        with: {
          pitch: true,
          user: true,
          guestRequest: true,
        },
      });

      // Attach booking info to movements
      paginatedMovements = paginatedMovements.map((m) => {
        if (m.category === "BOOKING" && m.referenceId) {
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
      const relatedStudents = await db.query.students.findMany({
        where: inArray(students.id, studentIds),
      });

      paginatedMovements = paginatedMovements.map((m) => {
        if (m.category === "SCHOOL" && m.referenceId) {
          const student = relatedStudents.find((s) => s.id === m.referenceId);
          return { ...m, student };
        }
        return m;
      });
    }
  }

  const totalIncomes = allMovements.filter(m => m.type === "INCOME").reduce((a, m) => a + m.amount, 0);
  const totalExpenses = allMovements.filter(m => m.type === "EXPENSE").reduce((a, m) => a + m.amount, 0);
  const currentBalance = (latestRegister?.openingBalance || 0) + totalIncomes - totalExpenses;

  // Desglose por método de pago
  const byMethod: Record<string, { incomes: number; expenses: number }> = {
    CASH: { incomes: 0, expenses: 0 },
    TRANSFER: { incomes: 0, expenses: 0 },
    CARD: { incomes: 0, expenses: 0 },
    MERCADO_PAGO: { incomes: 0, expenses: 0 },
  };
  for (const m of allMovements) {
    if (byMethod[m.paymentMethod]) {
      if (m.type === "INCOME") byMethod[m.paymentMethod].incomes += m.amount;
      else byMethod[m.paymentMethod].expenses += m.amount;
    }
  }

  return {
    latestRegister,
    movements: paginatedMovements,
    totalIncomes,
    totalExpenses,
    currentBalance,
    byMethod,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount
    }
  };
});

export const useToggleRegisterAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { action, balance, registerId, notes } = data;
    if (action === "OPEN") {
      const id = crypto.randomUUID();
      await db.insert(cashRegisters).values({ id, openingBalance: Number(balance) || 0, status: "OPEN", notes: notes || null });
      return { success: true };
    } else if (action === "CLOSE") {
      // Parse billCount from JSON string
      let billCount: Record<string, number> | null = null;
      if (data.billCountJson) {
        try { billCount = JSON.parse(data.billCountJson as string); } catch {
          // Ignorar error de parseo si el JSON es inválido
        }
      }
      await db.update(cashRegisters).set({
        status: "CLOSED",
        closingBalance: Number(balance) || 0,
        closedAt: new Date(),
        billCount: billCount ?? undefined,
        notes: notes || null,
      }).where(eq(cashRegisters.id, registerId!));
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
  })
);

export const useAddMovementAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    await db.insert(cashMovements).values({
      id: crypto.randomUUID(),
      registerId: data.registerId,
      type: data.type as any,
      category: data.category as any,
      amount: Number(data.amount),
      description: data.description,
      paymentMethod: data.paymentMethod as any,
    });
    return { success: true };
  },
  zod$({
    registerId: z.string(),
    type: z.enum(["INCOME", "EXPENSE"]),
    category: z.enum(["BOOKING", "SCHOOL", "GROUP_PAYMENT", "MAINTENANCE", "SALARY", "SERVICES", "OTHER"]),
    amount: z.string(),
    description: z.string().optional(),
    paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "MERCADO_PAGO"]),
  })
);

export default component$(() => {
  const cashData = useCashData();
  const toggleAction = useToggleRegisterAction();
  const addMovementAction = useAddMovementAction();
  const isOpen = cashData.value.latestRegister?.status === "OPEN";
  const showCloseModal = useSignal(false);
  const isMovementModalOpen = useSignal(false);
  const selectedMovement = useSignal<any>(null);
  const isDetailModalOpen = useSignal(false);

  // Arqueo de billetes
  const bills = useSignal<Record<number, number>>(
    Object.fromEntries(BILL_DENOMINATIONS.map(d => [d, 0]))
  );
  const billTotal = useComputed$(() =>
    BILL_DENOMINATIONS.reduce((sum, d) => sum + d * (bills.value[d] || 0), 0)
  );

  const reg = cashData.value.latestRegister;
  const openedAtStr = reg?.openedAt
    ? new Date(reg.openedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
    : "";

  // Close modal when movement is added
  useTask$(({ track }) => {
    track(() => addMovementAction.value);
    if (addMovementAction.value?.success) {
      isMovementModalOpen.value = false;
    }
  });

  return (
    <div class="p-4 md:p-6 bg-slate-50 min-h-full font-sans print:bg-white print:p-0">
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
      
      <div class="max-w-6xl mx-auto space-y-5">
        
        {/* Print-only Header */}
        <div class="hidden print:block mb-6 border-b border-slate-900 pb-4">
          <h1 class="text-xl font-black">SportGarden - Reporte de Caja</h1>
          <p class="text-xs text-slate-500 font-bold uppercase">{new Date().toLocaleString("es-AR")}</p>
        </div>

        {/* Nav */}
        <div class="flex gap-1 border-b border-slate-200 pb-4 print:hidden">
          <a href="/admin/cash/" class="px-4 py-2 font-bold text-sm rounded-t-lg text-emerald-700 bg-white border border-b-white border-slate-200 -mb-px">Caja Actual</a>
          <a href="/admin/cash/history/" class="px-4 py-2 font-bold text-sm text-slate-500 hover:text-slate-800 transition-colors">Historial</a>
          <a href="/admin/cash/balances/" class="px-4 py-2 font-bold text-sm text-slate-500 hover:text-slate-800 transition-colors">Balances</a>
        </div>

        {/* Header */}
        <div class="flex flex-wrap justify-between items-start gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-slate-300">
          <div>
            <h1 class="text-2xl font-black tracking-tight text-slate-800">Caja Actual</h1>
            {isOpen ? (
              <p class="text-slate-500 mt-1 text-sm">
                Abierta el <span class="font-semibold text-slate-700">{openedAtStr}</span>
              </p>
            ) : (
              <p class="text-slate-400 mt-1 text-sm">Caja cerrada · Ábrela para comenzar a operar.</p>
            )}
          </div>

          <div class="flex gap-3 print:hidden">
            {isOpen ? (
              <>
                <button
                  onClick$={() => (isMovementModalOpen.value = true)}
                  class="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Nuevo Movimiento
                </button>
                <button
                  onClick$={() => window.print()}
                  class="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>
                  Reporte del Día
                </button>
                <button
                  onClick$={() => (showCloseModal.value = true)}
                  class="flex items-center gap-2 px-5 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-bold rounded-xl text-sm transition-colors"
                >
                  Cerrar Caja
                </button>
              </>
            ) : (
              <Form action={toggleAction} class="flex gap-2 items-center">
                <input type="hidden" name="action" value="OPEN" />
                <input type="number" name="balance" placeholder="Monto Inicial $" required
                  class="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm w-44" />
                <Button look="primary" type="submit" class="bg-emerald-500 text-white hover:bg-emerald-600 font-bold px-5 py-2 rounded-xl shadow text-sm">
                  Abrir Caja
                </Button>
              </Form>
            )}
          </div>
        </div>

        {/* Close Modal */}
        {showCloseModal.value && (
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
              <div class="flex justify-between items-center">
                <h2 class="text-xl font-black text-slate-800">Cerrar Caja</h2>
                <button onClick$={() => (showCloseModal.value = false)} class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
              </div>

              <div>
                <h3 class="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wider">Arqueo de Billetes</h3>
                <div class="space-y-2">
                  {BILL_DENOMINATIONS.map((d) => (
                    <div key={d} class="flex items-center gap-3">
                      <span class="w-24 text-sm font-bold text-slate-600 text-right">${d.toLocaleString("es-AR")}</span>
                      <input
                        type="number" min="0" value={bills.value[d] || 0}
                        onInput$={(e) => {
                          const v = parseInt((e.target as HTMLInputElement).value) || 0;
                          bills.value = { ...bills.value, [d]: v };
                        }}
                        class="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                      <span class="text-sm text-slate-500 font-medium">
                        = ${((bills.value[d] || 0) * d).toLocaleString("es-AR")}
                      </span>
                    </div>
                  ))}
                </div>
                <div class="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                  <span class="font-bold text-emerald-700 text-sm">Total en Efectivo</span>
                  <span class="text-xl font-black text-emerald-800">${billTotal.value.toLocaleString("es-AR")}</span>
                </div>
              </div>

              <Form action={toggleAction} class="space-y-3">
                <input type="hidden" name="action" value="CLOSE" />
                <input type="hidden" name="registerId" value={cashData.value.latestRegister?.id} />
                <input type="hidden" name="balance" value={billTotal.value.toString()} />
                <input type="hidden" name="billCountJson" value={JSON.stringify(bills.value)} />
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Observaciones del turno</label>
                  <textarea name="notes" rows={2} placeholder="Ej: turno tranquilo, falta cambio..."
                    class="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div class="flex gap-3 pt-1">
                  <button type="button" onClick$={() => (showCloseModal.value = false)}
                    class="flex-1 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 text-sm transition-colors">
                    Cancelar
                  </button>
                  <Button look="primary" type="submit" class="flex-1 py-2 bg-red-500 text-white hover:bg-red-600 rounded-xl font-bold text-sm">
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
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-2">
              <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                  </div>
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingresos Totales</div>
                </div>
                <div class="text-2xl font-black text-emerald-600">${cashData.value.totalIncomes.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div>
                <div class="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
                  {Object.entries(cashData.value.byMethod).filter(([, v]) => v.incomes > 0).map(([k, v]) => (
                    <div key={k} class="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                      <span>{METHOD_META[k]}</span>
                      <span class="text-emerald-600">+${v.incomes.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div class="flex items-center gap-3 mb-3">
                  <div class="p-2 bg-red-50 rounded-lg text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg>
                  </div>
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Egresos Totales</div>
                </div>
                <div class="text-2xl font-black text-red-600">${cashData.value.totalExpenses.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div>
                <div class="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
                  {Object.entries(cashData.value.byMethod).filter(([, v]) => v.expenses > 0).map(([k, v]) => (
                    <div key={k} class="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                      <span>{METHOD_META[k]}</span>
                      <span class="text-red-600">-${v.expenses.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div class="bg-slate-900 p-5 rounded-2xl shadow-xl border border-slate-800 text-white sm:col-span-2">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div class="p-2 bg-white/10 rounded-lg text-emerald-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>
                    </div>
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Balance del Turno</div>
                  </div>
                  <div class="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Inicial: ${cashData.value.latestRegister?.openingBalance?.toLocaleString("es-AR")}
                  </div>
                </div>
                <div class="flex items-baseline gap-2">
                  <div class="text-4xl font-black text-emerald-400">${cashData.value.currentBalance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div>
                  <div class="text-sm font-bold text-slate-500 uppercase tracking-widest">AR$</div>
                </div>
                <div class="mt-4 flex gap-2">
                  {Object.entries(cashData.value.byMethod).map(([k, v]) => {
                    const bal = v.incomes - v.expenses;
                    if (bal === 0 && k !== 'CASH') return null;
                    return (
                      <div key={k} class="px-3 py-1 bg-white/5 rounded-lg border border-white/5 flex flex-col">
                        <span class="text-[8px] font-black text-slate-500 uppercase">{METHOD_META[k]}</span>
                        <span class={cn("text-[10px] font-bold", bal >= 0 ? "text-emerald-400" : "text-red-400")}>
                          ${bal.toLocaleString("es-AR")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Movements List - Full Width */}
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div class="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center print:bg-white print:p-0 print:pb-3">
                <div class="flex items-center gap-3">
                  <h2 class="text-lg font-black text-slate-800">Movimientos del Turno</h2>
                  <div class="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-black uppercase tracking-widest print:hidden">
                    {cashData.value.pagination.totalCount} registros
                  </div>
                </div>
                <button
                  onClick$={() => (isMovementModalOpen.value = true)}
                  class="flex items-center gap-2 text-xs font-black text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-widest print:hidden"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Agregar Movimiento
                </button>
              </div>

              <div class="flex-1 overflow-auto">
                <table class="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr class="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
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
                            <div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>
                            </div>
                            <p class="text-slate-400 font-medium">No hay movimientos aún en este turno.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      cashData.value.movements.map((m) => {
                        const cat = CATEGORY_META[m.category] || CATEGORY_META["OTHER"];
                        return (
                          <tr key={m.id} class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors group">
                            <td class="p-4 pl-6 text-slate-500 text-xs font-bold whitespace-nowrap">
                              {new Date(m.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td class="p-4">
                              <span class={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight ${cat.color}`}>{cat.label}</span>
                            </td>
                            <td class="p-4 text-slate-600 font-medium max-w-md truncate">{m.description || <span class="text-slate-300">—</span>}</td>
                            <td class="p-4">
                              <div class="flex items-center gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                <span class="text-xs text-slate-500 font-bold uppercase tracking-widest">{METHOD_META[m.paymentMethod] || m.paymentMethod}</span>
                              </div>
                            </td>
                            <td class={`p-4 text-right font-black text-base ${m.type === "INCOME" ? "text-emerald-600" : "text-red-600"}`}>
                              {m.type === "INCOME" ? "+" : "-"}${m.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                            </td>
                            <td class="p-4 pr-6 text-center print:hidden">
                              {(m.category === "BOOKING" && m.booking) || (m.category === "SCHOOL" && m.student) ? (
                                <button
                                  onClick$={() => {
                                    selectedMovement.value = m;
                                    isDetailModalOpen.value = true;
                                  }}
                                  class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-90"
                                  title="Ver detalle"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
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
              {cashData.value.pagination.totalPages > 1 && (
                <div class="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between print:hidden">
                  <div class="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Página {cashData.value.pagination.currentPage} de {cashData.value.pagination.totalPages}
                  </div>
                  <div class="flex gap-2">
                    <button
                      disabled={cashData.value.pagination.currentPage === 1}
                      onClick$={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set("page", (cashData.value.pagination.currentPage - 1).toString());
                        window.location.href = url.toString();
                      }}
                      class="px-4 py-2 text-xs font-black uppercase tracking-widest border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Anterior
                    </button>
                    <button
                      disabled={cashData.value.pagination.currentPage === cashData.value.pagination.totalPages}
                      onClick$={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set("page", (cashData.value.pagination.currentPage + 1).toString());
                        window.location.href = url.toString();
                      }}
                      class="px-4 py-2 text-xs font-black uppercase tracking-widest border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
        <Modal.Panel class="max-w-md p-0 rounded-3xl overflow-hidden shadow-2xl border-none">
          {selectedMovement.value && (
            <div class="flex flex-col">
              <div class="bg-emerald-600 p-8 text-white relative">
                <button
                  onClick$={() => (isDetailModalOpen.value = false)}
                  class="absolute top-6 right-6 text-white/60 hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
                <div class="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-2">Detalle de Operación</div>
                <h2 class="text-2xl font-black tracking-tighter uppercase mb-1">
                  {CATEGORY_META[selectedMovement.value.category]?.label || "Movimiento"}
                </h2>
                <div class="flex items-center gap-2 text-emerald-100 text-xs font-bold">
                  <span>{new Date(selectedMovement.value.createdAt).toLocaleDateString("es-AR")}</span>
                  <span>•</span>
                  <span>{new Date(selectedMovement.value.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>

              <div class="p-8 bg-white space-y-8">
                {/* Movement Info */}
                <div class="flex justify-between items-end pb-6 border-b border-slate-100">
                  <div>
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto Registrado</div>
                    <div class={`text-3xl font-black ${selectedMovement.value.type === "INCOME" ? "text-emerald-600" : "text-red-600"}`}>
                      {selectedMovement.value.type === "INCOME" ? "+" : "-"}${selectedMovement.value.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Método</div>
                    <div class="text-sm font-black text-slate-700 uppercase tracking-tight">{METHOD_META[selectedMovement.value.paymentMethod]}</div>
                  </div>
                </div>

                {/* Booking Info if available */}
                {selectedMovement.value.booking && (
                  <div class="space-y-6">
                    <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                      <div class="flex items-center gap-3">
                        <div class="p-2 bg-white rounded-xl text-emerald-600 shadow-sm border border-slate-100">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l-3-3Z"/></svg>
                        </div>
                        <div>
                          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancha / Turno</div>
                          <div class="text-sm font-black text-slate-800">{selectedMovement.value.booking.pitch?.name}</div>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Fecha</div>
                          <div class="text-xs font-bold text-slate-600">
                            {new Date(selectedMovement.value.booking.startTime).toLocaleDateString("es-AR", { weekday: 'long', day: 'numeric', month: 'long' })}
                          </div>
                        </div>
                        <div>
                          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Horario</div>
                          <div class="text-xs font-bold text-slate-600">
                            {new Date(selectedMovement.value.booking.startTime).toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedMovement.value.booking.endTime).toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="space-y-4">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <div>
                          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</div>
                          <div class="text-sm font-bold text-slate-800">
                            {selectedMovement.value.booking.user?.name || selectedMovement.value.booking.guestRequest?.name || "Cliente Final"}
                          </div>
                          <div class="text-[10px] text-slate-500 font-medium">
                            {selectedMovement.value.booking.user?.email || selectedMovement.value.booking.guestRequest?.phone || "Sin contacto"}
                          </div>
                        </div>
                      </div>

                      {selectedMovement.value.booking.extras && selectedMovement.value.booking.extras.length > 0 && (
                        <div class="pt-2">
                          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Servicios Extra</div>
                          <div class="flex flex-wrap gap-2">
                            {selectedMovement.value.booking.extras.map((extra: string) => (
                              <span key={extra} class="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-tight border border-blue-100">
                                {extra}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* School Info if available */}
                {selectedMovement.value.category === "SCHOOL" && selectedMovement.value.student && (
                  <div class="space-y-6">
                    <div class="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                      <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                        </div>
                        <div>
                          <div class="text-[10px] font-black text-blue-400 uppercase tracking-widest">Alumno / Escuelita</div>
                          <div class="text-base font-black text-blue-900 leading-tight">{selectedMovement.value.student.name}</div>
                        </div>
                      </div>

                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <div class="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Categoría</div>
                          <div class="px-3 py-1 bg-white rounded-lg border border-blue-100 text-xs font-black text-blue-600 inline-block">
                            {selectedMovement.value.student.category}
                          </div>
                        </div>
                        <div>
                          <div class="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Tutor</div>
                          <div class="text-xs font-bold text-blue-800">{selectedMovement.value.student.guardianName || "-"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info button for other school payments that don't have student attached yet */}
                {selectedMovement.value.category === "SCHOOL" && !selectedMovement.value.student && (
                  <div class="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                    <p class="text-xs font-bold text-slate-400 leading-relaxed">
                      Pago de escuelita registrado manualmente. 
                      No tiene un alumno vinculado automáticamente.
                    </p>
                  </div>
                )}

                {!selectedMovement.value.booking && selectedMovement.value.category !== "SCHOOL" && (
                  <div class="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                    <p class="text-xs font-bold text-slate-400 leading-relaxed">
                      Este es un movimiento manual registrado directamente en caja. 
                      No tiene una operación vinculada automáticamente.
                    </p>
                  </div>
                )}

                <div class="pt-4">
                  <button
                    onClick$={() => (isDetailModalOpen.value = false)}
                    class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
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
        <Modal.Panel class="max-w-md p-0 rounded-3xl overflow-hidden shadow-2xl border-none">
          <div class="bg-slate-900 p-8 text-white relative">
            <button
              onClick$={() => (isMovementModalOpen.value = false)}
              class="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <h2 class="text-2xl font-black tracking-tighter uppercase mb-1">Nuevo Movimiento</h2>
            <p class="text-slate-400 text-sm font-medium">Registra un ingreso o egreso de caja</p>
          </div>

          <div class="p-8 bg-white">
            <Form action={addMovementAction} class="space-y-5">
              <input type="hidden" name="registerId" value={cashData.value.latestRegister?.id} />

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
                  <select name="type" class="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold text-slate-700 appearance-none cursor-pointer transition-all">
                    <option value="INCOME">📈 Ingreso</option>
                    <option value="EXPENSE">📉 Egreso</option>
                  </select>
                </div>

                <div class="space-y-1.5">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</label>
                  <select name="category" class="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold text-slate-700 appearance-none cursor-pointer transition-all">
                    <option value="BOOKING">⚽ Reserva</option>
                    <option value="SCHOOL">🏫 Escuelita</option>
                    <option value="GROUP_PAYMENT">🤝 Cuenta Cte.</option>
                    <option value="MAINTENANCE">🔧 Mant.</option>
                    <option value="SALARY">💼 Sueldo</option>
                    <option value="SERVICES">💡 Servicios</option>
                    <option value="OTHER">📌 Otro</option>
                  </select>
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto ($)</label>
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                  <input type="number" step="0.01" name="amount" required placeholder="0.00"
                    class="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-black text-slate-800 transition-all" />
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Método de Pago</label>
                <select name="paymentMethod" class="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold text-slate-700 appearance-none cursor-pointer transition-all">
                  <option value="CASH">💵 Efectivo</option>
                  <option value="TRANSFER">🏦 Transferencia</option>
                  <option value="CARD">💳 Tarjeta</option>
                  <option value="MERCADO_PAGO">🔵 Mercado Pago</option>
                </select>
              </div>

              <div class="space-y-1.5">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</label>
                <textarea name="description" rows={2} placeholder="Detalle opcional del movimiento..."
                  class="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium text-slate-600 transition-all resize-none" />
              </div>

              <div class="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick$={() => (isMovementModalOpen.value = false)}
                  class="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <Button look="primary" type="submit" disabled={addMovementAction.isRunning}
                  class="flex-[2] py-4 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20">
                  {addMovementAction.isRunning ? "Guardando..." : "Registrar"}
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
  title: "Caja - SportGardenFutbol",
};
