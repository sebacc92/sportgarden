import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { cashRegisters, cashMovements, siteSettings } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import { resolveMovementCategories } from "~/lib/admin/cash-settings-defaults";

const BILL_DENOMINATIONS = [20000, 10000, 2000, 1000, 500, 100];

export const useRegisterDetailData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const registerId = requestEvent.params.id;

  const registers = await db.query.cashRegisters.findMany({
    where: eq(cashRegisters.id, registerId),
    limit: 1,
  });

  const register = registers[0];
  if (!register) throw requestEvent.error(404, "Caja no encontrada");

  const movements = await db.query.cashMovements.findMany({
    where: eq(cashMovements.registerId, register.id),
    orderBy: [desc(cashMovements.createdAt)],
  });

  const totalIncomes = movements
    .filter((m) => m.type === "INCOME")
    .reduce((a, m) => a + m.amount, 0);
  const totalExpenses = movements
    .filter((m) => m.type === "EXPENSE")
    .reduce((a, m) => a + m.amount, 0);
  const calculatedBalance =
    register.openingBalance + totalIncomes - totalExpenses;

  // Por categoría
  const byCategory: Record<string, { incomes: number; expenses: number }> = {};
  for (const m of movements) {
    if (!byCategory[m.category])
      byCategory[m.category] = { incomes: 0, expenses: 0 };
    if (m.type === "INCOME") byCategory[m.category].incomes += m.amount;
    else byCategory[m.category].expenses += m.amount;
  }

  // Por método de pago
  const byMethod: Record<string, { incomes: number; expenses: number }> = {};
  for (const m of movements) {
    if (!byMethod[m.paymentMethod])
      byMethod[m.paymentMethod] = { incomes: 0, expenses: 0 };
    if (m.type === "INCOME") byMethod[m.paymentMethod].incomes += m.amount;
    else byMethod[m.paymentMethod].expenses += m.amount;
  }

  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1),
  });
  const paymentMethods = (settings?.paymentMethods || []) as {
    id: string;
    name: string;
    isActive: boolean;
  }[];

  return {
    register,
    movements,
    totalIncomes,
    totalExpenses,
    calculatedBalance,
    byCategory,
    byMethod,
    paymentMethods,
    movementCategories: resolveMovementCategories(settings?.movementCategories),
  };
});

