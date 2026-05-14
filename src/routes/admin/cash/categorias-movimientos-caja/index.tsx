import { component$, useStore, $, useSignal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, zod$, z, type DocumentHead } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { siteSettings } from "~/db/schema";
import { Button } from "~/components/ui";
import { LuPlus, LuTrash2, LuSave } from "@qwikest/icons/lucide";
import { CashSectionNav } from "~/components/admin/cash/CashSectionNav";

const DEFAULT_CATEGORIES = [
  { id: "BOOKING", name: "Reservas", type: "INCOME" as const, icon: "⚽" },
  { id: "SCHOOL", name: "Escuelita", type: "INCOME" as const, icon: "🏫" },
  { id: "KIOSK", name: "Ventas Kiosco", type: "INCOME" as const, icon: "🍿" },
  { id: "EXTRAS", name: "Alquileres Extra", type: "INCOME" as const, icon: "🎟️" },
  { id: "OTHER_INCOME", name: "Otros Ingresos", type: "INCOME" as const, icon: "📌" },
  { id: "MAINTENANCE", name: "Mantenimiento", type: "EXPENSE" as const, icon: "🔧" },
  { id: "SALARY", name: "Sueldos", type: "EXPENSE" as const, icon: "💼" },
  { id: "SERVICES", name: "Servicios", type: "EXPENSE" as const, icon: "💡" },
  { id: "OTHER_EXPENSE", name: "Otros Gastos", type: "EXPENSE" as const, icon: "📌" },
];

export const useCashCategoriesSettings = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
  const list = row?.movementCategories as typeof DEFAULT_CATEGORIES | undefined;
  return Array.isArray(list) && list.length > 0 ? list : DEFAULT_CATEGORIES;
});

export const useSaveMovementCategoriesAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    await db
      .update(siteSettings)
      .set({
        movementCategories: JSON.parse(data.movementCategories as string),
        updatedAt: new Date(),
      })
      .where(eq(siteSettings.id, 1));
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
    movementCategories: [...loader.value] as { id: string; name: string; type: "INCOME" | "EXPENSE"; icon: string }[],
  });

  const newIncomeCategoryText = useSignal("");
  const newExpenseCategoryText = useSignal("");
  const newIncomeCategoryIcon = useSignal("💰");
  const newExpenseCategoryIcon = useSignal("💸");

  const addMovementCategory = $((type: "INCOME" | "EXPENSE") => {
    const textSignal = type === "INCOME" ? newIncomeCategoryText : newExpenseCategoryText;
    const iconSignal = type === "INCOME" ? newIncomeCategoryIcon : newExpenseCategoryIcon;

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
      store.movementCategories = store.movementCategories.filter((mc) => mc.id !== id);
    }
  });

  const updateCategory = $((id: string, updates: Partial<{ name: string; icon: string }>) => {
    const index = store.movementCategories.findIndex((mc) => mc.id === id);
    if (index !== -1) {
      store.movementCategories[index] = { ...store.movementCategories[index], ...updates };
      store.movementCategories = [...store.movementCategories];
    }
  });

  return (
    <div class="p-4 md:p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-5xl mx-auto space-y-6">
        <CashSectionNav />

        <div id="categorias-movimientos-caja" class="scroll-mt-24 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <header class="mb-8">
            <h1 class="text-2xl font-black tracking-tight text-slate-800">Categorías de movimientos (Caja)</h1>
            <p class="text-sm text-slate-500 mt-1 font-medium">
              Clasificá ingresos y egresos al registrar movimientos en caja.
            </p>
          </header>

          {saveAction.value?.success && (
            <div class="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 font-bold text-center text-sm">
              Categorías guardadas correctamente.
            </div>
          )}

          <Form action={saveAction} class="space-y-10">
            <input type="hidden" name="movementCategories" value={JSON.stringify(store.movementCategories)} />

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div class="space-y-6">
                <div class="flex items-center justify-between border-b border-emerald-50 pb-2">
                  <h2 class="text-xs font-black text-emerald-600 uppercase tracking-widest">📈 Ingresos</h2>
                  <div class="flex gap-2 items-center">
                    <input
                      type="text"
                      bind:value={newIncomeCategoryIcon}
                      class="w-10 h-10 text-center bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      bind:value={newIncomeCategoryText}
                      onKeyDown$={(e) => e.key === "Enter" && (e.preventDefault(), addMovementCategory("INCOME"))}
                      placeholder="Nuevo ingreso..."
                      class="w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold"
                    />
                    <Button type="button" look="primary" onClick$={() => addMovementCategory("INCOME")} class="p-2 rounded-lg">
                      <LuPlus class="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-3">
                  {store.movementCategories
                    .filter((mc) => mc.type === "INCOME")
                    .map((mc) => (
                      <div
                        key={mc.id}
                        class="flex items-center justify-between p-4 bg-white border border-emerald-100 rounded-2xl shadow-sm hover:border-emerald-300 transition-all"
                      >
                        <div class="flex items-center gap-3 flex-1 min-w-0">
                          <input
                            type="text"
                            value={mc.icon}
                            onInput$={(e) => updateCategory(mc.id, { icon: (e.target as HTMLInputElement).value })}
                            class="w-8 h-8 text-center bg-transparent border-none focus:bg-slate-50 rounded-lg text-lg outline-none shrink-0"
                          />
                          <input
                            type="text"
                            value={mc.name}
                            onInput$={(e) => updateCategory(mc.id, { name: (e.target as HTMLInputElement).value })}
                            class="flex-1 min-w-0 bg-transparent border-none focus:bg-slate-50 rounded-lg font-bold text-slate-700 outline-none"
                          />
                        </div>
                        {!["BOOKING", "SCHOOL"].includes(mc.id) && (
                          <button
                            type="button"
                            onClick$={() => removeMovementCategory(mc.id)}
                            class="text-slate-300 hover:text-red-500 transition-colors p-1 shrink-0"
                            title="Eliminar categoría"
                          >
                            <LuTrash2 class="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <div class="space-y-6">
                <div class="flex items-center justify-between border-b border-red-50 pb-2">
                  <h2 class="text-xs font-black text-red-600 uppercase tracking-widest">📉 Egresos</h2>
                  <div class="flex gap-2 items-center">
                    <input
                      type="text"
                      bind:value={newExpenseCategoryIcon}
                      class="w-10 h-10 text-center bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      bind:value={newExpenseCategoryText}
                      onKeyDown$={(e) => e.key === "Enter" && (e.preventDefault(), addMovementCategory("EXPENSE"))}
                      placeholder="Nuevo egreso..."
                      class="w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold"
                    />
                    <Button type="button" look="primary" onClick$={() => addMovementCategory("EXPENSE")} class="p-2 rounded-lg">
                      <LuPlus class="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-3">
                  {store.movementCategories
                    .filter((mc) => mc.type === "EXPENSE")
                    .map((mc) => (
                      <div
                        key={mc.id}
                        class="flex items-center justify-between p-4 bg-white border border-red-50 rounded-2xl shadow-sm hover:border-red-300 transition-all"
                      >
                        <div class="flex items-center gap-3 flex-1 min-w-0">
                          <input
                            type="text"
                            value={mc.icon}
                            onInput$={(e) => updateCategory(mc.id, { icon: (e.target as HTMLInputElement).value })}
                            class="w-8 h-8 text-center bg-transparent border-none focus:bg-slate-50 rounded-lg text-lg outline-none shrink-0"
                          />
                          <input
                            type="text"
                            value={mc.name}
                            onInput$={(e) => updateCategory(mc.id, { name: (e.target as HTMLInputElement).value })}
                            class="flex-1 min-w-0 bg-transparent border-none focus:bg-slate-50 rounded-lg font-bold text-slate-700 outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick$={() => removeMovementCategory(mc.id)}
                          class="text-slate-300 hover:text-red-500 transition-colors p-1 shrink-0"
                          title="Eliminar categoría"
                        >
                          <LuTrash2 class="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

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
  title: "Categorías caja · Admin",
};
