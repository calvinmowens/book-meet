import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const getCached = internalQuery({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("availabilityCache")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .first();
    if (cached && cached.expiresAt > Date.now()) {
      return cached.slots;
    }
    return null;
  },
});

export const setCache = internalMutation({
  args: {
    cacheKey: v.string(),
    slots: v.array(v.object({ time: v.string(), available: v.boolean(), oooWeeks: v.optional(v.array(v.string())) })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("availabilityCache")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    await ctx.db.insert("availabilityCache", {
      cacheKey: args.cacheKey,
      slots: args.slots,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  },
});

type Slot = { time: string; available: boolean; oooWeeks?: string[] };

export const getCohortSlots = action({
  args: {
    linkId: v.id("schedulingLinks"),
    weekStartStr: v.string(),
    track: v.union(v.literal("mon_wed"), v.literal("tue_thu")),
    timezone: v.string(),
  },
  returns: v.array(v.object({ time: v.string(), available: v.boolean(), oooWeeks: v.optional(v.array(v.string())) })),
  handler: async (ctx, args): Promise<Slot[]> => {
    const link = await ctx.runQuery(
      internal.schedulingLinks.getInternal,
      { id: args.linkId },
    );
    if (!link) {
      throw new Error("Scheduling link not found");
    }
    if (link.status !== "active" && link.status !== "booked") {
      throw new Error("This scheduling link is no longer active");
    }

    const cacheKey = `${args.linkId}:cohort:${args.track}:${args.weekStartStr}:${args.timezone}`;
    const cached: Slot[] | null = await ctx.runQuery(
      internal.availability.getCached,
      { cacheKey },
    );
    if (cached) {
      return cached;
    }

    const slots: Slot[] = await ctx.runAction(
      internal.googleCalendar.checkCohortAvailability,
      {
        adminEmail: link.adminEmail,
        coHostEmail: link.coHostEmail,
        weekStartStr: args.weekStartStr,
        track: args.track,
        timezone: args.timezone,
      },
    );

    await ctx.runMutation(internal.availability.setCache, {
      cacheKey,
      slots,
    });

    return slots;
  },
});

export const getSlots = action({
  args: {
    linkId: v.id("schedulingLinks"),
    dateStr: v.string(),
    timezone: v.string(),
  },
  returns: v.array(v.object({ time: v.string(), available: v.boolean(), oooWeeks: v.optional(v.array(v.string())) })),
  handler: async (ctx, args): Promise<Slot[]> => {
    const link = await ctx.runQuery(
      internal.schedulingLinks.getInternal,
      { id: args.linkId },
    );
    if (!link) {
      throw new Error("Scheduling link not found");
    }
    if (link.status !== "active" && link.status !== "booked") {
      throw new Error("This scheduling link is no longer active");
    }

    // Check cache
    const cacheKey = `${args.linkId}:${args.dateStr}:${args.timezone}`;
    const cached: Slot[] | null = await ctx.runQuery(
      internal.availability.getCached,
      { cacheKey },
    );
    if (cached) {
      return cached;
    }

    // Fetch from Google Calendar
    const slots: Slot[] = await ctx.runAction(
      internal.googleCalendar.checkAvailability,
      {
        adminEmail: link.adminEmail,
        coHostEmail: link.coHostEmail,
        dateStr: args.dateStr,
        timezone: args.timezone,
      },
    );

    // Cache the result
    await ctx.runMutation(internal.availability.setCache, {
      cacheKey,
      slots,
    });

    return slots;
  },
});
