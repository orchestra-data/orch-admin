# Guia de Implementação ORCH Ecosystem v6.0

> Documentação técnica para implementação do ecossistema de agentes ORCH (AVA + ADMIN)
> Atualizado: 2026-02-06

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORCH ECOSYSTEM v6.0                                │
├─────────────────────────────────┬───────────────────────────────────────────┤
│          ORCH AVA               │              ORCH ADMIN                   │
│    (Tutoria Acadêmica)          │       (Gestão Administrativa)             │
├─────────────────────────────────┼───────────────────────────────────────────┤
│  15 Agentes Gold Standard       │  1 Agente v4.0.0 (20 seções)              │
│  ┌─────────────────────────┐    │  ┌─────────────────────────────────────┐  │
│  │ Hub (orquestrador)      │    │  │ Orch (guia contextual)              │  │
│  │ Sócrates (maiêutica)    │    │  │ - Explicação de páginas             │  │
│  │ Aristóteles (lógica)    │    │  │ - Preenchimento de forms            │  │
│  │ Gardner (inteligências) │    │  │ - Coleta de feedback                │  │
│  │ Taylor (gestão tempo)   │    │  │ - Consulta de dados                 │  │
│  │ Freire (pedagogia)      │    │  │ - Alertas proativos                 │  │
│  │ Wittgenstein (clareza)  │    │  │ - Guia de workflows                 │  │
│  │ Bourdieu (capital)      │    │  │ - Adaptação zodiacal                │  │
│  │ Foucault (avaliação)    │    │  └─────────────────────────────────────┘  │
│  │ Weber (agregador D7)    │    │                                           │
│  │ Dewey (casos)           │    │                                           │
│  │ Ebbinghaus (memória)    │    │                                           │
│  │ Heimdall (admissão)     │    │                                           │
│  │ Sísifo (gamificação)    │    │                                           │
│  │ Comenius (recap diário) │ ★  │  ★ NOVO: Daily Knowledge Recap           │
│  └─────────────────────────┘    │    (Duolingo-style, Agent4Edu research)   │
├─────────────────────────────────┴───────────────────────────────────────────┤
│                         TypeScript Runtime (src/)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ core/        │  │ events/      │  │ api/         │  │ cron/        │     │
│  │ agent-reg    │  │ event-bus    │  │ routes       │  │ d7-scheduler │     │
│  │ session-mgr  │  │ d7-publisher │  │ validators   │  │              │     │
│  │ handoff      │  │ weber-cons   │  │ middleware   │  │              │     │
│  │ llm-adapter  │  │ topics       │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────────────────────┤
│                      RabbitMQ Event Bus (D7)                                 │
│  Topics: orch.d7.{agent}.parecer → Weber → orch.d7.weber.agregado           │
├─────────────────────────────────────────────────────────────────────────────┤
│                      PostgreSQL (27 tabelas)                                 │
│  ORCH AVA: 21 tabelas  │  ORCH ADMIN: 6 tabelas                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Estrutura de Arquivos

### 2.1 ORCH AVA

