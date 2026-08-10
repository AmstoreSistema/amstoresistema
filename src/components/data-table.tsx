import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export type Column<T> = {
  key: string;
  header: string;
  className?: string | undefined;
  render: (row: T) => ReactNode;
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  loading,
  empty = "Nenhum registro encontrado.",
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean | undefined;
  empty?: string | undefined;
  onRowClick?: ((row: T) => void) | undefined;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                  c.className,
                )}
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((c) => (
                  <TableCell key={c.key}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.className}>
                    {c.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}