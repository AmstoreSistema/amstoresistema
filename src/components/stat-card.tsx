import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  gold: "bg-gradient-gold text-primary-foreground shadow-gold",
  dark: "bg-gradient-dark text-gold shadow-elegant",
  success: "bg-success/12 text-success",
  info: "bg-info/12 text-info",
  warning: "bg-warning/15 text-warning-foreground",
  destructive: "bg-destructive/12 text-destructive",
} as const;

export function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  tone = "dark",
  to,
  compact = false,
}: {
  title: string;
  value: ReactNode;
  sub?: ReactNode | undefined;
  icon: any;
  tone?: keyof typeof tones | undefined;
  to?: string | undefined;
  compact?: boolean | undefined;
}) {
  const body = (
    <div className={cn(
      "group h-full border border-border bg-card shadow-elegant transition-all hover:-translate-y-0.5 hover:border-gold/40 flex flex-col justify-between",
      compact
        ? "rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5"
        : "rounded-2xl p-3.5 sm:p-5"
    )}>
      <div>
        <div className="flex items-start justify-between">
          <div className={cn(
            "flex items-center justify-center shrink-0",
            compact
              ? "size-7 sm:size-8 rounded-md sm:rounded-lg"
              : "size-8 sm:size-10 rounded-lg sm:rounded-xl",
            tones[tone]
          )}>
            <Icon className={compact ? "size-3.5 sm:size-4" : "size-4 sm:size-5"} />
          </div>
          {to && (
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground group-hover:text-gold">
              ver
            </span>
          )}
        </div>
        <p className={cn(
          "font-semibold uppercase tracking-wide text-muted-foreground line-clamp-1",
          compact
            ? "mt-2 sm:mt-2.5 text-[9px] sm:text-[11px]"
            : "mt-2.5 sm:mt-4 text-[10px] sm:text-xs"
        )}>{title}</p>
        <p className={cn(
          "font-bold tabular-nums truncate",
          compact
            ? "mt-0.5 text-sm sm:text-base xl:text-lg"
            : "mt-0.5 sm:mt-1 text-base sm:text-2xl"
        )}>{value}</p>
      </div>
      {sub && <p className={cn("text-muted-foreground line-clamp-1", compact ? "mt-0.5 text-[9px] sm:text-[10px]" : "mt-1 text-[10px] sm:text-xs")}>{sub}</p>}
    </div>
  );

  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}