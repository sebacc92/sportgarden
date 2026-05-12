import { component$, type Signal } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { Modal, Button } from "~/components/ui";
import { LoadingSpinner } from "./LoadingSpinner";

interface PitchDeleteConfirmModalProps {
  showSignal: Signal<boolean>;
  pitchToDelete: Signal<{ id: string; name: string } | null>;
  deleteAction: any;
}

export const PitchDeleteConfirmModal = component$((props: PitchDeleteConfirmModalProps) => {
  const { showSignal, pitchToDelete, deleteAction } = props;

  return (
    <Modal.Root bind:show={showSignal}>
      <Modal.Panel class="bg-white p-8 rounded-[2rem] border shadow-2xl max-w-sm text-center">
        <div class="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </div>
        <Modal.Title class="text-2xl font-black text-slate-800 mb-2 tracking-tight">¿Borrar cancha?</Modal.Title>
        <p class="text-slate-500 mb-8 font-medium">
          Estás por borrar la cancha <span class="font-black text-slate-800">"{pitchToDelete.value?.name}"</span>. Esta acción es irreversible.
        </p>

        <div class="flex gap-3">
          <Button
            onClick$={() => showSignal.value = false}
            look="outline"
            class="flex-1 rounded-2xl font-bold border-slate-200"
          >
            Cancelar
          </Button>
          <Form
            action={deleteAction}
            onSubmitCompleted$={() => showSignal.value = false}
            class="flex-1"
          >
            <input type="hidden" name="id" value={pitchToDelete.value?.id} />
            <Button
              type="submit"
              look="primary"
              disabled={deleteAction.isRunning}
              class="w-full bg-red-600 text-white hover:bg-red-700 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {deleteAction.isRunning ? (
                <LoadingSpinner class="w-5 h-5" />
              ) : (
                "Borrar"
              )}
            </Button>
          </Form>
        </div>

        {deleteAction.value?.success === false && (
          <div class="mt-6 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 leading-tight">
            {deleteAction.value.message}
          </div>
        )}
      </Modal.Panel>
    </Modal.Root>
  );
});
