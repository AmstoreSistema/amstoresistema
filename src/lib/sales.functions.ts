import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    client_id: z.string().nullable(),
    payment_method: z.string(),
    total_amount: z.number(),
    discount: z.number(),
    discount_amount: z.number().default(0),
    paid_amount: z.number(),
    is_debt: z.boolean(),
    cashback_used: z.number().default(0),
    cashback_earned: z.number().default(0),
    notes: z.string().optional(),
    sale_type: z.string().default("Varejo"),
    financial_account_id: z.string().nullable().optional(),
    protection_method: z.string().nullable().optional(),
    sale_code: z.string().nullable().optional(),
    created_at: z.string().optional(),
    items: z.array(z.object({
      stock_id: z.string().nullable(),
      product_id: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
      numeracao: z.string().nullable().optional().or(z.literal("")),
      discount: z.number().default(0),
      stock_snapshot: z.any().optional()
    })),
    installments: z.array(z.object({
      number: z.number(),
      amount: z.number(),
      due_date: z.string()
    })).optional().default([])
  }).parse(data))


  .handler(async ({ data, context }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    
    // Promo QR Logic
    let isAwarded = false;
    let promoQr = null;
    let newCounter = 0;

    const { data: promoConfig } = await admin
      .from("qr_promo_config")
      .select("*")
      .single();

    if (promoConfig && promoConfig.active) {
      newCounter = (promoConfig.current_counter || 0) + 1;
      const positions = (promoConfig.awarded_positions || "")
        .split(',')
        .map(p => parseInt(p.trim()))
        .filter(p => !isNaN(p));
      
      isAwarded = positions.includes(newCounter);
      promoQr = `QR-PROM-${new Date().getFullYear()}-${newCounter.toString().padStart(4, '0')}`;

      // Update counter
      await admin.from("qr_promo_config").update({ current_counter: newCounter }).eq("id", promoConfig.id);
    }

    // Calculate cashback based on categories if not provided
    let calculatedCashbackEarned = data.cashback_earned;
    
    if (calculatedCashbackEarned === 0 && data.items.length > 0 && data.client_id) {
      const normalizeCategory = (value: unknown) => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/s$/, "");
      // Get all products in the sale to find their categories
      const productIds = [...new Set(data.items.map(i => i.product_id))];
      const { data: products } = await admin
        .from("products")
        .select("id, category")
        .in("id", productIds);
      
      if (products && products.length > 0) {
        // Get cashback configs
        const { data: configs } = await admin
          .from("cashback_config")
          .select("cashback_percent, category_name")
          .eq("active", true);
        
        if (configs && configs.length > 0) {
          let totalEarned = 0;
          for (const item of data.items) {
            const product = products.find(p => p.id === item.product_id);
            if (!product) continue;
            
            const config = configs.find(c =>
              normalizeCategory(c.category_name) === normalizeCategory(product.category)
            );
            if (config) {
              const itemTotal = (item.unit_price * item.quantity) - (item.discount || 0);
              totalEarned += (itemTotal * Number(config.cashback_percent)) / 100;
            }
          }
          calculatedCashbackEarned = Number(totalEarned.toFixed(2));
        }
      }
    }

    const saleParams = {
      p_cashback_earned: calculatedCashbackEarned,
      p_cashback_used: data.cashback_used,
      p_discount: data.discount,
      p_discount_amount: data.discount_amount,
      p_installments: data.installments,
      p_is_debt: data.is_debt,
      p_items: data.items,
      p_notes: data.notes || '',
      p_paid_amount: data.paid_amount,
      p_payment_method: data.payment_method,
      p_sale_type: data.sale_type,
      p_total_amount: data.total_amount,
      ...(data.client_id ? { p_client_id: data.client_id } : {}),
      ...(data.created_at ? { p_created_at: data.created_at } : {}),
      ...(data.financial_account_id ? { p_financial_account_id: data.financial_account_id } : {}),
      ...(data.protection_method ? { p_protection_method: data.protection_method } : {}),
      ...(data.sale_code ? { p_sale_code: data.sale_code } : {}),
    };
    const { data: saleId, error } = await context.supabase.rpc('create_complete_sale', saleParams);

    if (error) throw new Error(`Erro ao criar venda: ${error.message}`);

    // Update sale with promo info and log to history
    if (promoConfig && promoConfig.active) {
      await admin.from("sales").update({
        is_awarded: isAwarded,
        promo_qr: promoQr
      }).eq("id", saleId);

      await admin.from("qr_promo_history").insert({
        sale_id: saleId,
        client_id: data.client_id,
        position: newCounter,
        is_awarded: isAwarded,
        bonus_amount: isAwarded ? promoConfig.bonus_value : 0,
        status: isAwarded ? 'premiado' : 'padrao'
      });

      // If awarded, apply bonus as cashback balance
      if (isAwarded && data.client_id) {
         const { data: client } = await admin.from("clients").select("cashback_balance").eq("id", data.client_id).single();
         if (client) {
            await admin.from("clients").update({
              cashback_balance: (client.cashback_balance || 0) + Number(promoConfig.bonus_value)
            }).eq("id", data.client_id);
            
            await admin.from("cashback_entries").insert({
              client_id: data.client_id,
              sale_id: saleId,
              amount: Number(promoConfig.bonus_value),
              kind: 'earned',
              description: `Bônus QR Code Premiado (Venda #${data.sale_code || (saleId as string).slice(0,8)})`
            });
         }
      }
    }

    return { 
      saleId: saleId as string,
      promoQr: promoQr,
      isAwarded: isAwarded,
      cashbackEarned: calculatedCashbackEarned
    };

  });

