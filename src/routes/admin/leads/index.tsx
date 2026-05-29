import { component$, useComputed$, $ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  zod$,
  z,
  Form,
} from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { bookings, guestRequests, pitches, siteSettings } from "~/db/schema";
import { eq } from "drizzle-orm";

// Loader to fetch pending leads
export const usePendingLeads = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  const leads = await db
    .select({
      booking: {
        id: bookings.id,
        pitchId: bookings.pitchId,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
        totalPrice: bookings.totalPrice,
        paidAmount: bookings.paidAmount,
        paymentStatus: bookings.paymentStatus,
        paymentMethod: bookings.paymentMethod,
        extras: bookings.extras,
      },
      guest: {
        id: guestRequests.id,
        name: guestRequests.name,
        phone: guestRequests.phone,
        email: guestRequests.email,
        createdAt: guestRequests.createdAt,
      },
      pitch: {
        name: pitches.name,
      },
    })
    .from(bookings)
    .innerJoin(guestRequests, eq(bookings.id, guestRequests.bookingId))
    .innerJoin(pitches, eq(bookings.pitchId, pitches.id))
    .where(eq(bookings.status, "PENDING_APPROVAL"))
    .orderBy(bookings.startTime);

  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1),
    columns: { clubName: true },
  });

  return {
    leads: leads.map((l: any) => ({
      ...l,
      booking: {
        ...l.booking,
        startTime: l.booking.startTime.toISOString(),
        endTime: l.booking.endTime.toISOString(),
      },
      guest: {
        ...l.guest,
        createdAt: l.guest.createdAt.toISOString(),
      },
    })),
    clubName: settings?.clubName || "Garden Club",
  };
});

// Action to approve or reject requests
export const useUpdateLeadStatusAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, data.bookingId),
    });

    if (!booking) {
      return { success: false, message: "Reserva no encontrada." };
    }

    if (data.action === "APPROVE") {
      await db
        .update(bookings)
        .set({ status: "CONFIRMED" })
        .where(eq(bookings.id, data.bookingId));
      return { success: true, message: "Reserva confirmada con éxito." };
    } else if (data.action === "REJECT") {
      await db
        .update(bookings)
        .set({ status: "CANCELLED" })
        .where(eq(bookings.id, data.bookingId));
      return { success: true, message: "Solicitud rechazada." };
    }

    return { success: false, message: "Acción no válida." };
  },
  zod$({
    bookingId: z.string(),
    action: z.enum(["APPROVE", "REJECT"]),
  }),
);

