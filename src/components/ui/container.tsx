import type { HTMLAttributes } from "react";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function Container({ className = "", ...props }: ContainerProps) {
  return <div className={`ui-container ${className}`} {...props} />;
}
