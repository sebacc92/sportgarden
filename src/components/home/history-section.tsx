import { component$ } from "@builder.io/qwik";
import gardenLogo from "~/media/garden-logo-transparente.png";

export const HistorySection = component$(() => {
  const yearsOfPassion = new Date().getFullYear() - 1997;

  return (
    <section id="historia" class="relative z-20 bg-[#001407] py-24">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="grid items-start gap-16 lg:grid-cols-2">
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
                <div class="mb-2 text-4xl font-black text-emerald-400">
                  {yearsOfPassion}
                </div>
                <div class="text-sm font-bold tracking-widest text-slate-500 uppercase">
                  Años de Pasión
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-col items-center justify-center pt-2 md:pt-4">
            <div class="mb-8 text-center text-base font-light tracking-[0.25em] text-[#F5F2EB] uppercase sm:text-lg md:text-xl lg:text-2xl select-none">
              BARRIO <span class="text-[#F5F2EB]/40 font-extralight mx-3 md:mx-4">|</span> FÚTBOL <span class="text-[#F5F2EB]/40 font-extralight mx-3 md:mx-4">|</span> AMIGOS
            </div>
            <div class="relative flex items-center justify-center">
              <div class="relative z-10 w-full max-w-[420px]">
                <img
                  src={gardenLogo}
                  alt="GardenClubFutbol Logo"
                  width={420}
                  height={420}
                  class="h-auto w-full object-contain rounded-3xl transition-transform duration-700 hover:scale-102"
                />
              </div>
              <div class="absolute -inset-4 -z-10 rounded-full bg-emerald-500/10 blur-3xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
