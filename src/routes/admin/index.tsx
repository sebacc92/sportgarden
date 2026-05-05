import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link } from "@builder.io/qwik-city";
import { eq, desc } from "drizzle-orm";
import { getDB } from "~/db";
import { bookings, pitches, users, guestRequests } from "~/db/schema";

export const useAdminStats = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  
  const allPitches = await db.query.pitches.findMany({
    where: eq(pitches.isActive, true)
  });
  
  const allBookings = await db.query.bookings.findMany();
  
  const pendingCount = allBookings.filter(b => b.status === "PENDING_APPROVAL").length;
  const confirmedCount = allBookings.filter(b => b.status === "CONFIRMED").length;

  // Fetch 9 most recent bookings
  const recentBookings = await db
    .select({
      id: bookings.id,
      startTime: bookings.startTime,
      pitchName: pitches.name,
      userName: users.name,
      guestName: guestRequests.name,
      status: bookings.status,
    })
    .from(bookings)
    .innerJoin(pitches, eq(bookings.pitchId, pitches.id))
    .leftJoin(users, eq(bookings.userId, users.id))
    .leftJoin(guestRequests, eq(bookings.id, guestRequests.bookingId))
    .orderBy(desc(bookings.startTime))
    .limit(9);

  return {
    activePitches: allPitches.length,
    pendingBookings: pendingCount,
    confirmedBookings: confirmedCount,
    recentBookings: recentBookings.map(b => ({
      ...b,
      customerName: b.guestName || b.userName || "Desconocido",
      // Convert Date to string for serialization if needed, 
      // but Qwik City loaders can handle Dates usually.
    })),
  };
});

export default component$(() => {
  const stats = useAdminStats();

  return (
    <div class="p-8 overflow-auto h-full bg-slate-50">
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-slate-800">Panel de Control</h1>
        <p class="text-slate-500 mt-1">Resumen del estado actual del club.</p>
      </header>

      {/* Stats Cards */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div class="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Pendientes</div>
            <div class="text-3xl font-black text-slate-800">{stats.value.pendingBookings}</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div class="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Confirmadas</div>
            <div class="text-3xl font-black text-slate-800">{stats.value.confirmedBookings}</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div class="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-500 uppercase tracking-wider">Canchas Activas</div>
            <div class="text-3xl font-black text-slate-800">{stats.value.activePitches}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Bookings List (Replacing previous "Ver Calendario" card) */}
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold text-slate-800">Últimos Partidos</h2>
            <Link href="/admin/calendar" class="text-emerald-600 text-sm font-bold hover:underline">Ver calendario completo</Link>
          </div>
          
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="divide-y divide-slate-100">
              {stats.value.recentBookings.length === 0 ? (
                <div class="p-8 text-center text-slate-500 italic">No hay reservas registradas.</div>
              ) : (
                stats.value.recentBookings.map((booking) => (
                  <div key={booking.id} class="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                    <div class="flex items-center gap-4">
                      <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      </div>
                      <div>
                        <div class="font-bold text-slate-800">{booking.customerName}</div>
                        <div class="text-xs text-slate-500 flex items-center gap-1">
                          <span>{booking.pitchName}</span>
                          <span class="text-slate-300">•</span>
                          <span>{booking.startTime.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                          <span class="text-slate-300">•</span>
                          <span>{booking.startTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })}hs</span>
                        </div>
                      </div>
                    </div>
                    <div>
                       <span class={[
                         "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                         booking.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-700" : 
                         booking.status === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-700" :
                         "bg-slate-100 text-slate-600"
                       ]}>
                         {booking.status === "CONFIRMED" ? "Confirmado" : booking.status === "PENDING_APPROVAL" ? "Pendiente" : "Otro"}
                       </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {stats.value.recentBookings.length > 0 && (
              <Link 
                href="/admin/calendar" 
                class="block w-full text-center py-3 bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors border-t border-slate-100"
              >
                VER TODOS LOS TURNOS
              </Link>
            )}
          </div>
        </section>

        {/* Quick Actions / Configuration */}
        <section>
          <h2 class="text-xl font-bold text-slate-800 mb-4">Configuración</h2>
          <div class="grid grid-cols-1 gap-4">
            <Link href="/admin/pitches" class="group flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-slate-100 group-hover:bg-emerald-50 text-slate-600 group-hover:text-emerald-600 rounded-xl flex items-center justify-center transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-7l-2-2"></path><path d="M12 22v-7l2-2"></path><path d="M22 10a9 9 0 0 0-18 0c0 4 3 6 8 11.5 5-5.5 8-7.5 8-11.5z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                </div>
                <div class="text-left">
                  <div class="font-bold text-slate-800">Gestionar Canchas</div>
                  <div class="text-sm text-slate-500">Agrega o modifica los campos y precios</div>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 group-hover:text-emerald-500 transition-colors"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </Link>

            <Link href="/" class="group flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 hover:border-slate-800 hover:shadow-md transition-all">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-slate-100 group-hover:bg-slate-800 text-slate-600 group-hover:text-white rounded-xl flex items-center justify-center transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </div>
                <div class="text-left">
                  <div class="font-bold text-slate-800">Ver Sitio Público</div>
                  <div class="text-sm text-slate-500">Abrir la página de reservas</div>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 group-hover:text-slate-800 transition-colors"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
});

export const head = {
  title: "Dashboard - Admin",
};
