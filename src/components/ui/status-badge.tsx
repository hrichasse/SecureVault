import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        success: "bg-success/10 text-success border border-success/20",
        warning: "bg-warning/10 text-warning border border-warning/20",
        danger: "bg-destructive/10 text-destructive border border-destructive/20",
        info: "bg-primary/10 text-primary border border-primary/20",
        neutral: "bg-muted text-muted-foreground border border-border",
        low: "bg-success/10 text-success border border-success/20",
        medium: "bg-warning/10 text-warning border border-warning/20",
        high: "bg-destructive/10 text-destructive border border-destructive/20",
        critical: "bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ variant }), className)}>{children}</span>;
}
