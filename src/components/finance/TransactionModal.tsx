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
import { createTransaction, updateTransaction, saveCustomTransactionCategory, syncExistingTransactionCategories } from "@/lib/finance.functions.ts";
import { Plus, X, Search, User, Loader2 } from "lucide-react";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

const DEFAULT_EXPENSE_CATEGORIES = [
  "Compra de Materiais",
  "Equipamentos",
  "Suprimentos",
  "Pessoal",
  "Marketing",
  "Aluguel",
  "Energia",
  "Água",
  "Internet",
  "Impostos",
  "Manutenção",
  "Transporte",
  "Embalagens",
  "Serviços de Terceiros",
  "Outros",
];

const DEFAULT_INCOME_CATEGORIES = [
  "Vendas",
  "Serviços",
  "Recebimentos Diversos",
  "Rendimentos",
  "Outros",
];

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

  const [isAddCategoryOpen, setIsAddCategoryOpen] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [savingCategory, setSavingCategory] = React.useState(false);
  const [localCustomCategories, setLocalCustomCategories] = React.useState<string[]>([]);
  
  const { data: accounts = [] } = useRows("financial_accounts", { filters: [{ column: "active", value: true }] });
  const { data: clients = [] } = useRows("clients", { order: { column: "name", ascending: true } });
  const { data: suppliers = [] } = useRows("suppliers", { order: { column: "name", ascending: true } });
  const { data: allTransactions = [] } = useRows<any>("transactions", { select: "category, type" });
  const { data: appSettings = [] } = useRows<any>("app_settings");

  // Sincroniza em segundo plano categorias já existentes nas despesas/receitas do banco
  useEffect(() => {
    if (isOpen) {
      syncExistingTransactionCategories().catch(() => {});
    }
  }, [isOpen]);

  const form = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "entrada",
      amount: 0,
      description: "",
      account_id: "",
      category: "Vendas",
      status: "pago",
      due_date: new Date().toISOString().split('T')[0],
      payment_method: "Dinheiro",
      observations: "",
      client_id: null,
      supplier_id: null,
    },
  });

  const currentType = form.watch("type");

  // Extrai automaticamente categorias de transações existentes no banco
  const dbExpenseCategories = useMemo(() => {
    const set = new Set<string>();
    allTransactions.forEach((t: any) => {
      const isExpense = t.type === "saida" || t.type === "expense";
      if (isExpense && t.category && typeof t.category === "string" && t.category.trim()) {
        set.add(t.category.trim());
      }
    });
    return Array.from(set);
  }, [allTransactions]);

  const dbIncomeCategories = useMemo(() => {
    const set = new Set<string>();
    allTransactions.forEach((t: any) => {
      const isIncome = t.type === "entrada" || t.type === "income";
      if (isIncome && t.category && typeof t.category === "string" && t.category.trim()) {
        set.add(t.category.trim());
      }
    });
    return Array.from(set);
  }, [allTransactions]);

  // Categorias personalizadas salvas no app_settings
  const settingsCustomCategories = useMemo(() => {
    const key = currentType === "saida" ? "custom_expense_categories" : "custom_income_categories";
    const setting = appSettings.find((s: any) => s.key === key);
    if (!setting?.value) return [];
    try {
      const parsed = typeof setting.value === "string" ? JSON.parse(setting.value) : setting.value;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [appSettings, currentType]);

  // Lista consolidada e ordenada de categorias
  const availableCategories = useMemo(() => {
    const defaults = currentType === "saida" ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;
    const fromDb = currentType === "saida" ? dbExpenseCategories : dbIncomeCategories;

    const set = new Set<string>();
    defaults.forEach((c) => set.add(c));
    fromDb.forEach((c) => c && set.add(c));
    settingsCustomCategories.forEach((c: any) => typeof c === "string" && c.trim() && set.add(c.trim()));
    localCustomCategories.forEach((c) => c && set.add(c));

    if (transaction?.category && typeof transaction.category === "string" && transaction.category.trim()) {
      set.add(transaction.category.trim());
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [currentType, dbExpenseCategories, dbIncomeCategories, settingsCustomCategories, localCustomCategories, transaction]);

  // Ao alternar entre receita e despesa, ajusta a categoria padrão
  const prevTypeRef = React.useRef(currentType);
  useEffect(() => {
    if (!isOpen) return;
    if (prevTypeRef.current !== currentType) {
      prevTypeRef.current = currentType;
      const currentCat = form.getValues("category");
      if (currentType === "saida" && (currentCat === "Vendas" || !currentCat)) {
        form.setValue("category", "Compra de Materiais");
      } else if (currentType === "entrada" && (currentCat === "Compra de Materiais" || !currentCat)) {
        form.setValue("category", "Vendas");
      }
    }
  }, [currentType, isOpen, form]);

  useEffect(() => {
    if (transaction && isOpen) {
      form.reset({
        type: (transaction.type === 'income' || transaction.type === 'entrada') ? "entrada" : "saida",
        amount: Math.abs(transaction.amount),
        description: transaction.description || "",
        account_id: transaction.account_id || "",
        category: transaction.category || ((transaction.type === 'income' || transaction.type === 'entrada') ? "Vendas" : "Compra de Materiais"),
        status: transaction.status === 'pago' ? 'pago' : 'pendente',
        due_date: transaction.due_date ? transaction.due_date.split('T')[0] : (transaction.created_at ? transaction.created_at.split('T')[0] : ""),
        payment_method: transaction.payment_method || "Dinheiro",
        observations: transaction.observations || "",
        client_id: transaction.client_id || null,
        supplier_id: (transaction.supplier_id || (transaction.purchase_id ? suppliers.find((s: any) => s.name === transaction.supplier_name)?.id : null)) || null,
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
  }, [transaction, isOpen, form, accounts, suppliers]);

  const handleCreateNewCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      toast.error("Digite o nome da categoria");
      return;
    }

    setSavingCategory(true);
    try {
      setLocalCustomCategories((prev) => [...prev, trimmed]);
      form.setValue("category", trimmed, { shouldValidate: true, shouldDirty: true });
      setIsAddCategoryOpen(false);
      setNewCategoryName("");

      await saveCustomTransactionCategory({
        data: {
          type: currentType as "saida" | "entrada",
          category: trimmed,
        },
      });

      qc.invalidateQueries({ queryKey: ["app_settings"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(`Categoria "${trimmed}" adicionada com sucesso!`);
    } catch (err: any) {
      console.warn("Aviso ao salvar categoria:", err?.message);
      toast.success(`Categoria "${trimmed}" selecionada`);
    } finally {
      setSavingCategory(false);
    }
  };

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

  const currentAmount = form.watch("amount");
  const currentAccountId = form.watch("account_id");
  const selectedAccount = accounts.find((a: any) => a.id === currentAccountId);

  return (
    <>
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
                  const isSystemTransaction = !!(transaction?.sale_id || transaction?.purchase_id);
                  
                  return (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Categoria {currentType === "saida" ? "(Despesa)" : "(Receita)"}
                      </FormLabel>
                      <div className="flex gap-2">
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ""} 
                          disabled={isSystemTransaction}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 rounded-xl border-gray-100 bg-gray-50/50" tabIndex={0}>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl z-[9999] max-h-60" position="popper" sideOffset={5}>
                            {availableCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!isSystemTransaction && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon" 
                            onClick={() => setIsAddCategoryOpen(true)}
                            title="Adicionar nova categoria"
                            className="h-10 w-10 rounded-xl border-gray-200 bg-gray-50/50 hover:bg-gold/10 hover:border-gold/30 hover:text-gold transition-colors shrink-0"
                          >
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

    {/* Diálogo rápido para Adicionar Nova Categoria de Despesa/Receita */}
    <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
      <DialogContent className="sm:max-w-md p-6 bg-white rounded-2xl shadow-2xl z-[10000]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Plus className="size-5 text-gold" />
            {currentType === "saida" ? "Nova Categoria de Despesa" : "Nova Categoria de Receita"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Digite o nome da nova categoria para utilizá-la em seus lançamentos.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder={currentType === "saida" ? "Ex: Aluguel, Combustível, Embalagens..." : "Ex: Venda Direta, Serviços..."}
            className="h-11 rounded-xl"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateNewCategory();
              }
            }}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => { setIsAddCategoryOpen(false); setNewCategoryName(""); }} 
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button 
            type="button" 
            onClick={handleCreateNewCategory} 
            disabled={savingCategory || !newCategoryName.trim()}
            className="bg-gradient-gold shadow-gold font-bold rounded-xl gap-2"
          >
            {savingCategory ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Adicionar Categoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}

