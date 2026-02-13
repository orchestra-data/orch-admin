# ORCH Admin

> Assistente IA contextual embeddado no sistema Cogedu Admin que guia funcionários em tempo real.

---

## 🏷️ Feature Type

| | |
|---|---|
| **Tipo** | 🔄 **PRÉ-SQUAD** - Feature desenvolvida antes do squad, sendo adotada |
| **Status** | Adopted ✅ - Aguardando implementação de endpoints |
| **Target** | **Admin** (painel administrativo) |

---

| Field | Value |
|-------|-------|
| **Author** | Steven Phil <steven.phil@indigohive.com.br> |
| **Squad** | Cogedu Orchestra |
| **Created** | 2026-02-07 |
| **Repository** | https://github.com/orchestra-data/cogedu-feature-orch-admin |

---

## Overview

**ORCH Admin** é um assistente IA contextual que vive dentro do FloatingChat do Cogedu Admin. Ele detecta automaticamente em qual página o funcionário está e oferece ajuda personalizada.

### What Problem Does This Solve?

O sistema Cogedu tem **45+ páginas** com centenas de campos. Funcionários novos ou ocasionais frequentemente:
- Não sabem o que preencher em cada campo
- Não entendem o fluxo de trabalho correto
- Cometem erros por falta de contexto
- Precisam perguntar para colegas ou suporte

**ORCH Admin resolve isso** oferecendo um guia contextual que:
- Explica cada página, campo e botão
- Preenche formulários sob demanda
- Guia passo-a-passo em tarefas complexas
- Envia alertas proativos sobre riscos

### Who Uses This Feature?

| User Type | How They Use It |
|-----------|-----------------|
| Secretaria | Ajuda com matrículas, inscrições, documentos |
| Coordenador | Entende relatórios, configura turmas |
| Financeiro | Auxílio com boletos, pagamentos |
| Admin TI | Configuração de integrações, usuários |
| Novo funcionário | Onboarding acelerado no sistema |

---

## Features

### Core Functionality

- **Guia Contextual** - Detecta a página pela URL e explica campos, botões e fluxos
- **Preenchimento Assistido** - Preenche formulários pelo funcionário com confirmação
- **Resolução de Erros** - Ajuda a entender e resolver mensagens de erro
- **Passo a Passo** - Guia numerado para tarefas comuns (criar oferta, matricular aluno)
- **Alertas Proativos** - Notifica sobre riscos, prazos e problemas detectados
- **FAQ Auto-gerado** - Aprende com perguntas recorrentes e sugere respostas
- **Zodiac Personas** - 12 perfis comportamentais para personalizar comunicação

### Key Characteristics

