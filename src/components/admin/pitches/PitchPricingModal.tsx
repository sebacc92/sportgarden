import { component$, $, useStore, useTask$, type Signal } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { Modal, Button } from "~/components/ui";
import { LuPlus, LuTrash2 } from '@qwikest/icons/lucide';
import { LoadingSpinner } from "./LoadingSpinner";

interface PitchPricingModalProps {
  showSignal: Signal<boolean>;
  pitchId: string;
  pitchName: string;
  initialRules: any[];
  saveAction: any;
}

export const PitchPricingModal = component$((props: PitchPricingModalProps) => {
  const { saveAction } = props;
  const rules = useStore<{ rules: any[] }>({
    rules: []
  });

  useTask$(({ track }) => {
    track(() => props.initialRules);
    rules.rules = props.initialRules.map(r => ({
      ...r,
      id: r.id || Math.random().toString(36).substring(2, 9)
    }));
  });

  const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const addRule = $(() => {
    rules.rules = [...rules.rules, {
      id: Math.random().toString(36).substring(2, 9),
      dayOfWeek: 1, // Default Lunes
      startTime: "18:00",
      endTime: "19:00",
      price: 0,
    }];
  });

  const removeRule = $((id: string) => {
    rules.rules = rules.rules.filter(r => r.id !== id);
  });

  const updateRule = $((id: string, field: string, value: any) => {
    rules.rules = rules.rules.map(r => r.id === id ? { ...r, [field]: value } : r);
  });

  return (
    <Modal.Root bind:show={props.showSignal}>
      <Modal.Panel class="bg-white p-8 rounded-[2rem] border shadow-2xl max-w-3xl w-full">
        <Modal.Title class="text-3xl font-black text-slate-800 mb-2 tracking-tighter">
          Precios Dinámicos
        </Modal.Title>
        <p class="text-slate-500 mb-8 font-medium">
          Configura franjas horarias para <span class="font-black text-slate-800">{props.pitchName}</span>.
        </p>

        <Form
          action={saveAction}
          class="space-y-6"
          onSubmitCompleted$={() => {
            props.showSignal.value = false;
          }}
        >
          <input type="hidden" name="pitchId" value={props.pitchId} />
          <input type="hidden" name="rulesJson" value={JSON.stringify(rules.rules)} />

          <div class="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
            {rules.rules.map((rule) => (
              <div key={rule.id} class="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div class="flex-1">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Día</label>
                  <select
                    value={rule.dayOfWeek}
                    onChange$={(e) => updateRule(rule.id, 'dayOfWeek', Number((e.target as HTMLSelectElement).value))}
                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                  >
                    {daysOfWeek.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
                <div class="w-24">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inicio</label>
                  <input
                    type="time"
                    value={rule.startTime}
                    onChange$={(e) => updateRule(rule.id, 'startTime', (e.target as HTMLInputElement).value)}
                    required
                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                  />
                </div>
                <div class="w-24">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fin</label>
                  <input
                    type="time"
                    value={rule.endTime}
                    onChange$={(e) => updateRule(rule.id, 'endTime', (e.target as HTMLInputElement).value)}
                    required
                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                  />
                </div>
                <div class="w-32">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio ($)</label>
                  <input
                    type="number"
                    value={rule.price}
                    onChange$={(e) => updateRule(rule.id, 'price', Number((e.target as HTMLInputElement).value))}
                    required
                    min="0"
                    step="0.01"
                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-emerald-700"
                  />
                </div>
                <div class="pt-5">
                  <button
                    type="button"
                    onClick$={() => removeRule(rule.id)}
                    class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar franja"
                  >
                    <LuTrash2 class="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            {rules.rules.length === 0 && (
              <div class="text-center py-8 text-slate-400 font-medium italic border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                No hay franjas de precios configuradas.
              </div>
            )}
          </div>

          <div class="pt-2">
            <Button
              type="button"
              onClick$={addRule}
              look="outline"
              class="w-full border-dashed border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 rounded-2xl py-3 font-bold flex justify-center items-center gap-2"
            >
              <LuPlus class="w-5 h-5" />
              Añadir Franja Horaria
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
                "Guardar Precios"
              )}
            </Button>
          </div>
        </Form>
      </Modal.Panel>
    </Modal.Root>
  );
});
