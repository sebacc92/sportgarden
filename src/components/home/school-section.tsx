import { component$ } from "@builder.io/qwik";

interface SchoolCategory {
  id: string;
  name: string;
  teacher: string;
  monthlyFee: number;
  schedules?: { day: number; startTime: string; endTime: string }[];
  days?: number[];
  startTime?: string;
  endTime?: string;
}

interface SchoolSectionProps {
  categories: SchoolCategory[];
}

export const SchoolSection = component$<SchoolSectionProps>(({ categories }) => {
  if (!categories || categories.length === 0) return null;

  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const shortDaysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <section
      class="scroll-mt-28 py-24 bg-slate-950 relative overflow-hidden"
      id="escuelita"
    >
      {/* Decorative background */}
      <div class="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div class="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
        <div class="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-700 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
      </div>

      <div class="max-w-6xl mx-auto px-6 relative z-10">
        <div class="text-center mb-16">
          <h2 class="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-4 flex items-center justify-center gap-3">
            <span class="bg-emerald-500 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">⚽</span>
            Escuelita de Fútbol
          </h2>
          <p class="text-slate-400 text-lg max-w-2xl mx-auto font-medium">Sumate a nuestros entrenamientos. Formación, diversión y los mejores profesores para todas las edades.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div
              key={cat.id}
              class="bg-slate-900/50 backdrop-blur-sm border border-white/10 rounded-3xl p-6 transition-all duration-300 hover:border-emerald-500/50 hover:bg-slate-900 hover:-translate-y-1 group"
            >
              <div class="flex justify-between items-start mb-4">
                <div>
                  <div class="text-emerald-400 font-black uppercase tracking-widest text-xs mb-1">Categoría</div>
                  <h3 class="text-2xl font-black text-white">{cat.name}</h3>
                </div>
                <div class="w-10 h-10 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-slate-300 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
              </div>

              <div class="space-y-4 mb-6">
                <div class="flex items-center gap-3 text-slate-300">
                  <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                  </div>
                  <div>
                    <div class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Profesor</div>
                    <div class="font-medium">{cat.teacher}</div>
                  </div>
                </div>

                {(() => {
                  const schedules = cat.schedules || (cat.days ? cat.days.map((d: number) => ({ day: d, startTime: cat.startTime, endTime: cat.endTime })) : []);
                  if (!schedules || schedules.length === 0) return null;

                  const groups: Record<string, number[]> = {};
                  schedules.forEach((s: any) => {
                    const key = `${s.startTime || '?'}-${s.endTime || '?'}`;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(s.day);
                  });

                  return (
                    <div class="space-y-4 border-t border-white/5 pt-4">
                      <div class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Horarios</div>
                      {Object.entries(groups).map(([time, days]) => (
                        <div key={time} class="flex gap-3 text-slate-300">
                          <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          </div>
                          <div>
                            <div class="flex flex-wrap gap-1 mb-1">
                              {days.sort((a, b) => a - b).map((d: number) => (
                                <span key={d} class="bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-[10px] font-black text-slate-300" title={daysOfWeek[d]}>
                                  {shortDaysOfWeek[d]}
                                </span>
                              ))}
                            </div>
                            <div class="font-medium text-sm text-emerald-400">
                              {time.replace('-', ' a ')} hs
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div class="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                <div>
                  <div class="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-0.5">Cuota Mensual</div>
                  <div class="text-xl font-black text-white">${cat.monthlyFee?.toLocaleString("es-AR")}</div>
                </div>
                <a href="#contacto" class="bg-white/5 hover:bg-emerald-500 hover:text-white text-emerald-400 text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all duration-300 shadow-sm border border-emerald-500/20 hover:border-emerald-500">
                  Consultar
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
