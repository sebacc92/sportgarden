import { component$, type Signal, type PropFunction } from "@builder.io/qwik";
import { Modal, Button } from "~/components/ui";

interface PitchSelectionModalProps {
  showSignal: Signal<boolean>;
  pitches: any[];
  onSelectForDeletion$: PropFunction<(pitch: any) => void>;
}

export const PitchSelectionModal = component$(
  (props: PitchSelectionModalProps) => {
    const { showSignal, pitches, onSelectForDeletion$ } = props;

    return (
      <Modal.Root bind:show={showSignal}>
        <Modal.Panel class="max-w-md rounded-[2rem] border bg-white p-8 shadow-2xl">
          <Modal.Title class="mb-6 text-2xl font-black tracking-tight text-slate-800">
            Seleccionar cancha a borrar
          </Modal.Title>
          <div class="max-h-[60vh] space-y-2 overflow-auto pr-2">
            {pitches.map((pitch) => (
              <button
                key={pitch.id}
                onClick$={() => onSelectForDeletion$(pitch)}
                class="group flex w-full items-center justify-between rounded-2xl border border-slate-100 p-4 text-left transition-all hover:border-red-200 hover:bg-red-50"
              >
                <div>
                  <div class="font-bold text-slate-800 group-hover:text-red-700">
                    {pitch.name}
                  </div>
                  <div class="text-xs font-black tracking-widest text-slate-400 uppercase">
                    {pitch.type}
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-slate-300 group-hover:text-red-500"
                >
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                </svg>
              </button>
            ))}
            {pitches.length === 0 && (
              <div class="py-8 text-center font-medium text-slate-400 italic">
                No hay canchas para borrar.
              </div>
            )}
          </div>
          <div class="mt-8">
            <Button
              onClick$={() => (showSignal.value = false)}
              look="outline"
              class="w-full rounded-2xl border-slate-200 font-bold"
            >
              Cerrar
            </Button>
          </div>
        </Modal.Panel>
      </Modal.Root>
    );
  },
);
