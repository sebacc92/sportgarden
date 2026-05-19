import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { bookings } from "~/db/schema";
import { eq, desc } from "drizzle-orm";

export const useUserBookingsLoader = routeLoader$(async (requestEvent) => {
  const user = requestEvent.sharedMap.get("user");
  if (!user) {
    throw requestEvent.redirect(302, "/auth/login?redirect=/cuenta");
  }

  const db = getDB(requestEvent);
  const list = await db.query.bookings.findMany({
    where: eq(bookings.userId, user.userId),
    orderBy: [desc(bookings.startTime)],
    with: {
      pitch: true,
    },
  });

  return list.map((b) => ({
    id: b.id,
    pitchName: b.pitch.name,
    pitchType: b.pitch.type,
    pitchSurface: b.pitch.surface,
    startTime: b.startTime.toISOString(),
    endTime: b.endTime.toISOString(),
    status: b.status,
    totalPrice: b.totalPrice,
    paidAmount: b.paidAmount,
    paymentStatus: b.paymentStatus,
    paymentMethod: b.paymentMethod,
    extras: (b.extras as any[]) || [],
  }));
});

export const useAccountUserLoader = routeLoader$((requestEvent) => {
  const user = requestEvent.sharedMap.get("user");
  if (!user) {
    throw requestEvent.redirect(302, "/auth/login?redirect=/cuenta");
  }
  return user as {
    userId: string;
    role: string;
    name: string;
    email: string;
    phone: string;
  };
});

