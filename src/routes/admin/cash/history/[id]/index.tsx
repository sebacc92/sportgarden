import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { cashRegisters, cashMovements } from "~/db/schema";
import { eq, desc } from "drizzle-orm";

export const useRegisterDetailData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const registerId = requestEvent.params.id;

  const registers = await db.query.cashRegisters.findMany({
    where: eq(cashRegisters.id, registerId),
    limit: 1,
  });

  const register = registers[0];
  if (!register) {
    throw requestEvent.error(404, "Caja no encontrada");
  }

  const movements = await db.query.cashMovements.findMany({
    where: eq(cashMovements.registerId, register.id),
    orderBy: [desc(cashMovements.createdAt)],
  });

  const totalIncomes = movements.filter(m => m.type === "INCOME").reduce((acc, m) => acc + m.amount, 0);
  const totalExpenses = movements.filter(m => m.type === "EXPENSE").reduce((acc, m) => acc + m.amount, 0);
  const calculatedBalance = register.openingBalance + totalIncomes - totalExpenses;

  return {
    register,
    movements,
    totalIncomes,
    totalExpenses,
    calculatedBalance,
  };
});

export default component$(() => {
  const detailData = useRegisterDetailData();
  const { register, movements, totalIncomes, totalExpenses, calculatedBalance } = detailData.value;

  const dateStr = register.closedAt ? new Date(register.closedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "Abierta";

  return (
    <div class="p-6 bg-slate-50 min-h-full font-sans print:bg-white print:p-0">
      <div class="max-w-4xl mx-auto space-y-6">

        {/* Back & Print Buttons */}
        <div class="flex justify-between items-center print:hidden mb-6">
          <Link href="/admin/cash/history/" class="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Volver al Historial
          </Link>
          <button
            onClick$={() => window.print()}
            class="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>
            Imprimir / Guardar PDF
          </button>
        </div>

        {/* Report Content */}
        <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">

          <div class="text-center mb-8 border-b border-slate-200 pb-6 print:border-black">
            <h1 class="text-3xl font-black tracking-tight text-slate-800">Reporte de Caja</h1>
            <p class="text-slate-500 mt-2 font-medium">Cierre: {dateStr}</p>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 print:border-black print:bg-transparent">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 print:text-black">Apertura</div>
              <div class="text-xl font-black text-slate-800">${register.openingBalance.toFixed(2)}</div>
            </div>
            <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-100 print:border-black print:bg-transparent">
              <div class="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 print:text-black">Ingresos</div>
              <div class="text-xl font-black text-emerald-700 print:text-black">+${totalIncomes.toFixed(2)}</div>
            </div>
            <div class="bg-red-50 p-4 rounded-xl border border-red-100 print:border-black print:bg-transparent">
              <div class="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1 print:text-black">Egresos</div>
              <div class="text-xl font-black text-red-700 print:text-black">-${totalExpenses.toFixed(2)}</div>
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-900 print:border-black print:bg-transparent">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 print:text-black">Cierre Teórico</div>
              <div class="text-xl font-black text-white print:text-black">${calculatedBalance.toFixed(2)}</div>
            </div>
          </div>

          {register.closingBalance !== null && (
            <div class="mb-8 p-4 bg-slate-100 rounded-xl border border-slate-200 print:border-black print:bg-transparent flex justify-between items-center">
              <span class="font-bold text-slate-700">Monto declarado al cerrar:</span>
              <span class="text-2xl font-black text-slate-900">${register.closingBalance.toFixed(2)}</span>
            </div>
          )}

          <h2 class="text-lg font-black text-slate-800 mb-4 print:text-xl border-b border-slate-200 pb-2 print:border-black">Detalle de Movimientos</h2>

          <table class="w-full text-left border-collapse print:text-sm">
            <thead>
              <tr class="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 print:bg-transparent print:border-black print:text-black">
                <th class="p-3">Hora</th>
                <th class="p-3">Categoría</th>
                <th class="p-3">Detalle</th>
                <th class="p-3">Método</th>
                <th class="p-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody class="font-semibold text-slate-700 print:text-black">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={5} class="p-6 text-center text-slate-500">Sin movimientos</td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} class="border-b border-slate-100 last:border-0 print:border-black">
                    <td class="p-3 whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td class="p-3 text-xs">{m.category}</td>
                    <td class="p-3 text-slate-500 font-medium print:text-black">{m.description || "-"}</td>
                    <td class="p-3 text-xs">{m.paymentMethod}</td>
                    <td class={`p-3 text-right font-black ${m.type === "INCOME" ? "text-emerald-600 print:text-black" : "text-red-600 print:text-black"}`}>
                      {m.type === "INCOME" ? "+" : "-"}${m.amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div class="mt-16 text-center text-slate-400 text-xs font-medium print:block">
            <p>Reporte generado el {new Date().toLocaleString("es-AR")}</p>
          </div>
        </div>

      </div>
    </div>
  );
});

export const head = {
  title: "Reporte de Caja - SportGardenFutbol",
};
