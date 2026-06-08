import { cn } from "../../lib/utils";

type BadgeVariant = "active" | "booked" | "archived";

const variantStyles: Record<BadgeVariant, string> = {
  active: "bg-green-100 text-green-800",
  booked: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-600",
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export default function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
