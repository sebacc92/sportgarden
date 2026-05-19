import { component$, type PropFunction } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { LuImage, LuSettings } from "@qwikest/icons/lucide";
import { LoadingSpinner } from "./LoadingSpinner";

interface PitchTableViewProps {
  pitches: any[];
  onEdit$: PropFunction<(pitch: any) => void>;
  toggleStatusAction: any;
}

export const PitchTableView = component$((props: PitchTableViewProps) => {
  const { pitches, onEdit$, toggleStatusAction } = props;

  return (
    <div class="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50 text-sm font-black tracking-widest text-slate-400 uppercase">
              <th class="px-6 py-5">Foto</th>
              <th class="px-6 py-5">Cancha</th>
              <th class="px-6 py-5">Superficie</th>
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
              const isToggling =
                toggleStatusAction.isRunning &&
                toggleStatusAction.formData?.get("id") === pitch.id;
              return (
                <tr
                  key={pitch.id}
                  class={[
                    "transition-colors hover:bg-slate-50/50",
                    !pitch.isActive && "opacity-70",
                  ]}
                >
                  <td class="px-6 py-6">
                    {pitch.imageUrl ? (
                      <img
                        src={pitch.imageUrl}
                        alt={pitch.name}
                        class="h-16 w-16 rounded-2xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <div class="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-300">
                        <LuImage class="h-7 w-7" />
                      </div>
                    )}
                  </td>
                  <td class="px-6 py-6">
                    <div class="text-xl font-black tracking-tight text-slate-800">
                      {pitch.name}
                    </div>
                    {pitch.notes && (
                      <div class="mt-1 max-w-[250px] text-xs font-medium text-slate-400">
                        {pitch.notes}
                      </div>
                    )}
                  </td>
                  <td class="px-6 py-6">
                    <span class="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-black tracking-widest text-slate-700 uppercase">
                      {pitch.surface || "Sintético"}
                    </span>
                  </td>
                  <td class="px-6 py-6">
                    <span class="rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-1 text-[10px] font-black tracking-widest text-emerald-800 uppercase">
                      {pitch.type}
                    </span>
                  </td>
                  <td class="px-6 py-6 text-2xl font-black tracking-tighter text-slate-800">
                    ${pitch.pricePerHour}
                  </td>
                  <td class="px-6 py-6 text-xl font-black tracking-tight text-slate-600">
                    {pitch.depositType === "FIXED"
                      ? `$${pitch.depositAmount}`
                      : `${pitch.depositAmount}%`}
                  </td>
                  <td class="px-6 py-6">
                    <div class="flex flex-wrap gap-2">
                      {pitch.isCovered && (
                        <span class="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-black tracking-widest text-blue-600 uppercase">
                          Cubierta
                        </span>
                      )}
                      {pitch.isLit && (
                        <span class="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-black tracking-widest text-amber-600 uppercase">
                          Luz
                        </span>
                      )}
                    </div>
                  </td>
                  <td class="px-6 py-6">
                    <span
                      class={[
                        "rounded-xl border-2 px-3 py-1.5 text-[10px] font-black tracking-[0.1em] uppercase",
                        pitch.isActive
                          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                          : "border-red-100 bg-red-50 text-red-700",
                      ]}
                    >
                      {pitch.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td class="px-6 py-6 text-right">
                    <div class="flex justify-end gap-3">
                      <button
                        onClick$={() => onEdit$(pitch)}
                        class="rounded-xl border border-transparent p-3 text-slate-400 shadow-none transition-all hover:border-slate-200 hover:bg-white hover:text-slate-800 hover:shadow-md"
                        title="Editar"
                      >
                        <LuSettings class="h-6 w-6" />
                      </button>
                      <Form action={toggleStatusAction}>
                        <input type="hidden" name="id" value={pitch.id} />
                        <button
                          type="submit"
                          disabled={isToggling}
                          class={[
                            "rounded-xl border-2 p-3 shadow-none transition-all hover:shadow-md",
                            pitch.isActive
                              ? "border-transparent text-amber-600 hover:border-amber-200 hover:bg-amber-50"
                              : "border-transparent text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50",
                          ]}
                          title={pitch.isActive ? "Deshabilitar" : "Habilitar"}
                        >
                          {isToggling ? (
                            <LoadingSpinner class="h-6 w-6" />
                          ) : pitch.isActive ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="28"
                              height="28"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <rect
                                x="1"
                                y="5"
                                width="22"
                                height="14"
                                rx="7"
                                ry="7"
                              ></rect>
                              <circle cx="16" cy="12" r="3"></circle>
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="28"
                              height="28"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            >
                              <rect
                                x="1"
                                y="5"
                                width="22"
                                height="14"
                                rx="7"
                                ry="7"
                              ></rect>
                              <circle cx="8" cy="12" r="3"></circle>
                            </svg>
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
