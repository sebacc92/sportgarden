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
import { resolveMovementCategories } from "~/lib/admin/cash-settings-defaults";
import { CashAdminPageWrapper } from "~/components/admin/cash/CashAdminPageWrapper";

export const useCashCategoriesSettings = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const { data: rowData, error: rowErr } = await db
    .from(siteSettings)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (rowErr) throw rowErr;
  const row = camelize<any>(rowData);
  return resolveMovementCategories(row?.movementCategories);
});

export const useSaveMovementCategoriesAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { error } = await db
      .from(siteSettings)
      .update({
        movement_categories: JSON.parse(data.movementCategories as string),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw error;
    return { success: true };
  },
  zod$({
    movementCategories: z.string(),
  }),
);

export default component$(() => {
  const loader = useCashCategoriesSettings();
  const saveAction = useSaveMovementCategoriesAction();

  const store = useStore({
    movementCategories: [...loader.value] as {
      id: string;
      name: string;
      type: "INCOME" | "EXPENSE";
      icon: string;
    }[],
  });

  const newIncomeCategoryText = useSignal("");
  const newExpenseCategoryText = useSignal("");
  const newIncomeCategoryIcon = useSignal("💰");
  const newExpenseCategoryIcon = useSignal("💸");

  const addMovementCategory = $((type: "INCOME" | "EXPENSE") => {
    const textSignal =
      type === "INCOME" ? newIncomeCategoryText : newExpenseCategoryText;
    const iconSignal =
      type === "INCOME" ? newIncomeCategoryIcon : newExpenseCategoryIcon;

    if (textSignal.value.trim() !== "") {
      const name = textSignal.value.trim();
      const id = name.toUpperCase().replace(/\s+/g, "_");
      store.movementCategories = [
        ...store.movementCategories,
        { id, name, type, icon: iconSignal.value },
      ];
      textSignal.value = "";
    }
  });

  const removeMovementCategory = $((id: string) => {
    if (window.confirm("¿Eliminar esta categoría?")) {
      store.movementCategories = store.movementCategories.filter(
        (mc) => mc.id !== id,
      );
    }
  });

  const updateCategory = $(
    (id: string, updates: Partial<{ name: string; icon: string }>) => {
      const index = store.movementCategories.findIndex((mc) => mc.id === id);
      if (index !== -1) {
        store.movementCategories[index] = {
          ...store.movementCategories[index],
          ...updates,
        };
        store.movementCategories = [...store.movementCategories];
      }
    },
  );

  return (
    <CashAdminPageWrapper maxWidthClass="max-w-5xl">
      <div
        id="categorias-movimientos-caja"
        class="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
      >
        <header class="mb-8">
          <h1 class="text-2xl font-black tracking-tight text-slate-800">
            Categorías de movimientos (Caja)
          </h1>
          <p class="mt-1 text-sm font-medium text-slate-500">
            Clasificá ingresos y egresos al registrar movimientos en caja.
          </p>
        </header>

        {saveAction.value?.success && (
          <div class="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-700">
            Categorías guardadas correctamente.
          </div>
        )}

        <Form action={saveAction} class="space-y-10">
          <input
            type="hidden"
            name="movementCategories"
            value={JSON.stringify(store.movementCategories)}
          />

          <div class="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div class="space-y-6">
              <div class="flex items-center justify-between border-b border-emerald-50 pb-2">
                <h2 class="text-xs font-black tracking-widest text-emerald-600 uppercase">
                  📈 Ingresos
                </h2>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    bind:value={newIncomeCategoryIcon}
                    class="h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    bind:value={newIncomeCategoryText}
                    onKeyDown$={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), addMovementCategory("INCOME"))
                    }
                    placeholder="Nuevo ingreso..."
                    class="w-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <Button
                    type="button"
                    look="primary"
                    onClick$={() => addMovementCategory("INCOME")}
                    class="rounded-lg p-2"
                  >
                    <LuPlus class="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3">
                {store.movementCategories
                  .filter((mc) => mc.type === "INCOME")
                  .map((mc) => (
                    <div
                      key={mc.id}
                      class="flex items-center justify-between rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition-all hover:border-emerald-300"
                    >
                      <div class="flex min-w-0 flex-1 items-center gap-3">
                        <input
                          type="text"
                          value={mc.icon}
                          onInput$={(e) =>
                            updateCategory(mc.id, {
                              icon: (e.target as HTMLInputElement).value,
                            })
                          }
                          class="h-8 w-8 shrink-0 rounded-lg border-none bg-transparent text-center text-lg outline-none focus:bg-slate-50"
                        />
                        <input
                          type="text"
                          value={mc.name}
                          onInput$={(e) =>
                            updateCategory(mc.id, {
                              name: (e.target as HTMLInputElement).value,
                            })
                          }
                          class="min-w-0 flex-1 rounded-lg border-none bg-transparent font-bold text-slate-700 outline-none focus:bg-slate-50"
                        />
                      </div>
                      {!["BOOKING", "SCHOOL"].includes(mc.id) && (
                        <button
                          type="button"
                          onClick$={() => removeMovementCategory(mc.id)}
                          class="shrink-0 p-1 text-slate-300 transition-colors hover:text-red-500"
                          title="Eliminar categoría"
                        >
                          <LuTrash2 class="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            <div class="space-y-6">
              <div class="flex items-center justify-between border-b border-red-50 pb-2">
                <h2 class="text-xs font-black tracking-widest text-red-600 uppercase">
                  📉 Egresos
                </h2>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    bind:value={newExpenseCategoryIcon}
                    class="h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    bind:value={newExpenseCategoryText}
                    onKeyDown$={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), addMovementCategory("EXPENSE"))
                    }
                    placeholder="Nuevo egreso..."
                    class="w-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <Button
                    type="button"
                    look="primary"
                    onClick$={() => addMovementCategory("EXPENSE")}
                    class="rounded-lg p-2"
                  >
                    <LuPlus class="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3">
                {store.movementCategories
                  .filter((mc) => mc.type === "EXPENSE")
                  .map((mc) => (
                    <div
                      key={mc.id}
                      class="flex items-center justify-between rounded-2xl border border-red-50 bg-white p-4 shadow-sm transition-all hover:border-red-300"
                    >
                      <div class="flex min-w-0 flex-1 items-center gap-3">
                        <input
                          type="text"
                          value={mc.icon}
                          onInput$={(e) =>
                            updateCategory(mc.id, {
                              icon: (e.target as HTMLInputElement).value,
                            })
                          }
                          class="h-8 w-8 shrink-0 rounded-lg border-none bg-transparent text-center text-lg outline-none focus:bg-slate-50"
                        />
                        <input
                          type="text"
                          value={mc.name}
                          onInput$={(e) =>
                            updateCategory(mc.id, {
                              name: (e.target as HTMLInputElement).value,
                            })
                          }
                          class="min-w-0 flex-1 rounded-lg border-none bg-transparent font-bold text-slate-700 outline-none focus:bg-slate-50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick$={() => removeMovementCategory(mc.id)}
                        class="shrink-0 p-1 text-slate-300 transition-colors hover:text-red-500"
                        title="Eliminar categoría"
                      >
                        <LuTrash2 class="h-4 w-4" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>

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
  title: "Categorías caja · Admin",
};
