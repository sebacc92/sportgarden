import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$ } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { cashRegisters, cashMovements } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "~/components/ui";

export const useCashData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  // Get latest cash register
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

  // Calculate totals
  const totalIncomes = movements.filter(m => m.type === "INCOME").reduce((acc, m) => acc + m.amount, 0);
  const totalExpenses = movements.filter(m => m.type === "EXPENSE").reduce((acc, m) => acc + m.amount, 0);
  const currentBalance = (latestRegister?.openingBalance || 0) + totalIncomes - totalExpenses;

  return {
    latestRegister,
    movements,
    totalIncomes,
    totalExpenses,
    currentBalance,
  };
});

export const useToggleRegisterAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { action, balance, registerId } = data;

    if (action === "OPEN") {
      const id = crypto.randomUUID();
      await db.insert(cashRegisters).values({
        id,
        openingBalance: Number(balance) || 0,
        status: "OPEN",
      });
      return { success: true, message: "Caja abierta exitosamente." };
    } else if (action === "CLOSE") {
      await db.update(cashRegisters).set({
        status: "CLOSED",
        closingBalance: Number(balance) || 0,
        closedAt: new Date(),
      }).where(eq(cashRegisters.id, registerId!));
      return { success: true, message: "Caja cerrada exitosamente." };
    }

    return { success: false, message: "Acción inválida" };
  },
  zod$({
    action: z.enum(["OPEN", "CLOSE"]),
    balance: z.string().optional(),
    registerId: z.string().optional(),
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
    category: z.enum(["BOOKING", "SCHOOL", "GROUP_PAYMENT", "MAINTENANCE", "OTHER"]),
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

  return (
    <div class="p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div class="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 class="text-3xl font-black tracking-tight text-slate-800">Caja</h1>
            <p class="text-slate-500 mt-1">
              {isOpen ? "Caja actualmente abierta." : "Caja cerrada. Ábrela para comenzar a operar."}
            </p>
          </div>

          <Form action={toggleAction} class="flex gap-3">
            {isOpen ? (
              <>
                <input type="hidden" name="action" value="CLOSE" />
                <input type="hidden" name="registerId" value={cashData.value.latestRegister?.id} />
                <input type="hidden" name="balance" value={cashData.value.currentBalance.toString()} />
                <Button look="secondary" type="submit" class="bg-red-50 text-red-600 hover:bg-red-100 border-red-200 font-bold px-6 py-2 rounded-xl">
                  Cerrar Caja
                </Button>
              </>
            ) : (
              <>
                <input type="hidden" name="action" value="OPEN" />
                <input type="number" name="balance" placeholder="Monto Inicial" required class="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                <Button look="primary" type="submit" class="bg-emerald-500 text-white hover:bg-emerald-600 font-bold px-6 py-2 rounded-xl shadow-md">
                  Abrir Caja
                </Button>
              </>
            )}
          </Form>
        </div>

        {isOpen && (
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Stats */}
            <div class="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div class="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Ingresos</div>
                <div class="text-3xl font-black text-emerald-600">${cashData.value.totalIncomes.toFixed(2)}</div>
              </div>
              <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div class="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Egresos</div>
                <div class="text-3xl font-black text-red-600">${cashData.value.totalExpenses.toFixed(2)}</div>
              </div>
              <div class="bg-slate-900 p-6 rounded-2xl shadow-md border border-slate-800 text-white">
                <div class="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Balance Actual</div>
                <div class="text-4xl font-black text-emerald-400">${cashData.value.currentBalance.toFixed(2)}</div>
                <div class="text-xs text-slate-500 mt-2">Incluye saldo inicial: ${cashData.value.latestRegister?.openingBalance}</div>
              </div>
            </div>

            {/* Add Movement Form */}
            <div class="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
              <h2 class="text-xl font-black text-slate-800 mb-4">Nuevo Movimiento</h2>
              <Form action={addMovementAction} class="space-y-4">
                <input type="hidden" name="registerId" value={cashData.value.latestRegister?.id} />

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
                  <select name="type" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold text-slate-700">
                    <option value="INCOME">Ingreso</option>
                    <option value="EXPENSE">Egreso</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Categoría</label>
                  <select name="category" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold text-slate-700">
                    <option value="OTHER">Otro</option>
                    <option value="MAINTENANCE">Mantenimiento</option>
                    <option value="BOOKING">Reserva</option>
                    <option value="SCHOOL">Escuelita</option>
                    <option value="GROUP_PAYMENT">Pago de Grupo</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto ($)</label>
                  <input type="number" step="0.01" name="amount" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
                  <select name="paymentMethod" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold text-slate-700">
                    <option value="CASH">Efectivo</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="MERCADO_PAGO">Mercado Pago</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción</label>
                  <textarea name="description" rows={2} class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"></textarea>
                </div>

                <Button look="primary" type="submit" disabled={addMovementAction.isRunning} class="w-full py-3 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold mt-2">
                  {addMovementAction.isRunning ? "Guardando..." : "Registrar"}
                </Button>
              </Form>
            </div>

            {/* Movements List */}
            <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div class="p-6 border-b border-slate-100 bg-slate-50/50">
                <h2 class="text-xl font-black text-slate-800">Movimientos Recientes</h2>
              </div>
              <div class="flex-1 overflow-auto p-0">
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th class="p-4">Hora</th>
                      <th class="p-4">Categoría</th>
                      <th class="p-4">Descripción</th>
                      <th class="p-4">Método</th>
                      <th class="p-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody class="text-sm font-semibold text-slate-700">
                    {cashData.value.movements.length === 0 ? (
                      <tr>
                        <td colSpan={5} class="p-8 text-center text-slate-500">
                          No hay movimientos en este turno.
                        </td>
                      </tr>
                    ) : (
                      cashData.value.movements.map((m) => (
                        <tr key={m.id} class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                          <td class="p-4">
                            {new Date(m.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td class="p-4">
                            <span class="px-2 py-1 bg-slate-100 rounded-md text-xs">{m.category}</span>
                          </td>
                          <td class="p-4 text-slate-500">{m.description || "-"}</td>
                          <td class="p-4">{m.paymentMethod}</td>
                          <td class={`p-4 text-right font-black ${m.type === "INCOME" ? "text-emerald-600" : "text-red-600"}`}>
                            {m.type === "INCOME" ? "+" : "-"}${m.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))
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
