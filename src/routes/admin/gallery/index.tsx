import { component$, $, useSignal, useComputed$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { siteSettings } from "~/db/schema";
import { put } from "@vercel/blob";
import imageCompression from "browser-image-compression";

const MAX_IMAGES = 20;

// ─── Loaders ────────────────────────────────────────────────────────────────

export const useGalleryLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const [settings] = await db
    .select({ galleryImages: siteSettings.galleryImages })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);
  return (settings?.galleryImages as string[] | null) ?? [];
});

// ─── Actions ─────────────────────────────────────────────────────────────────

export const useUploadGalleryImageAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const [settings] = await db
      .select({ galleryImages: siteSettings.galleryImages })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);
    const current = (settings?.galleryImages as string[] | null) ?? [];

    if (current.length >= MAX_IMAGES) {
      return {
        success: false,
        message: `Límite de ${MAX_IMAGES} imágenes alcanzado.`,
      };
    }

    const file = data.image as File;
    if (!file || file.size === 0)
      return { success: false, message: "No se recibió imagen." };

    const fileName = `gallery-${Date.now()}.webp`;
    const { url } = await put(fileName, file, {
      access: "public",
      token: requestEvent.env.get("BLOB_READ_WRITE_TOKEN"),
    });

    const updated = [...current, url];
    await db
      .update(siteSettings)
      .set({ galleryImages: updated, updatedAt: new Date() })
      .where(eq(siteSettings.id, 1));

    return { success: true };
  },
  zod$({ image: z.any() }),
);

export const useDeleteGalleryImageAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const [settings] = await db
      .select({ galleryImages: siteSettings.galleryImages })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);
    const current = (settings?.galleryImages as string[] | null) ?? [];
    const updated = current.filter((url) => url !== data.url);
    await db
      .update(siteSettings)
      .set({ galleryImages: updated, updatedAt: new Date() })
      .where(eq(siteSettings.id, 1));
    return { success: true };
  },
  zod$({ url: z.string().url() }),
);

export const useReorderGalleryAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const urls = JSON.parse(data.urlsJson as string) as string[];
    if (!Array.isArray(urls)) return { success: false };
    await db
      .update(siteSettings)
      .set({ galleryImages: urls, updatedAt: new Date() })
      .where(eq(siteSettings.id, 1));
    return { success: true };
  },
  zod$({ urlsJson: z.string() }),
);

// ─── Component ───────────────────────────────────────────────────────────────

