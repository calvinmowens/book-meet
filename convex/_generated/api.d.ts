/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminTokens from "../adminTokens.js";
import type * as availability from "../availability.js";
import type * as bookings from "../bookings.js";
import type * as cohortDates from "../cohortDates.js";
import type * as googleCalendar from "../googleCalendar.js";
import type * as http from "../http.js";
import type * as schedulingLinks from "../schedulingLinks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminTokens: typeof adminTokens;
  availability: typeof availability;
  bookings: typeof bookings;
  cohortDates: typeof cohortDates;
  googleCalendar: typeof googleCalendar;
  http: typeof http;
  schedulingLinks: typeof schedulingLinks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
