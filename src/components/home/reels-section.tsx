import { component$ } from "@builder.io/qwik";

interface Reel {
  id: string;
  videoUrl: string;
  posterUrl: string;
  caption?: string;
}

interface ReelsSectionProps {
  reels: Reel[];
}

export const ReelsSection = component$<ReelsSectionProps>(({ reels }) => {
  if (!reels || reels.length === 0) return null;

  return (
    <section id="destacados" class="relative py-24 md:py-32 bg-slate-950 overflow-hidden border-t border-white/5">
      {/* Subtle background texture */}
      <div
        class="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(16,185,129,0.4) 40px, rgba(16,185,129,0.4) 41px)',
        }}
      />

      <div class="container mx-auto px-4 max-w-7xl relative z-10">
        {/* Title */}
        <div class="mb-16 text-center">
          <h2 class="mb-4 text-4xl font-black tracking-tighter text-white uppercase md:text-5xl">
            Nuestros <span class="text-emerald-400">Reels</span>
          </h2>
          <p class="mx-auto max-w-xl text-lg text-slate-400">
            Viví el Club con amigos. Compartimos momentos.
          </p>
        </div>

        {/* Dynamic Reels Grid */}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-12 justify-center justify-items-center w-full">
          {reels.map((reel) => (
            <div key={reel.id} class="relative w-full max-w-[320px]">
              <div
                class="relative bg-black rounded-[32px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.8)] border border-white/10 w-full aspect-[9/16] transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/30"
              >
                <video
                  src={reel.videoUrl}
                  poster={reel.posterUrl}
                  preload="none"
                  class="w-full h-full object-cover"
                  controls
                  playsInline
                  loop
                  muted
                />

                {/* Caption overlay on bottom */}
                {reel.caption && (
                  <div class="absolute bottom-12 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                    <p class="text-xs font-bold text-white drop-shadow-md line-clamp-2">
                      {reel.caption}
                    </p>
                  </div>
                )}
              </div>

              {/* Glow effect matching Emerald palette */}
              <div class="absolute -inset-4 bg-emerald-500/10 blur-3xl rounded-full -z-10 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
