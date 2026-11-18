import type { HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent";
}

export function Badge({ variant = "default", className = "", ...props }: BadgeProps) {
  return <span className={`ui-badge ${variant === "accent" ? "ui-badge-accent" : ""} ${className}`} {...props} />;
}
