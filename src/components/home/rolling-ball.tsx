import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

export const RollingBall = component$(() => {
  const containerRef = useSignal<Element>();
  const progress = useSignal(0);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const handleScroll = () => {
      if (!containerRef.value) return;
      const rect = containerRef.value.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      const start = windowHeight;
      const end = 0;

      let p = (start - rect.top) / (start - end);
      p = Math.max(0, Math.min(1, p));

      progress.value = p;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    setTimeout(handleScroll, 100);

    return () => window.removeEventListener("scroll", handleScroll);
  });

  return (
    <div
      ref={containerRef}
      class="relative flex h-40 w-full items-end overflow-hidden border-y border-white/5 bg-slate-950 px-4 pb-6 md:h-52 md:px-8 md:pb-8"
    >
      <div class="absolute bottom-0 left-0 right-0 z-0 h-6 overflow-hidden border-t-[3px] border-emerald-400 bg-gradient-to-t from-emerald-900 to-emerald-600 md:h-8">
        <div
          class="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(0,0,0,0.5) 40px, rgba(0,0,0,0.5) 80px)",
          }}
        />
      </div>

      <div
        class="z-10 -mb-1 text-[6rem] leading-none drop-shadow-[0_5px_10px_rgba(0,0,0,0.6)] will-change-transform md:-mb-2 md:text-[8rem]"
        style={{
          transform: `translateX(calc(${progress.value} * (100vw - 100% - 2rem))) rotate(${progress.value * 1080}deg)`,
          transition: "transform 0.05s linear",
        }}
      >
        ⚽
      </div>
    </div>
  );
});
