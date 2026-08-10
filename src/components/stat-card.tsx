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
    <div className="group h-full rounded-2xl border border-border bg-card p-5 shadow-elegant transition-all hover:-translate-y-0.5 hover:border-gold/40">
      <div className="flex items-start justify-between">
        <div className={cn("flex size-10 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="size-5" />
        </div>
        {to && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground group-hover:text-gold">
            ver
          </span>
        )}
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
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