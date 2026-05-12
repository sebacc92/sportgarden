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

export const getBAFormatDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d);

export const getWeekName = (startStr: string, endStr: string) => {
  const s = new Date(startStr);
  const e = new Date(endStr);
  return `${s.getDate()} de ${s.toLocaleDateString('es-ES', { month: 'short' })} - ${e.getDate()} de ${e.toLocaleDateString('es-ES', { month: 'short' })}`;
};

export const getMonthName = (dateStr: string) => {
  return new Date(dateStr + "T00:00:00").toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};
