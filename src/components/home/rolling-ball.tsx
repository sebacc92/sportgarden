import { component$, useSignal, useVisibleTask$, useStylesScoped$ } from "@builder.io/qwik";

export const RollingBall = component$(() => {
  const containerRef = useSignal<Element>();
  const progress = useSignal(0);
  const isAnimating = useSignal(false);
  const goals = useSignal<{ id: number; x: number; y: number; label?: string; delay?: number }[]>([]);

  useStylesScoped$(`
    @keyframes floatUp {
      0% {
        opacity: 0;
        transform: translate(-50%, 0) scale(0.5) rotate(-15deg);
      }
      15% {
        opacity: 1;
        transform: translate(-50%, -40px) scale(1.3) rotate(10deg);
      }
      80% {
        opacity: 1;
        transform: translate(-50%, -100px) scale(1) rotate(-5deg);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -140px) scale(0.8) rotate(5deg);
      }
    }
    .floating-goal {
      animation: floatUp 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
  `);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const handleScroll = () => {
      if (!containerRef.value || isAnimating.value) return;
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
      class="relative flex h-48 w-full items-end overflow-hidden border-y border-white/5 bg-slate-950 px-4 pb-16 md:h-64 md:px-8 md:pb-20"
    >
      <div class="absolute right-0 bottom-0 left-0 z-0 h-16 overflow-hidden border-t-2 border-white/40 bg-gradient-to-t from-emerald-900 to-emerald-700 md:h-20">
        {/* Grass stripes */}
        <div
          class="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 80px, #000 80px, #000 160px)",
          }}
        />

        {/* Dynamic Soccer Field Markings in SVG (well proportioned to the grass height) */}
        <svg
          class="absolute inset-0 h-full w-full opacity-35"
          preserveAspectRatio="none"
          viewBox="0 0 1000 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Mid-field line */}
          <line x1="500" y1="0" x2="500" y2="80" stroke="white" stroke-width="2" />
          {/* Mid-field center circle (radius 40px) */}
          <circle cx="500" cy="0" r="40" stroke="white" stroke-width="2" />
          
          {/* Left Penalty Area (Box) */}
          <rect x="0" y="0" width="120" height="60" stroke="white" stroke-width="2" />
          {/* Left Goal Area */}
          <rect x="0" y="0" width="45" height="30" stroke="white" stroke-width="2" />
          {/* Left Penalty Arc */}
          <path d="M 120 20 A 40 40 0 0 1 120 60" stroke="white" stroke-width="2" />
          
          {/* Right Penalty Area (Box) */}
          <rect x="880" y="0" width="120" height="60" stroke="white" stroke-width="2" />
          {/* Right Goal Area */}
          <rect x="955" y="0" width="45" height="30" stroke="white" stroke-width="2" />
          {/* Right Penalty Arc */}
          <path d="M 880 20 A 40 40 0 0 0 880 60" stroke="white" stroke-width="2" />
          
          {/* Corner Arcs */}
          <path d="M 0 15 A 15 15 0 0 0 15 0" stroke="white" stroke-width="2" />
          <path d="M 1000 15 A 15 15 0 0 1 985 0" stroke="white" stroke-width="2" />
        </svg>
      </div>

      {/* Floating GOL Texts */}
      {goals.value.map((goal) => (
        <div
          key={goal.id}
          class="floating-goal absolute z-30 pointer-events-none font-black text-emerald-400 text-5xl md:text-7xl uppercase italic drop-shadow-[0_5px_15px_rgba(16,185,129,0.6)] select-none"
          style={{
            left: `${goal.x}px`,
            top: `${goal.y}px`,
            animationDelay: `${goal.delay || 0}s`,
          }}
        >
          ⚽ {goal.label || "¡GOL!"}
        </div>
      ))}

      <div
        class="z-10 -mb-2 will-change-transform md:-mb-3"
        style={{
          transform: `translateX(calc(${progress.value} * (100vw - 100% - 4rem)))`,
          transition: isAnimating.value ? "none" : "transform 0.05s linear",
        }}
      >
        <div
          onClick$={() => {
            if (isAnimating.value) return;
            isAnimating.value = true;

            // 1. Play synthesized referee whistle immediately
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc1 = ctx.createOscillator();
              const osc2 = ctx.createOscillator();
              const gainMod = ctx.createGain();
              const mainGain = ctx.createGain();
              
              osc1.frequency.setValueAtTime(2000, ctx.currentTime);
              osc2.frequency.setValueAtTime(30, ctx.currentTime);
              gainMod.gain.setValueAtTime(120, ctx.currentTime);
              
              osc2.connect(gainMod);
              gainMod.connect(osc1.frequency);
              
              mainGain.gain.setValueAtTime(0, ctx.currentTime);
              mainGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
              mainGain.gain.setValueAtTime(0.25, ctx.currentTime + 0.2);
              mainGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
              
              osc1.connect(mainGain);
              mainGain.connect(ctx.destination);
              
              osc1.start();
              osc2.start();
              osc1.stop(ctx.currentTime + 0.4);
              osc2.stop(ctx.currentTime + 0.4);
            } catch (e) {
              console.error(e);
            }

            // 2. Smoothly scroll container into view
            containerRef.value?.scrollIntoView({ behavior: "smooth", block: "center" });

            // 3. Kick off glide animation
            setTimeout(() => {
              const startProgress = progress.value;
              const duration = 1200; // 1.2s rolling glide
              const startTime = performance.now();

              // Smoothly scroll down slightly to reveal the next section without hiding the ball
              window.scrollBy({ top: 220, behavior: "smooth" });

              const animate = (now: number) => {
                const elapsed = now - startTime;
                const t = Math.min(1, elapsed / duration);
                
                // Glide easing (cubic ease-out)
                const ease = 1 - Math.pow(1 - t, 3);
                progress.value = startProgress + (1 - startProgress) * ease;

                if (t < 1) {
                  requestAnimationFrame(animate);
                } else {
                  // Ball reached goal! Explode massive GOL confetti!
                  const containerRect = containerRef.value!.getBoundingClientRect();
                  const rightX = containerRect.width - 150;
                  const goalY = 50;

                  const newGoals = Array.from({ length: 6 }).map((_, i) => ({
                    id: Date.now() + i,
                    x: rightX + (Math.random() - 0.5) * 80,
                    y: goalY + (Math.random() - 0.5) * 40 - i * 15,
                    label: i === 0 ? "¡¡¡GOOOOL!!!" : "¡GOL!",
                    delay: i * 0.1,
                  }));

                  goals.value = [...goals.value, ...newGoals];

                  // Final goal whistle sound
                  try {
                    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.frequency.setValueAtTime(1500, ctx.currentTime);
                    gain.gain.setValueAtTime(0, ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.6);
                  } catch (err) {
                    console.error(err);
                  }

                  setTimeout(() => {
                    goals.value = [];
                    isAnimating.value = false;
                  }, 2200);
                }
              };

              requestAnimationFrame(animate);
            }, 300);
          }}
          class="cursor-pointer hover:scale-115 active:scale-95 transition-transform duration-200 select-none"
        >
          <div
            class="text-[6rem] leading-none drop-shadow-[0_5px_10px_rgba(0,0,0,0.6)] md:text-[8rem]"
            style={{
              transform: `rotate(${progress.value * 1080}deg)`,
              transition: isAnimating.value ? "none" : "transform 0.05s linear",
            }}
          >
            ⚽
          </div>
        </div>
      </div>
    </div>
  );
});
