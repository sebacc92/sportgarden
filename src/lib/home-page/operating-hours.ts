/** 0–6 = domingo–sábado; 7 = feriado (misma convención que el admin del club). */
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Feriado"] as const;

export type OperatingHourRow = {
  day: number;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
};

export type OperatingHoursGroup = { label: string; time: string };

const DEFAULT_GROUPS: OperatingHoursGroup[] = [
  { label: "Lunes a Viernes", time: "08:00 a 23:00" },
  { label: "Sábados", time: "10:00 a 20:00" },
  { label: "Domingos y Feriados", time: "15:00 a 21:00" },
];

/** Agrupa días con el mismo horario para la UI de contacto. */
export function groupOperatingHoursForDisplay(hours: OperatingHourRow[]): OperatingHoursGroup[] {
  if (!hours.length) return DEFAULT_GROUPS;

  const groups: Record<string, string[]> = {};
  for (const h of hours) {
    const timeStr = h.isOpen ? `${h.openTime} a ${h.closeTime}` : "Cerrado";
    if (!groups[timeStr]) groups[timeStr] = [];
    const dayLabel =
      typeof h.day === "number" && h.day >= 0 && h.day < DAY_NAMES.length ? DAY_NAMES[h.day] : "?";
    groups[timeStr]!.push(dayLabel);
  }

  return Object.entries(groups).map(([time, days]) => ({
    label: days.join(", "),
    time,
  }));
}
