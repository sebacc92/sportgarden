import { component$, useSignal, $ } from "@builder.io/qwik";
import {
  routeLoader$,
  Link,
  useLocation,
  useNavigate,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { eq, inArray, desc, sql, like, or, and } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { LuSearch, LuChevronLeft, LuChevronRight } from "@qwikest/icons/lucide";

export const useAdminUser = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const adminId = requestEvent.cookie.get("auth_session")?.value;
  if (!adminId) throw requestEvent.redirect(302, "/admin/login");

  const user = await db.query.users.findFirst({
    where: eq(users.id, adminId),
  });

  if (!user || !["DEV", "OWNER", "MANAGER", "EMPLOYEE"].includes(user.role)) {
    throw requestEvent.redirect(302, "/admin");
  }

  return user;
});

export const useClientsData = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const url = new URL(requestEvent.request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const search = url.searchParams.get("search") || "";
  const tab = (url.searchParams.get("tab") || "INDIVIDUAL") as
    | "INDIVIDUAL"
    | "GROUP"
    | "SCHOOL";
  const limitNum = 20;
  const offsetNum = (page - 1) * limitNum;

  const baseWhere = and(
    inArray(users.role, ["REGISTERED", "GUEST"]),
    eq(users.clientType, tab),
  );
  const searchWhere = search
    ? or(
        like(users.name, `%${search}%`),
        like(users.email, `%${search}%`),
        like(users.phone, `%${search}%`),
      )
    : undefined;

  const finalWhere = searchWhere
    ? sql`${baseWhere} and ${searchWhere}`
    : baseWhere;

  const results = await db.query.users.findMany({
    where: finalWhere,
    orderBy: [desc(users.createdAt)],
    limit: limitNum,
    offset: offsetNum,
  });

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(finalWhere);
  const total = countResult[0].count;

  return {
    clients: results,
    total,
    page,
    totalPages: Math.ceil(total / limitNum) || 1,
  };
});

export const head: DocumentHead = { title: "Clientes | Admin" };

