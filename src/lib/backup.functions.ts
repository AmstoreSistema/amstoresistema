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
    tables: z.array(z.string()).optional()
  }).parse(data))
  .handler(async ({ data: { payload, tables: selectedTables } }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    if (!payload.data || !payload.version) {
      throw new Error("Formato de backup inválido");
    }
    
    const dataToImport = selectedTables 
      ? Object.fromEntries(Object.entries(payload.data).filter(([table]) => selectedTables.includes(table)))
      : payload.data;
    
    for (const [table, rows] of Object.entries(dataToImport)) {
      if (Array.isArray(rows) && rows.length > 0) {
        const { error } = await supabaseAdmin.from(table as any).upsert(rows);
        if (error) console.error(`Error importing ${table}:`, error);
      }
    }
    
    return { success: true };
  });