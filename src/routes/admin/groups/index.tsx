import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, Link } from "@builder.io/qwik-city";
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
  })
);

export default component$(() => {
  const groupsData = useGroupsData();
  const createGroupAction = useCreateGroupAction();

  return (
    <div class="p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-6xl mx-auto space-y-6">
        
        <div class="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 class="text-3xl font-black tracking-tight text-slate-800">Cuentas Corrientes</h1>
            <p class="text-slate-500 mt-1">Administración de grupos y colegios con pago vencido.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Create Group Form */}
          <div class="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h2 class="text-xl font-black text-slate-800 mb-4">Nuevo Grupo</h2>
            <Form action={createGroupAction} class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre del Grupo/Escuela *</label>
                <input type="text" name="name" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre de Contacto</label>
                <input type="text" name="contactName" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Teléfono</label>
                <input type="text" name="contactPhone" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                <input type="email" name="contactEmail" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>

              <Button look="primary" type="submit" disabled={createGroupAction.isRunning} class="w-full py-3 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold mt-2">
                {createGroupAction.isRunning ? "Creando..." : "Crear Grupo"}
              </Button>
            </Form>
          </div>

          {/* Groups List */}
          <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div class="flex-1 overflow-auto p-0">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
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
                      <tr key={g.id} class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td class="p-4 font-black">{g.name}</td>
                        <td class="p-4 text-slate-500">
                          <div>{g.contactName || "-"}</div>
                          <div class="text-xs">{g.contactPhone}</div>
                        </td>
                        <td class={`p-4 text-right font-black ${g.balance < 0 ? "text-red-600" : g.balance > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                          ${g.balance.toFixed(2)}
                        </td>
                        <td class="p-4 text-center">
                          <Link href={`/admin/groups/${g.id}/`} class="text-emerald-600 hover:text-emerald-700 font-bold text-xs uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-lg">
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
