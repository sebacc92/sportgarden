import { component$, type PropFunction } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { LuImage, LuSettings } from '@qwikest/icons/lucide';
import { LoadingSpinner } from "./LoadingSpinner";

interface PitchTableViewProps {
  pitches: any[];
  onEdit$: PropFunction<(pitch: any) => void>;
  toggleStatusAction: any;
}

export const PitchTableView = component$((props: PitchTableViewProps) => {
  const { pitches, onEdit$, toggleStatusAction } = props;

  return (
    <div class="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th class="px-6 py-5">Foto</th>
              <th class="px-6 py-5">Cancha</th>
              <th class="px-6 py-5">Tipo</th>
              <th class="px-6 py-5">Precio x Hora</th>
              <th class="px-6 py-5">Seña</th>
              <th class="px-6 py-5">Atributos</th>
              <th class="px-6 py-5">Estado</th>
              <th class="px-6 py-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {pitches.map((pitch) => {
              const isToggling = toggleStatusAction.isRunning && toggleStatusAction.formData?.get("id") === pitch.id;
              return (
                <tr key={pitch.id} class={["hover:bg-slate-50/50 transition-colors", !pitch.isActive && "opacity-70"]}>
                  <td class="px-6 py-6">
                    {pitch.imageUrl ? (
                      <img src={pitch.imageUrl} alt={pitch.name} class="w-16 h-16 rounded-2xl object-cover border border-slate-200" />
                    ) : (
                      <div class="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300">
                        <LuImage class="w-7 h-7" />
                      </div>
                    )}
                  </td>
                  <td class="px-6 py-6">
                    <div class="font-black text-xl text-slate-800 tracking-tight">{pitch.name}</div>
                    {pitch.notes && <div class="text-xs text-slate-400 font-medium mt-1 max-w-[250px]">{pitch.notes}</div>}
                  </td>
                  <td class="px-6 py-6">
                    <span class="bg-slate-800 text-white px-3 py-1 rounded-lg text-sm font-black tracking-wider">{pitch.type}</span>
                  </td>
                  <td class="px-6 py-6 font-black text-2xl text-slate-800 tracking-tighter">${pitch.pricePerHour}</td>
                  <td class="px-6 py-6 text-xl font-black text-slate-600 tracking-tight">
                    {pitch.depositType === "FIXED" ? `$${pitch.depositAmount}` : `${pitch.depositAmount}%`}
                  </td>
                  <td class="px-6 py-6">
                    <div class="flex flex-wrap gap-2">
                      {pitch.isCovered && <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest border border-blue-100">Cubierta</span>}
                      {pitch.isLit && <span class="bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest border border-amber-100">Luz</span>}
                    </div>
                  </td>
                  <td class="px-6 py-6">
                    <span class={["px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-[0.1em] border-2", pitch.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"]}>
                      {pitch.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td class="px-6 py-6 text-right">
                    <div class="flex justify-end gap-3">
                      <button
                        onClick$={() => onEdit$(pitch)}
                        class="p-3 text-slate-400 hover:text-slate-800 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all shadow-none hover:shadow-md"
                        title="Editar"
                      >
                        <LuSettings class="w-6 h-6" />
                      </button>
                      <Form action={toggleStatusAction}>
                        <input type="hidden" name="id" value={pitch.id} />
                        <button
                          type="submit"
                          disabled={isToggling}
                          class={["p-3 rounded-xl border-2 transition-all shadow-none hover:shadow-md", pitch.isActive ? "text-amber-600 border-transparent hover:border-amber-200 hover:bg-amber-50" : "text-emerald-600 border-transparent hover:border-emerald-200 hover:bg-emerald-50"]}
                          title={pitch.isActive ? "Deshabilitar" : "Habilitar"}
                        >
                          {isToggling ? <LoadingSpinner class="w-6 h-6" /> : (
                            pitch.isActive ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="7" ry="7"></rect><circle cx="16" cy="12" r="3"></circle></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="7" ry="7"></rect><circle cx="8" cy="12" r="3"></circle></svg>
                            )
                          )}
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
