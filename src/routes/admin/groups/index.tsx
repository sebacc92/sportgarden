import { component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
  Link,
} from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { groups } from "~/db/schema";
import { desc } from "drizzle-orm";
import { Button } from "~/components/ui";

export const useGroupsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  const allGroups = await db.query.groups.findMany({
    orderBy: [desc(groups.createdAt)],
  });

  return {
    groups: allGroups,
  };
});

export const useCreateGroupAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    await db.insert(groups).values({
      id: crypto.randomUUID(),
      name: data.name,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      balance: 0,
    });

    return { success: true };
  },
  zod$({
    name: z.string().min(1, "El nombre es obligatorio"),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional().or(z.literal("")),
  }),
);

export default component$(() => {
  const groupsData = useGroupsData();
  const createGroupAction = useCreateGroupAction();

  return (
    <div class="min-h-full bg-slate-50 p-6 font-sans">
      <div class="mx-auto max-w-6xl space-y-6">
        <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h1 class="text-3xl font-black tracking-tight text-slate-800">
              Cuentas Corrientes
            </h1>
            <p class="mt-1 text-slate-500">
              Administración de grupos y colegios con pago vencido.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Create Group Form */}
          <div class="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 class="mb-4 text-xl font-black text-slate-800">Nuevo Grupo</h2>
            <Form action={createGroupAction} class="space-y-4">
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Nombre del Grupo/Escuela *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Nombre de Contacto
                </label>
                <input
                  type="text"
                  name="contactName"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Teléfono
                </label>
                <input
                  type="text"
                  name="contactPhone"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Email
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <Button
                look="primary"
                type="submit"
                disabled={createGroupAction.isRunning}
                class="mt-2 w-full rounded-xl bg-slate-800 py-3 font-bold text-white hover:bg-slate-900"
              >
                {createGroupAction.isRunning ? "Creando..." : "Crear Grupo"}
              </Button>
            </Form>
          </div>

          {/* Groups List */}
          <div class="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <div class="flex-1 overflow-auto p-0">
              <table class="w-full border-collapse text-left">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50/80 text-xs font-black tracking-widest text-slate-400 uppercase">
                    <th class="p-4">Nombre</th>
                    <th class="p-4">Contacto</th>
                    <th class="p-4 text-right">Saldo</th>
                    <th class="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody class="text-sm font-semibold text-slate-700">
                  {groupsData.value.groups.length === 0 ? (
                    <tr>
                      <td colSpan={4} class="p-8 text-center text-slate-500">
                        No hay grupos registrados.
                      </td>
                    </tr>
                  ) : (
                    groupsData.value.groups.map((g) => (
                      <tr
                        key={g.id}
                        class="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50"
                      >
                        <td class="p-4 font-black">{g.name}</td>
                        <td class="p-4 text-slate-500">
                          <div>{g.contactName || "-"}</div>
                          <div class="text-xs">{g.contactPhone}</div>
                        </td>
                        <td
                          class={`p-4 text-right font-black ${g.balance < 0 ? "text-red-600" : g.balance > 0 ? "text-emerald-600" : "text-slate-500"}`}
                        >
                          ${g.balance.toFixed(2)}
                        </td>
                        <td class="p-4 text-center">
                          <Link
                            href={`/admin/groups/${g.id}/`}
                            class="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold tracking-wider text-emerald-600 uppercase hover:text-emerald-700"
                          >
                            Ver Detalles
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head = {
  title: "Cuentas Corrientes - GardenClubFutbol",
};
