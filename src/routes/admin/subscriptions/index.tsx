import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
  server$,
} from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { pitchSubscriptions, pitches, bookings, users, groups } from "~/db/schema";
import { isPitchAvailable } from "~/utils/availability";
import { Button, Modal } from "~/components/ui";
import { toBALocalISOString } from "~/routes/admin/calendar/utils";

export const useSubscriptionsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);

  const { data: allPitches, error: pitchesErr } = await db
    .from(pitches)
    .select("*")
    .eq("is_active", true);

  if (pitchesErr) throw pitchesErr;

  const { data: subsData, error: subsErr } = await db
    .from(pitchSubscriptions)
    .select(`
      *,
      pitch:pitches(*),
      user:users(*),
      group:groups(*)
    `)
    .order("created_at", { ascending: false });

  if (subsErr) throw subsErr;

  return {
    pitches: camelize<any[]>(allPitches || []),
    subscriptions: camelize<any[]>(subsData || []),
  };
});

export const searchOwnersServer = server$(async function (
  query: string,
  type: "USER" | "GROUP",
) {
  if (!query || query.length < 2) return [];
  const db = getDB(this as any);
  const pattern = `%${query}%`;

  if (type === "USER") {
    const { data, error } = await db
      .from(users)
      .select("id, name, phone, email")
      .or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
      .limit(10);
    if (error) throw error;
    return camelize<any[]>(data || []);
  } else {
    const { data, error } = await db
      .from(groups)
      .select("id, name, contact_name, contact_phone")
      .or(`name.ilike.${pattern},contact_name.ilike.${pattern},contact_phone.ilike.${pattern}`)
      .limit(10);
    if (error) throw error;
    return camelize<any[]>(data || []);
  }
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

    const warnings: string[] = [];
    let count = 0;
    while (current <= endDate && count < 52) {
      // Use BA date string from current (which is at noon BA time) to avoid UTC date shift
      const baDateStr = current.toISOString().split("T")[0];
      const startDateTime = new Date(`${baDateStr}T${data.startTime}:00-03:00`);
      const endDateTime = new Date(`${baDateStr}T${data.endTime}:00-03:00`);

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
      } else {
        const formattedDate = baDateStr.split("-").reverse().join("/");
        warnings.push(`${formattedDate} ${data.startTime} - ${data.endTime}`);
      }
      current.setDate(current.getDate() + 7);
      count++;
    }

    const { error: subErr } = await db.from(pitchSubscriptions).insert({
      id: subId,
      pitch_id: data.pitchId,
      user_id: userId,
      group_id: groupId,
      day_of_week: Number(data.dayOfWeek),
      start_time: data.startTime,
      end_time: data.endTime,
      start_date: startDate.toISOString(),
      price_per_match: Number(data.pricePerMatch),
      is_active: true,
    });

    if (subErr) {
      throw subErr;
    }

    if (datesToBook.length > 0) {
      // Use toBALocalISOString to store times consistently with the rest of the app
      const snakizedBookings = datesToBook.map((b) => ({
        id: b.id,
        user_id: b.userId,
        group_id: b.groupId,
        pitch_id: b.pitchId,
        start_time: toBALocalISOString(b.startTime),
        end_time: toBALocalISOString(b.endTime),
        status: b.status,
        booking_type: b.bookingType,
        is_subscription: b.isSubscription,
        total_price: b.totalPrice,
        paid_amount: b.paidAmount,
        payment_status: b.paymentStatus,
        payment_method: b.paymentMethod,
        notes: b.notes,
      }));

      const CHUNK_SIZE = 50;
      for (let i = 0; i < snakizedBookings.length; i += CHUNK_SIZE) {
        const chunk = snakizedBookings.slice(i, i + CHUNK_SIZE);
        const { error: bookErr } = await db.from(bookings).insert(chunk);
        if (bookErr) throw bookErr;
      }
    }

    return { success: true, warnings: warnings.length > 0 ? warnings : undefined };
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

    const { data: subData, error: getSubErr } = await db
      .from(pitchSubscriptions)
      .select("*")
      .eq("id", data.subscriptionId)
      .maybeSingle();

    if (getSubErr) throw getSubErr;

    if (subData) {
      const sub = camelize<any>(subData);
      const newIsActive = !sub.isActive;

      const { error: updSubErr } = await db
        .from(pitchSubscriptions)
        .update({
          is_active: newIsActive,
          end_date: newIsActive ? null : new Date().toISOString(),
        })
        .eq("id", sub.id);

      if (updSubErr) throw updSubErr;

      const now = new Date().toISOString();

      if (!newIsActive) {
        // Cancelling: Set all future un-paid bookings for this sub to CANCELLED
        const { error: cancelErr } = await db
          .from(bookings)
          .update({ status: "CANCELLED" })
          .eq("notes", `subscription:${sub.id}`)
          .gte("start_time", now)
          .eq("payment_status", "PENDING")
          .eq("status", "CONFIRMED");

        if (cancelErr) throw cancelErr;
      } else {
        // Reactivating: Set future CANCELLED bookings back to CONFIRMED if available
        const { data: futureBookingsData, error: getFutureErr } = await db
          .from(bookings)
          .select("*")
          .eq("notes", `subscription:${sub.id}`)
          .gte("start_time", now)
          .eq("status", "CANCELLED");

        if (getFutureErr) throw getFutureErr;

        const futureBookings = camelize<any[]>(futureBookingsData || []);

        for (const b of futureBookings) {
          const { available } = await isPitchAvailable(db, {
            pitchId: b.pitchId,
            startTime: new Date(b.startTime),
            endTime: new Date(b.endTime),
            excludeBookingId: b.id,
          });
          if (available) {
            const { error: reactivateErr } = await db
              .from(bookings)
              .update({ status: "CONFIRMED" })
              .eq("id", b.id);
            if (reactivateErr) throw reactivateErr;
          }
        }
      }
    }

    return { success: true };
  },
  zod$({
    subscriptionId: z.string(),
  }),
);

