import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const exportSystemData = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ 
    tables: z.array(z.string()),
    onProgress: z.function().args(z.string(), z.number()).optional()
  }).parse(data))
  .handler(async ({ data: { tables } }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const exportData: Record<string, any> = {};
    
    for (const table of tables) {
      const { data, error } = await supabaseAdmin.from(table as any).select("*");
      if (error) console.error(`Error exporting ${table}:`, error);
      exportData[table] = data || [];
    }
    
    return {
      version: "1.0",
      timestamp: new Date().toISOString(),
      data: exportData
    };
  });

export const importSystemData = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ 
    payload: z.any(),
    tables: z.array(z.string()).optional(),
    isBase44: z.boolean().optional()
  }).parse(data))
  .handler(async ({ data: { payload, tables: selectedTables, isBase44 } }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    let dataToImport: Record<string, any[]> = {};

    if (isBase44) {
      if (!payload.tabelas) {
        throw new Error("Formato de backup Base44 inválido: chave 'tabelas' não encontrada");
      }

      // Mapping 'clientes' -> 'clients'
      if (Array.isArray(payload.tabelas.clientes)) {
        dataToImport['clients'] = payload.tabelas.clientes.map((c: any) => ({
          name: c.nome,
          phone: c.telefone,
          cashback_balance: 0,
          created_at: new Date().toISOString()
        }));
      }

      // Mapping 'produtos' -> 'products'
      if (Array.isArray(payload.tabelas.produtos)) {
        dataToImport['products'] = payload.tabelas.produtos.map((p: any) => ({
          sku: p.sku,
          name: p.nome || `Produto ${p.sku}`,
          sale_price: p.preco || 0,
          category: 'Geral',
          cost_price: 0,
          labor_cost: 0,
          overhead_cost: 0,
          retail_margin: 0,
          wholesale_margin: 0,
          active: true,
          created_at: new Date().toISOString()
        }));
      }
    } else {
      if (!payload.data || !payload.version) {
        throw new Error("Formato de backup inválido");
      }
      dataToImport = selectedTables 
        ? Object.fromEntries(Object.entries(payload.data).filter(([table]) => selectedTables.includes(table)))
        : payload.data;
    }
    
    for (const [table, rows] of Object.entries(dataToImport)) {
      if (Array.isArray(rows) && rows.length > 0) {
        // We use upsert with onConflict if we want to avoid duplicates
        // For standard tables we might need to handle specific constraints
        const { error } = await supabaseAdmin.from(table as any).upsert(rows);
        if (error) {
          console.error(`Error importing ${table}:`, error);
          // If upsert fails due to missing FKs or other constraints, we log it
        }
      }
    }
    
    return { success: true };
  });