import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { useDeleteRow, useRows, useSaveRow } from "@/lib/data";

export type CrudField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "switch" | undefined;
  options?: { value: string; label: string }[] | undefined;
  placeholder?: string | undefined;
  default?: any;
  required?: boolean | undefined;
  step?: string | undefined;
  span?: 1 | 2 | undefined;
};

export function CrudPage<T extends { id: string }>({
  table,
  title,
  description,
  icon,
  label,
  fields,
  columns,
  order,
  searchKeys = ["name"],
  extraActions,
  summary,
}: {
  table: string;
  title: string;
  description?: string | undefined;
  icon?: any;
  label: string;
  fields: CrudField[];
  columns: Column<T>[];
  order?: { column: string; ascending?: boolean | undefined } | undefined;
  searchKeys?: string[] | undefined;
  extraActions?: ReactNode | undefined;
  summary?: ((rows: T[]) => ReactNode) | undefined;
}) {
  const { data: rows = [], isLoading } = useRows<T>(table, order ? { order } : undefined);
  const save = useSaveRow(table, label);
  const remove = useDeleteRow(table, label);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [term, setTerm] = useState("");

  const blank = useMemo(() => {
    const v: Record<string, any> = {};
    fields.forEach((f) => {
      v[f.name] = f.default ?? (f.type === "number" ? 0 : f.type === "switch" ? true : "");
    });
    return v;
  }, [fields]);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r: any) =>
      searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(t)),
    );
  }, [rows, term, searchKeys]);

  const openNew = () => {
    setEditing(null);
    setValues({ ...blank });
    setOpen(true);
  };

  const openEdit = (row: T) => {
    const v: Record<string, any> = {};
    fields.forEach((f) => (v[f.name] = (row as any)[f.name] ?? blank[f.name]));
    setEditing(row);
    setValues(v);
    setOpen(true);
  };

  const submit = () => {
    const payload: Record<string, any> = {};
    fields.forEach((f) => {
      const raw = values[f.name];
      if (f.type === "number") payload[f.name] = Number(raw || 0);
      else if (f.type === "switch") payload[f.name] = Boolean(raw);
      else payload[f.name] = raw === "" ? null : raw;
    });
    save.mutate(
      { id: editing?.id ?? undefined, values: payload },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        actions={
          <>
            {extraActions}
            <Button onClick={openNew} className="gap-2">
              <Plus className="size-4" /> Novo
            </Button>
          </>
        }
      />

      {summary && summary(rows)}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar..."
          className="pl-9"
        />
      </div>

      <DataTable
        rows={filtered}
        loading={isLoading}
        columns={[
          ...columns,
          {
            key: "__actions",
            header: "",
            className: "w-24 text-right",
            render: (row) => (
              <div className="flex justify-end gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(row.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar ${label}` : `Novo ${label}`}</DialogTitle>
            <DialogDescription>Preencha as informações abaixo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.name} className={f.span === 2 || f.type === "textarea" ? "sm:col-span-2" : ""}>
                <Label className="mb-1.5 block text-xs font-medium">{f.label}</Label>
                {f.type === "select" ? (
                  <Select
                    value={String(values[f.name] ?? "")}
                    onValueChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "textarea" ? (
                  <Textarea
                    value={values[f.name] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                  />
                ) : f.type === "switch" ? (
                  <div className="flex h-9 items-center">
                    <Switch
                      checked={Boolean(values[f.name])}
                      onCheckedChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                    />
                  </div>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    step={f.step}
                    value={values[f.name] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {label}?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) remove.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}