| Characteristic | Value |
|----------------|-------|
| Multi-tenant | ✅ Yes (tenant_id + company_id) |
| Permissions | Qualquer usuário logado |
| Audit Log | ✅ Yes (orch_admin_session, form_fill) |
| Real-time | ✅ Yes (chat streaming) |
| Offline Support | ❌ No (requer conexão) |
| RAG Backend | Dify self-hosted |
| Knowledge Base | 604 KB (14 YAMLs) |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ORCH ADMIN                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐                                                         │
│  │   FloatingChat  │  React component with ORCH tab                         │
│  │   (Frontend)    │                                                         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           │ REST API                                                         │
│           ▼                                                                  │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      │
│  │  Cogedu API     │─────▶│     Dify        │─────▶│  Knowledge Base │      │
│  │  /orch-admin/*  │      │  (RAG Engine)   │      │   (14 YAMLs)    │      │
│  │  (7 endpoints)  │      │  + pgvector     │      │   604 KB        │      │
│  └────────┬────────┘      └─────────────────┘      └─────────────────┘      │
│           │                                                                  │
│           │ SQL                                                              │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │   PostgreSQL    │  6 tables (orch_admin_*)                               │
│  │   (Database)    │                                                         │
│  └─────────────────┘                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User types message
       │
       ▼
FloatingChat.tsx ──▶ OrchAdminContext.tsx ──▶ POST /orch-admin/chat
                                                      │
                                                      ▼
                                              Cogedu API endpoint
                                                      │
                                                      ▼
                                              Dify RAG API
                                                      │
                                                      ▼
                                              Knowledge Base search
                                                      │
                                                      ▼
                                              LLM generates response
                                                      │
                                                      ▼
                                              Response + metadata
                                                      │
                                                      ▼
                                              Save to orch_admin_session
                                                      │
                                                      ▼
                                              Return to frontend
```

### Components Location

| Component | Location | Description |
|-----------|----------|-------------|
| Frontend Chat | `apps/web/src/components/FloatingChat.tsx` | UI com abas Chat \| ORCH |
| Frontend Context | `apps/web/src/contexts/OrchAdminContext.tsx` | Estado e API calls |
| Backend Endpoints | `apps/api/src/endpoints/orchAdmin*/` | 7 endpoints REST |
| Types | `libs/ava-api-types/src/orch-admin.ts` | Request/Response types |
| DB Types | `libs/ava-database-types/src/orch-admin.ts` | Table types |
| Migrations | `libs/migrations/1820000002--orch_admin_tables.sql` | 6 tables |

---

## API Reference

### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/orch-admin/sessions` | Inicia nova sessão de chat | ✅ |
| POST | `/orch-admin/chat` | Envia mensagem e recebe resposta | ✅ |
| POST | `/orch-admin/sessions/:id/end` | Encerra sessão ativa | ✅ |
| GET | `/orch-admin/alerts` | Lista alertas proativos do usuário | ✅ |
| POST | `/orch-admin/alerts/:id/read` | Marca alerta como lido | ✅ |
| POST | `/orch-admin/feedback` | Envia feedback do usuário | ✅ |
| GET | `/orch-admin/context/*` | Retorna contexto da página atual | ✅ |

### Request/Response Examples

#### POST /orch-admin/sessions

Inicia uma nova sessão de chat com o ORCH.

**Request:**
```bash
curl -X POST "https://api.cogedu.com/orch-admin/sessions" \
  -H "Authorization: Bearer {{token}}" \
  -H "Content-Type: application/json" \
  -d '{
    "initialPage": "/admission"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "resumed": false,
    "greeting": "Olá! Vejo que você está na página de Admissão. Como posso ajudar?"
  }
}
```

#### POST /orch-admin/chat

Envia uma mensagem e recebe resposta do assistente.

**Request:**
```bash
curl -X POST "https://api.cogedu.com/orch-admin/chat" \
  -H "Authorization: Bearer {{token}}" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Como criar uma nova oferta de curso?",
    "pageContext": "/admission/offers"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Para criar uma nova oferta de curso, siga estes passos:\n\n1. Clique no botão **+ Nova Oferta** no canto superior direito\n2. Preencha o nome da oferta\n3. Selecione o curso base\n4. Configure as datas de inscrição\n5. Clique em **Salvar**\n\nQuer que eu te guie campo por campo?",
    "metadata": {
      "confidence": 0.95,
      "sources": ["cogedu-admission-fields.yaml"],
      "suggestedActions": ["show_field_guide", "fill_form"]
    }
  }
}
```

#### GET /orch-admin/alerts

Lista alertas proativos não lidos do usuário.

**Request:**
```bash
curl -X GET "https://api.cogedu.com/orch-admin/alerts" \
  -H "Authorization: Bearer {{token}}"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-123",
        "type": "student_risk",
        "severity": "high",
        "title": "3 alunos com risco de evasão",
        "content": "Os alunos João, Maria e Pedro não acessam há 14 dias.",
        "entityType": "student",
        "entityIds": ["uuid1", "uuid2", "uuid3"],
        "deliveredAt": "2026-02-07T10:00:00Z",
        "readAt": null
      }
    ],
    "unreadCount": 1
  }
}
```

#### POST /orch-admin/feedback

Envia feedback sobre a experiência com o ORCH.

**Request:**
```bash
curl -X POST "https://api.cogedu.com/orch-admin/feedback" \
  -H "Authorization: Bearer {{token}}" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "feedbackType": "feature",
    "content": "Seria útil ter atalhos para as ações mais comuns",
    "pageContext": "/admission/offers"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feedbackId": "feedback-456",
    "status": "new",
    "message": "Obrigado pelo feedback! Sua sugestão foi registrada."
  }
}
```