export const cancelSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ sale_id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('cancel_complete_sale', {
      p_sale_id: data.sale_id
    });
    
    if (error) throw new Error(`Erro ao cancelar venda: ${error.message}`);
    return { success: true };
  });

export const registerSalePayment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    installment_id: z.string().optional(),
    sale_id: z.string(),
    amount: z.number(),
    payment_method: z.string(),
    account_id: z.string().optional(),
    description: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    if (data.installment_id) {
      const { error } = await admin.rpc('pay_sale_installment', {
        p_installment_id: data.installment_id,
        p_amount: data.amount,
        p_payment_method: data.payment_method,
        p_account_id: data.account_id,
        p_description: data.description
      });
      if (error) throw new Error(`Erro ao registrar pagamento da parcela: ${error.message}`);
    } else {
      // Direct sale payment (non-installment)
      const { data: sale } = await admin
        .from("sales")
        .select("paid_amount, total_amount, sale_code, client_id")
        .eq("id", data.sale_id)
        .single();

      if (!sale) throw new Error("Venda não encontrada");

      const { error: paymentError } = await admin
        .from("sale_payments")
        .insert({
          sale_id: data.sale_id,
          amount: data.amount,
          payment_method: data.payment_method
        });

      if (paymentError) throw new Error(`Erro ao registrar pagamento: ${paymentError.message}`);

      const newPaidAmount = Number(sale.paid_amount) + data.amount;
      const newStatus = newPaidAmount >= Number(sale.total_amount) - 0.009 ? "paid" : "partial";
      
      await admin
        .from("sales")
        .update({ 
          paid_amount: newPaidAmount,
          status: newStatus
        })
        .eq("id", data.sale_id);

      // Description for the record
      const finalDesc = data.description || `Pagamento Venda #${sale.sale_code || data.sale_id.slice(0, 8)}`;
      
      // Removed manual transaction insert and account balance update.
      // The database trigger 'transaction_balance_trigger' on 'transactions' table 
      // handles account balances automatically when a transaction is inserted.
      // We still need one source of transaction truth. 
      // If we are here (registerSalePayment without installment_id), we insert it once.
      
      await admin
        .from("transactions")
        .insert({
          amount: data.amount,
          type: "income",
          description: finalDesc,
          sale_id: data.sale_id,
          category: 'Venda',
          account_id: data.account_id,
          status: 'pago',
          payment_method: data.payment_method,
          client_id: sale.client_id
        } as any);
    }

    return { success: true };
  });

export const updateInstallments = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    sale_id: z.string(),
    installments: z.array(z.object({
      number: z.number(),
      amount: z.number(),
      due_date: z.string()
    }))
  }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.rpc('update_sale_installments', {
      p_sale_id: data.sale_id,
      p_installments: data.installments
    });
    
    if (error) throw new Error(`Erro ao atualizar parcelas: ${error.message}`);

    // Update sales table installments_count
    await supabase
      .from("sales")
      .update({ installments_count: data.installments.length })
      .eq("id", data.sale_id);

    return { success: true };
  });


