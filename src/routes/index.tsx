import { component$, useSignal, $, useTask$, useComputed$, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, Form, type DocumentHead, Link, server$, type RequestEventBase } from "@builder.io/qwik-city";
import { eq, and, gte, lt, inArray, desc } from "drizzle-orm";
import { getDB } from "../db";
import { pitches, bookings, instagramPosts } from "../db/schema";
import { useGuestBookingAction, useUserBookingAction, calculateDynamicPrice } from "./api/bookings/index";
import { Button, Modal, Alert } from "~/components/ui";
import { SocialFeed, MOCK_INSTAGRAM_POSTS } from "~/components/ui/social-feed";
import { Chatbot } from "~/components/chatbot/chatbot";
import { WhatsAppButton } from "~/components/ui/whatsapp-button";
import { siteSettings } from "../db/schema";
import logo from "~/media/GardenClubFutbol8.png";

export { useGuestBookingAction, useUserBookingAction };

export const usePitchesLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return await db.select().from(pitches).where(eq(pitches.isActive, true));
});

export const useUserLoader = routeLoader$((requestEvent) => {
  return requestEvent.sharedMap.get("user") as { userId: string; role: string } | undefined;
});

export const useInstagramFeed = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  try {
    const posts = await db.query.instagramPosts.findMany({
      orderBy: [desc(instagramPosts.timestamp)],
      limit: 6,
    });

    if (posts.length > 0) {
      return posts.map((p) => ({
        id: p.id,
        imageUrl: p.mediaUrl,
        link: p.permalink,
        caption: p.caption || undefined,
      }));
    }

    return MOCK_INSTAGRAM_POSTS;
  } catch (error) {
    console.error('Error cargando feed de instagram desde DB', error);
    return MOCK_INSTAGRAM_POSTS;
  }
});

export const useAISettingsLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return {
    ...settings,
    paymentMethods: (settings?.paymentMethods || []) as { id: string, name: string, isActive: boolean }[],
    extraServices: (settings?.extraServices || []) as any[],
    operatingHours: (settings?.operatingHours || []) as any[],
    services: (settings?.services || []) as string[],
  };
});

export const useGalleryLoader = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const [settings] = await db.select({ galleryImages: siteSettings.galleryImages }).from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return (settings?.galleryImages as string[] | null) ?? [];
});

export const getDailyBookings = server$(async function (this: RequestEventBase, pitchId: string, dateStr: string) {
  const db = getDB(this);
  if (!pitchId || !dateStr) return [];

  const startOfDay = new Date(`${dateStr}T00:00:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59`);

  const dailyBookings = await db.query.bookings.findMany({
    where: and(
      eq(bookings.pitchId, pitchId),
      gte(bookings.startTime, startOfDay),
      lt(bookings.startTime, endOfDay),
      inArray(bookings.status, ["CONFIRMED", "PENDING_APPROVAL", "COMPLETED"])
    ),
    columns: {
      startTime: true,
      endTime: true,
    },
    orderBy: (bookings, { asc }) => [asc(bookings.startTime)],
  });

  return dailyBookings.map(b => ({
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString()
  }));
});

