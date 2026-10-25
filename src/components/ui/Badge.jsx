import { cn } from "../../lib/utils.js";

export function Badge({ className, tone = "default", ...props }) {
  const tones = {
    default: "bg-muted text-muted-foreground",
    success: "bg-emerald-500/15 text-emerald-300",
    warning: "bg-amber-500/15 text-amber-300",
    info: "bg-cyan-500/15 text-cyan-300"
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", tones[tone], className)} {...props} />;
}
