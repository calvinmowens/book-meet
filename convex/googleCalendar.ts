"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { google, type calendar_v3 } from "googleapis";
import { computeCohortDates, computeRescheduledCohortDates } from "./cohortDates";

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

async function getValidAccessToken(
  ctx: any,
  email: string,
): Promise<string> {
  const token = await ctx.runQuery(internal.adminTokens.get, { email });
  if (!token) {
    throw new Error(
      `No stored token for ${email}. Admin must re-authenticate.`,
    );
  }

  if (token.expiresAt > Date.now() + 60_000) {
    return token.accessToken;
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: token.refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();

  const newAccessToken = credentials.access_token!;
  const newExpiresAt = credentials.expiry_date || Date.now() + 3600_000;

  await ctx.runMutation(internal.adminTokens.updateAccessToken, {
    email,
    accessToken: newAccessToken,
    expiresAt: newExpiresAt,
  });

  return newAccessToken;
}

function toUTCDate(dateStr: string, timeStr: string, timezone: string): Date {
  const [hour, minute] = timeStr.split(":").map(Number);
  const naive = new Date(`${dateStr}T${timeStr.padStart(5, "0")}:00Z`);

  const inTz = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(naive);

  const tzH = parseInt(inTz.find((p) => p.type === "hour")?.value || "0");
  const tzM = parseInt(inTz.find((p) => p.type === "minute")?.value || "0");
  const tzDay = parseInt(inTz.find((p) => p.type === "day")?.value || "0");
  const naiveDay = naive.getUTCDate();

  let offsetMinutes = (tzH - hour) * 60 + (tzM - minute);
  if (tzDay > naiveDay) offsetMinutes += 24 * 60;
  if (tzDay < naiveDay) offsetMinutes -= 24 * 60;

  return new Date(naive.getTime() - offsetMinutes * 60_000);
}

async function fetchBusyAndOooPeriods(
  calendar: calendar_v3.Calendar,
  adminEmail: string,
  coHostEmail: string | undefined,
  timeMin: string,
  timeMax: string,
  timezone: string,
): Promise<{
  busyPeriods: Array<{ start: number; end: number }>;
  oooPeriods: Array<{ start: number; end: number }>;
}> {
  const busyPeriods: Array<{ start: number; end: number }> = [];
  const oooPeriods: Array<{ start: number; end: number }> = [];

  // Admin: events.list to distinguish OOO from real conflicts
  let pageToken: string | undefined;
  do {
    const eventsResponse = await calendar.events.list({
      calendarId: adminEmail,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
      pageToken,
    });

    for (const event of eventsResponse.data.items || []) {
      if (event.transparency === "transparent") continue;
      const start = event.start?.dateTime
        ? new Date(event.start.dateTime).getTime()
        : event.start?.date
          ? new Date(event.start.date).getTime()
          : null;
      const end = event.end?.dateTime
        ? new Date(event.end.dateTime).getTime()
        : event.end?.date
          ? new Date(event.end.date).getTime()
          : null;
      if (!start || !end) continue;

      if (event.eventType === "outOfOffice") {
        oooPeriods.push({ start, end });
      } else {
        busyPeriods.push({ start, end });
      }
    }

    pageToken = eventsResponse.data.nextPageToken || undefined;
  } while (pageToken);

  // Co-host: freebusy (works cross-Workspace without calendar sharing)
  if (coHostEmail) {
    const freebusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: timezone,
        items: [{ id: coHostEmail }],
      },
    });
    const coHostBusy =
      freebusyResponse.data.calendars?.[coHostEmail]?.busy || [];
    for (const period of coHostBusy) {
      if (period.start && period.end) {
        busyPeriods.push({
          start: new Date(period.start).getTime(),
          end: new Date(period.end).getTime(),
        });
      }
    }
  }

  return { busyPeriods, oooPeriods };
}