---

## Database Schema

### Tables Overview

| Table | Description | Records (est.) |
|-------|-------------|----------------|
| `orch_admin_session` | Sessões de chat | ~1000/mês |
| `orch_admin_feedback` | Feedback de usuários | ~100/mês |
| `orch_admin_faq` | FAQ auto-gerado | ~500 |
| `orch_admin_form_fill` | Audit de preenchimento | ~200/mês |
| `orch_admin_alert` | Alertas proativos | ~50/dia |
| `orch_admin_metric` | Métricas diárias | 1/dia/company |

### Table: `orch_admin_session`

Sessões de interação com o ORCH Admin.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | No | Primary key |
| tenant_id | UUID | No | Tenant isolation |
| company_id | UUID | No | Instituição |
| user_id | UUID | No | Usuário |
| initial_page | VARCHAR(500) | Yes | Página inicial |
| pages_visited | TEXT[] | No | Array de páginas visitadas |
| commands_used | TEXT[] | No | Comandos usados |
| started_at | TIMESTAMPTZ | No | Início da sessão |
| ended_at | TIMESTAMPTZ | Yes | Fim da sessão |
| last_activity_at | TIMESTAMPTZ | No | Última atividade |
| messages_count | INTEGER | No | Total de mensagens |
| sentiment_score | DECIMAL(3,2) | Yes | Score de sentimento (-1 a 1) |
| resolution_status | VARCHAR(20) | No | open, resolved, escalated, abandoned |
| metadata | JSONB | No | Dados extras |
| created_at | TIMESTAMPTZ | No | Criação |
| updated_at | TIMESTAMPTZ | No | Atualização |

### Table: `orch_admin_feedback`

Feedback coletado dos usuários.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | No | Primary key |
| tenant_id | UUID | No | Tenant isolation |
| company_id | UUID | No | Instituição |
| user_id | UUID | No | Usuário |
| session_id | UUID | Yes | Sessão relacionada |
| feedback_type | VARCHAR(20) | No | feature, bug, adjustment, ux, praise, complaint, question |
| page_context | VARCHAR(500) | Yes | Página onde foi dado |
| content | TEXT | No | Conteúdo do feedback |
| user_verbatim | TEXT | Yes | Palavras exatas do usuário |
| sentiment | VARCHAR(20) | Yes | positive, neutral, negative, frustrated |
| priority | INTEGER | No | 1 (urgente) a 5 (baixo) |
| status | VARCHAR(20) | No | new, reviewed, planned, done, wontfix |
| created_at | TIMESTAMPTZ | No | Criação |

### Table: `orch_admin_alert`

Alertas proativos enviados aos usuários.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | No | Primary key |
| tenant_id | UUID | No | Tenant isolation |
| company_id | UUID | No | Instituição |
| user_id | UUID | No | Usuário destinatário |
| alert_type | VARCHAR(50) | No | student_risk, deadline, class_issue, system, admission |
| severity | VARCHAR(20) | No | low, medium, high, critical |
| title | VARCHAR(255) | No | Título do alerta |
| content | TEXT | No | Conteúdo |
| entity_type | VARCHAR(50) | Yes | student, class, admission, enrollment |
| entity_id | UUID | Yes | ID da entidade relacionada |
| delivery_method | VARCHAR(30) | No | session_start, inline, badge, push |
| delivered_at | TIMESTAMPTZ | No | Quando foi entregue |
| read_at | TIMESTAMPTZ | Yes | Quando foi lido |
| action_taken | VARCHAR(50) | Yes | dismissed, clicked, resolved, snoozed |

### Indexes

| Index | Table | Columns | Type |
|-------|-------|---------|------|
| `idx_admin_session_tenant` | orch_admin_session | tenant_id | btree |
| `idx_admin_session_user` | orch_admin_session | user_id | btree |
| `idx_admin_session_active` | orch_admin_session | user_id WHERE ended_at IS NULL | partial |
| `idx_admin_feedback_type` | orch_admin_feedback | feedback_type | btree |
| `idx_admin_feedback_status` | orch_admin_feedback | status | btree |
| `idx_admin_alert_unread` | orch_admin_alert | user_id, severity WHERE read_at IS NULL | partial |

