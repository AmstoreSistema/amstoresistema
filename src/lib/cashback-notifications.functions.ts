import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getClientsWithCashback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    
    // Fetch clients with balance > 0
    const { data, error } = await supabaseAdmin
      .from("clients")
      .select("id, name, phone, cashback_balance, updated_at")
      .gt("cashback_balance", 0)
      .order("name", { ascending: true });

    if (error) throw new Error(`Erro ao buscar clientes com cashback: ${error.message}`);
    
    return data || [];
  });
