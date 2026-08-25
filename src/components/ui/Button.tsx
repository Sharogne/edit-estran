import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-accent-deep border border-transparent",
  ghost: "bg-transparent text-ink border border-line hover:border-ink",
  danger: "bg-transparent text-accent-deep border border-line hover:border-accent-deep",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium tracking-wide transition-colors disabled:opacity-50 disabled:pointer-events-none";

/**
 * Polymorphic button — renders any element (button by default, pass as={Link}
 * for navigations) so visual style stays identical across the site and admin.
 */
export function Button<T extends ElementType = "button">({
  as,
  variant = "primary",
  className = "",
  children,
  ...props
}: {
  as?: T;
  variant?: Variant;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "variant" | "className" | "children">) {
  const Component = (as ?? "button") as ElementType;
  return (
    <Component className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </Component>
  );
}