### Entity Relationship

```
orch_admin_session
       │
       ├──── orch_admin_feedback (session_id FK)
       │
       └──── orch_admin_form_fill (session_id FK)

company (tenant)
       │
       ├──── orch_admin_session
       ├──── orch_admin_feedback
       ├──── orch_admin_faq
       ├──── orch_admin_alert
       └──── orch_admin_metric
```

---

## Frontend Components

### Component Tree

```
FloatingChat
├── ChatTab (existing)
└── OrchTab (NEW)
    ├── OrchHeader
    │   ├── OrchAvatar
    │   └── OrchStatus
    ├── OrchMessages
    │   ├── OrchMessage (bot)
    │   │   ├── MessageContent
    │   │   └── SuggestedActions
    │   └── OrchMessage (user)
    ├── OrchInput
    │   ├── TextInput
    │   └── SendButton
    └── OrchAlertBadge
```

### Context API

```tsx
// OrchAdminContext.tsx

interface OrchAdminContextValue {
  // State
  session: OrchSession | null;
  messages: OrchMessage[];
  alerts: OrchAlert[];
  isLoading: boolean;

  // Actions
  startSession: (initialPage: string) => Promise<void>;
  sendMessage: (message: string, pageContext: string) => Promise<void>;
  endSession: () => Promise<void>;
  markAlertRead: (alertId: string) => Promise<void>;
  sendFeedback: (feedback: FeedbackInput) => Promise<void>;
}
```

### Usage Example

```tsx
import { useOrchAdmin } from '@/contexts/OrchAdminContext';

function OrchTab() {
  const {
    messages,
    sendMessage,
    isLoading,
    alerts
  } = useOrchAdmin();

  const [input, setInput] = useState('');
  const pageContext = useLocation().pathname;

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input, pageContext);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Alert badge */}
      {alerts.length > 0 && (
        <OrchAlertBadge count={alerts.length} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <OrchMessage key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua dúvida..."
            className="flex-1 rounded-lg border px-4 py-2"
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="bg-primary text-white px-4 py-2 rounded-lg"
          >
            {isLoading ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Integration Guide

### Prerequisites

Before starting integration, ensure you have:

- [ ] Cogedu Admin repository cloned (`cogedu-main`)
- [ ] PostgreSQL database running
- [ ] Node.js 18+ installed
- [ ] Docker installed (for Dify)
- [ ] Access to orchestra-data GitHub

### Step 1: Clone Feature Repository

```bash
# Clone the orch-admin feature
git clone https://github.com/orchestra-data/cogedu-feature-orch-admin.git
cd cogedu-feature-orch-admin
```

### Step 2: Run Database Migrations

```bash
# Copy migration to Cogedu
cp migrations/1820000002--orch_admin_tables.sql \
   ../cogedu-main/libs/migrations/

# Run migrations
cd ../cogedu-main
npm run migrate

# Verify tables created
psql $DATABASE_URL -c "\dt orch_admin_*"
```

**Expected output:**
```
              List of relations
 Schema |         Name          | Type
--------+-----------------------+-------
 public | orch_admin_alert      | table
 public | orch_admin_faq        | table
 public | orch_admin_feedback   | table
 public | orch_admin_form_fill  | table
 public | orch_admin_metric     | table
 public | orch_admin_session    | table
```

### Step 3: Setup Dify RAG Backend

```bash
# Go to dify folder
cd ../cogedu-feature-orch-admin/dify

# Copy environment file
cp .env.example .env

# Edit .env with your settings
# DIFY_API_KEY=your-key-here

# Start Dify with Docker
docker compose up -d

# Wait for Dify to be ready (2-3 minutes)
curl http://localhost:3001/health

# Upload knowledge base
DIFY_API_KEY=your-key npx ts-node setup-knowledge-base.ts
```

### Step 4: Create Backend Endpoints

Create the following files in `cogedu-main/apps/api/src/endpoints/`:

```bash
# Create endpoint folder
mkdir -p ../cogedu-main/apps/api/src/endpoints/orchAdmin

