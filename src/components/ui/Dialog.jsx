import { cn } from "@/lib/utils";

function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      <div className="relative z-50">{children}</div>
    </div>
  );
}

function DialogContent({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function DialogHeader({ className, ...props }) {
  return (
    <div className={cn("flex flex-col space-y-1.5 mb-4", className)} {...props} />
  );
}

function DialogTitle({ className, ...props }) {
  return (
    <h2
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
