import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { HERO_SLIDES } from "~/lib/home-page/constants";

export const HeroSlider = component$((props: { slides?: any[] | null }) => {
  const activeSlide = useSignal(0);

  const slides = Array.isArray(props.slides) && props.slides.length > 0
    ? props.slides
    : (HERO_SLIDES as unknown as any[]);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const interval = setInterval(() => {
      activeSlide.value = (activeSlide.value + 1) % slides.length;
    }, 5000);
    return () => clearInterval(interval);
  });

  return (
    <section
      id="inicio"
      class="relative flex h-screen min-h-[600px] items-center justify-center overflow-hidden"
    >
      {slides.map((slide, index) => (
        <div
          key={slide.image}
          class={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${activeSlide.value === index ? "z-10 opacity-100" : "z-0 opacity-0"
            }`}
        >
          <div class="absolute inset-0 z-10 bg-slate-950/60 mix-blend-multiply" />
          <div class="absolute inset-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <img
            src={slide.image}
            alt={slide.title}
            width={1920}
            height={1080}
            class="absolute inset-0 h-full w-full object-cover"
          />

          <div class="absolute inset-0 z-20 flex items-center justify-center">
            <div class="mx-auto max-w-4xl translate-y-0 transform px-6 text-center transition-transform delay-100 duration-1000">
              {activeSlide.value === index && (
                <div class="animate-fade-in-up">
                  <div class="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1.5 text-xs font-bold tracking-widest text-emerald-400 uppercase ring-1 ring-emerald-500/30 backdrop-blur-sm">
                    <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    {slide.badgeText || "Abierto todos los días"}
                  </div>
                  <h1 class="mb-6 text-5xl font-black tracking-tighter text-white uppercase drop-shadow-2xl md:text-8xl">
                    {slide.title}
                  </h1>
                  <p class="mx-auto mt-4 mb-10 max-w-2xl text-xl font-medium text-slate-200 drop-shadow-md md:text-2xl">
                    {slide.subtitle}
                  </p>
                  <a
                    href="#canchas"
                    class="inline-block rounded-full bg-[#F5F2EB] px-8 py-4 text-lg font-black tracking-widest text-slate-950 uppercase shadow-xl transition-all hover:-translate-y-1 hover:bg-[#EAE6DB] hover:shadow-black/25"
                  >
                    Reservar Ahora.
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      <div class="absolute inset-x-0 bottom-10 z-30 flex justify-center gap-3">
        {slides.map((slide, index) => (
          <button
            key={slide.image}
            type="button"
            onClick$={() => (activeSlide.value = index)}
            class={`h-3 rounded-full transition-all ${activeSlide.value === index
                ? "w-8 bg-[#F5F2EB]"
                : "w-3 bg-[#F5F2EB]/40 hover:bg-[#F5F2EB]/80"
              }`}
            aria-label={`Ir a diapositiva ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
});
