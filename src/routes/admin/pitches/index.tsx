import { component$, $, useStore, useSignal } from "@builder.io/qwik";
import { Form, routeAction$, routeLoader$, zod$, z } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { pitches } from "~/db/schema";
import { Button, Modal } from "~/components/ui";

// 1. Data Loader
export const usePitchesData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return db.query.pitches.findMany({
    orderBy: (pitches, { asc }) => [asc(pitches.name)],
  });
});

// 2. Actions
export const useCreatePitchAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const id = crypto.randomUUID();
    
    await db.insert(pitches).values({
      id,
      name: data.name,
      type: data.type as "F5" | "F7" | "F9" | "F11",
      isCovered: data.isCovered === "on",
      pricePerHour: Number(data.pricePerHour),
      peakHourStart: data.peakHourStart || null,
      peakPricePerHour: data.peakPricePerHour ? Number(data.peakPricePerHour) : null,
      reservationPercentage: Number(data.reservationPercentage),
      isActive: true,
    });
    return { success: true };
  },
  zod$({
    name: z.string().min(1),
    type: z.enum(["F5", "F7", "F9", "F11"]),
    isCovered: z.string().optional(), // 'on' or undefined
    pricePerHour: z.coerce.number().min(0),
    peakHourStart: z.string().optional(),
    peakPricePerHour: z.coerce.number().optional(),
    reservationPercentage: z.coerce.number().min(0).max(100),
  })
);

