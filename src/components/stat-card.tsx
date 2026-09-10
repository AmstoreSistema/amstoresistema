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
}: {
  title: string;
  value: ReactNode;
  sub?: ReactNode | undefined;
  icon: any;
  tone?: keyof typeof tones | undefined;
  to?: string | undefined;
}) {
  const body = (
    <div className="group h-full rounded-2xl border border-border bg-card p-3.5 sm:p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:border-gold/40 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between">
          <div className={cn("flex size-8 sm:size-10 items-center justify-center rounded-lg sm:rounded-xl shrink-0", tones[tone])}>
            <Icon className="size-4 sm:size-5" />
          </div>
          {to && (
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground group-hover:text-gold">
              ver
            </span>
          )}
        </div>
        <p className="mt-2.5 sm:mt-4 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground line-clamp-1">{title}</p>
        <p className="mt-0.5 sm:mt-1 text-base sm:text-2xl font-bold tabular-nums truncate">{value}</p>
      </div>
      {sub && <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground line-clamp-1">{sub}</p>}
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