import { component$, $, useSignal, useTask$ } from "@builder.io/qwik";
import { routeAction$, routeLoader$, zod$, z, Form, useNavigate } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { pitches, pitchOverlaps } from "~/db/schema";
import { put } from '@vercel/blob';
import imageCompression from 'browser-image-compression';
import { Button } from "~/components/ui";
import { LuImage, LuTrash2, LuSettings, LuArrowLeft } from '@qwikest/icons/lucide';
import { cn } from "@qwik-ui/utils";

// Loader for overlaps selection
export const useAllPitches = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return db.query.pitches.findMany({
    orderBy: (pitches, { asc }) => [asc(pitches.name)],
    columns: { id: true, name: true }
  });
});

export const useCreatePitchAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const id = Math.random().toString(36).substring(2, 11);

    let uploadedImageUrl = data.imageUrl || null;

    if (data.image && typeof data.image === 'object' && (data.image as Blob).size > 0) {
      const file = data.image as File;
      const fileName = `pitch-${id}-${Date.now()}.webp`;
      const { url } = await put(fileName, file, {
        access: 'public',
        token: requestEvent.env.get('BLOB_READ_WRITE_TOKEN'),
      });
      uploadedImageUrl = url;
    }

    await db.insert(pitches).values({
      id,
      name: data.name,
      type: data.type as "F5" | "F6" | "F9",
      isCovered: data.isCovered === "on",
      isLit: data.isLit === "on",
      pricePerHour: Number(data.pricePerHour),
      depositType: (data.depositType as "PERCENTAGE" | "FIXED") || "PERCENTAGE",
      depositAmount: Number(data.depositAmount) || 0,
      notes: data.notes || null,
      isActive: true,
      imageUrl: uploadedImageUrl,
      sport: data.sport || "Fútbol",
      surface: data.surface || "Sintético",
    });

    // Handle overlaps
    const overlapIds = JSON.parse(data.overlaps || "[]") as string[];
    if (overlapIds.length > 0) {
      await db.insert(pitchOverlaps).values(
        overlapIds.map(oid => ({
          id: Math.random().toString(36).substring(2, 11),
          pitchId: id,
          overlapPitchId: oid
        }))
      );
    }
    return { success: true, id };
  },
  zod$({
    name: z.string().min(1),
    type: z.enum(["F5", "F6", "F9"]),
    isCovered: z.string().optional(),
    isLit: z.string().optional(),
    pricePerHour: z.coerce.number().min(0),
    depositType: z.string().optional(),
    depositAmount: z.coerce.number().optional(),
    notes: z.string().optional(),
    imageUrl: z.string().optional(),
    image: z.any().optional(),
    sport: z.string().optional().default("Fútbol"),
    surface: z.string().optional().default("Sintético"),
    overlaps: z.string().optional(),
  })
);

