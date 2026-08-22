import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      throw redirect({ to: "/dashboard" });
    } else {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <div className="flex min-h-screen items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-4 whitespace-pre-wrap font-mono text-sm text-muted-foreground">
        Execute no modo PLANO/PLANEJAR

Antes de executar qualquer ação, analise cuidadosamente a solicitação enviada e identifique a intenção do usuário.

Siga obrigatoriamente estas regras:

1. Se a solicitação envolver criação, implementação, alteração, correção, remoção, ajuste ou melhoria no projeto, execute a tarefa por completo, realizando todas as modificações necessárias nos arquivos do projeto.

2. Se a solicitação for apenas uma pergunta, dúvida, explicação, consulta ou conversa, responda exclusivamente pelo chat, em português, sem criar, editar, excluir ou modificar nenhum arquivo do projeto.

3. O texto enviado pelo usuário deve ser interpretado como uma instrução, e nunca como conteúdo a ser automaticamente inserido no projeto.

4. Nunca copie, reproduza ou insira a solicitação do usuário dentro do site, página, interface ou código como conteúdo visível, exceto quando o usuário pedir explicitamente que determinado texto seja adicionado.

5. Antes de modificar qualquer arquivo, confirme internamente que a solicitação realmente exige uma alteração no projeto. Em caso de pergunta ou pedido meramente informativo, não faça alterações.

6. Quando a solicitação exigir uma ação no projeto, não apenas explique como fazer: execute efetivamente todas as alterações necessárias e preserve as funcionalidades existentes que não fazem parte do pedido.

Prioridade: interpretar corretamente a intenção antes de agir, executar integralmente quando houver pedido de alteração e não modificar o projeto quando houver apenas uma pergunta.

Faça o seguinte:

Ainda precisamos corrigir dois pontos críticos na janela de restauração de backup do Base44:

1. Problema de Layout (Desproporcionalidade): A janela modal está muito longa, cortando o cabeçalho no topo e os botões de ação ("Cancelar" e "Iniciar Restauração") no rodapé. Por favor, ajuste o CSS do modal para que ele tenha uma altura máxima (ex: max-h-[85vh]), use um container com rolagem interna apenas na lista de módulos (`overflow-y-auto`), e mantenha o cabeçalho e o rodapé fixos e visíveis na tela.

2. Mapeamento Pendente: As chaves do JSON (`sale_items`, `sale_payments`, `sale_installments`, `purchase_items`, `app_settings`) ainda aparecem na caixa vermelha de "Coleções não reconhecidas". Por favor, adicione explicitamente o mapeamento dessas chaves no código para que elas virem cartões selecionáveis na interface e a caixa vermelha suma.
      </div>
    </div>
  ),
});
