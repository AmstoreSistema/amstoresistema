import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mapeia as etiquetas geradas para uma grade de 3 colunas (Pimaco/A4 padrão).
 * Retorna uma lista de etiquetas com linha e coluna calculadas.
 */
export const generateLabelGrid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    products: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      sku: z.string(),
      quantity: z.number().min(1),
    })),
    startLine: z.number().default(1),
    startColumn: z.number().min(1).max(3).default(1),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const labels: any[] = [];
    let currentLine = data.startLine;
    let currentColumn = data.startColumn;

    for (const p of data.products) {
      for (let i = 0; i < p.quantity; i++) {
        labels.push({
          produto_id: p.id,
          produto_nome: p.name,
          codigo_barras: p.sku, // Usando SKU como padrão para código de barras
          codigo_interno: p.sku,
          linha: currentLine,
          coluna: currentColumn,
          tipo_codigo: 'CODE128',
          created_by_id: context.userId
        });

        // Avança para a próxima posição na grade (3 colunas)
        currentColumn++;
        if (currentColumn > 3) {
          currentColumn = 1;
          currentLine++;
        }
      }
    }

    // Salva no banco de dados
    const { data: saved, error } = await context.supabase
      .from("etiqueta_gerada")
      .insert(labels)
      .select();

    if (error) throw new Error(`Erro ao salvar etiquetas: ${error.message}`);

    return saved;
  });

export const clearLabels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("etiqueta_gerada")
      .delete()
      .eq("created_by_id", context.userId);

    if (error) throw new Error(`Erro ao limpar etiquetas: ${error.message}`);
    return { success: true };
  });
