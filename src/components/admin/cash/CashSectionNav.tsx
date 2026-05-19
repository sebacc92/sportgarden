import { component$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import { cn } from "@qwik-ui/utils";

function normalizePathname(pathname: string): string {
  const p = pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

const TABS: {
  href: string;
  label: string;
  isActive: (p: string) => boolean;
}[] = [
  {
    href: "/admin/cash/",
    label: "Caja Actual",
    isActive: (p) => p === "/admin/cash",
  },
  {
    href: "/admin/cash/history/",
    label: "Historial",
    isActive: (p) => p.startsWith("/admin/cash/history"),
  },
  {
    href: "/admin/cash/balances/",
    label: "Balances",
    isActive: (p) => p.startsWith("/admin/cash/balances"),
  },
  {
    href: "/admin/cash/medios-de-pago/",
    label: "Medios de pago",
    isActive: (p) => p.startsWith("/admin/cash/medios-de-pago"),
  },
  {
    href: "/admin/cash/categorias-movimientos-caja/",
    label: "Categorías (caja)",
    isActive: (p) => p.startsWith("/admin/cash/categorias-movimientos-caja"),
  },
];

export const CashSectionNav = component$(() => {
  const loc = useLocation();
  const path = normalizePathname(loc.url.pathname);

  return (
    <div class="-mx-1 overflow-x-auto px-1 print:hidden">
      <div class="flex min-w-0 flex-wrap gap-1 border-b border-slate-200 pb-4">
        {TABS.map((tab) => {
          const active = tab.isActive(path);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              class={cn(
                "rounded-t-lg px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors sm:px-4 sm:text-sm",
                active
                  ? "relative z-[1] -mb-px border border-slate-200 border-b-white bg-white text-emerald-700"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
});
