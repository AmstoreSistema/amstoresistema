import React, { useEffect, useMemo } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRows } from "@/lib/data";
import { createTransaction, updateTransaction } from "@/lib/finance.functions.ts";
import { Plus, X, Search, User } from "lucide-react";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

const transactionSchema = z.object({
  type: z.enum(["entrada", "saida"]),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  description: z.string().min(1, "Descrição é obrigatória"),
  account_id: z.string().min(1, "Conta é obrigatória"),
  category: z.string().optional().nullable(),
  status: z.enum(["pago", "pendente"]),
  due_date: z.string().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
  client_id: z.string().optional().nullable(),
  supplier_id: z.string().optional().nullable(),
});

interface TransactionModalProps {
  transaction?: any;
  isOpen: boolean;
  onClose: () => void;
}

export function TransactionModal({ 
  transaction, 
  isOpen, 
  onClose 
}: TransactionModalProps) {
  const qc = useQueryClient();
  const isEditing = !!transaction;
  
  const { data: accounts = [] } = useRows("financial_accounts", { filters: [{ column: "active", value: true }] });
  const { data: clients = [] } = useRows("clients", { order: { column: "name", ascending: true } });
  const { data: suppliers = [] } = useRows("suppliers", { order: { column: "name", ascending: true } });

  const form = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "entrada",
      amount: 0,
      description: "",
      account_id: "",
      category: "Venda",
      status: "pago",
      due_date: new Date().toISOString().split('T')[0],
      payment_method: "Dinheiro",
      observations: "",
      client_id: null,
      supplier_id: null,
    },
  });

  useEffect(() => {
    if (transaction && isOpen) {
      form.reset({
        type: (transaction.type === 'income' || transaction.type === 'entrada') ? "entrada" : "saida",
        amount: Math.abs(transaction.amount),
        description: transaction.description || "",
        account_id: transaction.account_id || "",
        category: transaction.category || "Venda",
        status: transaction.status === 'pago' ? 'pago' : 'pendente',
        due_date: transaction.due_date ? transaction.due_date.split('T')[0] : (transaction.created_at ? transaction.created_at.split('T')[0] : ""),
        payment_method: transaction.payment_method || "Dinheiro",
        observations: transaction.observations || "",
        client_id: transaction.client_id || null,
        supplier_id: transaction.supplier_id || null,
      });
    } else if (!isEditing && isOpen) {
      form.reset({
        type: "entrada",
        amount: 0,
        description: "",
        account_id: accounts.length > 0 ? accounts[0].id : "",
        category: "Vendas",
        status: "pago",
        due_date: new Date().toISOString().split('T')[0],
        payment_method: "Dinheiro",
        observations: "",
        client_id: null,
        supplier_id: null,
      });
    }
  }, [transaction, isOpen, form, accounts]);

  const onSubmit = async (values: z.infer<typeof transactionSchema>) => {
    const formattedValues = {
      ...values,
      client_id: values.client_id === 'none' ? null : values.client_id,
      supplier_id: values.supplier_id === 'none' ? null : values.supplier_id
    };
    try {
      if (isEditing) {
        await updateTransaction({ data: { ...formattedValues, id: transaction.id } });
        toast.success("Transação atualizada com sucesso");
      } else {
        await createTransaction({ data: formattedValues });
        toast.success("Lançamento realizado com sucesso");
      }
      onClose();
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const currentType = form.watch("type");
  const currentAmount = form.watch("amount");
  const currentAccountId = form.watch("account_id");
  const selectedAccount = accounts.find((a: any) => a.id === currentAccountId);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-white border-none shadow-2xl flex flex-col sm:rounded-[1.5rem] max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <DialogTitle className="text-xl font-bold">
            {isEditing ? "Editar Transação" : "Nova Transação"}
          </DialogTitle>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-xl border-gray-100 bg-gray-50/50" tabIndex={0}>

                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl z-[9999]" position="popper" sideOffset={5}>
                        <SelectItem value="entrada">Receita</SelectItem>
                        <SelectItem value="saida">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => {
                  // If we have a transaction and it's a purchase/sale, the category is usually fixed
                  const isSystemTransaction = !!(transaction?.sale_id || transaction?.purchase_id);
                  
                  return (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoria</FormLabel>
                      <div className="flex gap-2">
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ""} 
                          disabled={isSystemTransaction}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 rounded-xl border-gray-100 bg-gray-50/50" tabIndex={0}>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl z-[9999]" position="popper" sideOffset={5}>
                            <SelectItem value="Venda">Venda</SelectItem>
                            <SelectItem value="Vendas">Vendas</SelectItem>
                            <SelectItem value="Compra de Materiais">Compra de Materiais</SelectItem>
                            <SelectItem value="Equipamentos">Equipamentos</SelectItem>
                            <SelectItem value="Suprimentos">Suprimentos</SelectItem>
                            <SelectItem value="Pessoal">Pessoal</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                        {!isSystemTransaction && (
                          <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl border-gray-100 bg-gray-50/50">
                            <Plus className="size-4" />
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descrição *</FormLabel>
                  <FormControl>
                    <Input className="h-10 rounded-xl border-gray-100 bg-gray-50/50" placeholder="Descrição da transação" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {currentType === "entrada" ? (
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente vinculado</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || "none"}
                      disabled={!!transaction?.sale_id}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-xl border-gray-100 bg-gray-50/50" tabIndex={0}>
                          <SelectValue placeholder="Selecione um cliente (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl z-[9999]" position="popper" sideOffset={5}>
                        <SelectItem value="none">Nenhum cliente</SelectItem>
                        {(clients as any[]).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fornecedor vinculado</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || "none"}
                      disabled={!!transaction?.purchase_id}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-xl border-gray-100 bg-gray-50/50" tabIndex={0}>
                          <SelectValue placeholder="Selecione um fornecedor (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl z-[9999]" position="popper" sideOffset={5}>
                        <SelectItem value="none">Nenhum fornecedor</SelectItem>
                        {(suppliers as any[]).map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className="h-10 rounded-xl border-gray-100 bg-gray-50/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Conta *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-xl border-gray-100 bg-gray-50/50" tabIndex={0}>

                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl z-[9999]" position="popper" sideOffset={5}>
                        {accounts.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>{a.name} - {brl(a.initial_balance || 0)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data da Transação *</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-10 rounded-xl border-gray-100 bg-gray-50/50" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data de Vencimento</label>
                <Input type="date" className="h-10 rounded-xl border-gray-100 bg-gray-50/50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-xl border-gray-100 bg-gray-50/50" tabIndex={0}>

                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl z-[9999]" position="popper" sideOffset={5}>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Forma de proteção</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "Dinheiro"}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-xl border-gray-100 bg-gray-50/50" tabIndex={0}>

                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl z-[9999]" position="popper" sideOffset={5}>
                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                        <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                        <SelectItem value="Pix">Pix</SelectItem>
                        <SelectItem value="Transferência">Transferência</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Informações adicionais..." 
                      className="rounded-xl border-gray-100 bg-gray-50/50 min-h-[80px]" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={cn(
              "p-4 rounded-xl flex justify-between items-center",
              currentType === 'entrada' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            )}>
              <span className="text-xs font-bold uppercase tracking-tight">Impacto na conta {selectedAccount?.name || "Principal"}:</span>
              <span className="text-sm font-black">{currentType === 'entrada' ? '+' : '-'} {brl(currentAmount)}</span>
            </div>
          </form>
        </Form>

        <div className="p-4 bg-white border-t shrink-0 flex gap-2">
          <Button variant="outline" className="flex-1 h-10 rounded-xl font-bold uppercase tracking-widest text-[10px]" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={form.handleSubmit(onSubmit)} 
            className="flex-1 h-10 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold uppercase tracking-widest text-[10px] border-none shadow-lg shadow-green-100"
          >
            {isEditing ? "Atualizar Transação" : "Criar Transação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
