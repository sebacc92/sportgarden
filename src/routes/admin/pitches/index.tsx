import { component$, $, useStore, useSignal, useTask$ } from "@builder.io/qwik";
import { Form, routeAction$, routeLoader$, zod$, z } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { pitches, pitchPricingRules } from "~/db/schema";
import { Button, Modal } from "~/components/ui";
import { LuImage, LuPlus, LuSettings, LuTrash2 } from '@qwikest/icons/lucide';
import { put } from '@vercel/blob';
import imageCompression from 'browser-image-compression';

// 1. Data Loader
export const usePitchesData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return db.query.pitches.findMany({
    orderBy: (pitches, { asc }) => [asc(pitches.name)],
    with: { pricingRules: true },
  });
});

// 2. Actions
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
      type: data.type as "F5" | "F7" | "F9" | "F11",
      isCovered: data.isCovered === "on",
      isLit: data.isLit === "on",
      pricePerHour: Number(data.pricePerHour),
      depositType: (data.depositType as "PERCENTAGE" | "FIXED") || "PERCENTAGE",
      depositAmount: Number(data.depositAmount) || 0,
      notes: data.notes || null,
      isActive: true,
      imageUrl: uploadedImageUrl,
    });
    return { success: true };
  },
  zod$({
    name: z.string().min(1),
    type: z.enum(["F5", "F7", "F9", "F11"]),
    isCovered: z.string().optional(),
    isLit: z.string().optional(),
    pricePerHour: z.coerce.number().min(0),
    depositType: z.string().optional(),
    depositAmount: z.coerce.number().optional(),
    notes: z.string().optional(),
    imageUrl: z.string().optional(),
    image: z.any().optional(),
  })
);

export const useUpdatePitchAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    let uploadedImageUrl = data.imageUrl || null;

    if (data.image && typeof data.image === 'object' && (data.image as Blob).size > 0) {
      const file = data.image as File;
      const fileName = `pitch-${data.id}-${Date.now()}.webp`;
      const { url } = await put(fileName, file, {
        access: 'public',
        token: requestEvent.env.get('BLOB_READ_WRITE_TOKEN'),
      });
      uploadedImageUrl = url;
    }

    await db.update(pitches)
      .set({
        name: data.name,
        type: data.type as "F5" | "F7" | "F9" | "F11",
        isCovered: data.isCovered === "on",
        isLit: data.isLit === "on",
        pricePerHour: Number(data.pricePerHour),
        depositType: (data.depositType as "PERCENTAGE" | "FIXED") || "PERCENTAGE",
        depositAmount: Number(data.depositAmount) || 0,
        notes: data.notes || null,
        imageUrl: uploadedImageUrl,
      })
      .where(eq(pitches.id, data.id));

    return { success: true };
  },
  zod$({
    id: z.string(),
    name: z.string().min(1),
    type: z.enum(["F5", "F7", "F9", "F11"]),
    isCovered: z.string().optional(),
    isLit: z.string().optional(),
    pricePerHour: z.coerce.number().min(0),
    depositType: z.string().optional(),
    depositAmount: z.coerce.number().optional(),
    notes: z.string().optional(),
    imageUrl: z.string().optional(),
    image: z.any().optional(),
  })
);

export const useTogglePitchStatusAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const pitch = await db.query.pitches.findFirst({
      where: eq(pitches.id, data.id)
    });

    if (pitch) {
      await db.update(pitches)
        .set({ isActive: !pitch.isActive })
        .where(eq(pitches.id, data.id));
    }

    return { success: true };
  },
  zod$({
    id: z.string()
  })
);

export const useDeletePitchAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    try {
      await db.delete(pitches).where(eq(pitches.id, data.id));
      return { success: true };
    } catch {
      return {
        success: false,
        message: "No se puede borrar la cancha porque tiene reservas asociadas. Prueba deshabilitándola."
      };
    }
  },
  zod$({
    id: z.string()
  })
);

