import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getClientsWithCashback = createServerFn({ method: "GET" })
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
