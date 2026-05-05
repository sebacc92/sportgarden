import { component$, type PropFunction } from "@builder.io/qwik";

export type BookingSlotProps = {
  id: string;
  startTime: Date;
  endTime: Date;
  status: "PENDING_APPROVAL" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  customerName: string;
  pitchName?: string;
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
    PENDING_APPROVAL: "bg-amber-100 border-amber-300 text-amber-900 shadow-amber-900/5",
    CONFIRMED: "bg-emerald-100 border-emerald-300 text-emerald-900 shadow-emerald-900/5",
    CANCELLED: "bg-red-100 border-red-300 text-red-900 shadow-red-900/5",
    COMPLETED: "bg-slate-100 border-slate-300 text-slate-900 shadow-slate-900/5",
  };

  const statusLabels = {
    PENDING_APPROVAL: "Por confirmar",
    CONFIRMED: "Confirmado",
    CANCELLED: "Cancelado",
    COMPLETED: "Completado",
  };

  return (
    <div
      onClick$={() => props.onClick$ && props.onClick$(props.id)}
      class={[
        "absolute left-1 right-1 rounded-lg border-l-4 p-2 text-xs shadow-sm overflow-hidden flex flex-col transition-all hover:z-20 hover:shadow-md hover:scale-[1.02] cursor-pointer",
        statusColors[props.status],
      ]}
      style={{
        top: `${Math.max(0, top)}px`,
        height: `${height}px`,
      }}
    >
      <div class="flex justify-between items-start gap-1">
        <div class="font-bold truncate leading-tight flex-1">{props.customerName}</div>
        <div class="text-[9px] font-black uppercase tracking-wider opacity-60 shrink-0 bg-black/5 px-1 rounded">
          {statusLabels[props.status]}
        </div>
      </div>
      {props.pitchName && (
        <div class="text-[10px] font-semibold opacity-70 mt-0.5 truncate uppercase tracking-tight">
          {props.pitchName}
        </div>
      )}
      <div class="opacity-70 mt-auto font-medium text-[10px]">
        {props.startTime.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}{" "}
        -{" "}
        {props.endTime.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}
      </div>
    </div>
  );
});
