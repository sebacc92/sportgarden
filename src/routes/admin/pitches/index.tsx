import { component$, $, useSignal } from "@builder.io/qwik";
import {
  routeAction$,
  routeLoader$,
  zod$,
  z,
  useNavigate,
} from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { pitches, siteSettings } from "~/db/schema";
import { Button } from "~/components/ui";

// Import modular components
import { GlobalExtraServicesModal } from "~/components/admin/pitches/GlobalExtraServicesModal";
import { PitchCard } from "~/components/admin/pitches/PitchCard";
import { PitchTableView } from "~/components/admin/pitches/PitchTableView";
import { PitchSelectionModal } from "~/components/admin/pitches/PitchSelectionModal";
import { PitchDeleteConfirmModal } from "~/components/admin/pitches/PitchDeleteConfirmModal";

// 1. Data Loader
export const usePitchesData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return db.query.pitches.findMany({
    orderBy: (pitches, { asc }) => [asc(pitches.name)],
    with: {
      pricingRules: true,
      overlaps: true,
      overlappedBy: true,
    },
  });
});

export const useSiteSettingsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const [settings] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);
  return settings;
});

// 2. Actions (Only the ones needed on the main view)
export const useTogglePitchStatusAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const pitch = await db.query.pitches.findFirst({
      where: eq(pitches.id, data.id),
    });

    if (pitch) {
      await db
        .update(pitches)
        .set({ isActive: !pitch.isActive })
        .where(eq(pitches.id, data.id));
    }

    return { success: true };
  },
  zod$({
    id: z.string(),
  }),
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
        message:
          "No se puede borrar la cancha porque tiene reservas asociadas. Prueba deshabilitándola.",
      };
    }
  },
  zod$({
    id: z.string(),
  }),
);

export const useUpdateExtraServicesAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const extras = JSON.parse(data.extrasJson as string) as any[];
    await db
      .update(siteSettings)
      .set({ extraServices: extras })
      .where(eq(siteSettings.id, 1));
    return { success: true };
  },
  zod$({
    extrasJson: z.string(),
  }),
);

// 3. UI Orchestrator Component
export default component$(() => {
  const pitchesData = usePitchesData();
  const siteSettingsData = useSiteSettingsData();
  const toggleStatusAction = useTogglePitchStatusAction();
  const deleteAction = useDeletePitchAction();
  const nav = useNavigate();

  const isSelectionModalOpen = useSignal(false);
  const isDeleteConfirmModalOpen = useSignal(false);
  const pitchToDelete = useSignal<{ id: string; name: string } | null>(null);
  const isExtrasModalOpen = useSignal(false);
  const viewMode = useSignal<"grid" | "list">("grid");

  const openEditPage = $((pitch: any) => {
    nav(`/admin/pitches/${pitch.id}`);
  });

  const selectForDeletion = $((pitch: any) => {
    pitchToDelete.value = { id: pitch.id, name: pitch.name };
    isSelectionModalOpen.value = false;
    isDeleteConfirmModalOpen.value = true;
  });

  const updateExtraServicesAction = useUpdateExtraServicesAction();

  return (
    <div class="min-h-full overflow-auto bg-slate-50 p-6 font-sans text-slate-900">
      {/* Navigation Header */}
      <header class="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-slate-800">
            Configuración de Canchas
          </h1>
          <p class="text-slate-500">
            Administra los precios, tipos y estados de las canchas.
          </p>
        </div>
        <div class="flex gap-3">
          <Button
            onClick$={() => (isExtrasModalOpen.value = true)}
            look="outline"
            class="rounded-xl border-slate-200 px-6 py-2 font-bold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
          >
            Configurar Extras
          </Button>
          <Button
            onClick$={() => (isSelectionModalOpen.value = true)}
            look="outline"
            class="rounded-xl border-red-100 px-6 py-2 font-bold text-red-600 shadow-sm hover:border-red-200 hover:bg-red-50"
          >
            Borrar Cancha
          </Button>
          <Button
            onClick$={() => nav("/admin/pitches/new")}
            look="primary"
            class="rounded-xl bg-slate-800 px-6 py-2 font-bold text-white shadow-sm transition-all hover:bg-slate-900 hover:shadow-md"
          >
            Nueva Cancha
          </Button>
        </div>
      </header>

      <div class="space-y-6">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="flex items-center gap-2 text-xl font-bold text-slate-800">
            <span class="h-6 w-1 rounded-full bg-slate-800"></span>
            Listado de Canchas
          </h2>

          <div class="flex shrink-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick$={() => (viewMode.value = "grid")}
              class={[
                "rounded-lg p-2 transition-all",
                viewMode.value === "grid"
                  ? "bg-slate-800 text-white shadow-md"
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600",
              ]}
              title="Vista Cuadrícula"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              onClick$={() => (viewMode.value = "list")}
              class={[
                "rounded-lg p-2 transition-all",
                viewMode.value === "list"
                  ? "bg-slate-800 text-white shadow-md"
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600",
              ]}
              title="Vista Lista"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {viewMode.value === "grid" ? (
          <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {pitchesData.value.map((pitch, index) => (
              <PitchCard
                key={pitch.id}
                pitch={pitch}
                index={index}
                onEdit$={openEditPage}
                toggleStatusAction={toggleStatusAction}
              />
            ))}
          </div>
        ) : (
          <PitchTableView
            pitches={pitchesData.value}
            onEdit$={openEditPage}
            toggleStatusAction={toggleStatusAction}
          />
        )}

        {pitchesData.value.length === 0 && (
          <div class="col-span-full rounded-[2rem] border-2 border-dashed border-slate-200 bg-white p-16 text-center">
            <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 22v-7l-2-2"></path>
                <path d="M12 22v-7l2-2"></path>
                <path d="M22 10a9 9 0 0 0-18 0c0 4 3 6 8 11.5 5-5.5 8-7.5 8-11.5z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <p class="mb-6 text-lg font-bold text-slate-500">
              Aún no hay canchas configuradas.
            </p>
            <Button
              onClick$={() => nav("/admin/pitches/new")}
              look="primary"
              class="rounded-2xl bg-slate-800 px-8 py-3 font-black tracking-wider text-white uppercase"
            >
              Crear mi primera cancha
            </Button>
          </div>
        )}
      </div>

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

      <GlobalExtraServicesModal
        showSignal={isExtrasModalOpen}
        initialExtras={(siteSettingsData.value?.extraServices as any[]) || []}
        saveAction={updateExtraServicesAction}
      />
    </div>
  );
});