```
ORCH AVA/
├── agents/                          # 15 agentes Gold Standard
│   ├── _hub/hub-guide.md
│   ├── socrates/socrates-guide.md
│   ├── aristoteles/aristoteles-guide.md
│   ├── gardner/gardner-guide.md
│   ├── taylor/taylor-guide.md
│   ├── freire/freire-guide.md
│   ├── wittgenstein/wittgenstein-guide.md
│   ├── bourdieu/bourdieu-guide.md
│   ├── foucault/foucault-guide.md
│   ├── weber/weber-guide.md
│   ├── dewey/dewey-guide.md
│   ├── ebbinghaus/ebbinghaus-guide.md
│   ├── heimdall/heimdall-guide.md
│   ├── sisifo/sisifo-guide.md
│   └── comenius.md                  # ★ NEW: Daily Knowledge Recap
│
├── migrations/                      # SQL para Cogedu
│   ├── 1820000000--orch_ava_core_tables.sql
│   ├── 1820000001--orch_ava_agent_tables.sql
│   └── 1820000003--orch_ava_comenius_tables.sql  # ★ NEW: 8 tabelas
│
├── src/                             # TypeScript Runtime
│   ├── types/
│   │   └── agent.types.ts           # Types, enums, interfaces
│   ├── core/
│   │   ├── agent-registry.ts        # Carrega agentes de .md
│   │   ├── session-manager.ts       # Lifecycle de sessões
│   │   ├── handoff-protocol.ts      # Transferência entre agentes
│   │   └── llm-adapter.ts           # Multi-provider LLM
│   ├── events/
│   │   ├── topics.ts                # D7 topics definitions
│   │   ├── event-bus.ts             # RabbitMQ abstraction
│   │   ├── d7-publisher.ts          # Publica relatórios D7
│   │   ├── weber-consumer.ts        # Agrega em dossiê
│   │   └── index.ts
│   ├── cron/
│   │   ├── d7-scheduler.ts          # 23:55 D7, 00:30 Weber
│   │   └── index.ts
│   ├── api/
│   │   ├── routes/
│   │   │   ├── index.ts             # Router principal
│   │   │   ├── chat.routes.ts       # /api/orch/chat
│   │   │   ├── agents.routes.ts     # /api/orch/agents
│   │   │   ├── sessions.routes.ts   # /api/orch/sessions
│   │   │   └── reports.routes.ts    # /api/orch/reports
│   │   ├── middleware/
│   │   │   ├── orch-auth.ts         # JWT/Keycloak
│   │   │   ├── validate.ts          # Zod validation
│   │   │   └── index.ts
│   │   └── validators/
│   │       ├── chat.validators.ts
│   │       ├── agents.validators.ts
│   │       ├── sessions.validators.ts
│   │       ├── reports.validators.ts
│   │       └── index.ts
│   └── index.ts                     # Export principal
│
├── knowledge-base/                  # RAG data
└── auto-update/                     # Scripts de atualização
```

### 2.2 ORCH ADMIN

```
ORCH ADMIN/
├── agent/
│   └── page-guide.md                # Agente v4.0.0 (20 seções)
│
├── migrations/
│   └── 1820000002--orch_admin_tables.sql
│
├── knowledge-base/
│   ├── cogedu-pages-guide.yaml
│   ├── cogedu-workflows.yaml
│   ├── cogedu-data-schema.yaml
│   ├── cogedu-admission-fields.yaml
│   ├── cogedu-educational-fields.yaml
│   ├── cogedu-users-fields.yaml
│   ├── cogedu-exams-fields.yaml
│   ├── orch-memory-schema.yaml
│   ├── orch-proactive-alerts.yaml
│   └── zodiac-personas.yaml
│
└── IMPLEMENTATION-GUIDE.md          # Este documento
```

---

## 3. Migrations PostgreSQL

### 3.1 Arquivos de Migration (Prontos para Cogedu)

Copiar para `libs/migrations/migrations/`:

| Arquivo | Tabelas | Descrição |
|---------|---------|-----------|
| `1820000000--orch_ava_core_tables.sql` | 5 | Sessões, handoffs, intervenções, D7, dossiê |
| `1820000001--orch_ava_agent_tables.sql` | 8 | Tabelas específicas por agente |
| `1820000002--orch_admin_tables.sql` | 6 | Tabelas do admin |
| `1820000003--orch_ava_comenius_tables.sql` | 8 | ★ Comenius: daily recap Duolingo-style |

### 3.2 Tabelas ORCH AVA (21 tabelas)

```sql
-- Core Tables (1820000000)
orch_ava_session              -- Sessões de todos os agentes
orch_ava_handoff              -- Transferências entre agentes
orch_ava_intervention         -- Intervenções pedagógicas
orch_ava_d7_report            -- Relatórios D7 por agente
orch_ava_weber_dossier        -- Dossiê consolidado Weber

-- Agent-Specific Tables (1820000001)
orch_ava_learning_profile     -- Gardner: inteligências múltiplas
orch_ava_study_plan           -- Taylor: planos de estudo
orch_ava_socratic_dialogue    -- Sócrates: diálogos maiêuticos
orch_ava_cultural_analysis    -- Bourdieu: capital cultural
orch_ava_memory_item          -- Ebbinghaus: revisão espaçada (SM-2)
orch_ava_gamification_profile -- Sísifo: XP, badges, streaks
orch_ava_case_study           -- Dewey: estudos de caso
orch_ava_admission_journey    -- Heimdall: jornada admissão

-- Comenius Tables (1820000003) - ★ NEW
orch_ava_daily_recap          -- Sessões de recap diário (Duolingo-style)
orch_ava_recap_question       -- Questões com parâmetros IRT
orch_ava_recap_response       -- Respostas dos alunos
orch_ava_recap_streak         -- Gamificação: streaks e freezes
orch_ava_concept_memory       -- Estado de memória por conceito
orch_ava_curated_concept      -- Conceitos curados da aula
orch_ava_diagnostic_result    -- Resultados do diagnóstico IRT
orch_ava_recap_achievement    -- Badges e conquistas
```