export default component$(() => {
  const galleryLoader = useGalleryLoader();
  const uploadAction = useUploadGalleryImageAction();
  const deleteAction = useDeleteGalleryImageAction();
  const reorderAction = useReorderGalleryAction();

  const images = useSignal<string[]>(galleryLoader.value ?? []);
  const isUploading = useSignal(false);
  const lightboxUrl = useSignal<string | null>(null);
  const lightboxIdx = useSignal(0);
  const fileInputRef = useSignal<HTMLInputElement>();
  const confirmDeleteUrl = useSignal<string | null>(null);

  const count = useComputed$(() => images.value.length);

  const handleFileChange = $(async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    if (images.value.length >= MAX_IMAGES) return;

    isUploading.value = true;
    try {
      const file = input.files[0];
      const compressed = await imageCompression(file, {
        maxWidthOrHeight: 1400,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.82,
      });
      const webpFile = new File([compressed], "gallery.webp", {
        type: "image/webp",
      });
      const fd = new FormData();
      fd.append("image", webpFile);
      const result = await uploadAction.submit(fd);
      input.value = "";
      if ((result as any)?.value?.success) {
        // Reload to get the updated list from server
        window.location.reload();
      }
    } finally {
      isUploading.value = false;
    }
  });

  const openLightbox = $((url: string) => {
    lightboxIdx.value = images.value.indexOf(url);
    lightboxUrl.value = url;
  });

  const closeLightbox = $(() => {
    lightboxUrl.value = null;
  });

  const prevImage = $(() => {
    const newIdx =
      (lightboxIdx.value - 1 + images.value.length) % images.value.length;
    lightboxIdx.value = newIdx;
    lightboxUrl.value = images.value[newIdx];
  });

  const nextImage = $(() => {
    const newIdx = (lightboxIdx.value + 1) % images.value.length;
    lightboxIdx.value = newIdx;
    lightboxUrl.value = images.value[newIdx];
  });

  const moveImage = $(async (idx: number, dir: "up" | "down") => {
    const arr = [...images.value];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    images.value = arr;
    await reorderAction.submit({ urlsJson: JSON.stringify(arr) });
  });

  return (
    <div class="min-h-full overflow-auto bg-slate-50 p-6 font-sans text-slate-900">
      {/* Header */}
      <header class="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-slate-800">
            Galería de Fotos
          </h1>
          <p class="mt-1 text-slate-500">
            {count.value}/{MAX_IMAGES} imágenes · Las fotos se mostrarán en la
            página principal.
          </p>
        </div>

        <label
          class={[
            "flex cursor-pointer items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold tracking-wider uppercase shadow-sm transition-all",
            count.value >= MAX_IMAGES || isUploading.value
              ? "cursor-not-allowed bg-slate-200 text-slate-400"
              : "bg-slate-800 text-white hover:bg-slate-900 hover:shadow-md",
          ]}
        >
          {isUploading.value ? (
            <>
              <svg
                class="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                ></path>
              </svg>
              Subiendo...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Agregar Foto
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            class="hidden"
            disabled={count.value >= MAX_IMAGES || isUploading.value}
            onChange$={handleFileChange}
          />
        </label>
      </header>

      {/* Limit reached banner */}
      {count.value >= MAX_IMAGES && (
        <div class="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span class="text-sm font-bold">
            Límite de {MAX_IMAGES} imágenes alcanzado. Elimina alguna para
            agregar más.
          </span>
        </div>
      )}

      {/* Grid */}
      {images.value.length === 0 ? (
        <div class="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 py-32 text-slate-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="mb-4"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p class="mb-2 text-lg font-bold">Sin imágenes todavía</p>
          <p class="text-sm">
            Hacé clic en "Agregar Foto" para subir la primera imagen.
          </p>
        </div>
      ) : (
        <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {images.value.map((url, idx) => (
            <div
              key={url}
              class="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm transition-all duration-200 hover:shadow-lg"
            >
              <img
                src={url}
                alt={`Foto ${idx + 1}`}
                width={300}
                height={300}
                class="h-full w-full cursor-pointer object-cover transition-transform duration-500 group-hover:scale-105"
                onClick$={() => openLightbox(url)}
              />

              {/* Overlay */}
              <div class="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/40">
                <div class="flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {/* View */}
                  <button
                    type="button"
                    onClick$={() => openLightbox(url)}
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-800 transition-colors hover:bg-white"
                    title="Ver"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  {/* Move up */}
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick$={() => moveImage(idx, "up")}
                      class="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-800 transition-colors hover:bg-white"
                      title="Mover arriba"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                  )}
                  {/* Move down */}
                  {idx < images.value.length - 1 && (
                    <button
                      type="button"
                      onClick$={() => moveImage(idx, "down")}
                      class="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-800 transition-colors hover:bg-white"
                      title="Mover abajo"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  )}
                  {/* Delete */}
                  <button
                    type="button"
                    onClick$={() => (confirmDeleteUrl.value = url)}
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
                    title="Eliminar"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Position badge */}
              <div class="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-[10px] font-black text-white">
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxUrl.value && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick$={closeLightbox}
        >
          <button
            type="button"
            onClick$={closeLightbox}
            class="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Prev */}
          {images.value.length > 1 && (
            <button
              type="button"
              onClick$={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              class="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <img
            src={lightboxUrl.value}
            alt="Vista ampliada"
            width={1200}
            height={800}
            class="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick$={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {images.value.length > 1 && (
            <button
              type="button"
              onClick$={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              class="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          <div class="absolute bottom-4 text-sm font-medium text-white/60">
            {lightboxIdx.value + 1} / {images.value.length}
          </div>
        </div>
      )}

      {/* ── Delete Confirm Dialog ── */}
      {confirmDeleteUrl.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div class="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
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
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-black text-slate-800">
              ¿Eliminar imagen?
            </h3>
            <p class="mb-6 text-sm text-slate-500">
              Esta acción no se puede deshacer.
            </p>
            <div class="flex gap-3">
              <button
                type="button"
                onClick$={() => (confirmDeleteUrl.value = null)}
                class="flex-1 rounded-xl border border-slate-200 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick$={async () => {
                  const url = confirmDeleteUrl.value!;
                  confirmDeleteUrl.value = null;
                  images.value = images.value.filter((u) => u !== url);
                  await deleteAction.submit({ url });
                }}
                disabled={deleteAction.isRunning}
                class="flex-1 rounded-xl bg-red-600 py-3 font-black text-white transition-colors hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
