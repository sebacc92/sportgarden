import { component$, Slot, useSignal, $ } from "@builder.io/qwik";
import {
  Link,
  useLocation,
  routeLoader$,
  server$,
} from "@builder.io/qwik-city";
import { getDB, camelize } from "~/db";
import { siteSettings, users, cashRegisters, bookings } from "~/db/schema";
import logo from "../../media/GardenClubFutbol8.png";
import { LuUserCog, LuUsers } from "@qwikest/icons/lucide";

export const useAdminUser = routeLoader$(async (requestEvent) => {
  const isLogin = requestEvent.url.pathname.startsWith("/admin/login");
  if (isLogin) return null;

  const db = getDB(requestEvent);
  const adminId = requestEvent.cookie.get("auth_session")?.value;
  if (!adminId) throw requestEvent.redirect(302, "/admin/login/");
  const { data: userData, error } = await db
    .from(users)
    .select("role, name")
    .eq("id", adminId)
    .maybeSingle();

  if (error || !userData) {
    requestEvent.cookie.delete("auth_session", { path: "/" });
    throw requestEvent.redirect(302, "/admin/login/");
  }
  return camelize<any>(userData);
});

export const useSiteSettings = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const { data, error } = await db
    .from(siteSettings)
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return camelize<any>(data);
});

export const useOpenRegister = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  const { data, error } = await db
    .from(cashRegisters)
    .select("id, opened_at")
    .eq("status", "OPEN")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const openRegister = camelize<any>(data);
  return {
    id: openRegister.id,
    openedAt: new Date(openRegister.openedAt).toISOString(),
  };
});

export const usePendingLeadsCount = routeLoader$(async (requestEvent) => {
  try {
    const db = getDB(requestEvent);
    const { count, error } = await db
      .from(bookings)
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL");

    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    console.error("Error fetching pending leads count:", error);
    return 0;
  }
});

