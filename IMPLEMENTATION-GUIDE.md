# Guia de Implementação ORCH Ecosystem v4.0

> Documentação técnica para implementação do ecossistema de agentes ORCH (AVA + ADMIN)
> Atualizado: 2026-02-06

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORCH ECOSYSTEM                               │
├─────────────────────────────────┬───────────────────────────────────┤
│          ORCH AVA               │          ORCH ADMIN               │
│    (Tutoria Acadêmica)          │    (Gestão Administrativa)        │
├─────────────────────────────────┼───────────────────────────────────┤
│  17 Agentes Especializados      │  1 Agente Multifuncional          │
│  - Hub (orquestrador)           │  - Orch (guia contextual)         │
│  - Sócrates (maiêutica)         │                                   │
│  - Aristóteles (lógica)         │  Funções:                         │
│  - Gardner (inteligências)      │  - Explicação de páginas          │
│  - Taylor (gestão tempo)        │  - Preenchimento de forms         │
│  - Freire (pedagogia crítica)   │  - Coleta de feedback             │
│  - Wittgenstein (linguagem)     │  - Consulta de dados              │
│  - Bourdieu (capital cultural)  │  - Alertas proativos              │
│  - Foucault (avaliação)         │  - Guia de workflows              │
│  - + 9 especialistas            │  - Adaptação comportamental       │
├─────────────────────────────────┴───────────────────────────────────┤
│                          EVENT BUS                                   │
│  Topics: orch.d7.*.parecer → Weber (agregador D7)                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Migrations PostgreSQL

### 2.1 ORCH AVA - Tabelas Comuns

```sql
-- ===========================================
-- ORCH AVA - Schema Base
-- ===========================================

-- Sessões de tutoria (compartilhada entre agentes)
CREATE TABLE orch_ava_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    series_id UUID REFERENCES series(id),
    unit_id UUID REFERENCES units(id),
    agent_id VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    messages_count INTEGER DEFAULT 0,
    resolution_status VARCHAR(20) DEFAULT 'active',
    learning_outcome VARCHAR(50),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_ava_sessions_student ON orch_ava_sessions(student_id);
CREATE INDEX idx_ava_sessions_agent ON orch_ava_sessions(agent_id);
CREATE INDEX idx_ava_sessions_series ON orch_ava_sessions(series_id);

-- Handoffs entre agentes
CREATE TABLE orch_ava_handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES orch_ava_sessions(id),
    from_agent VARCHAR(50) NOT NULL,
    to_agent VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    context_summary TEXT,
    accepted BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ava_handoffs_session ON orch_ava_handoffs(session_id);

-- Intervenções pedagógicas registradas
CREATE TABLE orch_ava_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES orch_ava_sessions(id),
    student_id UUID NOT NULL REFERENCES users(id),
    agent_id VARCHAR(50) NOT NULL,
    intervention_type VARCHAR(50) NOT NULL,
    trigger_reason TEXT,
    content TEXT NOT NULL,
    student_response VARCHAR(50),
    effectiveness_score DECIMAL(3,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ava_interventions_student ON orch_ava_interventions(student_id);
CREATE INDEX idx_ava_interventions_type ON orch_ava_interventions(intervention_type);

-- Perfis de aprendizagem (Gardner)
CREATE TABLE orch_ava_learning_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    dominant_intelligences JSONB NOT NULL DEFAULT '[]',
    learning_style VARCHAR(50),
    preferred_formats TEXT[],
    interaction_history JSONB DEFAULT '[]',
    last_assessment_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Planos de estudo (Taylor)
CREATE TABLE orch_ava_study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id),
    series_id UUID REFERENCES series(id),
    plan_type VARCHAR(30) NOT NULL,
    goals JSONB NOT NULL,
    schedule JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    adherence_rate DECIMAL(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ava_plans_student ON orch_ava_study_plans(student_id);

-- Diálogos socráticos
CREATE TABLE orch_ava_socratic_dialogues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES orch_ava_sessions(id),
    student_id UUID NOT NULL REFERENCES users(id),
    topic TEXT NOT NULL,
    question_sequence JSONB NOT NULL DEFAULT '[]',
    insight_reached BOOLEAN DEFAULT FALSE,
    insight_summary TEXT,
    turns_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Análises de capital cultural (Bourdieu)
CREATE TABLE orch_ava_cultural_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id),
    capital_economico JSONB,
    capital_cultural JSONB,
    capital_social JSONB,
    barriers_identified TEXT[],
    recommendations JSONB,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Relatórios D7 gerados
CREATE TABLE orch_ava_d7_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50) NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id),
    report_date DATE NOT NULL,
    report_data JSONB NOT NULL,
    sent_to_weber BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(agent_id, company_id, report_date)
);

CREATE INDEX idx_ava_d7_agent ON orch_ava_d7_reports(agent_id);
CREATE INDEX idx_ava_d7_date ON orch_ava_d7_reports(report_date DESC);
```

