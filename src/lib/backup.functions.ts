import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const exportSystemData = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ tables: z.array(z.string()) }).parse(data))
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
  .inputValidator((data) => z.object({ payload: z.any() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = data.payload;
    
    if (!payload.data || !payload.version) {
      throw new Error("Formato de backup inválido");
    }
    
    // Process tables in order to respect potential foreign keys (simplified)
    for (const [table, rows] of Object.entries(payload.data)) {
      if (Array.isArray(rows) && rows.length > 0) {
        // We use upsert to either update existing or insert new rows
        const { error } = await supabaseAdmin.from(table as any).upsert(rows);
        if (error) console.error(`Error importing ${table}:`, error);
      }
    }
    
    return { success: true };
  });
