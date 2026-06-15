import { component$, type Signal } from "@builder.io/qwik";
import { Modal, Button } from "~/components/ui";
import { PrintDayView } from "./PrintDayView";

interface PrintModalProps {
  isPrintModalOpen: Signal<boolean>;
  selectedDateStr: string;
  bookings: any[];
  pitches: any[];
  settings: any;
  todaySchedule: any;
}

export const PrintModal = component$<PrintModalProps>((props) => {
  return (
    <Modal.Root bind:show={props.isPrintModalOpen}>
      <Modal.Panel class="relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div class="p-8">
          <div class="no-print mb-6 flex items-center justify-between">
            <h3 class="flex items-center gap-2 text-xl font-black text-slate-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Imprimir Agenda del Día
            </h3>
            <button
              onClick$={() => (props.isPrintModalOpen.value = false)}
              class="p-2 text-slate-400 hover:text-slate-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="print-area max-h-[70vh] overflow-auto rounded-2xl border shadow-sm">
            <PrintDayView
              selectedDateStr={props.selectedDateStr}
              bookings={props.bookings}
              pitches={props.pitches}
              settings={props.settings}
              todaySchedule={props.todaySchedule}
            />
          </div>

          <div class="no-print mt-8 flex justify-end gap-3">
            <Button
              onClick$={() => (props.isPrintModalOpen.value = false)}
              look="ghost"
              class="font-bold text-slate-500"
            >
              Cancelar
            </Button>
            <Button
              onClick$={() => {
                window.print();
                props.isPrintModalOpen.value = false;
              }}
              class="flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-3 font-black text-white shadow-lg transition-all hover:bg-slate-900"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Imprimir Ahora
            </Button>
          </div>
        </div>
      </Modal.Panel>
    </Modal.Root>
  );
});