export const useSavePricingRulesAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const rules = JSON.parse(data.rulesJson as string) as any[];

    // Delete existing rules for this pitch
    await db.delete(pitchPricingRules).where(eq(pitchPricingRules.pitchId, data.pitchId));

    // Insert new rules
    if (rules.length > 0) {
      const rulesToInsert = rules.map(rule => ({
        id: Math.random().toString(36).substring(2, 11),
        pitchId: data.pitchId,
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
    pitchId: z.string(),
    rulesJson: z.string(), // We send it as a JSON string to simplify Qwik Forms nested arrays
  })
);

// Loading Spinner Component
export const LoadingSpinner = component$(({ class: className }: { class?: string }) => (
  <svg class={["animate-spin", className]} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
));

// 3. UI Component
export default component$(() => {
  const pitchesData = usePitchesData();
  const createPitchAction = useCreatePitchAction();
  const updatePitchAction = useUpdatePitchAction();
  const toggleStatusAction = useTogglePitchStatusAction();
  const deleteAction = useDeletePitchAction();

  const isFormModalOpen = useSignal(false);
  const isSelectionModalOpen = useSignal(false);
  const isDeleteConfirmModalOpen = useSignal(false);
  const pitchToDelete = useSignal<{ id: string; name: string } | null>(null);

  const isPricingModalOpen = useSignal(false);
  const selectedPitchForPricing = useSignal<{ id: string; name: string; rules: any[] } | null>(null);

  // State to handle edit mode
  const editingPitch = useStore<{ id: string | null; name: string; type: string; pricePerHour: number; depositType: string; depositAmount: number; isCovered: boolean; isLit: boolean; notes: string; imageUrl: string | null }>({
    id: null,
    name: "",
    type: "F5",
    pricePerHour: 0,
    depositType: "PERCENTAGE",
    depositAmount: 0,
    isCovered: false,
    isLit: false,
    notes: "",
    imageUrl: null,
  });

  const isCompressing = useSignal(false);
  const previewUrl = useSignal<string | null>(null);

  const handleFileChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];
    previewUrl.value = URL.createObjectURL(file);
    editingPitch.imageUrl = null; // Clear existing if new one is selected
  });

  const handleSubmit = $(async (e: Event, currentTarget: HTMLFormElement) => {
    if (isCompressing.value || createPitchAction.isRunning || updatePitchAction.isRunning) return;

    isCompressing.value = true;
    try {
      const formData = new FormData(currentTarget);
      const imageFile = formData.get('image') as File | null;

      if (imageFile && imageFile.size > 0 && imageFile.name) {
        const options = {
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          fileType: 'image/webp',
          initialQuality: 0.8,
        };
        const compressedBlob = await imageCompression(imageFile, options);
        const newFileName = imageFile.name.replace(/\.[^/.]+$/, "") + ".webp";
        const compressedFile = new File([compressedBlob], newFileName, { type: 'image/webp' });
        
        formData.set('image', compressedFile);
      }

      if (editingPitch.id) {
        await updatePitchAction.submit(formData);
      } else {
        await createPitchAction.submit(formData);
      }
    } catch (error) {
      console.error('Error al comprimir/subir imagen:', error);
    } finally {
      isCompressing.value = false;
    }
  });

  useTask$(({ track }) => {
    const createSuccess = track(() => createPitchAction.value?.success);
    const updateSuccess = track(() => updatePitchAction.value?.success);
    if (createSuccess || updateSuccess) {
      isFormModalOpen.value = false;
      resetForm();
    }
  });

  const resetForm = $(() => {
    editingPitch.id = null;
    editingPitch.name = "";
    editingPitch.type = "F5";
    editingPitch.pricePerHour = 0;
    editingPitch.depositType = "PERCENTAGE";
    editingPitch.depositAmount = 0;
    editingPitch.isCovered = false;
    editingPitch.isLit = false;
    editingPitch.notes = "";
    editingPitch.imageUrl = null;
    previewUrl.value = null;
  });

  const openCreateModal = $(() => {
    resetForm();
    isFormModalOpen.value = true;
  });

  const openEditModal = $((pitch: any) => {
    editingPitch.id = pitch.id;
    editingPitch.name = pitch.name;
    editingPitch.type = pitch.type;
    editingPitch.pricePerHour = pitch.pricePerHour;
    editingPitch.depositType = pitch.depositType || "PERCENTAGE";
    editingPitch.depositAmount = pitch.depositAmount || 0;
    editingPitch.isCovered = pitch.isCovered;
    editingPitch.isLit = pitch.isLit || false;
    editingPitch.notes = pitch.notes || "";
    editingPitch.imageUrl = pitch.imageUrl;
    // Also load pricing rules for this pitch
    selectedPitchForPricing.value = {
      id: pitch.id,
      name: pitch.name,
      rules: pitch.pricingRules || []
    };
    isFormModalOpen.value = true;
  });

  const selectForDeletion = $((pitch: any) => {
    pitchToDelete.value = { id: pitch.id, name: pitch.name };
    isSelectionModalOpen.value = false;
    isDeleteConfirmModalOpen.value = true;
  });

  return (
    <div class="min-h-full bg-slate-50 text-slate-900 font-sans p-6 overflow-auto">
      {/* Navigation Header */}
      <header class="mb-8 pb-4 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-bold text-slate-800 tracking-tight">Configuración de Canchas</h1>
          <p class="text-slate-500">Administra los precios, tipos y estados de las canchas.</p>
        </div>
        <div class="flex gap-3">
          <Button
            onClick$={() => isSelectionModalOpen.value = true}
            look="outline"
            class="border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 px-6 py-2 rounded-xl font-bold shadow-sm"
          >
            Borrar Cancha
          </Button>
          <Button
            onClick$={openCreateModal}
            look="primary"
            class="bg-slate-800 text-white hover:bg-slate-900 px-6 py-2 rounded-xl font-bold shadow-sm transition-all hover:shadow-md"
          >
            Nueva Cancha
          </Button>
        </div>
      </header>

      <div class="space-y-6">
        <h2 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span class="w-1 h-6 bg-slate-800 rounded-full"></span>
          Listado de Canchas
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pitchesData.value.map((pitch, index) => {
            const isToggling = toggleStatusAction.isRunning && toggleStatusAction.formData?.get("id") === pitch.id;

            return (
              <div
                key={pitch.id}
                class={["group p-6 rounded-3xl border shadow-sm transition-all relative overflow-hidden", pitch.isActive ? "bg-white border-slate-200" : "bg-slate-100 border-slate-300 opacity-80"]}
              >
                {/* Decorative Number Badge or Image Background */}
                <div class="absolute inset-0 z-0">
                  {pitch.imageUrl ? (
                    <div class="w-full h-full relative">
                      <img src={pitch.imageUrl} alt={pitch.name} class="w-full h-full object-cover" />
                      <div class="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>
                    </div>
                  ) : (
                    <div class="absolute top-0 right-0 w-16 h-16 bg-slate-50 flex items-center justify-center rounded-bl-3xl transition-colors group-hover:bg-slate-100">
                      <span class="text-4xl font-black text-slate-200 group-hover:text-slate-300 transition-colors leading-none">{index + 1}</span>
                    </div>
                  )}
                </div>

                <div class="relative z-10">
                  <div class="flex justify-between items-start mb-4">
                    <div>
                      <h3 class={["font-black text-xl mb-1 leading-tight", pitch.imageUrl ? "text-white" : "text-slate-800"]}>
                        {pitch.name}
                      </h3>
                      <div class="flex flex-wrap gap-1.5">
                        <span class="bg-slate-800 text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">{pitch.type}</span>
                        {pitch.isCovered && (
                          <span class="text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-widest border border-blue-100">Cubierta</span>
                        )}
                        {(pitch as any).isLit && (
                          <span class="text-amber-600 font-black bg-amber-50 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-widest border border-amber-100">Iluminada</span>
                        )}
                        {!pitch.isActive && (
                          <span class="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] uppercase font-black rounded-lg tracking-widest border border-red-200">Inactiva</span>
                        )}
                        {(pitch as any).pricingRules?.length > 0 && (
                          <span class="text-violet-600 font-black bg-violet-50 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-widest border border-violet-100">{(pitch as any).pricingRules.length} regla{(pitch as any).pricingRules.length > 1 ? 's' : ''}</span>
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
                          {(pitch as any).depositType === "FIXED"
                            ? <>$<span>{(pitch as any).depositAmount}</span></>
                            : <><span>{(pitch as any).depositAmount ?? 0}</span>%</>
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {(pitch as any).notes && (
                    <div class="text-xs text-slate-400 font-medium italic mb-4 leading-relaxed line-clamp-2">
                      {(pitch as any).notes}
                    </div>
                  )}

                  <div class="flex gap-3">
                    <Button
                      onClick$={() => openEditModal(pitch)}
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
          })}


          {pitchesData.value.length === 0 && (
            <div class="col-span-full p-16 text-center bg-white border-2 border-dashed border-slate-200 rounded-[2rem]">
              <div class="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-7l-2-2"></path><path d="M12 22v-7l2-2"></path><path d="M22 10a9 9 0 0 0-18 0c0 4 3 6 8 11.5 5-5.5 8-7.5 8-11.5z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </div>
              <p class="text-slate-500 font-bold text-lg mb-6">Aún no hay canchas configuradas.</p>
              <Button onClick$={openCreateModal} look="primary" class="bg-slate-800 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-wider">Crear mi primera cancha</Button>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      <Modal.Root bind:show={isFormModalOpen}>
        <Modal.Panel class="bg-white rounded-[2rem] border shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] p-0 overflow-hidden">
          {/* Fixed header */}
          <div class="px-8 pt-8 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <Modal.Title class="text-3xl font-black text-slate-800 tracking-tighter">
              {editingPitch.id ? "Editar Cancha" : "Nueva Cancha"}
            </Modal.Title>
            <button
              type="button"
              onClick$={() => { isFormModalOpen.value = false; resetForm(); }}
              class="text-slate-400 hover:text-slate-700 transition-colors p-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div class="overflow-y-auto flex-1 px-8 py-6">
            <Form
              action={editingPitch.id ? updatePitchAction : createPitchAction}
              class="space-y-6"
              preventdefault:submit
              onSubmit$={handleSubmit}
            >
              {editingPitch.id && <input type="hidden" name="id" value={editingPitch.id} />}
              <input type="hidden" name="imageUrl" value={editingPitch.imageUrl || ""} />

              {/* Top row: image + nombre/tipo/atributos */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Image Upload */}
                <div>
                  <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Foto de la Cancha</label>
                  <div class="h-44 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
                    {(previewUrl.value || editingPitch.imageUrl) ? (
                      <>
                        <img src={previewUrl.value || editingPitch.imageUrl!} alt="Foto cancha" class="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick$={() => {
                            editingPitch.imageUrl = null;
                            previewUrl.value = null;
                          }}
                          class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white"
                          title="Eliminar foto"
                        >
                          <LuTrash2 class="w-8 h-8" />
                        </button>
                      </>
                    ) : (
                      <div class="text-slate-400 flex flex-col items-center">
                        <LuImage class="w-8 h-8 mb-2" />
                        <span class="text-xs font-bold uppercase tracking-widest">Subir Imagen</span>
                      </div>
                    )}
                    {isCompressing.value && (
                      <div class="absolute inset-0 bg-white/80 flex flex-col items-center justify-center">
                        <div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
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
                <div class="flex flex-col gap-4">
                  <div>
                    <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nombre de la cancha</label>
                    <input
                      type="text"
                      name="name"
                      value={editingPitch.name}
                      required
                      placeholder="Ej: Cancha 1 (Sintético)"
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tipo</label>
                    <select
                      name="type"
                      value={editingPitch.type}
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold appearance-none"
                    >
                      <option value="F5">F5 (5 vs 5)</option>
                      <option value="F7">F7 (7 vs 7)</option>
                      <option value="F9">F9 (9 vs 9)</option>
                      <option value="F11">F11 (11 vs 11)</option>
                    </select>
                  </div>
                  <div class="flex gap-3">
                    <label class="flex-1 flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-3 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors">
                      <input type="checkbox" name="isCovered" checked={editingPitch.isCovered} class="w-4 h-4 rounded accent-slate-800 cursor-pointer" />
                      <span class="text-xs font-black text-slate-600 uppercase tracking-widest">Cubierta</span>
                    </label>
                    <label class="flex-1 flex items-center gap-2 cursor-pointer bg-amber-50 px-3 py-3 rounded-2xl border border-amber-200 hover:bg-amber-100 transition-colors">
                      <input type="checkbox" name="isLit" checked={editingPitch.isLit} class="w-4 h-4 rounded accent-amber-500 cursor-pointer" />
                      <span class="text-xs font-black text-amber-700 uppercase tracking-widest">Iluminada</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Precios: hora + seña en fila */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Precio por hora */}
                <div>
                  <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Precio x Hora ($)</label>
                  <input
                    type="number"
                    name="pricePerHour"
                    value={editingPitch.pricePerHour}
                    required
                    min="0"
                    step="1"
                    class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold"
                  />
                </div>

                {/* Seña */}
                <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <label class="block text-xs font-black text-emerald-700 uppercase tracking-widest mb-2">Seña requerida</label>
                  <div class="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick$={() => editingPitch.depositType = "PERCENTAGE"}
                      class={["flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", editingPitch.depositType === "PERCENTAGE" ? "bg-emerald-600 text-white" : "bg-white text-slate-500 border border-slate-200"]}
                    >% %</button>
                    <button
                      type="button"
                      onClick$={() => editingPitch.depositType = "FIXED"}
                      class={["flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", editingPitch.depositType === "FIXED" ? "bg-emerald-600 text-white" : "bg-white text-slate-500 border border-slate-200"]}
                    >$ Fijo</button>
                  </div>
                  <input type="hidden" name="depositType" value={editingPitch.depositType} />
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-sm">
                      {editingPitch.depositType === "PERCENTAGE" ? "%" : "$"}
                    </span>
                    <input
                      type="number"
                      name="depositAmount"
                      value={editingPitch.depositAmount}
                      min="0"
                      max={editingPitch.depositType === "PERCENTAGE" ? 100 : undefined}
                      step={editingPitch.depositType === "PERCENTAGE" ? 1 : 100}
                      placeholder={editingPitch.depositType === "PERCENTAGE" ? "50" : "5000"}
                      class="w-full pl-8 pr-3 py-2.5 bg-white border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-emerald-900"
                    />
                  </div>
                </div>
              </div>

              {/* Precios Dinámicos (solo en edición) */}
              {editingPitch.id && selectedPitchForPricing.value && (
                <div class="border-t border-slate-100 pt-4 flex items-center justify-between">
                  <div>
                    <div class="text-xs font-black text-slate-400 uppercase tracking-widest">Precios Dinámicos</div>
                    <div class="text-xs text-slate-400 font-medium mt-0.5">Franjas horarias con precio especial</div>
                  </div>
                  <button
                    type="button"
                    onClick$={() => isPricingModalOpen.value = true}
                    class="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    <LuSettings class="w-3.5 h-3.5" />
                    {selectedPitchForPricing.value.rules.length > 0 ? `${selectedPitchForPricing.value.rules.length} regla${selectedPitchForPricing.value.rules.length > 1 ? 's' : ''}` : "Configurar"}
                  </button>
                </div>
              )}

              {/* Aclaraciones */}
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Aclaraciones</label>
                <textarea
                  name="notes"
                  value={editingPitch.notes}
                  placeholder="Ej: Tiene vestuario propio, apta para lluvia..."
                  rows={2}
                  class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-medium resize-none"
                />
              </div>

              {/* Botones */}
              <div class="pt-4 flex gap-3 sticky bottom-0 bg-white border-t border-slate-50 mt-4 -mx-2 px-2 z-20">
                <Button
                  type="button"
                  onClick$={() => { isFormModalOpen.value = false; resetForm(); }}
                  look="outline"
                  class="flex-1 rounded-2xl py-4 font-bold border-slate-200"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  look="primary"
                  disabled={createPitchAction.isRunning || updatePitchAction.isRunning || isCompressing.value}
                  class="flex-1 bg-slate-800 text-white hover:bg-slate-900 rounded-2xl py-4 font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {(createPitchAction.isRunning || updatePitchAction.isRunning || isCompressing.value) ? (
                    <LoadingSpinner class="w-5 h-5" />
                  ) : (
                    editingPitch.id ? "Guardar" : "Crear"
                  )}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>
      <Modal.Root bind:show={isSelectionModalOpen}>
        <Modal.Panel class="bg-white p-8 rounded-[2rem] border shadow-2xl max-w-md">
          <Modal.Title class="text-2xl font-black text-slate-800 mb-6 tracking-tight">Seleccionar cancha a borrar</Modal.Title>
          <div class="space-y-2 max-h-[60vh] overflow-auto pr-2">
            {pitchesData.value.map((pitch) => (
              <button
                key={pitch.id}
                onClick$={() => selectForDeletion(pitch)}
                class="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-red-200 hover:bg-red-50 transition-all text-left group"
              >
                <div>
                  <div class="font-bold text-slate-800 group-hover:text-red-700">{pitch.name}</div>
                  <div class="text-xs text-slate-400 uppercase font-black tracking-widest">{pitch.type}</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 group-hover:text-red-500"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path></svg>
              </button>
            ))}
            {pitchesData.value.length === 0 && (
              <div class="text-center py-8 text-slate-400 font-medium italic">No hay canchas para borrar.</div>
            )}
          </div>
          <div class="mt-8">
            <Button
              onClick$={() => isSelectionModalOpen.value = false}
              look="outline"
              class="w-full rounded-2xl border-slate-200 font-bold"
            >
              Cerrar
            </Button>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Delete Confirmation Modal */}
      <Modal.Root bind:show={isDeleteConfirmModalOpen}>
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
              onClick$={() => isDeleteConfirmModalOpen.value = false}
              look="outline"
              class="flex-1 rounded-2xl font-bold border-slate-200"
            >
              Cancelar
            </Button>
            <Form
              action={deleteAction}
              onSubmitCompleted$={() => isDeleteConfirmModalOpen.value = false}
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

      {/* Pricing Rules Modal */}
      <PitchPricingModal
        showSignal={isPricingModalOpen}
        pitchId={selectedPitchForPricing.value?.id || ""}
        pitchName={selectedPitchForPricing.value?.name || ""}
        initialRules={selectedPitchForPricing.value?.rules || []}
      />

    </div>
  );
});