### 2.2 ORCH ADMIN - Tabelas

```sql
-- ===========================================
-- ORCH ADMIN - Schema
-- ===========================================

-- Sessões de interação com usuários admin
CREATE TABLE orch_admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    pages_visited TEXT[] DEFAULT '{}',
    commands_used TEXT[] DEFAULT '{}',
    sentiment_score DECIMAL(3,2),
    resolution_status VARCHAR(20) DEFAULT 'open',
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_admin_sessions_user ON orch_admin_sessions(user_id);
CREATE INDEX idx_admin_sessions_company ON orch_admin_sessions(company_id);
CREATE INDEX idx_admin_sessions_started ON orch_admin_sessions(started_at DESC);

-- Feedbacks coletados
CREATE TABLE orch_admin_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES orch_admin_sessions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    feedback_type VARCHAR(20) NOT NULL,
    page_context VARCHAR(255),
    content TEXT NOT NULL,
    sentiment VARCHAR(20),
    priority INTEGER DEFAULT 3,
    status VARCHAR(20) DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_admin_feedbacks_type ON orch_admin_feedbacks(feedback_type);
CREATE INDEX idx_admin_feedbacks_status ON orch_admin_feedbacks(status);
CREATE INDEX idx_admin_feedbacks_created ON orch_admin_feedbacks(created_at DESC);

-- FAQs automáticas
CREATE TABLE orch_admin_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_hash VARCHAR(64) UNIQUE NOT NULL,
    question_canonical TEXT NOT NULL,
    answer TEXT NOT NULL,
    page_context VARCHAR(255),
    occurrence_count INTEGER DEFAULT 1,
    last_asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    promoted_to_docs BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_admin_faqs_page ON orch_admin_faqs(page_context);
CREATE INDEX idx_admin_faqs_count ON orch_admin_faqs(occurrence_count DESC);

-- Log de preenchimentos de formulário
CREATE TABLE orch_admin_form_fills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES orch_admin_sessions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    page_url VARCHAR(500) NOT NULL,
    fields_filled JSONB NOT NULL,
    confirmed_by_user BOOLEAN NOT NULL,
    error_fields TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_fills_session ON orch_admin_form_fills(session_id);
CREATE INDEX idx_admin_fills_page ON orch_admin_form_fills(page_url);

-- Alertas proativos
CREATE TABLE orch_admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    action_taken VARCHAR(50),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_admin_alerts_user ON orch_admin_alerts(user_id);
CREATE INDEX idx_admin_alerts_type ON orch_admin_alerts(alert_type);
CREATE INDEX idx_admin_alerts_severity ON orch_admin_alerts(severity);

-- Métricas agregadas diárias
CREATE TABLE orch_admin_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    date DATE NOT NULL,
    total_sessions INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    avg_session_duration INTERVAL,
    resolution_rate DECIMAL(5,2),
    avg_sentiment DECIMAL(3,2),
    feedbacks_collected INTEGER DEFAULT 0,
    forms_filled INTEGER DEFAULT 0,
    alerts_sent INTEGER DEFAULT 0,
    top_pages JSONB DEFAULT '[]',
    top_commands JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, date)
);

CREATE INDEX idx_admin_metrics_company_date ON orch_admin_metrics(company_id, date DESC);
```