export default component$(() => {
  const detailData = useRegisterDetailData();
  const {
    register,
    movements,
    totalIncomes,
    totalExpenses,
    calculatedBalance,
    byCategory,
    byMethod,
    paymentMethods,
    movementCategories,
  } = detailData.value;

  const openedStr = register.openedAt
    ? new Date(register.openedAt).toLocaleString("es-AR", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "-";
  const closedStr = register.closedAt
    ? new Date(register.closedAt).toLocaleString("es-AR", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "Abierta";

  const billCount = register.billCount as Record<string, number> | null;
  const billTotalCash = billCount
    ? BILL_DENOMINATIONS.reduce((sum, d) => sum + d * (billCount[d] || 0), 0)
    : null;

  return (
    <div class="min-h-full bg-slate-50 p-4 font-sans md:p-6 print:bg-white print:p-0">
      <div class="mx-auto max-w-4xl space-y-5">
        {/* Toolbar */}
        <div class="flex items-center justify-between print:hidden">
          <Link
            href="/admin/cash/history/"
            class="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Volver al Historial
          </Link>
          <button
            onClick$={() => window.print()}
            class="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-900"
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
            Descargar PDF
          </button>
        </div>

        {/* Report Card */}
        <div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:border-none print:p-0 print:shadow-none">
          {/* Report Header */}
          <div class="mb-8 border-b border-slate-200 pb-6 text-center print:border-black">
            <div class="mb-2 text-xs font-black tracking-widest text-slate-400 uppercase print:text-black">
              Reporte de Caja
            </div>
            <h1 class="text-3xl font-black tracking-tight text-slate-800">
              Cierre del Turno
            </h1>
            <div class="mt-3 flex flex-wrap justify-center gap-6 text-sm text-slate-500">
              <span>
                📅 Apertura: <strong class="text-slate-700">{openedStr}</strong>
              </span>
              <span>
                🔒 Cierre: <strong class="text-slate-700">{closedStr}</strong>
              </span>
            </div>
          </div>

          {/* Summary Cards */}
          <div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div class="rounded-xl border border-slate-100 bg-slate-50 p-4 print:border-black print:bg-transparent">
              <div class="mb-1 text-xs font-black tracking-widest text-slate-400 uppercase print:text-black">
                Apertura
              </div>
              <div class="text-xl font-black text-slate-800">
                $
                {register.openingBalance.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div class="rounded-xl border border-emerald-100 bg-emerald-50 p-4 print:border-black print:bg-transparent">
              <div class="mb-1 text-xs font-black tracking-widest text-emerald-600 uppercase print:text-black">
                Ingresos
              </div>
              <div class="text-xl font-black text-emerald-700 print:text-black">
                +$
                {totalIncomes.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div class="rounded-xl border border-red-100 bg-red-50 p-4 print:border-black print:bg-transparent">
              <div class="mb-1 text-xs font-black tracking-widest text-red-600 uppercase print:text-black">
                Egresos
              </div>
              <div class="text-xl font-black text-red-700 print:text-black">
                -$
                {totalExpenses.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div class="rounded-xl border border-slate-900 bg-slate-800 p-4 print:border-black print:bg-transparent">
              <div class="mb-1 text-xs font-black tracking-widest text-slate-400 uppercase print:text-black">
                Cierre Teórico
              </div>
              <div class="text-xl font-black text-white print:text-black">
                $
                {calculatedBalance.toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          {/* Arqueo de Billetes */}
          {billCount && billTotalCash !== null && (
            <div class="mb-8">
              <h2 class="mb-3 border-b border-slate-200 pb-2 text-base font-black text-slate-800 print:border-black">
                Arqueo de Billetes
              </h2>
              <div class="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                {BILL_DENOMINATIONS.filter((d) => (billCount[d] || 0) > 0).map(
                  (d) => (
                    <div
                      key={d}
                      class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 print:border-black print:bg-transparent"
                    >
                      <span class="text-sm font-bold text-slate-600">
                        ${d.toLocaleString("es-AR")}
                      </span>
                      <span class="text-sm text-slate-500">
                        × {billCount[d]}
                      </span>
                      <span class="text-sm font-black text-slate-800">
                        ${(d * (billCount[d] || 0)).toLocaleString("es-AR")}
                      </span>
                    </div>
                  ),
                )}
              </div>
              <div class="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 print:border-black print:bg-transparent">
                <span class="font-bold text-emerald-700">
                  Total Efectivo Contado
                </span>
                <span class="text-2xl font-black text-emerald-800">
                  $
                  {billTotalCash.toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              {register.closingBalance !== null && (
                <div
                  class={`mt-2 flex items-center justify-between rounded-xl border p-3 print:border-black ${Math.abs(billTotalCash - (register.closingBalance || 0)) < 0.01 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}
                >
                  <span class="text-sm font-bold">Diferencia vs. cierre</span>
                  <span class="font-black">
                    $
                    {(
                      billTotalCash - (register.closingBalance || 0)
                    ).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}

          {register.notes && (
            <div class="mb-8 rounded-xl border border-yellow-200 bg-yellow-50 p-4 print:border-black print:bg-transparent">
              <div class="mb-1 text-xs font-black tracking-wider text-yellow-700 uppercase print:text-black">
                Observaciones del Turno
              </div>
              <p class="text-sm text-slate-700">{register.notes}</p>
            </div>
          )}

          {/* Desglose por Categoría */}
          {Object.keys(byCategory).length > 0 && (
            <div class="mb-8">
              <h2 class="mb-3 border-b border-slate-200 pb-2 text-base font-black text-slate-800 print:border-black">
                Resumen por Categoría
              </h2>
              <div class="space-y-2">
                {Object.entries(byCategory).map(([cat, vals]) => {
                  const mc = movementCategories.find((c) => c.id === cat);
                  const label = mc ? mc.name : cat;
                  const icon = mc ? mc.icon : "📌";
                  const isIncome =
                    movementCategories.find((c) => c.id === cat)?.type ===
                    "INCOME";
                  const typeColor = isIncome
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-rose-50 text-rose-700 border-rose-100";

                  return (
                    <div
                      key={cat}
                      class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 print:border-black print:bg-transparent"
                    >
                      <span
                        class={`rounded-md border px-2 py-0.5 text-[10px] font-black tracking-tight uppercase ${typeColor}`}
                      >
                        <span class="mr-1">{icon}</span>
                        {label}
                      </span>
                      <div class="flex gap-6 text-sm">
                        {vals.incomes > 0 && (
                          <span class="font-bold text-emerald-600">
                            +$
                            {vals.incomes.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        )}
                        {vals.expenses > 0 && (
                          <span class="font-bold text-red-600">
                            -$
                            {vals.expenses.toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        )}
                        <span class="font-black text-slate-800">
                          $
                          {(vals.incomes - vals.expenses).toLocaleString(
                            "es-AR",
                            { minimumFractionDigits: 2 },
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Desglose por Método */}
          {Object.keys(byMethod).length > 0 && (
            <div class="mb-8">
              <h2 class="mb-3 border-b border-slate-200 pb-2 text-base font-black text-slate-800 print:border-black">
                Resumen por Método de Pago
              </h2>
              <div class="grid grid-cols-2 gap-3">
                {Object.entries(byMethod).map(([method, vals]) => (
                  <div
                    key={method}
                    class="rounded-xl border border-slate-100 bg-slate-50 p-3 print:border-black print:bg-transparent"
                  >
                    <div class="mb-1 text-xs font-bold text-slate-500 uppercase">
                      {paymentMethods.find((pm) => pm.id === method)?.name ||
                        method}
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
            </div>
          )}

          {/* Movements Table */}
          <h2 class="mb-3 border-b border-slate-200 pb-2 text-base font-black text-slate-800 print:border-black">
            Detalle de Movimientos
          </h2>
          <table class="w-full border-collapse text-left print:text-sm">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50 text-xs font-black tracking-widest text-slate-400 uppercase print:border-black print:bg-transparent print:text-black">
                <th class="p-3">Hora</th>
                <th class="p-3">Categoría</th>
                <th class="p-3">Detalle</th>
                <th class="p-3">Método</th>
                <th class="p-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody class="font-medium text-slate-700 print:text-black">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={5} class="p-6 text-center text-slate-400">
                    Sin movimientos
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const mc = movementCategories.find(
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
                      class="border-b border-slate-100 last:border-0 print:border-black"
                    >
                      <td class="p-3 text-xs whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td class="p-3">
                        <span
                          class={`rounded-md border px-2 py-0.5 text-[10px] font-black tracking-tight uppercase print:bg-transparent print:font-bold ${typeColor}`}
                        >
                          <span class="mr-1">{icon}</span>
                          {label}
                        </span>
                      </td>
                      <td class="p-3 text-sm text-slate-500 print:text-black">
                        {m.description || "—"}
                      </td>
                      <td class="p-3 text-xs text-slate-500 print:text-black">
                        {paymentMethods.find((pm) => pm.id === m.paymentMethod)
                          ?.name || m.paymentMethod}
                      </td>
                      <td
                        class={`p-3 text-right text-sm font-black print:text-black ${m.type === "INCOME" ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {m.type === "INCOME" ? "+" : "-"}$
                        {m.amount.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div class="mt-12 text-center text-xs font-medium text-slate-400 print:block">
            <p>Reporte generado el {new Date().toLocaleString("es-AR")}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head = {
  title: "Reporte de Caja - GardenClubFutbol",
};
