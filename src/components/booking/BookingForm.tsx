import { useState } from "react";
import Button from "../ui/Button";
import Input from "../ui/Input";

interface BookingFormProps {
  onSubmit: (data: { email: string; guests: string[] }) => void;
  loading: boolean;
}

export default function BookingForm({ onSubmit, loading }: BookingFormProps) {
  const [email, setEmail] = useState("");
  const [guests, setGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [guestEmailError, setGuestEmailError] = useState("");

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  function addGuest() {
    const trimmed = guestInput.trim();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) {
      setGuestEmailError("Please enter a valid email address.");
      return;
    }
    setGuestEmailError("");
    if (guests.includes(trimmed)) return;
    setGuests([...guests, trimmed]);
    setGuestInput("");
  }

  function removeGuest(index: number) {
    setGuests(guests.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    onSubmit({ email, guests });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="email"
        label="Your email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setEmailError("");
        }}
        error={emailError}
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Additional guests (optional)
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="guest@company.com"
            value={guestInput}
            onChange={(e) => {
              setGuestInput(e.target.value);
              setGuestEmailError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addGuest();
              }
            }}
            error={guestEmailError}
            className="flex-1"
          />
          <Button type="button" variant="secondary" size="md" onClick={addGuest}>
            Add
          </Button>
        </div>

        {guests.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {guests.map((guest, i) => (
              <span
                key={guest}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-sm text-gray-700"
              >
                {guest}
                <button
                  type="button"
                  onClick={() => removeGuest(i)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Booking..." : "Confirm Booking"}
      </Button>
    </form>
  );
}
