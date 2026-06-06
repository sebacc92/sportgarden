import { component$, $, useSignal, useComputed$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z } from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { siteSettings } from "~/db/schema";
import { put } from "@vercel/blob";
import imageCompression from "browser-image-compression";

const MAX_IMAGES = 12;
const MAX_REELS = 5;

// ─── Loaders ────────────────────────────────────────────────────────────────

export const useGalleryLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const { data, error } = await db
    .from(siteSettings)
    .select("gallery_images, reels")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  const settings = camelize<any>(data);

  return {
    images: (settings?.galleryImages as string[] | null) ?? [],
    reels: (settings?.reels as { id: string; videoUrl: string; posterUrl: string; caption?: string }[] | null) ?? [],
  };
});

// ─── Actions ─────────────────────────────────────────────────────────────────

export const useUploadGalleryImageAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const { data: settingsData, error } = await db
      .from(siteSettings)
      .select("gallery_images")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    const settings = camelize<any>(settingsData);
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
    const { error: updErr } = await db
      .from(siteSettings)
      .update({ gallery_images: updated, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (updErr) throw updErr;

    return { success: true };
  },
  zod$({ image: z.any() }),
);

export const useDeleteGalleryImageAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { data: settingsData, error } = await db
      .from(siteSettings)
      .select("gallery_images")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    const settings = camelize<any>(settingsData);
    const current = (settings?.galleryImages as string[] | null) ?? [];
    const updated = current.filter((url) => url !== data.url);

    const { error: updErr } = await db
      .from(siteSettings)
      .update({ gallery_images: updated, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (updErr) throw updErr;

    return { success: true };
  },
  zod$({ url: z.string().url() }),
);

export const useReorderGalleryAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const urls = JSON.parse(data.urlsJson as string) as string[];
    if (!Array.isArray(urls)) return { success: false };

    const { error: updErr } = await db
      .from(siteSettings)
      .update({ gallery_images: urls, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (updErr) throw updErr;

    return { success: true };
  },
  zod$({ urlsJson: z.string() }),
);

export const useUploadReelAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const { data: settingsData, error } = await db
      .from(siteSettings)
      .select("reels")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    const settings = camelize<any>(settingsData);
    const current = (settings?.reels as { id: string; videoUrl: string; posterUrl: string; caption?: string }[] | null) ?? [];

    if (current.length >= MAX_REELS) {
      return {
        success: false,
        message: `Límite de ${MAX_REELS} Reels alcanzado.`,
      };
    }

    const videoFile = data.video as File;
    const posterFile = data.poster as File;
    const caption = (data.caption as string) || "";

    if (!videoFile || videoFile.size === 0) {
      return { success: false, message: "No se recibió el video." };
    }
    if (!posterFile || posterFile.size === 0) {
      return { success: false, message: "No se recibió la imagen de preview." };
    }

    // Upload Video to Vercel Blob
    const videoName = `reel-video-${Date.now()}-${videoFile.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    const videoUpload = await put(videoName, videoFile, {
      access: "public",
      token: requestEvent.env.get("BLOB_READ_WRITE_TOKEN"),
    });

    // Upload Poster to Vercel Blob
    const posterName = `reel-poster-${Date.now()}-${posterFile.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    const posterUpload = await put(posterName, posterFile, {
      access: "public",
      token: requestEvent.env.get("BLOB_READ_WRITE_TOKEN"),
    });

    const newReel = {
      id: `reel-${Date.now()}`,
      videoUrl: videoUpload.url,
      posterUrl: posterUpload.url,
      caption: caption,
    };

    const updated = [...current, newReel];
    const { error: updErr } = await db
      .from(siteSettings)
      .update({ reels: updated, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (updErr) throw updErr;

    return { success: true };
  },
  zod$({
    video: z.any(),
    poster: z.any(),
    caption: z.string().optional(),
  }),
);

export const useDeleteReelAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);
    const { data: settingsData, error } = await db
      .from(siteSettings)
      .select("reels")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    const settings = camelize<any>(settingsData);
    const current = (settings?.reels as { id: string; videoUrl: string; posterUrl: string; caption?: string }[] | null) ?? [];
    const updated = current.filter((r) => r.id !== data.id);

    const { error: updErr } = await db
      .from(siteSettings)
      .update({ reels: updated, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (updErr) throw updErr;

    return { success: true };
  },
  zod$({ id: z.string() }),
);

// ─── Component ───────────────────────────────────────────────────────────────

