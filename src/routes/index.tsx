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

Estou enviando um arquivo de backup feito no sistema do base44, verifique o arquivo e veja o que pode ser resolvido para quando eu for restaurar um backup criado no sistema do base44 ele restaure corretamente os dados necessários sem erros. Primeiro me mostre o que pode ser feito antes de aplicar a implementação.
      </div>
    </div>
  ),
});
