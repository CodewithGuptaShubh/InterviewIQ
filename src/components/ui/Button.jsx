import { cn } from "../../lib/utils.js";
import { cloneElement, isValidElement } from "react";

const variants = {
  primary: "bg-primary text-primary-foreground shadow-glow hover:brightness-110",
  secondary: "bg-muted text-foreground hover:bg-muted/80",
  ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
  outline: "border bg-card/40 hover:bg-muted",
  danger: "bg-red-500 text-white hover:bg-red-400"
};

export function Button({ className, variant = "primary", size = "md", asChild = false, children, ...props }) {
  const classes = cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5",
        variants[variant],
        className
      );

  if (asChild && isValidElement(children)) {
    return cloneElement(children, { className: cn(classes, children.props.className), ...props });
  }

  return <button className={classes} {...props}>{children}</button>;
}
