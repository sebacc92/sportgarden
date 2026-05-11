import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { cashRegisters, cashMovements } from "~/db/schema";
import { desc, eq } from "drizzle-orm";

export const useCashHistoryData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  // Get closed cash registers
  const registers = await db.query.cashRegisters.findMany({
    where: eq(cashRegisters.status, "CLOSED"),
    orderBy: [desc(cashRegisters.closedAt)],
    limit: 50, // Get last 50
  });

  // For each register, get its movements to calculate balance
  const registersWithTotals = await Promise.all(
    registers.map(async (reg) => {
      const movements = await db.query.cashMovements.findMany({
        where: eq(cashMovements.registerId, reg.id),
      });

      const totalIncomes = movements.filter(m => m.type === "INCOME").reduce((acc, m) => acc + m.amount, 0);
      const totalExpenses = movements.filter(m => m.type === "EXPENSE").reduce((acc, m) => acc + m.amount, 0);

      return {
        ...reg,
        totalIncomes,
        totalExpenses,
        calculatedBalance: reg.openingBalance + totalIncomes - totalExpenses,
        movementsCount: movements.length
      };
    })
  );

  return registersWithTotals;
});

export default component$(() => {
  const historyData = useCashHistoryData();

  return (
    <div class="p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-6xl mx-auto space-y-6">

        {/* Header Navigation */}
        <div class="flex gap-4 mb-4 border-b border-slate-200 pb-4">
          <a href="/admin/cash/" class="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 transition-colors">Caja Actual</a>
          <a href="/admin/cash/history/" class="px-4 py-2 font-bold text-emerald-600 border-b-2 border-emerald-600">Historial</a>
          <a href="/admin/cash/balances/" class="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 transition-colors">Balances</a>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h1 class="text-2xl font-black tracking-tight text-slate-800 mb-6">Historial de Cajas</h1>

          <div class="overflow-hidden border border-slate-200 rounded-xl">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                  <th class="p-4">Fecha Cierre</th>
                  <th class="p-4">Apertura</th>
                  <th class="p-4">Ingresos</th>
                  <th class="p-4">Egresos</th>
                  <th class="p-4">Cierre Teórico</th>
                  <th class="p-4">Cierre Real</th>
                  <th class="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="text-sm font-semibold text-slate-700">
                {historyData.value.length === 0 ? (
                  <tr>
                    <td colSpan={7} class="p-8 text-center text-slate-500">
                      No hay registros de cajas cerradas.
                    </td>
                  </tr>
                ) : (
                  historyData.value.map((reg) => (
                    <tr key={reg.id} class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td class="p-4">
                        {reg.closedAt ? new Date(reg.closedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "-"}
                      </td>
                      <td class="p-4">${reg.openingBalance.toFixed(2)}</td>
                      <td class="p-4 text-emerald-600 font-bold">+${reg.totalIncomes.toFixed(2)}</td>
                      <td class="p-4 text-red-600 font-bold">-${reg.totalExpenses.toFixed(2)}</td>
                      <td class="p-4 font-black">${reg.calculatedBalance.toFixed(2)}</td>
                      <td class="p-4 font-black text-slate-800">${(reg.closingBalance || 0).toFixed(2)}</td>
                      <td class="p-4 text-center">
                        <Link
                          href={`/admin/cash/history/${reg.id}/`}
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          Ver Detalles
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
});

export const head = {
  title: "Historial de Caja - SportGardenFutbol",
};
