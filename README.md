# Orch Admin

Agente guia contextual inteligente do sistema de gestao Cogedu.

## O que e o Orch?

O Orch e um assistente embeddado no sistema Cogedu que ajuda funcionarios a:

- Entender o proposito de cada pagina do sistema
- Saber o que preencher em cada campo
- Entender modais, botoes e acoes disponiveis
- Preencher formularios sob demanda
- Resolver erros e duvidas em tempo real

## Estrutura

```
ORCH ADMIN/
  agent/
    page-guide.md          # Definicao do agente (UAF - Ultimate Agent Framework)
  knowledge-base/
    cogedu-pages-guide.yaml # Knowledge base com 45+ paginas documentadas
```

## Modulos Cobertos

| Modulo | Paginas | Descricao |
|--------|---------|-----------|
| Admissao | 10 | Processos seletivos, ofertas, candidatos, inscricoes |
| Educacional | 10 | Colecoes, trilhas, series, unidades, builder |
| Avaliacoes | 6 | Banco de questoes, avaliacoes, rubricas, correcao |
| Usuarios | 4 | Funcionarios, alunos, permissoes |
| Empresas | 3 | Instituicoes multi-tenant |
| Certificados | 4 | Templates, emissao, validacao |
| Admin/BI | 4 | Dashboard, privacidade, integracoes |
| Auth | 4 | Login, reset de senha, primeiro acesso |

## Integracao

O Orch e integrado como nova aba no CommunicationHub do Cogedu:

- `apps/web/src/components/communication-hub/CommunicationHub.tsx`
- `apps/web/src/components/communication-hub/HubPanel.tsx`

## Funcionalidades

1. **Guia contextual** - Detecta a pagina pela URL e explica campos, botoes e fluxos
2. **Preenchimento de campos** - Preenche formularios pelo funcionario com confirmacao
3. **Resolucao de erros** - Ajuda a entender e resolver mensagens de erro
4. **Passo a passo** - Guia numerado para tarefas comuns

## Tech Stack

- **Frontend**: React 19 + TypeScript (widget no CommunicationHub)
- **Backend**: Monolito Cogedu (endpoints `/orch/*` adicionados ao backend existente)
- **RAG**: Dify self-hosted (Docker Compose)
- **LLM**: OpenAI gpt-4o-mini (principal) + gpt-5-mini (fallback)
- **Vetores**: pgvector (extensao PostgreSQL)
- **Memoria**: PostgreSQL (tabelas `orch_conversations`, `orch_feedback`, `orch_analytics_events`)
- **Knowledge Base**: 14 YAML files (604 KB) indexados no Dify
- **Comunicacao**: postMessage entre widget e DOM (orch-bridge.js)
- **CI/CD**: GitHub Actions para auto-update da knowledge base
