import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, Link, useLocation, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { eq, inArray, desc, sql, like, or } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { LuSearch, LuChevronLeft, LuChevronRight } from "@qwikest/icons/lucide";

export const useAdminUser = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const adminId = requestEvent.cookie.get('auth_session')?.value;
  if (!adminId) throw requestEvent.redirect(302, '/admin/login');
  
  const user = await db.query.users.findFirst({
    where: eq(users.id, adminId),
  });
  
  if (!user || !['DEV', 'OWNER', 'MANAGER', 'EMPLOYEE'].includes(user.role)) {
    throw requestEvent.redirect(302, '/admin');
  }
  
  return user;
});

export const useClientsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const url = new URL(requestEvent.request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const search = url.searchParams.get("search") || "";
  const limitNum = 20;
  const offsetNum = (page - 1) * limitNum;

  const baseWhere = inArray(users.role, ["REGISTERED", "GUEST"]);
  const searchWhere = search ? or(
    like(users.name, `%${search}%`),
    like(users.email, `%${search}%`),
    like(users.phone, `%${search}%`)
  ) : undefined;
  
  const finalWhere = searchWhere ? sql`${baseWhere} and ${searchWhere}` : baseWhere;

  const results = await db.query.users.findMany({
    where: finalWhere,
    orderBy: [desc(users.createdAt)],
    limit: limitNum,
    offset: offsetNum,
  });

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(users).where(finalWhere);
  const total = countResult[0].count;
  
  return {
    clients: results,
    total,
    page,
    totalPages: Math.ceil(total / limitNum) || 1
  };
});

export const head: DocumentHead = { title: "Clientes | Admin" };

export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const clientsData = useClientsData();
  const searchInput = useSignal(loc.url.searchParams.get("search") || "");

  const handleSearch = $(() => {
    const url = new URL(loc.url.toString());
    url.searchParams.set("search", searchInput.value);
    url.searchParams.set("page", "1");
    nav(url.pathname + url.search);
  });

  return (
    <div class="min-h-full bg-slate-50 text-slate-900 font-sans p-6 overflow-auto">
      <header class="mb-8 pb-4 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-black text-slate-800 tracking-tighter uppercase">Directorio de Clientes</h1>
          <p class="text-sm font-medium text-slate-500 mt-1">Lista completa de clientes registrados e invitados.</p>
        </div>
        
        <form onSubmit$={handleSearch} preventdefault:submit class="relative w-72">
          <LuSearch class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchInput.value}
            onInput$={(_, el) => searchInput.value = el.value}
            placeholder="Buscar por nombre, correo..."
            class="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-medium transition-all shadow-sm"
          />
        </form>
      </header>

      <div class="bg-white rounded-[2rem] border shadow-sm overflow-hidden flex flex-col h-[calc(100vh-180px)]">
        <div class="flex-1 overflow-auto">
          <table class="w-full text-left border-collapse">
            <thead class="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-sm">
              <tr>
                <th class="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Nombre</th>
                <th class="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Teléfono</th>
                <th class="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Email</th>
                <th class="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Tipo</th>
                <th class="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Fecha Registro</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {clientsData.value.clients.length > 0 ? (
                clientsData.value.clients.map((client) => (
                  <tr key={client.id} class="hover:bg-slate-50/50 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-800">{client.name}</td>
                    <td class="px-6 py-4 font-mono text-sm text-slate-600">{client.phone || '-'}</td>
                    <td class="px-6 py-4 text-sm text-slate-500">{client.email || '-'}</td>
                    <td class="px-6 py-4">
                      <span class={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${client.role === 'REGISTERED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {client.role === 'REGISTERED' ? 'Registrado' : 'Invitado'}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-right text-sm text-slate-500 font-medium">
                      {client.createdAt ? new Date(client.createdAt).toLocaleDateString('es-AR') : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} class="px-6 py-12 text-center text-slate-400 font-medium">
                    No se encontraron clientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div class="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div class="text-sm font-medium text-slate-500">
            Mostrando página <span class="font-bold text-slate-800">{clientsData.value.page}</span> de <span class="font-bold text-slate-800">{clientsData.value.totalPages}</span>
            <span class="ml-2 text-slate-400">({clientsData.value.total} clientes en total)</span>
          </div>
          
          <div class="flex gap-2">
            <Link
              href={clientsData.value.page > 1 ? `?page=${clientsData.value.page - 1}&search=${loc.url.searchParams.get("search") || ""}` : "#"}
              class={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${clientsData.value.page > 1 ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'}`}
              preventdefault:click={clientsData.value.page <= 1}
            >
              <LuChevronLeft class="w-4 h-4" /> Anterior
            </Link>
            
            <Link
              href={clientsData.value.page < clientsData.value.totalPages ? `?page=${clientsData.value.page + 1}&search=${loc.url.searchParams.get("search") || ""}` : "#"}
              class={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${clientsData.value.page < clientsData.value.totalPages ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'}`}
              preventdefault:click={clientsData.value.page >= clientsData.value.totalPages}
            >
              Siguiente <LuChevronRight class="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
});
