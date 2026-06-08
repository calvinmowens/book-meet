import { cn } from "../../lib/utils";
import { type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export default function Select({
  label,
  className,
  id,
  children,
  ...props
}: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white",
          "focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
