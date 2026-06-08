import Select from "../ui/Select";

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Zurich",
  "Europe/Stockholm",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

interface TimezoneSelectorProps {
  timezone: string;
  onTimezoneChange: (tz: string) => void;
}

export default function TimezoneSelector({
  timezone,
  onTimezoneChange,
}: TimezoneSelectorProps) {
  return (
    <Select
      value={timezone}
      onChange={(e) => onTimezoneChange(e.target.value)}
      label="Timezone"
    >
      {COMMON_TIMEZONES.map((tz) => (
        <option key={tz} value={tz}>
          {tz.replace(/_/g, " ")}
        </option>
      ))}
    </Select>
  );
}
