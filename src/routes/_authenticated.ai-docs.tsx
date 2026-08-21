import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Copy, Download, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { askSystemDocs } from "@/lib/system-docs.functions";
import { SYSTEM_BLUEPRINT, BLUEPRINT_MARKDOWN } from "@/lib/system-blueprint";

export const Route = createFileRoute("/_authenticated/ai-docs")({
  head: () => ({
    meta: [
      { title: "Documentação IA — Amstore Gestão" },
      {
        name: "description",
        content:
          "Documentação viva do Amstore Gestão com assistente de IA que gera especificações para recriar o sistema em outras plataformas.",
      },
      { property: "og:title", content: "Documentação IA — Amstore Gestão" },
      {
        property: "og:description",
        content: "Blueprint completo do sistema e gerador de especificações técnicas por IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiDocsPage,
});

const FORMATS = [
  { id: "spec", label: "Especificação técnica" },
  { id: "prompt", label: "Prompt para outra IA" },
  { id: "explain", label: "Explicação" },
] as const;

const SUGGESTIONS = [
  "Documente o módulo de PDV para eu recriar em outra plataforma",
  "Gere o schema SQL completo do financeiro com triggers de saldo",
  "Explique a regra de cashback proporcional no fiado",
  "Crie um prompt para recriar todo o sistema do zero",
  "Documente o design system (cores, cartões, tipografia)",
  "Documente o fluxo de produção com baixa de matéria-prima",
];

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copiado para a área de transferência"),
    () => toast.error("Não foi possível copiar"),
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function AiDocsPage() {
  const ask = useServerFn(askSystemDocs);
  const [question, setQuestion] = useState("");
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("spec");
  const [answer, setAnswer] = useState("");

  const mutation = useMutation({
    mutationFn: async (q: string) => ask({ data: { question: q, format } }),
    onSuccess: (res: any) => setAnswer(res.answer),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar documentação"),
  });

  const wordCount = useMemo(() => BLUEPRINT_MARKDOWN.split(/\s+/).length, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentação IA"
        description="Blueprint vivo do Amstore Gestão e assistente que transforma qualquer parte do sistema em especificação pronta para outra plataforma."
        icon={BookOpen}
        actions={
          <>
            <Button variant="outline" onClick={() => copy(BLUEPRINT_MARKDOWN)}>
              <Copy className="mr-2 size-4" /> Copiar blueprint
            </Button>
            <Button onClick={() => download("amstore-blueprint.md", BLUEPRINT_MARKDOWN)}>
              <Download className="mr-2 size-4" /> Baixar .md
            </Button>
          </>
        }
      />

      <Card className="border-gold/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-gold" /> Assistente de documentação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={format === f.id ? "default" : "outline"}
                onClick={() => setFormat(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            placeholder="Ex.: documente o módulo de vendas (PDV) com schema, regras, telas e casos de borda para eu recriar em outro sistema."
          />

          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQuestion(s)}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Base de conhecimento: {SYSTEM_BLUEPRINT.length} seções · ~{wordCount} palavras
            </p>
            <Button
              disabled={mutation.isPending || question.trim().length < 3}
              onClick={() => mutation.mutate(question.trim())}
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Gerar documentação
            </Button>
          </div>

          {answer && (
            <div className="rounded-2xl border border-border bg-background/60 p-5 shadow-inner">
              <div className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-gold/10 text-gold border-gold/20">Resultado da IA</Badge>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Markdown Disponível</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => copy(answer)}>
                    <Copy className="mr-2 size-3" /> Copiar especificação
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => download("documentacao-amstore.md", answer)}>
                    <Download className="mr-2 size-3" /> Baixar .md
                  </Button>
                </div>
              </div>
              <div className="prose prose-invert prose-sm max-w-none max-h-[600px] overflow-auto pr-4 custom-scrollbar">
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/90 bg-black/30 p-4 rounded-xl border border-border/30">
                  {answer}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue={SYSTEM_BLUEPRINT[0]!.id}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {SYSTEM_BLUEPRINT.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="text-xs">
              {s.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {SYSTEM_BLUEPRINT.map((s) => (
          <TabsContent key={s.id} value={s.id}>
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{s.summary}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copy(s.body)}>
                  <Copy className="mr-2 size-4" /> Copiar
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/90">
                  {s.body}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
