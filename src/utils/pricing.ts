export type PricingRule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  price: number;
};

/**
 * Calculates the exact price of a booking by evaluating the price minute by minute,
 * checking if a specific pricing rule applies to that exact minute.
 */
export const calculateProportionalPrice = (
  dateStr: string, // "YYYY-MM-DD"
  timeStr: string, // "HH:MM"
  durationMins: number,
  basePrice: number,
  rules: PricingRule[],
  holidays: string[] = []
): number => {
  if (!rules || rules.length === 0) {
    return Math.round(basePrice * (durationMins / 60));
  }

  const [yyyy, mm, dd] = dateStr.split("-").map(Number);
  const [hh, min] = timeStr.split(":").map(Number);
  
  // Use local Date to automatically handle minute and day overflows
  const current = new Date(yyyy, mm - 1, dd, hh, min, 0);
  
  let totalPrice = 0;
  
  for (let i = 0; i < durationMins; i++) {
    const yStr = current.getFullYear();
    const mStr = (current.getMonth() + 1).toString().padStart(2, '0');
    const dStr = current.getDate().toString().padStart(2, '0');
    const currentDateStr = `${yStr}-${mStr}-${dStr}`;
    
    const isHoliday = holidays.includes(currentDateStr);
    const currentDayOfWeek = isHoliday ? 7 : current.getDay();
    const currentHour = current.getHours();
    const currentMin = current.getMinutes();
    
    const timeFormat = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
    
    let applicablePrice = basePrice;
    
    for (const rule of rules) {
      if (rule.dayOfWeek === currentDayOfWeek) {
        if (rule.startTime <= rule.endTime) {
          if (timeFormat >= rule.startTime && timeFormat < rule.endTime) {
            applicablePrice = rule.price;
            break;
          }
        } else {
          // Rule crosses midnight (e.g. 22:00 to 02:00)
          if (timeFormat >= rule.startTime || timeFormat < rule.endTime) {
            applicablePrice = rule.price;
            break;
          }
        }
      }
    }
    
    totalPrice += applicablePrice / 60;
    
    // Advance 1 minute
    current.setMinutes(current.getMinutes() + 1);
  }
  
  return Math.round(totalPrice);
};
