import { getArgentinaDate, getBAFormatDate, getBAHoursAndMinutes } from "../src/routes/admin/calendar/utils";

const parseDatabaseDate = (d: string | Date | number): Date => {
  if (typeof d === "string") {
    if (!/Z|[+-]\d{2}:\d{2}$/.test(d)) {
      const isoStr = d.replace(" ", "T");
      const parts = isoStr.split("T");
      let timePart = parts[1] || "00:00:00";
      if (timePart.split(":").length === 2) {
        timePart += ":00";
      }
      return new Date(`${parts[0]}T${timePart}-03:00`);
    }
  }
  return new Date(d);
};

const toBALocalISOString = (d: Date | string | number): string => {
  const date = new Date(d);
  const arg = getArgentinaDate(date);
  return arg.toISOString().slice(0, 19);
};

function test() {
  // 1. User wants to book a turn at 19:00 hs on 2026-06-06
  const dateStr = "2026-06-06";
  const startTimeStr = "19:00";
  
  // Existing logic:
  const startDateTime = new Date(`${dateStr}T${startTimeStr}:00-03:00`);
  console.log("Original startDateTime:", startDateTime.toString());
  console.log("Original startDateTime.toISOString():", startDateTime.toISOString()); // "2026-06-06T22:00:00.000Z"
  
  // Proposed: format to local ISO for DB
  const localISO = toBALocalISOString(startDateTime);
  console.log("toBALocalISOString(startDateTime):", localISO); // should be "2026-06-06T19:00:00"
  
  // 2. Reading back from DB
  const dbValue = "2026-06-06T19:00:00";
  const parsed = parseDatabaseDate(dbValue);
  console.log("Parsed from DB:", parsed.toISOString()); // should match startDateTime.toISOString() -> 22:00 UTC
  
  const formatted = getBAHoursAndMinutes(parsed);
  console.log("Formatted hours/minutes:", formatted); // should be { hour: 19, minute: 0 }
}

test();
