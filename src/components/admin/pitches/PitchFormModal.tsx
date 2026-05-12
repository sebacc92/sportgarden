import { component$, type Signal, type PropFunction } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { LuImage, LuTrash2, LuSettings } from '@qwikest/icons/lucide';
import { Button } from "~/components/ui";
import { LoadingSpinner } from "./LoadingSpinner";

interface EditModalState {
  id: string | null;
  name: string;
  type: string;
  pricePerHour: number;
  depositType: string;
  depositAmount: number;
  isCovered: boolean;
  isLit: boolean;
  notes: string;
  imageUrl: string | null;
  previewUrl: string | null;
}

interface PitchFormModalProps {
  editModalState: Signal<EditModalState | null>;
  isCompressing: Signal<boolean>;
  createAction: any;
  updateAction: any;
  onPricingClick$: PropFunction<() => void>;
  selectedPitchForPricing: Signal<any>;
  onSubmit$: PropFunction<(e: Event, currentTarget: HTMLFormElement) => void>;
  onFileChange$: PropFunction<(e: Event) => void>;
}

export const PitchFormModal = component$((props: PitchFormModalProps) => {
  const { editModalState, isCompressing, createAction, updateAction, onPricingClick$, selectedPitchForPricing, onSubmit$, onFileChange$ } = props;

  if (!editModalState.value) return null;

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background: rgba(0,0,0,0.5)"
      onClick$={(e) => { if ((e.target as HTMLElement).dataset.overlay) editModalState.value = null; }}
      data-overlay="true"
    >
      <div class="bg-white rounded-[2rem] border shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Fixed header */}
        <div class="px-8 pt-8 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 class="text-3xl font-black text-slate-800 tracking-tighter">
            {editModalState.value.id ? "Editar Cancha" : "Nueva Cancha"}
          </h2>
          <button
            type="button"
            onClick$={() => { editModalState.value = null; }}
            class="text-slate-400 hover:text-slate-700 transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div class="overflow-y-auto flex-1 px-8 py-6">
          <div>
        <Form
          action={editModalState.value.id ? updateAction : createAction}
          class="space-y-6"
          preventdefault:submit
          onSubmit$={onSubmit$}
        >
          {editModalState.value.id && <input type="hidden" name="id" value={editModalState.value.id} />}
          <input type="hidden" name="imageUrl" value={editModalState.value.imageUrl || ""} />

          {/* Top row: image + nombre/tipo/atributos */}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Image Upload */}
            <div>
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Foto de la Cancha</label>
              <div class="h-44 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
                {(editModalState.value.previewUrl || editModalState.value.imageUrl) ? (
                  <>
                    <img src={editModalState.value.previewUrl || editModalState.value.imageUrl!} alt="Foto cancha" class="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick$={() => {
                        if (editModalState.value) {
                          editModalState.value = { ...editModalState.value, imageUrl: null, previewUrl: null };
                        }
                      }}
                      class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white"
                      title="Eliminar foto"
                    >
                      <LuTrash2 class="w-8 h-8" />
                    </button>
                  </>
                ) : (
                  <div class="text-slate-400 flex flex-col items-center">
                    <LuImage class="w-8 h-8 mb-2" />
                    <span class="text-xs font-bold uppercase tracking-widest">Subir Imagen</span>
                  </div>
                )}
                {isCompressing.value && (
                  <div class="absolute inset-0 bg-white/80 flex flex-col items-center justify-center">
                    <div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  onChange$={onFileChange$}
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isCompressing.value}
                />
              </div>
            </div>

            {/* Nombre + Tipo + Atributos */}
            <div class="flex flex-col gap-4">
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nombre de la cancha</label>
                <input
                  type="text"
                  name="name"
                  value={editModalState.value.name}
                  required
                  placeholder="Ej: Cancha 1 (Sintético)"
                  class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold"
                />
              </div>
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tipo</label>
                <select
                  name="type"
                  value={editModalState.value.type}
                  class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold appearance-none"
                >
                  <option value="F5">F5 (5 vs 5)</option>
                  <option value="F7">F7 (7 vs 7)</option>
                  <option value="F9">F9 (9 vs 9)</option>
                  <option value="F11">F11 (11 vs 11)</option>
                </select>
              </div>
              <div class="flex gap-3">
                <label class="flex-1 flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-3 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors">
                  <input type="checkbox" name="isCovered" checked={editModalState.value.isCovered} class="w-4 h-4 rounded accent-slate-800 cursor-pointer" />
                  <span class="text-xs font-black text-slate-600 uppercase tracking-widest">Cubierta</span>
                </label>
                <label class="flex-1 flex items-center gap-2 cursor-pointer bg-amber-50 px-3 py-3 rounded-2xl border border-amber-200 hover:bg-amber-100 transition-colors">
                  <input type="checkbox" name="isLit" checked={editModalState.value.isLit} class="w-4 h-4 rounded accent-amber-500 cursor-pointer" />
                  <span class="text-xs font-black text-amber-700 uppercase tracking-widest">Iluminada</span>
                </label>
              </div>
            </div>
          </div>

          {/* Precios: hora + seña en fila */}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Precio x Hora ($)</label>
              <input
                type="number"
                name="pricePerHour"
                value={editModalState.value.pricePerHour}
                required
                min="0"
                step="1"
                class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold"
              />
            </div>

            <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <label class="block text-xs font-black text-emerald-700 uppercase tracking-widest mb-2">Seña requerida</label>
              <div class="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick$={() => { if (editModalState.value) editModalState.value = { ...editModalState.value, depositType: "PERCENTAGE" }; }}
                  class={["flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", editModalState.value.depositType === "PERCENTAGE" ? "bg-emerald-600 text-white" : "bg-white text-slate-500 border border-slate-200"]}
                >% %</button>
                <button
                  type="button"
                  onClick$={() => { if (editModalState.value) editModalState.value = { ...editModalState.value, depositType: "FIXED" }; }}
                  class={["flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", editModalState.value.depositType === "FIXED" ? "bg-emerald-600 text-white" : "bg-white text-slate-500 border border-slate-200"]}
                >$ Fijo</button>
              </div>
              <input type="hidden" name="depositType" value={editModalState.value.depositType} />
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-sm">
                  {editModalState.value.depositType === "PERCENTAGE" ? "%" : "$"}
                </span>
                <input
                  type="number"
                  name="depositAmount"
                  value={editModalState.value.depositAmount}
                  min="0"
                  max={editModalState.value.depositType === "PERCENTAGE" ? 100 : undefined}
                  step={editModalState.value.depositType === "PERCENTAGE" ? 1 : 100}
                  placeholder={editModalState.value.depositType === "PERCENTAGE" ? "50" : "5000"}
                  class="w-full pl-8 pr-3 py-2.5 bg-white border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-emerald-900"
                />
              </div>
            </div>
          </div>

          {/* Precios Dinámicos (solo en edición) */}
          {editModalState.value.id && selectedPitchForPricing.value && (
            <div class="border-t border-slate-100 pt-4 flex items-center justify-between">
              <div>
                <div class="text-xs font-black text-slate-400 uppercase tracking-widest">Precios Dinámicos</div>
                <div class="text-xs text-slate-400 font-medium mt-0.5">Franjas horarias con precio especial</div>
              </div>
              <button
                type="button"
                onClick$={onPricingClick$}
                class="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                <LuSettings class="w-3.5 h-3.5" />
                {selectedPitchForPricing.value.rules.length > 0 ? `${selectedPitchForPricing.value.rules.length} regla${selectedPitchForPricing.value.rules.length > 1 ? 's' : ''}` : "Configurar"}
              </button>
            </div>
          )}

          {/* Aclaraciones */}
          <div>
            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Aclaraciones</label>
            <textarea
              name="notes"
              value={editModalState.value.notes}
              placeholder="Ej: Tiene vestuario propio, apta para lluvia..."
              rows={2}
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-medium resize-none"
            />
          </div>

          {/* Botones */}
          <div class="pt-4 flex gap-3 border-t border-slate-100 mt-4">
            <Button
              type="button"
              onClick$={() => { editModalState.value = null; }}
              look="outline"
              class="flex-1 rounded-2xl py-4 font-bold border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              look="primary"
              disabled={createAction.isRunning || updateAction.isRunning || isCompressing.value}
              class="flex-1 bg-slate-800 text-white hover:bg-slate-900 rounded-2xl py-4 font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {(createAction.isRunning || updateAction.isRunning || isCompressing.value) ? (
                <LoadingSpinner class="w-5 h-5" />
              ) : (
                editModalState.value.id ? "Guardar" : "Crear"
              )}
            </Button>
          </div>
        </Form>
        </div>
      </div>
    </div>
  </div>
  );
});
