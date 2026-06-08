import { cn } from "../../lib/utils";
import { type HTMLAttributes } from "react";

export default function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-200 shadow-sm p-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
