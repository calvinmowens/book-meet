import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  schedulingLinks: defineTable({
    customerName: v.string(),
    adminEmail: v.string(),
    coHostEmail: v.optional(v.string()),
    meetingType: v.optional(
      v.union(v.literal("weekly_sync"), v.literal("cohort")),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("booked"),
      v.literal("archived"),
    ),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  bookings: defineTable({
    linkId: v.id("schedulingLinks"),
    bookerEmail: v.string(),
    guestEmails: v.array(v.string()),
    selectedDate: v.string(),
    selectedTime: v.string(),
    timezone: v.string(),
    googleEventId: v.optional(v.string()),
    meetingType: v.optional(
      v.union(v.literal("weekly_sync"), v.literal("cohort")),
    ),
    cohortTrack: v.optional(
      v.union(v.literal("mon_wed"), v.literal("tue_thu")),
    ),
    cohortDates: v.optional(v.array(v.string())),
    googleEventIds: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }).index("by_linkId", ["linkId"]),

  adminTokens: defineTable({
    email: v.string(),
    refreshToken: v.string(),
    accessToken: v.string(),
    expiresAt: v.number(),
  }).index("by_email", ["email"]),

  availabilityCache: defineTable({
    cacheKey: v.string(),
    slots: v.array(
      v.object({
        time: v.string(),
        available: v.boolean(),
        oooWeeks: v.optional(v.array(v.string())),
        sessionDates: v.optional(v.array(v.string())),
      }),
    ),
    expiresAt: v.number(),
  })
    .index("by_cacheKey", ["cacheKey"])
    .index("by_expiresAt", ["expiresAt"]),
});
