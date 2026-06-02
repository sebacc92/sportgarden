import { component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { pitchSubscriptions, pitches, bookings } from "~/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { isPitchAvailable } from "~/utils/availability";
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
    },
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

    const subId = crypto.randomUUID();
    const startDate = new Date(`${data.startDate}T12:00:00-03:00`);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    const datesToBook: any[] = [];
    const current = new Date(startDate);
    
    // Find the first date that matches dayOfWeek
    while (current.getDay() !== Number(data.dayOfWeek)) {
      current.setDate(current.getDate() + 1);
    }

    const userId = data.ownerType === "USER" ? data.ownerId : null;
    const groupId = data.ownerType === "GROUP" ? data.ownerId : null;

    let count = 0;
    while (current <= endDate && count < 52) {
      const startDateTime = new Date(`${current.toISOString().split("T")[0]}T${data.startTime}:00-03:00`);
      const endDateTime = new Date(`${current.toISOString().split("T")[0]}T${data.endTime}:00-03:00`);

      // Check availability
      const { available } = await isPitchAvailable(db, {
        pitchId: data.pitchId,
        startTime: startDateTime,
        endTime: endDateTime,
      });

      if (available) {
        datesToBook.push({
          id: crypto.randomUUID(),
          userId,
          groupId,
          pitchId: data.pitchId,
          startTime: startDateTime,
          endTime: endDateTime,
          status: "CONFIRMED",
          bookingType: "FIXED",
          isSubscription: true,
          totalPrice: Number(data.pricePerMatch),
          paidAmount: 0,
          paymentStatus: "PENDING",
          paymentMethod: "CASH",
          notes: `subscription:${subId}`,
        });
      }
      current.setDate(current.getDate() + 7);
      count++;
    }

    await db.transaction(async (tx) => {
      await tx.insert(pitchSubscriptions).values({
        id: subId,
        pitchId: data.pitchId,
        userId,
        groupId,
        dayOfWeek: Number(data.dayOfWeek),
        startTime: data.startTime,
        endTime: data.endTime,
        startDate: startDate,
        pricePerMatch: Number(data.pricePerMatch),
        isActive: true,
      });

      if (datesToBook.length > 0) {
        const CHUNK_SIZE = 50;
        for (let i = 0; i < datesToBook.length; i += CHUNK_SIZE) {
          await tx.insert(bookings).values(datesToBook.slice(i, i + CHUNK_SIZE));
        }
      }
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
  }),
);

export const useToggleSubscriptionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const sub = await db.query.pitchSubscriptions.findFirst({
      where: eq(pitchSubscriptions.id, data.subscriptionId),
    });

    if (sub) {
      const newIsActive = !sub.isActive;

      await db.transaction(async (tx) => {
        await tx
          .update(pitchSubscriptions)
          .set({
            isActive: newIsActive,
            endDate: newIsActive ? null : new Date(),
          })
          .where(eq(pitchSubscriptions.id, sub.id));

        const now = new Date();

        if (!newIsActive) {
          // Cancelling: Set all future un-paid bookings for this sub to CANCELLED
          await tx
            .update(bookings)
            .set({ status: "CANCELLED" })
            .where(
              and(
                eq(bookings.notes, `subscription:${sub.id}`),
                gte(bookings.startTime, now),
                eq(bookings.paymentStatus, "PENDING"),
                eq(bookings.status, "CONFIRMED")
              )
            );
        } else {
          // Reactivating: Set future CANCELLED bookings back to CONFIRMED if available
          const futureBookings = await tx.query.bookings.findMany({
            where: and(
              eq(bookings.notes, `subscription:${sub.id}`),
              gte(bookings.startTime, now),
              eq(bookings.status, "CANCELLED")
            ),
          });

          for (const b of futureBookings) {
            const { available } = await isPitchAvailable(tx, {
              pitchId: b.pitchId,
              startTime: b.startTime,
              endTime: b.endTime,
              excludeBookingId: b.id,
            });
            if (available) {
              await tx
                .update(bookings)
                .set({ status: "CONFIRMED" })
                .where(eq(bookings.id, b.id));
            }
          }
        }
      });
    }

    return { success: true };
  },
  zod$({
    subscriptionId: z.string(),
  }),
);

