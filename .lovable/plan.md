# Plano de Implementação: Configurações, Usuários e Backup

Este plano descreve a implementação completa das funcionalidades de configurações, gerenciamento de usuários e sistema de backup para a AmStore, seguindo a estética "Noir and Gold".

## Alterações Propostas

### 1. Banco de Dados e Segurança (Supabase)
- **Criação de Roles**: Administrador, Moderador e Usuário.
- **Tabela de Perfis**: Armazenamento de nomes, emails e status dos usuários.
- **Políticas de RLS**: Restrição de acesso a configurações sensíveis apenas para administradores.
- **Triggers**: Criação automática de perfil e atribuição de role no cadastro.

### 2. Página de Configurações (`src/routes/_authenticated.settings.tsx`)
Refatoração total para incluir:
- **Geral**: Edição de dados da loja (Nome, CNPJ, Endereço, Contato).
- **Alertas**: Configuração de notificações de estoque baixo e vendas.
- **Backup**: Funcionalidade de exportação e importação de dados do sistema em JSON.
- **Usuários**: Interface para listar, editar cargos e ativar/desativar usuários.
- **Avançado**: Parâmetros técnicos do sistema.

### 3. Lógica de Servidor
- **Settings Functions**: RPCs para salvar e carregar configurações da tabela `app_settings`.
- **User Management Functions**: Funções para gerenciar cargos e status.
- **Backup Functions**: Lógica segura (usando `supabaseAdmin` no servidor) para extrair e restaurar dados de todas as tabelas principais.

### 4. Interface e Experiência
- Design fiel às imagens de referência.
- Feedback visual com `sonner` para ações de sucesso/erro.
- Validação de campos e máscaras para documentos.

## Detalhes Técnicos

- Utilização de `createServerFn` para operações sensíveis.
- Persistência em tabela `app_settings` (chave-valor JSON).
- Integração com `supabaseAdmin` para bypass de RLS em backups.
- Garantia de `GRANT` nas tabelas públicas para acesso via API.
