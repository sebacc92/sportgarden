import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { cashMovements, cashRegisters, siteSettings } from "~/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { CashSectionNav } from "~/components/admin/cash/CashSectionNav";
import { resolveMovementCategories } from "~/lib/admin/cash-settings-defaults";

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
      lte(cashMovements.createdAt, endDate),
    ),
  });

  // Contar registros del mes
  const allRegisters = await db.query.cashRegisters.findMany({
    where: and(
      gte(cashRegisters.openedAt, startDate),
      lte(cashRegisters.openedAt, endDate),
    ),
  });

  const balancesByCategory: Record<
    string,
    { incomes: number; expenses: number }
  > = {};
  const balancesByMethod: Record<
    string,
    { incomes: number; expenses: number }
  > = {};
  let totalIncomes = 0,
    totalExpenses = 0;

  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1),
  });
  const paymentMethods = (settings?.paymentMethods || []) as {
    id: string;
    name: string;
    isActive: boolean;
  }[];

  for (const m of movements) {
    if (!balancesByCategory[m.category])
      balancesByCategory[m.category] = { incomes: 0, expenses: 0 };
    if (!balancesByMethod[m.paymentMethod])
      balancesByMethod[m.paymentMethod] = { incomes: 0, expenses: 0 };
    if (m.type === "INCOME") {
      balancesByCategory[m.category].incomes += m.amount;
      balancesByMethod[m.paymentMethod].incomes += m.amount;
      totalIncomes += m.amount;
    } else {
      balancesByCategory[m.category].expenses += m.amount;
      balancesByMethod[m.paymentMethod].expenses += m.amount;
      totalExpenses += m.amount;
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
    balancesByMethod,
    totalIncomes,
    totalExpenses,
    netBalance: totalIncomes - totalExpenses,
    turnsCount: allRegisters.length,
    paymentMethods,
    movementCategories: resolveMovementCategories(settings?.movementCategories),
  };
});

