import { component$, Slot } from "@builder.io/qwik";
import { cn } from "@qwik-ui/utils";
import { CashSectionNav } from "~/components/admin/cash/CashSectionNav";

export type CashAdminPageWrapperProps = {
  maxWidthClass?: string;
  rootClass?: string;
};

/**
 * Marco común para subrutas de `/admin/cash/` (padding, fondo, nav, ancho).
 */
export const CashAdminPageWrapper = component$<CashAdminPageWrapperProps>((props) => {
  return (
    <div class={cn("p-4 md:p-6 bg-slate-50 min-h-full font-sans", props.rootClass)}>
      <div class={cn("mx-auto space-y-6", props.maxWidthClass ?? "max-w-6xl")}>
        <CashSectionNav />
        <Slot />
      </div>
    </div>
  );
});