### 3.3 Tabelas ORCH ADMIN (6 tabelas)

```sql
-- Admin Tables (1820000002)
orch_admin_session            -- Sessões do usuário admin
orch_admin_feedback           -- Feedbacks coletados
orch_admin_faq                -- FAQs auto-geradas
orch_admin_form_fill          -- Audit de formulários
orch_admin_alert              -- Alertas proativos
orch_admin_metric             -- Métricas diárias
```

### 3.4 Executando as Migrations

```bash
# No diretório do Cogedu monorepo
cd cogedu-main/cogedu-main

# Copiar migrations
cp /path/to/ORCH\ AVA/migrations/*.sql libs/migrations/migrations/
cp /path/to/ORCH\ ADMIN/migrations/*.sql libs/migrations/migrations/

# Executar
npm run migrate:dev
```

---

## 4. TypeScript Runtime

### 4.1 Instalação

```bash
cd "ORCH AVA"
npm init -y
npm install express zod gray-matter js-yaml amqplib node-cron uuid
npm install -D typescript @types/node @types/express @types/amqplib
```

### 4.2 Módulo Core (`src/core/`)

#### agent-registry.ts
```typescript
import { AgentRegistry } from './src/core/agent-registry';

const registry = AgentRegistry.getInstance({
  agentsPath: './agents',
  cacheEnabled: true,
  cacheTTL: 300000, // 5 min
});

await registry.loadAllAgents();

// Buscar agente
const socrates = registry.getAgent('socrates');

// Buscar por trigger
const agents = registry.getAgentsByTrigger('duvida conceitual');

// Verificar handoff permitido
const allowed = registry.isHandoffAllowed('hub', 'socrates');
```

#### session-manager.ts
```typescript
import { SessionManager } from './src/core/session-manager';

const sessions = SessionManager.getInstance();

// Criar sessão
const session = await sessions.createSession({
  userId: 'student-001',
  companyId: 'company-001',
  initialAgentId: 'hub',
  pageUrl: '/cursos/programacao',
});

// Adicionar mensagem
await sessions.addMessage(session.id, {
  role: 'user',
  content: 'Não entendi o conceito de recursão',
});

// Obter histórico para LLM
const history = await sessions.getConversationHistory(session.id);
```

#### handoff-protocol.ts
```typescript
import { HandoffProtocol } from './src/core/handoff-protocol';

const handoffs = HandoffProtocol.getInstance();

// Solicitar handoff
const request = await handoffs.requestHandoff(
  session.id,
  'hub',
  'socrates',
  'Estudante precisa de questionamento maiêutico'
);

// Aceitar/rejeitar
await handoffs.acceptHandoff(request.id);
// ou
await handoffs.rejectHandoff(request.id, 'Agente ocupado');
```

#### llm-adapter.ts
```typescript
import { LLMAdapter } from './src/core/llm-adapter';

const llm = LLMAdapter.getInstance({
  provider: 'anthropic', // ou 'openai', 'dify'
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Build prompt com system message do agente
const messages = llm.buildPrompt('socrates', conversationHistory, {
  studentName: 'João',
  currentTopic: 'Recursão',
});

// Chat com streaming
const response = await llm.chat({
  messages,
  agentId: 'socrates',
  sessionId: session.id,
  stream: true,
}, (chunk) => {
  process.stdout.write(chunk.content);
});
```

### 4.3 Módulo Events (`src/events/`)

#### Event Bus (RabbitMQ)
```typescript
import { getEventBus } from './src/events';

const eventBus = getEventBus({
  url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
});

await eventBus.connect();

// Publicar
await eventBus.publish('orch.d7.socrates.parecer', reportData);

// Subscrever
await eventBus.subscribe('orch.d7.*.parecer', async (topic, data) => {
  console.log(`Received from ${topic}:`, data);
});
```

#### D7 Publisher
```typescript
import { D7Publisher } from './src/events/d7-publisher';

const d7 = new D7Publisher(eventBus);

await d7.publishD7Report('socrates', 'company-001', {
  status: 'ok',
  summary: '15 diálogos socráticos hoje, 12 com insight alcançado',
  metrics: {
    dialogues_started: { current: 15, previous: 12 },
    insights_reached: { current: 12, previous: 10 },
    avg_turns: { current: 8.5, previous: 9.2 },
  },
  alerts: [],
  recommendations: [
    'Estudantes de Cálculo II com dificuldade em limites - considerar material extra',
  ],
});
```

