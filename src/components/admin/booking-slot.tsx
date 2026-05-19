import { component$, type PropFunction } from "@builder.io/qwik";
import { cn } from "@qwik-ui/utils";

export type BookingSlotProps = {
  id: string;
  startTime: Date;
  endTime: Date;
  status: "PENDING_APPROVAL" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  customerName: string;
  customerPhone?: string | null;
  pitchName?: string;
  isSubscription?: boolean;
  bookingType?: "EVENTUAL" | "FIXED" | "BIRTHDAY" | "TOURNAMENT" | "SCHOOL";
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

  const typeColors: Record<string, string> = {
    EVENTUAL: "bg-blue-50 border-blue-200 text-blue-900 shadow-blue-900/5",
    FIXED:
      "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-900/5",
    BIRTHDAY:
      "bg-violet-50 border-violet-200 text-violet-900 shadow-violet-900/5",
    TOURNAMENT: "bg-pink-50 border-pink-200 text-pink-900 shadow-pink-900/5",
    SCHOOL:
      "bg-orange-50 border-orange-200 text-orange-900 shadow-orange-900/5",
  };

  const statusColors = {
    PENDING_APPROVAL:
      "bg-amber-50 border-amber-200 text-amber-900 shadow-amber-900/5",
    CONFIRMED:
      "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-900/5",
    CANCELLED: "bg-red-50 border-red-200 text-red-900 shadow-red-900/5",
    COMPLETED: "bg-slate-50 border-slate-200 text-slate-900 shadow-slate-900/5",
  };

  const effectiveColorClass = props.bookingType
    ? typeColors[props.bookingType]
    : statusColors[props.status];

  const statusBadgeColors = {
    PENDING_APPROVAL: "bg-amber-100 text-amber-700",
    CONFIRMED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
    COMPLETED: "bg-slate-200 text-slate-700",
  };

  // Border color indicator (accent)
  const accentColors: Record<string, string> = {
    EVENTUAL: "border-l-blue-500",
    FIXED: "border-l-emerald-500",
    BIRTHDAY: "border-l-violet-500",
    TOURNAMENT: "border-l-pink-500",
    SCHOOL: "border-l-orange-500",
  };
  const effectiveAccentClass = props.bookingType
    ? accentColors[props.bookingType]
    : "";

  return (
    <div
      onClick$={() => props.onClick$ && props.onClick$(props.id)}
      class={[
        "absolute right-1 left-1 flex cursor-pointer flex-col overflow-hidden rounded-xl border p-2 text-sm shadow-sm transition-all hover:z-20 hover:scale-[1.01] hover:shadow-md",
        effectiveColorClass,
        effectiveAccentClass,
      ]}
      style={{
        top: `${Math.max(0, top)}px`,
        height: `${height}px`,
        borderLeftWidth: "4px",
      }}
    >
      <div class="mb-1 flex items-start justify-between gap-1">
        <div class="flex-1 truncate text-sm leading-tight font-black text-slate-800">
          {props.customerName}
        </div>
        {props.isSubscription && (
          <div class="shrink-0 text-slate-500" title="Turno Fijo (Suscripción)">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3M15.5 7.5 14 6" />
              <path d="M21 7V2h-5" />
            </svg>
          </div>
        )}
      </div>

      <div class="mt-auto flex flex-col gap-0.5">
        <div class="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-slate-500 uppercase">
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
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {props.startTime.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}{" "}
          -
          {props.endTime.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </div>

        {props.pitchName && (
          <div class="mt-0.5 inline-flex w-max items-center truncate rounded bg-white/60 px-1.5 py-0.5 text-[9px] font-black tracking-tighter text-slate-700 uppercase shadow-sm">
            {props.pitchName}
          </div>
        )}
      </div>

      {/* Mini status indicator at bottom right if card is small, or full badge if large */}
      <div
        class={cn(
          "absolute right-1 bottom-1 rounded px-1.5 py-0.5 text-[9px] font-black tracking-widest uppercase shadow-sm",
          statusBadgeColors[props.status],
        )}
      >
        {props.status === "PENDING_APPROVAL"
          ? "PEND"
          : props.status === "CONFIRMED"
            ? "CONF"
            : props.status === "CANCELLED"
              ? "CANC"
              : "COMP"}
      </div>
    </div>
  );
});
