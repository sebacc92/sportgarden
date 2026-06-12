import { component$, useStore, $, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  zod$,
  z,
  Form,
} from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { siteSettings } from "~/db/schema";
import { Button } from "~/components/ui";
import { LuSave, LuGlobe, LuImage, LuTrash2 } from "@qwikest/icons/lucide";
import { put } from "@vercel/blob";
import imageCompression from "browser-image-compression";

export const useSiteContentSettings = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const { data, error } = await db
    .from(siteSettings)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  let settings = camelize<any>(data);

  if (!settings) {
    // create default if doesn't exist
    const { data: insData, error: insError } = await db
      .from(siteSettings)
      .insert({
        id: 1,
        club_name: "GardenClubFutbol",
      })
      .select()
      .maybeSingle();

    if (insError) throw insError;
    settings = camelize<any>(insData);
  }

  return settings;
});

export const useSaveWebContentAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const landingTexts = JSON.parse(data.landingTexts as string);
    const heroSlides = JSON.parse(data.heroSlides as string);
    const promoPopup = JSON.parse(data.promoPopup as string);

    const token = requestEvent.env.get("BLOB_READ_WRITE_TOKEN");

    // Upload Slide 0
    if (
      data.slideImage0 &&
      typeof data.slideImage0 === "object" &&
      (data.slideImage0 as Blob).size > 0
    ) {
      const file = data.slideImage0 as File;
      const fileName = `slide-0-${Date.now()}.webp`;
      const { url } = await put(fileName, file, {
        access: "public",
        token,
      });
      if (heroSlides[0]) heroSlides[0].image = url;
    }

    // Upload Slide 1
    if (
      data.slideImage1 &&
      typeof data.slideImage1 === "object" &&
      (data.slideImage1 as Blob).size > 0
    ) {
      const file = data.slideImage1 as File;
      const fileName = `slide-1-${Date.now()}.webp`;
      const { url } = await put(fileName, file, {
        access: "public",
        token,
      });
      if (heroSlides[1]) heroSlides[1].image = url;
    }

    // Upload Slide 2
    if (
      data.slideImage2 &&
      typeof data.slideImage2 === "object" &&
      (data.slideImage2 as Blob).size > 0
    ) {
      const file = data.slideImage2 as File;
      const fileName = `slide-2-${Date.now()}.webp`;
      const { url } = await put(fileName, file, {
        access: "public",
        token,
      });
      if (heroSlides[2]) heroSlides[2].image = url;
    }

    // Upload Popup Image
    if (
      data.popupImage &&
      typeof data.popupImage === "object" &&
      (data.popupImage as Blob).size > 0
    ) {
      const file = data.popupImage as File;
      const fileName = `popup-${Date.now()}.webp`;
      const { url } = await put(fileName, file, {
        access: "public",
        token,
      });
      promoPopup.imageUrl = url;
    }

    const { error: updErr } = await db
      .from(siteSettings)
      .update({
        landing_texts: landingTexts,
        hero_slides: heroSlides,
        promo_popup: promoPopup,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (updErr) throw updErr;

    return { success: true };
  },
  zod$({
    landingTexts: z.string(), // JSON string
    heroSlides: z.string(), // JSON string
    promoPopup: z.string(), // JSON string
    slideImage0: z.any().optional(),
    slideImage1: z.any().optional(),
    slideImage2: z.any().optional(),
    popupImage: z.any().optional(),
  }),
);

