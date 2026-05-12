import { component$, type Signal, type PropFunction } from "@builder.io/qwik";
import { Modal, Button } from "~/components/ui";

interface PitchSelectionModalProps {
  showSignal: Signal<boolean>;
  pitches: any[];
  onSelectForDeletion$: PropFunction<(pitch: any) => void>;
}

export const PitchSelectionModal = component$((props: PitchSelectionModalProps) => {
  const { showSignal, pitches, onSelectForDeletion$ } = props;

  return (
    <Modal.Root bind:show={showSignal}>
      <Modal.Panel class="bg-white p-8 rounded-[2rem] border shadow-2xl max-w-md">
        <Modal.Title class="text-2xl font-black text-slate-800 mb-6 tracking-tight">Seleccionar cancha a borrar</Modal.Title>
        <div class="space-y-2 max-h-[60vh] overflow-auto pr-2">
          {pitches.map((pitch) => (
            <button
              key={pitch.id}
              onClick$={() => onSelectForDeletion$(pitch)}
              class="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-red-200 hover:bg-red-50 transition-all text-left group"
            >
              <div>
                <div class="font-bold text-slate-800 group-hover:text-red-700">{pitch.name}</div>
                <div class="text-xs text-slate-400 uppercase font-black tracking-widest">{pitch.type}</div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 group-hover:text-red-500"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path></svg>
            </button>
          ))}
          {pitches.length === 0 && (
            <div class="text-center py-8 text-slate-400 font-medium italic">No hay canchas para borrar.</div>
          )}
        </div>
        <div class="mt-8">
          <Button
            onClick$={() => showSignal.value = false}
            look="outline"
            class="w-full rounded-2xl border-slate-200 font-bold"
          >
            Cerrar
          </Button>
        </div>
      </Modal.Panel>
    </Modal.Root>
  );
});
