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

export const getArgentinaDate = (d: Date | string | number): Date => {
  const date = new Date(d);
  return new Date(date.getTime() - 3 * 60 * 60 * 1000);
};

export const getBAHoursAndMinutes = (d: Date | string | number) => {
  const argDate = getArgentinaDate(d);
  return {
    hour: argDate.getUTCHours(),
    minute: argDate.getUTCMinutes(),
  };
};

export const getBADayOfWeek = (d: Date | string | number) => {
  return getArgentinaDate(d).getUTCDay();
};

export const getBADateOfMonth = (d: Date | string | number) => {
  return getArgentinaDate(d).getUTCDate();
};

export const getBAMonth = (d: Date | string | number) => {
  return getArgentinaDate(d).getUTCMonth();
};

export const getBAYear = (d: Date | string | number) => {
  return getArgentinaDate(d).getUTCFullYear();
};

export const getBAFormatDate = (d: Date | string | number) => {
  const arg = getArgentinaDate(d);
  const year = arg.getUTCFullYear();
  const month = String(arg.getUTCMonth() + 1).padStart(2, "0");
  const day = String(arg.getUTCDate()).padStart(2, "0");
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
