import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import Card from "../../components/ui/Card";
import CalendarGrid from "../../components/calendar/CalendarGrid";
import TimeSlotList from "../../components/calendar/TimeSlotList";
import CohortCalendarPreview from "../../components/calendar/CohortCalendarPreview";
import TimezoneSelector from "../../components/calendar/TimezoneSelector";
import BookingForm from "../../components/booking/BookingForm";
import { format, addDays, addWeeks, startOfWeek } from "date-fns";
import {
  getBrowserTimezone,
  formatTimeDisplay,
  formatDateDisplay,
  computeCohortDates,
  computeRescheduledCohortDates,
} from "../../lib/utils";

interface Slot {
  time: string;
  available: boolean;
  oooWeeks?: string[];
}

function getUpcomingMondays(count: number): Date[] {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const mondays: Date[] = [];
  for (let i = 0; i < count; i++) {
    mondays.push(addWeeks(monday, i));
  }
  return mondays;
}

export default function BookingPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const link = useQuery(api.schedulingLinks.get, {
    id: linkId as Id<"schedulingLinks">,
  });
  const getSlots = useAction(api.availability.getSlots);
  const getCohortSlots = useAction(api.availability.getCohortSlots);
  const createBooking = useAction(api.bookings.create);

  const [timezone, setTimezone] = useState(getBrowserTimezone());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookedConfirmed, setBookedConfirmed] = useState(false);

  // Cohort-specific state
  const [cohortTrack, setCohortTrack] = useState<
    "mon_wed" | "tue_thu" | null
  >(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const meetingType = link?.meetingType || "weekly_sync";
  const isCohort = meetingType === "cohort";

  const fetchWeeklySyncSlots = useCallback(
    async (date: Date, tz: string) => {
      if (!linkId) return;
      setLoadingSlots(true);
      setSlots([]);
      setSelectedTime(null);
      try {
        const result = await getSlots({
          linkId: linkId as Id<"schedulingLinks">,
          dateStr: format(date, "yyyy-MM-dd"),
          timezone: tz,
        });
        setSlots(result);
      } catch (err) {
        console.error("Failed to fetch slots:", err);
      } finally {
        setLoadingSlots(false);
      }
    },
    [linkId, getSlots],
  );

  const fetchCohortSlotsForWeek = useCallback(
    async (weekStartStr: string, track: "mon_wed" | "tue_thu", tz: string) => {
      if (!linkId) return;
      setLoadingSlots(true);
      setSlots([]);
      setSelectedTime(null);
      try {
        const result = await getCohortSlots({
          linkId: linkId as Id<"schedulingLinks">,
          weekStartStr,
          track,
          timezone: tz,
        });
        setSlots(result);
      } catch (err) {
        console.error("Failed to fetch cohort slots:", err);
      } finally {
        setLoadingSlots(false);
      }
    },
    [linkId, getCohortSlots],
  );

  function handleDateSelect(date: Date) {
    setSelectedDate(date);
    fetchWeeklySyncSlots(date, timezone);
  }

  function handleWeekSelect(weekStartStr: string) {
    setSelectedWeek(weekStartStr);
    setSelectedTime(null);
    if (cohortTrack) {
      fetchCohortSlotsForWeek(weekStartStr, cohortTrack, timezone);
    }
  }

  function handleTrackSelect(track: "mon_wed" | "tue_thu") {
    setCohortTrack(track);
    setSelectedWeek(null);
    setSlots([]);
    setSelectedTime(null);
  }

  function handleTimezoneChange(tz: string) {
    setTimezone(tz);
    if (isCohort && selectedWeek && cohortTrack) {
      fetchCohortSlotsForWeek(selectedWeek, cohortTrack, tz);
    } else if (!isCohort && selectedDate) {
      fetchWeeklySyncSlots(selectedDate, tz);
    }
  }

  async function handleBookingSubmit(data: {
    email: string;
    guests: string[];
  }) {
    if (!linkId) return;
    setBooking(true);
    try {
      if (isCohort) {
        if (!selectedWeek || !selectedTime || !cohortTrack) return;
        await createBooking({
          linkId: linkId as Id<"schedulingLinks">,
          bookerEmail: data.email,
          guestEmails: data.guests,
          selectedDate: selectedWeek,
          selectedTime,
          timezone,
          cohortTrack,
        });
      } else {
        if (!selectedDate || !selectedTime) return;
        await createBooking({
          linkId: linkId as Id<"schedulingLinks">,
          bookerEmail: data.email,
          guestEmails: data.guests,
          selectedDate: format(selectedDate, "yyyy-MM-dd"),
          selectedTime,
          timezone,
        });
      }
      navigate(`/book/${linkId}/confirmed`);
    } catch (err) {
      console.error("Booking failed:", err);
      alert("Booking failed. The slot may no longer be available.");
    } finally {
      setBooking(false);
    }
  }

  // Loading state
  if (link === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not found
  if (link === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="text-center max-w-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Link not found
          </h2>
          <p className="text-sm text-gray-500">
            This scheduling link doesn't exist or has been removed.
          </p>
        </Card>
      </div>
    );
  }

  // Already booked confirmation
  if (link.status === "booked" && !bookedConfirmed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="text-center max-w-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Already booked
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            This meeting has already been booked. Do you want to continue?
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => window.history.back()}
            >
              No
            </button>
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-green-800 rounded-lg hover:bg-green-900 transition-colors cursor-pointer"
              onClick={() => setBookedConfirmed(true)}
            >
              Yes
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // Archived
  if (link.status === "archived") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="text-center max-w-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Link unavailable
          </h2>
          <p className="text-sm text-gray-500">
            This scheduling link is no longer active.
          </p>
        </Card>
      </div>
    );
  }

  const minDate = addDays(new Date(), 1);
  const upcomingMondays = getUpcomingMondays(8);

  // Filter slots that are too soon when the first session is today
  const today = format(new Date(), "yyyy-MM-dd");
  let firstSessionDate: string | null = null;
  if (isCohort && selectedWeek) {
    firstSessionDate =
      cohortTrack === "tue_thu"
        ? format(addDays(new Date(selectedWeek + "T12:00:00"), 1), "yyyy-MM-dd")
        : selectedWeek;
  } else if (selectedDate) {
    firstSessionDate = format(selectedDate, "yyyy-MM-dd");
  }
  let filteredSlots = slots;
  if (firstSessionDate === today) {
    const now = new Date();
    const bufferMinutes = now.getHours() * 60 + now.getMinutes() + 120;
    const roundedMinutes = Math.ceil(bufferMinutes / 30) * 30;
    const minH = Math.floor(roundedMinutes / 60);
    const minM = roundedMinutes % 60;
    const minTime = `${minH.toString().padStart(2, "0")}:${minM.toString().padStart(2, "0")}`;
    filteredSlots = slots.filter((s) => s.time >= minTime);
  }

  const subtitle = isCohort
    ? `60 min \u00b7 Cohort (3 weeks) \u00b7 ${link.customerName}`
    : `30 min \u00b7 Weekly for 5 weeks \u00b7 ${link.customerName}`;

  const showSlots = isCohort
    ? selectedWeek && cohortTrack
    : selectedDate;

  const confirmSubtext = isCohort
    ? `${cohortTrack === "mon_wed" ? "Mon/Wed" : "Tue/Thu"} track \u00b7 Week of ${selectedWeek} \u00b7 5 sessions over 3 weeks`
    : selectedDate
      ? `${formatDateDisplay(selectedDate)} at ${formatTimeDisplay(selectedTime || "")} \u00b7 Repeats weekly for 5 weeks`
      : "";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {isCohort ? "Schedule a cohort" : "Schedule a meeting"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Selection controls */}
          <Card>
            <div className="mb-4">
              <TimezoneSelector
                timezone={timezone}
                onTimezoneChange={handleTimezoneChange}
              />
            </div>

            {isCohort ? (
              <>
                {/* Track selection */}
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Choose your schedule
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleTrackSelect("mon_wed")}
                      className={`p-3 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                        cohortTrack === "mon_wed"
                          ? "border-green-700 bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        Monday / Wednesday
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Concludes on a Wednesday
                      </p>
                    </button>
                    <button
                      onClick={() => handleTrackSelect("tue_thu")}
                      className={`p-3 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                        cohortTrack === "tue_thu"
                          ? "border-green-700 bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        Tuesday / Thursday
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Concludes on a Thursday
                      </p>
                    </button>
                  </div>
                </div>

                {/* Week selection list */}
                {cohortTrack && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      Select a starting week
                    </h3>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {upcomingMondays.map((monday) => {
                        const weekStr = format(monday, "yyyy-MM-dd");
                        const isSelected = selectedWeek === weekStr;
                        return (
                          <button
                            key={weekStr}
                            onClick={() => handleWeekSelect(weekStr)}
                            className={`w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-green-800 text-white border-green-800"
                                : "border-gray-200 text-gray-700 hover:bg-green-50 hover:border-green-200"
                            }`}
                          >
                            Week of {format(monday, "MMM d, yyyy")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <CalendarGrid
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  minDate={minDate}
                />
                {selectedDate && (
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    Showing times available on{" "}
                    {format(selectedDate, "EEEE")}s for 5 consecutive weeks
                  </p>
                )}
              </>
            )}
          </Card>

          {/* Right: Time slots + Booking form */}
          <div className="space-y-6">
            {showSlots && (
              <Card>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  {isCohort
                    ? `Available times on ${cohortTrack === "mon_wed" ? "Mon/Wed" : "Tue/Thu"} \u2014 Week of ${selectedWeek ? format(new Date(selectedWeek + "T12:00:00"), "MMM d") : ""}`
                    : `Available times \u2014 ${selectedDate ? format(selectedDate, "EEEE, MMM d") : ""}`}
                </h3>
                <TimeSlotList
                  slots={filteredSlots}
                  selectedTime={selectedTime}
                  onTimeSelect={setSelectedTime}
                  loading={loadingSlots}
                />
              </Card>
            )}

            {isCohort && selectedWeek && cohortTrack && slots.length > 0 && (
              <Card>
                <CohortCalendarPreview
                  sessionDates={(() => {
                    const ooo = selectedTime
                      ? slots.find((s) => s.time === selectedTime)?.oooWeeks || []
                      : (() => {
                          const all = new Set<string>();
                          for (const s of slots.filter((s) => s.available)) {
                            for (const d of s.oooWeeks || []) all.add(d);
                          }
                          return [...all];
                        })();
                    return ooo.length > 0
                      ? computeRescheduledCohortDates(selectedWeek, cohortTrack, ooo)
                      : computeCohortDates(selectedWeek, cohortTrack);
                  })()}
                  oooDates={(() => {
                    if (selectedTime) {
                      return slots.find((s) => s.time === selectedTime)?.oooWeeks || [];
                    }
                    const allOoo = new Set<string>();
                    for (const s of slots.filter((s) => s.available)) {
                      for (const d of s.oooWeeks || []) allOoo.add(d);
                    }
                    return [...allOoo];
                  })()}
                />
              </Card>
            )}

            {selectedTime && showSlots && (
              <Card>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Confirm your booking
                </h3>
                <p className="text-xs text-gray-500 mb-4">{confirmSubtext}</p>
                <BookingForm
                  onSubmit={handleBookingSubmit}
                  loading={booking}
                />
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
