import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, HelpCircle, FileText, Settings, Database, History, Calculator } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/ai-docs")({
  head: () => ({
    meta: [
      { title: "Documentação do Sistema — Amstore Gestão" },
      { name: "description", content: "Manual técnico e guia de funcionamento do sistema Amstore." },
    ],
  }),
  component: AIDocsPage,
});

function AIDocsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Documentação IA" 
        description="Manual técnico e guia de funcionamento do sistema"
        icon={BookOpen}
      />

      <div className="grid gap-6">
        <Card className="border-border/50 bg-card overflow-hidden rounded-3xl">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-gold" />
              Veja como funciona o plano de produção
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="prose prose-stone dark:prose-invert max-w-none">
              <h2 className="text-2xl font-bold text-foreground">Ordens de Produção</h2>
              
              <section className="mt-6">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-gold/10 text-xs text-gold">1</span>
                  PROPÓSITO
                </h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  O módulo de Ordens de Produção é o coração da produção na AmStore. Ele gerencia todo o ciclo de fabricação de produtos (bolsas, conveniências, carteiras) — desde o planejamento inicial como rascunho até a conclusão, que automaticamente injeta produtos prontos no estoque.
                </p>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  Este módulo é o elo entre a matéria-prima (Materiais e Variações) e o produto acabado (EstoqueProduto). Ao iniciar um pedido, o sistema consome materiais do estoque. Ao concluir, gera automaticamente itens no estoque vinculados à ordem — criando rastreabilidade completa entre o que foi produzido, com quais materiais, em quais datas e por quem.
                </p>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  É também onde os Cortes de Material e as Composições entram em ação: a composição define que materiais cada produto exige, e os cortes registram fisicamente como o material foi aproveitado (área, custo, qualidade).
                </p>
              </section>

              <section className="mt-8">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-gold/10 text-xs text-gold">2</span>
                  ENTIDADE PRINCIPAL — TabelaOrdemProducao
                </h3>
                <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3 font-semibold">Campo</th>
                        <th className="p-3 font-semibold">Tipo</th>
                        <th className="p-3 font-semibold">Obrigatório?</th>
                        <th className="p-3 font-semibold">Descrição Funcional</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="p-3 font-mono text-xs">codigo_ordem</td>
                        <td className="p-3">string</td>
                        <td className="p-3 text-success">✅ Sim</td>
                        <td className="p-3">Código único gerado no formato OP-{'{timestamp}'}.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-xs">produto_id</td>
                        <td className="p-3">uuid (ref)</td>
                        <td className="p-3 text-success">✅ Sim</td>
                        <td className="p-3">Referência ao produto fabricado.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-xs">quantidade</td>
                        <td className="p-3">number</td>
                        <td className="p-3 text-success">✅ Sim</td>
                        <td className="p-3">Unidades a produzir.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-xs">status</td>
                        <td className="p-3">enum</td>
                        <td className="p-3 text-success">✅ Sim</td>
                        <td className="p-3">rascunho → em_producao → concluida | cancelado.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-xs">prioridade</td>
                        <td className="p-3">enum</td>
                        <td className="p-3 text-success">✅ Sim</td>
                        <td className="p-3">baixa | media | alta | urgente.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mt-8">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-gold/10 text-xs text-gold">3</span>
                  LÓGICA E FLUXO
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border border-border p-4 bg-muted/5">
                    <h4 className="font-bold flex items-center gap-2 text-orange-500">
                      <History className="size-4" /> Rascunho
                    </h4>
                    <p className="text-xs text-muted-foreground mt-2">
                      Apenas planejamento. Editável. Nenhum material é consumido do estoque ainda.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border p-4 bg-muted/5">
                    <h4 className="font-bold flex items-center gap-2 text-blue-500">
                      <Play className="size-4" /> Em Produção
                    </h4>
                    <p className="text-xs text-muted-foreground mt-2">
                      Consome automaticamente os materiais da Ficha Técnica. Registra data de início.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border p-4 bg-muted/5">
                    <h4 className="font-bold flex items-center gap-2 text-success">
                      <CheckCircle2 className="size-4" /> Concluída
                    </h4>
                    <p className="text-xs text-muted-foreground mt-2">
                      Gera entrada automática no estoque do produto acabado com o custo calculado.
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-8 p-6 rounded-3xl bg-gold/5 border border-gold/10">
                <h3 className="text-lg font-bold flex items-center gap-2 text-gold">
                  <Calculator className="size-5" /> Regra de Cálculo de Custo
                </h3>
                <p className="mt-2 text-sm text-muted-foreground italic">
                  custo_producao = Σ(Custo de cada Material na Ficha Técnica) × Quantidade da Ordem
                </p>
                <div className="mt-4 text-xs space-y-2">
                  <p>• Inclui variações específicas de cor/tamanho.</p>
                  <p>• Inclui custos proporcionais de cortes (área em cm²).</p>
                  <p>• Soma mão de obra e custos fixos configurados no produto.</p>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
