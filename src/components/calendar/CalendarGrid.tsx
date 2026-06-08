import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isBefore,
  startOfDay,
  isWeekend,
} from "date-fns";
import { cn } from "../../lib/utils";

interface CalendarGridProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarGrid({
  selectedDate,
  onDateSelect,
  minDate,
}: CalendarGridProps) {
  const [currentMonth, setCurrentMonth] = useState(
    selectedDate || new Date(),
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const today = startOfDay(new Date());
  const effectiveMin = minDate || today;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-gray-900">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-400 py-2"
          >
            {day}
          </div>
        ))}

        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isPast = isBefore(day, effectiveMin);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isWeekendDay = isWeekend(day);
          const isDisabled = !isCurrentMonth || isPast || isWeekendDay;

          return (
            <button
              key={day.toISOString()}
              onClick={() => !isDisabled && onDateSelect(day)}
              disabled={isDisabled}
              className={cn(
                "aspect-square flex items-center justify-center rounded-lg text-sm transition-colors cursor-pointer",
                !isCurrentMonth && "text-gray-200",
                isCurrentMonth && !isDisabled && "text-gray-700 hover:bg-green-50",
                isPast && isCurrentMonth && "text-gray-300",
                isWeekendDay && isCurrentMonth && "text-gray-300",
                isSelected && "!bg-green-800 !text-white font-semibold",
                isDisabled && "cursor-not-allowed",
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