# You need to create these endpoints:
# - orchAdminCreateSession/
# - orchAdminChat/
# - orchAdminEndSession/
# - orchAdminGetAlerts/
# - orchAdminMarkAlertRead/
# - orchAdminSendFeedback/
# - orchAdminGetContext/
```

**Endpoint template (orchAdminChat/index.ts):**

```typescript
/**
 * @author Steven Phil <steven.phil@indigohive.com.br>
 * @feature orch-admin
 * @squad Cogedu Orchestra
 */

import { z } from 'zod';
import { createEndpoint } from '../../lib/endpoint';

const inputSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
  pageContext: z.string().optional(),
});

export default createEndpoint({
  method: 'POST',
  path: '/orch-admin/chat',
  auth: 'required',
  input: inputSchema,
  handler: async ({ input, ctx }) => {
    const { sessionId, message, pageContext } = input;

    // 1. Validate session belongs to user
    // 2. Call Dify API with message + context
    // 3. Save to orch_admin_session
    // 4. Return response

    return {
      success: true,
      data: {
        message: 'Response from Dify...',
        metadata: {},
      },
    };
  },
});
```

### Step 5: Add API Types

```bash
# Create types file
cat > ../cogedu-main/libs/ava-api-types/src/orch-admin.ts << 'EOF'
/**
 * @author Steven Phil <steven.phil@indigohive.com.br>
 * @feature orch-admin
 */

export interface OrchSession {
  id: string;
  userId: string;
  initialPage: string | null;
  startedAt: string;
  endedAt: string | null;
  messagesCount: number;
}

export interface OrchMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface OrchAlert {
  id: string;
  type: 'student_risk' | 'deadline' | 'class_issue' | 'system' | 'admission';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  content: string;
  deliveredAt: string;
  readAt: string | null;
}

export interface CreateSessionInput {
  initialPage?: string;
}

export interface ChatInput {
  sessionId: string;
  message: string;
  pageContext?: string;
}

export interface FeedbackInput {
  sessionId?: string;
  feedbackType: 'feature' | 'bug' | 'adjustment' | 'ux' | 'praise' | 'complaint' | 'question';
  content: string;
  pageContext?: string;
}
EOF

# Add to index
echo "export * from './orch-admin';" >> ../cogedu-main/libs/ava-api-types/src/index.ts
```

### Step 6: Add Frontend Components

```bash
# Create context
cat > ../cogedu-main/apps/web/src/contexts/OrchAdminContext.tsx << 'EOF'
// See component code in Frontend Components section above
EOF

# Add provider to app.tsx
# In apps/web/src/app.tsx, wrap with OrchAdminProvider:

# <OrchAdminProvider>
#   <App />
# </OrchAdminProvider>
```

### Step 7: Modify FloatingChat

```tsx
// In apps/web/src/components/FloatingChat.tsx

// Add ORCH tab next to existing Chat tab
<Tabs defaultValue="chat">
  <TabsList>
    <TabsTrigger value="chat">Chat</TabsTrigger>
    <TabsTrigger value="orch">
      ORCH
      {alerts.length > 0 && (
        <Badge variant="destructive" className="ml-1">
          {alerts.length}
        </Badge>
      )}
    </TabsTrigger>
  </TabsList>

  <TabsContent value="chat">
    {/* Existing chat content */}
  </TabsContent>

  <TabsContent value="orch">
    <OrchTab />
  </TabsContent>
</Tabs>
```

### Step 8: Add Environment Variables

```bash
# Add to .env
DIFY_API_URL=http://localhost:3001/v1
DIFY_ORCH_ADMIN_API_KEY=app-xxx
```

### Step 9: Verify Integration

```bash
# Start backend
cd apps/api && npm run dev

# Start frontend
cd apps/web && npm run dev

# Test endpoint
curl -X POST http://localhost:3001/orch-admin/sessions \
  -H "Authorization: Bearer $(npm run get-test-token)" \
  -H "Content-Type: application/json" \
  -d '{"initialPage": "/admission"}'