export default component$(() => {
  const data = useSubscriptionsData();
  const createSubAction = useCreateSubscriptionAction();
  const toggleSubAction = useToggleSubscriptionAction();

  const daysOfWeek = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const h = Math.floor(i / 2);
    const m = (i % 2) * 30;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });

  const formatDayOfWeek = (dayIdx: number) => {
    const day = daysOfWeek[dayIdx];
    if (day.endsWith("s")) return day;
    return day + "s";
  };

  return (
    <div class="min-h-full bg-slate-50 p-6 font-sans">
      <div class="mx-auto max-w-6xl space-y-6">
        <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h1 class="text-3xl font-black tracking-tight text-slate-800">
              Abonos de Canchas
            </h1>
            <p class="mt-1 text-slate-500">
              Administración de reservas recurrentes fijas.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Create Subscription Form */}
          <div class="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 class="mb-4 text-xl font-black text-slate-800">
              Nuevo Abono Fijo
            </h2>
            <Form action={createSubAction} class="space-y-4">
              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Cancha *
                </label>
                <select
                  name="pitchId"
                  required
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="" disabled selected>
                    Seleccionar cancha...
                  </option>
                  {data.value.pitches.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                    >{`${p.name} (${p.type})`}</option>
                  ))}
                </select>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Tipo Titular
                  </label>
                  <select
                    name="ownerType"
                    id="ownerType"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    onChange$={(e) => {
                      const type = (e.target as HTMLSelectElement).value;
                      const userSelect = document.getElementById(
                        "owner-user",
                      ) as HTMLElement;
                      const groupSelect = document.getElementById(
                        "owner-group",
                      ) as HTMLElement;
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
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Titular *
                  </label>
                  <select
                    id="owner-user"
                    name="ownerId"
                    required
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="" disabled selected>
                      Seleccionar...
                    </option>
                    {data.value.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {`${u.name} ${u.phone ? `(${u.phone})` : ""}`.trim()}
                      </option>
                    ))}
                  </select>
                  <select
                    id="owner-group"
                    name="ignore"
                    style="display:none;"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="" disabled selected>
                      Seleccionar...
                    </option>
                    {data.value.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Día Fijo *
                </label>
                <select
                  name="dayOfWeek"
                  required
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="" disabled selected>
                    Seleccionar...
                  </option>
                  {daysOfWeek.map((day, idx) => (
                    <option key={idx} value={idx}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Hora Inicio *
                  </label>
                  <select
                    name="startTime"
                    required
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="" disabled selected>
                      --:-- hs
                    </option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {`${t} hs`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Hora Fin *
                  </label>
                  <select
                    name="endTime"
                    required
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="" disabled selected>
                      --:-- hs
                    </option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {`${t} hs`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Fecha Inicio *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Precio por Turno
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="pricePerMatch"
                    required
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <Button
                look="primary"
                type="submit"
                disabled={createSubAction.isRunning}
                class="mt-2 w-full rounded-xl bg-slate-800 py-3 font-bold text-white hover:bg-slate-900"
              >
                {createSubAction.isRunning ? "Creando..." : "Crear Abono Fijo"}
              </Button>
            </Form>
          </div>

          {/* Subscriptions List */}
          <div class="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <div class="flex-1 overflow-auto p-0">
              <table class="w-full border-collapse text-left">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50/80 text-xs font-black tracking-widest text-slate-400 uppercase">
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
                      <tr
                        key={sub.id}
                        class={`border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50 ${!sub.isActive ? "opacity-60" : ""}`}
                      >
                        <td class="p-4">
                          <div class="font-black text-slate-800">
                            {sub.pitch?.name}
                          </div>
                          <div class="text-[10px] font-bold text-slate-400 uppercase">
                            {sub.pitch?.type}
                          </div>
                        </td>
                        <td class="p-4">
                          <div class="font-bold text-emerald-600">
                            Todos los {formatDayOfWeek(sub.dayOfWeek)}
                          </div>
                          <div class="text-xs font-bold text-slate-500">
                            {sub.startTime} - {sub.endTime}
                          </div>
                        </td>
                        <td class="p-4">
                          <div class="font-bold">
                            {sub.user
                              ? sub.user.name
                              : sub.group
                                ? sub.group.name
                                : "Desconocido"}
                          </div>
                          <div class="text-[10px] font-bold text-slate-400 uppercase">
                            {sub.user ? "USUARIO" : "GRUPO"}
                          </div>
                        </td>
                        <td class="p-4">
                          <span
                            class={`rounded-md px-2 py-1 text-[10px] font-bold tracking-wider uppercase ${sub.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                          >
                            {sub.isActive ? "ACTIVO" : "CANCELADO"}
                          </span>
                        </td>
                        <td class="p-4 text-center">
                          <Form action={toggleSubAction}>
                            <input
                              type="hidden"
                              name="subscriptionId"
                              value={sub.id}
                            />
                            <Button
                              look={sub.isActive ? "secondary" : "primary"}
                              type="submit"
                              class={`rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide ${sub.isActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-500 text-white hover:bg-emerald-600"}`}
                            >
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
  title: "Abonos - GardenClubFutbol",
};
