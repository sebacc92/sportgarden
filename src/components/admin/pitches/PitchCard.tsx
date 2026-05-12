import { component$, type PropFunction } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { LuImage } from '@qwikest/icons/lucide';
import { Button } from "~/components/ui";
import { LoadingSpinner } from "./LoadingSpinner";

interface PitchCardProps {
  pitch: any;
  index: number;
  onEdit$: PropFunction<(pitch: any) => void>;
  toggleStatusAction: any;
}

export const PitchCard = component$((props: PitchCardProps) => {
  const { pitch, index, onEdit$, toggleStatusAction } = props;
  const isToggling = toggleStatusAction.isRunning && toggleStatusAction.formData?.get("id") === pitch.id;

  return (
    <div
      class={[
        "group p-6 rounded-3xl border shadow-sm transition-all duration-500 relative overflow-hidden",
        pitch.isActive 
          ? "bg-white border-slate-200 hover:border-emerald-500 hover:shadow-md" 
          : "bg-slate-100 border-slate-300 opacity-80 hover:border-emerald-400"
      ]}
    >
      {/* Decorative Number Badge */}
      <div class="absolute inset-0 z-0">
        <div class="absolute top-0 right-0 w-16 h-16 bg-emerald-50/50 flex items-center justify-center rounded-bl-3xl transition-colors group-hover:bg-emerald-100/50">
          <span class="text-4xl font-black text-emerald-200 group-hover:text-emerald-300 transition-colors leading-none">{index + 1}</span>
        </div>
      </div>

      <div class="relative z-10">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="font-black text-xl mb-1 leading-tight text-slate-800 flex items-center gap-2">
              {pitch.name}
              {pitch.imageUrl && (
                <a href={pitch.imageUrl} target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-emerald-500 transition-colors" title="Ver foto de la cancha">
                  <LuImage class="w-5 h-5" />
                </a>
              )}
            </h3>
            <div class="flex flex-wrap gap-1.5">
              <span class="bg-slate-800 text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">{pitch.type}</span>
              {pitch.isCovered && (
                <span class="text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-widest border border-blue-100">Cubierta</span>
              )}
              {pitch.isLit && (
                <span class="text-amber-600 font-black bg-amber-50 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-widest border border-amber-100">Iluminada</span>
              )}
              {!pitch.isActive && (
                <span class="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] uppercase font-black rounded-lg tracking-widest border border-red-200">Inactiva</span>
              )}
              {pitch.pricingRules?.length > 0 && (
                <span class="text-violet-600 font-black bg-violet-50 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-widest border border-violet-100">{pitch.pricingRules.length} regla{pitch.pricingRules.length > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>

        <div class="bg-slate-50/50 rounded-2xl p-4 mb-4 border border-slate-100">
          <div class="flex justify-between items-end mb-2">
            <div>
              <div class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Precio x Hora</div>
              <div class="text-2xl font-black text-slate-800">$<span>{pitch.pricePerHour}</span></div>
            </div>
            <div class="text-right">
              <div class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Seña</div>
              <div class="text-lg font-black text-slate-600">
                {pitch.depositType === "FIXED"
                  ? <>$<span>{pitch.depositAmount}</span></>
                  : <><span>{pitch.depositAmount ?? 0}</span>%</>
                }
              </div>
            </div>
          </div>
        </div>

        {pitch.notes && (
          <div class="text-xs text-slate-400 font-medium italic mb-4 leading-relaxed line-clamp-2">
            {pitch.notes}
          </div>
        )}

        <div class="flex gap-3">
          <Button
            onClick$={() => onEdit$(pitch)}
            look="outline"
            size="sm"
            class="flex-1 rounded-xl font-bold border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            Editar
          </Button>
          <Form action={toggleStatusAction} class="flex-1">
            <input type="hidden" name="id" value={pitch.id} />
            <Button
              type="submit"
              look="outline"
              size="sm"
              disabled={isToggling}
              class={[
                "w-full rounded-xl font-bold border-2 transition-all flex items-center justify-center gap-2",
                pitch.isActive
                  ? "border-amber-100 text-amber-700 hover:bg-amber-50 hover:border-amber-200"
                  : "border-emerald-100 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200"
              ]}
            >
              {isToggling ? (
                <LoadingSpinner class="w-4 h-4" />
              ) : (
                pitch.isActive ? "Deshabilitar" : "Habilitar"
              )}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
});