export default component$(() => {
  const data = usePendingLeads();
  const updateStatusAction = useUpdateLeadStatusAction();

  const leads = useComputed$(() => data.value.leads || []);

  const totalLeads = useComputed$(() => leads.value.length);
  
  const todayLeadsCount = useComputed$(() => {
    const today = new Date().toDateString();
    return leads.value.filter((l: any) => {
      const d = new Date(l.booking.startTime).toDateString();
      return d === today;
    }).length;
  });

  return (
    <div class="flex-1 overflow-y-auto bg-slate-950 p-6 text-slate-100 font-sans">
      {/* Header */}
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 mb-8">
        <div>
          <h1 class="text-3xl font-black tracking-tight text-white uppercase">
            Solicitudes <span class="text-emerald-400">Leads</span>
          </h1>
          <p class="text-sm text-slate-400 font-medium mt-1">
            Gestiona los turnos solicitados por invitados sin registro de forma directa.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Card 1 */}
        <div class="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-md backdrop-blur-md">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black tracking-widest text-slate-400 uppercase">
              Total Pendientes
            </span>
            <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              ⏳
            </span>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-4xl font-black text-white">{totalLeads.value}</span>
            <span class="text-xs font-bold text-slate-500">solicitudes</span>
          </div>
        </div>

        {/* Card 2 */}
        <div class="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-md backdrop-blur-md">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black tracking-widest text-slate-400 uppercase">
              Para Hoy
            </span>
            <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              ⚡
            </span>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-4xl font-black text-white">{todayLeadsCount.value}</span>
            <span class="text-xs font-bold text-slate-500">solicitudes</span>
          </div>
        </div>

        {/* Card 3 */}
        <div class="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-md backdrop-blur-md">
          <div class="flex items-center justify-between">
            <span class="text-xs font-black tracking-widest text-slate-400 uppercase">
              Tasa Aceptación
            </span>
            <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              📈
            </span>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="text-4xl font-black text-white">100%</span>
            <span class="text-xs font-bold text-slate-500">objetivo</span>
          </div>
        </div>
      </div>

      {/* Main List */}
      {leads.value.length === 0 ? (
        <div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/10 py-16 px-4 text-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-3xl mb-4">
            🎉
          </div>
          <h3 class="text-lg font-black text-white uppercase tracking-widest">
            ¡Todo al día!
          </h3>
          <p class="mt-2 text-sm text-slate-500 font-semibold max-w-sm">
            No tienes ninguna solicitud pendiente de invitados por el momento.
          </p>
        </div>
      ) : (
        <div class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/30 shadow-md backdrop-blur-xs">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-left text-sm">
              <thead>
                <tr class="border-b border-slate-800 bg-slate-950/40 text-xs font-black tracking-widest text-slate-400 uppercase">
                  <th class="py-4 px-6">Cliente</th>
                  <th class="py-4 px-6">Cancha / Deporte</th>
                  <th class="py-4 px-6">Fecha y Hora</th>
                  <th class="py-4 px-6">Monto / Pago</th>
                  <th class="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60">
                {leads.value.map((lead: any) => {
                  const b = lead.booking;
                  const g = lead.guest;
                  
                  const startTime = new Date(b.startTime);
                  const endTime = new Date(b.endTime);

                  const durationMinutes = Math.round(
                    (endTime.getTime() - startTime.getTime()) / 60000,
                  );

                  const dateFormatted = startTime.toLocaleDateString("es-AR", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    timeZone: "America/Argentina/Buenos_Aires",
                  });

                  const timeFormatted = startTime.toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Argentina/Buenos_Aires",
                  });

                  const endTimeFormatted = endTime.toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Argentina/Buenos_Aires",
                  });

                  // WhatsApp custom contact message
                  const waMessage = `Hola ${g?.name || "Invitado"}! Te contactamos de ${data.value.clubName} por tu solicitud de reserva para la cancha ${lead.pitch?.name || "Cancha"} el día ${startTime.toLocaleDateString("es-AR")} a las ${timeFormatted}. ¿Confirmamos la reserva?`;
                  const waLink = `https://wa.me/${g?.phone?.replace(/\D/g, "")}?text=${encodeURIComponent(waMessage)}`;

                  return (
                    <tr
                      key={b.id}
                      class="transition-colors hover:bg-slate-900/35"
                    >
                      {/* Cliente */}
                      <td class="py-5 px-6">
                        <div class="font-black text-white">{g?.name || "Invitado"}</div>
                        <div class="flex items-center gap-2 mt-1 text-slate-400">
                          <span class="text-xs font-semibold">{g?.phone}</span>
                          {g?.email && (
                            <>
                              <span class="text-slate-600">•</span>
                              <span class="text-xs truncate font-medium text-slate-500 max-w-[150px]" title={g.email}>
                                {g.email}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Cancha */}
                      <td class="py-5 px-6">
                        <span class="inline-flex items-center rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-black tracking-wide text-emerald-400 uppercase ring-1 ring-emerald-500/20">
                          {lead.pitch?.name || "Cancha"}
                        </span>
                      </td>

                      {/* Horario */}
                      <td class="py-5 px-6">
                        <div class="font-bold text-white capitalize">{dateFormatted}</div>
                        <div class="mt-1 text-xs font-semibold text-slate-400">
                          {timeFormatted} a {endTimeFormatted} ({durationMinutes} mins)
                        </div>
                      </td>

                      {/* Precio / Pago */}
                      <td class="py-5 px-6">
                        <div class="font-black text-white">
                          ${b.totalPrice.toLocaleString("es-AR")}
                        </div>
                        <div class="mt-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-400">
                          <span>{b.paymentMethod === "CASH" ? "Efectivo" : b.paymentMethod}</span>
                          <span class="text-slate-600">•</span>
                          <span>Pendiente</span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td class="py-5 px-6">
                        <div class="flex items-center justify-end gap-2.5">
                          {/* WhatsApp contact shortcut */}
                          <a
                            href={waLink}
                            target="_blank"
                            class="flex h-9 w-9 items-center justify-center rounded-xl border border-[#25D366]/20 bg-[#25D366]/5 text-[#25D366] transition-all hover:bg-[#25D366]/15 active:scale-[0.95]"
                            title="Contactar por WhatsApp"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              class="h-4.5 w-4.5 fill-current"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.884-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                          </a>

                          {/* Approve Action */}
                          <Form action={updateStatusAction}>
                            <input type="hidden" name="bookingId" value={b.id} />
                            <input type="hidden" name="action" value="APPROVE" />
                            <button
                              type="submit"
                              class="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black tracking-wider text-white uppercase shadow-sm shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-[0.95]"
                            >
                              Aprobar
                            </button>
                          </Form>

                          {/* Reject Action */}
                          <Form action={updateStatusAction}>
                            <input type="hidden" name="bookingId" value={b.id} />
                            <input type="hidden" name="action" value="REJECT" />
                            <button
                              type="submit"
                              preventdefault:click
                              onClick$={$(async (e, el) => {
                                if (window.confirm("¿Estás seguro de rechazar y anular esta solicitud?")) {
                                  el.closest("form")?.submit();
                                }
                              })}
                              class="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs font-black tracking-wider text-red-400 uppercase transition-all hover:bg-red-500/10 active:scale-[0.95]"
                            >
                              Rechazar
                            </button>
                          </Form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});
