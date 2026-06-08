import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  parseISO,
} from "date-fns";
import { cn } from "../../lib/utils";

interface CohortCalendarPreviewProps {
  sessionDates: string[]; // YYYY-MM-DD
  oooDates: string[]; // YYYY-MM-DD
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CohortCalendarPreview({
  sessionDates,
  oooDates,
}: CohortCalendarPreviewProps) {
  if (sessionDates.length === 0) return null;

  const sessionDateObjs = sessionDates.map((d) => parseISO(d));
  const oooDateObjs = oooDates.map((d) => parseISO(d));
  // Span from the week of the first session to the week of the last session
  const firstDate = sessionDateObjs[0];
  const lastDate = sessionDateObjs[sessionDateObjs.length - 1];
  const calStart = startOfWeek(firstDate);
  const calEnd = endOfWeek(lastDate);
  const allDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Group into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Session calendar
      </h4>
      <div className="grid grid-cols-7 gap-0.5">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-gray-400 py-1"
          >
            {day}
          </div>
        ))}

        {weeks.map((week) =>
          week.map((day) => {
            const isSession = sessionDateObjs.some((sd) => isSameDay(sd, day));
            const isOoo = oooDateObjs.some((od) => isSameDay(od, day));
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "aspect-square flex items-center justify-center rounded text-[11px]",
                  isWeekend && "text-gray-200",
                  !isWeekend && !isSession && !isOoo && "text-gray-400",
                  isSession && !isOoo && "bg-green-100 text-green-800 font-semibold",
                  isSession && isOoo && "bg-red-100 text-red-700 font-semibold line-through",
                  isOoo && !isSession && "bg-red-50 text-red-400",
                )}
              >
                {format(day, "d")}
              </div>
            );
          }),
        )}
      </div>
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-green-100 border border-green-200" />
          <span className="text-[10px] text-gray-500">Session</span>
        </div>
        {oooDates.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-red-100 border border-red-200" />
            <span className="text-[10px] text-gray-500">AirOps team OOO — session rescheduled</span>
          </div>
        )}
      </div>
    </div>
  );
}