export default component$(() => {
  const data = useBalancesData();
  const {
    selectedYear,
    monthName,
    prevMonth,
    prevYear,
    nextMonth,
    nextYear,
    balancesByCategory,
    balancesByMethod,
    totalIncomes,
    totalExpenses,
    netBalance,
    turnsCount,
  } = data.value;

  return (
    <div class="min-h-full bg-slate-50 p-4 font-sans md:p-6 print:bg-white print:p-0">
      <div class="mx-auto max-w-5xl space-y-5">
        <CashSectionNav />

        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-none print:p-0 print:shadow-none">
          {/* Header */}
          <div class="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6 print:border-black">
            <div>
              <div class="mb-1 text-xs font-black tracking-widest text-slate-400 uppercase print:text-black">
                Balance Mensual
              </div>
              <h1 class="text-3xl font-black tracking-tight text-slate-800 capitalize print:text-2xl">
                {monthName} {selectedYear}
              </h1>
              <p class="mt-1 text-sm text-slate-500">
                {turnsCount} {turnsCount === 1 ? "turno" : "turnos"} en el mes
              </p>
            </div>
            <div class="flex items-center gap-2 print:hidden">
              <Link
                href={`?month=${prevMonth}&year=${prevYear}`}
                class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 transition-colors hover:bg-slate-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </Link>
              <Link
                href={`?month=${nextMonth}&year=${nextYear}`}
                class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 transition-colors hover:bg-slate-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
              <button
                onClick$={() => window.print()}
                class="ml-2 flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
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
                Exportar PDF
              </button>
            </div>
          </div>

          {/* Summary */}
          <div class="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div class="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 print:border-black print:bg-transparent">
              <div class="mb-2 text-xs font-black tracking-widest text-emerald-600 uppercase print:text-black">
                Ingresos Totales
              </div>
              <div class="text-3xl font-black text-emerald-700 print:text-black">
                $
                {totalIncomes.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div class="rounded-2xl border border-red-100 bg-red-50 p-5 print:border-black print:bg-transparent">
              <div class="mb-2 text-xs font-black tracking-widest text-red-600 uppercase print:text-black">
                Egresos Totales
              </div>
              <div class="text-3xl font-black text-red-700 print:text-black">
                $
                {totalExpenses.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div class="rounded-2xl border border-slate-800 bg-slate-900 p-5 print:border-black print:bg-transparent">
              <div class="mb-2 text-xs font-black tracking-widest text-slate-400 uppercase print:text-black">
                Balance Neto
              </div>
              <div
                class={`text-3xl font-black print:text-black ${netBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {netBalance >= 0 ? "+" : ""}
                {netBalance.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          {/* By Category */}
          <h2 class="mb-4 border-b border-slate-200 pb-2 text-base font-black text-slate-800 print:border-black">
            Desglose por Categoría
          </h2>
          <div class="mb-10 grid grid-cols-1 gap-3">
            {data.value.movementCategories.map((cat) => {
              const vals = balancesByCategory[cat.id];
              if (!vals || (vals.incomes === 0 && vals.expenses === 0))
                return null;
              const net = vals.incomes - vals.expenses;
              const maxVal = Math.max(vals.incomes, vals.expenses, 1);
              return (
                <div
                  key={cat.id}
                  class="rounded-xl border border-slate-100 bg-slate-50 p-4 print:border-black print:bg-transparent"
                >
                  <div class="mb-2 flex items-center justify-between">
                    <span class="text-sm font-black text-slate-800">
                      {cat.icon} {cat.name}
                    </span>
                    <span
                      class={`text-sm font-black ${net >= 0 ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {net >= 0 ? "+" : ""}$
                      {net.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div class="mb-2 flex gap-6 text-xs text-slate-500">
                    <span class="font-semibold text-emerald-600">
                      Ingresos: $
                      {vals.incomes.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span class="font-semibold text-red-600">
                      Egresos: $
                      {vals.expenses.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {/* Visual bars */}
                  <div class="space-y-1 print:hidden">
                    {vals.incomes > 0 && (
                      <div class="flex items-center gap-2">
                        <div class="h-2 w-3 flex-shrink-0 rounded-full bg-emerald-500" />
                        <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            class="h-full rounded-full bg-emerald-500 transition-all"
                            style={{
                              width: `${(vals.incomes / maxVal) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {vals.expenses > 0 && (
                      <div class="flex items-center gap-2">
                        <div class="h-2 w-3 flex-shrink-0 rounded-full bg-red-400" />
                        <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            class="h-full rounded-full bg-red-400 transition-all"
                            style={{
                              width: `${(vals.expenses / maxVal) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {Object.keys(balancesByCategory).length === 0 && (
              <p class="py-6 text-center text-sm text-slate-400">
                No hay movimientos este mes.
              </p>
            )}
          </div>

          {/* By Payment Method */}
          {Object.keys(balancesByMethod).length > 0 && (
            <>
              <h2 class="mb-4 border-b border-slate-200 pb-2 text-base font-black text-slate-800 print:border-black">
                Desglose por Método de Pago
              </h2>
              <div class="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                {Object.entries(balancesByMethod).map(([method, vals]) => (
                  <div
                    key={method}
                    class="rounded-xl border border-slate-100 bg-slate-50 p-4 print:border-black print:bg-transparent"
                  >
                    <div class="mb-2 text-xs font-black tracking-wider text-slate-500 uppercase">
                      {data.value.paymentMethods.find((pm) => pm.id === method)
                        ?.name || method}
                    </div>
                    {vals.incomes > 0 && (
                      <div class="text-sm font-bold text-emerald-600">
                        +$
                        {vals.incomes.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    )}
                    {vals.expenses > 0 && (
                      <div class="text-sm font-bold text-red-600">
                        -$
                        {vals.expenses.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div class="mt-12 text-center text-xs font-medium text-slate-400 print:block">
            <p>
              Balance generado el {new Date().toLocaleString("es-AR")} ·{" "}
              {turnsCount} turnos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head = {
  title: "Balance Mensual - GardenClubFutbol",
};
