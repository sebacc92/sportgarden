import { component$, $, useStore, useTask$, type Signal } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { Modal, Button } from "~/components/ui";
import { LuPlus, LuTrash2 } from '@qwikest/icons/lucide';
import { LoadingSpinner } from "./LoadingSpinner";

interface GlobalExtraServicesModalProps {
  showSignal: Signal<boolean>;
  initialExtras: any[];
  saveAction: any;
}

export const GlobalExtraServicesModal = component$((props: GlobalExtraServicesModalProps) => {
  const { saveAction } = props;
  const extrasStore = useStore<{ extras: any[] }>({
    extras: []
  });

  useTask$(({ track }) => {
    track(() => props.initialExtras);
    extrasStore.extras = props.initialExtras.map(e => ({
      ...e,
      id: e.id || Math.random().toString(36).substring(2, 9)
    }));
  });

  const addExtra = $(() => {
    extrasStore.extras = [...extrasStore.extras, {
      id: Math.random().toString(36).substring(2, 9),
      name: "",
      price: 0,
      icon: "⚽"
    }];
  });

  const removeExtra = $((id: string) => {
    extrasStore.extras = extrasStore.extras.filter(e => e.id !== id);
  });

  const updateExtra = $((id: string, field: string, value: any) => {
    extrasStore.extras = extrasStore.extras.map(e => e.id === id ? { ...e, [field]: value } : e);
  });

  return (
    <Modal.Root bind:show={props.showSignal}>
      <Modal.Panel class="bg-white p-8 rounded-[2rem] border shadow-2xl max-w-2xl w-full">
        <Modal.Title class="text-3xl font-black text-slate-800 mb-2 tracking-tighter">
          Servicios Adicionales
        </Modal.Title>
        <p class="text-slate-500 mb-8 font-medium">
          Configura los servicios extras (pelotas, bebidas, etc.) disponibles para todas las reservas.
        </p>

        <Form
          action={saveAction}
          class="space-y-6"
          onSubmitCompleted$={() => {
            props.showSignal.value = false;
          }}
        >
          <input type="hidden" name="extrasJson" value={JSON.stringify(extrasStore.extras)} />

          <div class="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
            {extrasStore.extras.map((extra) => (
              <div key={extra.id} class="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div class="w-16">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Icono</label>
                  <input
                    type="text"
                    value={extra.icon}
                    onChange$={(e) => updateExtra(extra.id, 'icon', (e.target as HTMLInputElement).value)}
                    required
                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-center"
                  />
                </div>
                <div class="flex-1">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre</label>
                  <input
                    type="text"
                    value={extra.name}
                    placeholder="Ej: Pelota Extra"
                    onChange$={(e) => updateExtra(extra.id, 'name', (e.target as HTMLInputElement).value)}
                    required
                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                  />
                </div>
                <div class="w-32">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio ($)</label>
                  <input
                    type="number"
                    value={extra.price}
                    onChange$={(e) => updateExtra(extra.id, 'price', Number((e.target as HTMLInputElement).value))}
                    required
                    min="0"
                    step="1"
                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-emerald-700"
                  />
                </div>
                <div class="pt-5">
                  <button
                    type="button"
                    onClick$={() => removeExtra(extra.id)}
                    class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar extra"
                  >
                    <LuTrash2 class="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            {extrasStore.extras.length === 0 && (
              <div class="text-center py-8 text-slate-400 font-medium italic border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                No hay servicios adicionales configurados.
              </div>
            )}
          </div>

          <div class="pt-2">
            <Button
              type="button"
              onClick$={addExtra}
              look="outline"
              class="w-full border-dashed border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 rounded-2xl py-3 font-bold flex justify-center items-center gap-2"
            >
              <LuPlus class="w-5 h-5" />
              Añadir Servicio Extra
            </Button>
          </div>

          <div class="pt-6 flex gap-3 border-t border-slate-100">
            <Button
              type="button"
              onClick$={() => props.showSignal.value = false}
              look="outline"
              class="flex-1 rounded-2xl py-4 font-bold border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              look="primary"
              disabled={saveAction.isRunning}
              class="flex-1 bg-slate-800 text-white hover:bg-slate-900 rounded-2xl py-4 font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {saveAction.isRunning ? (
                <LoadingSpinner class="w-5 h-5" />
              ) : (
                "Guardar Extras"
              )}
            </Button>
          </div>
        </Form>
      </Modal.Panel>
    </Modal.Root>
  );
});