export const useEditSubscriptionAction = routeAction$(
  async (data, requestEvent) => {
    const db = getDB(requestEvent);

    const { error: updSubErr } = await db
      .from(pitchSubscriptions)
      .update({ price_per_match: Number(data.pricePerMatch) })
      .eq("id", data.subscriptionId);

    if (updSubErr) throw updSubErr;

    if (data.updateFutureBookings === "true") {
      const now = new Date().toISOString();
      const { error: updBookingsErr } = await db
        .from(bookings)
        .update({ total_price: Number(data.pricePerMatch) })
        .eq("notes", `subscription:${data.subscriptionId}`)
        .gte("start_time", now)
        .eq("payment_status", "PENDING");

      if (updBookingsErr) throw updBookingsErr;
    }

    return { success: true };
  },
  zod$({
    subscriptionId: z.string(),
    pricePerMatch: z.string(),
    updateFutureBookings: z.string().optional(),
  }),
);

export default component$(() => {
  const data = useSubscriptionsData();
  const createSubAction = useCreateSubscriptionAction();
  const toggleSubAction = useToggleSubscriptionAction();
  const editSubAction = useEditSubscriptionAction();

  const isModalOpen = useSignal(false);
  const ownerType = useSignal<"USER" | "GROUP">("USER");
  const searchTerm = useSignal("");
  const searchResults = useSignal<any[]>([]);
  const isSearching = useSignal(false);
  const selectedOwnerId = useSignal("");
  const selectedOwnerName = useSignal("");

  // Confirmation modal state
  const isConfirmModalOpen = useSignal(false);
  const pendingToggleSub = useSignal<any>(null);

  // Edit modal state
  const isEditModalOpen = useSignal(false);
  const editingSub = useSignal<any>(null);
  const editPrice = useSignal("");
  const editUpdateFuture = useSignal(true);

  // Search owner logic with debounce
  useTask$(({ track, cleanup }) => {
    const term = track(() => searchTerm.value);
    const type = track(() => ownerType.value);
    if (term.length >= 2) {
      isSearching.value = true;
      const id = setTimeout(() => {
        searchOwnersServer(term, type)
          .then((res) => {
            searchResults.value = res;
            isSearching.value = false;
          })
          .catch(() => {
            searchResults.value = [];
            isSearching.value = false;
          });
      }, 400);
      cleanup(() => clearTimeout(id));
    } else {
      searchResults.value = [];
      isSearching.value = false;
    }
  });

  // Close edit modal on success
  useTask$(({ track }) => {
    const success = track(() => editSubAction.value?.success);
    if (success) {
      isEditModalOpen.value = false;
      editingSub.value = null;
    }
  });

  // Close confirm modal on success
  useTask$(({ track }) => {
    const success = track(() => toggleSubAction.value?.success);
    if (success) {
      isConfirmModalOpen.value = false;
      pendingToggleSub.value = null;
    }
  });

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
    if (!day) return "Día Desconocido";
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
          <Button
            look="primary"
            onClick$={() => (isModalOpen.value = true)}
            class="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-bold text-white shadow-md shadow-emerald-100 transition-all hover:scale-[1.02] hover:bg-emerald-600 active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo Abono Fijo
          </Button>
        </div>

        {/* Subscriptions List */}
        <div class="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm w-full">
          <div class="overflow-auto p-0">
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50/80 text-xs font-black tracking-widest text-slate-400 uppercase">
                  <th class="p-4">Cancha</th>
                  <th class="p-4">Horario Fijo</th>
                  <th class="p-4">Titular</th>
                  <th class="p-4">Precio/Turno</th>
                  <th class="p-4">Estado</th>
                  <th class="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="text-sm font-semibold text-slate-700">
                {data.value.subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} class="p-8 text-center text-slate-500">
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
                        <div class="font-bold text-slate-800">
                          ${sub.pricePerMatch?.toLocaleString("es-AR")}
                        </div>
                      </td>
                      <td class="p-4">
                        <span
                          class={`rounded-md px-2 py-1 text-[10px] font-bold tracking-wider uppercase ${sub.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                        >
                          {sub.isActive ? "ACTIVO" : "CANCELADO"}
                        </span>
                      </td>
                      <td class="p-4">
                        <div class="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick$={() => {
                              editingSub.value = sub;
                              editPrice.value = String(sub.pricePerMatch ?? "");
                              editUpdateFuture.value = true;
                              isEditModalOpen.value = true;
                            }}
                            class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold tracking-wide text-slate-600 hover:bg-slate-200"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick$={() => {
                              pendingToggleSub.value = sub;
                              isConfirmModalOpen.value = true;
                            }}
                            class={`rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide ${sub.isActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-500 text-white hover:bg-emerald-600"}`}
                          >
                            {sub.isActive ? "Dar de baja" : "Reactivar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal.Root bind:show={isConfirmModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <div class="mb-5 flex items-start gap-4">
              <div class={`flex-shrink-0 rounded-xl p-3 ${pendingToggleSub.value?.isActive ? "bg-red-100" : "bg-emerald-100"}`}>
                {pendingToggleSub.value?.isActive ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-red-600">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
              <div>
                <h3 class="text-lg font-black text-slate-800">
                  {pendingToggleSub.value?.isActive ? "¿Dar de baja el abono?" : "¿Reactivar el abono?"}
                </h3>
                <p class="mt-1 text-sm text-slate-500">
                  {pendingToggleSub.value?.isActive
                    ? "Se cancelarán todas las reservas futuras pendientes de este abono."
                    : "Se reactivarán las reservas futuras disponibles de este abono."}
                </p>
                {pendingToggleSub.value && (
                  <div class="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm">
                    <div class="font-bold text-slate-800">{pendingToggleSub.value.pitch?.name}</div>
                    <div class="text-xs text-slate-500">
                      {formatDayOfWeek(pendingToggleSub.value.dayOfWeek)} · {pendingToggleSub.value.startTime} - {pendingToggleSub.value.endTime}
                    </div>
                    <div class="text-xs text-slate-500">
                      {pendingToggleSub.value.user?.name || pendingToggleSub.value.group?.name || "Desconocido"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Form action={toggleSubAction} class="flex flex-col gap-3">
              <input type="hidden" name="subscriptionId" value={pendingToggleSub.value?.id ?? ""} />
              <div class="flex gap-3">
                <Button
                  type="button"
                  look="ghost"
                  onClick$={() => {
                    isConfirmModalOpen.value = false;
                    pendingToggleSub.value = null;
                  }}
                  class="flex-1 rounded-xl border border-slate-200 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={toggleSubAction.isRunning}
                  class={`flex-1 rounded-xl py-2.5 font-bold text-white ${pendingToggleSub.value?.isActive ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
                >
                  {toggleSubAction.isRunning
                    ? "Procesando..."
                    : pendingToggleSub.value?.isActive
                      ? "Sí, dar de baja"
                      : "Sí, reactivar"}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Edit Modal */}
      <Modal.Root bind:show={isEditModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <div class="mb-5 flex items-center justify-between">
              <h3 class="text-xl font-black text-slate-800">Editar Abono</h3>
              <button
                type="button"
                onClick$={() => {
                  isEditModalOpen.value = false;
                  editingSub.value = null;
                }}
                class="p-2 text-slate-400 transition-colors hover:text-slate-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {editingSub.value && (
              <div class="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm">
                <div class="font-bold text-slate-800">{editingSub.value.pitch?.name}</div>
                <div class="text-xs text-slate-500">
                  {formatDayOfWeek(editingSub.value.dayOfWeek)} · {editingSub.value.startTime} - {editingSub.value.endTime}
                </div>
                <div class="text-xs text-slate-500">
                  {editingSub.value.user?.name || editingSub.value.group?.name || "Desconocido"}
                </div>
              </div>
            )}

            {editSubAction.value?.success && (
              <div class="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                Abono actualizado correctamente.
              </div>
            )}

            <Form action={editSubAction} class="space-y-4">
              <input type="hidden" name="subscriptionId" value={editingSub.value?.id ?? ""} />

              <div>
                <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Precio por Turno *
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="pricePerMatch"
                  value={editPrice.value}
                  onInput$={(_, el) => (editPrice.value = el.value)}
                  required
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <label class="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  name="updateFutureBookings"
                  value="true"
                  checked={editUpdateFuture.value}
                  onChange$={(_, el) => (editUpdateFuture.value = el.checked)}
                  class="h-4 w-4 rounded border-slate-300 accent-emerald-500"
                />
                <span class="text-sm font-semibold text-slate-700">
                  Actualizar precio en reservas futuras pendientes
                </span>
              </label>

              <div class="flex gap-3 pt-1">
                <Button
                  type="button"
                  look="ghost"
                  onClick$={() => {
                    isEditModalOpen.value = false;
                    editingSub.value = null;
                  }}
                  class="flex-1 rounded-xl border border-slate-200 py-2.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={editSubAction.isRunning}
                  class="flex-1 rounded-xl bg-slate-800 py-2.5 font-bold text-white hover:bg-slate-900"
                >
                  {editSubAction.isRunning ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Panel>
      </Modal.Root>

      {/* Modal para Crear Abono Fijo */}
      <Modal.Root bind:show={isModalOpen}>
        <Modal.Panel class="relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
          <div class="p-6">
            <div class="mb-6 flex items-center justify-between">
              <h3 class="text-xl font-black text-slate-800">
                Nuevo Abono Fijo
              </h3>
              <button
                onClick$={() => (isModalOpen.value = false)}
                class="p-2 text-slate-400 transition-colors hover:text-slate-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {createSubAction.value?.success && (
              <div class="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-bold text-emerald-600">
                Abono creado correctamente.
              </div>
            )}

            <Form
              action={createSubAction}
              class="space-y-4"
              onSubmitCompleted$={() => {
                if (createSubAction.value?.success) {
                  const warnings = createSubAction.value?.warnings;
                  if (warnings && warnings.length > 0) {
                    alert(
                      `Abono creado con éxito.\n\n⚠️ Se omitieron las siguientes fechas por conflicto:\n- ${warnings.join("\n- ")}`
                    );
                  }
                  isModalOpen.value = false;
                  selectedOwnerId.value = "";
                  selectedOwnerName.value = "";
                  searchTerm.value = "";
                }
              }}
            >
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

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Tipo Titular
                  </label>
                  <select
                    name="ownerType"
                    id="ownerType"
                    value={ownerType.value}
                    onChange$={(e, el) => {
                      ownerType.value = el.value as "USER" | "GROUP";
                      selectedOwnerId.value = "";
                      selectedOwnerName.value = "";
                      searchTerm.value = "";
                      searchResults.value = [];
                    }}
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="USER">Usuario</option>
                    <option value="GROUP">Grupo/Escuela</option>
                  </select>
                </div>

                <div class="relative">
                  <label class="mb-1 block text-xs font-bold tracking-wider text-slate-500 uppercase">
                    Buscar Titular *
                  </label>
                  <div class="relative">
                    <input
                      type="text"
                      value={searchTerm.value}
                      onInput$={(_, el) => (searchTerm.value = el.value)}
                      placeholder={
                        ownerType.value === "USER"
                          ? "Buscar por nombre o tel..."
                          : "Buscar por nombre..."
                      }
                      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    {isSearching.value && (
                      <div class="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500"></div>
                    )}
                  </div>

                  {searchTerm.value.length >= 2 && !selectedOwnerId.value && (
                    <div class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {searchResults.value.length > 0 ? (
                        searchResults.value.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick$={() => {
                              selectedOwnerId.value = item.id;
                              selectedOwnerName.value =
                                ownerType.value === "USER"
                                  ? `${item.name} ${item.phone ? `(${item.phone})` : ""}`.trim()
                                  : item.name;
                              searchTerm.value = "";
                              searchResults.value = [];
                            }}
                            class="flex w-full flex-col border-b border-slate-50 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                          >
                            <span class="text-sm font-bold text-slate-800">
                              {item.name}
                            </span>
                            {ownerType.value === "USER" && (
                              <span class="text-[11px] text-slate-400">
                                {item.phone || item.email}
                              </span>
                            )}
                            {ownerType.value === "GROUP" && item.contactName && (
                              <span class="text-[11px] text-slate-400">
                                Contacto: {item.contactName}
                              </span>
                            )}
                          </button>
                        ))
                      ) : !isSearching.value ? (
                        <div class="px-4 py-3 text-center text-xs font-semibold text-slate-400">
                          Sin resultados
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {selectedOwnerId.value && (
                <div class="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-2.5">
                  <div class="min-w-0 flex-1">
                    <div class="text-[10px] font-bold text-slate-400 uppercase">
                      Titular Seleccionado
                    </div>
                    <div class="truncate text-sm font-bold text-slate-800">
                      {selectedOwnerName.value}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick$={() => {
                      selectedOwnerId.value = "";
                      selectedOwnerName.value = "";
                      searchTerm.value = "";
                    }}
                    class="ml-2 rounded-lg bg-white p-1 text-slate-400 shadow-sm transition-colors hover:text-red-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
              <input
                type="hidden"
                name="ownerId"
                value={selectedOwnerId.value}
                required
              />

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
                    Seleccionar día...
                  </option>
                  {daysOfWeek.map((day, idx) => (
                    <option key={idx} value={idx}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div class="grid grid-cols-2 gap-4">
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

              <div class="grid grid-cols-2 gap-4">
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
                    Precio por Turno *
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
        </Modal.Panel>
      </Modal.Root>
    </div>
  );
});

export const head = {
  title: "Abonos - GardenClubFutbol",
};
