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
ORCH ADMIN/                              # 2.0 MB total - 40 arquivos
├── README.md                            # Este arquivo
├── GUIA-IMPLANTACAO-CTO.md              # Guia completo de implantacao
├── genesis-validate-corrections.md      # Historico de correcoes
│
├── agent/                               # Definicao do agente
│   └── page-guide.md                    # Agente UAF completo (v3.7.0)
│
├── dify/                                # RAG backend setup
│   ├── docker-compose.yml               # Stack Dify completa
│   ├── nginx.conf                       # Reverse proxy
│   ├── .env.example                     # Variaveis de ambiente
│   ├── setup-knowledge-base.ts          # Script de upload
│   ├── orch-admin-app.json              # Config do app Dify
│   └── README.md                        # Instrucoes de setup
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
├── migrations/                          # SQL migrations
│   └── 1820000002--orch_admin_tables.sql  # 6 tabelas PostgreSQL
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

O Orch e integrado como aba no FloatingChat do Cogedu Admin:

**Frontend:**
- `apps/web/src/components/FloatingChat.tsx` - UI com abas Chat | ORCH
- `apps/web/src/contexts/OrchAdminContext.tsx` - Estado e API calls
- `apps/web/src/app.tsx` - Provider wrapper

**Backend:**
- `apps/api/src/endpoints/orchAdmin*/` - 7 endpoints REST
- `migrations/1820000002--orch_admin_tables.sql` - 6 tabelas PostgreSQL

## Funcionalidades

1. **Guia contextual** - Detecta a pagina pela URL e explica campos, botoes e fluxos
2. **Preenchimento de campos** - Preenche formularios pelo funcionario com confirmacao
3. **Resolucao de erros** - Ajuda a entender e resolver mensagens de erro
4. **Passo a passo** - Guia numerado para tarefas comuns

## API Endpoints

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/orch-admin/sessions` | Inicia nova sessao de chat |
| POST | `/orch-admin/chat` | Envia mensagem e recebe resposta AI |
| POST | `/orch-admin/sessions/:id/end` | Encerra sessao ativa |
| GET | `/orch-admin/alerts` | Lista alertas proativos do usuario |
| POST | `/orch-admin/alerts/:id/read` | Marca alerta como lido |
| POST | `/orch-admin/feedback` | Envia feedback do usuario |
| GET | `/orch-admin/context/*` | Retorna contexto da pagina atual |

### Variaveis de Ambiente

```bash
# Dify RAG Integration
DIFY_API_URL=http://localhost/v1
DIFY_ORCH_ADMIN_API_KEY=app-xxx

# Database (usa a mesma do Cogedu)
DATABASE_URL=postgresql://...
```

### Exemplo de Uso

```typescript
// Iniciar sessao
POST /orch-admin/sessions
{ "initialPage": "/admission" }
// Response: { "sessionId": "uuid", "resumed": false }

// Enviar mensagem
POST /orch-admin/chat
{
  "sessionId": "uuid",
  "message": "Como criar uma nova oferta?",
  "pageContext": "/admission"
}
// Response: { "message": "Para criar uma oferta...", "metadata": {} }
```

## Tech Stack

- **Frontend**: React 19 + TypeScript (aba ORCH no FloatingChat)
- **Backend**: Express.js (endpoints `/orch-admin/*` no monolito Cogedu)
- **RAG**: Dify self-hosted (Docker Compose)
- **LLM**: OpenAI gpt-4o-mini (principal) + gpt-4o (fallback)
- **Vetores**: pgvector (extensao PostgreSQL)
- **Memoria**: PostgreSQL (6 tabelas `orch_admin_*`)
- **Knowledge Base**: 14 YAML files (604 KB) indexados no Dify
- **Comunicacao**: React Context + REST API
- **CI/CD**: GitHub Actions para auto-update da knowledge base