#### Weber Consumer
```typescript
import { WeberConsumer } from './src/events/weber-consumer';

const weber = new WeberConsumer(eventBus, db);

// Inicia consumo de todos os topics D7
await weber.start();

// Evento quando dossiê é gerado
weber.on('dossier:generated', (dossier) => {
  console.log('Dossiê consolidado:', dossier);
});
```

### 4.4 Módulo Cron (`src/cron/`)

```typescript
import { initializeOrchCron } from './src/cron';

await initializeOrchCron({
  companyId: 'company-001',
  rabbitMQUrl: process.env.RABBITMQ_URL,
  timezone: 'America/Sao_Paulo',
});

// Cron jobs configurados:
// - 23:55: Gera D7 de todos os agentes
// - 00:30: Weber agrega em dossiê
// - 03:00 (dom): Limpeza de logs antigos
// - */15: Health check dos agentes
```

---

## 5. API Endpoints

### 5.1 Montagem no Express

```typescript
// No apps/api/src/index.ts do Cogedu
import { orchRouter } from '@orch-ava/api/routes';

app.use('/api/orch', orchRouter);
```

### 5.2 Endpoints Disponíveis

#### Chat (`/api/orch/chat`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/` | Enviar mensagem |
| POST | `/stream` | Streaming SSE |
| GET | `/:sessionId/history` | Histórico de mensagens |
| POST | `/:sessionId/end` | Encerrar sessão |

```typescript
// POST /api/orch/chat
{
  "message": "Não entendi recursão",
  "sessionId": "uuid-optional",  // cria nova se não existir
  "agentId": "hub",              // opcional, usa hub por padrão
  "context": {
    "pageUrl": "/cursos/programacao/modulo-3",
    "unitId": "uuid"
  }
}

// Response
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "agentId": "socrates",       // pode ter mudado via handoff
    "message": "Interessante! O que você entende por 'função chamar ela mesma'?",
    "metadata": {
      "handoff": true,
      "fromAgent": "hub",
      "reason": "Dúvida conceitual profunda"
    }
  }
}
```

#### Agents (`/api/orch/agents`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Listar agentes disponíveis |
| GET | `/:id` | Detalhes do agente |
| GET | `/:id/stats` | Estatísticas do agente |
| POST | `/:id/handoff` | Solicitar handoff manual |

#### Sessions (`/api/orch/sessions`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Listar sessões do usuário |
| GET | `/active` | Sessão ativa atual |
| GET | `/:id` | Detalhes da sessão |
| PATCH | `/:id` | Atualizar sessão |

#### Reports (`/api/orch/reports`)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/d7` | Relatórios D7 (paginado) |
| GET | `/d7/:agentId` | D7 de um agente específico |
| GET | `/dossier/:studentId` | Dossiê Weber do aluno |
| GET | `/metrics` | Métricas agregadas |

### 5.3 Autenticação

```typescript
// Middleware orch-auth.ts
// Extrai do JWT Keycloak:
// - tenant_id
// - company_id
// - user_id
// - roles (para verificar permissões ORCH)

// Headers requeridos:
Authorization: Bearer <jwt>
X-Tenant-Id: <uuid>      // opcional, extraído do JWT
X-Company-Id: <uuid>     // opcional, extraído do JWT
```

### 5.4 Permissões ORCH

```typescript
// Permissões verificadas pelo middleware
'orch.chat.send'          // Enviar mensagens
'orch.chat.stream'        // Usar streaming
'orch.sessions.view'      // Ver sessões
'orch.sessions.manage'    // Gerenciar sessões
'orch.agents.view'        // Ver agentes
'orch.agents.handoff'     // Solicitar handoff manual
'orch.reports.d7'         // Ver relatórios D7
'orch.reports.dossier'    // Ver dossiês
'orch.reports.metrics'    // Ver métricas
'orch.admin'              // Acesso administrativo total
```

---

## 6. Event Bus D7

### 6.1 Topics

