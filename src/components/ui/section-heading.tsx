import type { HTMLAttributes, ReactNode } from "react";

export interface SectionHeadingProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  headingId?: string;
}

export function SectionHeading({ eyebrow, title, description, headingId, className = "", ...props }: SectionHeadingProps) {
  return (
    <div className={`section-heading max-w-2xl ${className}`} {...props}>
      {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
      <h2 id={headingId} className="text-section font-semibold">{title}</h2>
      {description && <p className="mt-4 max-w-xl text-base text-muted">{description}</p>}
    </div>
  );
}
