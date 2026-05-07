import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$ } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { pitchSubscriptions, pitches } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "~/components/ui";

export const useSubscriptionsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  const allPitches = await db.query.pitches.findMany({
    where: eq(pitches.isActive, true),
  });

  const allUsers = await db.query.users.findMany();
  const allGroups = await db.query.groups.findMany();

  const subscriptions = await db.query.pitchSubscriptions.findMany({
    orderBy: [desc(pitchSubscriptions.createdAt)],
    with: {
      pitch: true,
      user: true,
      group: true,
    }
  });

  return {
    pitches: allPitches,
    users: allUsers,
    groups: allGroups,
    subscriptions: subscriptions,
  };
});

export const useCreateSubscriptionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    await db.insert(pitchSubscriptions).values({
      id: crypto.randomUUID(),
      pitchId: data.pitchId,
      userId: data.ownerType === "USER" ? data.ownerId : null,
      groupId: data.ownerType === "GROUP" ? data.ownerId : null,
      dayOfWeek: Number(data.dayOfWeek),
      startTime: data.startTime,
      endTime: data.endTime,
      startDate: new Date(data.startDate),
      pricePerMatch: Number(data.pricePerMatch),
      isActive: true,
    });

    return { success: true };
  },
  zod$({
    pitchId: z.string().min(1),
    ownerType: z.enum(["USER", "GROUP"]),
    ownerId: z.string().min(1),
    dayOfWeek: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    startDate: z.string(),
    pricePerMatch: z.string(),
  })
);

export const useToggleSubscriptionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const sub = await db.query.pitchSubscriptions.findFirst({
      where: eq(pitchSubscriptions.id, data.subscriptionId)
    });

    if (sub) {
      await db.update(pitchSubscriptions).set({
        isActive: !sub.isActive,
        endDate: sub.isActive ? new Date() : null // Set end date to now if cancelling
      }).where(eq(pitchSubscriptions.id, sub.id));
    }

    return { success: true };
  },
  zod$({
    subscriptionId: z.string(),
  })
);

export default component$(() => {
  const data = useSubscriptionsData();
  const createSubAction = useCreateSubscriptionAction();
  const toggleSubAction = useToggleSubscriptionAction();

  const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  return (
    <div class="p-6 bg-slate-50 min-h-full font-sans">
      <div class="max-w-6xl mx-auto space-y-6">

        <div class="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 class="text-3xl font-black tracking-tight text-slate-800">Abonos de Canchas</h1>
            <p class="text-slate-500 mt-1">Administración de reservas recurrentes fijas.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Create Subscription Form */}
          <div class="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h2 class="text-xl font-black text-slate-800 mb-4">Nuevo Abono Fijo</h2>
            <Form action={createSubAction} class="space-y-4">

              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cancha *</label>
                <select name="pitchId" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold">
                  <option value="" disabled selected>Seleccionar cancha...</option>
                  {data.value.pitches.map(p => (
                    <option key={p.id} value={p.id}>{`${p.name} (${p.type})`}</option>
                  ))}
                </select>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo Titular</label>
                  <select name="ownerType" id="ownerType" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold"
                    onChange$={(e) => {
                      const type = (e.target as HTMLSelectElement).value;
                      const userSelect = document.getElementById("owner-user") as HTMLElement;
                      const groupSelect = document.getElementById("owner-group") as HTMLElement;
                      if (type === "USER") {
                        userSelect.style.display = "block";
                        groupSelect.style.display = "none";
                        (userSelect as any).name = "ownerId";
                        (groupSelect as any).name = "ignore";
                      } else {
                        userSelect.style.display = "none";
                        groupSelect.style.display = "block";
                        (groupSelect as any).name = "ownerId";
                        (userSelect as any).name = "ignore";
                      }
                    }}
                  >
                    <option value="USER">Usuario</option>
                    <option value="GROUP">Grupo/Escuela</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Titular *</label>
                  <select id="owner-user" name="ownerId" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold">
                    <option value="" disabled selected>Seleccionar...</option>
                    {data.value.users.map(u => (
                      <option key={u.id} value={u.id}>{`${u.name} ${u.phone ? `(${u.phone})` : ''}`.trim()}</option>
                    ))}
                  </select>
                  <select id="owner-group" name="ignore" style="display:none;" class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold">
                    <option value="" disabled selected>Seleccionar...</option>
                    {data.value.groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Día Fijo *</label>
                <select name="dayOfWeek" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold">
                  <option value="" disabled selected>Seleccionar...</option>
                  {daysOfWeek.map((day, idx) => (
                    <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Hora Inicio *</label>
                  <input type="time" name="startTime" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Hora Fin *</label>
                  <input type="time" name="endTime" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha Inicio *</label>
                  <input type="date" name="startDate" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Precio por Turno</label>
                  <input type="number" step="0.01" name="pricePerMatch" required class="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                </div>
              </div>

              <Button look="primary" type="submit" disabled={createSubAction.isRunning} class="w-full py-3 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold mt-2">
                {createSubAction.isRunning ? "Creando..." : "Crear Abono Fijo"}
              </Button>
            </Form>
          </div>

          {/* Subscriptions List */}
          <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div class="flex-1 overflow-auto p-0">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                    <th class="p-4">Cancha</th>
                    <th class="p-4">Horario Fijo</th>
                    <th class="p-4">Titular</th>
                    <th class="p-4">Estado</th>
                    <th class="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody class="text-sm font-semibold text-slate-700">
                  {data.value.subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={5} class="p-8 text-center text-slate-500">
                        No hay abonos registrados.
                      </td>
                    </tr>
                  ) : (
                    data.value.subscriptions.map((sub: any) => (
                      <tr key={sub.id} class={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors ${!sub.isActive ? "opacity-60" : ""}`}>
                        <td class="p-4">
                          <div class="font-black text-slate-800">{sub.pitch?.name}</div>
                          <div class="text-[10px] uppercase font-bold text-slate-400">{sub.pitch?.type}</div>
                        </td>
                        <td class="p-4">
                          <div class="font-bold text-emerald-600">
                            Todos los {daysOfWeek[sub.dayOfWeek]}s
                          </div>
                          <div class="text-xs font-bold text-slate-500">
                            {sub.startTime} - {sub.endTime}
                          </div>
                        </td>
                        <td class="p-4">
                          <div class="font-bold">{sub.user ? sub.user.name : sub.group ? sub.group.name : "Desconocido"}</div>
                          <div class="text-[10px] text-slate-400 font-bold uppercase">{sub.user ? "USUARIO" : "GRUPO"}</div>
                        </td>
                        <td class="p-4">
                          <span class={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold ${sub.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {sub.isActive ? "ACTIVO" : "CANCELADO"}
                          </span>
                        </td>
                        <td class="p-4 text-center">
                          <Form action={toggleSubAction}>
                            <input type="hidden" name="subscriptionId" value={sub.id} />
                            <Button look={sub.isActive ? "secondary" : "primary"} type="submit" class={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide ${sub.isActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-500 text-white hover:bg-emerald-600"}`}>
                              {sub.isActive ? "Dar de baja" : "Reactivar"}
                            </Button>
                          </Form>
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
  title: "Abonos - SportGardenFutbol",
};
