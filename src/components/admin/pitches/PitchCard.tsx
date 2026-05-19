import { component$, type PropFunction } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { LuImage } from "@qwikest/icons/lucide";
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
  const isToggling =
    toggleStatusAction.isRunning &&
    toggleStatusAction.formData?.get("id") === pitch.id;

  return (
    <div
      class={[
        "group relative overflow-hidden rounded-3xl border p-6 shadow-sm transition-all duration-500",
        pitch.isActive
          ? "border-slate-200 bg-white hover:border-emerald-500 hover:shadow-md"
          : "border-slate-300 bg-slate-100 opacity-80 hover:border-emerald-400",
      ]}
    >
      {/* Decorative Number Badge */}
      <div class="absolute inset-0 z-0">
        <div class="absolute top-0 right-0 flex h-16 w-16 items-center justify-center rounded-bl-3xl bg-emerald-50/50 transition-colors group-hover:bg-emerald-100/50">
          <span class="text-4xl leading-none font-black text-emerald-200 transition-colors group-hover:text-emerald-300">
            {index + 1}
          </span>
        </div>
      </div>

      <div class="relative z-10">
        <div class="mb-4 flex items-start justify-between">
          <div>
            <h3 class="mb-1 flex items-center gap-2 text-xl leading-tight font-black text-slate-800">
              {pitch.name}
              {pitch.imageUrl && (
                <a
                  href={pitch.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-slate-400 transition-colors hover:text-emerald-500"
                  title="Ver foto de la cancha"
                >
                  <LuImage class="h-5 w-5" />
                </a>
              )}
            </h3>
            <div class="flex flex-wrap gap-1.5">
              <span class="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-widest text-slate-700 uppercase">
                {pitch.surface || "Sintético"}
              </span>
              <span class="rounded-lg border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-black tracking-widest text-emerald-800 uppercase">
                {pitch.type}
              </span>
              {pitch.isCovered && (
                <span class="rounded-lg border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-black tracking-widest text-blue-600 uppercase">
                  Cubierta
                </span>
              )}
              {pitch.isLit && (
                <span class="rounded-lg border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-black tracking-widest text-amber-600 uppercase">
                  Luz
                </span>
              )}
              {!pitch.isActive && (
                <span class="rounded-lg border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-black tracking-widest text-red-700 uppercase">
                  Inactiva
                </span>
              )}
              {pitch.pricingRules?.length > 0 && (
                <span class="rounded-lg border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] font-black tracking-widest text-violet-600 uppercase">
                  {pitch.pricingRules.length} regla
                  {pitch.pricingRules.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div class="mb-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <div class="mb-2 flex items-end justify-between">
            <div>
              <div class="mb-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                Precio x Hora
              </div>
              <div class="text-2xl font-black text-slate-800">
                $<span>{pitch.pricePerHour}</span>
              </div>
            </div>
            <div class="text-right">
              <div class="mb-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                Seña
              </div>
              <div class="text-lg font-black text-slate-600">
                {pitch.depositType === "FIXED" ? (
                  <>
                    $<span>{pitch.depositAmount}</span>
                  </>
                ) : (
                  <>
                    <span>{pitch.depositAmount ?? 0}</span>%
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {pitch.notes && (
          <div class="mb-4 line-clamp-2 text-xs leading-relaxed font-medium text-slate-400 italic">
            {pitch.notes}
          </div>
        )}

        <div class="flex gap-3">
          <Button
            onClick$={() => onEdit$(pitch)}
            look="outline"
            size="sm"
            class="flex-1 rounded-xl border-slate-200 font-bold text-slate-700 hover:bg-slate-50"
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
                "flex w-full items-center justify-center gap-2 rounded-xl border-2 font-bold transition-all",
                pitch.isActive
                  ? "border-amber-100 text-amber-700 hover:border-amber-200 hover:bg-amber-50"
                  : "border-emerald-100 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50",
              ]}
            >
              {isToggling ? (
                <LoadingSpinner class="h-4 w-4" />
              ) : pitch.isActive ? (
                "Deshabilitar"
              ) : (
                "Habilitar"
              )}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
});