function computeBusinessHourMinutes(
  refDate: string,
  timezone: string,
): { startTotalMin: number; endTotalMin: number } {
  const BUSINESS_TZ = "America/New_York";
  const businessStartUtc = toUTCDate(refDate, "09:00", BUSINESS_TZ);
  const businessEndUtc = toUTCDate(refDate, "17:00", BUSINESS_TZ);

  function utcToLocalMinutes(utcDate: Date, tz: string): number {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(utcDate);
    const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
    const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
    return h * 60 + m;
  }

  return {
    startTotalMin: utcToLocalMinutes(businessStartUtc, timezone),
    endTotalMin: utcToLocalMinutes(businessEndUtc, timezone),
  };
}

function generateSlots(
  dateStrs: string[],
  busyPeriods: Array<{ start: number; end: number }>,
  oooPeriods: Array<{ start: number; end: number }>,
  startTotalMin: number,
  endTotalMin: number,
  durationMinutes: number,
  timezone: string,
): Array<{ time: string; available: boolean; oooWeeks: string[] }> {
  const slots: Array<{ time: string; available: boolean; oooWeeks: string[] }> = [];
  if (startTotalMin >= endTotalMin) return slots;

  for (let totalMin = startTotalMin; totalMin + durationMinutes <= endTotalMin; totalMin += 30) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    const endMinOfSlot = totalMin + durationMinutes;
    const endH = Math.floor(endMinOfSlot / 60);
    const endM = endMinOfSlot % 60;
    const endTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

    let available = true;
    const oooWeeks: string[] = [];

    for (const dateStr of dateStrs) {
      const slotStartMs = toUTCDate(dateStr, time, timezone).getTime();
      const slotEndMs = toUTCDate(dateStr, endTime, timezone).getTime();

      const hasConflict = busyPeriods.some(
        (busy) => busy.start < slotEndMs && busy.end > slotStartMs,
      );
      if (hasConflict) {
        available = false;
        break;
      }

      const hasOoo = oooPeriods.some(
        (ooo) => ooo.start < slotEndMs && ooo.end > slotStartMs,
      );
      if (hasOoo) {
        oooWeeks.push(dateStr);
      }
    }

    slots.push({ time, available, oooWeeks });
  }

  return slots;
}

function computeTimeRange(
  dateStrs: string[],
  timezone: string,
): { timeMin: string; timeMax: string } {
  const sorted = [...dateStrs].sort();
  const firstDate = sorted[0];
  const lastDate = sorted[sorted.length - 1];
  const timeMin = toUTCDate(firstDate, "00:00", timezone).toISOString();
  const lastParts = lastDate.split("-").map(Number);
  const dayAfterLast = new Date(
    Date.UTC(lastParts[0], lastParts[1] - 1, lastParts[2] + 1),
  );
  const dayAfterLastStr = `${dayAfterLast.getUTCFullYear()}-${(dayAfterLast.getUTCMonth() + 1).toString().padStart(2, "0")}-${dayAfterLast.getUTCDate().toString().padStart(2, "0")}`;
  const timeMax = toUTCDate(dayAfterLastStr, "00:00", timezone).toISOString();
  return { timeMin, timeMax };
}

export const checkAvailability = internalAction({
  args: {
    adminEmail: v.string(),
    coHostEmail: v.optional(v.string()),
    dateStr: v.string(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const accessToken = await getValidAccessToken(ctx, args.adminEmail);
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Compute 5 weekly date strings
    const [year, month, day] = args.dateStr.split("-").map(Number);
    const weeklyDateStrs: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(Date.UTC(year, month - 1, day + i * 7));
      const y = d.getUTCFullYear();
      const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
      const dd = d.getUTCDate().toString().padStart(2, "0");
      weeklyDateStrs.push(`${y}-${m}-${dd}`);
    }

    const { timeMin, timeMax } = computeTimeRange(weeklyDateStrs, args.timezone);
    const { busyPeriods, oooPeriods } = await fetchBusyAndOooPeriods(
      calendar, args.adminEmail, args.coHostEmail, timeMin, timeMax, args.timezone,
    );
    const { startTotalMin, endTotalMin } = computeBusinessHourMinutes(weeklyDateStrs[0], args.timezone);

    return generateSlots(weeklyDateStrs, busyPeriods, oooPeriods, startTotalMin, endTotalMin, 30, args.timezone);
  },
});

