import { component$, Slot, useSignal, $ } from "@builder.io/qwik";
import { Link, useLocation, routeLoader$, server$ } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { siteSettings, users } from "~/db/schema";
import logo from "../../media/SportGarden8.png";

export const useAdminUser = routeLoader$(async (requestEvent) => {
  const isLogin = requestEvent.url.pathname.startsWith('/admin/login');
  if (isLogin) return null;

  const db = getDB(requestEvent);
  const adminId = requestEvent.cookie.get('auth_session')?.value;
  if (!adminId) throw requestEvent.redirect(302, '/admin/login/');
  const user = await db.query.users.findFirst({
    where: eq(users.id, adminId),
    columns: { role: true, name: true }
  });
  if (!user) {
    requestEvent.cookie.delete('auth_session', { path: '/' });
    throw requestEvent.redirect(302, '/admin/login/');
  }
  return user;
});

export const useSiteSettings = routeLoader$(async (requestEvent) => {
  const db = getDB(requestEvent);
  return await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1)
  });
});

export const updateClubStatus = server$(async function(status: string) {
  const db = getDB(this);
  await db.update(siteSettings)
    .set({ clubStatus: status, updatedAt: new Date() })
    .where(eq(siteSettings.id, 1));
  return { success: true };
});

export default component$(() => {
  const loc = useLocation();
  const isCollapsed = useSignal(false);
  const settings = useSiteSettings();
  const adminUser = useAdminUser();
  const userRole = adminUser.value?.role ?? 'GUEST';

  const navItems = [
    {
      name: "Dashboard",
      href: "/admin/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER", "EMPLOYEE"]
    },
    {
      name: "Perfil del Club",
      href: "/admin/club/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
          <path d="M3 21h18"></path>
          <path d="M3 7v1a3 3 0 0 0 6 0V7m6 0v1a3 3 0 0 0 6 0V7m-6 0h6m-6 0a3 3 0 0 0-6 0m6 0v12m-6-12v12"></path>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"]
    },
    {
      name: "Canchas",
      href: "/admin/pitches/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
          <path d="M12 22v-7l-2-2"></path>
          <path d="M12 22v-7l2-2"></path>
          <path d="M22 10a9 9 0 0 0-18 0c0 4 3 6 8 11.5 5-5.5 8-7.5 8-11.5z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"]
    },
    {
      name: "Galería",
      href: "/admin/gallery/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"]
    },
    {
      name: "Reservas",
      href: "/admin/calendar/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER", "EMPLOYEE"]
    },

    {
      name: "Caja",
      href: "/admin/cash/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"]
    },
    {
      name: "Cuentas Ctes.",
      href: "/admin/groups/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"]
    },
    {
      name: "Escuelita",
      href: "/admin/school/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"]
    },
    {
      name: "Abonos",
      href: "/admin/subscriptions/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="m9 16 2 2 4-4"/></svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"]
    },
    {
      name: "Configurar IA",
      href: "/admin/ia/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"]
    },
    {
      name: "Auditoría IA",
      href: "/admin/chats/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"]
    },
    {
      name: "Usuarios",
      href: "/admin/users/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER"]
    },
    {
      name: "Ir al Sitio",
      href: "/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      ),
      roles: ["DEV", "OWNER", "MANAGER", "EMPLOYEE"]
    }
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <div class="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside 
        class={[
          "bg-slate-950 text-slate-300 flex flex-col shrink-0 shadow-xl z-50 transition-all duration-300 relative",
          isCollapsed.value ? "w-20" : "w-64"
        ]}
      >
        {/* Toggle Button */}
        <button
          onClick$={() => isCollapsed.value = !isCollapsed.value}
          class="absolute -right-3 top-6 w-6 h-6 bg-slate-800 border border-slate-700 text-slate-300 rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors z-50 shadow-md"
          title={isCollapsed.value ? "Expandir" : "Colapsar"}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class={["transition-transform duration-300", isCollapsed.value ? "rotate-180" : ""]}
          >
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>

        <div class="h-20 flex items-center px-6 border-b border-white/5 overflow-hidden">
          {isCollapsed.value ? (
            <div class="w-full flex justify-center">
              <img src={logo} alt="SG" class="h-10 w-auto object-contain" />
            </div>
          ) : (
            <div class="flex items-center gap-3">
              <img src={logo} alt="SportGarden" class="h-10 w-auto object-contain" />
              <div class="font-black text-xl tracking-tighter text-white uppercase whitespace-nowrap">
                Sport<span class="text-emerald-500">Garden</span>
              </div>
            </div>
          )}
        </div>

        {/* Club Status Indicator */}
        <div class={["px-6 py-4 border-b border-white/5 transition-all duration-300", isCollapsed.value ? "opacity-0 h-0 overflow-hidden py-0" : "opacity-100"]}>
          {(() => {
            if (!settings.value) return null;
            
            const currentStatus = settings.value.clubStatus;
            const hours = settings.value.operatingHours as any[];
            
            const calculateAutoStatus = () => {
              const now = new Date();
              const day = now.getDay();
              const hour = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
              const dayData = hours?.[day];
              return dayData?.isOpen && hour >= dayData.openTime && hour <= dayData.closeTime;
            };

            const isOpen = currentStatus === 'OPEN' || (currentStatus === 'AUTO' && calculateAutoStatus());
            
            const handleStatusChange = $(async () => {
              const nextStatus = currentStatus === 'AUTO' ? 'CLOSED' : currentStatus === 'CLOSED' ? 'OPEN' : 'AUTO';
              const labels: any = { 'AUTO': 'Cerrado (Manual)', 'CLOSED': 'Abierto (Manual)', 'OPEN': 'Automático' };
              const confirmMsg = `¿Estás seguro de cambiar el estado a ${labels[currentStatus]}?`;
              
              if (window.confirm(confirmMsg)) {
                await updateClubStatus(nextStatus);
                window.location.reload();
              }
            });

            return (
              <div class="flex items-center justify-between px-1">
                <div class="flex items-center gap-2">
                  <div class={["w-2 h-2 rounded-full", isOpen ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse"]}></div>
                  <span class="text-xs font-black uppercase tracking-widest text-slate-400">Estado</span>
                </div>
                
                <button 
                  onClick$={handleStatusChange}
                  title={`Modo actual: ${currentStatus === 'AUTO' ? 'Automático' : 'Manual'}`}
                  class={["flex items-center gap-1.5 px-2 py-1 rounded-md transition-all group", isOpen ? "bg-emerald-500/10 hover:bg-emerald-500/20" : "bg-red-500/10 hover:bg-red-500/20"]}
                >
                  <span class={["text-[10px] font-black uppercase tracking-tighter", isOpen ? "text-emerald-400" : "text-red-400"]}>
                    {isOpen ? "Abierto" : "Cerrado"}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-slate-500 group-hover:text-white transition-colors opacity-50">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  </svg>
                </button>
              </div>
            );
          })()}
        </div>

        <nav class="flex-1 py-6 px-4 space-y-1 overflow-x-hidden">
          <div class={["text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2 transition-all", isCollapsed.value ? "opacity-0 h-0 mb-0" : "opacity-100"]}>
            {!isCollapsed.value && "Administración"}
          </div>
          
          {visibleNavItems.map((item) => {
            let isActive = false;
            if (item.href === "/admin/") {
              isActive = loc.url.pathname === "/admin" || loc.url.pathname === "/admin/";
            } else if (item.href !== "/") {
              isActive = loc.url.pathname.startsWith(item.href);
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                title={isCollapsed.value ? item.name : ""}
                class={[
                  "flex items-center text-sm font-medium rounded-lg transition-colors overflow-hidden whitespace-nowrap",
                  isCollapsed.value ? "justify-center p-3" : "px-4 py-3",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "hover:bg-white/5 hover:text-white",
                ]}
              >
                {item.icon}
                <span class={["ml-3 transition-opacity duration-200", isCollapsed.value ? "opacity-0 hidden" : "opacity-100"]}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
        
        <div class="p-4 border-t border-white/5 overflow-hidden">
          <div class={["flex items-center", isCollapsed.value ? "justify-center" : "gap-3 px-2"]}>
            <div class="w-8 h-8 rounded-full bg-emerald-600 flex shrink-0 items-center justify-center text-white font-bold">
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
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Slot />
      </div>
    </div>
  );
});