import type { Signal } from "@builder.io/qwik";

// 4. Pricing Modal Component
export const PitchPricingModal = component$((props: {
  showSignal: Signal<boolean>,
  pitchId: string,
  pitchName: string,
  initialRules: any[]
}) => {
  const saveAction = useSavePricingRulesAction();
  const rules = useStore<{ rules: any[] }>({
    rules: []
  });

  useTask$(({ track }) => {
    track(() => props.initialRules);
    rules.rules = props.initialRules.map(r => ({
      ...r,
      id: r.id || Math.random().toString(36).substring(2, 9)
    }));
  });

  const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const addRule = $(() => {
    rules.rules = [...rules.rules, {
      id: Math.random().toString(36).substring(2, 9),
      dayOfWeek: 1, // Default Lunes
      startTime: "18:00",
      endTime: "19:00",
      price: 0,
    }];
  });

  const removeRule = $((id: string) => {
    rules.rules = rules.rules.filter(r => r.id !== id);
  });

  const updateRule = $((id: string, field: string, value: any) => {
    rules.rules = rules.rules.map(r => r.id === id ? { ...r, [field]: value } : r);
  });

  return (
    <Modal.Root bind:show={props.showSignal}>
      <Modal.Panel class="bg-white p-8 rounded-[2rem] border shadow-2xl max-w-3xl w-full">
        <Modal.Title class="text-3xl font-black text-slate-800 mb-2 tracking-tighter">
          Precios Dinámicos
        </Modal.Title>
        <p class="text-slate-500 mb-8 font-medium">
          Configura franjas horarias para <span class="font-black text-slate-800">{props.pitchName}</span>.
        </p>

        <Form
          action={saveAction}
          class="space-y-6"
          onSubmitCompleted$={() => {
            props.showSignal.value = false;
          }}
        >
          <input type="hidden" name="pitchId" value={props.pitchId} />
          <input type="hidden" name="rulesJson" value={JSON.stringify(rules.rules)} />

          <div class="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
            {rules.rules.map((rule) => (
              <div key={rule.id} class="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div class="flex-1">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Día</label>
                  <select
                    value={rule.dayOfWeek}
                    onChange$={(e) => updateRule(rule.id, 'dayOfWeek', Number((e.target as HTMLSelectElement).value))}
                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                  >
                    {daysOfWeek.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
                <div class="w-24">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inicio</label>
                  <input
                    type="time"
                    value={rule.startTime}
                    onChange$={(e) => updateRule(rule.id, 'startTime', (e.target as HTMLInputElement).value)}
                    required
                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                  />
                </div>
                <div class="w-24">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fin</label>
                  <input
                    type="time"
                    value={rule.endTime}
                    onChange$={(e) => updateRule(rule.id, 'endTime', (e.target as HTMLInputElement).value)}
                    required
                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                  />
                </div>
                <div class="w-32">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio ($)</label>
                  <input
                    type="number"
                    value={rule.price}
                    onChange$={(e) => updateRule(rule.id, 'price', Number((e.target as HTMLInputElement).value))}
                    required
                    min="0"
                    step="0.01"
                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-emerald-700"
                  />
                </div>
                <div class="pt-5">
                  <button
                    type="button"
                    onClick$={() => removeRule(rule.id)}
                    class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar franja"
                  >
                    <LuTrash2 class="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            {rules.rules.length === 0 && (
              <div class="text-center py-8 text-slate-400 font-medium italic border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                No hay franjas de precios configuradas.
              </div>
            )}
          </div>

          <div class="pt-2">
            <Button
              type="button"
              onClick$={addRule}
              look="outline"
              class="w-full border-dashed border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 rounded-2xl py-3 font-bold flex justify-center items-center gap-2"
            >
              <LuPlus class="w-5 h-5" />
              Añadir Franja Horaria
            </Button>
          </div>

          <div class="pt-6 flex gap-3 border-t border-slate-100">
            <Button
              type="button"
              onClick$={() => props.showSignal.value = false}
              look="outline"
              class="flex-1 rounded-2xl py-4 font-bold border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              look="primary"
              disabled={saveAction.isRunning}
              class="flex-1 bg-slate-800 text-white hover:bg-slate-900 rounded-2xl py-4 font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {saveAction.isRunning ? (
                <LoadingSpinner class="w-5 h-5" />
              ) : (
                "Guardar Precios"
              )}
            </Button>
          </div>
        </Form>
      </Modal.Panel>
    </Modal.Root>
  );
});

export const head = {
  title: "Configuración de Canchas - Admin",
};