---

## 3. Event Bus - Topics D7

### 3.1 Configuração dos Topics

```yaml
# kafka-topics.yaml ou equivalente no seu message broker

topics:
  # ORCH AVA - Um topic por agente
  - name: orch.d7.hub.parecer
    partitions: 3
    retention: 30d

  - name: orch.d7.socrates.parecer
    partitions: 3
    retention: 30d

  - name: orch.d7.aristoteles.parecer
    partitions: 3
    retention: 30d

  - name: orch.d7.gardner.parecer
    partitions: 3
    retention: 30d

  - name: orch.d7.taylor.parecer
    partitions: 3
    retention: 30d

  - name: orch.d7.freire.parecer
    partitions: 3
    retention: 30d

  - name: orch.d7.wittgenstein.parecer
    partitions: 3
    retention: 30d

  - name: orch.d7.bourdieu.parecer
    partitions: 3
    retention: 30d

  - name: orch.d7.foucault.parecer
    partitions: 3
    retention: 30d

  # ORCH ADMIN
  - name: orch.d7.admin.parecer
    partitions: 3
    retention: 30d

  # Weber agregador
  - name: orch.d7.weber.agregado
    partitions: 1
    retention: 90d
```

### 3.2 Schema dos Eventos D7

```typescript
// types/d7-events.ts

interface D7ReportBase {
  agent_id: string;
  agent_name: string;
  company_id: string;
  report_date: string; // ISO date
  generated_at: string; // ISO timestamp
  period: {
    start: string;
    end: string;
  };
}

interface D7AvaReport extends D7ReportBase {
  ecosystem: 'orch-ava';
  metrics: {
    sessions_count: number;
    students_helped: number;
    avg_session_duration_minutes: number;
    resolution_rate: number;
    handoffs_made: number;
    handoffs_received: number;
  };
  insights: {
    category: string;
    observation: string;
    recommendation: string;
    priority: 'low' | 'medium' | 'high';
  }[];
  alerts: {
    type: string;
    count: number;
    examples: string[];
  }[];
}

interface D7AdminReport extends D7ReportBase {
  ecosystem: 'orch-admin';
  metrics: {
    total_sessions: number;
    total_feedbacks: number;
    forms_filled: number;
    alerts_sent: number;
    resolution_rate: number;
    avg_sentiment: number;
  };
  feedback_summary: {
    features_requested: number;
    bugs_reported: number;
    ux_issues: number;
    adjustments: number;
  };
  top_pages: {
    path: string;
    visits: number;
    avg_time: number;
  }[];
  recommendations: string[];
}
```

---

## 4. Integração com Weber (Agregador D7)

### 4.1 Consumer Configuration

```typescript
// services/weber-consumer.ts

import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'weber-aggregator',
  brokers: process.env.KAFKA_BROKERS.split(','),
});

const consumer = kafka.consumer({ groupId: 'weber-d7-group' });

const D7_TOPICS = [
  'orch.d7.hub.parecer',
  'orch.d7.socrates.parecer',
  'orch.d7.aristoteles.parecer',
  'orch.d7.gardner.parecer',
  'orch.d7.taylor.parecer',
  'orch.d7.freire.parecer',
  'orch.d7.wittgenstein.parecer',
  'orch.d7.bourdieu.parecer',
  'orch.d7.foucault.parecer',
  'orch.d7.admin.parecer',
];

async function startWeberConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: D7_TOPICS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const report = JSON.parse(message.value.toString());
      await processD7Report(topic, report);
    },
  });
}

async function processD7Report(topic: string, report: D7ReportBase) {
  // 1. Persistir relatório individual
  await db.orch_d7_reports.insert({
    agent_id: report.agent_id,
    company_id: report.company_id,
    report_date: report.report_date,
    report_data: report,
    received_at: new Date(),
  });

  // 2. Verificar se todos os agentes enviaram
  const pendingAgents = await checkPendingAgents(report.company_id, report.report_date);

  if (pendingAgents.length === 0) {
    // 3. Agregar e gerar relatório consolidado
    await generateConsolidatedReport(report.company_id, report.report_date);
  }
}
```

