import { supabaseAdmin } from "./src/integrations/supabase/client.server";

async function reset() {
  try {
    console.log("Starting full reset...");
    await supabaseAdmin.from("production_orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("stock_products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("products").update({ current_stock: 0 }).neq("id", "00000000-0000-0000-0000-000000000000");
    console.log("Reset complete.");
  } catch (e) {
    console.error(e);
  }
}

reset();
