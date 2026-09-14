import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ebooolaabwsuwmqhcqkv.supabase.co";
const SUPABASE_KEY = "sb_publishable_DJQXpWPvlKvYzLR9FiGDwA_2xsBbp0L";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Checking products and stock_products...");

  // 1. Fetch from stock_products where quantidade_disponivel <= 0 or numeracoes issues
  const { data: allStock, error: errStock } = await supabase
    .from("stock_products")
    .select("id, produto_id, produto_nome, quantidade_disponivel, numeracoes, categoria");

  if (errStock) {
    console.error("Error fetching stock_products:", errStock);
    return;
  }

  console.log(`Total stock_products rows: ${allStock?.length}`);

  // 2. Fetch from products
  const { data: allProducts, error: errProd } = await supabase
    .from("products")
    .select("id, name, sku, current_stock");

  if (errProd) {
    console.error("Error fetching products:", errProd);
    return;
  }

  console.log(`Total products rows: ${allProducts?.length}`);

  const productMap = new Map();
  for (const p of allProducts) {
    productMap.set(p.id, p);
  }

  // Check for products in stock_products where quantidade_disponivel <= 0
  const zeroStockInTable = allStock.filter(s => (s.quantidade_disponivel ?? 0) <= 0);
  console.log(`\nstock_products with quantidade_disponivel <= 0: ${zeroStockInTable.length}`);
  for (const s of zeroStockInTable.slice(0, 10)) {
    console.log(`- ${s.produto_nome} (ID: ${s.id}, Qtd: ${s.quantidade_disponivel})`);
  }

  // Check for products in stock_products where quantidade_disponivel > 0 BUT in products current_stock <= 0
  const discrepancyStock = allStock.filter(s => {
    const p = productMap.get(s.produto_id);
    return (s.quantidade_disponivel ?? 0) > 0 && p && (p.current_stock ?? 0) <= 0;
  });
  console.log(`\nDiscrepancy (stock_products > 0 BUT products.current_stock <= 0): ${discrepancyStock.length}`);
  for (const s of discrepancyStock) {
    const p = productMap.get(s.produto_id);
    console.log(`- ${s.produto_nome}: stock_products.qtd=${s.quantidade_disponivel} vs products.current_stock=${p?.current_stock}`);
  }

  // Check products in products with current_stock <= 0
  const zeroInProducts = allProducts.filter(p => (p.current_stock ?? 0) <= 0);
  console.log(`\nproducts with current_stock <= 0: ${zeroInProducts.length}`);

  // Check what ProductSearch queries:
  // Query 1: stock_products gt("quantidade_disponivel", 0)
  const { data: q1, error: e1 } = await supabase
    .from("stock_products")
    .select(`
      id,
      produto_id,
      produto_nome,
      quantidade_disponivel,
      preco_venda,
      numeracoes,
      categoria,
      products:produto_id (
        sku,
        image_url,
        current_stock
      )
    `)
    .gt("quantidade_disponivel", 0)
    .order("produto_nome", { ascending: true })
    .limit(350);

  if (e1) console.error("Error q1:", e1);
  console.log(`\nQuery 1 (stock_products gt 0) returned: ${q1?.length} items`);
  
  // Check if any item in q1 has products.current_stock <= 0
  const q1WithZeroProductStock = (q1 || []).filter(item => {
    const cs = item.products?.current_stock;
    return cs !== undefined && cs !== null && cs <= 0;
  });
  console.log(`Items in q1 where linked products.current_stock <= 0: ${q1WithZeroProductStock.length}`);
  for (const item of q1WithZeroProductStock) {
    console.log(`- [Q1] ${item.produto_nome} | stock_products.qtd=${item.quantidade_disponivel} | products.current_stock=${item.products?.current_stock} | numeracoes=${JSON.stringify(item.numeracoes)}`);
  }

  // Check if any item in q1 has numeracoes where all sizes are 0
  const q1WithEmptySizes = (q1 || []).filter(item => {
    if (!item.numeracoes || typeof item.numeracoes !== 'object') return false;
    const values = Object.values(item.numeracoes).map(Number);
    const sum = values.reduce((a, b) => a + b, 0);
    return sum <= 0;
  });
  console.log(`Items in q1 where numeracoes sum <= 0: ${q1WithEmptySizes.length}`);
  for (const item of q1WithEmptySizes) {
    console.log(`- [Q1 Numeracoes 0] ${item.produto_nome} | qtd=${item.quantidade_disponivel} | numeracoes=${JSON.stringify(item.numeracoes)}`);
  }

  // Query 2: fallback products gt("current_stock", 0)
  const { data: q2, error: e2 } = await supabase
    .from("products")
    .select("id, name, sku, category, sale_price, current_stock, image_url")
    .gt("current_stock", 0)
    .order("name", { ascending: true })
    .limit(200);

  if (e2) console.error("Error q2:", e2);
  console.log(`\nQuery 2 (fallback products gt 0) returned: ${q2?.length} items`);

  // Check if any product in fallback also exists in stock_products with 0
  const q2InStockZero = (q2 || []).filter(p => {
    const s = allStock.find(item => item.produto_id === p.id);
    return s && (s.quantidade_disponivel ?? 0) <= 0;
  });
  console.log(`Items in fallback q2 that have stock_products with qtd <= 0: ${q2InStockZero.length}`);
  for (const item of q2InStockZero) {
    const s = allStock.find(i => i.produto_id === item.id);
    console.log(`- [Fallback Q2] ${item.name} | products.current_stock=${item.current_stock} | stock_products.qtd=${s?.quantidade_disponivel}`);
  }
}

main();
