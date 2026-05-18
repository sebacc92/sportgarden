import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { bookings, pitches } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "~/components/ui";

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
  return user as { userId: string; role: string; name: string; email: string; phone: string };
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
        return <span class="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Confirmada</span>;
      case "PENDING_APPROVAL":
        return <span class="bg-amber-500/15 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Pendiente</span>;
      case "CANCELLED":
        return <span class="bg-red-500/15 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Cancelada</span>;
      case "COMPLETED":
        return <span class="bg-blue-500/15 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Completada</span>;
      default:
        return <span class="bg-slate-500/15 text-slate-450 border border-slate-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  const getPaymentBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case "PAID":
        return <span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Pagado</span>;
      case "PARTIAL":
        return <span class="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Seña abonada</span>;
      case "PENDING":
        return <span class="bg-red-500/10 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Impago</span>;
      default:
        return <span class="bg-slate-500/10 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{paymentStatus}</span>;
    }
  };

  return (
    <div class="min-h-screen bg-slate-950 pb-20 font-sans text-white pt-36">
      {/* Navbar helper background */}
      <div class="fixed inset-x-0 top-0 z-40 h-28 bg-[#001407]"></div>

      <div class="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Account Header */}
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-8 mb-8 gap-4">
          <div>
            <h1 class="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Mis Reservas
              <span class="text-sm font-bold bg-emerald-500/20 text-emerald-450 px-3 py-1 rounded-full">
                {userBookings.value.length} {userBookings.value.length === 1 ? "turno" : "turnos"}
              </span>
            </h1>
            <p class="text-slate-400 text-sm mt-1">
              Hola, <span class="text-white font-bold">{user.value.name}</span>. Administra y revisa el estado de tus reservas.
            </p>
          </div>
          <div class="flex gap-3">
            <Link
              href="/#canchas"
              class="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3 transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-500/10"
            >
              Reservar Cancha
            </Link>
            <form method="POST" action="/api/auth/logout">
              <button
                type="submit"
                class="rounded-full bg-slate-900 border border-white/5 text-red-400 hover:bg-slate-800 font-black text-xs uppercase tracking-widest px-6 py-3 transition-all"
              >
                Cerrar Sesión
              </button>
            </form>
          </div>
        </div>

        {/* Bookings Grid/List */}
        {userBookings.value.length === 0 ? (
          <div class="text-center py-20 bg-slate-900/40 rounded-3xl border border-white/5 max-w-lg mx-auto px-6 space-y-4">
            <div class="w-16 h-16 bg-slate-800 text-slate-500 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
              ⚽
            </div>
            <h3 class="text-xl font-bold text-white">Aún no tienes turnos reservados</h3>
            <p class="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
              Reserva tu cancha de fútbol de forma rápida y sencilla en Garden Club. ¡Elige el día, el horario y juega con tus amigos!
            </p>
            <div class="pt-2">
              <Link
                href="/#canchas"
                class="inline-block rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3 transition-all"
              >
                Ver Canchas Disponibles
              </Link>
            </div>
          </div>
        ) : (
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userBookings.value.map((booking) => (
              <div
                key={booking.id}
                class="bg-slate-900/60 p-5 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all duration-200 space-y-4 flex flex-col justify-between"
              >
                <div class="space-y-3">
                  {/* Header: Pitch and status */}
                  <div class="flex justify-between items-start">
                    <div>
                      <h4 class="text-lg font-black text-white">{booking.pitchName}</h4>
                      <span class="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 px-2 py-0.5 rounded uppercase tracking-wider inline-block mt-1">
                        {booking.pitchType} ({booking.pitchSurface})
                      </span>
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>

                  {/* Body: Date and Time */}
                  <div class="bg-slate-850/60 p-3.5 rounded-xl border border-white/5 space-y-2 text-sm text-slate-300 font-bold">
                    <div class="flex justify-between items-center">
                      <span class="text-slate-500 font-semibold flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Fecha:
                      </span>
                      <span class="text-white">{formatDate(booking.startTime)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-slate-500 font-semibold flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Horario:
                      </span>
                      <span class="text-white text-emerald-400 font-extrabold">
                        {formatTime(booking.startTime)} - {formatTime(booking.endTime)} hs
                      </span>
                    </div>
                  </div>

                  {/* Extras List */}
                  {booking.extras.length > 0 && (
                    <div class="space-y-1.5">
                      <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Servicios contratados</span>
                      <div class="flex flex-wrap gap-1.5">
                        {booking.extras.map((extra: any) => (
                          <span
                            key={extra.name}
                            class="text-xs bg-slate-800 text-slate-300 border border-white/5 px-2.5 py-1 rounded-lg font-bold"
                          >
                            {extra.name} (+${extra.price})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer: Price summary & payments */}
                <div class="pt-3 border-t border-white/5 flex justify-between items-center gap-2 mt-4">
                  <div class="space-y-0.5">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Monto total</span>
                    <span class="text-xl font-black text-white">${booking.totalPrice}</span>
                  </div>
                  <div class="text-right space-y-1">
                    <span class="block">{getPaymentBadge(booking.paymentStatus)}</span>
                    {booking.paidAmount > 0 && (
                      <span class="text-[10px] text-slate-400 font-semibold block">
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
