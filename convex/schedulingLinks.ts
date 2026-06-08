import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const ADMIN_EMAIL = "calvin@airops.com";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("schedulingLinks")
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("schedulingLinks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    customerName: v.string(),
    coHostEmail: v.optional(v.string()),
    meetingType: v.optional(
      v.union(v.literal("weekly_sync"), v.literal("cohort")),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("schedulingLinks", {
      customerName: args.customerName,
      adminEmail: ADMIN_EMAIL,
      coHostEmail: args.coHostEmail,
      meetingType: args.meetingType || "weekly_sync",
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("schedulingLinks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const archive = mutation({
  args: { id: v.id("schedulingLinks") },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.id);
    if (!link) throw new Error("Link not found");
    await ctx.db.patch(args.id, { status: "archived" });
  },
});

export const reactivate = mutation({
  args: { id: v.id("schedulingLinks") },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.id);
    if (!link) throw new Error("Link not found");
    if (link.status !== "archived") throw new Error("Only archived links can be reactivated");
    const hasBookings = await ctx.db
      .query("bookings")
      .withIndex("by_linkId", (q) => q.eq("linkId", args.id))
      .first();
    await ctx.db.patch(args.id, { status: hasBookings ? "booked" : "active" });
  },
});

export const remove = mutation({
  args: { id: v.id("schedulingLinks") },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.id);
    if (!link) throw new Error("Link not found");
    await ctx.db.delete(args.id);
  },
});

export const updateStatus = internalMutation({
  args: {
    id: v.id("schedulingLinks"),
    status: v.union(
      v.literal("active"),
      v.literal("booked"),
      v.literal("archived"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});
