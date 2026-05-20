import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { LuX } from "@qwikest/icons/lucide";

export interface PromoPopupProps {
  popup?: {
    isActive: boolean;
    imageUrl: string;
    title: string;
    description: string;
    buttonText: string;
    buttonLink: string;
  } | null;
}

export const PromoPopup = component$((props: PromoPopupProps) => {
  const popup = props.popup;
  const isVisible = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (!popup || !popup.isActive) return;

    // Check if user has already closed/seen the popup in this session
    const hasSeen = sessionStorage.getItem("sg_seen_promo");
    if (hasSeen === "true") return;

    // Open popup with a nice premium delay
    const timer = setTimeout(() => {
      isVisible.value = true;
    }, 1500);

    return () => clearTimeout(timer);
  });

  const closePopup = $(() => {
    isVisible.value = false;
    sessionStorage.setItem("sg_seen_promo", "true");
  });

  if (!popup || !popup.isActive || !isVisible.value) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div class="relative w-full max-w-lg bg-[#001407]/95 rounded-[2.5rem] overflow-hidden border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col animate-scale-up">
        
        {/* Close Button */}
        <button
          onClick$={closePopup}
          class="absolute top-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/60 text-slate-300 hover:text-white border border-white/10 hover:bg-slate-900 transition-colors shadow-lg backdrop-blur-sm"
          aria-label="Cerrar"
        >
          <LuX class="h-5 w-5" />
        </button>

        {/* Promo Image */}
        {popup.imageUrl && (
          <div class="relative h-60 bg-emerald-950/20">
            <div class="absolute inset-0 bg-gradient-to-t from-[#001407] via-transparent to-transparent z-10" />
            <img
              src={popup.imageUrl}
              alt={popup.title}
              width={500}
              height={300}
              class="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content Box */}
        <div class="p-8 text-center space-y-6">
          <div class="space-y-3">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-4 py-1 text-xs font-black tracking-widest text-emerald-400 uppercase ring-1 ring-emerald-500/20">
              🔥 NOVEDADES
            </span>
            <h3 class="text-3xl font-black text-white tracking-tighter uppercase leading-none drop-shadow-md">
              {popup.title}
            </h3>
          </div>

          <p class="text-slate-300 text-base leading-relaxed max-w-sm mx-auto">
            {popup.description}
          </p>

          <div class="pt-2">
            <a
              href={popup.buttonLink || "#canchas"}
              onClick$={closePopup}
              class="inline-block w-full rounded-full bg-[#F5F2EB] hover:bg-[#EAE6DB] text-slate-950 font-black tracking-widest uppercase py-4 shadow-xl shadow-black/20 hover:-translate-y-0.5 transition-all text-sm select-none"
            >
              {popup.buttonText || "Reservar Ahora"}
            </a>
          </div>
        </div>

      </div>
    </div>
  );
});
