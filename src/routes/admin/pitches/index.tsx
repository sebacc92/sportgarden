import { component$, $, useSignal } from "@builder.io/qwik";
import { routeAction$, routeLoader$, zod$, z } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { pitches, pitchPricingRules, siteSettings } from "~/db/schema";
import { Button } from "~/components/ui";
import { put } from '@vercel/blob';
import imageCompression from 'browser-image-compression';

// Import modular components
import { PitchPricingModal } from "~/components/admin/pitches/PitchPricingModal";
import { GlobalExtraServicesModal } from "~/components/admin/pitches/GlobalExtraServicesModal";
import { PitchCard } from "~/components/admin/pitches/PitchCard";
import { PitchTableView } from "~/components/admin/pitches/PitchTableView";
import { PitchFormModal } from "~/components/admin/pitches/PitchFormModal";
import { PitchSelectionModal } from "~/components/admin/pitches/PitchSelectionModal";
import { PitchDeleteConfirmModal } from "~/components/admin/pitches/PitchDeleteConfirmModal";

// 1. Data Loader
export const usePitchesData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return db.query.pitches.findMany({
    orderBy: (pitches, { asc }) => [asc(pitches.name)],
    with: { pricingRules: true },
  });
});

export const useSiteSettingsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return settings;
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
      sport: data.sport || "Fútbol",
      surface: data.surface || "Sintético",
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
    sport: z.string().optional().default("Fútbol"),
    surface: z.string().optional().default("Sintético"),
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
        sport: data.sport || "Fútbol",
        surface: data.surface || "Sintético",
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
    sport: z.string().optional().default("Fútbol"),
    surface: z.string().optional().default("Sintético"),
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

export const useUpdateExtraServicesAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const extras = JSON.parse(data.extrasJson as string) as any[];
    await db.update(siteSettings).set({ extraServices: extras }).where(eq(siteSettings.id, 1));
    return { success: true };
  },
  zod$({
    extrasJson: z.string(),
  })
);

