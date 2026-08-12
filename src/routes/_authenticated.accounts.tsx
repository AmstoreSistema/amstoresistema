import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Landmark, 
  Plus, 
  ArrowLeftRight, 
  MoreVertical, 
  PiggyBank, 
  CreditCard, 
  Wallet,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  DollarSign
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { brl } from "@/lib/format";
import { useRows, useSaveRow } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Contas Financeiras — Amstore Gestão" },
      { name: "description", content: "Gestão de caixas, bancos e saldos em tempo real." },
    ],
  }),
  component: AccountsPage,
});

const accountSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(['caixa', 'banco', 'carteira', 'outro']),
  initial_balance: z.coerce.number().min(0),
  color: z.string().min(1),
  bank_name: z.string().optional().nullable(),
  agency: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
});

const transferSchema = z.object({
  origin_id: z.string().min(1, "Origem é obrigatória"),
  dest_id: z.string().min(1, "Destino é obrigatória"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  description: z.string().min(1, "Descrição é obrigatória"),
  date: z.string().min(1, "Data é obrigatória"),
});

function AccountsPage() {
  const qc = useQueryClient();
  const { data: accounts = [], isLoading } = useRows("financial_accounts", { order: { column: "name", ascending: true } });
  const save = useSaveRow("financial_accounts", "conta financeira");
  
  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "caixa",
      initial_balance: 0,
      color: "#3B82F6",
      bank_name: null,
      agency: null,
      account_number: null,
    },
  });

  const transferForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      origin_id: "",
      dest_id: "",
      amount: 0,
      description: "Transferência entre contas",
      date: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = (values: z.infer<typeof accountSchema>) => {
    save.mutate({
      id: editingAccount?.id,
      values: {
        ...values,
        current_balance: editingAccount ? editingAccount.current_balance : values.initial_balance,
      }
    }, {
      onSuccess: () => {
        setOpen(false);
        setEditingAccount(null);
        form.reset();
      }
    });
  };

  const onTransferSubmit = async (values: z.infer<typeof transferSchema>) => {
    if (values.origin_id === values.dest_id) {
      toast.error("Contas de origem e destino devem ser diferentes");
      return;
    }

    const { error } = await supabase.rpc('transfer_between_accounts', {
      p_origin_id: values.origin_id,
      p_dest_id: values.dest_id,
      p_amount: values.amount,
      p_description: values.description,
      p_date: new Date(values.date).toISOString()
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Transferência realizada com sucesso");
      setTransferOpen(false);
      transferForm.reset();
      qc.invalidateQueries();
    }
  };

  const toggleStatus = (account: any) => {
    save.mutate({
      id: account.id,
      values: { active: !account.active }
    });
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'banco': return Landmark;
      case 'caixa': return PiggyBank;
      case 'carteira': return Wallet;
      default: return CreditCard;
    }
  };

  const stats = useMemo(() => {
    const activeAccounts = (accounts as any[]).filter(a => a.active);
    const totalBalance = activeAccounts.reduce((s, a) => s + Number(a.current_balance), 0);
    return {
      totalBalance,
      activeCount: activeAccounts.length,
      bankBalance: activeAccounts.filter(a => a.type === 'banco').reduce((s, a) => s + Number(a.current_balance), 0),
      cashBalance: activeAccounts.filter(a => a.type === 'caixa').reduce((s, a) => s + Number(a.current_balance), 0),
    };
  }, [accounts]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Contas Financeiras" 
        description="Gestão de saldos, bancos e movimentações"
        icon={Landmark}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTransferOpen(true)} className="gap-2 rounded-xl">
              <ArrowLeftRight className="size-4" /> Transferir
            </Button>
            <Button onClick={() => {
              setEditingAccount(null);
              form.reset({
                name: "",
                type: "caixa",
                initial_balance: 0,
                color: "#3B82F6",
                bank_name: null,
                agency: null,
                account_number: null,
              });
              setOpen(true);
            }} className="gap-2 bg-gradient-gold border-none shadow-gold font-bold">
              <Plus className="size-4" /> Nova Conta
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Saldo Consolidado" value={brl(stats.totalBalance)} icon={DollarSign} tone="gold" />
        <StatCard title="Em Bancos" value={brl(stats.bankBalance)} icon={Landmark} tone="info" />
        <StatCard title="Em Caixas" value={brl(stats.cashBalance)} icon={PiggyBank} tone="success" />
        <StatCard title="Contas Ativas" value={stats.activeCount} icon={CheckCircle2} tone="dark" />
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-card animate-pulse rounded-[2rem]" />)}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(accounts as any[]).map(account => {
            const Icon = getAccountIcon(account.type);
            return (
              <Card key={account.id} className={cn(
                "group relative overflow-hidden rounded-[2rem] border-border/30 bg-card transition-all hover:shadow-xl shadow-elegant",
                !account.active && "opacity-60 grayscale"
              )}>
                <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: account.color }} />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-muted/30" style={{ color: account.color }}>
                        <Icon className="size-6" />
                      </div>
                      <div>
                        <h3 className="font-display font-black text-lg tracking-tight leading-none">{account.name}</h3>
                        <Badge variant="outline" className="mt-1 text-[9px] uppercase tracking-widest px-2 py-0 h-4 border-muted-foreground/30">
                          {account.type}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl p-2">
                        <DropdownMenuItem 
                          onClick={() => {
                            setEditingAccount(account);
                            form.reset(account);
                            setOpen(true);
                          }}
                          className="rounded-xl gap-2"
                        >
                          Editar Dados
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => toggleStatus(account)}
                          className={cn("rounded-xl gap-2", account.active ? "text-destructive" : "text-success")}
                        >
                          {account.active ? <XCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
                          {account.active ? "Desativar Conta" : "Ativar Conta"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-[0.2em] mb-1">Saldo Atual</p>
                      <p className={cn(
                        "text-2xl font-black font-display",
                        Number(account.current_balance) < 0 ? "text-destructive" : "text-gold"
                      )}>
                        {brl(account.current_balance)}
                      </p>
                    </div>

                    {account.type === 'banco' && account.bank_name && (
                      <div className="text-[10px] space-y-0.5 border-t border-border/30 pt-3">
                        <p className="font-bold text-muted-foreground uppercase">{account.bank_name}</p>
                        <p className="text-muted-foreground/70 tracking-widest">AG {account.agency} · CC {account.account_number}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Account Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Editar Conta" : "Nova Conta Financeira"}</DialogTitle>
            <DialogDescription>
              Representa um repositório físico ou digital de dinheiro.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Conta</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Caixa Principal, Banco do Brasil..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="caixa">Caixa</SelectItem>
                          <SelectItem value="banco">Banco</SelectItem>
                          <SelectItem value="carteira">Carteira</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!editingAccount && (
                  <FormField
                    control={form.control}
                    name="initial_balance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saldo Inicial</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor de Identificação</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(c => (
                          <button
                            key={c}
                            type="button"
                            className={cn(
                              "size-8 rounded-full border-2 transition-all",
                              field.value === c ? "border-foreground scale-110 shadow-lg" : "border-transparent"
                            )}
                            style={{ backgroundColor: c }}
                            onClick={() => field.onChange(c)}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("type") === "banco" && (
                <div className="space-y-4 border-t border-border/30 pt-4">
                  <FormField
                    control={form.control}
                    name="bank_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Banco</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Itaú, Santander..." {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="agency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agência</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="account_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número da Conta</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              <DialogFooter className="mt-6">
                <Button type="submit" className="w-full bg-gradient-gold border-none shadow-gold font-bold">
                  {editingAccount ? "Atualizar Conta" : "Criar Conta"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Transferência entre Contas</DialogTitle>
            <DialogDescription>
              Mova valores entre suas contas financeiras.
            </DialogDescription>
          </DialogHeader>
          <Form {...transferForm}>
            <form onSubmit={transferForm.handleSubmit(onTransferSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={transferForm.control}
                  name="origin_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta de Origem</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(accounts as any[]).filter(a => a.active).map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={transferForm.control}
                  name="dest_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta de Destino</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(accounts as any[]).filter(a => a.active && a.id !== transferForm.watch("origin_id")).map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={transferForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Transferência</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={transferForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição/Observações</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Reposição de caixa, transferência banco..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={transferForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="mt-6">
                <Button type="submit" className="w-full bg-gradient-gold border-none shadow-gold font-bold">
                  Realizar Transferência
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
