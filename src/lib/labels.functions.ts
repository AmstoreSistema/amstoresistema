import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mapeia as etiquetas geradas para uma grade de 3 colunas (Pimaco/A4 padrão).
 * Retorna uma lista de etiquetas com linha e coluna calculadas.
 */
export const generateLabelGrid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({
    products: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      sku: z.string(),
      variacao_nome: z.string().optional(),
      numeracao: z.string().optional(),
      quantity: z.number().min(1),
      tipo_codigo: z.enum(['CODE128', 'QR']).default('CODE128'),
    })),
    startLine: z.number().default(1),
    startColumn: z.number().min(1).max(3).default(1),
    orderId: z.string().uuid().optional(),
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
          codigo_barras: p.sku, 
          variacao_nome: p.variacao_nome,
          numeracao: p.numeracao,
          linha: currentLine,
          coluna: currentColumn,
          tipo_codigo: p.tipo_codigo,
          created_by_id: context.userId,
          order_id: data.orderId || null
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
      .from("etiqueta_gerada" as any)
      .insert(labels)
      .select();

    if (error) throw new Error(`Erro ao salvar etiquetas: ${error.message}`);

    return saved;
  });

export const getPrintSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("print_settings" as any)
      .select("*")
      .eq("user_id", context.userId as any)
      .maybeSingle();

    if (error) throw new Error(`Erro ao buscar configurações: ${error.message}`);
    return data;
  });

export const savePrintSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({
    page_size: z.string().default('A4'),
    margin_top: z.number().default(0),
    margin_left: z.number().default(0),
    column_spacing: z.number().default(0),
    row_spacing: z.number().default(0),
    label_width: z.number().default(63.5),
    label_height: z.number().default(38.1),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase
      .from("print_settings" as any)
      .upsert({
        user_id: context.userId,
        ...data,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`Erro ao salvar configurações: ${error.message}`);
    return saved;
  });

export const clearLabels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("etiqueta_gerada" as any)
      .delete()
      .eq("created_by_id", context.userId as any);

    if (error) throw new Error(`Erro ao limpar etiquetas: ${error.message}`);
    return { success: true };
  });