// 3. UI Orchestrator Component
export default component$(() => {
  const pitchesData = usePitchesData();
  const siteSettingsData = useSiteSettingsData();
  const createPitchAction = useCreatePitchAction();
  const updatePitchAction = useUpdatePitchAction();
  const toggleStatusAction = useTogglePitchStatusAction();
  const deleteAction = useDeletePitchAction();

  const isSelectionModalOpen = useSignal(false);
  const isDeleteConfirmModalOpen = useSignal(false);
  const pitchToDelete = useSignal<{ id: string; name: string } | null>(null);

  const isPricingModalOpen = useSignal(false);
  const selectedPitchForPricing = useSignal<{ id: string; name: string; rules: any[] } | null>(null);

  const isExtrasModalOpen = useSignal(false);

  // Single atomic signal: null = modal closed, object = modal open with data
  type EditModalState = {
    id: string | null;
    name: string;
    type: string;
    sport: string;
    surface: string;
    pricePerHour: number;
    depositType: string;
    depositAmount: number;
    isCovered: boolean;
    isLit: boolean;
    notes: string;
    imageUrl: string | null;
    previewUrl: string | null;
  };
  const editModalState = useSignal<EditModalState | null>(null);

  const isCompressing = useSignal(false);
  const viewMode = useSignal<"grid" | "list">("grid");

  const handleFileChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];
    if (editModalState.value) {
      editModalState.value = { ...editModalState.value, previewUrl: URL.createObjectURL(file), imageUrl: null };
    }
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

      const isEditing = !!editModalState.value?.id;
      if (isEditing) {
        await updatePitchAction.submit(formData);
      } else {
        await createPitchAction.submit(formData);
      }

      if (updatePitchAction.value?.success || createPitchAction.value?.success) {
        editModalState.value = null;
      }
    } catch (error) {
      console.error('Error al comprimir/subir imagen:', error);
    } finally {
      isCompressing.value = false;
    }
  });

  const openCreateModal = $(() => {
    editModalState.value = {
      id: null, name: "", type: "F5", pricePerHour: 0,
      depositType: "PERCENTAGE", depositAmount: 0,
      isCovered: false, isLit: false, notes: "",
      imageUrl: null, previewUrl: null,
    };
  });

  const openEditModal = $((pitch: any) => {
    editModalState.value = {
      id: pitch.id,
      name: pitch.name,
      type: pitch.type,
      sport: pitch.sport || "Fútbol",
      surface: pitch.surface || "Sintético",
      pricePerHour: pitch.pricePerHour,
      depositType: pitch.depositType || "PERCENTAGE",
      depositAmount: pitch.depositAmount || 0,
      isCovered: pitch.isCovered,
      isLit: pitch.isLit || false,
      notes: pitch.notes || "",
      imageUrl: pitch.imageUrl,
      previewUrl: null,
    };
    selectedPitchForPricing.value = { id: pitch.id, name: pitch.name, rules: pitch.pricingRules || [] };
  });

  const handleAddNew = $(() => {
    editModalState.value = {
      id: null,
      name: "",
      type: "F5",
      sport: "Fútbol",
      surface: "Sintético",
      pricePerHour: 0,
      depositType: "PERCENTAGE",
      depositAmount: 0,
      isCovered: false,
      isLit: false,
      notes: "",
      imageUrl: null,
      previewUrl: null,
    };
    selectedPitchForPricing.value = null;
  });

  const selectForDeletion = $((pitch: any) => {
    pitchToDelete.value = { id: pitch.id, name: pitch.name };
    isSelectionModalOpen.value = false;
    isDeleteConfirmModalOpen.value = true;
  });

  const savePricingRulesAction = useSavePricingRulesAction();
  const updateExtraServicesAction = useUpdateExtraServicesAction();

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
            onClick$={() => isExtrasModalOpen.value = true}
            look="outline"
            class="border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 px-6 py-2 rounded-xl font-bold shadow-sm"
          >
            Configurar Extras
          </Button>
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
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span class="w-1 h-6 bg-slate-800 rounded-full"></span>
            Listado de Canchas
          </h2>
          
          <div class="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm shrink-0">
            <button
              onClick$={() => viewMode.value = "grid"}
              class={["p-2 rounded-lg transition-all", viewMode.value === "grid" ? "bg-slate-800 text-white shadow-md" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"]}
              title="Vista Cuadrícula"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </button>
            <button
              onClick$={() => viewMode.value = "list"}
              class={["p-2 rounded-lg transition-all", viewMode.value === "list" ? "bg-slate-800 text-white shadow-md" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"]}
              title="Vista Lista"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
          </div>
        </div>

        {viewMode.value === "grid" ? (
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pitchesData.value.map((pitch, index) => (
              <PitchCard
                key={pitch.id}
                pitch={pitch}
                index={index}
                onEdit$={openEditModal}
                toggleStatusAction={toggleStatusAction}
              />
            ))}
          </div>
        ) : (
          <PitchTableView
            pitches={pitchesData.value}
            onEdit$={openEditModal}
            toggleStatusAction={toggleStatusAction}
          />
        )}

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

      <PitchFormModal
        editModalState={editModalState}
        isCompressing={isCompressing}
        createAction={createPitchAction}
        updateAction={updatePitchAction}
        onPricingClick$={$(() => isPricingModalOpen.value = true)}
        selectedPitchForPricing={selectedPitchForPricing}
        onSubmit$={handleSubmit}
        onFileChange$={handleFileChange}
      />

      <PitchSelectionModal
        showSignal={isSelectionModalOpen}
        pitches={pitchesData.value}
        onSelectForDeletion$={selectForDeletion}
      />

      <PitchDeleteConfirmModal
        showSignal={isDeleteConfirmModalOpen}
        pitchToDelete={pitchToDelete}
        deleteAction={deleteAction}
      />

      <PitchPricingModal
        showSignal={isPricingModalOpen}
        pitchId={selectedPitchForPricing.value?.id || ""}
        pitchName={selectedPitchForPricing.value?.name || ""}
        initialRules={selectedPitchForPricing.value?.rules || []}
        saveAction={savePricingRulesAction}
      />

      <GlobalExtraServicesModal
        showSignal={isExtrasModalOpen}
        initialExtras={(siteSettingsData.value?.extraServices as any[]) || []}
        saveAction={updateExtraServicesAction}
      />

    </div>
  );
});

export const head = {
  title: "Configuración de Canchas - Admin",
};