export default component$(() => {
  const activePitches = usePitchesLoader();
  const user = useUserLoader();
  const instagramFeed = useInstagramFeed();
  const aiSettings = useAISettingsLoader();
  const gallery = useGalleryLoader();
  const guestAction = useGuestBookingAction();
  const userAction = useUserBookingAction();

  // Gallery lightbox
  const lightboxUrl = useSignal<string | null>(null);
  const lightboxIdx = useSignal(0);
  const closeLightbox = $(() => { lightboxUrl.value = null; });
  const openLightbox = $((url: string) => {
    lightboxIdx.value = gallery.value.indexOf(url);
    lightboxUrl.value = url;
  });
  const prevLightbox = $(() => {
    const imgs = gallery.value;
    const newIdx = (lightboxIdx.value - 1 + imgs.length) % imgs.length;
    lightboxIdx.value = newIdx;
    lightboxUrl.value = imgs[newIdx];
  });
  const nextLightbox = $(() => {
    const imgs = gallery.value;
    const newIdx = (lightboxIdx.value + 1) % imgs.length;
    lightboxIdx.value = newIdx;
    lightboxUrl.value = imgs[newIdx];
  });

  const isModalOpen = useSignal(false);
  const selectedPitchId = useSignal("");
  const activeSlide = useSignal(0);

  const slides = [
    {
      image: "/slider1.png",
      title: "La Cancha Es Tuya",
      subtitle: "Instalaciones premium y césped de última generación.",
    },
    {
      image: "/slider2.png",
      title: "Fútbol Profesional",
      subtitle: "Siente la verdadera pasión con el mejor equipamiento.",
    },
    {
      image: "/slider3.png",
      title: "Tercer Tiempo",
      subtitle: "Comparte con tus amigos después de cada partido.",
    }
  ];

  useVisibleTask$(() => {
    const interval = setInterval(() => {
      activeSlide.value = (activeSlide.value + 1) % slides.length;
    }, 5000);
    return () => clearInterval(interval);
  });

  // Form signals for availability checking
  const dateStr = useSignal("");
  const timeStr = useSignal("");
  const occupiedSlots = useSignal<{ startTime: string, endTime: string }[]>([]);
  const isCheckingAvailability = useSignal(false);

  const currentStep = useSignal(1);
  const selectedExtras = useSignal<{name: string, price: number}[]>([]);
  const paymentMethod = useSignal("CASH");
  const paymentOption = useSignal("LATER");

  const toggleExtra = $((extra: {name: string, price: number}) => {
    const exists = selectedExtras.value.find((e) => e.name === extra.name);
    if (exists) {
      selectedExtras.value = selectedExtras.value.filter((e) => e.name !== extra.name);
    } else {
      selectedExtras.value = [...selectedExtras.value, extra];
    }
  });

  const nextStep = $(() => {
    if (currentStep.value < 3) currentStep.value++;
  });
  const prevStep = $(() => {
    if (currentStep.value > 1) currentStep.value--;
  });

  // Keep track of selected pitch for calculation
  const selectedPitch = activePitches.value.find(p => p.id === selectedPitchId.value);
  const durationStr = useSignal("60");

  const openBookingModal = $((pitchId: string) => {
    selectedPitchId.value = pitchId;
    dateStr.value = "";
    timeStr.value = "";
    durationStr.value = "60";
    occupiedSlots.value = [];
    isModalOpen.value = true;
  });

  const closeBookingModal = $(() => {
    isModalOpen.value = false;
    selectedPitchId.value = "";
    dateStr.value = "";
    timeStr.value = "";
    durationStr.value = "60";
    currentStep.value = 1;
    selectedExtras.value = [];
  });

  useTask$(({ track }) => {
    const pitchId = track(() => selectedPitchId.value);
    const date = track(() => dateStr.value);

    if (pitchId && date) {
      isCheckingAvailability.value = true;
      getDailyBookings(pitchId, date).then((slots) => {
        occupiedSlots.value = slots;
        isCheckingAvailability.value = false;
      });
    } else {
      occupiedSlots.value = [];
    }
  });

  const isOverlapping = useComputed$(() => {
    if (!dateStr.value || !timeStr.value || !durationStr.value) return false;
    const start = new Date(`${dateStr.value}T${timeStr.value}:00`).getTime();
    const duration = parseInt(durationStr.value, 10);
    const end = start + duration * 60000;

    return occupiedSlots.value.some((slot) => {
      const slotStart = new Date(slot.startTime).getTime();
      const slotEnd = new Date(slot.endTime).getTime();
      return start < slotEnd && end > slotStart;
    });
  });

  const isSubmitDisabled = isOverlapping.value || isCheckingAvailability.value;

  const dynamicPrice = useComputed$(() => {
    if (!selectedPitch || !dateStr.value || !timeStr.value) return 0;
    const start = new Date(`${dateStr.value}T${timeStr.value}:00`);
    const durationMins = parseInt(durationStr.value, 10);

    return calculateDynamicPrice(
      start,
      durationMins,
      selectedPitch.pricePerHour,
      selectedPitch.peakHourStart,
      selectedPitch.peakPricePerHour
    );
  });

  const extrasTotal = useComputed$(() => {
    return selectedExtras.value.reduce((acc, extra) => acc + extra.price, 0);
  });

  const totalPrice = dynamicPrice.value + extrasTotal.value;
  const depositType = (selectedPitch as any)?.depositType ?? "PERCENTAGE";
  const depositAmount = (selectedPitch as any)?.depositAmount ?? 0;
  const senaAmount = selectedPitch
    ? depositType === "FIXED"
      ? depositAmount
      : (depositAmount / 100) * totalPrice
    : 0;
  const senaLabel = depositType === "FIXED" ? `$${depositAmount}` : `${depositAmount}%`;

  const timeOptions: string[] = [];
  for (let h = 8; h <= 23; h++) {
    timeOptions.push(`${h.toString().padStart(2, '0')}:00`);
    timeOptions.push(`${h.toString().padStart(2, '0')}:30`);
  }

  const isSlotDisabled = (time: string) => {
    if (!dateStr.value) return true;

    // Check if it's today and time has passed
    const today = new Date();
    const isToday = dateStr.value === today.toISOString().split('T')[0];
    if (isToday) {
      const [hours, minutes] = time.split(':').map(Number);
      const slotTime = new Date();
      slotTime.setHours(hours, minutes, 0, 0);
      if (slotTime <= today) {
        return true;
      }
    }

    const start = new Date(`${dateStr.value}T${time}:00`).getTime();
    const duration = parseInt(durationStr.value, 10);
    const end = start + duration * 60000;

    return occupiedSlots.value.some((slot) => {
      const slotStart = new Date(slot.startTime).getTime();
      const slotEnd = new Date(slot.endTime).getTime();
      return start < slotEnd && end > slotStart;
    });
  };

  const timeGridUI = (
    <div class="space-y-3">
      <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between">
        <span>Horario</span>
        {isCheckingAvailability.value && <span class="text-emerald-400 animate-pulse">Cargando...</span>}
      </label>

      {!dateStr.value ? (
        <div class="text-sm text-slate-500 font-medium p-4 bg-slate-800/50 rounded-xl border border-white/10 text-center">
          Selecciona una fecha primero.
        </div>
      ) : (
        <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {timeOptions.map((time) => {
            const disabled = isSlotDisabled(time) || isCheckingAvailability.value;
            const selected = timeStr.value === time;
            return (
              <button
                key={time}
                type="button"
                disabled={disabled}
                onClick$={() => timeStr.value = time}
                class={[
                  "py-2 px-1 text-sm font-bold rounded-lg border transition-all text-center",
                  disabled
                    ? "opacity-30 border-white/5 bg-slate-900 cursor-not-allowed text-slate-500 line-through"
                    : selected
                      ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
                      : "bg-slate-800 border-white/10 text-white hover:border-emerald-500/50 hover:bg-slate-700"
                ]}
              >
                {time}
              </button>
            );
          })}
        </div>
      )}
      {isOverlapping.value && timeStr.value && (
        <div class="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm font-bold flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          El horario seleccionado se superpone con una reserva existente.
        </div>
      )}
    </div>
  );

  return (
    <div class="min-h-screen bg-slate-950 text-white font-sans selection:bg-emerald-500 selection:text-white pb-20">

      {/* Navbar */}
      <nav class="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div class="mx-auto max-w-7xl px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" class="flex items-center gap-2 group py-2">
            <img src={logo} alt="GardenClubFutbol Logo" class="h-12 w-auto object-contain transition-transform group-hover:scale-105" />
            <div class="font-black text-2xl tracking-tighter uppercase hidden sm:block">
              Sport<span class="text-emerald-500">Garden</span>
            </div>
          </Link>
          <div class="hidden md:flex gap-8 items-center text-sm font-medium text-slate-300">
            <a href="#historia" class="hover:text-emerald-400 transition-colors">Historia</a>
            <a href="#canchas" class="hover:text-emerald-400 transition-colors">Canchas</a>
            {gallery.value.length > 0 && (
              <a href="#galeria" class="hover:text-emerald-400 transition-colors">Galería</a>
            )}
            <a href="#contacto" class="hover:text-emerald-400 transition-colors">Contacto</a>
            {user.value?.role === "ADMIN" && (
              <a href="/admin/calendar" class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white">Panel Admin</a>
            )}
            {user.value ? (
              <div class="flex items-center gap-4">
                <span class="text-emerald-400 font-bold">Hola!</span>
              </div>
            ) : (
              <Link href="/auth/login" class="hover:text-white transition-colors">
                Iniciar Sesión
              </Link>
            )}
            <a href="#canchas" class="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 rounded-full transition-all text-slate-950 font-black tracking-widest uppercase shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5">
              Reservar
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Slider Section */}
      <section class="relative h-screen min-h-[600px] overflow-hidden flex items-center justify-center">
        {slides.map((slide, index) => (
          <div
            key={index}
            class={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${activeSlide.value === index ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <div class="absolute inset-0 bg-slate-950/60 z-10 mix-blend-multiply"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-10"></div>
            <img src={slide.image} alt={slide.title} class="absolute inset-0 w-full h-full object-cover" />

            <div class="absolute inset-0 flex items-center justify-center z-20">
              <div class="text-center px-6 max-w-4xl mx-auto transform transition-transform duration-1000 delay-100 translate-y-0">
                {activeSlide.value === index && (
                  <div class="animate-fade-in-up">
                    <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6 ring-1 ring-emerald-500/30 backdrop-blur-sm">
                      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Abierto todos los días
                    </div>
                    <h1 class="text-5xl md:text-8xl font-black tracking-tighter uppercase mb-6 drop-shadow-2xl text-white">
                      {slide.title}
                    </h1>
                    <p class="mt-4 text-xl md:text-2xl text-slate-200 font-medium mb-10 drop-shadow-md max-w-2xl mx-auto">
                      {slide.subtitle}
                    </p>
                    <a href="#canchas" class="inline-block px-8 py-4 bg-emerald-500 hover:bg-emerald-400 rounded-full transition-all text-slate-950 font-black tracking-widest uppercase text-lg shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-1">
                      Reservar Ahora
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Slider Controls */}
        <div class="absolute bottom-10 inset-x-0 z-30 flex justify-center gap-3">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick$={() => activeSlide.value = index}
              class={`w-3 h-3 rounded-full transition-all ${activeSlide.value === index ? 'bg-emerald-500 w-8' : 'bg-white/50 hover:bg-white/80'}`}
              aria-label={`Ir a diapositiva ${index + 1}`}
            ></button>
          ))}
        </div>
      </section>

      {/* History Section */}
      <section id="historia" class="py-24 bg-slate-950 relative z-20">
        <div class="mx-auto max-w-7xl px-6 lg:px-8">
          <div class="grid lg:grid-cols-2 gap-16 items-center">
            <div class="space-y-8">
              <h2 class="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">Nuestra <span class="text-emerald-500">Historia</span></h2>
              <p class="text-lg text-slate-400 leading-relaxed">
                GardenClubFutbol nació con la visión de crear el espacio definitivo para los amantes del fútbol. Desde nuestros humildes comienzos, nos hemos dedicado a ofrecer canchas de primer nivel donde la pasión por el deporte se vive al máximo en cada partido.
              </p>
              <p class="text-lg text-slate-400 leading-relaxed">
                Creemos que el fútbol es más que un juego; es comunidad, amistad y esfuerzo. Por eso, nuestras instalaciones no solo cuentan con la mejor tecnología en césped artificial, sino que también ofrecen un ambiente inigualable para el tan esperado "tercer tiempo".
              </p>
              <div class="grid grid-cols-2 gap-6 pt-4 border-t border-white/10">
                <div>
                  <div class="text-4xl font-black text-emerald-500 mb-2">+10k</div>
                  <div class="text-sm font-bold text-slate-500 uppercase tracking-widest">Partidos Jugados</div>
                </div>
                <div>
                  <div class="text-4xl font-black text-emerald-500 mb-2">5</div>
                  <div class="text-sm font-bold text-slate-500 uppercase tracking-widest">Años de Pasión</div>
                </div>
              </div>
            </div>
            <div class="relative">
              <div class="aspect-square rounded-3xl overflow-hidden bg-slate-900 border border-white/10 relative z-10">
                <img src="/slider1.png" alt="GardenClubFutbol Historia" class="w-full h-full object-cover mix-blend-luminosity hover:mix-blend-normal transition-all duration-700" />
              </div>
              <div class="absolute -inset-4 bg-emerald-500/20 blur-3xl -z-10 rounded-full"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Pitches Grid */}
      <section id="canchas" class="mx-auto max-w-7xl px-6 lg:px-8 pt-10 pb-20 relative z-20">
        <div class="text-center mb-16">
          <h2 class="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white mb-4">Nuestras <span class="text-emerald-500">Canchas</span></h2>
          <p class="text-lg text-slate-400 max-w-2xl mx-auto">Selecciona tu cancha ideal, verifica la disponibilidad y reserva tu próximo partido.</p>
        </div>
        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {activePitches.value.length === 0 ? (
            <div class="col-span-full text-center text-slate-400 py-20 bg-slate-900/50 rounded-3xl border border-white/5 backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p class="text-xl font-medium">No hay canchas disponibles en este momento.</p>
            </div>
          ) : (
            activePitches.value.map((pitch) => (
              <div
                key={pitch.id}
                class="group flex flex-col overflow-hidden rounded-3xl bg-slate-900 border border-white/10 shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-emerald-900/20 hover:border-emerald-500/30"
              >
                <div class="relative h-56 bg-slate-800 flex items-center justify-center overflow-hidden">
                  {pitch.imageUrl && (
                    <img src={pitch.imageUrl} alt={pitch.name} class="absolute inset-0 w-full h-full object-cover z-0 group-hover:scale-105 transition-transform duration-700" />
                  )}

                  <div class={["absolute inset-0 z-10", pitch.imageUrl ? "bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" : "bg-gradient-to-t from-slate-900 via-transparent to-transparent"]}></div>

                  {!pitch.imageUrl && (
                    <>
                      <div class="absolute inset-x-0 bottom-0 h-1/2 border-t-2 border-white/10 w-full flex justify-center z-10">
                        <div class="w-24 h-12 border-2 border-b-0 border-white/10 rounded-t-full mt-auto"></div>
                      </div>
                      <span class="text-6xl font-black text-white/5 tracking-tighter group-hover:scale-110 transition-transform duration-500 z-10">{pitch.type}</span>
                    </>
                  )}

                  {pitch.isCovered && (
                    <span class="absolute top-4 right-4 z-20 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-bold text-emerald-400 backdrop-blur-md border border-white/10">
                      TECHADA
                    </span>
                  )}
                </div>

                <div class="flex flex-1 flex-col justify-between p-8">
                  <div>
                    <div class="flex items-center gap-3 mb-2">
                      <span class="px-2.5 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-300 uppercase tracking-wider">{pitch.type}</span>
                    </div>
                    <h3 class="text-2xl font-bold text-white mb-2">{pitch.name}</h3>
                    <p class="text-slate-400 leading-relaxed text-sm">
                      Superficie profesional {pitch.isCovered ? "techada" : "descubierta"}. Capacidad para {pitch.type.replace("F", "")} jugadores por lado.
                    </p>
                    {pitch.notes && (
                      <div class="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <p class="text-emerald-400 text-xs font-medium italic">
                          <span class="font-bold uppercase tracking-wider mr-1">Nota:</span>
                          {pitch.notes}
                        </p>
                      </div>
                    )}
                  </div>
                  <div class="mt-8 flex items-end justify-between border-t border-white/5 pt-6">
                    <div>
                      <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Precio x Hora</div>
                      <div class="text-2xl font-black text-white">${pitch.pricePerHour}</div>
                    </div>
                    <Button
                      onClick$={() => openBookingModal(pitch.id)}
                      look="primary"
                      class="bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-xl cursor-pointer"
                    >
                      RESERVAR
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Photo Gallery Section — only shown when there are images */}
      {gallery.value.length > 0 && (
        <section id="galeria" class="py-24 bg-slate-950 relative z-20">
          <div class="mx-auto max-w-7xl px-6 lg:px-8">
            <div class="text-center mb-14">
              <h2 class="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white mb-4">
                Nuestras <span class="text-emerald-500">Instalaciones</span>
              </h2>
              <p class="text-lg text-slate-400 max-w-xl mx-auto">
                Conocé cada rincón de GardenClubFutbol antes de tu próxima visita.
              </p>
            </div>

            {/* Masonry-style grid */}
            <div class="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
              {gallery.value.map((url, idx) => (
                <div
                  key={url}
                  class="break-inside-avoid rounded-2xl overflow-hidden cursor-pointer group relative"
                  onClick$={() => openLightbox(url)}
                >
                  <img
                    src={url}
                    alt={`Instalación ${idx + 1}`}
                    class="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  {/* Hover overlay */}
                  <div class="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-all duration-300 flex items-center justify-center">
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lightbox */}
          {lightboxUrl.value && (
            <div
              class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
              onClick$={closeLightbox}
            >
              {/* Close */}
              <button
                type="button"
                onClick$={closeLightbox}
                class="absolute top-5 right-5 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
                aria-label="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              {/* Prev */}
              {gallery.value.length > 1 && (
                <button
                  type="button"
                  onClick$={(e) => { e.stopPropagation(); prevLightbox(); }}
                  class="absolute left-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors z-10"
                  aria-label="Anterior"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
              )}

              <img
                src={lightboxUrl.value}
                alt="Vista ampliada"
                class="max-h-[88vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl select-none"
                onClick$={(e) => e.stopPropagation()}
              />

              {/* Next */}
              {gallery.value.length > 1 && (
                <button
                  type="button"
                  onClick$={(e) => { e.stopPropagation(); nextLightbox(); }}
                  class="absolute right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors z-10"
                  aria-label="Siguiente"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              )}

              {/* Counter */}
              <div class="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-white/70 text-sm font-medium tabular-nums">
                {lightboxIdx.value + 1} / {gallery.value.length}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Location Section */}
      <section id="contacto" class="py-24 bg-slate-950 relative z-20">
        <div class="mx-auto max-w-7xl px-6 lg:px-8">
          <div class="mb-12">
            <h2 class="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white mb-4">Donde <span class="text-emerald-500">estamos</span></h2>
          </div>

          <div class="grid lg:grid-cols-5 gap-8 items-start">
            {/* Map Column */}
            <div class="lg:col-span-3 aspect-[16/10] lg:aspect-auto lg:h-[600px] rounded-3xl overflow-hidden border border-white/10 bg-slate-900 shadow-2xl relative group">
              <iframe
                src={`https://www.google.com/maps?q=${encodeURIComponent(aiSettings.value?.clubAddress || "Pedro Moran 2379, CABA")}&output=embed&z=16`}
                class="w-full h-full group-hover:scale-[1.02] transition-all duration-700"
                loading="lazy"
                title="Mapa de ubicación"
              ></iframe>
              <div class="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-3xl"></div>
            </div>

            {/* Info Column */}
            <div class="lg:col-span-2 space-y-4">
              {/* Ubicación Card */}
              <div class="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div class="p-6">
                  <div class="flex items-center justify-between mb-4">
                    <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest">Ubicación</h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><path d="m18 15-6-6-6 6" /></svg>
                  </div>
                  <p class="text-white font-bold leading-relaxed">
                    {aiSettings.value?.clubAddress || "Pedro moran 2379. Capital Federal. Argentina"}
                  </p>
                </div>
              </div>

              {/* Horarios Card */}
              <div class="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div class="p-6">
                  <div class="flex items-center justify-between mb-6">
                    <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest">Horarios del Club</h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><path d="m18 15-6-6-6 6" /></svg>
                  </div>
                  <div class="space-y-4">
                    {(() => {
                      const hours = (aiSettings.value?.operatingHours as any[]) || [];
                      if (hours.length === 0) {
                        return (
                          <>
                            <div class="flex flex-col">
                              <span class="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Lunes a Viernes</span>
                              <span class="text-white font-bold">08:00 a 23:00</span>
                            </div>
                            <div class="flex flex-col">
                              <span class="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Sábados</span>
                              <span class="text-white font-bold">10:00 a 20:00</span>
                            </div>
                            <div class="flex flex-col">
                              <span class="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Domingos y Feriados</span>
                              <span class="text-white font-bold">15:00 a 21:00</span>
                            </div>
                          </>
                        );
                      }

                      // Group same hours
                      const groups: Record<string, string[]> = {};
                      const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

                      hours.forEach(h => {
                        const timeStr = h.isOpen ? `${h.openTime} a ${h.closeTime}` : "Cerrado";
                        if (!groups[timeStr]) groups[timeStr] = [];
                        groups[timeStr].push(dayNames[h.day]);
                      });

                      return Object.entries(groups).map(([time, days]) => (
                        <div key={time} class="flex flex-col">
                          <span class="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">{days.join(", ")}</span>
                          <span class={["text-white font-bold", time === "Cerrado" ? "text-red-400" : ""]}>{time}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Servicios Card */}
              <div class="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div class="p-6">
                  <div class="flex items-center justify-between mb-8">
                    <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest">Servicios del Club</h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><path d="m18 15-6-6-6 6" /></svg>
                  </div>

                  <div class="grid grid-cols-2 gap-y-6 gap-x-4">
                    {(() => {
                      const services = (aiSettings.value?.services as string[]) || [
                        "Wi-Fi", "Vestuario", "Ayuda Médica", "Torneos", "Colegios", "Bar / Restaurante", "Estacionamiento", "Cumpleaños"
                      ];

                      const iconMap: Record<string, any> = {
                        "wi-fi": <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" /></svg>,
                        "vestuario": <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" /></svg>,
                        "ayuda médica": <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>,
                        "torneos": <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>,
                        "colegios": <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 10-10-5L2 10l10 5 10-5z" /><path d="M6 12v5c3 3 9 3 12 0v5" /><path d="M11 10v4" /></svg>,
                        "bar": <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18l-2 9H5L3 3z" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /><path d="m9 3 1 9" /><path d="m15 3-1 9" /></svg>,
                        "estacionamiento": <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="10" rx="2" /><path d="M7 10V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6" /><circle cx="7" cy="15" r="1" /><circle cx="17" cy="15" r="1" /></svg>,
                        "cumpleaños": <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      };

                      return services.map(s => {
                        const lowS = s.toLowerCase();
                        let icon = <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;

                        Object.keys(iconMap).forEach(key => {
                          if (lowS.includes(key)) icon = iconMap[key];
                        });

                        return (
                          <div key={s} class="flex items-center gap-3 group/item">
                            <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 group-hover/item:bg-emerald-500 group-hover/item:text-slate-950 transition-colors">
                              {icon}
                            </div>
                            <span class="text-xs font-bold text-slate-300 group-hover/item:text-white transition-colors">{s}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Social Feed Section */}
      <SocialFeed posts={instagramFeed.value} />

      {/* Chatbot */}
      {aiSettings.value?.aiEnabled !== false && (
        <Chatbot avatarUrl={aiSettings.value?.aiAvatarUrl || undefined} />
      )}

      {/* WhatsApp Button */}
      <WhatsAppButton phone={aiSettings.value?.whatsappNumber || "5491112345678"} />

      {/* Booking Modal */}
      <Modal.Root bind:show={isModalOpen}>
        <Modal.Panel class="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-6">
            <Modal.Title class="text-2xl font-black tracking-tight text-white">Solicitar Reserva</Modal.Title>
            <Modal.Close class="text-slate-400 hover:text-white transition-colors p-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </Modal.Close>
          </div>

          <div>
            {(guestAction.value?.success || userAction.value?.success) ? (
              <div class="text-center py-8">
                <div class="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 class="text-2xl font-black text-white mb-2">¡Reserva Exitosa!</h3>
                <p class="text-slate-400 text-sm mb-8">
                  {guestAction.value?.success
                    ? "El club revisará tu pedido y lo confirmará en breve. (Estado: Pendiente)"
                    : "Tu reserva ha sido confirmada directamente. ¡Te esperamos!"}
                </p>
                <Button
                  onClick$={closeBookingModal}
                  look="secondary"
                  class="w-full py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider"
                >
                  Cerrar
                </Button>
              </div>
            ) : (
              <div>
                {/* Stepper Header */}
                <div class="flex items-center justify-between mb-8 relative px-4">
                  <div class="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-800 -z-10 rounded-full"></div>
                  <div class="absolute left-8 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 -z-10 transition-all duration-300 rounded-full" style={{ width: `calc(${(currentStep.value - 1) * 50}% - 2rem)` }}></div>

                  {[1, 2, 3].map((step) => (
                    <div key={step} class={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border-4 border-slate-900 transition-colors ${currentStep.value >= step ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>
                      {step}
                    </div>
                  ))}
                </div>

                <Form action={(user.value ? userAction : guestAction) as any} class="space-y-6">
                  <input type="hidden" name="pitchId" value={selectedPitchId.value} />
                  <input type="hidden" name="time" value={timeStr.value} />
                  {selectedExtras.value.map((ext) => (
                    <input key={ext.name} type="hidden" name="extras[]" value={JSON.stringify(ext)} />
                  ))}

                  {((userAction.value as any)?.message || (guestAction.value as any)?.message) && (
                    <Alert.Root look="alert" class="bg-red-500/10 border-red-500/20 text-red-400 rounded-xl">
                      <Alert.Description>{(userAction.value as any)?.message || (guestAction.value as any)?.message}</Alert.Description>
                    </Alert.Root>
                  )}

                  {/* Step 1: Horario */}
                  <div class={["space-y-6 animate-fade-in", currentStep.value !== 1 && "hidden"]}>
                    {selectedPitch && (
                      <div class="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex justify-between items-center">
                        <div>
                          <h4 class="text-white font-bold">{selectedPitch.name}</h4>
                          <span class="text-xs text-emerald-400 font-black tracking-widest uppercase">{selectedPitch.type}</span>
                        </div>
                        <div class="text-right">
                          <span class="block text-sm text-slate-400">Precio Base</span>
                          <span class="text-white font-bold">${selectedPitch.pricePerHour}/hr</span>
                        </div>
                      </div>
                    )}

                    {!user.value && (
                      <div class="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-4 text-sm leading-relaxed">
                        <strong class="font-black block mb-1">Atención Invitado:</strong>
                        Tu solicitud requerirá aprobación. Para confirmar al instante, <Link href="/auth/register" class="font-bold underline hover:text-amber-200">crea un usuario</Link>.
                      </div>
                    )}

                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <div class="flex justify-between items-center mb-2">
                          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest">Fecha</label>
                          <div class="flex gap-2">
                            <button
                              type="button"
                              onClick$={() => {
                                const today = new Date();
                                const yyyy = today.getFullYear();
                                const mm = String(today.getMonth() + 1).padStart(2, '0');
                                const dd = String(today.getDate()).padStart(2, '0');
                                dateStr.value = `${yyyy}-${mm}-${dd}`;
                              }}
                              class="text-[10px] font-black text-emerald-500 hover:text-emerald-400 px-2 py-0.5 border border-emerald-500/30 hover:border-emerald-500 rounded-md transition-all uppercase tracking-widest"
                            >
                              Hoy
                            </button>
                            <button
                              type="button"
                              onClick$={() => {
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                const yyyy = tomorrow.getFullYear();
                                const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
                                const dd = String(tomorrow.getDate()).padStart(2, '0');
                                dateStr.value = `${yyyy}-${mm}-${dd}`;
                              }}
                              class="text-[10px] font-black text-emerald-500 hover:text-emerald-400 px-2 py-0.5 border border-emerald-500/30 hover:border-emerald-500 rounded-md transition-all uppercase tracking-widest"
                            >
                              Mañana
                            </button>
                          </div>
                        </div>
                        <input type="date" name="date" required bind:value={dateStr} min={new Date().toISOString().split('T')[0]} class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-medium" />
                      </div>
                      <div>
                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Duración</label>
                        <select name="duration" required bind:value={durationStr} class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-medium appearance-none">
                          <option value="60">60 min (1h)</option>
                          <option value="90">90 min (1.5h)</option>
                          <option value="120">120 min (2h)</option>
                        </select>
                      </div>
                    </div>

                    {timeGridUI}

                    <div class="pt-4 border-t border-white/5">
                      <Button type="button" onClick$={nextStep} disabled={!timeStr.value || isSubmitDisabled} look="primary" class="w-full py-4 rounded-xl bg-emerald-500 text-slate-950 font-black uppercase tracking-wider hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20">
                        Siguiente Paso
                      </Button>
                    </div>
                  </div>

                  {/* Step 2: Contacto */}
                  <div class={["space-y-6 animate-fade-in", currentStep.value !== 2 && "hidden"]}>
                    <h4 class="text-lg font-black text-white text-center">Tus Datos</h4>

                    {!user.value ? (
                      <div class="space-y-4">
                        <div>
                          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nombre Completo *</label>
                          <input type="text" name="guestName" placeholder="Ej: Juan Pérez" required class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500" />
                        </div>
                        <div>
                          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Teléfono (WhatsApp) *</label>
                          <input type="tel" name="guestPhone" placeholder="+54 9 11 1234-5678" required class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500" />
                        </div>
                        <div>
                          <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Email (Opcional)</label>
                          <input type="email" name="guestEmail" placeholder="juan@ejemplo.com" class="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500" />
                        </div>
                      </div>
                    ) : (
                      <div class="bg-slate-800/50 p-6 rounded-xl border border-emerald-500/20 text-center">
                        <div class="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black">
                          U
                        </div>
                        <h5 class="text-white font-bold text-lg">Usuario Registrado</h5>
                        <p class="text-emerald-400 text-sm mt-1">Usaremos tu cuenta para la reserva</p>
                      </div>
                    )}

                    <div class="flex gap-4 pt-4 border-t border-white/5">
                      <Button type="button" onClick$={prevStep} look="secondary" class="flex-[1] py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider transition-colors">
                        Atrás
                      </Button>
                      <Button type="button" onClick$={nextStep} look="primary" class="flex-[2] py-4 rounded-xl bg-emerald-500 text-slate-950 font-black uppercase tracking-wider hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
                        Siguiente Paso
                      </Button>
                    </div>
                  </div>

                  {/* Step 3: Extras y Pago */}
                  <div class={["space-y-6 animate-fade-in", currentStep.value !== 3 && "hidden"]}>
                    <div>
                      <h4 class="text-lg font-black text-white mb-4">Servicios Adicionales (Opcional)</h4>
                      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {((aiSettings.value?.extraServices as any[]) || []).map((extra) => {
                          const isSelected = selectedExtras.value.some(e => e.name === extra.name);
                          return (
                            <button
                              key={extra.name}
                              type="button"
                              onClick$={() => toggleExtra({ name: extra.name, price: Number(extra.price) })}
                              class={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${isSelected ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-slate-800 border-white/10 text-slate-400 hover:border-emerald-500/50 hover:bg-slate-800/80'}`}
                            >
                              <span class="text-2xl">{extra.icon}</span>
                              <div class="text-center">
                                <div class="text-[10px] font-bold uppercase leading-tight text-white mb-1">{extra.name}</div>
                                <div class="text-xs font-black text-emerald-500">+${extra.price}</div>
                              </div>
                            </button>
                          );
                        })}
                        {((aiSettings.value?.extraServices as any[]) || []).length === 0 && (
                          <div class="col-span-full text-center text-slate-500 text-sm py-4 border border-dashed border-white/10 rounded-xl">
                            No hay servicios adicionales configurados.
                          </div>
                        )}
                      </div>
                    </div>

                    <div class="bg-slate-800/50 rounded-xl p-4 border border-emerald-500/20 mt-6">
                      <div class="space-y-2 mb-4 pb-4 border-b border-white/5">
                        <div class="flex justify-between items-center">
                          <span class="text-sm text-slate-400">Precio de la Cancha:</span>
                          <span class="text-sm font-medium text-white">${dynamicPrice.value}</span>
                        </div>
                        {extrasTotal.value > 0 && (
                          <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-400">Servicios Adicionales:</span>
                            <span class="text-sm font-medium text-white">${extrasTotal.value}</span>
                          </div>
                        )}
                        <div class="flex justify-between items-center pt-2 border-t border-white/5">
                          <span class="text-sm font-bold text-emerald-400">Total general:</span>
                          <span class="text-2xl font-black text-white">${totalPrice}</span>
                        </div>
                      </div>

                      <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Método de Pago</label>
                      <div class="flex flex-wrap gap-2 mb-6">
                        {(aiSettings.value?.paymentMethods || [])
                          .filter((pm: any) => pm.isActive)
                          .map((pm: any) => (
                            <label key={pm.id} class="flex-1 min-w-[120px] text-center p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                              <input type="radio" name="paymentMethod" value={pm.id} bind:value={paymentMethod} class="hidden" />
                              <span class="text-sm font-bold text-white">{pm.name}</span>
                            </label>
                          ))
                        }
                        {(aiSettings.value?.paymentMethods || []).filter((pm: any) => pm.isActive).length === 0 && (
                          <>
                            <label class="flex-1 text-center p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                              <input type="radio" name="paymentMethod" value="CASH" bind:value={paymentMethod} class="hidden" />
                              <span class="text-sm font-bold text-white">Efectivo</span>
                            </label>
                            <label class="flex-1 text-center p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                              <input type="radio" name="paymentMethod" value="TRANSFER" bind:value={paymentMethod} class="hidden" />
                              <span class="text-sm font-bold text-white">Transferencia</span>
                            </label>
                          </>
                        )}
                      </div>

                      {paymentMethod.value === "TRANSFER" && (
                        <div class="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          <p class="text-sm text-emerald-100 mb-2">Para confirmar tu reserva, envía la transferencia al siguiente alias:</p>
                          <div class="text-lg font-black text-emerald-400 mb-3 bg-slate-900/50 p-2 rounded text-center select-all">
                            {aiSettings.value?.bankAlias || "No configurado"}
                          </div>
                          <p class="text-xs text-emerald-200/70">
                            Por favor, envía el comprobante por WhatsApp al: <br/>
                            <a href={`https://wa.me/${aiSettings.value?.whatsappNumber?.replace(/[^0-9]/g, '')}`} target="_blank" class="font-bold text-emerald-400 hover:underline">
                              {aiSettings.value?.whatsappNumber || "No configurado"}
                            </a>
                          </p>
                        </div>
                      )}

                      <label class="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Modalidad de Pago</label>
                      <div class="space-y-2">
                        {paymentMethod.value === "CASH" && (
                          <label class="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                            <input type="radio" name="paymentOption" value="LATER" bind:value={paymentOption} class="text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/20" />
                            <span class="text-sm font-medium text-white flex-1">Abonar en el club</span>
                          </label>
                        )}
                        <label class="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                          <input type="radio" name="paymentOption" value="SENA" bind:value={paymentOption} class="text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/20" />
                          <div class="flex-1">
                            <span class="text-sm font-medium text-white block">Abonar Seña ({senaLabel})</span>
                            <span class="text-xs text-slate-400">Pagas hoy: ${senaAmount}</span>
                          </div>
                        </label>
                        <label class="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-slate-800 cursor-pointer transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                          <input type="radio" name="paymentOption" value="TOTAL" bind:value={paymentOption} class="text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-white/20" />
                          <div class="flex-1">
                            <span class="text-sm font-medium text-white block">Abonar Total</span>
                            <span class="text-xs text-slate-400">Pagas hoy: ${totalPrice}</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div class="flex gap-4 pt-4 border-t border-white/5">
                      <Button type="button" onClick$={prevStep} look="secondary" class="flex-[1] py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-wider transition-colors">
                        Atrás
                      </Button>
                      <Button type="submit" disabled={userAction.isRunning || guestAction.isRunning} look="primary" class="flex-[2] py-4 rounded-xl bg-emerald-500 text-slate-950 font-black uppercase tracking-wider hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20">
                        {(userAction.isRunning || guestAction.isRunning) ? "Procesando..." : "Confirmar Reserva"}
                      </Button>
                    </div>
                  </div>
                </Form>
              </div>
            )}
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Footer */}
      <footer class="bg-slate-950 py-12 border-t border-white/10 relative z-20">
        <div class="mx-auto max-w-7xl px-6 lg:px-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <div class="font-black text-2xl tracking-tighter text-white uppercase">
              Sport<span class="text-emerald-500">Garden</span>
            </div>
            <p class="text-slate-500 mt-2 text-sm">Las mejores canchas, el mejor tercer tiempo.</p>
          </div>
          <div class="flex gap-6">
            <a href="#inicio" class="text-sm font-bold text-slate-400 hover:text-emerald-400 uppercase tracking-widest transition-colors">Inicio</a>
            <a href="#historia" class="text-sm font-bold text-slate-400 hover:text-emerald-400 uppercase tracking-widest transition-colors">Historia</a>
            <a href="#canchas" class="text-sm font-bold text-slate-400 hover:text-emerald-400 uppercase tracking-widest transition-colors">Canchas</a>
          </div>
          <p class="text-slate-600 text-xs mt-4 md:mt-0">
            © {new Date().getFullYear()} GardenClubFutbol. Todos los derechos reservados.
          </p>
        </div>
      </footer>

    </div>
  );
});

export const head: DocumentHead = {
  title: "GardenClubFutbol - El Mejor Fútbol",
  meta: [
    {
      name: "description",
      content: "Alquiler de canchas de fútbol premium. Reserva tu turno online en GardenClubFutbol.",
    },
  ],
};
