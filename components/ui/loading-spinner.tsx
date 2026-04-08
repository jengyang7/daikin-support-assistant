"use client";

import { cn } from "@/lib/utils";

export function LoadingSpinner({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-slate-200 border-t-brand",
        size === "sm" && "h-4 w-4",
        size === "md" && "h-8 w-8",
        size === "lg" && "h-12 w-12",
        className,
      )}
      aria-label="Loading"
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex h-full min-h-[50vh] w-full flex-1 items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
