export function computeCohortDates(
  weekStartStr: string,
  track: "mon_wed" | "tue_thu",
): string[] {
  const [year, month, day] = weekStartStr.split("-").map(Number);
  const monday = new Date(Date.UTC(year, month - 1, day));

  const offsets =
    track === "mon_wed"
      ? [0, 2, 7, 9, 16] // Mon, Wed, Mon, Wed, Wed
      : [1, 3, 8, 10, 17]; // Tue, Thu, Tue, Thu, Thu

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
  const dow = d.getUTCDay(); // 1=Mon, 2=Tue, 3=Wed, 4=Thu
  // Mon→Wed: +2, Wed→Mon: +5 | Tue→Thu: +2, Thu→Tue: +5
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

    // Ensure this session comes after the previous one
    if (result.length > 0 && candidate <= result[result.length - 1]) {
      candidate = nextValidDateOnTrack(result[result.length - 1], track);
    }

    // Advance past any OOO dates
    while (oooSet.has(candidate)) {
      candidate = nextValidDateOnTrack(candidate, track);
    }

    result.push(candidate);
  }

  return result;
}
