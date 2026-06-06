import { component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
  Link,
} from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import {
  groups,
  groupTransactions,
  cashRegisters,
  cashMovements,
  siteSettings,
} from "~/db/schema";
import { Button } from "~/components/ui";

export const useGroupDetailsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const groupId = requestEvent.params.id;

  const { data: groupData, error: groupErr } = await db
    .from(groups)
    .select("*")
    .eq("id", groupId)
    .maybeSingle();

  if (groupErr || !groupData) {
    throw requestEvent.redirect(302, "/admin/groups/");
  }

  const { data: txsData, error: txsErr } = await db
    .from(groupTransactions)
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (txsErr) throw txsErr;

  const { data: settingsData, error: settingsErr } = await db
    .from(siteSettings)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) throw settingsErr;

  const group = camelize<any>(groupData);
  const transactions = camelize<any[]>(txsData || []);
  const settings = camelize<any>(settingsData);

  const paymentMethods = (settings?.paymentMethods || []) as {
    id: string;
    name: string;
    isActive: boolean;
  }[];

  return {
    group,
    transactions,
    paymentMethods:
      paymentMethods.length > 0
        ? paymentMethods
        : [
            { id: "CASH", name: "Efectivo", isActive: true },
            { id: "TRANSFER", name: "Transferencia", isActive: true },
            { id: "CARD", name: "Tarjeta", isActive: true },
            { id: "MERCADO_PAGO", name: "Mercado Pago", isActive: true },
          ],
  };
});

export const useAddTransactionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const amount = Number(data.amount);

    // Get group to update balance
    const { data: groupData, error: groupErr } = await db
      .from(groups)
      .select("*")
      .eq("id", data.groupId)
      .maybeSingle();

    if (groupErr || !groupData) return { success: false, message: "Grupo no encontrado" };
    const group = camelize<any>(groupData);

    const newBalance =
      data.type === "PAYMENT" ? group.balance + amount : group.balance - amount;

    const txId = crypto.randomUUID();

    const { error: insTxErr } = await db.from(groupTransactions).insert({
      id: txId,
      group_id: data.groupId,
      type: data.type as "CHARGE" | "PAYMENT",
      amount: amount,
      description: data.description,
    });

    if (insTxErr) throw insTxErr;

    const { error: updGroupErr } = await db
      .from(groups)
      .update({ balance: newBalance })
      .eq("id", data.groupId);

    if (updGroupErr) throw updGroupErr;

    // If it's a payment and there's an open cash register
    if (data.type === "PAYMENT" && data.paymentMethod) {
      const { data: registersData, error: regErr } = await db
        .from(cashRegisters)
        .select("*")
        .eq("status", "OPEN")
        .order("opened_at", { ascending: false })
        .limit(1);

      if (regErr) throw regErr;
      const openRegister = camelize<any>(registersData?.[0]);

      if (openRegister) {
        const { error: insMovErr } = await db.from(cashMovements).insert({
          id: crypto.randomUUID(),
          register_id: openRegister.id,
          type: "INCOME",
          category: "GROUP_PAYMENT",
          amount: amount,
          description: `Pago de ${group.name} - ${data.description || ""}`,
          payment_method: data.paymentMethod,
          reference_id: txId,
        });
        if (insMovErr) throw insMovErr;
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
  }),
);

export default component$(() => {
  const data = useGroupDetailsData();
  const addTransactionAction = useAddTransactionAction();
  const group = data.value.group;

  return (
    <div class="min-h-full bg-slate-50 p-6 font-sans">
      <div class="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div class="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Link
            href="/admin/groups/"
            class="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div class="flex flex-1 items-center justify-between">
            <div>
              <h1 class="text-3xl font-black tracking-tight text-slate-800">
                {group.name}
              </h1>
              <p class="mt-1 text-slate-500">
                {group.contactName}{" "}
                {group.contactPhone ? `(${group.contactPhone})` : ""}
              </p>
            </div>
            <div
              class={`text-right ${group.balance < 0 ? "text-red-600" : group.balance > 0 ? "text-emerald-600" : "text-slate-500"}`}
            >
              <div class="mb-1 text-xs font-black tracking-widest uppercase opacity-70">
                Saldo Actual
              </div>
              <div class="text-4xl font-black">${group.balance.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Add Transaction */}
          <div class="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-1">
            <h2 class="mb-4 text-xl font-black text-slate-800">
              Nueva Transacción
            </h2>
            <Form action={addTransactionAction} class="space-y-4">
              <input type="hidden" name="groupId" value={group.id} />

              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Tipo
                </label>
                <select
                  name="type"
                  id="tx-type"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  onChange$={(e) => {
                    const methodDiv = document.getElementById(
                      "payment-method-container",
                    );
                    if (methodDiv) {
                      methodDiv.style.display =
                        (e.target as HTMLSelectElement).value === "PAYMENT"
                          ? "block"
                          : "none";
                    }
                  }}
                >
                  <option value="CHARGE">Cargo (Deuda)</option>
                  <option value="PAYMENT">Pago (A favor)</option>
                </select>
              </div>

              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Monto ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  required
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Descripción
                </label>
                <input
                  type="text"
                  name="description"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div id="payment-method-container" style="display: none;">
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Impactar en Caja Abierta
                </label>
                <select
                  name="paymentMethod"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">No impactar en caja</option>
                  {data.value.paymentMethods
                    .filter((pm) => pm.isActive)
                    .map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name}
                      </option>
                    ))}
                </select>
                <p class="mt-1 text-[10px] text-slate-400">
                  Si seleccionas un método de pago, se registrará el ingreso
                  automáticamente en la caja actual si está abierta.
                </p>
              </div>

              <Button
                look="primary"
                type="submit"
                disabled={addTransactionAction.isRunning}
                class="mt-2 w-full rounded-xl bg-slate-800 py-3 font-bold text-white hover:bg-slate-900"
              >
                {addTransactionAction.isRunning
                  ? "Guardando..."
                  : "Registrar Transacción"}
              </Button>
            </Form>
          </div>

          {/* Transactions List */}
          <div class="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:col-span-2">
            <div class="border-b border-slate-100 bg-slate-50/50 p-6">
              <h2 class="text-xl font-black text-slate-800">Historial</h2>
            </div>
            <div class="flex-1 overflow-auto p-0">
              <table class="w-full border-collapse text-left">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50/80 text-xs font-black tracking-widest text-slate-400 uppercase">
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
                      <tr
                        key={tx.id}
                        class="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50"
                      >
                        <td class="p-4">
                          {new Date(tx.createdAt).toLocaleDateString("es-AR")}
                          <div class="text-[10px] text-slate-400">
                            {new Date(tx.createdAt).toLocaleTimeString(
                              "es-AR",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </div>
                        </td>
                        <td class="p-4">
                          <span
                            class={`rounded-md px-2 py-1 text-xs font-bold ${tx.type === "PAYMENT" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                          >
                            {tx.type === "PAYMENT" ? "PAGO" : "CARGO"}
                          </span>
                        </td>
                        <td class="p-4 text-slate-600">
                          {tx.description || "-"}
                        </td>
                        <td
                          class={`p-4 text-right font-black ${tx.type === "PAYMENT" ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {tx.type === "PAYMENT" ? "+" : "-"}$
                          {tx.amount.toFixed(2)}
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
