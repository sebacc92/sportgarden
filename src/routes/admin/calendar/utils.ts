export const getStartOfWeek = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getEndOfWeek = (d: Date) => {
  const date = getStartOfWeek(d);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
};

export const getStartOfMonth = (d: Date) => {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
};

export const getEndOfMonth = (d: Date) => {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

export const getArgentinaParts = (d: Date | string | number) => {
  const date = new Date(d);
  if (isNaN(date.getTime())) {
    return { year: 1970, month: 0, day: 1, hour: 0, minute: 0, second: 0 };
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  
  const getValue = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || "0";
    
  return {
    year: parseInt(getValue("year"), 10),
    month: parseInt(getValue("month"), 10) - 1,
    day: parseInt(getValue("day"), 10),
    hour: parseInt(getValue("hour"), 10),
    minute: parseInt(getValue("minute"), 10),
    second: parseInt(getValue("second"), 10),
  };
};

export const getArgentinaDate = (d: Date | string | number): Date => {
  const p = getArgentinaParts(d);
  return new Date(Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second));
};

export const getBAHoursAndMinutes = (d: Date | string | number) => {
  const p = getArgentinaParts(d);
  return {
    hour: p.hour,
    minute: p.minute,
  };
};

export const getBADayOfWeek = (d: Date | string | number) => {
  const p = getArgentinaParts(d);
  return new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay();
};

export const getBADateOfMonth = (d: Date | string | number) => {
  const p = getArgentinaParts(d);
  return p.day;
};

export const getBAMonth = (d: Date | string | number) => {
  const p = getArgentinaParts(d);
  return p.month;
};

export const getBAYear = (d: Date | string | number) => {
  const p = getArgentinaParts(d);
  return p.year;
};

export const getBAFormatDate = (d: Date | string | number) => {
  const p = getArgentinaParts(d);
  const year = p.year;
  const month = String(p.month + 1).padStart(2, "0");
  const day = String(p.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getWeekName = (startStr: string, endStr: string) => {
  const s = new Date(startStr);
  const e = new Date(endStr);
  return `${s.getDate()} de ${s.toLocaleDateString("es-ES", { month: "short" })} - ${e.getDate()} de ${e.toLocaleDateString("es-ES", { month: "short" })}`;
};

export const getMonthName = (dateStr: string) => {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
};

export function playNotificationBeep() {
  if (typeof window === "undefined") return;
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.15);

    setTimeout(() => {
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start();
      osc2.stop(audioCtx.currentTime + 0.25);
    }, 85);
  } catch (err) {
    console.error("Failed to play notification sound:", err);
  }
}

export const toBALocalISOString = (d: Date | string | number): string => {
  const p = getArgentinaParts(d);
  const year = p.year;
  const month = String(p.month + 1).padStart(2, "0");
  const day = String(p.day).padStart(2, "0");
  const hour = String(p.hour).padStart(2, "0");
  const minute = String(p.minute).padStart(2, "0");
  const second = String(p.second).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

export const parseDatabaseDate = (dateStr: string): Date => {
  const normalized = dateStr.replace(" ", "T");
  if (!normalized.includes("+") && !normalized.slice(10).includes("-") && !normalized.endsWith("Z")) {
    return new Date(`${normalized}-03:00`);
  }
  return new Date(normalized);
};

