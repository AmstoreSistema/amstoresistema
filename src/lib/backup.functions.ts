import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const exportSystemData = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const tables = [
      "materials", "products", "production_orders", "sales", 
      "clients", "financial_accounts", "transactions", "app_settings"
    ];
    
    const exportData: Record<string, any> = {};
    
    for (const table of tables) {
      const { data, error } = await supabaseAdmin.from(table).select("*");
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
    
    // Simple restoration logic: upserting data
    for (const [table, rows] of Object.entries(payload.data)) {
      if (Array.isArray(rows) && rows.length > 0) {
        const { error } = await supabaseAdmin.from(table).upsert(rows);
        if (error) console.error(`Error importing ${table}:`, error);
      }
    }
    
    return { success: true };
  });
