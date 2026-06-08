import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const store = internalMutation({
  args: {
    email: v.string(),
    refreshToken: v.string(),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("adminTokens")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        refreshToken: args.refreshToken,
        accessToken: args.accessToken,
        expiresAt: args.expiresAt,
      });
    } else {
      await ctx.db.insert("adminTokens", args);
    }
  },
});

export const get = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("adminTokens")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

export const updateAccessToken = internalMutation({
  args: {
    email: v.string(),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("adminTokens")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        expiresAt: args.expiresAt,
      });
    }
  },
});