### 4.2 Cron Jobs para Geração D7

```typescript
// cron/d7-reports.ts

import cron from 'node-cron';

// Todos os agentes geram relatório às 23:55
cron.schedule('55 23 * * *', async () => {
  const companies = await db.companies.findAll({ where: { active: true } });

  for (const company of companies) {
    // Disparar geração para cada agente
    await Promise.all([
      generateAgentReport('hub', company.id),
      generateAgentReport('socrates', company.id),
      generateAgentReport('aristoteles', company.id),
      generateAgentReport('gardner', company.id),
      generateAgentReport('taylor', company.id),
      generateAgentReport('freire', company.id),
      generateAgentReport('wittgenstein', company.id),
      generateAgentReport('bourdieu', company.id),
      generateAgentReport('foucault', company.id),
      generateAgentReport('admin', company.id),
    ]);
  }
});

// Weber agrega às 00:30 (após receber todos)
cron.schedule('30 0 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const reportDate = yesterday.toISOString().split('T')[0];

  const companies = await db.companies.findAll({ where: { active: true } });

  for (const company of companies) {
    await weberAggregateAndSend(company.id, reportDate);
  }
});
```

---

## 5. Configuração dos Agentes

### 5.1 Estrutura de Arquivos

```
ORCH AVA/
├── agents/
│   ├── hub/
│   │   └── hub-guide.md           # Orquestrador principal
│   ├── socrates/
│   │   └── socrates-guide.md      # Maiêutica e questionamento
│   ├── aristoteles/
│   │   └── aristoteles-guide.md   # Lógica e argumentação
│   ├── gardner/
│   │   └── gardner-guide.md       # Inteligências múltiplas
│   ├── taylor/
│   │   └── taylor-guide.md        # Gestão de tempo
│   ├── freire/
│   │   └── freire-guide.md        # Pedagogia crítica
│   ├── wittgenstein/
│   │   └── wittgenstein-guide.md  # Clareza conceitual
│   ├── bourdieu/
│   │   └── bourdieu-guide.md      # Capital cultural
│   └── foucault/
│       └── foucault-guide.md      # Avaliação formativa
├── protocols/
│   ├── inter-agent-protocol.yaml  # Protocolo de handoff
│   └── d7-integration.yaml        # Integração com Weber
└── knowledge-base/
    └── ava-*.yaml                 # Knowledge base compartilhada

ORCH ADMIN/
├── agent/
│   └── page-guide.md              # Agente único v4.0.0
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
├── auto-update/
│   └── orch-analytics-engine.ts
├── feedback/
│   ├── faq-bank.yaml
│   ├── improvements-bank.yaml
│   └── insight-corrections.yaml
└── logs/
    └── {user_id}/                 # Logs por usuário
```

### 5.2 Carregamento dos Agentes (Runtime)

