import { component$ } from "@builder.io/qwik";
import { routeAction$ } from "@builder.io/qwik-city";
import { seedDemoData } from "~/db/seed_demo";

export const useSeedAction = routeAction$(async (data, requestEvent) => {
  await seedDemoData(requestEvent);
  return { success: true };
});

export default component$(() => {
  const seedAction = useSeedAction();

  return (
    <div class="p-20 flex flex-col items-center justify-center space-y-8">
      <h1 class="text-4xl font-black text-slate-800">Seeder de Base de Datos</h1>
      <p class="text-slate-500 max-w-md text-center">
        Al presionar el botón se llenará la base de datos con información de prueba para la última semana (Cajas, Escuelita, Reservas, etc.)
      </p>

      <button
        onClick$={() => seedAction.submit({})}
        disabled={seedAction.isRunning}
        class="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50"
      >
        {seedAction.isRunning ? "Sembrando..." : "Sembrar Datos de Prueba"}
      </button>

      {seedAction.value?.success && (
        <div class="p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 font-bold">
          ¡Base de datos sembrada con éxito! Ya puedes ir al calendario o balances.
        </div>
      )}
    </div>
  );
});