export default component$(() => {
  const allPitches = useAllPitches().value;
  const createAction = useCreatePitchAction();
  const nav = useNavigate();
  const isCompressing = useSignal(false);
  
  const formState = useSignal({
    name: "",
    type: "F5",
    sport: "Fútbol",
    surface: "Sintético",
    pricePerHour: 0,
    depositType: "PERCENTAGE",
    depositAmount: 50,
    isCovered: false,
    isLit: true,
    notes: "",
    imageUrl: null as string | null,
    previewUrl: null as string | null,
    overlaps: [] as string[]
  });

  const handleFileChange = $(async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      try {
        isCompressing.value = true;
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          fileType: 'image/webp' as string,
        };
        const compressedFile = await imageCompression(file, options);
        formState.value = { ...formState.value, previewUrl: URL.createObjectURL(compressedFile) };
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([compressedFile], compressedFile.name, { type: 'image/webp' }));
        input.files = dataTransfer.files;
      } catch (error) {
        console.error('Error compressing image:', error);
      } finally {
        isCompressing.value = false;
      }
    }
  });

  useTask$(({ track }) => {
    track(() => createAction.value);
    if (createAction.value?.success) {
      nav(`/admin/pitches/${createAction.value.id}`);
    }
  });

  return (
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <Button look="ghost" onClick$={() => nav('/admin/pitches')} class="p-2 border border-slate-200">
            <LuArrowLeft class="w-5 h-5" />
          </Button>
          <div>
            <h1 class="text-3xl font-black text-slate-800 tracking-tighter">Nueva Cancha</h1>
            <p class="text-slate-500 font-medium mt-1">Configura los detalles básicos de la cancha.</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-[2rem] border shadow-sm p-8">
        <Form action={createAction} class="space-y-8">
          {/* Top row: image + nombre/tipo/atributos */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Upload */}
            <div>
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Foto de la Cancha</label>
              <div class="h-64 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group transition-colors hover:bg-slate-100 hover:border-slate-400">
                {formState.value.previewUrl ? (
                  <>
                    <img src={formState.value.previewUrl} alt="Foto cancha" class="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick$={() => formState.value = { ...formState.value, previewUrl: null }}
                      class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white backdrop-blur-sm transition-all"
                      title="Eliminar foto"
                    >
                      <LuTrash2 class="w-10 h-10" />
                    </button>
                  </>
                ) : (
                  <div class="text-slate-400 flex flex-col items-center">
                    <div class="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                      <LuImage class="w-8 h-8 text-slate-400" />
                    </div>
                    <span class="text-sm font-black uppercase tracking-widest text-slate-500">Subir Imagen</span>
                    <span class="text-xs text-slate-400 mt-1 font-medium">Click o arrastrar foto</span>
                  </div>
                )}
                {isCompressing.value && (
                  <div class="absolute inset-0 bg-white/80 flex flex-col items-center justify-center backdrop-blur-sm">
                    <div class="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
                    <span class="text-xs font-bold mt-3 text-slate-600 uppercase tracking-widest">Optimizando...</span>
                  </div>
                )}
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  onChange$={handleFileChange}
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isCompressing.value}
                />
              </div>
            </div>

            {/* Nombre + Tipo + Atributos */}
            <div class="flex flex-col gap-5">
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nombre de la cancha</label>
                <input
                  type="text"
                  name="name"
                  value={formState.value.name}
                  onChange$={(e) => formState.value = { ...formState.value, name: (e.target as HTMLInputElement).value }}
                  required
                  placeholder="Ej: Cancha 1 (Sintético)"
                  class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold text-slate-800 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tipo de Cancha</label>
                <select
                  name="type"
                  value={formState.value.type}
                  onChange$={(e) => formState.value = { ...formState.value, type: (e.target as HTMLSelectElement).value }}
                  class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold text-slate-800 appearance-none"
                >
                  <option value="F5">Fútbol 5</option>
                  <option value="F6">Fútbol 6</option>
                  <option value="F9">Fútbol 9</option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Deporte</label>
                  <input
                    type="text"
                    name="sport"
                    value={formState.value.sport}
                    onChange$={(e) => formState.value = { ...formState.value, sport: (e.target as HTMLInputElement).value }}
                    placeholder="Ej: Fútbol"
                    class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Superficie</label>
                  <input
                    type="text"
                    name="surface"
                    value={formState.value.surface}
                    onChange$={(e) => formState.value = { ...formState.value, surface: (e.target as HTMLInputElement).value }}
                    placeholder="Ej: Sintético"
                    class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold text-slate-800"
                  />
                </div>
              </div>
              <div class="flex gap-4 pt-2">
                <label class="flex-1 flex items-center gap-3 cursor-pointer bg-slate-50 px-4 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors">
                  <input type="checkbox" name="isCovered" checked={formState.value.isCovered} onChange$={(e) => formState.value = { ...formState.value, isCovered: (e.target as HTMLInputElement).checked }} class="w-5 h-5 rounded accent-slate-800 cursor-pointer" />
                  <span class="text-sm font-black text-slate-700 uppercase tracking-widest">Cubierta</span>
                </label>
                <label class="flex-1 flex items-center gap-3 cursor-pointer bg-amber-50 px-4 py-3.5 rounded-2xl border border-amber-200 hover:bg-amber-100 transition-colors">
                  <input type="checkbox" name="isLit" checked={formState.value.isLit} onChange$={(e) => formState.value = { ...formState.value, isLit: (e.target as HTMLInputElement).checked }} class="w-5 h-5 rounded accent-amber-500 cursor-pointer" />
                  <span class="text-sm font-black text-amber-800 uppercase tracking-widest">Iluminada</span>
                </label>
              </div>
            </div>
          </div>

          <hr class="border-slate-100" />

          {/* Finanzas Base Group */}
          <div class="bg-slate-50 rounded-3xl p-8 border border-slate-200 space-y-5">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-2 h-8 bg-emerald-500 rounded-full"></div>
              <div>
                <h3 class="text-lg font-black text-slate-800 uppercase tracking-widest">Finanzas Base</h3>
                <p class="text-xs text-slate-500 font-medium">Configura el precio base y la política de señas.</p>
              </div>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Precio x Hora ($)</label>
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">$</span>
                  <input
                    type="number"
                    name="pricePerHour"
                    value={formState.value.pricePerHour || ''}
                    onChange$={(e) => formState.value = { ...formState.value, pricePerHour: Number((e.target as HTMLInputElement).value) }}
                    required
                    min="0"
                    step="1"
                    class="w-full pl-10 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-lg text-slate-800"
                  />
                </div>
              </div>

              <div class="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm">
                <label class="block text-xs font-black text-emerald-700 uppercase tracking-widest mb-3">Seña requerida</label>
                <div class="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick$={() => formState.value = { ...formState.value, depositType: "PERCENTAGE" }}
                    class={cn(
                      "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border",
                      formState.value.depositType === "PERCENTAGE" ? "bg-emerald-600 text-white border-emerald-700 shadow-inner" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    )}
                  >% %</button>
                  <button
                    type="button"
                    onClick$={() => formState.value = { ...formState.value, depositType: "FIXED" }}
                    class={cn(
                      "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border",
                      formState.value.depositType === "FIXED" ? "bg-emerald-600 text-white border-emerald-700 shadow-inner" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    )}
                  >$ Fijo</button>
                </div>
                <input type="hidden" name="depositType" value={formState.value.depositType} />
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-lg">
                    {formState.value.depositType === "PERCENTAGE" ? "%" : "$"}
                  </span>
                  <input
                    type="number"
                    name="depositAmount"
                    value={formState.value.depositAmount}
                    onChange$={(e) => formState.value = { ...formState.value, depositAmount: Number((e.target as HTMLInputElement).value) }}
                    min="0"
                    max={formState.value.depositType === "PERCENTAGE" ? 100 : undefined}
                    step={formState.value.depositType === "PERCENTAGE" ? 1 : 100}
                    placeholder={formState.value.depositType === "PERCENTAGE" ? "50" : "5000"}
                    class="w-full pl-10 pr-4 py-3 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-lg text-emerald-900"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr class="border-slate-100" />

          {/* Espacio Solapado (Overlapping Pitches) */}
          <div>
            <h3 class="text-sm font-black text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
              <LuSettings class="w-5 h-5 text-slate-400" /> Dependencias de Espacio
            </h3>
            <div class="bg-slate-50 rounded-3xl p-6 border border-slate-200">
              <p class="text-sm text-slate-500 mb-6 font-medium leading-relaxed">
                Selecciona qué canchas ocupan el mismo espacio físico. Si alguna de estas canchas tiene una reserva, esta cancha quedará inhabilitada (y viceversa).
              </p>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {allPitches.map(p => {
                  const isSelected = formState.value.overlaps.includes(p.id);
                  return (
                    <label 
                      key={p.id}
                      class={cn(
                        "flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer",
                        isSelected 
                          ? "bg-slate-800 border-slate-900 text-white shadow-md scale-[1.02]" 
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                      )}
                    >
                      <input 
                        type="checkbox" 
                        class="hidden"
                        checked={isSelected}
                        onChange$={() => {
                          const current = formState.value.overlaps;
                          const next = isSelected 
                            ? current.filter(id => id !== p.id)
                            : [...current, p.id];
                          formState.value = { ...formState.value, overlaps: next };
                        }}
                      />
                      <div class={cn(
                        "w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors",
                        isSelected ? "bg-white border-white" : "border-slate-300"
                      )}>
                        {isSelected && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="text-slate-800"><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                      <span class="text-sm font-black truncate">{p.name}</span>
                    </label>
                  );
                })}
              </div>
              
              {allPitches.length === 0 && (
                <div class="text-center py-6 text-slate-400 text-sm font-bold italic">
                  No hay otras canchas creadas para establecer dependencias.
                </div>
              )}
              
              {/* Hidden input to send overlaps as JSON string */}
              <input type="hidden" name="overlaps" value={JSON.stringify(formState.value.overlaps)} />
            </div>
          </div>

          <hr class="border-slate-100" />

          {/* Aclaraciones */}
          <div>
            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Aclaraciones / Notas</label>
            <textarea
              name="notes"
              value={formState.value.notes}
              onChange$={(e) => formState.value = { ...formState.value, notes: (e.target as HTMLTextAreaElement).value }}
              placeholder="Ej: Tiene vestuario propio, apta para lluvia..."
              rows={3}
              class="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-medium text-slate-800 resize-none"
            />
          </div>

          {/* Submit */}
          <div class="pt-6 flex justify-end gap-4 border-t border-slate-100 mt-8">
            <Button
              type="button"
              onClick$={() => nav('/admin/pitches')}
              look="outline"
              class="rounded-2xl py-4 px-8 font-bold border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              look="primary"
              disabled={createAction.isRunning || isCompressing.value}
              class="bg-slate-800 text-white hover:bg-slate-900 rounded-2xl py-4 px-12 font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              {(createAction.isRunning || isCompressing.value) ? (
                <>Creando...</>
              ) : (
                "Crear Cancha y Continuar"
              )}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
});
