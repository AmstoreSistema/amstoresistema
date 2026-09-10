import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string | undefined;
  icon?: any;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 border-b border-border pb-4 sm:pb-6">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {Icon && (
          <div className="flex size-9 sm:size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-dark text-gold shadow-elegant">
            <Icon className="size-4 sm:size-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
          {description && <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground line-clamp-2">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{actions}</div>}
    </div>
  );
}