import { component$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import { cn } from "@qwik-ui/utils";

function normalizePathname(pathname: string): string {
  const p = pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

const TABS: { href: string; label: string; isActive: (p: string) => boolean }[] = [
  { href: "/admin/cash/", label: "Caja Actual", isActive: (p) => p === "/admin/cash" },
  { href: "/admin/cash/history/", label: "Historial", isActive: (p) => p.startsWith("/admin/cash/history") },
  { href: "/admin/cash/balances/", label: "Balances", isActive: (p) => p.startsWith("/admin/cash/balances") },
  { href: "/admin/cash/medios-de-pago/", label: "Medios de pago", isActive: (p) => p.startsWith("/admin/cash/medios-de-pago") },
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
    <div class="overflow-x-auto -mx-1 px-1 print:hidden">
      <div class="flex flex-wrap gap-1 border-b border-slate-200 pb-4 min-w-0">
      {TABS.map((tab) => {
        const active = tab.isActive(path);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            class={cn(
              "px-3 sm:px-4 py-2 font-bold text-xs sm:text-sm rounded-t-lg transition-colors whitespace-nowrap",
              active
                ? "text-emerald-700 bg-white border border-b-white border-slate-200 -mb-px z-[1] relative"
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