```
orch.d7.hub.parecer
orch.d7.socrates.parecer
orch.d7.aristoteles.parecer
orch.d7.gardner.parecer
orch.d7.taylor.parecer
orch.d7.freire.parecer
orch.d7.wittgenstein.parecer
orch.d7.bourdieu.parecer
orch.d7.foucault.parecer
orch.d7.weber.parecer
orch.d7.dewey.parecer
orch.d7.ebbinghaus.parecer
orch.d7.heimdall.parecer
orch.d7.sisifo.parecer
orch.d7.comenius.parecer   # ★ NEW: Daily Recap metrics
orch.d7.admin.parecer

orch.d7.weber.agregado     # Dossiê consolidado
```

### 6.2 Fluxo D7

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUXO D7 DIÁRIO                          │
├─────────────────────────────────────────────────────────────────┤
│  23:55  Cron dispara geração D7 para todos os agentes           │
│         │                                                        │
│         ├──→ Hub publica em orch.d7.hub.parecer                 │
│         ├──→ Sócrates publica em orch.d7.socrates.parecer       │
│         ├──→ ... (todos os 14 agentes)                          │
│         └──→ Admin publica em orch.d7.admin.parecer             │
│                                                                  │
│  00:00  Weber Consumer recebe todos os relatórios               │
│         │                                                        │
│         └──→ Armazena em orch_ava_d7_report                     │
│                                                                  │
│  00:30  Cron dispara agregação Weber                            │
│         │                                                        │
│         ├──→ Agrupa relatórios por company_id                   │
│         ├──→ Calcula health score                               │
│         ├──→ Identifica alertas críticos                        │
│         ├──→ Gera dossiê consolidado                            │
│         └──→ Publica em orch.d7.weber.agregado                  │
│                                                                  │
│  00:35  Dossiê disponível para consulta                         │
│         GET /api/orch/reports/dossier/:studentId                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Checklist de Implementação

### 7.1 Infraestrutura
- [ ] PostgreSQL 14+ com `uuid-ossp` extension
- [ ] RabbitMQ para Event Bus
- [ ] Redis para cache de sessões (opcional)
- [ ] S3/MinIO para logs arquivados (opcional)

### 7.2 Migrations
- [ ] Copiar `1820000000--orch_ava_core_tables.sql`
- [ ] Copiar `1820000001--orch_ava_agent_tables.sql`
- [ ] Copiar `1820000002--orch_admin_tables.sql`
- [ ] Copiar `1820000003--orch_ava_comenius_tables.sql`
- [ ] Executar `npm run migrate:dev`

### 7.3 TypeScript Runtime
- [ ] Copiar `src/` para o projeto
- [ ] Instalar dependências
- [ ] Configurar variáveis de ambiente
- [ ] Testar agent-registry com agentes .md

### 7.4 API Endpoints
- [ ] Montar router em `/api/orch`
- [ ] Configurar middleware de auth
- [ ] Testar endpoints com Postman/Insomnia

### 7.5 Event Bus
- [ ] Criar exchange e queues no RabbitMQ
- [ ] Iniciar Weber Consumer
- [ ] Testar publicação/consumo D7

### 7.6 Cron Jobs
- [ ] Configurar crons no servidor
- [ ] Testar geração D7 manual
- [ ] Testar agregação Weber manual

### 7.7 Integração Frontend
- [ ] Widget de chat no AVA
- [ ] Widget de ajuda no Admin
- [ ] Streaming SSE funcionando

---

## 8. Variáveis de Ambiente

```bash
# LLM Provider
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
LLM_PROVIDER=anthropic  # anthropic | openai | dify
LLM_MODEL=claude-3-5-sonnet-20241022

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# Database (já configurado no Cogedu)
DATABASE_URL=postgresql://...

# Redis (opcional)
REDIS_URL=redis://localhost:6379

# Orch Config
ORCH_AGENTS_PATH=./agents
ORCH_SESSION_TIMEOUT=1800000  # 30 min em ms
ORCH_D7_TIMEZONE=America/Sao_Paulo
```

---

## 9. KPIs de Sucesso

| Métrica | Meta | Frequência |
|---------|------|------------|
| Taxa de resolução (AVA) | >= 75% | Diária |
| Taxa de resolução (ADMIN) | >= 85% | Diária |
| Tempo primeira resposta | <= 3s | Diária |
| Satisfação usuário | >= 0.7 | Diária |
| Cobertura D7 | 100% agentes | Diária |
| Uptime agentes | >= 99.5% | Mensal |
| Redução tickets suporte | >= 30% | Mensal |
| Insights gerados (Sócrates) | >= 80% | Semanal |
| Handoffs bem-sucedidos | >= 90% | Semanal |
| **Comenius: Completion rate** | >= 80% | Diária |
| **Comenius: Avg streak length** | >= 7 dias | Semanal |
| **Comenius: Concept retention** | >= 80% | Semanal |