# Open browser
open http://localhost:3000
# Click on FloatingChat > ORCH tab
```

---

## Testing

### Unit Tests

```bash
# Run unit tests for orch-admin
npm run test:unit -- --filter=orchAdmin
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration -- --filter=orch-admin
```

### Manual Testing Checklist

- [ ] Start new ORCH session
- [ ] Send message and receive response
- [ ] Verify context detection (page changes)
- [ ] End session
- [ ] View alerts
- [ ] Mark alert as read
- [ ] Send feedback
- [ ] Verify multi-tenant isolation (different companies)
- [ ] Test error handling (Dify down)
- [ ] Check mobile responsiveness

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DIFY_API_URL` | Yes | - | URL do Dify API |
| `DIFY_ORCH_ADMIN_API_KEY` | Yes | - | API key do app Dify |
| `ORCH_ADMIN_ENABLED` | No | true | Feature flag |
| `ORCH_ADMIN_MAX_MESSAGES` | No | 50 | Max messages per session |

### Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `orch_admin_enabled` | true | Habilita/desabilita ORCH |
| `orch_admin_alerts` | true | Habilita alertas proativos |
| `orch_admin_form_fill` | false | Habilita preenchimento de forms |

---

## Permissions

### Required Roles

| Action | Required Role | Notes |
|--------|---------------|-------|
| Use ORCH | Any authenticated user | Qualquer funcionário |
| View alerts | Any authenticated user | Apenas seus próprios alertas |
| Send feedback | Any authenticated user | - |
| View metrics | Admin | Dashboard de métricas |

### Permission Matrix

| Role | Use ORCH | View Alerts | Send Feedback | View Metrics |
|------|----------|-------------|---------------|--------------|
| Admin | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ❌ |
| Employee | ✅ | ✅ | ✅ | ❌ |

---

## Error Handling

### Error Codes

| Code | HTTP Status | Message | Resolution |
|------|-------------|---------|------------|
| `ORCH_SESSION_NOT_FOUND` | 404 | Sessão não encontrada | Iniciar nova sessão |
| `ORCH_SESSION_EXPIRED` | 410 | Sessão expirada | Iniciar nova sessão |
| `ORCH_DIFY_UNAVAILABLE` | 503 | Serviço de IA indisponível | Aguardar ou reportar |
| `ORCH_RATE_LIMIT` | 429 | Muitas mensagens | Aguardar 1 minuto |
| `ORCH_MESSAGE_TOO_LONG` | 400 | Mensagem muito longa | Reduzir para < 2000 chars |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ORCH_SESSION_NOT_FOUND",
    "message": "Sessão não encontrada. Por favor, inicie uma nova sessão.",
    "details": {
      "sessionId": "invalid-uuid"
    }
  }
}
```

---

## Knowledge Base

### Files Included (604 KB)

| File | Size | Description |
|------|------|-------------|
| cogedu-pages-guide.yaml | 46 KB | Índice de todas as páginas |
| cogedu-admission-fields.yaml | 62 KB | Módulo admissão |
| cogedu-educational-fields.yaml | 117 KB | Módulo educacional |
| cogedu-exams-fields.yaml | 89 KB | Módulo avaliações |
| cogedu-users-fields.yaml | 69 KB | Módulo usuários |
| cogedu-data-schema.yaml | 21 KB | Schema do banco |
| cogedu-workflows.yaml | 37 KB | Workflows passo-a-passo |
| cogedu-ava-*.yaml | 93 KB | AVA frontend docs |
| orch-memory-schema.yaml | 15 KB | Schema da memória |
| orch-proactive-alerts.yaml | 12 KB | Regras de alertas |
| zodiac-personas.yaml | 27 KB | 12 perfis comportamentais |

### Updating Knowledge Base

```bash
# After modifying YAMLs, re-upload to Dify
cd dify
DIFY_API_KEY=your-key npx ts-node setup-knowledge-base.ts
```

---

## Changelog

### [1.0.0] - 2026-02-07

#### Added
- Initial release (pre-squad adoption)
- Contextual chat with RAG
- 7 REST endpoints
- 6 database tables
- 604 KB knowledge base
- Proactive alerts system
- Feedback collection
- Auto-update scanner

---

## Support

For questions or issues:
- **Squad:** Cogedu Orchestra
- **Author:** Steven Phil <steven.phil@indigohive.com.br>
- **Repository:** https://github.com/orchestra-data/cogedu-feature-orch-admin

---

**Created by Squad Cogedu Orchestra**