export default component$(() => {
  const galleryLoader = useGalleryLoader();
  const uploadAction = useUploadGalleryImageAction();
  const deleteAction = useDeleteGalleryImageAction();
  const reorderAction = useReorderGalleryAction();
  const uploadReelAction = useUploadReelAction();
  const deleteReelAction = useDeleteReelAction();

  const images = useSignal<string[]>(galleryLoader.value?.images ?? []);
  const reels = useSignal<{ id: string; videoUrl: string; posterUrl: string; caption?: string }[]>(galleryLoader.value?.reels ?? []);
  const isUploading = useSignal(false);
  const lightboxUrl = useSignal<string | null>(null);
  const lightboxIdx = useSignal(0);
  const fileInputRef = useSignal<HTMLInputElement>();
  const confirmDeleteUrl = useSignal<string | null>(null);

  const activeTab = useSignal<"photos" | "reels">("photos");
  const isUploadingReel = useSignal(false);
  const reelVideoFile = useSignal<File | null>(null);
  const reelPosterFile = useSignal<File | null>(null);
  const reelCaption = useSignal("");
  const confirmDeleteReelId = useSignal<string | null>(null);
  const videoInputRef = useSignal<HTMLInputElement>();
  const posterInputRef = useSignal<HTMLInputElement>();

  const count = useComputed$(() => images.value.length);
  const reelsCount = useComputed$(() => reels.value.length);

  const handleFileChange = $(async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    isUploading.value = true;
    try {
      const filesArray = Array.from(input.files);
      let currentCount = images.value.length;
      let uploadedAny = false;

      for (const file of filesArray) {
        if (currentCount >= MAX_IMAGES) {
          alert(`Límite de ${MAX_IMAGES} imágenes alcanzado.`);
          break;
        }

        const compressed = await imageCompression(file, {
          maxWidthOrHeight: 1400,
          useWebWorker: true,
          fileType: "image/webp",
          initialQuality: 0.82,
        });

        const webpFile = new File([compressed], `gallery-${Date.now()}.webp`, {
          type: "image/webp",
        });

        const fd = new FormData();
        fd.append("image", webpFile);

        const result = await uploadAction.submit(fd);
        if ((result as any)?.value?.success) {
          currentCount++;
          uploadedAny = true;
        }
      }

      input.value = "";
      if (uploadedAny) {
        window.location.reload();
      }
    } catch (err) {
      console.error("Error al subir imágenes múltiples:", err);
      alert("Error al subir alguna de las imágenes seleccionadas.");
    } finally {
      isUploading.value = false;
    }
  });

  const handleVideoFileChange = $(async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      reelVideoFile.value = input.files[0];
    }
  });

  const handlePosterFileChange = $(async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      reelPosterFile.value = input.files[0];
    }
  });

  const handleUploadReelSubmit = $(async () => {
    if (!reelVideoFile.value || !reelPosterFile.value) {
      alert("Por favor, selecciona tanto el video como la imagen de preview.");
      return;
    }
    if (reels.value.length >= MAX_REELS) {
      alert(`Límite de ${MAX_REELS} Reels alcanzado.`);
      return;
    }
    isUploadingReel.value = true;
    try {
      const fd = new FormData();
      fd.append("video", reelVideoFile.value);
      fd.append("poster", reelPosterFile.value);
      fd.append("caption", reelCaption.value);

      const res = await uploadReelAction.submit(fd);
      if ((res as any)?.value?.success) {
        window.location.reload();
      } else {
        alert((res as any)?.value?.message || "Error al subir el Reel.");
      }
    } catch (err) {
      console.error(err);
      alert("Error inesperado al subir.");
    } finally {
      isUploadingReel.value = false;
    }
  });

  const handleDeleteReel = $(async (id: string) => {
    confirmDeleteReelId.value = null;
    reels.value = reels.value.filter((r) => r.id !== id);
    await deleteReelAction.submit({ id });
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
      {/* Tabs Switcher */}
      <div class="mb-6 flex gap-2 border-b border-slate-200 pb-px">
        <button
          type="button"
          onClick$={() => (activeTab.value = "photos")}
          class={[
            "px-5 py-3 text-sm font-black tracking-wider uppercase border-b-2 transition-all duration-200",
            activeTab.value === "photos"
              ? "border-emerald-500 text-emerald-600 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800",
          ]}
        >
          📷 Galería de Fotos ({count.value}/{MAX_IMAGES})
        </button>
        <button
          type="button"
          onClick$={() => (activeTab.value = "reels")}
          class={[
            "px-5 py-3 text-sm font-black tracking-wider uppercase border-b-2 transition-all duration-200",
            activeTab.value === "reels"
              ? "border-emerald-500 text-emerald-600 font-black"
              : "border-transparent text-slate-500 hover:text-slate-800",
          ]}
        >
          🎥 Reels / Videos Verticales ({reelsCount.value}/{MAX_REELS})
        </button>
      </div>

      {activeTab.value === "photos" ? (
        <>
          {/* Header */}
          <header class="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h1 class="text-3xl font-bold tracking-tight text-slate-800">
                Galería de Fotos
              </h1>
              <p class="mt-1 text-slate-500">
                Las fotos se mostrarán en la sección de instalaciones de la página principal.
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
                multiple
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
                Límite de {MAX_IMAGES} imágenes alcanzado. Elimina alguna para agregar más.
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
        </>
      ) : (
        <>
          {/* Reels & Videos Dashboard */}
          <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Form Column */}
            <div class="lg:col-span-4">
              <div class="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 class="mb-1 text-xl font-black text-slate-800">
                  Subir Nuevo Reel
                </h3>
                <p class="mb-6 text-sm text-slate-500">
                  Sube un video vertical y su respectiva captura de portada.
                </p>

                <form preventdefault:submit onSubmit$={handleUploadReelSubmit} class="space-y-5">
                  {/* Video Selector */}
                  <div>
                    <label class="mb-1.5 block text-xs font-black tracking-wider text-slate-700 uppercase">
                      Archivo de Video (.mp4 / .mov)
                    </label>
                    <div
                      class={[
                        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors",
                        reelVideoFile.value
                          ? "border-emerald-300 bg-emerald-50/30 text-emerald-800"
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-500",
                      ]}
                      onClick$={() => videoInputRef.value?.click()}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="mb-2"
                      >
                        <path d="M23 7a2 2 0 0 0-2.45-1.45L16 7V5a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2l4.55 1.45A2 2 0 0 0 23 17V7z" />
                      </svg>
                      <span class="text-xs font-bold block truncate max-w-xs">
                        {reelVideoFile.value ? reelVideoFile.value.name : "Seleccionar Video Vertical"}
                      </span>
                    </div>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      class="hidden"
                      onChange$={handleVideoFileChange}
                    />
                  </div>

                  {/* Poster Selector */}
                  <div>
                    <label class="mb-1.5 block text-xs font-black tracking-wider text-slate-700 uppercase">
                      Portada / Vista Previa (.jpg / .png)
                    </label>
                    <div
                      class={[
                        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors",
                        reelPosterFile.value
                          ? "border-emerald-300 bg-emerald-50/30 text-emerald-800"
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-slate-500",
                      ]}
                      onClick$={() => posterInputRef.value?.click()}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="mb-2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span class="text-xs font-bold block truncate max-w-xs">
                        {reelPosterFile.value ? reelPosterFile.value.name : "Seleccionar Imagen Portada"}
                      </span>
                    </div>
                    <input
                      ref={posterInputRef}
                      type="file"
                      accept="image/*"
                      class="hidden"
                      onChange$={handlePosterFileChange}
                    />
                  </div>

                  {/* Caption Input */}
                  <div>
                    <label class="mb-1.5 block text-xs font-black tracking-wider text-slate-700 uppercase">
                      Título o Descripción (Opcional)
                    </label>
                    <input
                      type="text"
                      bind:value={reelCaption}
                      placeholder="Ej: ¡Tremendo golazo en el entrenamiento!"
                      class="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isUploadingReel.value || reelsCount.value >= MAX_REELS}
                    class={[
                      "w-full rounded-2xl py-3.5 text-sm font-black tracking-wider uppercase transition-all flex items-center justify-center gap-2",
                      reelsCount.value >= MAX_REELS
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]",
                    ]}
                  >
                    {isUploadingReel.value ? (
                      <>
                        <svg
                          class="h-4 w-4 animate-spin text-white"
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
                        Subiendo Reel y Portada...
                      </>
                    ) : reelsCount.value >= MAX_REELS ? (
                      "Límite Alcanzado"
                    ) : (
                      "Subir Reel"
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* List Column */}
            <div class="lg:col-span-8">
              <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 class="mb-4 text-xl font-black text-slate-800">
                  Reels Activos ({reelsCount.value}/{MAX_REELS})
                </h3>

                {reels.value.length === 0 ? (
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
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    <p class="mb-2 text-lg font-bold">Sin Reels todavía</p>
                    <p class="text-sm">
                      Sube tu primer reel vertical para mostrarlo en la landing page.
                    </p>
                  </div>
                ) : (
                  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {reels.value.map((reel) => (
                      <div
                        key={reel.id}
                        class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm transition-all duration-200 hover:shadow-lg aspect-[9/16]"
                      >
                        {/* Video Element */}
                        <video
                          src={reel.videoUrl}
                          poster={reel.posterUrl}
                          preload="none"
                          controls
                          playsInline
                          muted
                          class="h-full w-full object-cover"
                        />

                        {/* Overlay with Delete button */}
                        <div class="absolute inset-0 bg-black/0 transition-all duration-200 group-hover:bg-black/40 flex flex-col justify-between p-4">
                          <div class="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick$={() => (confirmDeleteReelId.value = reel.id)}
                              class="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white transition-all hover:bg-red-600 active:scale-95"
                              title="Eliminar Reel"
                            >
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
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          </div>

                          <div class="text-white">
                            {reel.caption && (
                              <p class="text-xs font-black truncate max-w-full drop-shadow-md">
                                {reel.caption}
                              </p>
                            )}
                            <p class="text-[10px] text-white/70 block font-medium">
                              Video Vertical 9:16
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Lightbox for Photos ── */}
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

      {/* ── Delete Photo Confirm Dialog ── */}
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

      {/* ── Delete Reel Confirm Dialog ── */}
      {confirmDeleteReelId.value && (
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
              ¿Eliminar Reel?
            </h3>
            <p class="mb-6 text-sm text-slate-500">
              Esta acción no se puede deshacer y quitará el video de la landing page.
            </p>
            <div class="flex gap-3">
              <button
                type="button"
                onClick$={() => (confirmDeleteReelId.value = null)}
                class="flex-1 rounded-xl border border-slate-200 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick$={() => handleDeleteReel(confirmDeleteReelId.value!)}
                disabled={deleteReelAction.isRunning}
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
