import { component$, useSignal, $ } from "@builder.io/qwik";

type GallerySectionProps = {
  images: string[];
};

export const GallerySection = component$<GallerySectionProps>(({ images }) => {
  const lightboxUrl = useSignal<string | null>(null);
  const lightboxIdx = useSignal(0);

  const closeLightbox = $(() => {
    lightboxUrl.value = null;
  });

  const openLightbox = $((url: string) => {
    lightboxIdx.value = images.indexOf(url);
    lightboxUrl.value = url;
  });

  const prevLightbox = $(() => {
    const newIdx = (lightboxIdx.value - 1 + images.length) % images.length;
    lightboxIdx.value = newIdx;
    lightboxUrl.value = images[newIdx]!;
  });

  const nextLightbox = $(() => {
    const newIdx = (lightboxIdx.value + 1) % images.length;
    lightboxIdx.value = newIdx;
    lightboxUrl.value = images[newIdx]!;
  });

  if (images.length === 0) return null;

  return (
    <section id="galeria" class="relative z-20 bg-slate-950 py-24">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="mb-14 text-center">
          <h2 class="mb-4 text-4xl font-black uppercase tracking-tighter text-white md:text-5xl">
            Nuestras <span class="text-emerald-400">Instalaciones</span>
          </h2>
          <p class="mx-auto max-w-xl text-lg text-slate-400">
            Conocé cada rincón de GardenClubFutbol antes de tu próxima visita.
          </p>
        </div>

        <div class="columns-2 gap-3 space-y-3 sm:columns-3 lg:columns-4">
          {images.map((url, idx) => (
            <div
              key={url}
              class="group relative cursor-pointer break-inside-avoid overflow-hidden rounded-2xl"
              onClick$={() => openLightbox(url)}
            >
              <img
                src={url}
                alt={`Instalación ${idx + 1}`}
                width={400}
                height={400}
                class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div class="absolute inset-0 flex items-center justify-center bg-emerald-500/0 transition-all duration-300 group-hover:bg-emerald-500/10">
                <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {lightboxUrl.value && (
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/95" onClick$={closeLightbox}>
          <button
            type="button"
            onClick$={closeLightbox}
            class="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Cerrar"
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

          {images.length > 1 && (
            <button
              type="button"
              onClick$={(e) => {
                e.stopPropagation();
                prevLightbox();
              }}
              class="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
              aria-label="Anterior"
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
            class="max-h-[88vh] max-w-[92vw] select-none rounded-2xl object-contain shadow-2xl"
            onClick$={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <button
              type="button"
              onClick$={(e) => {
                e.stopPropagation();
                nextLightbox();
              }}
              class="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
              aria-label="Siguiente"
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

          <div class="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/70 backdrop-blur-sm tabular-nums">
            {lightboxIdx.value + 1} / {images.length}
          </div>
        </div>
      )}
    </section>
  );
});
