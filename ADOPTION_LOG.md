# Adoption Log: orch-admin

**Adopted by:** Curator (cogedu-curator)
**Date:** 2026-02-07
**Author:** Steven Phil <steevens@gmail.com>

---

## Source

| Field | Value |
|-------|-------|
| **Original Path** | `C:/Projetos IA/ORCH ADMIN` |
| **Pre-Squad Path** | `C:/Projetos IA/Cogedu V1.2/Pre-Squad/orch-admin/` |
| **Files** | 205 |
| **Size** | 2.3 MB |

---

## Timeline

| Phase | Started | Completed | Duration |
|-------|---------|-----------|----------|
| Analysis | 2026-02-07 00:45 | 2026-02-07 00:48 | 3 min |
| Audit | 2026-02-07 00:48 | 2026-02-07 00:50 | 2 min |
| Migration | 2026-02-07 00:50 | 2026-02-07 00:51 | 1 min |
| Documentation | 2026-02-07 00:51 | In Progress | - |

---

## Feature Description

**ORCH Admin** é um assistente IA contextual para o sistema Cogedu Admin que:

1. **Guia Contextual** - Detecta a página pela URL e explica campos, botões e fluxos
2. **Preenchimento de Campos** - Preenche formulários pelo funcionário com confirmação
3. **Resolução de Erros** - Ajuda a entender e resolver mensagens de erro
4. **Passo a Passo** - Guia numerado para tarefas comuns
5. **Alertas Proativos** - Notifica sobre riscos, prazos e problemas
6. **FAQ Auto-gerado** - Aprende com perguntas recorrentes

---

## Components

### Already Complete ✅

| Component | Location | Status |
|-----------|----------|--------|
| Agent Definition | `agent/page-guide.md` | ✅ UAF v3.7.0 |
| Knowledge Base | `knowledge-base/*.yaml` | ✅ 14 files, 604KB |
| Migrations | `migrations/` | ✅ 6 tables |
| Auto-Update | `auto-update/*.ts` | ✅ 6 services |
| Dify Setup | `dify/` | ✅ Docker ready |
| Documentation | `*.md` | ✅ 3 guides |

### Needs Implementation ⚠️

| Component | Description | Guide |
|-----------|-------------|-------|
| Backend Endpoints | 7 REST endpoints `/orch-admin/*` | IMPLEMENTATION-GUIDE.md |
| Frontend Components | FloatingChat + OrchAdminContext | IMPLEMENTATION-GUIDE.md |
| API Types | Request/Response types | IMPLEMENTATION-GUIDE.md |

---

## Special Notes

### This is NOT a typical adoption

Esta feature é **especial** porque:

1. **Knowledge Base pronta** - 604KB de documentação contextual
2. **Migrations prontas** - 6 tabelas PostgreSQL
3. **Auto-update pronto** - Sistema de atualização automática
4. **Dify pronto** - RAG backend configurado

**MAS** os endpoints e componentes frontend precisam ser **criados** seguindo o IMPLEMENTATION-GUIDE.md.

### Architecture Decision

A feature usa **Dify self-hosted** como backend RAG em vez dos serviços internos (GoogleGeminiService, OpenAIService). Isso foi intencional para:

1. Isolamento do conhecimento contextual
2. RAG especializado com chunking otimizado
3. Controle total sobre o modelo de chat
4. Interface visual para gerenciar knowledge base

**Decisão pendente:** Manter Dify ou migrar para serviços internos.

---

## Adopted Structure

```
Pre-Squad/orch-admin/
├── original/                    # EXACT copy preserved
│   ├── agent/
│   ├── auto-update/
│   ├── dify/
│   ├── feedback/
│   ├── knowledge-base/
│   ├── logs/
│   ├── migrations/
│   ├── *.md
│   └── ...
├── adopted/
│   ├── backend/                 # TO BE CREATED
│   │   └── (endpoints following IMPLEMENTATION-GUIDE)
│   ├── frontend/                # TO BE CREATED
│   │   └── (components following IMPLEMENTATION-GUIDE)
│   ├── migrations/              # COPIED from original
│   │   └── 1820000002--orch_admin_tables.sql
│   └── docs/
│       ├── IMPLEMENTATION-GUIDE.md
│       └── GUIA-IMPLANTACAO-CTO.md
├── AUDIT_REPORT.md
├── ADOPTION_LOG.md
└── README.md
```

---

## Recommended Next Steps

### Phase 1: Setup (Curator complete)
- [x] Copy to Pre-Squad
- [x] Audit report
- [x] Adoption log
- [ ] Copy migrations to adopted/
- [ ] Copy docs to adopted/

### Phase 2: Implementation (Dev required)
- [ ] Create backend endpoints (7 endpoints)
- [ ] Create frontend components (FloatingChat tab)
- [ ] Create API types
- [ ] Test locally with Docker

### Phase 3: Integration (Chief)
- [ ] Deploy Dify on staging
- [ ] Upload knowledge base
- [ ] Test end-to-end
- [ ] Create PR

---

## Target

| Question | Answer |
|----------|--------|
| **Where does this feature go?** | **Admin** |
| **Design System applies?** | Yes (FloatingChat styling) |
| **Is this a new feature?** | ✅ Yes (not in production) |

---

**Curator:** cogedu-curator
**Squad:** Cogedu Orchestra
**Created:** 2026-02-07
