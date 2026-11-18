import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover = false, className = "", ...props }: CardProps) {
  return <div className={`ui-card ${hover ? "ui-card-hover" : ""} ${className}`} {...props} />;
}
