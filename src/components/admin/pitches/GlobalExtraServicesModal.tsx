import {
  component$,
  $,
  useStore,
  useTask$,
  type Signal,
} from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { Modal, Button } from "~/components/ui";
import { LuPlus, LuTrash2 } from "@qwikest/icons/lucide";
import { LoadingSpinner } from "./LoadingSpinner";

interface GlobalExtraServicesModalProps {
  showSignal: Signal<boolean>;
  initialExtras: any[];
  saveAction: any;
}

export const GlobalExtraServicesModal = component$(
  (props: GlobalExtraServicesModalProps) => {
    const { saveAction } = props;
    const extrasStore = useStore<{ extras: any[] }>({
      extras: [],
    });

    useTask$(({ track }) => {
      track(() => props.initialExtras);
      extrasStore.extras = props.initialExtras.map((e) => ({
        ...e,
        id: e.id || Math.random().toString(36).substring(2, 9),
      }));
    });

    const addExtra = $(() => {
      extrasStore.extras = [
        ...extrasStore.extras,
        {
          id: Math.random().toString(36).substring(2, 9),
          name: "",
          price: 0,
          icon: "⚽",
        },
      ];
    });

    const removeExtra = $((id: string) => {
      extrasStore.extras = extrasStore.extras.filter((e) => e.id !== id);
    });

    const updateExtra = $((id: string, field: string, value: any) => {
      extrasStore.extras = extrasStore.extras.map((e) =>
        e.id === id ? { ...e, [field]: value } : e,
      );
    });

    return (
      <Modal.Root bind:show={props.showSignal}>
        <Modal.Panel class="w-full max-w-2xl rounded-[2rem] border bg-white p-8 shadow-2xl">
          <Modal.Title class="mb-2 text-3xl font-black tracking-tighter text-slate-800">
            Servicios Adicionales
          </Modal.Title>
          <p class="mb-8 font-medium text-slate-500">
            Configura los servicios extras (pelotas, bebidas, etc.) disponibles
            para todas las reservas.
          </p>

          <Form
            action={saveAction}
            class="space-y-6"
            onSubmitCompleted$={() => {
              props.showSignal.value = false;
            }}
          >
            <input
              type="hidden"
              name="extrasJson"
              value={JSON.stringify(extrasStore.extras)}
            />

            <div class="max-h-[50vh] space-y-4 overflow-y-auto pr-2">
              {extrasStore.extras.map((extra) => (
                <div
                  key={extra.id}
                  class="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div class="w-16">
                    <label class="mb-1 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Icono
                    </label>
                    <input
                      type="text"
                      value={extra.icon}
                      onChange$={(e) =>
                        updateExtra(
                          extra.id,
                          "icon",
                          (e.target as HTMLInputElement).value,
                        )
                      }
                      required
                      class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div class="flex-1">
                    <label class="mb-1 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={extra.name}
                      placeholder="Ej: Pelota Extra"
                      onChange$={(e) =>
                        updateExtra(
                          extra.id,
                          "name",
                          (e.target as HTMLInputElement).value,
                        )
                      }
                      required
                      class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div class="w-32">
                    <label class="mb-1 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Precio ($)
                    </label>
                    <input
                      type="number"
                      value={extra.price}
                      onChange$={(e) =>
                        updateExtra(
                          extra.id,
                          "price",
                          Number((e.target as HTMLInputElement).value),
                        )
                      }
                      required
                      min="0"
                      step="1"
                      class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div class="pt-5">
                    <button
                      type="button"
                      onClick$={() => removeExtra(extra.id)}
                      class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Eliminar extra"
                    >
                      <LuTrash2 class="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}

              {extrasStore.extras.length === 0 && (
                <div class="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-8 text-center font-medium text-slate-400 italic">
                  No hay servicios adicionales configurados.
                </div>
              )}
            </div>

            <div class="pt-2">
              <Button
                type="button"
                onClick$={addExtra}
                look="outline"
                class="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-3 font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              >
                <LuPlus class="h-5 w-5" />
                Añadir Servicio Extra
              </Button>
            </div>

            <div class="flex gap-3 border-t border-slate-100 pt-6">
              <Button
                type="button"
                onClick$={() => (props.showSignal.value = false)}
                look="outline"
                class="flex-1 rounded-2xl border-slate-200 py-4 font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                look="primary"
                disabled={saveAction.isRunning}
                class="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-800 py-4 font-black tracking-widest text-white uppercase hover:bg-slate-900"
              >
                {saveAction.isRunning ? (
                  <LoadingSpinner class="h-5 w-5" />
                ) : (
                  "Guardar Extras"
                )}
              </Button>
            </div>
          </Form>
        </Modal.Panel>
      </Modal.Root>
    );
  },
);
