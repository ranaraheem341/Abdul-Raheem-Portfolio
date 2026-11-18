import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

export interface ButtonStyleProps {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface ButtonActionProps extends ButtonStyleProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonStyleProps> {
  href?: never;
}

export interface ButtonLinkProps extends ButtonStyleProps, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonStyleProps> {
  href: string;
}

export type ButtonProps = ButtonActionProps | ButtonLinkProps;

/** Use href for navigation; use onClick from a Client Component for actions. */
export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className = "", ...rest } = props;
  const classes = `ui-button ui-button-${variant} ui-button-${size} ${className}`;

  if (typeof rest.href === "string") {
    const { href, target, rel, ...linkProps } = rest as ButtonLinkProps;
    return <a className={classes} href={href} target={target} rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)} {...linkProps} />;
  }

  const { type = "button", ...buttonProps } = rest as ButtonActionProps;
  return <button className={classes} type={type} {...buttonProps} />;
}