```typescript
// services/agent-loader.ts

import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import matter from 'gray-matter';

interface AgentDefinition {
  id: string;
  name: string;
  version: string;
  role: string;
  ecosystem: 'orch-ava' | 'orch-admin';
  triggers: string[];
  capabilities: string[];
  prompt: string;
}

export function loadAgent(agentPath: string): AgentDefinition {
  const content = readFileSync(agentPath, 'utf-8');
  const { data: frontmatter, content: markdown } = matter(content);

  return {
    id: frontmatter.id,
    name: frontmatter.name,
    version: frontmatter.version,
    role: frontmatter.role,
    ecosystem: frontmatter.ecosystem,
    triggers: frontmatter.trigger?.split(' + ') || [],
    capabilities: extractCapabilities(markdown),
    prompt: markdown,
  };
}

export function loadAllAvaAgents(): Map<string, AgentDefinition> {
  const agents = new Map();
  const agentDirs = [
    'hub', 'socrates', 'aristoteles', 'gardner',
    'taylor', 'freire', 'wittgenstein', 'bourdieu', 'foucault'
  ];

  for (const dir of agentDirs) {
    const path = `./ORCH AVA/agents/${dir}/${dir}-guide.md`;
    agents.set(dir, loadAgent(path));
  }

  return agents;
}
```

---

## 6. Checklist de Implementação

### 6.1 Infraestrutura

- [ ] PostgreSQL 14+ com extensão `pgcrypto` (para `gen_random_uuid()`)
- [ ] Kafka/RabbitMQ para Event Bus
- [ ] Redis para cache de sessões
- [ ] S3/MinIO para logs arquivados

### 6.2 Migrations

- [ ] Executar migrations ORCH AVA (Seção 2.1)
- [ ] Executar migrations ORCH ADMIN (Seção 2.2)
- [ ] Criar índices de performance
- [ ] Configurar particionamento por data (opcional)

### 6.3 Event Bus

- [ ] Criar topics D7 (Seção 3.1)
- [ ] Configurar consumer Weber
- [ ] Testar publicação/consumo

### 6.4 Agentes

- [ ] Carregar definições dos 17+ agentes AVA
- [ ] Carregar definição do agente ADMIN
- [ ] Configurar knowledge bases
- [ ] Integrar com LLM provider (Anthropic/OpenAI)

### 6.5 Cron Jobs

- [ ] Configurar geração D7 às 23:55
- [ ] Configurar agregação Weber às 00:30
- [ ] Configurar limpeza de logs (730 dias)

### 6.6 Monitoramento

- [ ] Dashboards de métricas por agente
- [ ] Alertas de falha de geração D7
- [ ] Log aggregation (ELK/Datadog)

---

## 7. KPIs de Sucesso

| Métrica | Meta | Frequência |
|---------|------|------------|
| Taxa de resolução (AVA) | >= 75% | Diária |
| Taxa de resolução (ADMIN) | >= 85% | Diária |
| Tempo primeira resposta | <= 3s | Diária |
| Satisfação usuário | >= 0.7 | Diária |
| Cobertura D7 | 100% agentes | Diária |
| Uptime agentes | >= 99.5% | Mensal |
| Redução tickets suporte | >= 30% | Mensal |

---

## 8. Próximos Passos

### Fase 1: MVP (2-4 semanas)
1. Deploy ORCH ADMIN (agente único)
2. Migrations básicas
3. Integração com widget existente
4. Coleta de feedback

### Fase 2: ORCH AVA Básico (4-6 semanas)
1. Deploy Hub + 3 agentes core (Sócrates, Gardner, Taylor)
2. Protocolo de handoff
3. Integração com player de vídeo

### Fase 3: Expansão (6-8 semanas)
1. Deploy agentes restantes
2. Sistema D7 completo
3. Weber agregador
4. Dashboards analytics

### Fase 4: Otimização (ongoing)
1. Fine-tuning de prompts
2. A/B testing
3. Novos agentes especializados

---

## 9. Contatos e Recursos

| Recurso | Localização |
|---------|-------------|
| Agentes AVA | `C:\Projetos IA\ORCH AVA\agents\` |
| Agente ADMIN | `C:\Projetos IA\ORCH ADMIN\agent\` |
| Knowledge Bases | `*/knowledge-base/*.yaml` |
| Este documento | `C:\Projetos IA\ORCH-IMPLEMENTATION-GUIDE.md` |

---

*Documento gerado automaticamente após aplicação do Genesis 6-Phase Improvement Plan*
*Versão: 4.0.0 | Data: 2026-02-06*