export const processBulkPayment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    sale_id: z.string(),
    amount: z.number(),
    payment_method: z.string(),
    account_id: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    
    // Get all pending installments for this sale ordered by due date (FIFO)
    const { data: installments, error: instError } = await admin
      .from("sale_installments")
      .select("*")
      .eq("sale_id", data.sale_id)
      .not("status", "in", "('paid','pago')")
      .order("installment_number", { ascending: true })
      .order("due_date", { ascending: true });

    if (instError) throw new Error(`Erro ao buscar parcelas: ${instError.message}`);
    if (!installments || installments.length === 0) throw new Error("Nenhuma parcela pendente encontrada para esta venda.");

    const { data: sale } = await admin.from("sales").select("sale_code").eq("id", data.sale_id).single();
    let remainingPayment = data.amount;
    
    // Process sequentially (FIFO)
    for (const inst of installments) {
      if (remainingPayment <= 0.009) break;

      const instAmount = Number(inst.amount);
      const instPaid = Number(inst.paid_amount || 0);
      const instRemaining = Math.max(0, instAmount - instPaid);
      
      const amountToPay = Math.min(remainingPayment, instRemaining);
      
      if (amountToPay > 0) {
        // Individual description for the installment part
        const instDesc = `Pagamento ${inst.installment_number}ª Parcela Venda #${sale?.sale_code || data.sale_id.slice(0, 8)}`;
        
        const { error: payError } = await admin.rpc('pay_sale_installment', {
          p_installment_id: inst.id,
          p_amount: Number(amountToPay.toFixed(2)),
          p_payment_method: data.payment_method,
          p_account_id: data.account_id,
          p_description: instDesc
        });

        if (payError) throw new Error(`Erro ao processar pagamento na parcela ${inst.installment_number}: ${payError.message}`);

        remainingPayment -= amountToPay;
      }
    }

    return { success: true };
  });

export const getSaleDetails = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ sale_id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const [saleResult, itemsResult, paymentsResult, installmentsResult] = await Promise.all([
      supabaseAdmin.from("sales").select("*, clients(id, name, phone, cashback_balance)").eq("id", data.sale_id).single(),
      supabaseAdmin.from("sale_items").select("*, products(name)").eq("sale_id", data.sale_id),
      supabaseAdmin.from("transactions").select("*, financial_accounts(name)").eq("sale_id", data.sale_id).eq("type", "income"),
      supabaseAdmin.from("sale_installments").select("*").eq("sale_id", data.sale_id).order("installment_number", { ascending: true })
    ]);

    if (saleResult.error) throw new Error(`Erro ao buscar venda: ${saleResult.error.message}`);
    
    return {
      sale: saleResult.data,
      items: itemsResult.data || [],
      payments: paymentsResult.data || [],
      installments: installmentsResult.data || []
    };
  });

