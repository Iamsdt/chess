import { cn } from "@/lib/utils";

function Badge({ className, variant = "default", ...props }) {
  const variants = {
    default: "bg-primary/15 text-primary border-primary/20",
    excellent: "bg-green-500/15 text-green-400 border-green-500/20",
    good: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    inaccuracy: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    mistake: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    blunder: "bg-red-500/15 text-red-400 border-red-500/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  );
}

export { Badge };
