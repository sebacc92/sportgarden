import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, Link } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { groups, groupTransactions, cashRegisters, cashMovements, siteSettings } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "~/components/ui";

export const useGroupDetailsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const groupId = requestEvent.params.id;
  
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
  });

  if (!group) {
    throw requestEvent.redirect(302, "/admin/groups/");
  }

  const transactions = await db.query.groupTransactions.findMany({
    where: eq(groupTransactions.groupId, groupId),
    orderBy: [desc(groupTransactions.createdAt)],
  });

  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1),
  });
  const paymentMethods = (settings?.paymentMethods || []) as { id: string, name: string, isActive: boolean }[];

  return {
    group,
    transactions,
    paymentMethods: paymentMethods.length > 0 ? paymentMethods : [
      { id: "CASH", name: "Efectivo", isActive: true },
      { id: "TRANSFER", name: "Transferencia", isActive: true },
      { id: "CARD", name: "Tarjeta", isActive: true },
      { id: "MERCADO_PAGO", name: "Mercado Pago", isActive: true }
    ],
  };
});

export const useAddTransactionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const amount = Number(data.amount);
    
    // Get group to update balance
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, data.groupId),
    });

    if (!group) return { success: false, message: "Grupo no encontrado" };

    const newBalance = data.type === "PAYMENT" 
      ? group.balance + amount 
      : group.balance - amount;

    const txId = crypto.randomUUID();

    // Run in transaction if possible, but SQLite Drizzle doesn't have robust transaction API exposed simply sometimes,
    // we'll just run sequentially.
    await db.insert(groupTransactions).values({
      id: txId,
      groupId: data.groupId,
      type: data.type as "CHARGE" | "PAYMENT",
      amount: amount,
      description: data.description,
    });

    await db.update(groups).set({ balance: newBalance }).where(eq(groups.id, data.groupId));

    // If it's a payment and there's an open cash register, we should ask the user or just automatically add it?
    // Let's check if there is an open register and we indicated a payment method.
    if (data.type === "PAYMENT" && data.paymentMethod) {
      const openRegister = await db.query.cashRegisters.findFirst({
        where: eq(cashRegisters.status, "OPEN"),
        orderBy: [desc(cashRegisters.openedAt)],
      });

      if (openRegister) {
        await db.insert(cashMovements).values({
          id: crypto.randomUUID(),
          registerId: openRegister.id,
          type: "INCOME",
          category: "GROUP_PAYMENT",
          amount: amount,
          description: `Pago de ${group.name} - ${data.description || ''}`,
          paymentMethod: data.paymentMethod as any,
          referenceId: txId,
        });
      }
    }
    
    return { success: true };
  },
  zod$({
    groupId: z.string(),
    type: z.enum(["CHARGE", "PAYMENT"]),
    amount: z.string().min(1),
    description: z.string().optional(),
    paymentMethod: z.string().optional(),
  })
);

export default component$(() => {
  const data = useGroupDetailsData();
  const addTransactionAction = useAddTransactionAction();
  const group = data.value.group;

  return (
    <div class="p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div class="flex items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <Link href="/admin/groups/" class="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div class="flex-1 flex justify-between items-center">
            <div>
              <h1 class="text-3xl font-black tracking-tight text-slate-800">{group.name}</h1>
              <p class="text-slate-500 mt-1">
                {group.contactName} {group.contactPhone ? `(${group.contactPhone})` : ''}
              </p>
            </div>
            <div class={`text-right ${group.balance < 0 ? "text-red-600" : group.balance > 0 ? "text-emerald-600" : "text-slate-500"}`}>
              <div class="text-xs font-black uppercase tracking-widest mb-1 opacity-70">Saldo Actual</div>
              <div class="text-4xl font-black">${group.balance.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Add Transaction */}
          <div class="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h2 class="text-xl font-black text-slate-800 mb-4">Nueva Transacción</h2>
            <Form action={addTransactionAction} class="space-y-4">
              <input type="hidden" name="groupId" value={group.id} />
              
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
                <select name="type" id="tx-type" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold text-slate-700" 
                  onChange$={(e) => {
                    const methodDiv = document.getElementById("payment-method-container");
                    if (methodDiv) {
                      methodDiv.style.display = (e.target as HTMLSelectElement).value === "PAYMENT" ? "block" : "none";
                    }
                  }}
                >
                  <option value="CHARGE">Cargo (Deuda)</option>
                  <option value="PAYMENT">Pago (A favor)</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto ($)</label>
                <input type="number" step="0.01" name="amount" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción</label>
                <input type="text" name="description" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>

              <div id="payment-method-container" style="display: none;">
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Impactar en Caja Abierta</label>
                <select name="paymentMethod" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold text-slate-700">
                  <option value="">No impactar en caja</option>
                  {data.value.paymentMethods.filter(pm => pm.isActive).map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
                <p class="text-[10px] text-slate-400 mt-1">Si seleccionas un método de pago, se registrará el ingreso automáticamente en la caja actual si está abierta.</p>
              </div>

              <Button look="primary" type="submit" disabled={addTransactionAction.isRunning} class="w-full py-3 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold mt-2">
                {addTransactionAction.isRunning ? "Guardando..." : "Registrar Transacción"}
              </Button>
            </Form>
          </div>

          {/* Transactions List */}
          <div class="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div class="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 class="text-xl font-black text-slate-800">Historial</h2>
            </div>
            <div class="flex-1 overflow-auto p-0">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th class="p-4">Fecha</th>
                    <th class="p-4">Tipo</th>
                    <th class="p-4">Descripción</th>
                    <th class="p-4 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody class="text-sm font-semibold text-slate-700">
                  {data.value.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} class="p-8 text-center text-slate-500">
                        No hay movimientos registrados.
                      </td>
                    </tr>
                  ) : (
                    data.value.transactions.map((tx) => (
                      <tr key={tx.id} class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td class="p-4">
                          {new Date(tx.createdAt).toLocaleDateString("es-AR")}
                          <div class="text-[10px] text-slate-400">
                            {new Date(tx.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td class="p-4">
                          <span class={`px-2 py-1 rounded-md text-xs font-bold ${tx.type === "PAYMENT" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {tx.type === "PAYMENT" ? "PAGO" : "CARGO"}
                          </span>
                        </td>
                        <td class="p-4 text-slate-600">{tx.description || "-"}</td>
                        <td class={`p-4 text-right font-black ${tx.type === "PAYMENT" ? "text-emerald-600" : "text-red-600"}`}>
                          {tx.type === "PAYMENT" ? "+" : "-"}${tx.amount.toFixed(2)}
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
    </div>
  );
});

export const head = {
  title: "Detalles de Cuenta Corriente - GardenClubFutbol",
};
