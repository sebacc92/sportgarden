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
    <div class="flex flex-col items-center justify-center space-y-8 p-20">
      <h1 class="text-4xl font-black text-slate-800">
        Seeder de Base de Datos
      </h1>
      <p class="max-w-md text-center text-slate-500">
        Al presionar el botón se llenará la base de datos con información de
        prueba para la última semana (Cajas, Escuelita, Reservas, etc.)
      </p>

      <button
        onClick$={() => seedAction.submit({})}
        disabled={seedAction.isRunning}
        class="rounded-2xl bg-emerald-500 px-8 py-4 font-black tracking-widest text-white uppercase shadow-xl shadow-emerald-500/20 transition-all hover:bg-emerald-600 disabled:opacity-50"
      >
        {seedAction.isRunning ? "Sembrando..." : "Sembrar Datos de Prueba"}
      </button>

      {seedAction.value?.success && (
        <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">
          ¡Base de datos sembrada con éxito! Ya puedes ir al calendario o
          balances.
        </div>
      )}
    </div>
  );
});