export default component$(() => {
  const userBookings = useUserBookingsLoader();
  const user = useAccountUserLoader();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <span class="rounded-full border border-emerald-500/20 bg-emerald-500/15 px-3 py-1 text-xs font-bold tracking-wider text-emerald-400 uppercase">
            Confirmada
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span class="rounded-full border border-amber-500/20 bg-amber-500/15 px-3 py-1 text-xs font-bold tracking-wider text-amber-400 uppercase">
            Pendiente
          </span>
        );
      case "CANCELLED":
        return (
          <span class="rounded-full border border-red-500/20 bg-red-500/15 px-3 py-1 text-xs font-bold tracking-wider text-red-400 uppercase">
            Cancelada
          </span>
        );
      case "COMPLETED":
        return (
          <span class="rounded-full border border-blue-500/20 bg-blue-500/15 px-3 py-1 text-xs font-bold tracking-wider text-blue-400 uppercase">
            Completada
          </span>
        );
      default:
        return (
          <span class="text-slate-450 rounded-full border border-slate-500/20 bg-slate-500/15 px-3 py-1 text-xs font-bold tracking-wider uppercase">
            {status}
          </span>
        );
    }
  };

  const getPaymentBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case "PAID":
        return (
          <span class="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
            Pagado
          </span>
        );
      case "PARTIAL":
        return (
          <span class="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-400 uppercase">
            Seña abonada
          </span>
        );
      case "PENDING":
        return (
          <span class="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-red-400 uppercase">
            Impago
          </span>
        );
      default:
        return (
          <span class="rounded bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            {paymentStatus}
          </span>
        );
    }
  };

  return (
    <div class="min-h-screen bg-slate-950 pt-36 pb-20 font-sans text-white">
      {/* Navbar helper background */}
      <div class="fixed inset-x-0 top-0 z-40 h-28 bg-[#001407]"></div>

      <div class="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Account Header */}
        <div class="mb-8 flex flex-col items-start justify-between gap-4 border-b border-white/5 pb-8 md:flex-row md:items-center">
          <div>
            <h1 class="flex items-center gap-3 text-3xl font-black tracking-tight text-white">
              Mis Reservas
              <span class="text-emerald-450 rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-bold">
                {userBookings.value.length}{" "}
                {userBookings.value.length === 1 ? "turno" : "turnos"}
              </span>
            </h1>
            <p class="mt-1 text-sm text-slate-400">
              Hola, <span class="font-bold text-white">{user.value.name}</span>.
              Administra y revisa el estado de tus reservas.
            </p>
          </div>
          <div class="flex gap-3">
            <Link
              href="/#canchas"
              class="rounded-full bg-emerald-500 px-6 py-3 text-xs font-black tracking-widest text-white uppercase shadow-lg shadow-emerald-500/10 transition-all hover:-translate-y-0.5 hover:bg-emerald-600"
            >
              Reservar Cancha
            </Link>
            <form method="POST" action="/api/auth/logout">
              <button
                type="submit"
                class="rounded-full border border-white/5 bg-slate-900 px-6 py-3 text-xs font-black tracking-widest text-red-400 uppercase transition-all hover:bg-slate-800"
              >
                Cerrar Sesión
              </button>
            </form>
          </div>
        </div>

        {/* Bookings Grid/List */}
        {userBookings.value.length === 0 ? (
          <div class="mx-auto max-w-lg space-y-4 rounded-3xl border border-white/5 bg-slate-900/40 px-6 py-20 text-center">
            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-2xl font-black text-slate-500">
              ⚽
            </div>
            <h3 class="text-xl font-bold text-white">
              Aún no tienes turnos reservados
            </h3>
            <p class="mx-auto max-w-sm text-sm leading-relaxed text-slate-400">
              Reserva tu cancha de fútbol de forma rápida y sencilla en Garden
              Club. ¡Elige el día, el horario y juega con tus amigos!
            </p>
            <div class="pt-2">
              <Link
                href="/#canchas"
                class="inline-block rounded-full bg-emerald-500 px-6 py-3 text-xs font-black tracking-widest text-white uppercase transition-all hover:bg-emerald-600"
              >
                Ver Canchas Disponibles
              </Link>
            </div>
          </div>
        ) : (
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            {userBookings.value.map((booking) => (
              <div
                key={booking.id}
                class="flex flex-col justify-between space-y-4 rounded-2xl border border-white/5 bg-slate-900/60 p-5 transition-all duration-200 hover:border-emerald-500/20"
              >
                <div class="space-y-3">
                  {/* Header: Pitch and status */}
                  <div class="flex items-start justify-between">
                    <div>
                      <h4 class="text-lg font-black text-white">
                        {booking.pitchName}
                      </h4>
                      <span class="mt-1 inline-block rounded border border-emerald-500/10 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black tracking-wider text-emerald-400 uppercase">
                        {booking.pitchType} ({booking.pitchSurface})
                      </span>
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>

                  {/* Body: Date and Time */}
                  <div class="bg-slate-850/60 space-y-2 rounded-xl border border-white/5 p-3.5 text-sm font-bold text-slate-300">
                    <div class="flex items-center justify-between">
                      <span class="flex items-center gap-1.5 font-semibold text-slate-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        Fecha:
                      </span>
                      <span class="text-white">
                        {formatDate(booking.startTime)}
                      </span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="flex items-center gap-1.5 font-semibold text-slate-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Horario:
                      </span>
                      <span class="font-extrabold text-emerald-400 text-white">
                        {formatTime(booking.startTime)} -{" "}
                        {formatTime(booking.endTime)} hs
                      </span>
                    </div>
                  </div>

                  {/* Extras List */}
                  {booking.extras.length > 0 && (
                    <div class="space-y-1.5">
                      <span class="block text-[10px] font-black tracking-widest text-slate-500 uppercase">
                        Servicios contratados
                      </span>
                      <div class="flex flex-wrap gap-1.5">
                        {booking.extras.map((extra: any) => (
                          <span
                            key={extra.name}
                            class="rounded-lg border border-white/5 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300"
                          >
                            {extra.name} (+${extra.price})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer: Price summary & payments */}
                <div class="mt-4 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                  <div class="space-y-0.5">
                    <span class="block text-[10px] font-black tracking-widest text-slate-500 uppercase">
                      Monto total
                    </span>
                    <span class="text-xl font-black text-white">
                      ${booking.totalPrice}
                    </span>
                  </div>
                  <div class="space-y-1 text-right">
                    <span class="block">
                      {getPaymentBadge(booking.paymentStatus)}
                    </span>
                    {booking.paidAmount > 0 && (
                      <span class="block text-[10px] font-semibold text-slate-400">
                        Abonado hoy: ${booking.paidAmount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export const head = {
  title: "Mis Reservas - GardenClubFutbol",
};
