import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface SupplierFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  initialData?: any;
}

const CATEGORIES = ["Couros", "Tecidos", "Ferragens", "Linhas", "Diversos"];

export function SupplierFormModal({ open, onOpenChange, onSubmit, initialData }: SupplierFormModalProps) {
  const [form, setForm] = useState<any>({
    name: "",
    type: "Pessoa Jurídica",
    document: "",
    category: "Diversos",
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
    active: true
  });

  useEffect(() => {
    if (initialData) {
      setForm({ ...form, ...initialData });
    } else {
      setForm({
        name: "",
        type: "Pessoa Jurídica",
        document: "",
        category: "Diversos",
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
        active: true
      });
    }
  }, [initialData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-2xl rounded-3xl p-0 border-none bg-white [&>button]:hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-lg font-semibold">{initialData ? "Editar Fornecedor" : "Novo Fornecedor"}</h2>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full">
            <X className="size-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 p-6">
          <section>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">Informações Básicas</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pessoa Jurídica">Pessoa Jurídica</SelectItem>
                    <SelectItem value="Pessoa Física">Pessoa Física</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CNPJ/CPF</Label>
                <Input value={form.document} onChange={e => setForm({...form, document: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">Contato</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Telefone Secundário</Label>
                <Input value={form.phone_secondary} onChange={e => setForm({...form, phone_secondary: e.target.value})} />
              </div>
              <div className="col-span-full space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">Endereço</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="col-span-full space-y-2">
                <Label>Endereço</Label>
                <Input placeholder="Rua, número, complemento" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input maxLength={2} value={form.state} onChange={e => setForm({...form, state: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={form.zip_code} onChange={e => setForm({...form, zip_code: e.target.value})} />
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">Informações Comerciais</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Prazo Médio de Entrega (dias)</Label>
                <Input type="number" value={form.delivery_time} onChange={e => setForm({...form, delivery_time: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento Preferencial</Label>
                <Input placeholder="ex: PIX, Boleto 30 dias" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})} />
              </div>
              <div className="col-span-full space-y-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
            </div>
          </section>

          <section className="flex items-center justify-between rounded-2xl bg-muted/30 p-4">
            <div>
              <Label>Fornecedor Ativo</Label>
              <p className="text-xs text-muted-foreground">Desative se não trabalhar mais com este fornecedor</p>
            </div>
            <Switch checked={form.active} onCheckedChange={v => setForm({...form, active: v})} />
          </section>

          <div className="flex justify-end gap-2 border-t pt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              {initialData ? "Atualizar Fornecedor" : "Cadastrar Fornecedor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
