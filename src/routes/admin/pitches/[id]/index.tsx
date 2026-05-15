import { component$, $, useSignal, useTask$, useStore } from "@builder.io/qwik";
import { routeAction$, routeLoader$, zod$, z, Form, useNavigate } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { pitches, pitchOverlaps, pitchPricingRules } from "~/db/schema";
import { put } from '@vercel/blob';
import imageCompression from 'browser-image-compression';
import { Button } from "~/components/ui";
import { LuImage, LuTrash2, LuSettings, LuArrowLeft, LuPlus } from '@qwikest/icons/lucide';
import { cn } from "@qwik-ui/utils";
import { eq, or } from "drizzle-orm";

export const usePitchData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const id = requestEvent.params.id;
  const pitch = await db.query.pitches.findFirst({
    where: eq(pitches.id, id),
    with: {
      pricingRules: true,
      overlaps: true,
    }
  });

  if (!pitch) {
    throw requestEvent.redirect(302, "/admin/pitches");
  }
  return pitch;
});

export const useAllPitches = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return db.query.pitches.findMany({
    orderBy: (pitches, { asc }) => [asc(pitches.name)],
    columns: { id: true, name: true }
  });
});

export const useUpdatePitchAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const id = data.id as string;

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

    await db.update(pitches)
      .set({
        name: data.name,
        type: data.type as "F5" | "F6" | "F9",
        isCovered: data.isCovered === "on",
        isLit: data.isLit === "on",
        pricePerHour: Number(data.pricePerHour),
        depositType: (data.depositType as "PERCENTAGE" | "FIXED") || "PERCENTAGE",
        depositAmount: Number(data.depositAmount) || 0,
        notes: data.notes || null,
        imageUrl: uploadedImageUrl,
        sport: data.sport || "Fútbol",
        surface: data.surface || "Sintético",
      })
      .where(eq(pitches.id, id));

    // Update overlaps
    const overlapIds = JSON.parse(data.overlaps || "[]") as string[];
    // Delete existing (bidirectional)
    await db.delete(pitchOverlaps).where(
      or(
        eq(pitchOverlaps.pitchId, id),
        eq(pitchOverlaps.overlapPitchId, id)
      )
    );
    // Insert new
    if (overlapIds.length > 0) {
      await db.insert(pitchOverlaps).values(
        overlapIds.map(oid => ({
          id: Math.random().toString(36).substring(2, 11),
          pitchId: id,
          overlapPitchId: oid
        }))
      );
    }

    // Update pricing rules
    const rules = JSON.parse(data.rulesJson as string) as any[];
    await db.delete(pitchPricingRules).where(eq(pitchPricingRules.pitchId, id));
    if (rules.length > 0) {
      const rulesToInsert = rules.map(rule => ({
        id: Math.random().toString(36).substring(2, 11),
        pitchId: id,
        dayOfWeek: Number(rule.dayOfWeek),
        startTime: rule.startTime,
        endTime: rule.endTime,
        price: Number(rule.price),
      }));
      await db.insert(pitchPricingRules).values(rulesToInsert);
    }

    return { success: true };
  },
  zod$({
    id: z.string(),
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
    rulesJson: z.string().optional(),
  })
);

export const TimeSelect = component$(({ value, onChange$ }: { value: string, onChange$: any }) => {
  return (
    <input
      type="text"
      value={value}
      onChange$={(e) => {
        let val = (e.target as HTMLInputElement).value.trim();
        if (val.length === 4 && !val.includes(':')) {
          val = val.slice(0, 2) + ':' + val.slice(2);
        }
        onChange$(val);
      }}
      placeholder="18:00"
      pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
      title="Formato 24hs (Ej: 18:00)"
      class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-center text-slate-700"
      maxLength={5}
    />
  );
});