export const updateClubStatus = server$(async function (status: string) {
  const db = getDB(this);
  const { error } = await db
    .from(siteSettings)
    .update({
      club_status: status as "OPEN" | "CLOSED" | "AUTO",
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) throw error;
  return { success: true };
});

export default component$(() => {
  const loc = useLocation();
  const isCollapsed = useSignal(false);
  const settings = useSiteSettings();
  const adminUser = useAdminUser();
  const openRegister = useOpenRegister();
  const pendingLeadsCount = usePendingLeadsCount();
  const userRole = adminUser.value?.role ?? "GUEST";

  const navItems = [
    {
      name: "Reservas",
      href: "/admin/calendar/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER", "EMPLOYEE"],
    },
    {
      name: "Solicitudes",
      href: "/admin/leads/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER", "EMPLOYEE"],
      badgeCount: pendingLeadsCount,
    },
    {
      name: "Perfil del Club",
      href: "/admin/club/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <path d="M3 21h18"></path>
          <path d="M3 7v1a3 3 0 0 0 6 0V7m6 0v1a3 3 0 0 0 6 0V7m-6 0h6m-6 0a3 3 0 0 0-6 0m6 0v12m-6-12v12"></path>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"],
    },
    {
      name: "Canchas",
      href: "/admin/pitches/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <path d="M12 22v-7l-2-2"></path>
          <path d="M12 22v-7l2-2"></path>
          <path d="M22 10a9 9 0 0 0-18 0c0 4 3 6 8 11.5 5-5.5 8-7.5 8-11.5z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"],
    },
    {
      name: "Caja",
      href: "/admin/cash/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"],
    },
    {
      name: "Escuelita",
      href: "/admin/escuelita/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"],
    },
    {
      name: "Abonos fijos",
      href: "/admin/subscriptions/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
          <path d="m9 16 2 2 4-4" />
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"],
    },
    {
      name: "Cuentas Ctes.",
      href: "/admin/groups/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"],
    },
    {
      name: "Asistente IA",
      href: "/admin/ia/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"],
    },
    {
      name: "Galería",
      href: "/admin/gallery/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
    },
    {
      name: "Tienda / Stock",
      href: "/admin/store/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"],
    },
    {
      name: "Contenido Web",
      href: "/admin/contenido/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"],
    },
    {
      name: "Clientes",
      href: "/admin/clients/",
      icon: <LuUsers class="h-5 w-5 shrink-0" />,
      roles: ["DEV", "OWNER", "MANAGER", "EMPLOYEE"],
    },
    {
      name: "Staff",
      href: "/admin/users/",
      icon: <LuUserCog class="h-5 w-5 shrink-0" />,
      roles: ["DEV", "OWNER", "MANAGER"],
    },
    {
      name: "Ir al Sitio",
      href: "/",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER", "EMPLOYEE"],
    },
  ];

  const visibleNavItems = navItems.filter((item) =>
    item.roles?.includes(userRole),
  );

  return (
    <div class="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside
        class={[
          "relative z-50 flex shrink-0 flex-col bg-slate-950 text-slate-300 shadow-xl transition-all duration-300 print:hidden",
          isCollapsed.value ? "w-20" : "w-64",
        ]}
      >
        {/* Toggle Button */}
        <button
          onClick$={() => (isCollapsed.value = !isCollapsed.value)}
          class="absolute top-6 -right-3 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 shadow-md transition-colors hover:bg-slate-700"
          title={isCollapsed.value ? "Expandir" : "Colapsar"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class={[
              "transition-transform duration-300",
              isCollapsed.value ? "rotate-180" : "",
            ]}
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div class="flex h-20 items-center overflow-hidden border-b border-white/5 px-6">
          {isCollapsed.value ? (
            <div class="flex w-full justify-center">
              <img
                src={logo}
                alt="SG"
                width={40}
                height={40}
                class="h-10 w-auto object-contain"
              />
            </div>
          ) : (
            <div class="flex items-center gap-3">
              <img
                src={logo}
                alt="GardenClubFutbol"
                width={40}
                height={40}
                class="h-10 w-auto object-contain"
              />
              <div class="text-xl font-black tracking-tighter whitespace-nowrap text-white uppercase">
                Sport<span class="text-emerald-400">Garden</span>
              </div>
            </div>
          )}
        </div>

        {/* Club Status Indicator */}
        <div
          class={[
            "border-b border-white/5 px-6 py-4 transition-all duration-300",
            isCollapsed.value
              ? "h-0 overflow-hidden py-0 opacity-0"
              : "opacity-100",
          ]}
        >
          {(() => {
            if (!settings.value) return null;

            const currentStatus = settings.value.clubStatus;
            const hours = settings.value.operatingHours as any[];

            const calculateAutoStatus = () => {
              const now = new Date();
              const day = now.getDay();
              const hour =
                now.getHours().toString().padStart(2, "0") +
                ":" +
                now.getMinutes().toString().padStart(2, "0");
              const dayData = hours?.[day];
              return (
                dayData?.isOpen &&
                hour >= dayData.openTime &&
                hour <= dayData.closeTime
              );
            };

            const isOpen =
              currentStatus === "OPEN" ||
              (currentStatus === "AUTO" && calculateAutoStatus());

            const handleStatusChange = $(async () => {
              const nextStatus =
                currentStatus === "AUTO"
                  ? "CLOSED"
                  : currentStatus === "CLOSED"
                    ? "OPEN"
                    : "AUTO";
              const labels: any = {
                AUTO: "Cerrado (Manual)",
                CLOSED: "Abierto (Manual)",
                OPEN: "Automático",
              };
              const confirmMsg = `¿Estás seguro de cambiar el estado a ${labels[currentStatus]}?`;

              if (window.confirm(confirmMsg)) {
                await updateClubStatus(nextStatus);
                window.location.reload();
              }
            });

            return (
              <div class="flex items-center justify-between px-1">
                <div class="flex items-center gap-2">
                  <div
                    class={[
                      "h-2 w-2 rounded-full",
                      isOpen
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(0,20,7,0.45)]"
                        : "animate-pulse bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]",
                    ]}
                  ></div>
                  <span class="text-xs font-black tracking-widest text-slate-400 uppercase">
                    Estado
                  </span>
                </div>

                <button
                  onClick$={handleStatusChange}
                  title={`Modo actual: ${currentStatus === "AUTO" ? "Automático" : "Manual"}`}
                  class={[
                    "group flex items-center gap-1.5 rounded-md px-2 py-1 transition-all",
                    isOpen
                      ? "bg-emerald-500/10 hover:bg-emerald-500/20"
                      : "bg-red-500/10 hover:bg-red-500/20",
                  ]}
                >
                  <span
                    class={[
                      "text-[10px] font-black tracking-tighter uppercase",
                      isOpen ? "text-emerald-400" : "text-red-400",
                    ]}
                  >
                    {isOpen ? "Abierto" : "Cerrado"}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-slate-500 opacity-50 transition-colors group-hover:text-white"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
              </div>
            );
          })()}
        </div>

        <nav class="flex-1 space-y-1 overflow-x-hidden px-4 py-6">
          <div
            class={[
              "mb-4 px-2 text-xs font-bold tracking-wider text-slate-500 uppercase transition-all",
              isCollapsed.value ? "mb-0 h-0 opacity-0" : "opacity-100",
            ]}
          >
            {!isCollapsed.value && "Administración"}
          </div>

          {visibleNavItems.map((item) => {
            let isActive = false;
            if (item.href === "/admin/") {
              isActive =
                loc.url.pathname === "/admin" || loc.url.pathname === "/admin/";
            } else if (item.href === "/admin/ia/") {
              isActive =
                loc.url.pathname.startsWith("/admin/ia") ||
                loc.url.pathname.startsWith("/admin/chats");
            } else if (item.href !== "/") {
              isActive = loc.url.pathname.startsWith(item.href);
            }

            const badgeCountVal = (item as any).badgeCount?.value ?? 0;

            return (
              <Link
                key={item.name}
                href={item.href}
                title={isCollapsed.value ? item.name : ""}
                class={[
                  "flex items-center overflow-hidden rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  isCollapsed.value ? "justify-center p-3" : "px-4 py-3",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "hover:bg-white/5 hover:text-white",
                ]}
              >
                <div class="relative flex items-center shrink-0">
                  {item.icon}
                  {isCollapsed.value && badgeCountVal > 0 && (
                    <span class="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-white ring-2 ring-slate-950">
                      {badgeCountVal}
                    </span>
                  )}
                </div>
                <span
                  class={[
                    "ml-3 flex-1 flex items-center justify-between transition-opacity duration-200",
                    isCollapsed.value ? "hidden opacity-0" : "opacity-100",
                  ]}
                >
                  <span>{item.name}</span>
                  {!isCollapsed.value && badgeCountVal > 0 && (
                    <span class="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
                      {badgeCountVal}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        <div class="overflow-hidden border-t border-white/5 p-4">
          <div
            class={[
              "flex items-center",
              isCollapsed.value ? "justify-center" : "gap-3 px-2",
            ]}
          >
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">
              A
            </div>
            {!isCollapsed.value && (
              <div class="whitespace-nowrap">
                <div class="text-sm font-medium text-white">Admin</div>
                <div class="text-xs text-slate-500">Administrador</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content (Slot) */}
      <div class="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Global Warning for Stale Cash Register */}
        {openRegister.value &&
          !loc.url.pathname.startsWith("/admin/login") &&
          (() => {
            const openedDate = new Date(openRegister.value.openedAt);
            const today = new Date();
            const openedYMD = `${openedDate.getFullYear()}-${String(openedDate.getMonth() + 1).padStart(2, "0")}-${String(openedDate.getDate()).padStart(2, "0")}`;
            const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

            if (openedYMD !== todayYMD && openedDate < today) {
              return (
                <div class="z-20 flex shrink-0 items-center justify-between gap-4 bg-amber-500 px-8 py-3 text-white shadow-lg print:hidden">
                  <div class="flex items-center gap-4">
                    <div class="rounded-xl bg-white/20 p-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                      </svg>
                    </div>
                    <div>
                      <div class="mb-1 text-xs leading-none font-black tracking-widest uppercase">
                        Advertencia: Caja Abierta de ayer
                      </div>
                      <div class="text-sm font-medium opacity-90">
                        La caja se abrió el{" "}
                        <strong>
                          {openedDate.toLocaleDateString("es-AR")}
                        </strong>
                        . Ciérrala para separar los ingresos de hoy.
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/admin/cash"
                    class="rounded-xl bg-white px-5 py-2 text-xs font-black tracking-widest text-amber-600 uppercase shadow-sm transition-all hover:bg-amber-50"
                  >
                    Gestionar Caja
                  </Link>
                </div>
              );
            }
            return null;
          })()}
        <Slot />
      </div>
    </div>
  );
});
