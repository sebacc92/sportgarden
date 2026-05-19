import { component$ } from "@builder.io/qwik";

export const HistorySection = component$(() => {
  return (
    <section id="historia" class="relative z-20 bg-slate-950 py-24">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="grid items-center gap-16 lg:grid-cols-2">
          <div class="space-y-8">
            <h2 class="text-4xl font-black tracking-tighter text-white uppercase md:text-5xl">
              Nuestra <span class="text-emerald-400">Historia</span>
            </h2>
            <p class="text-lg leading-relaxed text-slate-400">
              GardenClubFutbol nació con la visión de crear el espacio
              definitivo para los amantes del fútbol. Desde nuestros humildes
              comienzos, nos hemos dedicado a ofrecer canchas de primer nivel
              donde la pasión por el deporte se vive al máximo en cada partido.
            </p>
            <p class="text-lg leading-relaxed text-slate-400">
              Creemos que el fútbol es más que un juego; es comunidad, amistad y
              esfuerzo. Por eso, nuestras instalaciones no solo cuentan con la
              mejor tecnología en césped artificial, sino que también ofrecen un
              ambiente inigualable para el tan esperado &quot;tercer
              tiempo&quot;.
            </p>
            <div class="grid grid-cols-2 gap-6 border-t border-white/10 pt-4">
              <div>
                <div class="mb-2 text-4xl font-black text-emerald-400">
                  +10k
                </div>
                <div class="text-sm font-bold tracking-widest text-slate-500 uppercase">
                  Partidos Jugados
                </div>
              </div>
              <div>
                <div class="mb-2 text-4xl font-black text-emerald-400">5</div>
                <div class="text-sm font-bold tracking-widest text-slate-500 uppercase">
                  Años de Pasión
                </div>
              </div>
            </div>
          </div>
          <div class="relative">
            <div class="relative z-10 aspect-square overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
              <img
                src="/slider1.png"
                alt="GardenClubFutbol Historia"
                width={600}
                height={600}
                class="h-full w-full object-cover mix-blend-luminosity transition-all duration-700 hover:mix-blend-normal"
              />
            </div>
            <div class="absolute -inset-4 -z-10 rounded-full bg-emerald-500/20 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
});