export default component$(() => {
  const pitch = usePitchData().value;
  const allPitches = useAllPitches().value;
  const updateAction = useUpdatePitchAction();
  const nav = useNavigate();
  const isCompressing = useSignal(false);
  
  const formState = useStore({
    id: pitch.id,
    name: pitch.name,
    type: pitch.type,
    sport: pitch.sport || "Fútbol",
    surface: pitch.surface || "Sintético",
    pricePerHour: pitch.pricePerHour,
    depositType: pitch.depositType || "PERCENTAGE",
    depositAmount: pitch.depositAmount || 0,
    isCovered: pitch.isCovered,
    isLit: pitch.isLit,
    notes: pitch.notes || "",
    imageUrl: pitch.imageUrl,
    previewUrl: null as string | null,
    overlaps: pitch.overlaps.map(o => o.overlapPitchId),
    rules: pitch.pricingRules.map(r => ({ ...r, id: r.id }))
  }, { deep: true });

  const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Feriados"];

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
        formState.previewUrl = URL.createObjectURL(compressedFile);
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
    track(() => updateAction.value);
    if (updateAction.value?.success) {
      nav('/admin/pitches');
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
            <h1 class="text-3xl font-black text-slate-800 tracking-tighter">Editar Cancha</h1>
            <p class="text-slate-500 font-medium mt-1">Modifica configuración, precios y dependencias de {pitch.name}.</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-[2rem] border shadow-sm p-8 mb-8">
        <Form action={updateAction} class="space-y-8">
          <input type="hidden" name="id" value={formState.id} />
          <input type="hidden" name="imageUrl" value={formState.imageUrl || ""} />

          {/* Top row: image + nombre/tipo/atributos */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Upload */}
            <div>
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Foto de la Cancha</label>
              <div class="h-64 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group transition-colors hover:bg-slate-100 hover:border-slate-400">
                {(formState.previewUrl || formState.imageUrl) ? (
                  <>
                    <img src={formState.previewUrl || formState.imageUrl!} alt="Foto cancha" class="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick$={() => { formState.previewUrl = null; formState.imageUrl = null; }}
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
                  value={formState.name}
                  onChange$={(e) => formState.name = (e.target as HTMLInputElement).value}
                  required
                  placeholder="Ej: Cancha 1 (Sintético)"
                  class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold text-slate-800 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tipo de Cancha</label>
                <select
                  name="type"
                  value={formState.type}
                  onChange$={(e) => formState.type = (e.target as HTMLSelectElement).value as "F5" | "F6" | "F9"}
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
                    value={formState.sport}
                    onChange$={(e) => formState.sport = (e.target as HTMLInputElement).value}
                    placeholder="Ej: Fútbol"
                    class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Superficie</label>
                  <input
                    type="text"
                    name="surface"
                    value={formState.surface}
                    onChange$={(e) => formState.surface = (e.target as HTMLInputElement).value}
                    placeholder="Ej: Sintético"
                    class="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold text-slate-800"
                  />
                </div>
              </div>
              <div class="flex gap-4 pt-2">
                <label class="flex-1 flex items-center gap-3 cursor-pointer bg-slate-50 px-4 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors">
                  <input type="checkbox" name="isCovered" checked={formState.isCovered} onChange$={(e) => formState.isCovered = (e.target as HTMLInputElement).checked} class="w-5 h-5 rounded accent-slate-800 cursor-pointer" />
                  <span class="text-sm font-black text-slate-700 uppercase tracking-widest">Cubierta</span>
                </label>
                <label class="flex-1 flex items-center gap-3 cursor-pointer bg-amber-50 px-4 py-3.5 rounded-2xl border border-amber-200 hover:bg-amber-100 transition-colors">
                  <input type="checkbox" name="isLit" checked={formState.isLit} onChange$={(e) => formState.isLit = (e.target as HTMLInputElement).checked} class="w-5 h-5 rounded accent-amber-500 cursor-pointer" />
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
                    value={formState.pricePerHour || ''}
                    onChange$={(e) => formState.pricePerHour = Number((e.target as HTMLInputElement).value)}
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
                    onClick$={() => formState.depositType = "PERCENTAGE"}
                    class={cn(
                      "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border",
                      formState.depositType === "PERCENTAGE" ? "bg-emerald-600 text-white border-emerald-700 shadow-inner" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    )}
                  >% %</button>
                  <button
                    type="button"
                    onClick$={() => formState.depositType = "FIXED"}
                    class={cn(
                      "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border",
                      formState.depositType === "FIXED" ? "bg-emerald-600 text-white border-emerald-700 shadow-inner" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    )}
                  >$ Fijo</button>
                </div>
                <input type="hidden" name="depositType" value={formState.depositType} />
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-lg">
                    {formState.depositType === "PERCENTAGE" ? "%" : "$"}
                  </span>
                  <input
                    type="number"
                    name="depositAmount"
                    value={formState.depositAmount}
                    onChange$={(e) => formState.depositAmount = Number((e.target as HTMLInputElement).value)}
                    min="0"
                    max={formState.depositType === "PERCENTAGE" ? 100 : undefined}
                    step={formState.depositType === "PERCENTAGE" ? 1 : 100}
                    placeholder={formState.depositType === "PERCENTAGE" ? "50" : "5000"}
                    class="w-full pl-10 pr-4 py-3 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-lg text-emerald-900"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr class="border-slate-100" />

          {/* Precios Dinámicos (Directly embedded) */}
          <div class="bg-indigo-50/50 rounded-3xl p-8 border border-indigo-100 space-y-5">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-2 h-8 bg-indigo-500 rounded-full"></div>
              <div>
                <h3 class="text-lg font-black text-indigo-900 uppercase tracking-widest">Precios Dinámicos</h3>
                <p class="text-xs text-indigo-600 font-medium">Configura franjas horarias con precios especiales.</p>
              </div>
            </div>

            <div class="space-y-4">
              {formState.rules.map((rule, idx) => (
                <div key={rule.id} class="flex items-center gap-4 bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                  <div class="flex-1">
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Día</label>
                    <select
                      value={rule.dayOfWeek}
                      onChange$={(e) => formState.rules[idx].dayOfWeek = Number((e.target as HTMLSelectElement).value)}
                      class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700"
                    >
                      {daysOfWeek.map((day, i) => (
                        <option key={i} value={i}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div class="w-28 shrink-0">
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Inicio</label>
                    <TimeSelect 
                      value={rule.startTime} 
                      onChange$={$((val: string) => { formState.rules[idx].startTime = val; })} 
                    />
                  </div>
                  <div class="w-28 shrink-0">
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fin</label>
                    <TimeSelect 
                      value={rule.endTime} 
                      onChange$={$((val: string) => { formState.rules[idx].endTime = val; })} 
                    />
                  </div>
                  <div class="w-32 shrink-0">
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Precio ($)</label>
                    <input
                      type="number"
                      value={rule.price}
                      onChange$={(e) => formState.rules[idx].price = Number((e.target as HTMLInputElement).value)}
                      required
                      min="0"
                      step="1"
                      class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-indigo-700"
                    />
                  </div>
                  <div class="pt-5">
                    <button
                      type="button"
                      onClick$={() => formState.rules = formState.rules.filter(r => r.id !== rule.id)}
                      class="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title="Eliminar franja"
                    >
                      <LuTrash2 class="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}

              {formState.rules.length === 0 && (
                <div class="text-center py-8 text-indigo-300 font-medium italic border-2 border-dashed border-indigo-200 rounded-2xl bg-white/50">
                  No hay franjas de precios dinámicos configuradas.
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick$={() => formState.rules.push({ id: Math.random().toString(), pitchId: formState.id, dayOfWeek: 1, startTime: "18:00", endTime: "19:00", price: formState.pricePerHour || 0 })}
              look="outline"
              class="w-full border-dashed border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 rounded-2xl py-3 font-bold flex justify-center items-center gap-2"
            >
              <LuPlus class="w-5 h-5" />
              Añadir Franja Horaria
            </Button>
            
            <input type="hidden" name="rulesJson" value={JSON.stringify(formState.rules)} />
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
                {allPitches.filter(p => p.id !== formState.id).map(p => {
                  const isSelected = formState.overlaps.includes(p.id);
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
                          const current = formState.overlaps;
                          const next = isSelected 
                            ? current.filter(id => id !== p.id)
                            : [...current, p.id];
                          formState.overlaps = next;
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
              
              {allPitches.length <= 1 && (
                <div class="text-center py-6 text-slate-400 text-sm font-bold italic">
                  No hay otras canchas creadas para establecer dependencias.
                </div>
              )}
              
              {/* Hidden input to send overlaps as JSON string */}
              <input type="hidden" name="overlaps" value={JSON.stringify(formState.overlaps)} />
            </div>
          </div>

          <hr class="border-slate-100" />

          {/* Aclaraciones */}
          <div>
            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Aclaraciones / Notas</label>
            <textarea
              name="notes"
              value={formState.notes}
              onChange$={(e) => formState.notes = (e.target as HTMLTextAreaElement).value}
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
              disabled={updateAction.isRunning || isCompressing.value}
              class="bg-slate-800 text-white hover:bg-slate-900 rounded-2xl py-4 px-12 font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              {(updateAction.isRunning || isCompressing.value) ? (
                <>Guardando...</>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
});
