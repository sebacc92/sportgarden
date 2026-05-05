import { component$ } from "@builder.io/qwik";

export type BookingSlotProps = {
  id: string;
  startTime: Date;
  endTime: Date;
  status: "PENDING_APPROVAL" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  customerName: string;
  calendarStartHour: number;
  pixelsPerHour: number;
};

export const BookingSlot = component$<BookingSlotProps>((props) => {
  const startHour =
    props.startTime.getHours() + props.startTime.getMinutes() / 60;
  const endHour = props.endTime.getHours() + props.endTime.getMinutes() / 60;

  const top = (startHour - props.calendarStartHour) * props.pixelsPerHour;
  const height = (endHour - startHour) * props.pixelsPerHour;

  const statusColors = {
    PENDING_APPROVAL: "bg-yellow-200 border-yellow-400 text-yellow-900",
    CONFIRMED: "bg-green-200 border-green-400 text-green-900",
    CANCELLED: "bg-red-200 border-red-400 text-red-900",
    COMPLETED: "bg-slate-200 border-slate-400 text-slate-900",
  };

  return (
    <div
      class={[
        "absolute left-1 right-1 rounded-md border p-2 text-xs shadow-sm overflow-hidden flex flex-col transition-all hover:z-10 hover:shadow-md cursor-pointer",
        statusColors[props.status],
      ]}
      style={{
        top: `${top}px`,
        height: `${height}px`,
      }}
    >
      <div class="font-bold truncate">{props.customerName}</div>
      <div class="opacity-80 mt-auto">
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
