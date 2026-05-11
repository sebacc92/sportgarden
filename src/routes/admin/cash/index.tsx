import { component$, useSignal, useComputed$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$ } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { cashRegisters, cashMovements } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "~/components/ui";

const BILL_DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 100];

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  BOOKING:       { label: "Reserva",       color: "bg-emerald-100 text-emerald-800" },
  SCHOOL:        { label: "Escuelita",     color: "bg-blue-100 text-blue-800" },
  GROUP_PAYMENT: { label: "Cuenta Cte.",   color: "bg-purple-100 text-purple-800" },
  MAINTENANCE:   { label: "Mantenimiento", color: "bg-orange-100 text-orange-800" },
  SALARY:        { label: "Sueldo",        color: "bg-red-100 text-red-800" },
  SERVICES:      { label: "Servicios",     color: "bg-yellow-100 text-yellow-800" },
  OTHER:         { label: "Otro",          color: "bg-slate-100 text-slate-700" },
};

const METHOD_META: Record<string, string> = {
  CASH:        "Efectivo",
  TRANSFER:    "Transferencia",
  CARD:        "Tarjeta",
  MERCADO_PAGO:"Mercado Pago",
};

export const useCashData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const registers = await db.query.cashRegisters.findMany({
    orderBy: [desc(cashRegisters.openedAt)],
    limit: 1,
  });
  const latestRegister = registers[0] || null;
  let movements: any[] = [];
  if (latestRegister) {
    movements = await db.query.cashMovements.findMany({
      where: eq(cashMovements.registerId, latestRegister.id),
      orderBy: [desc(cashMovements.createdAt)],
    });
  }
  const totalIncomes  = movements.filter(m => m.type === "INCOME").reduce((a, m) => a + m.amount, 0);
  const totalExpenses = movements.filter(m => m.type === "EXPENSE").reduce((a, m) => a + m.amount, 0);
  const currentBalance = (latestRegister?.openingBalance || 0) + totalIncomes - totalExpenses;

  // Desglose por método de pago
  const byMethod: Record<string, { incomes: number; expenses: number }> = {
    CASH: { incomes: 0, expenses: 0 },
    TRANSFER: { incomes: 0, expenses: 0 },
    CARD: { incomes: 0, expenses: 0 },
    MERCADO_PAGO: { incomes: 0, expenses: 0 },
  };
  for (const m of movements) {
    if (byMethod[m.paymentMethod]) {
      if (m.type === "INCOME") byMethod[m.paymentMethod].incomes += m.amount;
      else byMethod[m.paymentMethod].expenses += m.amount;
    }
  }

  return { latestRegister, movements, totalIncomes, totalExpenses, currentBalance, byMethod };
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
        try { billCount = JSON.parse(data.billCountJson as string); } catch {}
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

  return (
    <div class="p-4 md:p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-6xl mx-auto space-y-5">

        {/* Nav */}
        <div class="flex gap-1 border-b border-slate-200 pb-4 print:hidden">
          <a href="/admin/cash/" class="px-4 py-2 font-bold text-sm rounded-t-lg text-emerald-700 bg-white border border-b-white border-slate-200 -mb-px">Caja Actual</a>
          <a href="/admin/cash/history/" class="px-4 py-2 font-bold text-sm text-slate-500 hover:text-slate-800 transition-colors">Historial</a>
          <a href="/admin/cash/balances/" class="px-4 py-2 font-bold text-sm text-slate-500 hover:text-slate-800 transition-colors">Balances</a>
        </div>

        {/* Header */}
        <div class="flex flex-wrap justify-between items-start gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
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
                  onClick$={() => window.print()}
                  class="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
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
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Stats */}
            <div class="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Ingresos</div>
                <div class="text-3xl font-black text-emerald-600">${cashData.value.totalIncomes.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div>
                <div class="mt-3 space-y-1">
                  {Object.entries(cashData.value.byMethod).filter(([, v]) => v.incomes > 0).map(([k, v]) => (
                    <div key={k} class="flex justify-between text-xs text-slate-500">
                      <span>{METHOD_META[k]}</span>
                      <span class="font-semibold text-emerald-600">+${v.incomes.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Egresos</div>
                <div class="text-3xl font-black text-red-600">${cashData.value.totalExpenses.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div>
                <div class="mt-3 space-y-1">
                  {Object.entries(cashData.value.byMethod).filter(([, v]) => v.expenses > 0).map(([k, v]) => (
                    <div key={k} class="flex justify-between text-xs text-slate-500">
                      <span>{METHOD_META[k]}</span>
                      <span class="font-semibold text-red-600">-${v.expenses.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div class="bg-slate-900 p-5 rounded-2xl shadow-md border border-slate-800 text-white">
                <div class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Balance Actual</div>
                <div class="text-4xl font-black text-emerald-400">${cashData.value.currentBalance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div>
                <div class="text-xs text-slate-500 mt-2">Saldo inicial: ${cashData.value.latestRegister?.openingBalance?.toLocaleString("es-AR")}</div>
              </div>
            </div>

            {/* Add Movement Form */}
            <div class="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit print:hidden">
              <h2 class="text-lg font-black text-slate-800 mb-4">Nuevo Movimiento</h2>
              <Form action={addMovementAction} class="space-y-3">
                <input type="hidden" name="registerId" value={cashData.value.latestRegister?.id} />

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
                  <select name="type" class="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold text-slate-700">
                    <option value="INCOME">📈 Ingreso</option>
                    <option value="EXPENSE">📉 Egreso</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Categoría</label>
                  <select name="category" class="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold text-slate-700">
                    <option value="BOOKING">⚽ Reserva</option>
                    <option value="SCHOOL">🏫 Escuelita</option>
                    <option value="GROUP_PAYMENT">🤝 Cuenta Corriente</option>
                    <option value="MAINTENANCE">🔧 Mantenimiento</option>
                    <option value="SALARY">💼 Sueldo</option>
                    <option value="SERVICES">💡 Servicios</option>
                    <option value="OTHER">📌 Otro</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto ($)</label>
                  <input type="number" step="0.01" name="amount" required placeholder="0.00"
                    class="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" />
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
                  <select name="paymentMethod" class="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold text-slate-700">
                    <option value="CASH">💵 Efectivo</option>
                    <option value="TRANSFER">🏦 Transferencia</option>
                    <option value="CARD">💳 Tarjeta</option>
                    <option value="MERCADO_PAGO">🔵 Mercado Pago</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción</label>
                  <textarea name="description" rows={2} placeholder="Detalle opcional..."
                    class="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" />
                </div>

                <Button look="primary" type="submit" disabled={addMovementAction.isRunning}
                  class="w-full py-2.5 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold text-sm mt-1">
                  {addMovementAction.isRunning ? "Guardando..." : "Registrar Movimiento"}
                </Button>
              </Form>
            </div>

            {/* Movements List */}
            <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div class="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center print:bg-white print:p-0 print:pb-3">
                <h2 class="text-lg font-black text-slate-800">Movimientos del Turno</h2>
                <span class="text-xs text-slate-500 font-medium">{cashData.value.movements.length} registros</span>
              </div>
              <div class="flex-1 overflow-auto">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th class="p-3">Hora</th>
                      <th class="p-3">Categoría</th>
                      <th class="p-3">Descripción</th>
                      <th class="p-3">Método</th>
                      <th class="p-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody class="text-sm text-slate-700">
                    {cashData.value.movements.length === 0 ? (
                      <tr>
                        <td colSpan={5} class="p-10 text-center text-slate-400 font-medium">
                          No hay movimientos aún en este turno.
                        </td>
                      </tr>
                    ) : (
                      cashData.value.movements.map((m) => {
                        const cat = CATEGORY_META[m.category] || CATEGORY_META["OTHER"];
                        return (
                          <tr key={m.id} class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                            <td class="p-3 text-slate-500 text-xs font-medium whitespace-nowrap">
                              {new Date(m.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td class="p-3">
                              <span class={`px-2 py-0.5 rounded-md text-xs font-bold ${cat.color}`}>{cat.label}</span>
                            </td>
                            <td class="p-3 text-slate-500 text-sm">{m.description || <span class="text-slate-300">—</span>}</td>
                            <td class="p-3 text-xs text-slate-500">{METHOD_META[m.paymentMethod] || m.paymentMethod}</td>
                            <td class={`p-3 text-right font-black text-sm ${m.type === "INCOME" ? "text-emerald-600" : "text-red-600"}`}>
                              {m.type === "INCOME" ? "+" : "-"}${m.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
});

export const head = {
  title: "Caja - SportGardenFutbol",
};
