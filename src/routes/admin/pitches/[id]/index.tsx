import { component$, $, useSignal, useTask$, useStore } from "@builder.io/qwik";
import {
  routeAction$,
  routeLoader$,
  zod$,
  z,
  Form,
  useNavigate,
} from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { pitches, pitchOverlaps, pitchPricingRules } from "~/db/schema";
import { put } from "@vercel/blob";
import imageCompression from "browser-image-compression";
import { Button } from "~/components/ui";
import {
  LuImage,
  LuTrash2,
  LuSettings,
  LuArrowLeft,
  LuPlus,
} from "@qwikest/icons/lucide";
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
    },
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
    columns: { id: true, name: true },
  });
});

export const useUpdatePitchAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const id = data.id as string;

    let uploadedImageUrl = data.imageUrl || null;

    if (
      data.image &&
      typeof data.image === "object" &&
      (data.image as Blob).size > 0
    ) {
      const file = data.image as File;
      const fileName = `pitch-${id}-${Date.now()}.webp`;
      const { url } = await put(fileName, file, {
        access: "public",
        token: requestEvent.env.get("BLOB_READ_WRITE_TOKEN"),
      });
      uploadedImageUrl = url;
    }

    await db
      .update(pitches)
      .set({
        name: data.name,
        type: data.type as "F5" | "F6" | "F9",
        isCovered: data.isCovered === "on",
        isLit: data.isLit === "on",
        pricePerHour: Number(data.pricePerHour),
        depositType:
          (data.depositType as "PERCENTAGE" | "FIXED") || "PERCENTAGE",
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
    await db
      .delete(pitchOverlaps)
      .where(
        or(eq(pitchOverlaps.pitchId, id), eq(pitchOverlaps.overlapPitchId, id)),
      );
    // Insert new
    if (overlapIds.length > 0) {
      await db.insert(pitchOverlaps).values(
        overlapIds.map((oid) => ({
          id: Math.random().toString(36).substring(2, 11),
          pitchId: id,
          overlapPitchId: oid,
        })),
      );
    }

    // Update pricing rules
    const rules = JSON.parse(data.rulesJson as string) as any[];
    await db.delete(pitchPricingRules).where(eq(pitchPricingRules.pitchId, id));
    if (rules.length > 0) {
      const rulesToInsert = rules.map((rule) => ({
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
  }),
);

export const TimeSelect = component$(
  ({ value, onChange$ }: { value: string; onChange$: any }) => {
    return (
      <input
        type="text"
        value={value}
        onChange$={(e) => {
          let val = (e.target as HTMLInputElement).value.trim();
          if (val.length === 4 && !val.includes(":")) {
            val = val.slice(0, 2) + ":" + val.slice(2);
          }
          onChange$(val);
        }}
        placeholder="18:00"
        pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
        title="Formato 24hs (Ej: 18:00)"
        class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        maxLength={5}
      />
    );
  },
);

export default component$(() => {
  const pitch = usePitchData().value;
  const allPitches = useAllPitches().value;
  const updateAction = useUpdatePitchAction();
  const nav = useNavigate();
  const isCompressing = useSignal(false);

  const formState = useStore(
    {
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
      overlaps: pitch.overlaps.map((o) => o.overlapPitchId),
      rules: pitch.pricingRules.map((r) => ({ ...r, id: r.id })),
    },
    { deep: true },
  );

  const daysOfWeek = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Feriados",
  ];

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
          fileType: "image/webp" as string,
        };
        const compressedFile = await imageCompression(file, options);
        formState.previewUrl = URL.createObjectURL(compressedFile);
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(
          new File([compressedFile], compressedFile.name, {
            type: "image/webp",
          }),
        );
        input.files = dataTransfer.files;
      } catch (error) {
        console.error("Error compressing image:", error);
      } finally {
        isCompressing.value = false;
      }
    }
  });

  useTask$(({ track }) => {
    track(() => updateAction.value);
    if (updateAction.value?.success) {
      nav("/admin/pitches");
    }
  });

  return (
    <div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <Button
            look="ghost"
            onClick$={() => nav("/admin/pitches")}
            class="border border-slate-200 p-2"
          >
            <LuArrowLeft class="h-5 w-5" />
          </Button>
          <div>
            <h1 class="text-3xl font-black tracking-tighter text-slate-800">
              Editar Cancha
            </h1>
            <p class="mt-1 font-medium text-slate-500">
              Modifica configuración, precios y dependencias de {pitch.name}.
            </p>
          </div>
        </div>
      </div>

      <div class="mb-8 rounded-[2rem] border bg-white p-8 shadow-sm">
        <Form action={updateAction} class="space-y-8">
          <input type="hidden" name="id" value={formState.id} />
          <input
            type="hidden"
            name="imageUrl"
            value={formState.imageUrl || ""}
          />

          {/* Top row: image + nombre/tipo/atributos */}
          <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Image Upload */}
            <div>
              <label class="mb-2 block text-xs font-black tracking-widest text-slate-400 uppercase">
                Foto de la Cancha
              </label>
              <div class="group relative flex h-64 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-slate-400 hover:bg-slate-100">
                {formState.previewUrl || formState.imageUrl ? (
                  <>
                    <img
                      src={formState.previewUrl || formState.imageUrl!}
                      alt="Foto cancha"
                      class="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick$={() => {
                        formState.previewUrl = null;
                        formState.imageUrl = null;
                      }}
                      class="absolute inset-0 hidden items-center justify-center bg-black/50 text-white backdrop-blur-sm transition-all group-hover:flex"
                      title="Eliminar foto"
                    >
                      <LuTrash2 class="h-10 w-10" />
                    </button>
                  </>
                ) : (
                  <div class="flex flex-col items-center text-slate-400">
                    <div class="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
                      <LuImage class="h-8 w-8 text-slate-400" />
                    </div>
                    <span class="text-sm font-black tracking-widest text-slate-500 uppercase">
                      Subir Imagen
                    </span>
                    <span class="mt-1 text-xs font-medium text-slate-400">
                      Click o arrastrar foto
                    </span>
                  </div>
                )}
                {isCompressing.value && (
                  <div class="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                    <div class="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500"></div>
                    <span class="mt-3 text-xs font-bold tracking-widest text-slate-600 uppercase">
                      Optimizando...
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  onChange$={handleFileChange}
                  class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  disabled={isCompressing.value}
                />
              </div>
            </div>

            {/* Nombre + Tipo + Atributos */}
            <div class="flex flex-col gap-5">
              <div>
                <label class="mb-2 block text-xs font-black tracking-widest text-slate-400 uppercase">
                  Nombre de la cancha
                </label>
                <input
                  type="text"
                  name="name"
                  value={formState.name}
                  onChange$={(e) =>
                    (formState.name = (e.target as HTMLInputElement).value)
                  }
                  required
                  placeholder="Ej: Cancha 1 (Sintético)"
                  class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold text-slate-800 transition-all placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label class="mb-2 block text-xs font-black tracking-widest text-slate-400 uppercase">
                  Tipo de Cancha
                </label>
                <select
                  name="type"
                  value={formState.type}
                  onChange$={(e) =>
                    (formState.type = (e.target as HTMLSelectElement).value as
                      | "F5"
                      | "F6"
                      | "F9")
                  }
                  class="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold text-slate-800 transition-all focus:border-transparent focus:ring-2 focus:ring-slate-800 focus:outline-none"
                >
                  <option value="F5">Fútbol 5</option>
                  <option value="F6">Fútbol 6</option>
                  <option value="F9">Fútbol 9</option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-2 block text-xs font-black tracking-widest text-slate-400 uppercase">
                    Deporte
                  </label>
                  <input
                    type="text"
                    name="sport"
                    value={formState.sport}
                    onChange$={(e) =>
                      (formState.sport = (e.target as HTMLInputElement).value)
                    }
                    placeholder="Ej: Fútbol"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold text-slate-800 transition-all focus:border-transparent focus:ring-2 focus:ring-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="mb-2 block text-xs font-black tracking-widest text-slate-400 uppercase">
                    Superficie
                  </label>
                  <input
                    type="text"
                    name="surface"
                    value={formState.surface}
                    onChange$={(e) =>
                      (formState.surface = (e.target as HTMLInputElement).value)
                    }
                    placeholder="Ej: Sintético"
                    class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold text-slate-800 transition-all focus:border-transparent focus:ring-2 focus:ring-slate-800 focus:outline-none"
                  />
                </div>
              </div>
              <div class="flex gap-4 pt-2">
                <label class="flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 transition-colors hover:bg-slate-100">
                  <input
                    type="checkbox"
                    name="isCovered"
                    checked={formState.isCovered}
                    onChange$={(e) =>
                      (formState.isCovered = (
                        e.target as HTMLInputElement
                      ).checked)
                    }
                    class="h-5 w-5 cursor-pointer rounded accent-slate-800"
                  />
                  <span class="text-sm font-black tracking-widest text-slate-700 uppercase">
                    Cubierta
                  </span>
                </label>
                <label class="flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 transition-colors hover:bg-amber-100">
                  <input
                    type="checkbox"
                    name="isLit"
                    checked={formState.isLit}
                    onChange$={(e) =>
                      (formState.isLit = (e.target as HTMLInputElement).checked)
                    }
                    class="h-5 w-5 cursor-pointer rounded accent-amber-500"
                  />
                  <span class="text-sm font-black tracking-widest text-amber-800 uppercase">
                    Iluminada
                  </span>
                </label>
              </div>
            </div>
          </div>

          <hr class="border-slate-100" />

          {/* Finanzas Base Group */}
          <div class="space-y-5 rounded-3xl border border-slate-200 bg-slate-50 p-8">
            <div class="mb-2 flex items-center gap-3">
              <div class="h-8 w-2 rounded-full bg-emerald-500"></div>
              <div>
                <h3 class="text-lg font-black tracking-widest text-slate-800 uppercase">
                  Finanzas Base
                </h3>
                <p class="text-xs font-medium text-slate-500">
                  Configura el precio base y la política de señas.
                </p>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <label class="mb-2 block text-xs font-black tracking-widest text-slate-400 uppercase">
                  Precio x Hora ($)
                </label>
                <div class="relative">
                  <span class="absolute top-1/2 left-4 -translate-y-1/2 text-lg font-black text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    name="pricePerHour"
                    value={formState.pricePerHour || ""}
                    onChange$={(e) =>
                      (formState.pricePerHour = Number(
                        (e.target as HTMLInputElement).value,
                      ))
                    }
                    required
                    min="0"
                    step="1"
                    class="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pr-4 pl-10 text-lg font-bold text-slate-800 transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div class="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                <label class="mb-3 block text-xs font-black tracking-widest text-emerald-700 uppercase">
                  Seña requerida
                </label>
                <div class="mb-4 flex gap-2">
                  <button
                    type="button"
                    onClick$={() => (formState.depositType = "PERCENTAGE")}
                    class={cn(
                      "flex-1 rounded-xl border py-2 text-xs font-black tracking-widest uppercase transition-all",
                      formState.depositType === "PERCENTAGE"
                        ? "border-emerald-700 bg-emerald-600 text-white shadow-inner"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100",
                    )}
                  >
                    % %
                  </button>
                  <button
                    type="button"
                    onClick$={() => (formState.depositType = "FIXED")}
                    class={cn(
                      "flex-1 rounded-xl border py-2 text-xs font-black tracking-widest uppercase transition-all",
                      formState.depositType === "FIXED"
                        ? "border-emerald-700 bg-emerald-600 text-white shadow-inner"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100",
                    )}
                  >
                    $ Fijo
                  </button>
                </div>
                <input
                  type="hidden"
                  name="depositType"
                  value={formState.depositType}
                />
                <div class="relative">
                  <span class="absolute top-1/2 left-4 -translate-y-1/2 text-lg font-black text-emerald-600">
                    {formState.depositType === "PERCENTAGE" ? "%" : "$"}
                  </span>
                  <input
                    type="number"
                    name="depositAmount"
                    value={formState.depositAmount}
                    onChange$={(e) =>
                      (formState.depositAmount = Number(
                        (e.target as HTMLInputElement).value,
                      ))
                    }
                    min="0"
                    max={
                      formState.depositType === "PERCENTAGE" ? 100 : undefined
                    }
                    step={formState.depositType === "PERCENTAGE" ? 1 : 100}
                    placeholder={
                      formState.depositType === "PERCENTAGE" ? "50" : "5000"
                    }
                    class="w-full rounded-xl border border-emerald-100 bg-emerald-50/50 py-3 pr-4 pl-10 text-lg font-bold text-emerald-900 transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr class="border-slate-100" />

          {/* Precios Dinámicos (Directly embedded) */}
          <div class="space-y-5 rounded-3xl border border-indigo-100 bg-indigo-50/50 p-8">
            <div class="mb-2 flex items-center gap-3">
              <div class="h-8 w-2 rounded-full bg-indigo-500"></div>
              <div>
                <h3 class="text-lg font-black tracking-widest text-indigo-900 uppercase">
                  Precios Dinámicos
                </h3>
                <p class="text-xs font-medium text-indigo-600">
                  Configura franjas horarias con precios especiales.
                </p>
              </div>
            </div>

            <div class="space-y-4">
              {formState.rules.map((rule, idx) => (
                <div
                  key={rule.id}
                  class="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm"
                >
                  <div class="flex-1">
                    <label class="mb-1.5 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Día
                    </label>
                    <select
                      value={rule.dayOfWeek}
                      onChange$={(e) =>
                        (formState.rules[idx].dayOfWeek = Number(
                          (e.target as HTMLSelectElement).value,
                        ))
                      }
                      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      {daysOfWeek.map((day, i) => (
                        <option key={i} value={i}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div class="w-28 shrink-0">
                    <label class="mb-1.5 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Inicio
                    </label>
                    <TimeSelect
                      value={rule.startTime}
                      onChange$={$((val: string) => {
                        formState.rules[idx].startTime = val;
                      })}
                    />
                  </div>
                  <div class="w-28 shrink-0">
                    <label class="mb-1.5 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Fin
                    </label>
                    <TimeSelect
                      value={rule.endTime}
                      onChange$={$((val: string) => {
                        formState.rules[idx].endTime = val;
                      })}
                    />
                  </div>
                  <div class="w-32 shrink-0">
                    <label class="mb-1.5 block text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Precio ($)
                    </label>
                    <input
                      type="number"
                      value={rule.price}
                      onChange$={(e) =>
                        (formState.rules[idx].price = Number(
                          (e.target as HTMLInputElement).value,
                        ))
                      }
                      required
                      min="0"
                      step="1"
                      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div class="pt-5">
                    <button
                      type="button"
                      onClick$={() =>
                        (formState.rules = formState.rules.filter(
                          (r) => r.id !== rule.id,
                        ))
                      }
                      class="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Eliminar franja"
                    >
                      <LuTrash2 class="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}

              {formState.rules.length === 0 && (
                <div class="rounded-2xl border-2 border-dashed border-indigo-200 bg-white/50 py-8 text-center font-medium text-indigo-300 italic">
                  No hay franjas de precios dinámicos configuradas.
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick$={() =>
                formState.rules.push({
                  id: Math.random().toString(),
                  pitchId: formState.id,
                  dayOfWeek: 1,
                  startTime: "18:00",
                  endTime: "19:00",
                  price: formState.pricePerHour || 0,
                })
              }
              look="outline"
              class="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 py-3 font-bold text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50"
            >
              <LuPlus class="h-5 w-5" />
              Añadir Franja Horaria
            </Button>

            <input
              type="hidden"
              name="rulesJson"
              value={JSON.stringify(formState.rules)}
            />
          </div>

          <hr class="border-slate-100" />

          {/* Espacio Solapado (Overlapping Pitches) */}
          <div>
            <h3 class="mb-2 flex items-center gap-2 text-sm font-black tracking-widest text-slate-800 uppercase">
              <LuSettings class="h-5 w-5 text-slate-400" /> Dependencias de
              Espacio
            </h3>
            <div class="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p class="mb-6 text-sm leading-relaxed font-medium text-slate-500">
                Selecciona qué canchas ocupan el mismo espacio físico. Si alguna
                de estas canchas tiene una reserva, esta cancha quedará
                inhabilitada (y viceversa).
              </p>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {allPitches
                  .filter((p) => p.id !== formState.id)
                  .map((p) => {
                    const isSelected = formState.overlaps.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        class={cn(
                          "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all",
                          isSelected
                            ? "scale-[1.02] border-slate-900 bg-slate-800 text-white shadow-md"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50",
                        )}
                      >
                        <input
                          type="checkbox"
                          class="hidden"
                          checked={isSelected}
                          onChange$={() => {
                            const current = formState.overlaps;
                            const next = isSelected
                              ? current.filter((id) => id !== p.id)
                              : [...current, p.id];
                            formState.overlaps = next;
                          }}
                        />
                        <div
                          class={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                            isSelected
                              ? "border-white bg-white"
                              : "border-slate-300",
                          )}
                        >
                          {isSelected && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="4"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              class="text-slate-800"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <span class="truncate text-sm font-black">
                          {p.name}
                        </span>
                      </label>
                    );
                  })}
              </div>

              {allPitches.length <= 1 && (
                <div class="py-6 text-center text-sm font-bold text-slate-400 italic">
                  No hay otras canchas creadas para establecer dependencias.
                </div>
              )}

              {/* Hidden input to send overlaps as JSON string */}
              <input
                type="hidden"
                name="overlaps"
                value={JSON.stringify(formState.overlaps)}
              />
            </div>
          </div>

          <hr class="border-slate-100" />

          {/* Aclaraciones */}
          <div>
            <label class="mb-3 block text-xs font-black tracking-widest text-slate-400 uppercase">
              Aclaraciones / Notas
            </label>
            <textarea
              name="notes"
              value={formState.notes}
              onChange$={(e) =>
                (formState.notes = (e.target as HTMLTextAreaElement).value)
              }
              placeholder="Ej: Tiene vestuario propio, apta para lluvia..."
              rows={3}
              class="w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium text-slate-800 transition-all focus:border-transparent focus:ring-2 focus:ring-slate-800 focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div class="mt-8 flex justify-end gap-4 border-t border-slate-100 pt-6">
            <Button
              type="button"
              onClick$={() => nav("/admin/pitches")}
              look="outline"
              class="rounded-2xl border-slate-200 px-8 py-4 font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              look="primary"
              disabled={updateAction.isRunning || isCompressing.value}
              class="flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-12 py-4 font-black tracking-widest text-white uppercase shadow-lg transition-all hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-xl"
            >
              {updateAction.isRunning || isCompressing.value ? (
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
