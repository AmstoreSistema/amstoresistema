import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUpsert } from "@/lib/data";
import { toast } from "sonner";

interface SupplierFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: any;
}

const CATEGORIES = ["Couros", "Sintéticos", "Palmilhas", "Solados", "Cola", "Embalagens", "Outros"];
const STATES = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export function SupplierFormModal({ open, onOpenChange, supplier }: SupplierFormModalProps) {
  const isEditing = !!supplier;
  const { mutate: upsert, isPending } = useUpsert("suppliers");

  const [formData, setFormData] = useState({
    name: "",
    type: "Pessoa Jurídica",
    document: "",
    category: "",
    phone: "",
    phone_secondary: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    delivery_time: 0,
    payment_method: "",
    notes: "",
    active: true,
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || "",
        type: supplier.type || "Pessoa Jurídica",
        document: supplier.document || "",
        category: supplier.category || "",
        phone: supplier.phone || "",
        phone_secondary: supplier.phone_secondary || "",
        email: supplier.email || "",
        address: supplier.address || "",
        city: supplier.city || "",
        state: supplier.state || "",
        zip_code: supplier.zip_code || "",
        delivery_time: supplier.delivery_time || 0,
        payment_method: supplier.payment_method || "",
        notes: supplier.notes || "",
        active: supplier.active ?? true,
      });
    } else {
      setFormData({
        name: "",
        type: "Pessoa Jurídica",
        document: "",
        category: "",
        phone: "",
        phone_secondary: "",
        email: "",
        address: "",
        city: "",
        state: "",
        zip_code: "",
        delivery_time: 0,
        payment_method: "",
        notes: "",
        active: true,
      });
    }
  }, [supplier, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("O nome do fornecedor é obrigatório");
      return;
    }

    upsert(
      { ...formData, id: supplier?.id },
      {
        onSuccess: () => {
          toast.success(isEditing ? "Fornecedor atualizado!" : "Fornecedor cadastrado!");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-2xl rounded-3xl p-0 border-none bg-white [&>button]:hidden">
        <form onSubmit={handleSubmit}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">{isEditing ? "Editar Fornecedor" : "Novo Fornecedor"}</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Gestão de Parceiros</p>
            </div>
            <Button variant="ghost" size="icon" type="button" onClick={() => onOpenChange(false)} className="rounded-full">
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-8 p-6 pb-24">
            {/* Informações Básicas */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <div className="size-2 rounded-full bg-amber-600" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Informações Básicas</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome / Razão Social</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome da empresa"
                    className="rounded-xl border-border/50 bg-muted/5 focus:ring-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className="rounded-xl border-border/50 bg-muted/5">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pessoa Jurídica">Pessoa Jurídica</SelectItem>
                      <SelectItem value="Pessoa Física">Pessoa Física</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document">{formData.type === "Pessoa Jurídica" ? "CNPJ" : "CPF"}</Label>
                  <Input
                    id="document"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                    placeholder={formData.type === "Pessoa Jurídica" ? "00.000.000/0000-00" : "000.000.000-00"}
                    className="rounded-xl border-border/50 bg-muted/5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="rounded-xl border-border/50 bg-muted/5">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Contato */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <div className="size-2 rounded-full bg-amber-600" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Contato</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone Principal</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="rounded-xl border-border/50 bg-muted/5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@fornecedor.com"
                    className="rounded-xl border-border/50 bg-muted/5"
                  />
                </div>
              </div>
            </section>

            {/* Endereço */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <div className="size-2 rounded-full bg-amber-600" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Localização</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="address">Endereço Completo</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Rua, número, bairro..."
                    className="rounded-xl border-border/50 bg-muted/5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="rounded-xl border-border/50 bg-muted/5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({ ...formData, state: value })}
                  >
                    <SelectTrigger className="rounded-xl border-border/50 bg-muted/5">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATES.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Informações Comerciais */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <div className="size-2 rounded-full bg-amber-600" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Informações Comerciais</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="delivery_time">Prazo de Entrega (dias)</Label>
                  <Input
                    id="delivery_time"
                    type="number"
                    value={formData.delivery_time}
                    onChange={(e) => setFormData({ ...formData, delivery_time: parseInt(e.target.value) || 0 })}
                    className="rounded-xl border-border/50 bg-muted/5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Preferência de Pagamento</Label>
                  <Input
                    id="payment_method"
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    placeholder="Ex: 30/60 dias, Boleto, PIX..."
                    className="rounded-xl border-border/50 bg-muted/5"
                  />
                </div>
              </div>
            </section>

            {/* Status */}
            <section className="flex items-center justify-between rounded-2xl border border-border/50 p-4 bg-muted/5">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold">Status do Fornecedor</Label>
                <p className="text-xs text-muted-foreground">Define se o fornecedor aparecerá em novas compras</p>
              </div>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </section>
          </div>

          <div className="absolute bottom-0 left-0 right-0 border-t bg-white p-6">
            <Button
              type="submit"
              disabled={isPending}
              className="h-12 w-full rounded-2xl bg-amber-600 font-bold text-white hover:bg-amber-700 shadow-lg shadow-amber-600/20"
            >
              {isPending ? "Processando..." : isEditing ? "Salvar Alterações" : "Cadastrar Fornecedor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
