import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { cashMovements } from "~/db/schema";
import { and, gte, lte } from "drizzle-orm";

export const useBalancesData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  
  const monthStr = requestEvent.url.searchParams.get("month");
  const yearStr = requestEvent.url.searchParams.get("year");

  const today = new Date();
  const selectedMonth = monthStr ? parseInt(monthStr) : today.getMonth() + 1;
  const selectedYear = yearStr ? parseInt(yearStr) : today.getFullYear();

  const startDate = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0);
  const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

  const movements = await db.query.cashMovements.findMany({
    where: and(
      gte(cashMovements.createdAt, startDate),
      lte(cashMovements.createdAt, endDate)
    )
  });

  const balancesByCategory = {
    BOOKING: { incomes: 0, expenses: 0 },
    SCHOOL: { incomes: 0, expenses: 0 },
    GROUP_PAYMENT: { incomes: 0, expenses: 0 },
    MAINTENANCE: { incomes: 0, expenses: 0 },
    OTHER: { incomes: 0, expenses: 0 }
  };

  let totalIncomes = 0;
  let totalExpenses = 0;

  for (const mov of movements) {
    if (mov.type === "INCOME") {
      balancesByCategory[mov.category as keyof typeof balancesByCategory].incomes += mov.amount;
      totalIncomes += mov.amount;
    } else {
      balancesByCategory[mov.category as keyof typeof balancesByCategory].expenses += mov.amount;
      totalExpenses += mov.amount;
    }
  }

  const prevMonthDate = new Date(selectedYear, selectedMonth - 2, 1);
  const nextMonthDate = new Date(selectedYear, selectedMonth, 1);

  return {
    selectedMonth,
    selectedYear,
    monthName: startDate.toLocaleString("es-AR", { month: "long" }),
    prevMonth: prevMonthDate.getMonth() + 1,
    prevYear: prevMonthDate.getFullYear(),
    nextMonth: nextMonthDate.getMonth() + 1,
    nextYear: nextMonthDate.getFullYear(),
    balancesByCategory,
    totalIncomes,
    totalExpenses,
    netBalance: totalIncomes - totalExpenses
  };
});

export default component$(() => {
  const data = useBalancesData();
  const { 
    selectedMonth, selectedYear, monthName, 
    prevMonth, prevYear, nextMonth, nextYear,
    balancesByCategory, totalIncomes, totalExpenses, netBalance 
  } = data.value;

  const categories = [
    { id: "BOOKING", name: "Reservas" },
    { id: "SCHOOL", name: "Escuelita" },
    { id: "GROUP_PAYMENT", name: "Cuentas Ctes" },
    { id: "MAINTENANCE", name: "Mantenimiento" },
    { id: "OTHER", name: "Otros" }
  ];

  return (
    <div class="p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-6xl mx-auto space-y-6">

        {/* Header Navigation */}
        <div class="flex gap-4 mb-4 border-b border-slate-200 pb-4 print:hidden">
          <a href="/admin/cash/" class="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 transition-colors">Caja Actual</a>
          <a href="/admin/cash/history/" class="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 transition-colors">Historial</a>
          <a href="/admin/cash/balances/" class="px-4 py-2 font-bold text-emerald-600 border-b-2 border-emerald-600">Balances</a>
        </div>

        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
          
          <div class="flex justify-between items-center mb-8 border-b border-slate-200 pb-6 print:border-black">
            <div>
              <h1 class="text-3xl font-black tracking-tight text-slate-800 print:text-xl">Balance Mensual</h1>
              <p class="text-slate-500 mt-1 capitalize font-medium">{monthName} {selectedYear}</p>
            </div>
            <div class="flex items-center gap-3 print:hidden">
              <Link 
                href={`?month=${prevMonth}&year=${prevYear}`}
                class="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                title="Mes Anterior"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
              </Link>
              <Link 
                href={`?month=${nextMonth}&year=${nextYear}`}
                class="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                title="Mes Siguiente"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
              </Link>
              <button onClick$={() => window.print()} class="ml-4 px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition-colors flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                Exportar
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div class="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 print:border-black print:bg-transparent">
              <div class="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2 print:text-black">Ingresos Totales</div>
              <div class="text-4xl font-black text-emerald-700 print:text-black">${totalIncomes.toFixed(2)}</div>
            </div>
            <div class="bg-red-50 p-6 rounded-2xl border border-red-100 print:border-black print:bg-transparent">
              <div class="text-xs font-black text-red-600 uppercase tracking-widest mb-2 print:text-black">Egresos Totales</div>
              <div class="text-4xl font-black text-red-700 print:text-black">${totalExpenses.toFixed(2)}</div>
            </div>
            <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 print:border-black print:bg-transparent">
              <div class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 print:text-black">Balance Neto</div>
              <div class="text-4xl font-black text-white print:text-black">${netBalance.toFixed(2)}</div>
            </div>
          </div>

          <h2 class="text-xl font-black text-slate-800 mb-6 print:text-xl border-b border-slate-200 pb-2 print:border-black">Desglose por Categoría</h2>
          
          <div class="grid grid-cols-1 gap-4">
            {categories.map((cat) => {
              const incomes = balancesByCategory[cat.id as keyof typeof balancesByCategory].incomes;
              const expenses = balancesByCategory[cat.id as keyof typeof balancesByCategory].expenses;
              const net = incomes - expenses;
              if (incomes === 0 && expenses === 0) return null;
              return (
                <div key={cat.id} class="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-xl print:border-black print:bg-transparent print:p-2">
                  <div class="font-black text-slate-800 text-lg w-1/3">{cat.name}</div>
                  <div class="flex-1 flex justify-end gap-10">
                    <div class="text-right">
                      <div class="text-[10px] font-bold text-slate-400 uppercase print:text-black">Ingresos</div>
                      <div class="font-black text-emerald-600 print:text-black">+${incomes.toFixed(2)}</div>
                    </div>
                    <div class="text-right">
                      <div class="text-[10px] font-bold text-slate-400 uppercase print:text-black">Egresos</div>
                      <div class="font-black text-red-600 print:text-black">-${expenses.toFixed(2)}</div>
                    </div>
                    <div class="text-right w-32">
                      <div class="text-[10px] font-bold text-slate-400 uppercase print:text-black">Neto</div>
                      <div class={`font-black ${net >= 0 ? 'text-emerald-700 print:text-black' : 'text-red-700 print:text-black'}`}>
                        {net >= 0 ? '+' : '-'}${Math.abs(net).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div class="mt-16 text-center text-slate-400 text-xs font-medium hidden print:block">
            <p>Reporte de balance generado el {new Date().toLocaleString("es-AR")}</p>
          </div>

        </div>
      </div>
    </div>
  );
});

export const head = {
  title: "Balance Mensual - SportGardenFutbol",
};
