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
ORCH ADMIN/                              # 1.7 MB total - 33 arquivos
├── README.md                            # Este arquivo
├── GUIA-IMPLANTACAO-CTO.md              # Guia completo de implantacao
├── genesis-validate-corrections.md      # Historico de correcoes
│
├── agent/                               # Definicao do agente
│   └── page-guide.md                    # Agente UAF completo (v3.7.0)
│
├── knowledge-base/                      # 604 KB - Base de conhecimento RAG
│   ├── cogedu-pages-guide.yaml          # Indice de paginas
│   ├── cogedu-admission-fields.yaml     # Modulo admissao
│   ├── cogedu-educational-fields.yaml   # Modulo educacional
│   ├── cogedu-exams-fields.yaml         # Modulo avaliacoes
│   ├── cogedu-users-fields.yaml         # Modulo usuarios
│   ├── cogedu-data-schema.yaml          # Schema do banco
│   ├── cogedu-workflows.yaml            # Workflows passo-a-passo
│   ├── cogedu-ava-architecture.yaml     # AVA: stack tecnico
│   ├── cogedu-ava-pages-routes.yaml     # AVA: rotas e paginas
│   ├── cogedu-ava-api-endpoints.yaml    # AVA: 179 endpoints
│   ├── cogedu-ava-data-schema.yaml      # AVA: schema de dados
│   ├── orch-memory-schema.yaml          # Schema da memoria
│   ├── orch-proactive-alerts.yaml       # Regras de alertas
│   └── zodiac-personas.yaml             # 12 perfis comportamentais
│
├── auto-update/                         # Sistema de autoatualizacao
│   ├── orch-scanner.ts                  # REGEX-based scanner do codigo
│   ├── orch-bridge.js                   # Bridge DOM runtime
│   ├── orch-conversation-logger.ts      # Logger de conversas
│   ├── orch-data-query.ts               # Consulta de dados
│   ├── orch-feedback.ts                 # Coleta de feedback
│   ├── orch-zodiac-engine.ts            # Engine zodiacal
│   ├── orch-analytics-engine.ts         # Engine de analytics
│   ├── orch-update.yml                  # GitHub Actions workflow
│   └── README.md                        # Documentacao do auto-update
│
├── feedback/                            # Banco de feedback
│   ├── faq-bank.yaml                    # Perguntas frequentes
│   ├── improvements-bank.yaml           # Sugestoes e bugs
│   ├── insight-corrections.yaml         # Correcoes de insights
│   ├── reports/                         # Relatorios de feedback
│   │   └── .gitkeep
│   └── README.md                        # Documentacao do feedback
│
└── logs/                                # Logs de conversa (runtime)
    └── .gitkeep
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
