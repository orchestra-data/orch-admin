# ORCH Admin - Pre-Squad Adoption

**Feature:** Assistente IA Contextual para Cogedu Admin
**Status:** Adopted ✅ | Implementation Pending ⚠️
**Target:** Admin
**Author:** Steven Phil <steevens@gmail.com>
**Squad:** Cogedu Orchestra

---

## Overview

ORCH Admin é um assistente IA contextual embeddado no sistema Cogedu que ajuda funcionários a:

- Entender o propósito de cada página do sistema
- Saber o que preencher em cada campo
- Entender modais, botões e ações disponíveis
- Preencher formulários sob demanda
- Resolver erros e dúvidas em tempo real
- Receber alertas proativos sobre riscos e prazos

---

## Audit Summary

| Metric | Value |
|--------|-------|
| **Quality Score** | 9/10 |
| **Files** | 205 |
| **Size** | 2.3 MB |
| **Critical Issues** | 0 |
| **Major Issues** | 2 (endpoints + frontend to create) |

---

## What's Ready ✅

| Component | Location | Description |
|-----------|----------|-------------|
| Agent Definition | `adopted/agent/page-guide.md` | UAF v3.7.0 completo |
| Knowledge Base | `adopted/knowledge-base/` | 14 YAMLs, 604KB |
| Migrations | `adopted/migrations/` | 6 tabelas PostgreSQL |
| Auto-Update | `adopted/auto-update/` | 6 TypeScript services |
| Dify Setup | `adopted/dify/` | Docker + setup scripts |
| Documentation | `adopted/docs/` | Implementation guides |

---

## What Needs Creation ⚠️

| Component | Description | Guide |
|-----------|-------------|-------|
| Backend Endpoints | 7 REST endpoints | `docs/IMPLEMENTATION-GUIDE.md` |
| Frontend Components | FloatingChat + Context | `docs/IMPLEMENTATION-GUIDE.md` |
| API Types | Request/Response types | `docs/IMPLEMENTATION-GUIDE.md` |

---

## API Endpoints (to be created)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orch-admin/sessions` | Inicia nova sessão |
| POST | `/orch-admin/chat` | Envia mensagem |
| POST | `/orch-admin/sessions/:id/end` | Encerra sessão |
| GET | `/orch-admin/alerts` | Lista alertas |
| POST | `/orch-admin/alerts/:id/read` | Marca alerta lido |
| POST | `/orch-admin/feedback` | Envia feedback |
| GET | `/orch-admin/context/*` | Contexto da página |

---

## Database Tables (6)

| Table | Description |
|-------|-------------|
| `orch_admin_session` | Sessões de chat |
| `orch_admin_feedback` | Feedback de usuários |
| `orch_admin_faq` | FAQ auto-gerado |
| `orch_admin_form_fill` | Audit de preenchimento |
| `orch_admin_alert` | Alertas proativos |
| `orch_admin_metric` | Métricas diárias |

---

## Folder Structure

```
Pre-Squad/orch-admin/
├── original/                    # Preserved original (DO NOT MODIFY)
├── adopted/
│   ├── agent/                   # ✅ Agent definition
│   ├── auto-update/             # ✅ Auto-update services
│   ├── backend/                 # ⚠️ TO BE CREATED
│   ├── dify/                    # ✅ RAG backend setup
│   ├── docs/                    # ✅ Implementation guides
│   ├── frontend/                # ⚠️ TO BE CREATED
│   ├── knowledge-base/          # ✅ RAG knowledge
│   └── migrations/              # ✅ Database tables
├── AUDIT_REPORT.md
├── ADOPTION_LOG.md
└── README.md
```

---

## Next Steps

1. **Chief reviews** this adoption
2. **Dev implements** backend endpoints + frontend components
3. **Preview** with Docker + localhost
4. **QA validates** the feature
5. **Handoff** to Cogfy for integration

---

## Integration Points

### Frontend
- `apps/web/src/components/FloatingChat.tsx` - Add ORCH tab
- `apps/web/src/contexts/OrchAdminContext.tsx` - Create context
- `apps/web/src/app.tsx` - Add provider

### Backend
- `apps/api/src/endpoints/orchAdmin*/` - 7 endpoints
- Uses existing PostgreSQL + Dify for RAG

---

## Architecture Decision

Esta feature usa **Dify self-hosted** como backend RAG.

**Pros:**
- RAG otimizado com 604KB de knowledge
- Interface visual para gerenciar docs
- Isolamento do contexto

**Cons:**
- Serviço adicional (Docker)
- Não usa serviços internos (GoogleGemini, OpenAI)

**Decisão:** Manter Dify para primeira versão, avaliar migração futura.

---

**Adopted by:** Curator (cogedu-curator)
**Date:** 2026-02-07