export const useUpdatePitchAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    
    await db.update(pitches)
      .set({
        name: data.name,
        type: data.type as "F5" | "F7" | "F9" | "F11",
        isCovered: data.isCovered === "on",
        pricePerHour: Number(data.pricePerHour),
        peakHourStart: data.peakHourStart || null,
        peakPricePerHour: data.peakPricePerHour ? Number(data.peakPricePerHour) : null,
        reservationPercentage: Number(data.reservationPercentage),
      })
      .where(eq(pitches.id, data.id));
      
    return { success: true };
  },
  zod$({
    id: z.string(),
    name: z.string().min(1),
    type: z.enum(["F5", "F7", "F9", "F11"]),
    isCovered: z.string().optional(),
    pricePerHour: z.coerce.number().min(0),
    peakHourStart: z.string().optional(),
    peakPricePerHour: z.coerce.number().optional(),
    reservationPercentage: z.coerce.number().min(0).max(100),
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

  // State to handle edit mode
  const editingPitch = useStore<{ id: string | null; name: string; type: string; pricePerHour: number; peakHourStart: string; peakPricePerHour: number | null; reservationPercentage: number; isCovered: boolean }>({
    id: null,
    name: "",
    type: "F5",
    pricePerHour: 0,
    peakHourStart: "",
    peakPricePerHour: null,
    reservationPercentage: 0,
    isCovered: false,
  });

  const resetForm = $(() => {
    editingPitch.id = null;
    editingPitch.name = "";
    editingPitch.type = "F5";
    editingPitch.pricePerHour = 0;
    editingPitch.peakHourStart = "";
    editingPitch.peakPricePerHour = null;
    editingPitch.reservationPercentage = 0;
    editingPitch.isCovered = false;
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
    editingPitch.peakHourStart = pitch.peakHourStart || "";
    editingPitch.peakPricePerHour = pitch.peakPricePerHour;
    editingPitch.reservationPercentage = pitch.reservationPercentage;
    editingPitch.isCovered = pitch.isCovered;
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
                {/* Decorative Number Badge */}
                <div class="absolute top-0 right-0 w-16 h-16 bg-slate-50 flex items-center justify-center rounded-bl-3xl z-0 transition-colors group-hover:bg-slate-100">
                  <span class="text-4xl font-black text-slate-200 group-hover:text-slate-300 transition-colors leading-none">{index + 1}</span>
                </div>

                <div class="relative z-10">
                  <div class="flex justify-between items-start mb-6">
                    <div>
                      <h3 class="font-black text-xl text-slate-800 mb-1 leading-tight">
                        {pitch.name}
                      </h3>
                      <div class="flex flex-wrap gap-2">
                        <span class="bg-slate-800 text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">{pitch.type}</span>
                        {pitch.isCovered && (
                          <span class="text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-widest border border-blue-100">Techada</span>
                        )}
                        {!pitch.isActive && (
                          <span class="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] uppercase font-black rounded-lg tracking-widest border border-red-200">Inactiva</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div class="bg-slate-50/50 rounded-2xl p-4 mb-6 border border-slate-100">
                    <div class="flex justify-between items-end mb-2">
                      <div>
                        <div class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Precio x Hora</div>
                        <div class="text-2xl font-black text-slate-800">${pitch.pricePerHour}</div>
                      </div>
                      <div class="text-right">
                        <div class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Seña</div>
                        <div class="text-lg font-black text-slate-600">{pitch.reservationPercentage}%</div>
                      </div>
                    </div>
                    {pitch.peakHourStart && pitch.peakPricePerHour ? (
                      <div class="pt-2 mt-2 border-t border-slate-200">
                        <div class="flex justify-between items-center">
                          <div class="text-xs text-slate-500 font-bold">
                            Tarifa Pico (desde {pitch.peakHourStart})
                          </div>
                          <div class="text-sm font-black text-amber-600">
                            ${pitch.peakPricePerHour}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

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
        <Modal.Panel class="bg-white p-8 rounded-[2rem] border shadow-2xl max-w-md">
          <Modal.Title class="text-3xl font-black text-slate-800 mb-8 tracking-tighter">
            {editingPitch.id ? "Editar Cancha" : "Nueva Cancha"}
          </Modal.Title>
          
          <Form 
            action={editingPitch.id ? updatePitchAction : createPitchAction} 
            class="space-y-6" 
            onSubmitCompleted$={() => {
              isFormModalOpen.value = false;
              resetForm();
            }}
          >
            {editingPitch.id && <input type="hidden" name="id" value={editingPitch.id} />}
            
            <div>
              <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nombre de la cancha</label>
              <input 
                type="text" 
                name="name" 
                value={editingPitch.name}
                required
                placeholder="Ej: Cancha 1 (Sintético)"
                class="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold"
              />
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tipo</label>
                <select 
                  name="type" 
                  value={editingPitch.type}
                  class="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold appearance-none"
                >
                  <option value="F5">F5 (5 vs 5)</option>
                  <option value="F7">F7 (7 vs 7)</option>
                  <option value="F9">F9 (9 vs 9)</option>
                  <option value="F11">F11 (11 vs 11)</option>
                </select>
              </div>
              
              <div class="flex items-end pb-3">
                <label class="flex items-center gap-3 cursor-pointer group bg-slate-50 p-4 rounded-2xl border border-slate-200 w-full hover:bg-slate-100 transition-colors">
                  <input 
                    type="checkbox" 
                    name="isCovered" 
                    checked={editingPitch.isCovered}
                    class="w-6 h-6 text-slate-800 border-slate-300 rounded-lg focus:ring-slate-800 transition-all cursor-pointer"
                  />
                  <span class="text-xs font-black text-slate-600 uppercase tracking-widest">Techada</span>
                </label>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Precio x Hora ($)</label>
                <input 
                  type="number" 
                  name="pricePerHour" 
                  value={editingPitch.pricePerHour}
                  required
                  min="0"
                  step="0.01"
                  class="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold"
                />
              </div>
              
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Seña requerida (%)</label>
                <input 
                  type="number" 
                  name="reservationPercentage" 
                  value={editingPitch.reservationPercentage}
                  required
                  min="0"
                  max="100"
                  class="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition-all font-bold"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Inicio Horario Pico</label>
                <input 
                  type="time" 
                  name="peakHourStart" 
                  value={editingPitch.peakHourStart}
                  class="w-full px-4 py-4 bg-amber-50/50 border border-amber-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-bold text-amber-900"
                />
              </div>
              
              <div>
                <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Precio Horario Pico ($)</label>
                <input 
                  type="number" 
                  name="peakPricePerHour" 
                  value={editingPitch.peakPricePerHour || ""}
                  min="0"
                  step="0.01"
                  placeholder="Ej: 25000"
                  class="w-full px-4 py-4 bg-amber-50/50 border border-amber-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-bold text-amber-900 placeholder:text-amber-300"
                />
              </div>
            </div>

            <div class="pt-4 flex gap-3">
              <Button 
                type="button" 
                onClick$={() => isFormModalOpen.value = false}
                look="outline"
                class="flex-1 rounded-2xl py-4 font-bold border-slate-200"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                look="primary"
                disabled={createPitchAction.isRunning || updatePitchAction.isRunning}
                class="flex-1 bg-slate-800 text-white hover:bg-slate-900 rounded-2xl py-4 font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {(createPitchAction.isRunning || updatePitchAction.isRunning) ? (
                  <LoadingSpinner class="w-5 h-5" />
                ) : (
                  editingPitch.id ? "Guardar" : "Crear"
                )}
              </Button>
            </div>
          </Form>
        </Modal.Panel>
      </Modal.Root>

      {/* Selection Modal for Deletion */}
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

    </div>
  );
});

export const head = {
  title: "Configuración de Canchas - Admin",
};
