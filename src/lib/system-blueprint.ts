export type BlueprintSection = {
  id: string;
  title: string;
  summary: string;
  body: string;
};

export const SYSTEM_BLUEPRINT: BlueprintSection[] = [
  {
    id: "visao-geral",
    title: "Visão geral do sistema",
    summary: "Objetivo, público e arquitetura macro do Amstore Gestão.",
    body: `# Amstore Gestão — Visão geral

Sistema de gestão para fábrica/loja de bolsas e calçados. Cobre o ciclo completo:
compra de matéria-prima -> estoque de materiais -> ficha técnica -> ordens de produção ->
estoque de produtos acabados -> venda (PDV) -> financeiro (contas, transações, fiado) ->
fidelidade (cashback, promoções QR) -> relatórios e auditoria.

## Arquitetura
- Frontend: React 19 + TanStack Start (rotas em arquivos), TanStack Query, Tailwind v4, shadcn/ui, sonner (toasts), lucide-react.
- Backend: Postgres gerenciado (Supabase) com RLS, funções SQL (RPC) e triggers para regras críticas.
- Server functions (RPC tipado) para operações privilegiadas; rotas HTTP públicas só para integrações externas.
- Autenticação por e-mail/senha; cadastro público desabilitado (somente admin cria contas). Papéis em tabela separada \`user_roles\` + função \`has_role\`.
- Idioma da interface: português do Brasil. Moeda BRL, datas pt-BR.

## Princípios de implementação
1. Regras que afetam dinheiro ou estoque vivem no banco (funções/triggers), nunca só no cliente.
2. Toda tabela pública tem RLS habilitada + GRANTs explícitos.
3. Toda operação de criar/editar/excluir grava log em \`audit_log\`.
4. Saldos são derivados por trigger a partir de transações — nunca atualizados manualmente na UI.`,
  },
  {
    id: "modelo-dados",
    title: "Modelo de dados",
    summary: "Tabelas, relacionamentos e campos essenciais.",
    body: `# Modelo de dados

## Cadastros
- \`materials\`: matéria-prima. name, type/category, unit, cost (custo unitário), current_stock, min_stock, supplier_id.
- \`material_categories\`, \`units_of_measure\`, \`material_variations\`, \`material_cuts\`: apoio de materiais.
- \`products\`: produto acabado. name, category, sku/code, sale_price, cost_price, current_stock, min_stock, active.
- \`product_materials\`: ficha técnica (product_id, material_id, quantity) — consumo por unidade produzida.
- \`clients\`: name, phone, document, address, cashback_balance, notes.
- \`suppliers\`: name, category, phone, document.
- \`user_profiles\` (id, email, display_name) e \`user_roles\` (user_id, role enum app_role).

## Compras
- \`purchases\`: supplier_id, total_amount, status, purchase_date, notes.
- \`purchase_items\`: purchase_id, material_id, quantity, unit_cost.
- Efeitos: entrada no estoque de materiais, atualização de custo do material (com histórico de variação de preço) e criação de \`transactions\` de despesa com a categoria do fornecedor (ex.: FERRAGEM).

## Produção
- \`production_orders\`: product_id, quantity, status (pendente | em_producao | concluida | cancelada), datas.
- RPCs: \`start_production_order\`, \`complete_production_order\`, \`delete_production_order\`.
- Concluir a ordem: baixa materiais conforme ficha técnica e dá entrada no estoque do produto.

## Vendas
- \`sales\`: sale_code, client_id, total_amount, discount, paid_amount, payment_method, is_debt, status, cashback_earned, created_at.
- \`sale_items\`: sale_id, product_id, quantity, unit_price, discount.
- \`sale_payments\`: pagamentos efetivados (valor, método, conta, data).
- \`sale_installments\`: parcelas do fiado (installment_number, amount, paid_amount, due_date, status pending|paid|overdue).
- RPCs: \`create_complete_sale\` (venda atômica), \`cancel_complete_sale\` (estorna estoque, financeiro e cashback), \`update_sale_installments\`, \`check_sale_installments_alerts\`.

## Financeiro
- \`financial_accounts\`: name, type, balance, is_active (exatamente uma conta ativa garantida por trigger).
- \`transactions\`: type (receita|despesa), amount, category, description, status (pago|pendente), account_id, due_date, paid_at, client_id, supplier_id, purchase_id, sale_id.
- \`debt_payments\`: baixas de fiado.
- RPC \`transfer_between_accounts\`.

## Fidelidade
- \`cashback_config\`: regras por categoria (nome da categoria + percentual + ativo).
- \`cashback_entries\`: créditos/débitos de cashback (client_id, sale_id, amount, kind).
- \`qr_promo_config\` e \`qr_promo_history\`: promoção por QR Code com contador e posições premiadas.
- \`promotions\`: campanhas.

## Operacional
- \`audit_log\`: action, entity, entity_id, details (JSON string), user_email, created_at.
- \`notifications\`, \`app_settings\`, \`print_settings\`, \`etiqueta_gerada\` (etiquetas geradas).`,
  },
  {
    id: "regras-negocio",
    title: "Regras de negócio",
    summary: "Estoque, financeiro, fiado e cashback — a lógica que não pode quebrar.",
    body: `# Regras de negócio

## Estoque
- Compra aprovada => entrada em \`materials.current_stock\` e atualização do custo unitário.
- Ordem concluída => saída de materiais (quantidade da ficha técnica x quantidade produzida) e entrada em \`products.current_stock\`.
- Venda => saída de produtos. Cancelamento de venda devolve o estoque.
- Alertas quando \`current_stock <= min_stock\`.

## Financeiro
- Saldo da conta é mantido por trigger \`handle_transaction_balance\`: cobre inserção, edição de valor, troca de conta, mudança de status (pendente <-> pago) e exclusão.
- Excluir compra (\`cancel_purchase\`) remove as transações vinculadas por \`purchase_id\` e estorna o saldo.
- Excluir venda estorna receita, parcelas, cashback e estoque.
- Nunca somar/subtrair saldo no frontend: risco de double balancing.
- Trigger garante exatamente uma conta ativa; ao excluir a ativa, outra é ativada.

## Fiado (crédito)
- Venda com \`is_debt = true\` gera N parcelas em \`sale_installments\`.
- Cada pagamento registra \`sale_payments\` + transação de receita e atualiza \`paid_amount\` da parcela e da venda.
- Status da venda: PARCIALMENTE PAGO enquanto houver saldo devedor; QUITADO ao zerar.
- Parcela vencida e não paga vira \`overdue\` (rotina \`check_sale_installments_alerts\`), alimentando o painel e a Cobrança WhatsApp.

## Cashback
- Regra ativa por categoria de produto: cashback = valor do item x percentual da categoria (normalizar nome da categoria, ex.: "Sandália" = "Sandálias").
- Venda à vista (dinheiro, PIX, cartão): crédito imediato no \`cashback_balance\` do cliente.
- Venda a prazo: crédito proporcional liberado a cada parcela quitada.
- Exclusão/cancelamento da venda estorna o cashback creditado.
- Uso do saldo como desconto no PDV gera \`cashback_entries\` negativo.`,
  },
  {
    id: "modulos-ui",
    title: "Módulos e telas",
    summary: "Mapa de rotas, o que cada tela faz e seus componentes.",
    body: `# Módulos e telas

Menu lateral agrupado: Produção · Sistema · Loja · Suprimentos · Marketing.

| Rota | Tela | Função |
| --- | --- | --- |
| /dashboard | Painel | KPIs gerais, produção recente, alertas de estoque, parcelas em atraso |
| /materials | Materiais | CRUD de matéria-prima, custo, unidade, mínimo |
| /products | Produtos | CRUD + ficha técnica (composição por material) |
| /production | Produção | Ordens: criar, iniciar, concluir, excluir; documento de produção |
| /stock | Estoque | Saldos de materiais e produtos, entradas diretas |
| /reports | Relatórios | Consolidados de vendas, custos e produção |
| /labels | Etiquetas | Gerador de etiquetas com preços e código |
| /audit | Auditoria | Histórico de ações com cards de totais e modal de detalhes JSON |
| /live-metrics | Métricas ao Vivo | KPIs em tempo real com atualização automática |
| /ai-docs | Documentação IA | Blueprint do sistema + assistente que gera especificações |
| /store | Painel da Loja | Visão comercial: vendas, ticket, fiado, caixa, top produtos |
| /sales | Vendas | Lista + PDV (modal), cupom, parcelas, detalhes |
| /clients | Clientes | Cards de clientes, modal com compras, parcelas e cashback |
| /credit | Fiado | Carteira de crédito, parcelas e pagamentos |
| /transactions | Transações | Receitas e despesas, edição e detalhes vinculados |
| /accounts | Contas | Contas financeiras, transferências, exclusão |
| /catalog | Catálogo | Vitrine de produtos |
| /purchase-board | Fornecedores | Painel por fornecedor: compras, totais, variação de preços |
| /purchases | Compras | Registro de compras e itens, detalhes |
| /whatsapp-billing | Cobrança WhatsApp | Filtro por atraso e envio de mensagem |
| /cashback | Cashback | Regras por categoria e notificação de clientes |
| /promotions | Promoções QR | Configuração e histórico do sorteio |
| /settings | Configurações | Dados da loja, usuários, backup |

## PDV (fluxo principal de venda)
1. Buscar/selecionar cliente (ou consumidor) e produtos por categoria.
2. Carrinho com quantidade, preço, desconto por item e desconto geral.
3. Exibir cashback disponível do cliente e bônus a ganhar na venda.
4. Escolher forma de pagamento; se fiado, definir número de parcelas e vencimentos.
5. Confirmar => RPC atômica cria venda, itens, parcelas, transação, baixa estoque e cashback.
6. Abrir cupom (recibo) com histórico de pagamentos, total pago e saldo devedor.`,
  },
  {
    id: "design",
    title: "Design system",
    summary: "Tokens, tipografia e padrões visuais para recriar o layout.",
    body: `# Design system

- Tema escuro elegante com acento dourado. Tokens semânticos em CSS (\`--gold\`, \`--success\`, \`--destructive\`, \`--muted-foreground\`, gradientes \`--gradient-gold\`, \`--gradient-dark\`, sombras \`shadow-elegant\`, \`shadow-gold\`).
- Nunca usar cores fixas (\`text-white\`, \`bg-[#...]\`) nos componentes; sempre tokens.
- Tipografia: fonte display para títulos (peso bold, tracking tight) e sans para corpo.
- Cartões: \`rounded-2xl\`/\`rounded-3xl\`, borda \`border-border\`, fundo \`bg-card\`, leve blur e hover com elevação (\`-translate-y-0.5\` + borda dourada).
- Padrões reutilizáveis: \`PageHeader\` (ícone + título + descrição + ações), \`StatCard\` (ícone em quadro colorido, título em caixa alta pequena, valor tabular), tabelas com cabeçalho discreto, \`Badge\` para status, \`Dialog\` para detalhes e formulários.
- Estados vazios sempre com ícone opaco + frase em itálico.
- Valores monetários em \`Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'})\`, números tabulares.`,
  },
  {
    id: "portabilidade",
    title: "Guia de portabilidade",
    summary: "Como recriar o sistema (ou um módulo) em outra plataforma.",
    body: `# Guia de portabilidade

Para reproduzir este sistema em outra stack, siga a ordem:
1. Criar o schema (cadastros -> compras -> produção -> vendas -> financeiro -> fidelidade -> auditoria) com chaves estrangeiras e índices em client_id, sale_id, purchase_id, created_at.
2. Implementar as regras críticas no servidor/banco: venda atômica, cancelamento de venda, conclusão de produção, saldo por transação, parcelas de fiado, cashback proporcional.
3. Implementar autenticação com papéis em tabela separada e verificação server-side.
4. Construir as telas na ordem: cadastros -> produção -> PDV -> financeiro -> relatórios.
5. Aplicar o design system (tokens semânticos, cartões arredondados, acento dourado).
6. Cobrir os casos de borda: exclusão com estorno, edição de transação, parcelas vencidas, categorias com nomes divergentes, venda para consumidor sem cadastro.

Ao pedir a especificação de um módulo para outra IA, informe: objetivo, tabelas envolvidas, regras de negócio, contratos de função, telas, componentes e casos de borda.`,
  },
];

export const BLUEPRINT_MARKDOWN = SYSTEM_BLUEPRINT.map((s) => s.body).join("\n\n---\n\n");
