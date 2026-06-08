import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { format } from "date-fns";
import { useState } from "react";

export default function Dashboard() {
  const links = useQuery(api.schedulingLinks.list);
  const bookingCounts = useQuery(api.bookings.countByLinks);
  const archive = useMutation(api.schedulingLinks.archive);
  const reactivate = useMutation(api.schedulingLinks.reactivate);
  const remove = useMutation(api.schedulingLinks.remove);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyLink(id: string) {
    const url = `${window.location.origin}/book/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function renderLinkGroup(title: string, items: typeof links) {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          {title}
        </h2>
        <div className="space-y-3">
          {items.map((link) => (
            <Card key={link._id} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    {link.customerName}
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                      {(link.meetingType || "weekly_sync") === "cohort" ? "Cohort" : "Weekly"}
                    </span>
                    <Link to={`/book/${link._id}`} target="_blank" title="Open booking page">
                      <svg className="w-3.5 h-3.5 text-gray-400 hover:text-green-700 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {link.coHostEmail
                      ? `Co-host: ${link.coHostEmail}`
                      : "No co-host"}
                    {" \u00b7 "}
                    Created {format(new Date(link.createdAt), "MMM d, yyyy")}
                    {" \u00b7 "}
                    {bookingCounts?.[link._id] ?? 0} booking{(bookingCounts?.[link._id] ?? 0) !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={link.status as "active" | "booked" | "archived"}>
                  {link.status}
                </Badge>
                {link.status !== "archived" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => copyLink(link._id)}
                  >
                    {copiedId === link._id ? "Copied!" : "Copy Link"}
                  </Button>
                )}
                {(link.status === "active" || link.status === "booked") && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => archive({ id: link._id as Id<"schedulingLinks"> })}
                  >
                    Archive
                  </Button>
                )}
                {link.status === "archived" && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => reactivate({ id: link._id as Id<"schedulingLinks"> })}
                    >
                      Re-Activate
                    </Button>
                    <button
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                      onClick={() => remove({ id: link._id as Id<"schedulingLinks"> })}
                      title="Delete permanently"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Scheduling Links
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your customer booking links
          </p>
        </div>
        <Link to="/admin/create">
          <Button>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Link
          </Button>
        </Link>
      </div>

      {links === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500 mb-4">No scheduling links yet</p>
          <Link to="/admin/create">
            <Button>Create your first link</Button>
          </Link>
        </Card>
      ) : (
        <>
          {renderLinkGroup(
            "Active",
            links.filter((l) => l.status === "active"),
          )}
          {renderLinkGroup(
            "Booked",
            links.filter((l) => l.status === "booked"),
          )}
          {renderLinkGroup(
            "Archived",
            links.filter((l) => l.status === "archived"),
          )}
        </>
      )}
    </div>
  );
}
