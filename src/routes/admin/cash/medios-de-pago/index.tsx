import { component$, useStore, $, useSignal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, zod$, z, type DocumentHead } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { siteSettings } from "~/db/schema";
import { Button } from "~/components/ui";
import { LuPlus, LuTrash2, LuSave } from "@qwikest/icons/lucide";
import { cn } from "@qwik-ui/utils";
import { CashSectionNav } from "~/components/admin/cash/CashSectionNav";

export const useCashPaymentSettings = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
  const paymentMethods = (row?.paymentMethods || []) as { id: string; name: string; isActive: boolean }[];
  if (paymentMethods.length > 0) return paymentMethods;
  return [
    { id: "CASH", name: "Efectivo", isActive: true },
    { id: "TRANSFER", name: "Transferencia", isActive: true },
    { id: "MERCADO_PAGO", name: "Mercado Pago", isActive: true },
    { id: "CURRENT_ACCOUNT", name: "Cuenta Corriente", isActive: true },
  ];
});

export const useSavePaymentMethodsAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    await db
      .update(siteSettings)
      .set({
        paymentMethods: JSON.parse(data.paymentMethods as string),
        updatedAt: new Date(),
      })
      .where(eq(siteSettings.id, 1));
    return { success: true };
  },
  zod$({
    paymentMethods: z.string(),
  }),
);

export default component$(() => {
  const loader = useCashPaymentSettings();
  const saveAction = useSavePaymentMethodsAction();

  const initial = loader.value;
  const store = useStore({
    paymentMethods: [...initial] as { id: string; name: string; isActive: boolean }[],
  });

  const newPaymentMethodText = useSignal("");

  const addPaymentMethod = $(() => {
    if (newPaymentMethodText.value.trim() !== "") {
      const name = newPaymentMethodText.value.trim();
      const id = name.toUpperCase().replace(/\s+/g, "_");
      store.paymentMethods = [...store.paymentMethods, { id, name, isActive: true }];
      newPaymentMethodText.value = "";
    }
  });

  const removePaymentMethod = $((id: string) => {
    store.paymentMethods = store.paymentMethods.filter((pm) => pm.id !== id);
  });

  const togglePaymentMethod = $((id: string) => {
    const pm = store.paymentMethods.find((p) => p.id === id);
    if (pm) pm.isActive = !pm.isActive;
  });

  return (
    <div class="p-4 md:p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-4xl mx-auto space-y-6">
        <CashSectionNav />

        <div id="medio-de-pago" class="scroll-mt-24 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <header class="flex flex-wrap justify-between items-start gap-4 mb-8">
            <div>
              <h1 class="text-2xl font-black tracking-tight text-slate-800">Medios de pago</h1>
              <p class="text-sm text-slate-500 mt-1 font-medium">
                Definí qué métodos de pago aceptás (reservas, caja y cobros).
              </p>
            </div>
          </header>

          {saveAction.value?.success && (
            <div class="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 font-bold text-center text-sm">
              Medios de pago guardados correctamente.
            </div>
          )}

          <Form action={saveAction} class="space-y-8">
            <input type="hidden" name="paymentMethods" value={JSON.stringify(store.paymentMethods)} />

            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="flex gap-2 w-full md:w-auto md:ml-auto">
                <input
                  type="text"
                  bind:value={newPaymentMethodText}
                  onKeyDown$={(e) => e.key === "Enter" && (e.preventDefault(), addPaymentMethod())}
                  placeholder="Ej: Tarjeta, Débito..."
                  class="flex-1 md:w-64 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm"
                />
                <Button type="button" onClick$={addPaymentMethod} look="primary" class="rounded-xl px-4 flex items-center justify-center shrink-0">
                  <LuPlus class="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {store.paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  class={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all",
                    pm.isActive ? "bg-white border-emerald-100 shadow-sm" : "bg-slate-50 border-slate-200 opacity-60",
                  )}
                >
                  <div class="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={pm.isActive}
                      onChange$={() => togglePaymentMethod(pm.id)}
                      class="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                    />
                    <span class={cn("font-bold text-sm", pm.isActive ? "text-slate-800" : "text-slate-500")}>{pm.name}</span>
                  </div>

                  {!["CASH", "TRANSFER", "MERCADO_PAGO", "CURRENT_ACCOUNT"].includes(pm.id) && (
                    <button type="button" onClick$={() => removePaymentMethod(pm.id)} class="text-slate-400 hover:text-red-500 transition-colors p-1">
                      <LuTrash2 class="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {store.paymentMethods.length === 0 && (
              <div class="text-center text-slate-400 italic text-sm py-12 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                No hay medios de pago. Agregá al menos uno.
              </div>
            )}

            <div class="flex justify-end pt-4 border-t border-slate-100">
              <Button type="submit" look="primary" disabled={saveAction.isRunning} class="px-8 py-3 rounded-xl font-black uppercase tracking-widest flex items-center gap-2">
                {saveAction.isRunning ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <LuSave class="w-5 h-5" />
                    Guardar
                  </>
                )}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Medios de pago · Caja | Admin",
};
