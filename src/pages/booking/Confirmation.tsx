import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import Card from "../../components/ui/Card";
import { format, parseISO, addWeeks } from "date-fns";
import { formatTimeDisplay } from "../../lib/utils";

export default function Confirmation() {
  const { linkId } = useParams<{ linkId: string }>();
  const booking = useQuery(api.bookings.getByLinkId, {
    linkId: linkId as Id<"schedulingLinks">,
  });

  if (booking === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (booking === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="text-center max-w-sm">
          <p className="text-sm text-gray-500">No booking found.</p>
        </Card>
      </div>
    );
  }

  const isCohort = booking.meetingType === "cohort";
  const startDate = parseISO(booking.selectedDate);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-7 h-7 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">You're booked!</h1>
        <p className="text-sm text-gray-500 mb-6">
          Calendar invites have been sent to all participants.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Time
            </p>
            <p className="text-sm text-gray-900">
              {formatTimeDisplay(booking.selectedTime)} &middot;{" "}
              {isCohort ? "60 min" : "30 min"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Schedule
            </p>
            {isCohort && booking.cohortDates ? (
              <>
                <p className="text-sm text-gray-900">
                  {booking.cohortTrack === "mon_wed" ? "Mon/Wed" : "Tue/Thu"}{" "}
                  Cohort &middot; 5 sessions
                </p>
                <div className="mt-1 space-y-0.5">
                  {booking.cohortDates.map((d, i) => (
                    <p key={d} className="text-xs text-gray-500">
                      Session {i + 1}
                      {i === booking.cohortDates!.length - 1 ? " (Wrap-up)" : ""}
                      {" — "}
                      {format(parseISO(d), "EEE, MMM d, yyyy")}
                    </p>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-900">
                  Every {format(startDate, "EEEE")} for 5 weeks
                </p>
                <ul className="mt-1 space-y-0.5">
                  {Array.from({ length: 5 }, (_, i) => addWeeks(startDate, i)).map(
                    (d, i) => (
                      <li key={i} className="text-xs text-gray-500">
                        {format(d, "MMM d, yyyy")}
                      </li>
                    ),
                  )}
                </ul>
              </>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Timezone
            </p>
            <p className="text-sm text-gray-900">
              {booking.timezone.replace(/_/g, " ")}
            </p>
          </div>
          {booking.guestEmails.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Guests
              </p>
              <p className="text-sm text-gray-900">
                {booking.guestEmails.join(", ")}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
