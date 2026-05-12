import { component$, type PropFunction } from "@builder.io/qwik";

export type BookingSlotProps = {
  id: string;
  startTime: Date;
  endTime: Date;
  status: "PENDING_APPROVAL" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  customerName: string;
  customerPhone?: string | null;
  pitchName?: string;
  isSubscription?: boolean;
  calendarStartHour: number;
  pixelsPerHour: number;
  onClick$?: PropFunction<(id: string) => void>;
};

export const BookingSlot = component$<BookingSlotProps>((props) => {
  const startHour =
    props.startTime.getHours() + props.startTime.getMinutes() / 60;
  const endHour = props.endTime.getHours() + props.endTime.getMinutes() / 60;

  const top = (startHour - props.calendarStartHour) * props.pixelsPerHour;
  const height = (endHour - startHour) * props.pixelsPerHour;

  const statusColors = {
    PENDING_APPROVAL: "bg-amber-50 border-amber-200 text-amber-900 shadow-amber-900/5",
    CONFIRMED: "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-900/5",
    CANCELLED: "bg-red-50 border-red-200 text-red-900 shadow-red-900/5",
    COMPLETED: "bg-slate-50 border-slate-200 text-slate-900 shadow-slate-900/5",
  };

  const statusBadgeColors = {
    PENDING_APPROVAL: "bg-amber-100 text-amber-700",
    CONFIRMED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
    COMPLETED: "bg-slate-200 text-slate-700",
  };

  return (
    <div
      onClick$={() => props.onClick$ && props.onClick$(props.id)}
      class={[
        "absolute left-1 right-1 rounded-xl border p-2 text-sm shadow-sm overflow-hidden flex flex-col transition-all hover:z-20 hover:shadow-md hover:scale-[1.01] cursor-pointer",
        statusColors[props.status],
      ]}
      style={{
        top: `${Math.max(0, top)}px`,
        height: `${height}px`,
        borderLeftWidth: '4px'
      }}
    >
      <div class="flex items-start justify-between gap-1 mb-1">
        <div class="font-black text-slate-800 truncate leading-tight flex-1 text-sm">
          {props.customerName}
        </div>
        {props.isSubscription && (
          <div class="shrink-0 text-slate-500" title="Turno Fijo (Suscripción)">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3M15.5 7.5 14 6" /><path d="M21 7V2h-5" /></svg>
          </div>
        )}
      </div>

      <div class="flex flex-col gap-0.5 mt-auto">
        <div class="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {props.startTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })} - 
          {props.endTime.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </div>
        
        {props.pitchName && (
          <div class="text-[9px] font-black opacity-60 uppercase tracking-tighter truncate">
            {props.pitchName}
          </div>
        )}
      </div>

      {/* Mini status indicator at bottom right if card is small, or full badge if large */}
      <div class={cn(
        "absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest shadow-sm",
        statusBadgeColors[props.status]
      )}>
        {props.status === "PENDING_APPROVAL" ? "PEND" : 
         props.status === "CONFIRMED" ? "CONF" : 
         props.status === "CANCELLED" ? "CANC" : "COMP"}
      </div>
    </div>
  );
});
