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
  /** Inlined calendar.css so the print window is fully styled. */
  printCss: string;
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
                // Print from a dedicated window: the agenda renders in normal
                // document flow there, so the timeline + long detail table
                // paginate correctly instead of being clipped inside the modal.
                const source = document.querySelector(
                  ".print-area .print-day-view",
                );
                if (!source) {
                  window.print();
                  return;
                }
                const win = window.open("", "_blank", "width=1200,height=850");
                if (!win) {
                  // Popup blocked → fall back to in-place print.
                  window.print();
                  return;
                }
                // Used as the default PDF filename → include the day's date.
                const dateLabel = props.selectedDateStr
                  .split("-")
                  .reverse()
                  .join("-");
                win.document.open();
                win.document.write(
                  `<!doctype html><html lang="es"><head><meta charset="utf-8" />` +
                    `<title>Reservas Garden Club ${dateLabel}</title>` +
                    `<style>${props.printCss}</style>` +
                    `<style>@page{size:A4 landscape;margin:8mm}` +
                    `html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
                    `</style></head><body>${source.outerHTML}</body></html>`,
                );
                win.document.close();
                win.focus();
                win.onafterprint = () => win.close();
                // Let the new document lay out before invoking the print dialog.
                setTimeout(() => win.print(), 350);
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
