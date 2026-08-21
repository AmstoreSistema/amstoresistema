import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BLUEPRINT_MARKDOWN } from "@/lib/system-blueprint";

export const askSystemDocs = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        question: z.string().min(2).max(4000),
        format: z.enum(["spec", "prompt", "explain"]).default("spec"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("IA indisponível: chave não configurada.");

    const styles: Record<string, string> = {
      spec: "Responda como uma ESPECIFICAÇÃO TÉCNICA completa em Markdown: objetivo, modelo de dados (tabelas e campos), regras de negócio, funções/endpoints, telas e componentes, casos de borda e checklist de implementação.",
      prompt:
        "Responda como um PROMPT PRONTO para ser colado em outra IA de desenvolvimento, em Markdown, instruindo passo a passo como construir o que foi pedido (schema, regras, telas, design), com detalhes suficientes para reproduzir o resultado sem acesso ao código original.",
      explain: "Responda de forma explicativa e objetiva, em Markdown, ensinando como a funcionalidade funciona neste sistema.",
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é o Documentador do sistema "Amstore Gestão". Você conhece o sistema pelo blueprint abaixo e escreve documentação técnica em português do Brasil, precisa e acionável, sem inventar recursos que não existem no blueprint (se algo não estiver descrito, diga que é uma sugestão).\n${styles[data.format]}\n\n=== BLUEPRINT DO SISTEMA ===\n${BLUEPRINT_MARKDOWN}\n=== FIM DO BLUEPRINT ===`,
          },
          { role: "user", content: data.question },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos ao workspace.");
    if (!res.ok) throw new Error(`Falha na IA (${res.status}).`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { answer: json.choices?.[0]?.message?.content ?? "Sem resposta." };
  });
