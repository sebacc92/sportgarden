import { component$, useStore, $, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  zod$,
  z,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { siteSettings } from "~/db/schema";
import { Button } from "~/components/ui";
import { LuPlus, LuTrash2, LuSave } from "@qwikest/icons/lucide";
import { cn } from "@qwik-ui/utils";
import { resolvePaymentMethodsForSettings } from "~/lib/admin/cash-settings-defaults";
import { CashAdminPageWrapper } from "~/components/admin/cash/CashAdminPageWrapper";

export const useCashPaymentSettings = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const { data: rowData, error: rowErr } = await db
    .from(siteSettings)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (rowErr) throw rowErr;
  const row = camelize<any>(rowData);
  return resolvePaymentMethodsForSettings(row?.paymentMethods);
});

export const useSavePaymentMethodsAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { error } = await db
      .from(siteSettings)
      .update({
        payment_methods: JSON.parse(data.paymentMethods as string),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw error;
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
    paymentMethods: [...initial] as {
      id: string;
      name: string;
      isActive: boolean;
    }[],
  });

  const newPaymentMethodText = useSignal("");

  const addPaymentMethod = $(() => {
    if (newPaymentMethodText.value.trim() !== "") {
      const name = newPaymentMethodText.value.trim();
      const id = name.toUpperCase().replace(/\s+/g, "_");
      store.paymentMethods = [
        ...store.paymentMethods,
        { id, name, isActive: true },
      ];
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
    <CashAdminPageWrapper maxWidthClass="max-w-4xl">
      <div
        id="medio-de-pago"
        class="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
      >
        <header class="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-black tracking-tight text-slate-800">
              Medios de pago
            </h1>
            <p class="mt-1 text-sm font-medium text-slate-500">
              Definí qué métodos de pago aceptás (reservas, caja y cobros).
            </p>
          </div>
        </header>

        {saveAction.value?.success && (
          <div class="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-700">
            Medios de pago guardados correctamente.
          </div>
        )}

        <Form action={saveAction} class="space-y-8">
          <input
            type="hidden"
            name="paymentMethods"
            value={JSON.stringify(store.paymentMethods)}
          />

          <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div class="flex w-full gap-2 md:ml-auto md:w-auto">
              <input
                type="text"
                bind:value={newPaymentMethodText}
                onKeyDown$={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addPaymentMethod())
                }
                placeholder="Ej: Tarjeta, Débito..."
                class="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none md:w-64"
              />
              <Button
                type="button"
                onClick$={addPaymentMethod}
                look="primary"
                class="flex shrink-0 items-center justify-center rounded-xl px-4"
              >
                <LuPlus class="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {store.paymentMethods.map((pm) => (
              <div
                key={pm.id}
                class={cn(
                  "flex items-center justify-between rounded-2xl border p-4 transition-all",
                  pm.isActive
                    ? "border-emerald-100 bg-white shadow-sm"
                    : "border-slate-200 bg-slate-50 opacity-60",
                )}
              >
                <div class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={pm.isActive}
                    onChange$={() => togglePaymentMethod(pm.id)}
                    class="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span
                    class={cn(
                      "text-sm font-bold",
                      pm.isActive ? "text-slate-800" : "text-slate-500",
                    )}
                  >
                    {pm.name}
                  </span>
                </div>

                {![
                  "CASH",
                  "TRANSFER",
                  "MERCADO_PAGO",
                  "CURRENT_ACCOUNT",
                ].includes(pm.id) && (
                  <button
                    type="button"
                    onClick$={() => removePaymentMethod(pm.id)}
                    class="p-1 text-slate-400 transition-colors hover:text-red-500"
                  >
                    <LuTrash2 class="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {store.paymentMethods.length === 0 && (
            <div class="rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 py-12 text-center text-sm text-slate-400 italic">
              No hay medios de pago. Agregá al menos uno.
            </div>
          )}

          <div class="flex justify-end border-t border-slate-100 pt-4">
            <Button
              type="submit"
              look="primary"
              disabled={saveAction.isRunning}
              class="flex items-center gap-2 rounded-xl px-8 py-3 font-black tracking-widest uppercase"
            >
              {saveAction.isRunning ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <LuSave class="h-5 w-5" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </Form>
      </div>
    </CashAdminPageWrapper>
  );
});

export const head: DocumentHead = {
  title: "Medios de pago · Caja | Admin",
};
