import { component$, Slot } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";

export default component$(() => {
  const loc = useLocation();

  const navItems = [
    {
      name: "Dashboard",
      href: "/admin/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
    },
    {
      name: "Calendario",
      href: "/admin/calendar/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      ),
    },
    {
      name: "Canchas",
      href: "/admin/pitches/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3">
          <path d="M12 22v-7l-2-2"></path>
          <path d="M12 22v-7l2-2"></path>
          <path d="M22 10a9 9 0 0 0-18 0c0 4 3 6 8 11.5 5-5.5 8-7.5 8-11.5z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      ),
    },
    {
      name: "Ir al Sitio Público",
      href: "/",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      ),
    }
  ];

  return (
    <div class="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside class="w-64 bg-slate-950 text-slate-300 flex flex-col shrink-0 shadow-xl z-50">
        <div class="h-20 flex items-center px-6 border-b border-white/5">
          <div class="font-black text-2xl tracking-tighter text-white uppercase">
            Sport<span class="text-emerald-500">Garden</span>
          </div>
        </div>

        <nav class="flex-1 py-6 px-4 space-y-1">
          <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">
            Administración
          </div>
          {navItems.map((item) => {
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
                class={[
                  "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "hover:bg-white/5 hover:text-white",
                ]}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div class="p-4 border-t border-white/5">
          <div class="flex items-center gap-3 px-2">
            <div class="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
              A
            </div>
            <div>
              <div class="text-sm font-medium text-white">Admin</div>
              <div class="text-xs text-slate-500">Administrador</div>
            </div>
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