export const createRecurringEvent = internalAction({
  args: {
    adminEmail: v.string(),
    coHostEmail: v.optional(v.string()),
    bookerEmail: v.string(),
    guestEmails: v.array(v.string()),
    customerName: v.string(),
    date: v.string(),
    time: v.string(),
    timezone: v.string(),
    oooWeeks: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const accessToken = await getValidAccessToken(ctx, args.adminEmail);

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const startDateTime = `${args.date}T${args.time}:00`;
    const [h, m] = args.time.split(":").map(Number);
    const endMinTotal = h * 60 + m + 30;
    const endH = Math.floor(endMinTotal / 60);
    const endM = endMinTotal % 60;
    const endTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
    const endDateTime = `${args.date}T${endTime}:00`;

    const attendees: Array<{ email: string }> = [
      { email: args.bookerEmail },
    ];
    if (args.coHostEmail) {
      attendees.push({ email: args.coHostEmail });
    }
    for (const guest of args.guestEmails) {
      attendees.push({ email: guest });
    }

    const summary = `AirOps <> ${args.customerName}, Weekly Sync`;

    // Build recurrence rules, skipping OOO weeks via EXDATE
    const totalCount = 5 + args.oooWeeks.length;
    const recurrence = [`RRULE:FREQ=WEEKLY;COUNT=${totalCount}`];
    for (const oooDate of args.oooWeeks) {
      // EXDATE must match the start dateTime format with timezone
      const exDateTime = `${oooDate.replace(/-/g, "")}T${args.time.replace(":", "")}00`;
      recurrence.push(`EXDATE;TZID=${args.timezone}:${exDateTime}`);
    }

    // Discover available conference solutions (Zoom add-on registers here)
    const calEntry = await calendar.calendarList.get({ calendarId: "primary" });
    const allowedTypes =
      calEntry.data.conferenceProperties?.allowedConferenceSolutionTypes || [];

    // Prefer Zoom (addOn) > Google Meet > try addOn anyway (API creates event even if conference fails)
    const conferenceType = allowedTypes.includes("addOn")
      ? "addOn"
      : allowedTypes.includes("hangoutsMeet")
        ? "hangoutsMeet"
        : "addOn";

    const requestBody: Record<string, unknown> = {
      summary,
      start: {
        dateTime: startDateTime,
        timeZone: args.timezone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: args.timezone,
      },
      recurrence,
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `bookmeet-${Date.now()}`,
          conferenceSolutionKey: { type: conferenceType },
        },
      },
    };

    const event = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all",
      conferenceDataVersion: 1,
      requestBody,
    });

    return event.data.id || "";
  },
});

export const checkCohortAvailability = internalAction({
  args: {
    adminEmail: v.string(),
    coHostEmail: v.optional(v.string()),
    weekStartStr: v.string(),
    track: v.union(v.literal("mon_wed"), v.literal("tue_thu")),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const accessToken = await getValidAccessToken(ctx, args.adminEmail);
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const cohortDateStrs = computeCohortDates(args.weekStartStr, args.track);
    const { timeMin, timeMax } = computeTimeRange(cohortDateStrs, args.timezone);
    const { busyPeriods, oooPeriods } = await fetchBusyAndOooPeriods(
      calendar, args.adminEmail, args.coHostEmail, timeMin, timeMax, args.timezone,
    );
    const { startTotalMin, endTotalMin } = computeBusinessHourMinutes(cohortDateStrs[0], args.timezone);

    return generateSlots(cohortDateStrs, busyPeriods, oooPeriods, startTotalMin, endTotalMin, 60, args.timezone);
  },
});

