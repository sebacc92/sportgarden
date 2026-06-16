import { component$ } from "@builder.io/qwik";
import {
  getBAHoursAndMinutes,
  parseDatabaseDate,
} from "~/routes/admin/calendar/utils";

interface PrintDayViewProps {
  selectedDateStr: string;
  bookings: any[];
  pitches: any[];
  settings: any;
  todaySchedule: any;
}

const fmt2 = (n: number) => String(n).padStart(2, "0");

const fmtHHMM = (date: Date) => {
  const { hour, minute } = getBAHoursAndMinutes(date);
  return `${fmt2(hour)}:${fmt2(minute)}`;
};

const fmtRange = (start: Date, end: Date) =>
  `${fmtHHMM(start)} - ${fmtHHMM(end)}`;

const fmtMoney = (n: number) =>
  `$${Math.round(n || 0).toLocaleString("es-AR")}`;

const fmtLongDate = (dateStr: string) =>
  new Date(dateStr + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const parseHour = (s?: string, fallback = 8) => {
  if (!s) return fallback;
  const [h, m] = s.split(":");
  return parseInt(h || "0", 10) + parseInt(m || "0", 10) / 60;
};

const paymentMethodLabel = (m?: string) => {
  if (!m) return "-";
  const map: Record<string, string> = {
    CASH: "Efectivo",
    TRANSFER: "Transf.",
    MERCADOPAGO: "MP",
    MERCADO_PAGO: "MP",
    PAYWAY: "Payway",
    CARD: "Tarjeta",
  };
  return map[m] || m;
};

const bookingKindLabel = (b: any) => {
  if (b.isSchool) return "ESC";
  if (b.bookingType === "FIXED" || b.isSubscription) return "FIJO";
  if (b.bookingType === "BIRTHDAY") return "CUMP";
  if (b.bookingType === "TOURNAMENT") return "TOR";
  return null;
};

const accentColor = (b: any): string => {
  if (b.isSchool) return "#14b8a6"; // teal-500 (Escuelita)
  if (b.bookingType === "FIXED" || b.isSubscription) return "#8b5cf6"; // violet-500 (Fijo)
  if (b.bookingType === "BIRTHDAY") return "#d946ef"; // fuchsia-500 (Cumpleaños)
  if (b.bookingType === "TOURNAMENT") return "#ec4899"; // pink-500 (Torneo)
  if (b.status === "PENDING_APPROVAL") return "#f59e0b"; // amber-500
  if (b.status === "PENDING_PAYMENT") return "#f97316"; // orange-500
  return "#3b82f6"; // blue-500 (Eventual)
};

export const PrintDayView = component$<PrintDayViewProps>((props) => {
  const { selectedDateStr, bookings, pitches, settings, todaySchedule } = props;

  const dayStart = Math.floor(parseHour(todaySchedule?.openTime, 8));
  const dayEnd = Math.ceil(parseHour(todaySchedule?.closeTime, 23));
  const totalHours = Math.max(1, dayEnd - dayStart);
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => dayStart + i);

  // Stretch each hour row so the timeline fills ~one printed A4 landscape page
  // instead of leaving the lower half blank. We divide the page height left for
  // the grid by the number of open hours, keeping a readable minimum.
  const ROW_HEIGHT_PX = Math.max(30, Math.floor(580 / totalHours));

  const activePitches = pitches.filter((p: any) => p.isActive !== false);

  const visibleBookings = (bookings || [])
    .filter((b: any) => b?.booking && b.booking.status !== "CANCELLED")
    .map((b: any) => ({
      ...b,
      booking: {
        ...b.booking,
        _start: parseDatabaseDate(b.booking.startTime),
        _end: parseDatabaseDate(b.booking.endTime),
      },
    }))
    .sort(
      (a: any, b: any) =>
        a.booking._start.getTime() - b.booking._start.getTime(),
    );

  const positionFor = (start: Date, end: Date) => {
    const s = getBAHoursAndMinutes(start);
    const e = getBAHoursAndMinutes(end);
    const sh = s.hour + s.minute / 60;
    const eh = e.hour + e.minute / 60;
    const top = (sh - dayStart) * ROW_HEIGHT_PX;
    const height = Math.max(20, (eh - sh) * ROW_HEIGHT_PX - 2);
    return { top, height };
  };

  // Totals
  const realBookings = visibleBookings.filter((b: any) => !b.booking.isSchool);
  const confirmedCount = realBookings.filter(
    (b: any) => b.booking.status === "CONFIRMED",
  ).length;
  const pendingCount = realBookings.filter(
    (b: any) =>
      b.booking.status === "PENDING_APPROVAL" ||
      b.booking.status === "PENDING_PAYMENT",
  ).length;
  const schoolCount = visibleBookings.length - realBookings.length;

  const totalExpected = realBookings.reduce(
    (s: number, b: any) => s + Number(b.booking.totalPrice || 0),
    0,
  );
  const totalPaid = realBookings.reduce(
    (s: number, b: any) => s + Number(b.booking.paidAmount || 0),
    0,
  );
  const totalPending = totalExpected - totalPaid;

  const has9And678 =
    activePitches.some((p: any) => /9/.test(p.name)) &&
    ["6", "7", "8"].some((n) =>
      activePitches.some((p: any) => new RegExp(n).test(p.name)),
    );

  return (
    <div class="print-day-view">
      {/* Header */}
      <div class="print-day-header">
        <div class="print-day-header-left">
          <div class="print-day-club">
            {settings?.clubName || "SportGarden Futbol"}
          </div>
          <div class="print-day-club-sub">
            {[settings?.clubAddress, settings?.clubPhone]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div class="print-day-header-right">
          <div class="print-day-date">{fmtLongDate(selectedDateStr)}</div>
          <div class="print-day-meta">
            Horario:{" "}
            {todaySchedule?.openTime && todaySchedule?.closeTime
              ? `${todaySchedule.openTime} a ${todaySchedule.closeTime}`
              : "—"}
            {"  ·  "}
            Generado: {new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div class="print-day-grid-wrap">
        <div
          class="print-day-grid"
          style={{
            gridTemplateColumns: `42px repeat(${activePitches.length}, minmax(0, 1fr))`,
          }}
        >
          {/* Top-left corner */}
          <div class="print-day-corner"></div>
          {/* Pitch headers */}
          {activePitches.map((p: any) => {
            const count = realBookings.filter(
              (b: any) => b.booking.pitchId === p.id,
            ).length;
            return (
              <div key={`h-${p.id}`} class="print-day-pitch-head">
                <div class="print-day-pitch-name">{p.name}</div>
                <div class="print-day-pitch-sub">
                  {p.type}
                  {count > 0 ? ` · ${count}` : ""}
                </div>
              </div>
            );
          })}

          {/* Body row: hours column + 1 cell per pitch with absolute bookings */}
          <div
            class="print-day-hours"
            style={{ height: `${totalHours * ROW_HEIGHT_PX}px` }}
          >
            {hours.map((h, idx) => (
              <div
                key={`hr-${h}`}
                class="print-day-hour-label"
                style={{
                  top: `${idx * ROW_HEIGHT_PX}px`,
                }}
              >
                {fmt2(h)}:00
              </div>
            ))}
          </div>
          {activePitches.map((p: any) => {
            const pitchBookings = visibleBookings.filter(
              (b: any) => b.booking.pitchId === p.id,
            );
            return (
              <div
                key={`col-${p.id}`}
                class="print-day-col"
                style={{ height: `${totalHours * ROW_HEIGHT_PX}px` }}
              >
                {/* Hour grid lines */}
                {hours.map((_h, i) =>
                  i === 0 ? null : (
                    <div
                      key={`gl-${p.id}-${i}`}
                      class="print-day-gridline"
                      style={{ top: `${i * ROW_HEIGHT_PX}px` }}
                    ></div>
                  ),
                )}
                {/* Bookings */}
                {pitchBookings.map((b: any) => {
                  const pos = positionFor(b.booking._start, b.booking._end);
                  const name =
                    b.user?.name || b.guest?.name || "Sin nombre";
                  const kind = bookingKindLabel(b.booking);
                  return (
                    <div
                      key={`bk-${b.booking.id}`}
                      class="print-day-booking"
                      style={{
                        top: `${pos.top}px`,
                        height: `${pos.height}px`,
                        borderLeftColor: accentColor(b.booking),
                      }}
                    >
                      <div class="print-day-booking-time">
                        {fmtRange(b.booking._start, b.booking._end)}
                        {kind ? (
                          <span class="print-day-booking-tag"> {kind}</span>
                        ) : null}
                      </div>
                      <div class="print-day-booking-name">{name}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div class="print-day-legend">
        <span>
          <i style={{ background: "#3b82f6" }}></i> Eventual
        </span>
        <span>
          <i style={{ background: "#8b5cf6" }}></i> Abono fijo
        </span>
        <span>
          <i style={{ background: "#d946ef" }}></i> Cumpleaños
        </span>
        <span>
          <i style={{ background: "#14b8a6" }}></i> Escuelita
        </span>
        <span>
          <i style={{ background: "#ec4899" }}></i> Torneo
        </span>
        <span>
          <i style={{ background: "#f59e0b" }}></i> Sin confirmar
        </span>
        <span>
          <i style={{ background: "#f97316" }}></i> Pendiente de pago
        </span>
        {has9And678 ? (
          <span class="print-day-legend-note">
            * Reservas en cancha 9 bloquean 6, 7 y 8 simultáneamente.
          </span>
        ) : null}
      </div>

      {/* Detail table */}
      <div class="print-day-detail">
        <div class="print-day-detail-title">Detalle de reservas</div>
        <table class="print-day-table">
          <thead>
            <tr>
              <th style={{ width: "70px" }}>Hora</th>
              <th style={{ width: "55px" }}>Cancha</th>
              <th>Cliente</th>
              <th style={{ width: "90px" }}>Teléfono</th>
              <th style={{ width: "55px" }}>Pago</th>
              <th>Notas / Extras</th>
              <th style={{ width: "70px", textAlign: "right" }}>Total</th>
              <th style={{ width: "70px", textAlign: "right" }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {visibleBookings.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  class="print-day-empty"
                  style={{ textAlign: "center" }}
                >
                  No hay reservas para este día.
                </td>
              </tr>
            ) : (
              visibleBookings.map((b: any) => {
                const pitch = pitches.find(
                  (p: any) => p.id === b.booking.pitchId,
                );
                const name = b.user?.name || b.guest?.name || "—";
                const phone = b.user?.phone || b.guest?.phone || "—";
                const extras = Array.isArray(b.booking.extras)
                  ? b.booking.extras
                      .map((e: any) => e?.name || e?.label || "")
                      .filter(Boolean)
                      .join(", ")
                  : "";
                const notes = b.booking.notes
                  ? String(b.booking.notes).startsWith("subscription:")
                    ? ""
                    : b.booking.notes
                  : "";
                const noteCell = [extras, notes].filter(Boolean).join(" · ");
                const total = Number(b.booking.totalPrice || 0);
                const paid = Number(b.booking.paidAmount || 0);
                const balance = total - paid;
                const kind = bookingKindLabel(b.booking);
                return (
                  <tr
                    key={`row-${b.booking.id}`}
                    class={b.booking.isSchool ? "print-day-row-school" : ""}
                  >
                    <td>{fmtRange(b.booking._start, b.booking._end)}</td>
                    <td>{pitch?.name || "—"}</td>
                    <td>
                      <strong>{name}</strong>
                      {kind ? (
                        <span class="print-day-row-tag"> {kind}</span>
                      ) : null}
                    </td>
                    <td>{phone}</td>
                    <td>{paymentMethodLabel(b.booking.paymentMethod)}</td>
                    <td>{noteCell || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {b.booking.isSchool ? "—" : fmtMoney(total)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {b.booking.isSchool ? (
                        "—"
                      ) : (
                        <span
                          class={
                            balance <= 0
                              ? "print-day-paid"
                              : "print-day-owes"
                          }
                        >
                          {balance <= 0 ? "PAGO" : fmtMoney(balance)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div class="print-day-totals">
        <div class="print-day-totals-left">
          <span>
            <strong>{confirmedCount}</strong> confirmadas
          </span>
          <span>
            <strong>{pendingCount}</strong> pendientes
          </span>
          {schoolCount > 0 ? (
            <span>
              <strong>{schoolCount}</strong> escuelita
            </span>
          ) : null}
        </div>
        <div class="print-day-totals-right">
          <span>
            Esperado: <strong>{fmtMoney(totalExpected)}</strong>
          </span>
          <span>
            Cobrado: <strong>{fmtMoney(totalPaid)}</strong>
          </span>
          <span class={totalPending > 0 ? "print-day-owes" : ""}>
            Pendiente: <strong>{fmtMoney(totalPending)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
});