export const editSaleItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    sale_id: z.string(),
    client_id: z.string().nullable().optional(),
    created_at: z.string().optional(),
    discount_general: z.number().nonnegative().optional(),
    cashback_used: z.number().nonnegative().optional(),
    items: z.array(z.object({
      id: z.string().optional(),
      product_id: z.string(),
      quantity: z.number().positive(),
      unit_price: z.number().nonnegative(),
      numeracao: z.string().nullable().optional().or(z.literal("")),
      discount: z.number().nonnegative().default(0),
    })).min(1, "A venda precisa ter ao menos um produto"),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    // 1. Busca a venda atual
    const { data: sale, error: saleErr } = await admin
      .from("sales")
      .select("*")
      .eq("id", data.sale_id)
      .single();

    if (saleErr || !sale) throw new Error("Venda não encontrada para edição.");

    // 2. Busca os itens atuais da venda antes da edição
    const { data: oldItems = [], error: oldItemsErr } = await admin
      .from("sale_items")
      .select("*")
      .eq("sale_id", data.sale_id);

    if (oldItemsErr) throw new Error(`Erro ao buscar itens da venda: ${oldItemsErr.message}`);

    // 3. DEVOLUÇÃO AO ESTOQUE: Estorna todos os itens antigos
    for (const oldItem of oldItems) {
      if (!oldItem.product_id) continue;
      const qty = Number(oldItem.quantity) || 1;

      // Devolve ao products.current_stock
      const { data: prod } = await admin
        .from("products")
        .select("current_stock")
        .eq("id", oldItem.product_id)
        .single();

      if (prod) {
        await admin
          .from("products")
          .update({ current_stock: Number(prod.current_stock || 0) + qty })
          .eq("id", oldItem.product_id);
      }

      // Devolve ao stock_products (incluindo numeração se houver)
      const { data: stockRecords = [] } = await admin
        .from("stock_products")
        .select("id, quantidade_disponivel, numeracoes")
        .eq("produto_id", oldItem.product_id);

      if (stockRecords && stockRecords.length > 0) {
        // Atualiza no primeiro registro ou registro correspondente
        const stockRow = stockRecords[0];
        const updates: Record<string, any> = {
          quantidade_disponivel: Number(stockRow.quantidade_disponivel || 0) + qty,
        };

        if (oldItem.numeracao && stockRow.numeracoes && typeof stockRow.numeracoes === "object") {
          const nums = { ...(stockRow.numeracoes as Record<string, any>) };
          nums[oldItem.numeracao] = (Number(nums[oldItem.numeracao]) || 0) + qty;
          updates.numeracoes = nums;
        }

        await admin.from("stock_products").update(updates).eq("id", stockRow.id);
      }
    }

    // 4. BAIXA NO ESTOQUE: Deduz os novos itens
    for (const newItem of data.items) {
      const qty = Number(newItem.quantity) || 1;

      // Subtrai de products.current_stock
      const { data: prod } = await admin
        .from("products")
        .select("current_stock")
        .eq("id", newItem.product_id)
        .single();

      if (prod) {
        await admin
          .from("products")
          .update({ current_stock: Math.max(0, Number(prod.current_stock || 0) - qty) })
          .eq("id", newItem.product_id);
      }

      // Subtrai de stock_products (incluindo numeração se houver)
      const { data: stockRecords = [] } = await admin
        .from("stock_products")
        .select("id, quantidade_disponivel, numeracoes")
        .eq("produto_id", newItem.product_id);

      if (stockRecords && stockRecords.length > 0) {
        const stockRow = stockRecords[0];
        const updates: Record<string, any> = {
          quantidade_disponivel: Math.max(0, Number(stockRow.quantidade_disponivel || 0) - qty),
        };

        if (newItem.numeracao && stockRow.numeracoes && typeof stockRow.numeracoes === "object") {
          const nums = { ...(stockRow.numeracoes as Record<string, any>) };
          nums[newItem.numeracao] = Math.max(0, (Number(nums[newItem.numeracao]) || 0) - qty);
          updates.numeracoes = nums;
        }

        await admin.from("stock_products").update(updates).eq("id", stockRow.id);
      }
    }

    // 5. Substitui os itens na tabela sale_items
    const { error: delErr } = await admin
      .from("sale_items")
      .delete()
      .eq("sale_id", data.sale_id);

    if (delErr) throw new Error(`Erro ao atualizar itens da venda: ${delErr.message}`);

    const newRowsToInsert = data.items.map((item) => ({
      sale_id: data.sale_id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      numeracao: item.numeracao || null,
      discount: item.discount || 0,
    }));

    const { error: insErr } = await admin
      .from("sale_items")
      .insert(newRowsToInsert);

    if (insErr) throw new Error(`Erro ao inserir novos itens: ${insErr.message}`);

    // 6. Recalcula o valor total da venda
    const itemsSubtotal = data.items.reduce(
      (acc, item) => acc + item.quantity * item.unit_price - (item.discount || 0),
      0
    );

    const discountGeneral = data.discount_general !== undefined 
      ? Number(data.discount_general) 
      : Number(sale.discount_amount ?? sale.discount ?? 0);
    const cashbackUsed = data.cashback_used !== undefined 
      ? Number(data.cashback_used) 
      : Number(sale.cashback_used || 0);

    const newTotal = Math.max(0, Number((itemsSubtotal - discountGeneral - cashbackUsed).toFixed(2)));

    const paidAmount = Number(sale.paid_amount || 0);
    const newStatus =
      paidAmount >= newTotal - 0.009
        ? "paid"
        : paidAmount > 0
        ? "partial"
        : "pending";

    const updatePayload: Record<string, any> = {
      total_amount: newTotal,
      discount: discountGeneral,
      discount_amount: discountGeneral,
      cashback_used: cashbackUsed,
      status: newStatus,
    };

    if (data.client_id !== undefined) {
      updatePayload.client_id = data.client_id;
    }

    if (data.created_at) {
      updatePayload.created_at = data.created_at;
    }

    await admin
      .from("sales")
      .update(updatePayload)
      .eq("id", data.sale_id);

    return {
      success: true,
      sale_id: data.sale_id,
      oldTotal: Number(sale.total_amount),
      newTotal,
    };
  });