export const createCohortEvents = internalAction({
  args: {
    adminEmail: v.string(),
    coHostEmail: v.optional(v.string()),
    bookerEmail: v.string(),
    guestEmails: v.array(v.string()),
    customerName: v.string(),
    weekStartStr: v.string(),
    track: v.union(v.literal("mon_wed"), v.literal("tue_thu")),
    time: v.string(),
    timezone: v.string(),
    oooWeeks: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const accessToken = await getValidAccessToken(ctx, args.adminEmail);
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const cohortDates = computeRescheduledCohortDates(
      args.weekStartStr,
      args.track,
      args.oooWeeks,
    );

    const attendees: Array<{ email: string }> = [
      { email: args.bookerEmail },
    ];
    if (args.coHostEmail) {
      attendees.push({ email: args.coHostEmail });
    }
    for (const guest of args.guestEmails) {
      attendees.push({ email: guest });
    }

    // Discover conference solution
    const calEntry = await calendar.calendarList.get({ calendarId: "primary" });
    const allowedTypes =
      calEntry.data.conferenceProperties?.allowedConferenceSolutionTypes || [];

    // Prefer Zoom (addOn) > Google Meet > try addOn anyway
    const conferenceType = allowedTypes.includes("addOn")
      ? "addOn"
      : allowedTypes.includes("hangoutsMeet")
        ? "hangoutsMeet"
        : "addOn";

    const [h, m] = args.time.split(":").map(Number);
    const endMinTotal = h * 60 + m + 60;
    const endH = Math.floor(endMinTotal / 60);
    const endM = endMinTotal % 60;
    const endTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;

    const eventIds: string[] = [];
    const totalSessions = cohortDates.length;

    for (let i = 0; i < cohortDates.length; i++) {
      const dateStr = cohortDates[i];
      const sessionNum = i + 1;
      const isWrapUp = i === totalSessions - 1;
      const summary = isWrapUp
        ? `AirOps <> ${args.customerName}, Cohort Wrap-up (${sessionNum}/${totalSessions})`
        : `AirOps <> ${args.customerName}, Cohort (${sessionNum}/${totalSessions})`;

      const requestBody: Record<string, unknown> = {
        summary,
        start: {
          dateTime: `${dateStr}T${args.time}:00`,
          timeZone: args.timezone,
        },
        end: {
          dateTime: `${dateStr}T${endTime}:00`,
          timeZone: args.timezone,
        },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `bookmeet-cohort-${dateStr}-${Date.now()}`,
            conferenceSolutionKey: { type: conferenceType },
          },
        },
      };

      const event = await calendar.events.insert({
        calendarId: "primary",
        sendUpdates: "all",
        conferenceDataVersion: 1,
        requestBody,
      });

      eventIds.push(event.data.id || "");
    }

    return eventIds;
  },
});

export const sendBookingNotification = internalAction({
  args: {
    adminEmail: v.string(),
    customerName: v.string(),
    bookerEmail: v.string(),
    selectedDate: v.string(),
    selectedTime: v.string(),
    timezone: v.string(),
    meetingType: v.optional(v.string()),
    cohortTrack: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const accessToken = await getValidAccessToken(ctx, args.adminEmail);

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const [h, min] = args.selectedTime.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const timeDisplay = `${h12}:${min.toString().padStart(2, "0")} ${ampm}`;

    const [yr, mo, dy] = args.selectedDate.split("-");
    const dateObj = new Date(Number(yr), Number(mo) - 1, Number(dy));
    const dateDisplay = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const isCohort = args.meetingType === "cohort";
    const trackLabel = args.cohortTrack === "tue_thu" ? "Tue/Thu" : "Mon/Wed";
    const cadence = isCohort
      ? `Cohort · 5 sessions · 60 min · ${trackLabel} track`
      : "Weekly · 5 sessions · 30 min";
    const subtitle = isCohort
      ? "A customer just scheduled a cohort."
      : "A customer just scheduled a recurring weekly sync.";

    const subject = `New Meeting Booked: ${args.customerName}`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Inter',system-ui,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#166534;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600;">AirOps · BookMeet</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700;">New meeting booked</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${subtitle}</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;width:110px;">Customer</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:500;">${args.customerName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">Booked by</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:500;">${args.bookerEmail}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">First meeting</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:500;">${dateDisplay}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">Time</td>
          <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#111827;font-size:14px;font-weight:500;">${timeDisplay} (${args.timezone})</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#6b7280;font-size:13px;">Cadence</td>
          <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:500;">${cadence}</td>
        </tr>
      </table>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Sent by BookMeet · AirOps</p>
    </div>
  </div>
</body>
</html>`.trim();

    const message = [
      `From: BookMeet <${args.adminEmail}>`,
      `To: ${args.adminEmail}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "",
      html,
    ].join("\r\n");

    const encoded = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    try {
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encoded },
      });
    } catch (e) {
      console.error("Failed to send booking notification email:", e);
    }
  },
});
