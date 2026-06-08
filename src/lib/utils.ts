import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, addWeeks } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBusinessHours(): string[] {
  const slots: string[] = [];
  for (let h = 9; h < 17; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    slots.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return slots;
}

export function getWeeklyDates(startDate: Date, count: number = 5): Date[] {
  return Array.from({ length: count }, (_, i) => addWeeks(startDate, i));
}

export function formatDateDisplay(date: Date): string {
  return format(date, "EEEE, MMMM d, yyyy");
}

export function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function toZoned(date: Date, timezone: string): Date {
  return toZonedTime(date, timezone);
}

export function computeCohortDates(
  weekStartStr: string,
  track: "mon_wed" | "tue_thu",
): string[] {
  const [year, month, day] = weekStartStr.split("-").map(Number);
  const monday = new Date(Date.UTC(year, month - 1, day));
  const offsets =
    track === "mon_wed"
      ? [0, 2, 7, 9, 16]
      : [1, 3, 8, 10, 17];
  return offsets.map((offset) => {
    const d = new Date(monday.getTime() + offset * 86400000);
    const y = d.getUTCFullYear();
    const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    const dd = d.getUTCDate().toString().padStart(2, "0");
    return `${y}-${m}-${dd}`;
  });
}

function nextValidDateOnTrack(
  dateStr: string,
  track: "mon_wed" | "tue_thu",
): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay();
  const daysToAdd =
    track === "mon_wed"
      ? dow === 1 ? 2 : 5
      : dow === 2 ? 2 : 5;
  const next = new Date(d.getTime() + daysToAdd * 86400000);
  const y = next.getUTCFullYear();
  const m = (next.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = next.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function computeRescheduledCohortDates(
  weekStartStr: string,
  track: "mon_wed" | "tue_thu",
  oooDates: string[],
): string[] {
  const idealDates = computeCohortDates(weekStartStr, track);
  const oooSet = new Set(oooDates);
  const result: string[] = [];

  for (const idealDate of idealDates) {
    let candidate = idealDate;

    if (result.length > 0 && candidate <= result[result.length - 1]) {
      candidate = nextValidDateOnTrack(result[result.length - 1], track);
    }

    while (oooSet.has(candidate)) {
      candidate = nextValidDateOnTrack(candidate, track);
    }

    result.push(candidate);
  }

  return result;
}
