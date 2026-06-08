import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

export default function CreateLink() {
  const navigate = useNavigate();
  const createLink = useMutation(api.schedulingLinks.create);
  const [customerName, setCustomerName] = useState("");
  const [coHostEmail, setCoHostEmail] = useState("");
  const [meetingType, setMeetingType] = useState<"weekly_sync" | "cohort">("weekly_sync");
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) return;
    setLoading(true);
    try {
      const id = await createLink({
        customerName: customerName.trim(),
        coHostEmail: coHostEmail.trim() || undefined,
        meetingType,
      });
      const url = `${window.location.origin}/book/${id}`;
      setCreatedLink(url);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    if (createdLink) {
      navigator.clipboard.writeText(createdLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (createdLink) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Link Created</h1>
        <Card className="max-w-lg">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Scheduling link for {customerName}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Share this link with your customer
            </p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg mb-4">
              <code className="text-sm text-gray-700 flex-1 truncate">
                {createdLink}
              </code>
              <Button variant="secondary" size="sm" onClick={copyToClipboard}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <Button variant="ghost" onClick={() => navigate("/admin")}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Create Scheduling Link
      </h1>
      <Card className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="customerName"
            label="Customer name"
            placeholder="Acme Corp"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
          <Input
            id="coHostEmail"
            label="Co-host email (optional)"
            placeholder="colleague@airops.com"
            type="email"
            value={coHostEmail}
            onChange={(e) => setCoHostEmail(e.target.value)}
          />
          <p className="text-xs text-gray-400">
            If added, the co-host's calendar will also be checked for
            availability and they'll be invited to all meetings.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMeetingType("weekly_sync")}
                className={`p-3 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                  meetingType === "weekly_sync"
                    ? "border-green-700 bg-green-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">Weekly Sync</p>
                <p className="text-xs text-gray-500 mt-0.5">30 min · 5 weekly meetings</p>
              </button>
              <button
                type="button"
                onClick={() => setMeetingType("cohort")}
                className={`p-3 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                  meetingType === "cohort"
                    ? "border-green-700 bg-green-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">Cohort</p>
                <p className="text-xs text-gray-500 mt-0.5">60 min · 3-week program (2/2/1)</p>
              </button>
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Link"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
