import { Edit2, Eye, Trash2, Phone, MapPin, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SupplierCardProps {
  supplier: any;
  onEdit: (supplier: any) => void;
  onView: (supplier: any) => void;
  onDelete: (id: string) => void;
  totalPurchases?: number;
}

export function SupplierCard({ supplier, onEdit, onView, onDelete, totalPurchases = 0 }: SupplierCardProps) {
  return (
    <div className="group relative flex flex-col gap-4 rounded-3xl border border-border/50 bg-white p-6 transition-all hover:shadow-lg hover:shadow-black/5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Tag className="size-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">{supplier.name}</h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{supplier.category || 'Sem Categoria'}</p>
          </div>
        </div>
        <Badge variant={supplier.active ? "default" : "secondary"} className={supplier.active ? "bg-success text-white" : ""}>
          {supplier.active ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 border-y border-border/50 py-4">
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Documento</p>
          <p className="text-sm font-medium">{supplier.document || '---'}</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total Compras</p>
          <p className="text-sm font-bold text-success">{brl(totalPurchases)}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="size-4" />
          <span>{supplier.phone || 'Sem telefone'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          <span className="truncate">{supplier.city ? `${supplier.city}, ${supplier.state}` : 'Sem endereço'}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-2 pt-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full hover:bg-amber-50 hover:text-amber-600"
          onClick={() => onEdit(supplier)}
        >
          <Edit2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full hover:bg-blue-50 hover:text-blue-600"
          onClick={() => onView(supplier)}
        >
          <Eye className="size-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Fornecedor</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o fornecedor <strong>{supplier.name}</strong>?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl bg-red-600 hover:bg-red-700"
                onClick={() => onDelete(supplier.id)}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
