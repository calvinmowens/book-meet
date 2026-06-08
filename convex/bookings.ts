import { action, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { computeRescheduledCohortDates } from "./cohortDates";

export const insertBooking = internalMutation({
  args: {
    linkId: v.id("schedulingLinks"),
    bookerEmail: v.string(),
    guestEmails: v.array(v.string()),
    selectedDate: v.string(),
    selectedTime: v.string(),
    timezone: v.string(),
    googleEventId: v.optional(v.string()),
    meetingType: v.optional(v.union(v.literal("weekly_sync"), v.literal("cohort"))),
    cohortTrack: v.optional(v.union(v.literal("mon_wed"), v.literal("tue_thu"))),
    cohortDates: v.optional(v.array(v.string())),
    googleEventIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bookings", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const create = action({
  args: {
    linkId: v.id("schedulingLinks"),
    bookerEmail: v.string(),
    guestEmails: v.array(v.string()),
    selectedDate: v.string(),
    selectedTime: v.string(),
    timezone: v.string(),
    cohortTrack: v.optional(v.union(v.literal("mon_wed"), v.literal("tue_thu"))),
  },
  handler: async (ctx, args) => {
    const link = await ctx.runQuery(
      internal.schedulingLinks.getInternal,
      { id: args.linkId },
    );
    if (!link || (link.status !== "active" && link.status !== "booked")) {
      throw new Error("This scheduling link is no longer available");
    }

    const meetingType = link.meetingType || "weekly_sync";

    if (meetingType === "cohort") {
      if (!args.cohortTrack) {
        throw new Error("Cohort track is required for cohort bookings");
      }

      const slots: Array<{ time: string; available: boolean; oooWeeks?: string[] }> =
        await ctx.runAction(internal.googleCalendar.checkCohortAvailability, {
          adminEmail: link.adminEmail,
          coHostEmail: link.coHostEmail,
          weekStartStr: args.selectedDate,
          track: args.cohortTrack,
          timezone: args.timezone,
        });
      const selectedSlot = slots.find((s) => s.time === args.selectedTime);
      if (!selectedSlot || !selectedSlot.available) {
        throw new Error("This time slot is no longer available. Please select another time.");
      }

      const cohortDates = computeRescheduledCohortDates(
        args.selectedDate,
        args.cohortTrack,
        selectedSlot.oooWeeks || [],
      );

      const googleEventIds: string[] = await ctx.runAction(
        internal.googleCalendar.createCohortEvents,
        {
          adminEmail: link.adminEmail,
          coHostEmail: link.coHostEmail,
          bookerEmail: args.bookerEmail,
          guestEmails: args.guestEmails,
          customerName: link.customerName,
          weekStartStr: args.selectedDate,
          track: args.cohortTrack,
          time: args.selectedTime,
          timezone: args.timezone,
          oooWeeks: selectedSlot.oooWeeks || [],
        },
      );

      await ctx.runMutation(internal.bookings.insertBooking, {
        linkId: args.linkId,
        bookerEmail: args.bookerEmail,
        guestEmails: args.guestEmails,
        selectedDate: args.selectedDate,
        selectedTime: args.selectedTime,
        timezone: args.timezone,
        meetingType: "cohort",
        cohortTrack: args.cohortTrack,
        cohortDates,
        googleEventIds,
      });

      await ctx.runMutation(internal.schedulingLinks.updateStatus, {
        id: args.linkId,
        status: "booked",
      });

      await ctx.runAction(internal.googleCalendar.sendBookingNotification, {
        adminEmail: link.adminEmail,
        customerName: link.customerName,
        bookerEmail: args.bookerEmail,
        selectedDate: args.selectedDate,
        selectedTime: args.selectedTime,
        timezone: args.timezone,
        meetingType: "cohort",
        cohortTrack: args.cohortTrack,
      });
    } else {
      // Weekly sync flow (existing)
      const slots: Array<{ time: string; available: boolean; oooWeeks?: string[] }> =
        await ctx.runAction(internal.googleCalendar.checkAvailability, {
          adminEmail: link.adminEmail,
          coHostEmail: link.coHostEmail,
          dateStr: args.selectedDate,
          timezone: args.timezone,
        });
      const selectedSlot = slots.find((s) => s.time === args.selectedTime);
      if (!selectedSlot || !selectedSlot.available) {
        throw new Error("This time slot is no longer available. Please select another time.");
      }

      const googleEventId: string = await ctx.runAction(
        internal.googleCalendar.createRecurringEvent,
        {
          adminEmail: link.adminEmail,
          coHostEmail: link.coHostEmail,
          bookerEmail: args.bookerEmail,
          guestEmails: args.guestEmails,
          customerName: link.customerName,
          date: args.selectedDate,
          time: args.selectedTime,
          timezone: args.timezone,
          oooWeeks: selectedSlot.oooWeeks || [],
        },
      );

      await ctx.runMutation(internal.bookings.insertBooking, {
        linkId: args.linkId,
        bookerEmail: args.bookerEmail,
        guestEmails: args.guestEmails,
        selectedDate: args.selectedDate,
        selectedTime: args.selectedTime,
        timezone: args.timezone,
        meetingType: "weekly_sync",
        googleEventId,
      });

      await ctx.runMutation(internal.schedulingLinks.updateStatus, {
        id: args.linkId,
        status: "booked",
      });

      await ctx.runAction(internal.googleCalendar.sendBookingNotification, {
        adminEmail: link.adminEmail,
        customerName: link.customerName,
        bookerEmail: args.bookerEmail,
        selectedDate: args.selectedDate,
        selectedTime: args.selectedTime,
        timezone: args.timezone,
        meetingType: "weekly_sync",
      });
    }

    return { success: true };
  },
});

export const getByLinkId = query({
  args: { linkId: v.id("schedulingLinks") },
  handler: async (ctx, args) => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_linkId", (q) => q.eq("linkId", args.linkId))
      .collect();
    // Return the most recent booking
    return bookings.length > 0 ? bookings[bookings.length - 1] : null;
  },
});

export const countByLinks = query({
  args: {},
  handler: async (ctx) => {
    const allBookings = await ctx.db.query("bookings").collect();
    const counts: Record<string, number> = {};
    for (const b of allBookings) {
      counts[b.linkId] = (counts[b.linkId] || 0) + 1;
    }
    return counts;
  },
});