export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const clientsData = useClientsData();
  const searchInput = useSignal(loc.url.searchParams.get("search") || "");

  const currentTab = loc.url.searchParams.get("tab") || "INDIVIDUAL";

  const handleTabChange = $((tabId: string) => {
    const url = new URL(loc.url.toString());
    url.searchParams.set("tab", tabId);
    url.searchParams.set("page", "1");
    nav(url.pathname + url.search);
  });

  const getPageUrl = (pageNumber: number) => {
    const url = new URL(loc.url.toString());
    url.searchParams.set("page", pageNumber.toString());
    return url.pathname + url.search;
  };

  const tabs = [
    { id: "INDIVIDUAL", label: "Jugadores" },
    { id: "GROUP", label: "Equipos" },
    { id: "SCHOOL", label: "Escuelas" },
  ];

  const handleSearch = $(() => {
    const url = new URL(loc.url.toString());
    url.searchParams.set("search", searchInput.value);
    url.searchParams.set("page", "1");
    nav(url.pathname + url.search);
  });

  return (
    <div class="min-h-full overflow-auto bg-slate-50 p-6 font-sans text-slate-900">
      <header class="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 class="text-3xl font-black tracking-tighter text-slate-800 uppercase">
            Directorio de Clientes
          </h1>
          <p class="mt-1 text-sm font-medium text-slate-500">
            Lista completa de clientes registrados e invitados.
          </p>
        </div>

        <form
          onSubmit$={handleSearch}
          preventdefault:submit
          class="relative w-72"
        >
          <LuSearch class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput.value}
            onInput$={(_, el) => (searchInput.value = el.value)}
            placeholder="Buscar por nombre, correo..."
            class="w-full rounded-xl border border-slate-200 bg-white py-2 pr-4 pl-9 text-sm font-medium shadow-sm transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          />
        </form>
      </header>

      <div class="mb-6 flex gap-6 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick$={() => handleTabChange(t.id)}
            class={`relative -mb-[1px] border-b-2 pb-3 text-sm font-bold transition-colors ${currentTab === t.id ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div class="flex h-[calc(100vh-230px)] flex-col overflow-hidden rounded-[2rem] border bg-white shadow-sm">
        <div class="flex-1 overflow-auto">
          <table class="w-full border-collapse text-left">
            <thead class="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 shadow-sm">
              <tr>
                {currentTab !== "INDIVIDUAL" && (
                  <th class="px-6 py-4 text-xs font-black tracking-widest whitespace-nowrap text-slate-400 uppercase">
                    Organización
                  </th>
                )}
                <th class="px-6 py-4 text-xs font-black tracking-widest whitespace-nowrap text-slate-400 uppercase">
                  {currentTab === "INDIVIDUAL" ? "Nombre" : "Contacto"}
                </th>
                <th class="px-6 py-4 text-xs font-black tracking-widest whitespace-nowrap text-slate-400 uppercase">
                  Teléfono
                </th>
                <th class="px-6 py-4 text-xs font-black tracking-widest whitespace-nowrap text-slate-400 uppercase">
                  Email
                </th>
                <th class="px-6 py-4 text-xs font-black tracking-widest whitespace-nowrap text-slate-400 uppercase">
                  Tipo
                </th>
                <th class="px-6 py-4 text-right text-xs font-black tracking-widest whitespace-nowrap text-slate-400 uppercase">
                  Fecha Registro
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {clientsData.value.clients.length > 0 ? (
                clientsData.value.clients.map((client) => (
                  <tr
                    key={client.id}
                    class="transition-colors hover:bg-slate-50/50"
                  >
                    {currentTab !== "INDIVIDUAL" && (
                      <td class="px-6 py-4 font-bold text-slate-800">
                        {client.organizationName || "-"}
                      </td>
                    )}
                    <td
                      class={`px-6 py-4 ${currentTab === "INDIVIDUAL" ? "font-bold text-slate-800" : "text-sm text-slate-600"}`}
                    >
                      {client.name}
                    </td>
                    <td class="px-6 py-4 font-mono text-sm text-slate-600">
                      {client.phone || "-"}
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-500">
                      {client.email || "-"}
                    </td>
                    <td class="px-6 py-4">
                      <span
                        class={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-black tracking-widest uppercase ${client.role === "REGISTERED" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {client.role === "REGISTERED"
                          ? "Registrado"
                          : "Invitado"}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-right text-sm font-medium text-slate-500">
                      {client.createdAt
                        ? new Date(client.createdAt).toLocaleDateString("es-AR")
                        : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    class="px-6 py-12 text-center font-medium text-slate-400"
                  >
                    No se encontraron clientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div class="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div class="text-sm font-medium text-slate-500">
            Mostrando página{" "}
            <span class="font-bold text-slate-800">
              {clientsData.value.page}
            </span>{" "}
            de{" "}
            <span class="font-bold text-slate-800">
              {clientsData.value.totalPages}
            </span>
            <span class="ml-2 text-slate-400">
              ({clientsData.value.total} clientes en total)
            </span>
          </div>

          <div class="flex gap-2">
            <Link
              href={
                clientsData.value.page > 1
                  ? getPageUrl(clientsData.value.page - 1)
                  : "#"
              }
              class={`flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${clientsData.value.page > 1 ? "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900" : "cursor-not-allowed bg-slate-100 text-slate-400 opacity-50"}`}
              preventdefault:click={clientsData.value.page <= 1}
            >
              <LuChevronLeft class="h-4 w-4" /> Anterior
            </Link>

            <Link
              href={
                clientsData.value.page < clientsData.value.totalPages
                  ? getPageUrl(clientsData.value.page + 1)
                  : "#"
              }
              class={`flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${clientsData.value.page < clientsData.value.totalPages ? "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900" : "cursor-not-allowed bg-slate-100 text-slate-400 opacity-50"}`}
              preventdefault:click={
                clientsData.value.page >= clientsData.value.totalPages
              }
            >
              Siguiente <LuChevronRight class="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
});
