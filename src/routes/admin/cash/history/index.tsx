import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { cashRegisters, cashMovements } from "~/db/schema";
import { CashSectionNav } from "~/components/admin/cash/CashSectionNav";

export const useCashHistoryData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  const { data: registersData, error: registersErr } = await db
    .from(cashRegisters)
    .select("*")
    .eq("status", "CLOSED")
    .order("closed_at", { ascending: false })
    .limit(50);

  if (registersErr) throw registersErr;
  const registers = camelize<any[]>(registersData || []);

  const registersWithTotals = await Promise.all(
    registers.map(async (reg) => {
      const { data: movementsData, error: movementsErr } = await db
        .from(cashMovements)
        .select("*")
        .eq("register_id", reg.id);

      if (movementsErr) throw movementsErr;
      const movements = camelize<any[]>(movementsData || []);

      const totalIncomes = movements
        .filter((m) => m.type === "INCOME")
        .reduce((a, m) => a + m.amount, 0);
      const totalExpenses = movements
        .filter((m) => m.type === "EXPENSE")
        .reduce((a, m) => a + m.amount, 0);
      return {
        ...reg,
        totalIncomes,
        totalExpenses,
        calculatedBalance: reg.openingBalance + totalIncomes - totalExpenses,
        movementsCount: movements.length,
        hasArqueo: !!reg.billCount,
      };
    }),
  );

  return registersWithTotals;
});

export default component$(() => {
  const historyData = useCashHistoryData();

  return (
    <div class="min-h-full bg-slate-50 p-4 font-sans md:p-6">
      <div class="mx-auto max-w-6xl space-y-5">
        <CashSectionNav />

        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div class="mb-6 flex items-center justify-between">
            <h1 class="text-2xl font-black tracking-tight text-slate-800">
              Historial de Cajas
            </h1>
            <span class="text-xs font-medium text-slate-400">
              {historyData.value.length} registros
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-xs font-black tracking-widest text-slate-400 uppercase">
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
                    <td colSpan={9} class="p-10 text-center text-slate-400">
                      No hay registros de cajas cerradas.
                    </td>
                  </tr>
                ) : (
                  historyData.value.map((reg) => (
                    <tr
                      key={reg.id}
                      class="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"
                    >
                      <td class="p-3 font-semibold whitespace-nowrap text-slate-800">
                        {reg.closedAt
                          ? new Date(reg.closedAt).toLocaleString("es-AR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "-"}
                      </td>
                      <td class="p-3">
                        $
                        {reg.openingBalance.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td class="p-3 font-bold text-emerald-600">
                        +$
                        {reg.totalIncomes.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td class="p-3 font-bold text-red-600">
                        -$
                        {reg.totalExpenses.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td class="p-3 font-black text-slate-800">
                        $
                        {reg.calculatedBalance.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td class="p-3 font-black text-slate-800">
                        $
                        {(reg.closingBalance || 0).toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td class="p-3 text-center">
                        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                          {reg.movementsCount}
                        </span>
                      </td>
                      <td class="p-3 text-center">
                        {reg.hasArqueo ? (
                          <span
                            title="Arqueo realizado"
                            class="text-base text-emerald-500"
                          >
                            ✓
                          </span>
                        ) : (
                          <span
                            title="Sin arqueo"
                            class="text-base text-slate-300"
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td class="p-3 text-center">
                        <Link
                          href={`/admin/cash/history/${reg.id}/`}
                          class="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
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
  title: "Historial de Caja - GardenClubFutbol",
};
