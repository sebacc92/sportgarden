import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { cashRegisters, cashMovements } from "~/db/schema";
import { desc, eq } from "drizzle-orm";

export const useCashHistoryData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  const registers = await db.query.cashRegisters.findMany({
    where: eq(cashRegisters.status, "CLOSED"),
    orderBy: [desc(cashRegisters.closedAt)],
    limit: 50,
  });

  const registersWithTotals = await Promise.all(
    registers.map(async (reg) => {
      const movements = await db.query.cashMovements.findMany({
        where: eq(cashMovements.registerId, reg.id),
      });
      const totalIncomes  = movements.filter(m => m.type === "INCOME").reduce((a, m) => a + m.amount, 0);
      const totalExpenses = movements.filter(m => m.type === "EXPENSE").reduce((a, m) => a + m.amount, 0);
      return {
        ...reg,
        totalIncomes,
        totalExpenses,
        calculatedBalance: reg.openingBalance + totalIncomes - totalExpenses,
        movementsCount: movements.length,
        hasArqueo: !!reg.billCount,
      };
    })
  );

  return registersWithTotals;
});

export default component$(() => {
  const historyData = useCashHistoryData();

  return (
    <div class="p-4 md:p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-6xl mx-auto space-y-5">

        {/* Nav */}
        <div class="flex gap-1 border-b border-slate-200 pb-4">
          <a href="/admin/cash/" class="px-4 py-2 font-bold text-sm text-slate-500 hover:text-slate-800 transition-colors">Caja Actual</a>
          <a href="/admin/cash/history/" class="px-4 py-2 font-bold text-sm rounded-t-lg text-emerald-700 bg-white border border-b-white border-slate-200 -mb-px">Historial</a>
          <a href="/admin/cash/balances/" class="px-4 py-2 font-bold text-sm text-slate-500 hover:text-slate-800 transition-colors">Balances</a>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div class="flex justify-between items-center mb-6">
            <h1 class="text-2xl font-black tracking-tight text-slate-800">Historial de Cajas</h1>
            <span class="text-xs text-slate-400 font-medium">{historyData.value.length} registros</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr class="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                  <th class="p-3">Fecha Cierre</th>
                  <th class="p-3">Apertura</th>
                  <th class="p-3">Ingresos</th>
                  <th class="p-3">Egresos</th>
                  <th class="p-3">Cierre Teórico</th>
                  <th class="p-3">Cierre Real</th>
                  <th class="p-3 text-center">Mvtos.</th>
                  <th class="p-3 text-center">Arqueo</th>
                  <th class="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody class="text-sm font-medium text-slate-700">
                {historyData.value.length === 0 ? (
                  <tr>
                    <td colSpan={9} class="p-10 text-center text-slate-400">No hay registros de cajas cerradas.</td>
                  </tr>
                ) : (
                  historyData.value.map((reg) => (
                    <tr key={reg.id} class="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors">
                      <td class="p-3 whitespace-nowrap font-semibold text-slate-800">
                        {reg.closedAt ? new Date(reg.closedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "-"}
                      </td>
                      <td class="p-3">${reg.openingBalance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                      <td class="p-3 text-emerald-600 font-bold">+${reg.totalIncomes.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                      <td class="p-3 text-red-600 font-bold">-${reg.totalExpenses.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                      <td class="p-3 font-black text-slate-800">${reg.calculatedBalance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                      <td class="p-3 font-black text-slate-800">${(reg.closingBalance || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                      <td class="p-3 text-center">
                        <span class="px-2 py-0.5 bg-slate-100 rounded-full text-xs font-bold text-slate-600">{reg.movementsCount}</span>
                      </td>
                      <td class="p-3 text-center">
                        {reg.hasArqueo
                          ? <span title="Arqueo realizado" class="text-emerald-500 text-base">✓</span>
                          : <span title="Sin arqueo" class="text-slate-300 text-base">—</span>}
                      </td>
                      <td class="p-3 text-center">
                        <Link
                          href={`/admin/cash/history/${reg.id}/`}
                          class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          Ver Reporte
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
