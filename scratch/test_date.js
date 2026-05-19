const d = new Date(); // Current time (UTC on most servers)
const todayStr = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
}).format(d);
console.log("Now (Local Machine):", d.toString());
console.log("Now (UTC):", d.toISOString());
console.log("Today in BA (via Intl):", todayStr);

const manualBADate = new Date(d.getTime() - 3 * 60 * 60 * 1000);
console.log(
  "Today in BA (Manual Offset):",
  manualBADate.toISOString().split("T")[0],
);
