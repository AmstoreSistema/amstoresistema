import { Truck, Pencil, Eye, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Supplier {
  id: string;
  name: string;
  category: string | null;
  active: boolean;
}

interface SupplierCardProps {
  supplier: Supplier;
  onEdit: (s: Supplier) => void;
  onView: (s: Supplier) => void;
  onDelete: (id: string) => void;
}

export function SupplierCard({ supplier, onEdit, onView, onDelete }: SupplierCardProps) {
  return (
    <Card className="overflow-hidden rounded-3xl border-border/50 bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Truck className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold">{supplier.name}</h3>
              <Badge variant="secondary" className="mt-1 uppercase tracking-wider">{supplier.category || "Sem categoria"}</Badge>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2 border-t border-border/50 pt-4">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(supplier)}>
            <Pencil className="mr-2 size-3" /> Editar
          </Button>
          <Button variant="outline" size="icon" onClick={() => onView(supplier)}>
            <Eye className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/5" onClick={() => onDelete(supplier.id)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
