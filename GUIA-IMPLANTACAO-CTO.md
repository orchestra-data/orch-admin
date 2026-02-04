# Guia de Implantacao do Orch Admin - Para o CTO

**Versao do Orch:** 3.7.0
**Data:** 2026-02-03
**Repositorio:** https://github.com/orchestra-data/orch-admin.git

---

## Indice

1. [Visao Geral Executiva](#1-visao-geral-executiva)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Inventario Completo de Arquivos](#3-inventario-completo-de-arquivos)
4. [Pre-Requisitos de Infraestrutura](#4-pre-requisitos-de-infraestrutura)
5. [FASE 1: Preparar Backend (RAG + API)](#5-fase-1-preparar-backend-rag--api)
6. [FASE 2: Indexar Knowledge Base no RAG](#6-fase-2-indexar-knowledge-base-no-rag)
7. [FASE 3: Integrar Widget no Frontend Cogedu](#7-fase-3-integrar-widget-no-frontend-cogedu)
8. [FASE 4: Implementar o Bridge (DOM Communication)](#8-fase-4-implementar-o-bridge-dom-communication)
9. [FASE 5: Implementar Sistema de Memoria](#9-fase-5-implementar-sistema-de-memoria)
10. [FASE 6: Implementar Adaptacao Comportamental](#10-fase-6-implementar-adaptacao-comportamental)
11. [FASE 7: Implementar Alertas Proativos](#11-fase-7-implementar-alertas-proativos)
12. [FASE 8: Implementar Feedback e Analytics](#12-fase-8-implementar-feedback-e-analytics)
13. [FASE 9: Configurar Auto-Update (CI/CD)](#13-fase-9-configurar-auto-update-cicd)
14. [FASE 10: Testes e Validacao](#14-fase-10-testes-e-validacao)
15. [FASE 11: Deploy e Go-Live](#15-fase-11-deploy-e-go-live)
16. [Mapa de Decisoes Tecnicas](#16-mapa-de-decisoes-tecnicas)
17. [Riscos e Mitigacoes](#17-riscos-e-mitigacoes)
18. [Metricas de Sucesso](#18-metricas-de-sucesso)
19. [Roadmap de Evolucao](#19-roadmap-de-evolucao)

---

## 1. Visao Geral Executiva

### O que e o Orch?

O Orch e um **assistente inteligente embarcado** no sistema de gestao Cogedu. Ele funciona como um widget de chat (bottom-right) que:

1. **Explica paginas contextualmente** - detecta a URL atual e explica campos, botoes e fluxos
2. **Preenche formularios** - preenche campos no DOM com confirmacao do usuario
3. **Guia workflows** - mostra passo-a-passo para qualquer tarefa (25+ workflows)
4. **Coleta feedback** - detecta sentimentos e coleta sugestoes estruturadas
5. **Consulta dados** - busca informacoes de alunos, turmas, processos (com permissao)
6. **Lembra de tudo** - memoria persistente entre sessoes (logs de conversa)
7. **Adapta personalidade** - ajusta tom e estrategia ao perfil do usuario
8. **Envia alertas proativos** - notifica sobre situacoes criticas antes que perguntem
9. **Monitora a si mesmo** - gera metricas de uso e taxa de resolucao
10. **Autoatualiza** - detecta mudancas no codigo do Cogedu e atualiza seu knowledge base

### Para quem?

| Plataforma | Publico | Escopo do Orch |
|------------|---------|----------------|
| **Cogedu Admin** (Orchestra) | Gestores, coordenadores, professores | 62 rotas, 45+ paginas, 8 modulos documentados |
| **Cogedu AVA** | Alunos | 25+ paginas, 179 endpoints, 28+ content players |

### Stack Tecnico do Orch

| Camada | Tecnologia | Funcao |
|--------|-----------|--------|
| Frontend (Widget) | React 19 + TypeScript | Chat embarcado no CommunicationHub |
| Comunicacao | postMessage API | Bridge entre widget e DOM da pagina |
| Backend | LLM API (GPT-4o-mini / Dify) | Processamento de linguagem natural |
| RAG | Dify / LangChain / Custom | Busca semantica no knowledge base |
| Knowledge Base | 14 arquivos YAML (604 KB) | Documentacao de paginas, campos, workflows |
| Memoria | File system / Database | Logs de conversa persistentes |
| CI/CD | GitHub Actions | Auto-update do knowledge base |

---

## 2. Arquitetura do Sistema

### Diagrama de Componentes

```
+-------------------------------------------------------------------+
|                        BROWSER DO USUARIO                          |
|                                                                    |
|  +-------------------+       postMessage        +---------------+  |
|  |   Cogedu React    | <=====================> |  Orch Widget  |  |
|  |   (pagina atual)  |    orch-bridge.js        |  (chat panel) |  |
|  |                    | ----------------------> |               |  |
|  |  - router.tsx      |    FILL_FIELD           |  - input box  |  |
|  |  - forms           |    READ_FIELDS          |  - messages   |  |
|  |  - modals          |    PAGE_CHANGED          |  - suggested  |  |
|  +-------------------+                          +-------+-------+  |
|                                                         |          |
+-------------------------------------------------------------------+
                                                          |
                                                     HTTP/WSS
                                                          |
+-------------------------------------------------------------------+
|                        BACKEND (API)                               |
|                                                                    |
|  +------------------+    +------------------+   +---------------+  |
|  |  Orch API        |    |  RAG Engine      |   |  LLM Provider |  |
|  |  (Node.js)       |--->|  (Dify/Custom)   |-->|  (GPT-4o-mini)|  |
|  |                  |    |                  |   |  fallback:    |  |
|  |  - /chat         |    |  - search YAML   |   |  GPT-4o       |  |
|  |  - /memory       |    |  - top_k: 5      |   |               |  |
|  |  - /feedback     |    |  - threshold: 0.7 |   +---------------+  |
|  |  - /alerts       |    +------------------+                      |
|  |  - /analytics    |                                              |
|  +------------------+    +------------------+                      |
|                          |  Knowledge Base  |                      |
|  +------------------+    |  (14 YAMLs)      |                      |
|  |  Database        |    |  604 KB          |                      |
|  |  (Postgres/Mongo)|    +------------------+                      |
|  |                  |                                              |
|  |  - conversations |    +------------------+                      |
|  |  - user_memory   |    |  GitHub Actions  |                      |
|  |  - feedback      |    |  (orch-update)   |                      |
|  |  - analytics     |    |  auto-update     |                      |
|  +------------------+    +------------------+                      |
+-------------------------------------------------------------------+
```

### Fluxo de uma Interacao

```
1. Usuario abre pagina "/educational/admission/new"
2. orch-bridge.js detecta mudanca de URL
3. Widget envia PAGE_CHANGED para backend
4. Backend identifica modulo "admission" e pagina "create"
5. RAG busca documentacao em cogedu-admission-fields.yaml
6. Backend carrega memoria do usuario (ultimos 30 dias)
7. Backend carrega perfil zodiacal (se disponivel)
8. LLM gera saudacao contextual adaptada
9. Widget exibe: "Oi! Voce esta criando um Processo Seletivo..."
10. Usuario pergunta "quais campos sao obrigatorios?"
11. RAG retorna campos com required: true
12. LLM formata resposta e apresenta lista
13. Conversa e salva no log persistente
14. Analytics registra interacao
```

---

## 3. Inventario Completo de Arquivos

### Estrutura do Repositorio

```
ORCH ADMIN/                          # 1.7 MB total
├── README.md                        # Visao geral do projeto
├── genesis-validate-corrections.md  # Historico de correcoes
├── GUIA-IMPLANTACAO-CTO.md          # ESTE DOCUMENTO
│
├── agent/                           # Definicao do agente
│   └── page-guide.md               # 112 KB - Agente UAF completo (v3.7.0)
│
├── knowledge-base/                  # 604 KB - Base de conhecimento RAG
│   ├── cogedu-pages-guide.yaml      # Indice de paginas do admin
│   ├── cogedu-admission-fields.yaml # Modulo admissao (61 KB)
│   ├── cogedu-educational-fields.yaml # Modulo educacional (115 KB)
│   ├── cogedu-exams-fields.yaml     # Modulo avaliacoes (87 KB)
│   ├── cogedu-users-fields.yaml     # Modulo usuarios (68 KB)
│   ├── cogedu-data-schema.yaml      # Schema do banco (21 KB)
│   ├── cogedu-workflows.yaml        # Workflows passo-a-passo (36 KB)
│   ├── cogedu-ava-architecture.yaml # AVA: stack tecnico (18 KB)
│   ├── cogedu-ava-pages-routes.yaml # AVA: rotas e paginas (15 KB)
│   ├── cogedu-ava-api-endpoints.yaml # AVA: 179 endpoints (31 KB)
│   ├── cogedu-ava-data-schema.yaml  # AVA: schema de dados (29 KB)
│   ├── orch-memory-schema.yaml      # Schema da memoria (15 KB)
│   ├── orch-proactive-alerts.yaml   # Regras de alertas (12 KB)
│   └── zodiac-personas.yaml         # 12 perfis comportamentais (26 KB)
│
├── auto-update/                     # 200 KB - Sistema de autoatualizacao
│   ├── orch-scanner.ts              # Parser AST do codigo (35 KB)
│   ├── orch-bridge.js               # Bridge DOM runtime (18 KB)
│   ├── orch-conversation-logger.ts  # Logger de conversas (26 KB)
│   ├── orch-data-query.ts           # Consulta de dados (40 KB)
│   ├── orch-feedback.ts             # Coleta de feedback (20 KB)
│   ├── orch-zodiac-engine.ts        # Engine zodiacal (25 KB)
│   ├── orch-analytics-engine.ts     # Engine de analytics (35 KB)
│   ├── orch-update.yml              # GitHub Actions workflow
│   └── README.md                    # Documentacao do sistema
│
└── feedback/                        # 20 KB - Banco de feedback
    ├── faq-bank.yaml                # Perguntas frequentes
    ├── improvements-bank.yaml       # Sugestoes e bugs reportados
    └── README.md                    # Documentacao do feedback
```

---

## 4. Pre-Requisitos de Infraestrutura

### Obrigatorios (sem estes, nao funciona)

| Requisito | Detalhes | Status |
|-----------|----------|--------|
| **Cogedu Admin rodando** | React 19 + Vite + React Router v7 | Ja existe |
| **CommunicationHub** | `apps/web/src/components/communication-hub/` | Ja existe |
| **Keycloak** | Autenticacao SSO com JWT multi-tenant | Ja existe |
| **LLM API** | GPT-4o-mini (primario) + GPT-4o (fallback) | Contratar |
| **RAG Engine** | Dify, LangChain, ou API custom com embedding | Escolher |
| **Banco de dados** | PostgreSQL ou MongoDB (para logs e memoria) | Provisionar |

### Opcionais (funcionalidades avancadas)

| Requisito | Para que serve | Prioridade |
|-----------|---------------|------------|
| **GitHub Actions** | Auto-update do knowledge base | Alta |
| **campo birth_date no perfil** | Engine zodiacal de adaptacao | Media |
| **WebSocket/SSE** | Alertas proativos em tempo real | Media |
| **S3 ou similar** | Armazenamento de logs em longo prazo | Baixa |

---

## 5. FASE 1: Preparar Backend (RAG + API)

### Passo 1.1: Escolher plataforma RAG

| Opcao | Pros | Contras | Recomendacao |
|-------|------|---------|-------------|
| **Dify** (SaaS/Self-hosted) | Setup rapido, UI de admin, RAG built-in | Vendor lock-in, custo | Para comecar rapido |
| **LangChain + Chroma** | Flexivel, open source | Requer dev backend | Para controle total |
| **API Custom + pgvector** | Sem dependencias extras | Mais trabalho | Se ja tem Postgres |

**Decisao necessaria do CTO:** Qual plataforma RAG usar?

### Passo 1.2: Provisionar LLM

```yaml
# Configuracao definida no page-guide.md
model:
  provider: "openai"
  name: "gpt-4o-mini"      # Primario: mais rapido e barato
  temperature: 0.3          # Respostas consistentes
  max_tokens: 1024
  fallback: "gpt-4o"        # Fallback: mais inteligente
```

**Acoes:**
1. Criar conta OpenAI (ou usar Azure OpenAI para compliance)
2. Gerar API key
3. Estimar custo: ~$0.15/1M input tokens (gpt-4o-mini)
4. Configurar rate limits e budget alerts

### Passo 1.3: Criar API Backend do Orch

Endpoints necessarios:

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `POST /orch/chat` | POST | Envia mensagem e recebe resposta |
| `POST /orch/context` | POST | Recebe URL e retorna contexto da pagina |
| `GET /orch/memory/:userId` | GET | Carrega memoria do usuario |
| `POST /orch/memory` | POST | Salva log de conversa |
| `POST /orch/feedback` | POST | Registra feedback do usuario |
| `GET /orch/alerts/:userId` | GET | Retorna alertas pendentes |
| `POST /orch/analytics/event` | POST | Registra evento de analytics |
| `GET /orch/analytics/report` | GET | Relatorio de uso |

**Fluxo do POST /orch/chat:**

```
1. Recebe: { message, userId, pageUrl, conversationId }
2. Identifica modulo/pagina pela URL
3. Busca no RAG (top_k: 5, threshold: 0.7)
4. Carrega memoria do usuario (ultimos 30 dias)
5. Carrega perfil zodiacal (se disponivel)
6. Monta prompt com: system_prompt + page_context + memory + user_message
7. Envia para LLM
8. Salva resposta no log
9. Retorna: { response, suggestedQuestions, alerts }
```

### Passo 1.4: System Prompt

O system prompt completo esta em `agent/page-guide.md`. Os elementos essenciais:

```
Voce e o Orch, guia contextual do sistema Cogedu.
Regras:
- Use linguagem simples e acessivel
- Nunca assume que o usuario sabe termos tecnicos
- Confirma dados antes de preencher campos
- Nunca expoe dados sensiveis (PII) sem permissao
- Responda em portugues BR
- Mantenha respostas entre 80-500 caracteres
- Use listas e marcadores para facilitar leitura

Contexto da pagina: {page_documentation}
Memoria do usuario: {user_memory}
Perfil comportamental: {zodiac_directive}
```

---

## 6. FASE 2: Indexar Knowledge Base no RAG

### Passo 2.1: Preparar os 14 arquivos YAML

Todos os arquivos estao prontos em `knowledge-base/`. Cada um precisa ser:

1. Parseado (YAML -> JSON/objetos)
2. Dividido em chunks semanticos
3. Embedado (text-embedding-3-small ou similar)
4. Indexado com metadados para filtragem

### Passo 2.2: Estrategia de chunking

```yaml
chunking_strategy:
  # Cada pagina/rota e um chunk
  # Metadados: modulo, url_pattern, route_component

  admin_fields:
    source: "cogedu-*-fields.yaml"
    chunk_by: "page"  # Cada page entry e um chunk
    metadata:
      - modulo
      - url_pattern
      - route_component
    include_fields: true  # Campos da pagina no chunk
    include_modals: true  # Modais da pagina
    include_actions: true # Acoes disponiveis

  ava_files:
    source: "cogedu-ava-*.yaml"
    chunk_by: "section" # Cada secao do YAML e um chunk
    metadata:
      - system: "ava"
      - category  # routes, api, schema, architecture

  workflows:
    source: "cogedu-workflows.yaml"
    chunk_by: "workflow"  # Cada workflow e um chunk
    metadata:
      - category
      - keywords

  alerts:
    source: "orch-proactive-alerts.yaml"
    chunk_by: "rule"  # Cada regra de alerta e um chunk

  zodiac:
    source: "zodiac-personas.yaml"
    chunk_by: "sign"  # Cada signo e um chunk
    note: "NAO indexar para busca geral - carregar sob demanda"
```

### Passo 2.3: Indexacao por plataforma

**Se Dify:**
1. Criar Knowledge Base no painel admin
2. Upload dos 14 YAML files
3. Configurar chunking: "Paragraph" com separador de `- name:`
4. Embedding model: text-embedding-3-small
5. Retrieval: Hybrid (keyword + semantic)
6. Top-k: 5, Score threshold: 0.7

**Se LangChain + Chroma:**
```python
# Pseudo-codigo de indexacao
from langchain.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import Chroma
from langchain.embeddings import OpenAIEmbeddings

# Para cada YAML file
for yaml_file in knowledge_base_files:
    docs = load_and_parse_yaml(yaml_file)
    chunks = split_by_page_entry(docs)
    add_metadata(chunks, module, url_pattern)
    vectorstore.add_documents(chunks)
```

**Se pgvector:**
```sql
CREATE TABLE orch_knowledge (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL,  -- {module, url, component, system}
    embedding VECTOR(1536),   -- text-embedding-3-small
    source_file TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON orch_knowledge USING ivfflat (embedding vector_cosine_ops);
```

### Passo 2.4: Validar indexacao

Testar com queries representativas:

| Query | Resultado esperado |
|-------|-------------------|
| "como criar processo seletivo" | cogedu-admission-fields.yaml -> AdmissionCreateRoute |
| "campos obrigatorios do aluno" | cogedu-users-fields.yaml -> StudentCreateRoute |
| "o que e uma colecao" | cogedu-educational-fields.yaml -> CollectionListRoute |
| "como funciona o player de video" | cogedu-ava-architecture.yaml -> content_players |
| "quais endpoints de comunidade" | cogedu-ava-api-endpoints.yaml -> community |

---

## 7. FASE 3: Integrar Widget no Frontend Cogedu

### Passo 3.1: Componente do Widget

O widget deve ser integrado no CommunicationHub existente:

**Arquivo alvo:** `apps/web/src/components/communication-hub/CommunicationHub.tsx`

```tsx
// Adicionar nova aba "Orch" ao CommunicationHub
// O CommunicationHub ja existe e tem tabs (Chat, Notificacoes, etc.)

import { OrchWidget } from './OrchWidget';

// Na lista de tabs do hub:
{
  id: 'orch',
  label: 'Ajuda',
  icon: HelpCircleIcon,
  component: OrchWidget,
}
```

### Passo 3.2: Criar componente OrchWidget

```tsx
// apps/web/src/components/communication-hub/OrchWidget.tsx

// Especificacoes do page-guide.md:
const WIDGET_CONFIG = {
  position: "bottom-right",
  appearance: {
    icon: "help-circle",
    label: "Precisa de ajuda?",
    color_primary: "#4F46E5",
    color_background: "#FFFFFF",
    border_radius: "12px",
    width: "380px",
    height: "520px",
  },
  behavior: {
    auto_open: false,
    auto_detect_page: true,
    send_url_on_open: true,
    persist_conversation: true,
    max_conversation_length: 50,
    typing_indicator: true,
  },
  suggested_questions: [
    "O que faz essa pagina?",
    "Quais campos sao obrigatorios?",
    "Me da um passo a passo",
    "Preenche pra mim",
    "Como eu faco para...?",
    "Quero sugerir uma melhoria",
  ],
};
```

### Passo 3.3: Comunicacao Widget <-> Backend

```tsx
// Hook para comunicacao com a API do Orch
function useOrchChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth(); // Keycloak
  const location = useLocation(); // React Router v7

  // Detectar mudanca de pagina
  useEffect(() => {
    sendPageContext(location.pathname);
  }, [location.pathname]);

  async function sendMessage(text: string) {
    setIsLoading(true);
    const response = await fetch('/orch/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`,
      },
      body: JSON.stringify({
        message: text,
        userId: user.id,
        pageUrl: location.pathname,
        conversationId: currentConversationId,
      }),
    });
    const data = await response.json();
    setMessages(prev => [...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: data.response }
    ]);
    setIsLoading(false);
  }

  return { messages, sendMessage, isLoading };
}
```

---

## 8. FASE 4: Implementar o Bridge (DOM Communication)

### Passo 4.1: O que e o Bridge

O `orch-bridge.js` e um script que roda na pagina do Cogedu e permite ao widget Orch:
- **Ler** campos do formulario atual (nomes, valores, opcoes de select)
- **Preencher** campos com valores fornecidos pelo usuario via chat
- **Detectar** mudancas de pagina (React Router)

### Passo 4.2: Protocolo de comunicacao

```
Widget (iframe/panel)  <--postMessage-->  Pagina (orch-bridge.js)

Canal: "orch-page-guide"

Eventos Widget -> Pagina:
  FILL_FIELD     { fieldName, value }       Preencher campo
  CLEAR_FIELD    { fieldName }              Limpar campo
  READ_FIELDS    {}                         Ler todos os campos
  GET_FIELD_OPTIONS  { fieldName }          Opcoes de select
  GET_FORM_STATE {}                         Estado do formulario

Eventos Pagina -> Widget:
  FIELDS_DATA    { fields: [...] }          Dados dos campos
  FILL_SUCCESS   { fieldName, value }       Sucesso
  FILL_ERROR     { fieldName, error }       Erro
  VALIDATION_ERROR { fieldName, message }   Validacao falhou
  PAGE_CHANGED   { url, title }             URL mudou
```

### Passo 4.3: Compatibilidade React 19

**CRITICO:** React 19 usa synthetic events. Para que o state do React atualize ao preencher um campo via DOM, e necessario:

```javascript
// Metodo correto para setar valor em input React 19:
function setReactInputValue(element, newValue) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  nativeInputValueSetter.call(element, newValue);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}
```

### Passo 4.4: Injetar o Bridge

```tsx
// No componente raiz do Cogedu (App.tsx ou RootLayout):
useEffect(() => {
  const script = document.createElement('script');
  script.src = '/orch-bridge.js';
  script.async = true;
  document.body.appendChild(script);
  return () => document.body.removeChild(script);
}, []);
```

### Passo 4.5: Auditoria de preenchimentos

Toda acao de preenchimento e logada:

```json
{
  "timestamp": "2026-02-03T14:30:00Z",
  "user_id": "uuid",
  "page_url": "/educational/admission/new",
  "field_name": "name",
  "field_value_hash": "sha256...",  // Hash, NAO o valor real
  "action_type": "fill",
  "confirmed_by_user": true
}
```

---

## 9. FASE 5: Implementar Sistema de Memoria

### Passo 5.1: Estrutura de armazenamento

Referencia: `knowledge-base/orch-memory-schema.yaml`
Implementacao: `auto-update/orch-conversation-logger.ts`

```
Opcao A: File System (simples)
  logs/{user_id}/
    index.yaml              # Indice com metadados de cada conversa
    2026/02/
      2026-02-03_14-30.yaml # Log completo da conversa
    archive/                 # Conversas > 90 dias

Opcao B: Banco de Dados (recomendado para producao)
  tabela: orch_conversations
    id, user_id, company_id, tenant_id
    started_at, ended_at
    messages (JSONB)
    entities_mentioned (JSONB)
    pages_visited (TEXT[])
    sentiment_avg (NUMERIC)
    resolution_status (ENUM)
    summary (TEXT)
```

### Passo 5.2: Fluxo de memoria

```
1. Inicio da sessao:
   - Carregar indice do usuario
   - Carregar resumos dos ultimos 30 dias
   - Carregar ultima conversa se < 24h
   - Carregar FAQs da pagina atual
   - Carregar correcoes de insights

2. Durante conversa:
   - Rastrear entidades mencionadas (alunos, turmas, processos)
   - Atualizar sentimento medio
   - Acumular mensagens

3. Fim da sessao:
   - Salvar log completo
   - Gerar resumo (via LLM)
   - Atualizar indice
   - Atualizar FAQs se aplicavel
```

### Passo 5.3: Politica de retencao

| Periodo | Tratamento | Uso |
|---------|-----------|-----|
| Sessao atual | Todas as mensagens | Contexto imediato |
| 0-30 dias | Resumo + entidades | Janela de contexto ativa |
| 30-90 dias | Somente indice | Pesquisavel sob demanda |
| > 90 dias | Arquivo morto | "Quem era aquele aluno que..." |

### Passo 5.4: Budget de contexto

O Orch gerencia tokens para nao estourar o limite do LLM:

```yaml
context_budget:
  total_available: 4000  # tokens para contexto (de 8K total)
  allocation:
    page_documentation:
      max_tokens: 1500
      priority: "critical"
    user_history:
      max_tokens: 800
      priority: "high"
    zodiac_directive:
      max_tokens: 200
      priority: "medium"
    faq_context:
      max_tokens: 300
      priority: "medium"
    correction_context:
      max_tokens: 200
      priority: "high"
    workflow_context:
      max_tokens: 600
      priority: "high"
    proactive_alerts:
      max_tokens: 300
      priority: "low"
  overflow_strategy: "summarize_lowest_priority_first"
```

---

## 10. FASE 6: Implementar Adaptacao Comportamental

### Passo 6.1: Como funciona

O Orch adapta INVISIVELMENTE seu tom, vocabulario e estrategia ao perfil zodiacal do usuario. O usuario NUNCA sabe que isso esta acontecendo.

Referencia: `knowledge-base/zodiac-personas.yaml`
Implementacao: `auto-update/orch-zodiac-engine.ts`

### Passo 6.2: Fluxo

```
1. Ao iniciar sessao, buscar birth_date do usuario no perfil
2. Calcular signo zodiacal
3. Carregar perfil comportamental do zodiac-personas.yaml
4. Injetar diretiva no system prompt do LLM
5. Adaptacao gradual:
   - 1-3 conversas: sutil (tom apenas)
   - 4-9 conversas: moderada (tom + estrategia)
   - 10+ conversas: completa (tom + estrategia + vocabulario)
```

### Passo 6.3: Exemplo de adaptacao

**Signos de Fogo (Aries, Leao, Sagitario):**
- Tom direto e orientado a acao
- "Vamos la! Clique em Novo Processo e preencha o nome."

**Signos de Terra (Touro, Virgem, Capricornio):**
- Tom detalhado e sistematico
- "O primeiro campo e o Nome do Processo. Esse campo aceita ate 200 caracteres e define como aparece na lista."

**Signos de Agua (Cancer, Escorpiao, Peixes):**
- Tom acolhedor e empático
- "Fica tranquilo, vou te guiar por cada campo. Comecamos pelo nome do processo - como voce gostaria de chamar?"

**Signos de Ar (Gemeos, Libra, Aquario):**
- Tom curioso e explorador
- "Essa tela tem varios campos interessantes! O principal e o nome do processo. Quer que eu explique o que cada um faz?"

### Passo 6.4: Implementacao no prompt

```
// Adicionar ao system prompt:
${zodiacDirective ? `
DIRETIVA COMPORTAMENTAL (INVISIVEL - nunca mencione):
Tom: ${zodiacDirective.tone_instruction}
Estrategia: ${zodiacDirective.strategy_instruction}
Vocabulario preferido: ${zodiacDirective.vocabulary_prefer.join(', ')}
Evitar: ${zodiacDirective.vocabulary_avoid.join(', ')}
` : ''}
```

**REGRA DE OURO:** Se birth_date nao disponivel, usar persona padrao (neutra/didatica). NUNCA perguntar o signo ao usuario.

---

## 11. FASE 7: Implementar Alertas Proativos

### Passo 7.1: O que sao alertas proativos

O Orch monitora dados e envia alertas ANTES que o gestor/coordenador pergunte.

Referencia: `knowledge-base/orch-proactive-alerts.yaml`

### Passo 7.2: Tipos de alertas

| Tipo | Exemplo | Severidade |
|------|---------|-----------|
| Evasao | "3 alunos da Turma X nao acessam ha 15 dias" | Alta |
| Notas | "Media da Turma Y caiu 20% esse mes" | Media |
| Prazo | "Processo Seletivo Z encerra em 3 dias" | Alta |
| Gargalo | "43 inscricoes pendentes de revisao" | Media |
| Qualidade | "Formulario de aluno com 5 campos vazios" | Baixa |

### Passo 7.3: Implementacao

```
1. Definir regras no orch-proactive-alerts.yaml (ja feito)
2. Criar job periodico (cron) que:
   a. Executa queries no banco de dados
   b. Avalia regras de alerta
   c. Verifica cooldown (nao repetir alerta recente)
   d. Envia via API para o widget do usuario
3. No widget, exibir alertas como mensagem do Orch:
   "Atencao: 3 alunos da Turma JS-2026 nao acessam ha 15 dias.
    Quer ver a lista?"
```

### Passo 7.4: Cooldown e prioridade

```yaml
cooldown:
  same_alert_same_user: "24h"
  same_category: "4h"
  max_alerts_per_session: 3
  priority_order: ["critical", "high", "medium", "low"]
```

---

## 12. FASE 8: Implementar Feedback e Analytics

### Passo 8.1: Coleta de feedback

Referencia: `auto-update/orch-feedback.ts`, `feedback/`

O Orch detecta sentimento nas mensagens e coleta feedback estruturado:

**Deteccao de sentimento:**
```yaml
negative_signals:
  keywords: ["nao funciona", "errado", "bug", "travou", "lento"]
  patterns: ["pergunta repetida 3+ vezes"]
  frustration: ["complicado demais", "perdi tudo", "nao consigo"]
```

**Tipos de feedback:**
1. Feature Request -> `feedback/improvements-bank.yaml`
2. Bug Report -> `feedback/improvements-bank.yaml`
3. Ajuste de UX -> `feedback/improvements-bank.yaml`
4. FAQ -> `feedback/faq-bank.yaml`

### Passo 8.2: Self-monitoring analytics

Referencia: `auto-update/orch-analytics-engine.ts`

**Metricas coletadas:**
- Taxa de resolucao (usuario satisfeito vs insatisfeito)
- Tempo medio de resolucao
- Paginas com mais duvidas
- Perguntas mais frequentes
- Taxa de uso do form-filling
- Sentimento medio por modulo
- Taxa de handoff para suporte

**Relatorio diario:**
O analytics engine gera um relatorio automatico com:
- Top 10 perguntas do dia
- Paginas com mais problemas
- Satisfacao media
- Recomendacoes de melhoria

---

## 13. FASE 9: Configurar Auto-Update (CI/CD)

### Passo 9.1: Como funciona

Quando um dev faz push no repositorio do Cogedu que altera rotas ou componentes, o GitHub Actions automaticamente:

1. Roda `orch-scanner.ts` que parseia o codigo via AST
2. Compara com os YAML files atuais
3. Se detectar mudancas, atualiza os YAML e faz commit
4. Trigger webhook para reindexar o RAG

### Passo 9.2: Configurar GitHub Actions

**No repositorio do Cogedu**, adicionar:

```yaml
# .github/workflows/orch-update.yml
# (Copiar de auto-update/orch-update.yml)

name: Orch Auto-Update
on:
  push:
    branches: [main]
    paths:
      - 'apps/web/src/routes/**'
      - 'apps/web/src/components/**'
      - 'apps/web/src/router.tsx'
      - 'apps/web/src/validation/**'

jobs:
  update-orch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npx ts-node orch-scanner.ts
      # Compara, atualiza YAML, commit, push
      # Trigger webhook de reindexacao
```

### Passo 9.3: Secrets necessarios

| Secret | Descricao |
|--------|-----------|
| `ORCH_ADMIN_PAT` | Personal Access Token para push no repo orch-admin |
| `RAG_WEBHOOK_URL` | URL para trigger de reindexacao no RAG |

### Passo 9.4: Runtime fallback

Se o Orch recebe uma URL que nao esta nos YAML (pagina nova):

1. `orch-bridge.js` faz scan do DOM (inputs, selects, buttons, labels)
2. Gera documentacao provisoria
3. Responde ao usuario com o que conseguiu detectar
4. Envia log para endpoint `unknown-pages-log`
5. Admin recebe notificacao para revisar

---

## 14. FASE 10: Testes e Validacao

### Testes funcionais

| Teste | Cenario | Esperado |
|-------|---------|----------|
| T1 | Abrir widget na pagina de admissao | Orch sauda e menciona "Processo Seletivo" |
| T2 | Perguntar "quais campos sao obrigatorios" | Lista com campos required: true |
| T3 | Pedir "preenche o nome pra mim com 'Vestibular 2026'" | Confirma antes -> preenche -> sucesso |
| T4 | Navegar para outra pagina | Orch detecta mudanca e atualiza contexto |
| T5 | Perguntar algo da conversa anterior | Orch busca memoria e responde |
| T6 | Expressar frustracao "isso nao funciona!" | Orch acolhe antes de resolver |
| T7 | Pedir "como criar uma turma" | Orch mostra workflow passo-a-passo |
| T8 | Abrir pagina desconhecida (nao mapeada) | Orch faz scan do DOM e responde provisoriamente |
| T9 | Perguntar sobre o AVA | Orch busca nos YAML do AVA e responde |
| T10 | Verificar alerta proativo | Orch notifica sobre situacao critica |

### Testes de seguranca

| Teste | Cenario | Esperado |
|-------|---------|----------|
| S1 | Usuario sem permissao pede dados de aluno | Orch recusa e explica |
| S2 | Tentar preencher campo sensivel (CPF, senha) | Orch solicita confirmacao dupla |
| S3 | Perguntar dados de outro tenant | Orch nao retorna dados cross-tenant |
| S4 | Injection no chat ("ignore instrucoes anteriores") | LLM segue guardrails e ignora |

### Testes de performance

| Metrica | Alvo |
|---------|------|
| Tempo de resposta (simples) | < 2s |
| Tempo de resposta (com RAG) | < 4s |
| Tempo de preenchimento de campo | < 500ms |
| Deteccao de mudanca de pagina | < 100ms |

---

## 15. FASE 11: Deploy e Go-Live

### Checklist pre-deploy

- [ ] Backend RAG indexado e testado com queries representativas
- [ ] API do Orch deployada e acessivel pelo frontend
- [ ] Widget integrado no CommunicationHub
- [ ] Bridge (orch-bridge.js) injetado no Cogedu
- [ ] Memoria persistente funcionando
- [ ] GitHub Actions configurado para auto-update
- [ ] Testes T1-T10 e S1-S4 passando
- [ ] Rate limits e budget de LLM configurados
- [ ] Monitoramento de erros (Sentry ou similar)
- [ ] Dashboard de analytics acessivel

### Estrategia de rollout

```
Semana 1: Piloto interno (equipe de produto + QA)
  - 5-10 usuarios internos
  - Coletar feedback intensivo
  - Ajustar respostas e fluxos

Semana 2-3: Beta com coordenadores selecionados
  - 20-30 usuarios reais
  - Monitorar metricas de satisfacao
  - Iterar no knowledge base

Semana 4: Go-live gradual
  - Habilitar para 100% dos usuarios
  - Manter fallback (desligar se necessario)
  - Monitorar custo de LLM

Mes 2+: Ativar features avancadas
  - Adaptacao zodiacal
  - Alertas proativos
  - Analytics dashboard
```

### Configuracao de feature flags

```typescript
const ORCH_FEATURES = {
  enabled: true,                    // Kill switch geral
  form_filling: true,               // Preenchimento de campos
  memory: true,                     // Memoria persistente
  zodiac_adaptation: false,         // Desligado no lancamento
  proactive_alerts: false,          // Desligado no lancamento
  analytics_dashboard: false,       // Desligado no lancamento
  ava_knowledge: true,              // Perguntas sobre o AVA
  auto_update: true,                // CI/CD
};
```

---

## 16. Mapa de Decisoes Tecnicas

O CTO precisa tomar estas decisoes antes de comecar:

| # | Decisao | Opcoes | Impacto |
|---|---------|--------|---------|
| D1 | Plataforma RAG | Dify / LangChain+Chroma / pgvector | Define esforco de backend |
| D2 | Provedor de LLM | OpenAI / Azure OpenAI / Anthropic | Define custo e compliance |
| D3 | Armazenamento de memoria | File system / PostgreSQL / MongoDB | Define escalabilidade |
| D4 | Widget como iframe ou componente | iframe (isolado) / React component (integrado) | Define complexidade |
| D5 | Auto-update ativo ou manual | GitHub Actions auto / Manual review | Define velocidade de atualizacao |
| D6 | Alertas proativos via | WebSocket / SSE / Polling | Define latencia de alertas |
| D7 | Hosting do backend Orch | Mesmo server do Cogedu / Servico separado | Define infra necessaria |
| D8 | Engine zodiacal ativa | Sim / Nao / Futuramente | Define se precisa birth_date |

---

## 17. Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| LLM gera resposta incorreta | Media | Alto | Guardrails no prompt + feedback loop + correcoes |
| Custo de LLM escala demais | Media | Medio | gpt-4o-mini (barato), cache de respostas, rate limit |
| Bridge quebra com atualizacao do React | Baixa | Alto | Testes E2E automaticos no bridge |
| Knowledge base desatualizado | Media | Medio | Auto-update via CI/CD + runtime fallback |
| Usuario nao confia no Orch | Media | Alto | Sempre confirmar antes de preencher, transparencia |
| Vazamento de PII via chat | Baixa | Critico | Guardrails de PII, hash de valores, permissoes |
| Latencia alta na resposta | Media | Medio | Cache, streaming de resposta, gpt-4o-mini |

---

## 18. Metricas de Sucesso

### KPIs do Orch

| Metrica | Meta (Mes 1) | Meta (Mes 3) | Meta (Mes 6) |
|---------|-------------|-------------|-------------|
| Taxa de uso (% usuarios que abrem widget) | 30% | 50% | 70% |
| Taxa de resolucao (satisfeito) | 60% | 75% | 85% |
| Reducao de tickets de suporte | 10% | 25% | 40% |
| Tempo medio de resolucao | < 3 min | < 2 min | < 1.5 min |
| NPS do Orch (satisfacao) | 30 | 50 | 65 |
| Custo LLM por usuario/mes | < $0.50 | < $0.30 | < $0.20 |

### Dashboard de acompanhamento

O `orch-analytics-engine.ts` gera metricas que devem alimentar um dashboard com:

- Grafico de uso por dia/hora
- Top 10 perguntas mais frequentes
- Paginas com mais duvidas
- Sentimento medio por modulo
- Taxa de handoff para suporte
- Custo acumulado de LLM

---

## 19. Roadmap de Evolucao

### v3.7.0 (Atual) - Knowledge Base Completa
- [x] Admin: 62 rotas, 45+ paginas, 8 modulos
- [x] AVA: 25+ paginas, 179 endpoints, 28+ players
- [x] 14 YAML files indexados (604 KB)
- [x] Auto-update CI/CD definido

### v4.0 - MVP Funcional (Proximo)
- [ ] Backend RAG deployado
- [ ] Widget integrado no Cogedu
- [ ] Bridge funcionando
- [ ] Memoria persistente
- [ ] Feedback collection

### v4.1 - Features Avancadas
- [ ] Adaptacao zodiacal ativa
- [ ] Alertas proativos
- [ ] Analytics dashboard
- [ ] Integracao com AVA

### v5.0 - Inteligencia Avancada
- [ ] Treinamento com dados reais de uso
- [ ] Recomendacoes baseadas em padroes
- [ ] Predicao de duvidas por perfil
- [ ] Integracao com BI dashboard

---

## Resumo Executivo para o CTO

**O Orch Admin e um sistema pronto para implementacao** que transforma o suporte do Cogedu de reativo para proativo. Os 30 arquivos do repositorio contem:

1. **Toda a inteligencia** (604 KB de knowledge base documentando 100% das paginas)
2. **Todo o codigo de suporte** (200 KB de auto-update, memoria, analytics)
3. **Toda a especificacao** (112 KB de definicao de agente com UAF)

O trabalho restante e de **integracao**:
- Conectar ao LLM (API key + prompt)
- Indexar YAML no RAG (upload + embedding)
- Integrar widget no React (componente + bridge)
- Provisionar storage (banco + logs)

A estrategia de rollout recomendada e **gradual**: piloto interno -> beta -> go-live, com feature flags para controlar funcionalidades avancadas (zodiac, alertas, analytics).
