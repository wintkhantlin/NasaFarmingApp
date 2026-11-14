const DAY_MS = 86_400_000;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function suggestPlanningWindow(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Yangon", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const today = Date.UTC(value("year"), value("month") - 1, value("day"));
  return {
    startDate: isoDate(new Date(today + 7 * DAY_MS)),
    endDate: isoDate(new Date(today + 187 * DAY_MS)),
  };
}