export default component$(() => {
  const settingsLoader = useSiteContentSettings();
  const saveAction = useSaveWebContentAction();

  const settings = settingsLoader.value;

  // FALLBACK DEFAULTS
  const defaultLandingTexts = {
    historyTitle: "Nuestra Historia",
    historySubtitle: "Historia",
    historyText1: "GardenClubFutbol nació con la visión de crear el espacio definitivo para los amantes del fútbol. Desde nuestros humildes comienzos, nos hemos dedicado a ofrecer canchas de primer nivel donde la pasión por el deporte se vive al máximo en cada partido.",
    historyText2: "Creemos que el fútbol es más que un juego; es comunidad, amistad y esfuerzo. Por eso, nuestras instalaciones no solo cuentan con la mejor tecnología en césped artificial, sino que también ofrecen un ambiente familiar, cantina para el tercer tiempo y estacionamiento privado.",
  };

  const defaultHeroSlides = [
    {
      image: "/slider1.png",
      title: "La Cancha Es Tuya",
      subtitle: "Instalaciones premium y césped de última generación.",
      badgeText: "Abierto todos los días",
    },
    {
      image: "/slider2.png",
      title: "Fútbol Profesional",
      subtitle: "Siente la verdadera pasión con el mejor equipamiento.",
      badgeText: "Abierto todos los días",
    },
    {
      image: "/slider3.png",
      title: "Tercer Tiempo",
      subtitle: "Comparte con tus amigos después de cada partido.",
      badgeText: "Abierto todos los días",
    },
  ];

  const defaultPromoPopup = {
    isActive: false,
    imageUrl: "",
    title: "¡Promo Especial!",
    description: "¡Reservá tu cancha y disfrutá de un gran partido!",
    buttonText: "Reservar Ahora",
    buttonLink: "#canchas",
  };

  const landingTextsState = {
    ...defaultLandingTexts,
    ...(settings?.landingTexts as any || {}),
  };

  const heroSlidesState = Array.isArray(settings?.heroSlides) && settings.heroSlides.length > 0
    ? settings.heroSlides
    : defaultHeroSlides;

  const promoPopupState = {
    ...defaultPromoPopup,
    ...(settings?.promoPopup as any || {}),
  };

  const store = useStore(
    {
      landingTexts: landingTextsState,
      heroSlides: heroSlidesState as { image: string; title: string; subtitle: string; badgeText: string }[],
      promoPopup: promoPopupState,
    },
    { deep: true },
  );

  const previews = useStore({
    slide0: heroSlidesState[0]?.image || "",
    slide1: heroSlidesState[1]?.image || "",
    slide2: heroSlidesState[2]?.image || "",
    popup: promoPopupState.imageUrl || "",
  });

  const isCompressing = useStore({
    slide0: false,
    slide1: false,
    slide2: false,
    popup: false,
  });

  const handleFileChange = $(async (event: Event, element: HTMLInputElement) => {
    const input = element;
    const key = input.getAttribute("data-key") as "slide0" | "slide1" | "slide2" | "popup";
    if (!key) return;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      try {
        isCompressing[key] = true;
        const options = {
          maxSizeMB: 0.6,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          fileType: "image/webp" as string,
        };
        const compressedFile = await imageCompression(file, options);
        previews[key] = URL.createObjectURL(compressedFile);

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
        isCompressing[key] = false;
      }
    }
  });

  const activeTab = useSignal("hero"); // hero, textos, popup

  return (
    <div class="h-full overflow-auto bg-slate-50 p-8 font-sans">
      <Form action={saveAction} class="space-y-8 max-w-6xl mx-auto" enctype="multipart/form-data">
        <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="text-3xl font-black tracking-tight text-slate-800 uppercase flex items-center gap-2">
              <LuGlobe class="h-8 w-8 text-emerald-600 animate-spin-slow" />
              Contenido Web
            </h1>
            <p class="mt-1 font-medium text-slate-500">
              Personaliza los textos principales, el carrusel y las promociones de la web pública.
            </p>
          </div>
          <Button
            type="submit"
            look="primary"
            disabled={saveAction.isRunning}
            class="flex items-center gap-3 rounded-2xl px-10 py-4 font-black tracking-widest uppercase shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
          >
            {saveAction.isRunning ? (
              <svg
                class="h-5 w-5 animate-spin"
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <>
                <LuSave class="h-5 w-5" />
                Guardar Cambios
              </>
            )}
          </Button>
        </header>

        {saveAction.value?.success && (
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800 shadow-sm animate-fade-in">
            🎉 ¡Contenido web actualizado y publicado con éxito en la landing page!
          </div>
        )}

        {/* Hidden inputs to serialize state */}
        <input
          type="hidden"
          name="landingTexts"
          value={JSON.stringify(store.landingTexts)}
        />
        <input
          type="hidden"
          name="heroSlides"
          value={JSON.stringify(store.heroSlides)}
        />
        <input
          type="hidden"
          name="promoPopup"
          value={JSON.stringify(store.promoPopup)}
        />

        {/* Tabs navigation */}
        <div class="flex border-b border-slate-200 gap-2 mb-6">
          <button
            type="button"
            onClick$={() => (activeTab.value = "hero")}
            class={[
              "px-6 py-3 font-bold text-sm uppercase tracking-wider transition-all border-b-2",
              activeTab.value === "hero"
                ? "border-emerald-500 text-emerald-600 bg-emerald-50/40 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            ]}
          >
            Carrusel (Hero Slider)
          </button>
          <button
            type="button"
            onClick$={() => (activeTab.value = "textos")}
            class={[
              "px-6 py-3 font-bold text-sm uppercase tracking-wider transition-all border-b-2",
              activeTab.value === "textos"
                ? "border-emerald-500 text-emerald-600 bg-emerald-50/40 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            ]}
          >
            Textos de Secciones
          </button>
          <button
            type="button"
            onClick$={() => (activeTab.value = "popup")}
            class={[
              "px-6 py-3 font-bold text-sm uppercase tracking-wider transition-all border-b-2",
              activeTab.value === "popup"
                ? "border-emerald-500 text-emerald-600 bg-emerald-50/40 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            ]}
          >
            Popup Promocional
          </button>
        </div>

        {/* Tab 1: Hero Carousel */}
        {activeTab.value === "hero" && (
          <div class="space-y-6">
            <div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 class="text-xl font-black text-slate-800 uppercase mb-6 flex items-center gap-2">
                <LuImage class="h-6 w-6 text-emerald-600" />
                Diapositivas del Banner Principal
              </h2>

              <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                {store.heroSlides.map((slide, index) => {
                  const key = `slide${index}` as "slide0" | "slide1" | "slide2";
                  const currentPreview = previews[key];
                  return (
                    <div
                      key={index}
                      class="p-6 rounded-2xl border border-slate-200 bg-slate-50 space-y-4 hover:border-emerald-200 transition-all shadow-sm"
                    >
                      <div class="flex items-center justify-between border-b border-slate-200 pb-3">
                        <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-600 text-xs font-black text-white">
                          {index + 1}
                        </span>
                        <span class="text-xs font-bold text-slate-400 uppercase">Slide {index + 1}</span>
                      </div>

                      {/* File Upload with Preview */}
                      <div>
                        <label class="block text-xs font-black text-slate-700 uppercase mb-2">
                          Imagen de Fondo
                        </label>
                        <div class="group relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white transition-colors hover:border-emerald-400 hover:bg-slate-50">
                          {currentPreview ? (
                            <>
                              <img
                                src={currentPreview}
                                alt={`Slide ${index + 1}`}
                                class="h-full w-full object-cover pointer-events-none"
                              />
                              <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <span class="text-white text-xs font-black uppercase tracking-widest">Cambiar Imagen</span>
                              </div>
                            </>
                          ) : (
                            <div class="flex flex-col items-center text-slate-400 text-center p-4 pointer-events-none">
                              <LuImage class="h-8 w-8 text-slate-400 mb-2" />
                              <span class="text-[10px] font-black tracking-widest text-slate-500 uppercase">Subir Foto</span>
                            </div>
                          )}
                          {isCompressing[key] && (
                            <div class="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm pointer-events-none">
                              <div class="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500"></div>
                              <span class="mt-2 text-[9px] font-bold tracking-widest text-slate-600 uppercase">Optimizando...</span>
                            </div>
                          )}
                          <input
                            type="file"
                            name={`slideImage${index}`}
                            accept="image/*"
                            data-key={key}
                            onChange$={handleFileChange}
                            class="absolute inset-0 h-full w-full cursor-pointer opacity-0 z-10"
                            disabled={isCompressing[key]}
                          />
                        </div>
                      </div>

                      <div class="space-y-4">
                        <div>
                          <label class="block text-xs font-black text-slate-700 uppercase mb-1">
                            Título de Diapositiva
                          </label>
                          <input
                            type="text"
                            value={slide.title}
                            onInput$={(e) => (store.heroSlides[index].title = (e.target as HTMLInputElement).value)}
                            class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            placeholder="Ej: La Cancha Es Tuya"
                          />
                        </div>

                        <div>
                          <label class="block text-xs font-black text-slate-700 uppercase mb-1">
                            Subtítulo
                          </label>
                          <input
                            type="text"
                            value={slide.subtitle}
                            onInput$={(e) => (store.heroSlides[index].subtitle = (e.target as HTMLInputElement).value)}
                            class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            placeholder="Instalaciones premium..."
                          />
                        </div>

                        <div>
                          <label class="block text-xs font-black text-slate-700 uppercase mb-1">
                            Texto del Badge Superior
                          </label>
                          <input
                            type="text"
                            value={slide.badgeText || "Abierto todos los días"}
                            onInput$={(e) => (store.heroSlides[index].badgeText = (e.target as HTMLInputElement).value)}
                            class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            placeholder="Ej: Abierto todos los días"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Section Texts */}
        {activeTab.value === "textos" && (
          <div class="space-y-6">
            <div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
              <h2 class="text-xl font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                <LuGlobe class="h-6 w-6 text-emerald-600" />
                Textos de la Sección "Nuestra Historia"
              </h2>

              <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label class="block text-sm font-black text-slate-700 uppercase mb-2">
                    Título de la Sección
                  </label>
                  <input
                    type="text"
                    value={store.landingTexts.historyTitle}
                    onInput$={(e) => (store.landingTexts.historyTitle = (e.target as HTMLInputElement).value)}
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Nuestra Historia"
                  />
                </div>

                <div>
                  <label class="block text-sm font-black text-slate-700 uppercase mb-2">
                    Palabra Resaltada (Verde)
                  </label>
                  <input
                    type="text"
                    value={store.landingTexts.historySubtitle}
                    onInput$={(e) => (store.landingTexts.historySubtitle = (e.target as HTMLInputElement).value)}
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Historia"
                  />
                </div>
              </div>

              <div class="space-y-6">
                <div>
                  <label class="block text-sm font-black text-slate-700 uppercase mb-2">
                    Primer Párrafo
                  </label>
                  <textarea
                    rows={4}
                    value={store.landingTexts.historyText1}
                    onInput$={(e) => (store.landingTexts.historyText1 = (e.target as HTMLTextAreaElement).value)}
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="GardenClubFutbol nació con la visión..."
                  />
                </div>

                <div>
                  <label class="block text-sm font-black text-slate-700 uppercase mb-2">
                    Segundo Párrafo
                  </label>
                  <textarea
                    rows={4}
                    value={store.landingTexts.historyText2}
                    onInput$={(e) => (store.landingTexts.historyText2 = (e.target as HTMLTextAreaElement).value)}
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Creemos que el fútbol es más que un juego..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Promotional Popup */}
        {activeTab.value === "popup" && (
          <div class="space-y-6">
            <div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
              <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 class="text-xl font-black text-slate-800 uppercase flex items-center gap-2">
                  <LuGlobe class="h-6 w-6 text-emerald-600" />
                  Popup Promocional
                </h2>
                <div class="flex items-center gap-3">
                  <span class="text-sm font-bold text-slate-600">¿Habilitar Popup?</span>
                  <input
                    type="checkbox"
                    checked={store.promoPopup.isActive}
                    onChange$={() => (store.promoPopup.isActive = !store.promoPopup.isActive)}
                    class="h-6 w-6 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div class="space-y-4">
                  {/* File Upload for Promo Popup with Preview */}
                  <div>
                    <label class="block text-sm font-black text-slate-700 uppercase mb-2">
                      Imagen Promocional
                    </label>
                    <div class="group relative flex h-48 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-emerald-400 hover:bg-slate-100">
                      {previews.popup ? (
                        <>
                          <img
                            src={previews.popup}
                            alt="Promo Popup Preview"
                            class="h-full w-full object-cover pointer-events-none"
                          />
                          <button
                            type="button"
                            onClick$={() => {
                              previews.popup = "";
                              store.promoPopup.imageUrl = "";
                            }}
                            class="absolute top-2 right-2 h-8 w-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow hover:bg-red-700 transition-colors z-20"
                            title="Eliminar imagen"
                          >
                            <LuTrash2 class="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div class="flex flex-col items-center text-slate-400 text-center p-4 pointer-events-none">
                          <LuImage class="h-10 w-10 text-slate-400 mb-2" />
                          <span class="text-xs font-black tracking-widest text-slate-500 uppercase">Subir Foto Promocional</span>
                        </div>
                      )}
                      {isCompressing.popup && (
                        <div class="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm pointer-events-none">
                          <div class="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500"></div>
                          <span class="mt-2 text-xs font-bold tracking-widest text-slate-600 uppercase">Optimizando...</span>
                        </div>
                      )}
                      <input
                        type="file"
                        name="popupImage"
                        accept="image/*"
                        data-key="popup"
                        onChange$={handleFileChange}
                        class="absolute inset-0 h-full w-full cursor-pointer opacity-0 z-10"
                        disabled={isCompressing.popup}
                      />
                    </div>
                  </div>

                  <div>
                    <label class="block text-sm font-black text-slate-700 uppercase mb-1">
                      Título de la Promo
                    </label>
                    <input
                      type="text"
                      value={store.promoPopup.title}
                      onInput$={(e) => (store.promoPopup.title = (e.target as HTMLInputElement).value)}
                      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      placeholder="Ej: ¡Torneo Relámpago!"
                    />
                  </div>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-black text-slate-700 uppercase mb-1">
                      Descripción de la Promo
                    </label>
                    <textarea
                      rows={4}
                      value={store.promoPopup.description}
                      onInput$={(e) => (store.promoPopup.description = (e.target as HTMLTextAreaElement).value)}
                      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      placeholder="Inscribite ya al próximo torneo..."
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-black text-slate-700 uppercase mb-1">
                        Texto del Botón
                      </label>
                      <input
                        type="text"
                        value={store.promoPopup.buttonText}
                        onInput$={(e) => (store.promoPopup.buttonText = (e.target as HTMLInputElement).value)}
                        class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="Ej: Inscribirme"
                      />
                    </div>

                    <div>
                      <label class="block text-sm font-black text-slate-700 uppercase mb-1">
                        Enlace del Botón
                      </label>
                      <input
                        type="text"
                        value={store.promoPopup.buttonLink}
                        onInput$={(e) => (store.promoPopup.buttonLink = (e.target as HTMLInputElement).value)}
                        class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="Ej: #canchas o URL"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Popup Live Preview */}
              <div class="border-t border-slate-100 pt-6">
                <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Vista Previa</h3>
                <div class="flex justify-center p-6 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200">
                  <div class="w-full max-w-md bg-[#001407] rounded-3xl overflow-hidden shadow-2xl border border-emerald-500/20 flex flex-col">
                    {previews.popup && (
                      <div class="relative h-48 bg-slate-900">
                        <img
                          src={previews.popup}
                          alt="Promo Preview"
                          class="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div class="p-6 text-center space-y-4">
                      <h4 class="text-xl font-black text-white uppercase">{store.promoPopup.title || "Sin título"}</h4>
                      <p class="text-sm text-slate-300">{store.promoPopup.description || "Sin descripción"}</p>
                      <a
                        href={store.promoPopup.buttonLink || "#"}
                        preventdefault:click
                        class="inline-block w-full bg-[#F5F2EB] hover:bg-[#EAE6DB] text-slate-950 font-black tracking-widest uppercase rounded-2xl py-3 shadow-md transition-colors text-xs"
                      >
                        {store.promoPopup.buttonText || "Acción"}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Form>
    </div>
  );
});

export const head = {
  title: "Contenido Web - Admin",
};
