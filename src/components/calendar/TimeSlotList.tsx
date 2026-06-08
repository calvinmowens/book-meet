import { cn, formatTimeDisplay } from "../../lib/utils";
import { format, parseISO } from "date-fns";

interface Slot {
  time: string;
  available: boolean;
  oooWeeks?: string[];
}

interface TimeSlotListProps {
  slots: Slot[];
  selectedTime: string | null;
  onTimeSelect: (time: string) => void;
  loading: boolean;
}

export default function TimeSlotList({
  slots,
  selectedTime,
  onTimeSelect,
  loading,
}: TimeSlotListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-10 rounded-lg bg-gray-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);

  if (availableSlots.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        No available times on this date.
      </p>
    );
  }

  // Collect all unique OOO dates across available slots
  const allOooDates = new Set<string>();
  for (const slot of availableSlots) {
    for (const d of slot.oooWeeks || []) {
      allOooDates.add(d);
    }
  }
  const sortedOooDates = [...allOooDates].sort();

  return (
    <div>
      {sortedOooDates.length > 0 && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-medium text-amber-800">
            AirOps team OOO on{" "}
            {sortedOooDates
              .map((d) => format(parseISO(d), "MMM d"))
              .join(", ")}
            {" — "}
            {sortedOooDates.length === 1 ? "that session" : "those sessions"} will be
            rescheduled
          </p>
        </div>
      )}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {availableSlots.map((slot) => (
          <button
            key={slot.time}
            onClick={() => onTimeSelect(slot.time)}
            className={cn(
              "w-full text-left px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
              selectedTime === slot.time
                ? "bg-green-800 text-white border-green-800"
                : "border-gray-200 text-gray-700 hover:bg-green-50 hover:border-green-200",
            )}
          >
            {formatTimeDisplay(slot.time)}
          </button>
        ))}
      </div>
    </div>
  );
}