---

## 10. Repositórios GitHub

| Repositório | Conteúdo |
|-------------|----------|
| `orchestra-data/orch-ava` | 15 agentes + runtime + migrations |
| `orchestra-data/orch-admin` | 1 agente + migrations + este guia |

### Commits Recentes

```
# ORCH AVA
b7e3f2a feat: add Comenius agent - Daily Knowledge Recap (Duolingo-style)
a41ab7b feat: add complete TypeScript runtime (26 files, 9717 lines)
de9765e feat: add PostgreSQL migrations (13 tables)
79df473 feat: apply Genesis 6-Phase to 5 remaining agents

# ORCH ADMIN
cd77f51 feat: add PostgreSQL migrations (6 tables)
6ab8b0e feat: apply Genesis 6-Phase improvement v4.0.0
```

---

## 11. Comenius - Daily Knowledge Recap (NEW)

### 11.1 Visão Geral

O **Comenius** é o 15º agente do ORCH AVA, inspirado em Jan Amos Comenius (pai da educação moderna). Funciona como um **Duolingo acadêmico**, medindo diariamente o conhecimento do aluno sobre o que foi aprendido nas aulas.

### 11.2 Arquitetura de Sub-Agentes

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMENIUS PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   AULA (presencial/online)                                       │
│         │                                                        │
│         ▼                                                        │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│   │  CURATOR    │──▶│ SYNTHESIZER │──▶│ DIAGNOSTIC  │          │
│   │             │   │             │   │             │          │
│   │ Normaliza   │   │ Gera recap  │   │ Detecta     │          │
│   │ conceitos   │   │ personaliz. │   │ déficits    │          │
│   └─────────────┘   └─────────────┘   └─────────────┘          │
│                                              │                   │
│                                              ▼                   │
│                                        ┌─────────────┐          │
│                                        │   TUTOR     │          │
│                                        │             │          │
│                                        │ Feedback +  │          │
│                                        │ remediação  │          │
│                                        └─────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 11.3 Base de Pesquisa

- **Agent4Edu** (Cornell/USTC) - arXiv:2501.10332v1
- Memory module com decay temporal (Ebbinghaus)
- Perfis de estudante (atividade, diversidade, taxa de sucesso, habilidade)
- Mecanismo de reflexão corretiva
- Suporte zero-shot para novos alunos

### 11.4 Gamificação Duolingo-Style

| Mecânica | Descrição |
|----------|-----------|
| **Deadline** | 23:59:59 diário |
| **Streak** | Sequência de dias consecutivos |
| **XP** | 50 (completo) + 50 (perfeito) + 25 (streak) |
| **Freeze** | Protege streak por 1 dia (ganho com XP) |
| **Badges** | Conquistas por marcos (7 dias, 30 dias, etc.) |

### 11.5 Endpoints Específicos

```
GET  /api/orch/comenius/recap/today      # Recap de hoje
POST /api/orch/comenius/recap/:id/start  # Iniciar recap
POST /api/orch/comenius/recap/:id/answer # Submeter resposta
POST /api/orch/comenius/recap/:id/complete # Finalizar
GET  /api/orch/comenius/streak           # Status do streak
POST /api/orch/comenius/streak/freeze    # Usar freeze
GET  /api/orch/comenius/stats            # Estatísticas
GET  /api/orch/comenius/leaderboard      # Ranking
```

### 11.6 Integrações

| Agente | Integração |
|--------|------------|
| Ebbinghaus | Sincroniza dados de memória e decay |
| Sísifo | Sincroniza XP, badges e streaks |
| Gardner | Usa perfil de aprendizagem para adaptar conteúdo |
| Weber | Envia D7 com métricas de completion e retention |

---

## 12. Suporte

| Recurso | Localização |
|---------|-------------|
| Agentes AVA | `ORCH AVA/agents/` |
| Agente ADMIN | `ORCH ADMIN/agent/page-guide.md` |
| Runtime TypeScript | `ORCH AVA/src/` |
| Migrations | `*/migrations/*.sql` |
| Knowledge Bases | `*/knowledge-base/*.yaml` |

---

*Documento atualizado com Comenius (15º agente) - Daily Knowledge Recap*
*Versão: 6.0.0 | Data: 2026-02-06*
*Total: 46 arquivos | 26 TypeScript | 4 SQL | 16 Agent Guides | 27 tabelas DB*
