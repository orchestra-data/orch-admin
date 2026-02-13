# Genesis *validate - Plano de Correcoes Orch v3.5.1

**Status**: CONCLUIDO
**Fonte**: cogedu-main (3)\cogedu-main\apps\web\
**Commit anterior**: 1256c3e (v3.5.1)

## Checklist de Correcoes

### FASE 1: page-guide.md - Tech Stack e Rotas [CONCLUIDO]
- [x] 1.1 Atualizar tech_stack (15 entradas com versoes exatas)
- [x] 1.2 Corrigir 9 URL patterns incorretos (/create -> /new, /newStudent, /newEmployee)
- [x] 1.3 Adicionar 27 rotas faltantes (auth, edit, detail, events, blockly, etc.)
- [x] 1.4 Adicionar modulos nao documentados (auth, events, cross-cutting systems)
- [x] 1.5 Corrigir navegacao (header-based, layouts documentados)
- [x] 1.6 Adicionar route components com nomes reais (Route suffix)
- [x] 1.7 Versao atualizada para v3.6.0

### FASE 2: cogedu-admission-fields.yaml [CONCLUIDO] (+122 linhas)
- [x] 2.1 Adicionar enrollmentMode (single_inherited/multiple_choice)
- [x] 2.2 Adicionar AdmissionEditRoute fields
- [x] 2.3 Adicionar OfferDetailRoute e OfferEditRoute
- [x] 2.4 Adicionar ResumeApplicationRoute
- [x] 2.5 Corrigir escala de avaliacao (Kanban 0-10 vs Detail 0-100)

### FASE 3: cogedu-educational-fields.yaml [CONCLUIDO] (+2519 linhas)
- [x] 3.1 Adicionar modulo Components completo (11 tipos, 8 feature flags)
- [x] 3.2 Adicionar Edit pages (CollectionEdit, PathwayEdit, SeriesEdit, UnitEdit)
- [x] 3.3 Adicionar Detail pages com drag-and-drop
- [x] 3.4 Adicionar isOfferable (marketplace) nas Collections
- [x] 3.5 Adicionar checkpoint thresholds e enrollment limits nos Pathways
- [x] 3.6 Adicionar grading config nas Series
- [x] 3.7 Adicionar release conditions nas Units
- [x] 3.8 Adicionar ClassInstanceEdit, StudentView, Recommendations
- [x] 3.9 Adicionar ClassInstance notifications modal e chat

### FASE 4: cogedu-users-fields.yaml [CONCLUIDO] (+269 linhas)
- [x] 4.1 Adicionar Company Events (EventCreate/Detail/Edit)
- [x] 4.2 Adicionar 7 tabs com progress tracking no CompanyCreate

### FASE 5: cogedu-exams-fields.yaml [CONCLUIDO] (+810 linhas)
- [x] 5.1 Adicionar RubricEditRoute
- [x] 5.2 Adicionar BlocklyGameCreate e BlocklyGameEdit
- [x] 5.3 Adicionar ActivityGradingRoute
- [x] 5.4 Detalhar BI tabs (Overview, Students, Classes, Content, Audit, Risk)
- [x] 5.5 Detalhar Privacy Center 3 tabs (LGPD Art. 18)

### FASE 6: Commit e Push [CONCLUIDO]
- [x] 6.1 Commit com mensagem descritiva
- [x] 6.2 Push para remote

## URL Patterns a Corrigir (Referencia Rapida)

| Orch atual | Codigo real |
|---|---|
| /educational/admission/create | /educational/admission/new |
| /users/create | /users/new |
| /users/create/student | /users/newStudent |
| /users/create/employee | /users/newEmployee |
| /companies/create | /companies/new |
| /educational/collections/create | /educational/collections/new |
| /educational/pathways/create | /educational/pathways/new |
| /educational/class-instances/create | /educational/class-instances/new |
| /educational/class-instances/:id/enrollments/create | /educational/class-instances/:classInstanceId/enrollments/new |

## Rotas Faltantes (Referencia Rapida)

### Auth (5 rotas)
- /auth-register -> AuthRoute
- /primeiro-acesso -> FirstAccessRoute
- /auth/set-password -> SetPasswordRoute
- /password-forgot -> ForgotPasswordRoute
- /password-reset -> ResetPasswordRoute

### Admission Edit/Detail (4 rotas)
- /educational/admission/:id/edit -> AdmissionEditRoute
- /educational/admission/offers/:offerId -> OfferDetailRoute
- /educational/admission/offers/:offerId/edit -> OfferEditRoute
- /application/resume/:accessToken -> ResumeApplicationRoute

### Educational Content Edit/Detail (8 rotas)
- /educational/collections/:collectionId -> CollectionDetailRoute
- /educational/collections/:collectionId/edit -> CollectionEditRoute
- /educational/pathways/:pathwayId -> PathwayDetailRoute
- /educational/pathways/:pathwayId/edit -> PathwayEditRoute
- /educational/series/:seriesId -> SeriesDetailRoute
- /educational/series/:seriesId/edit -> SeriesEditRoute
- /educational/units/:unitId -> UnitDetailRoute
- /educational/units/:unitId/edit -> UnitEditRoute

### Components (5 rotas)
- /educational/units/:unitId/builder -> ComponentBuilderRoute (ja existe como UnitBuilder)
- Apps web routes: ComponentCreate, ComponentEdit, ComponentDetail, ComponentList

### Exams extras (4 rotas)
- /educational/exams/rubrics/:rubricId/edit -> RubricEditRoute
- /educational/exams/blockly-games/new -> BlocklyGameCreateRoute
- /educational/exams/blockly-games/:gameId/edit -> BlocklyGameEditRoute
- /educational/exams/activity-grade/:attemptId -> ActivityGradingRoute

### Class Instances extras (3 rotas)
- /educational/class-instances/:id/edit -> ClassInstanceEditRoute
- /educational/class-instances/:id/newEdit -> ClassInstanceDetailStudentView
- /educational/class-instances/:id/recommendations -> RecommendationsRoute

### Company Events (3 rotas)
- /companies/:companyId/events/new -> EventCreateRoute
- /companies/:companyId/events/:eventId -> EventDetailRoute
- /companies/:companyId/events/:eventId/edit -> EventEditRoute

## Modulos Nao Documentados (Referencia Rapida)

1. Auth Routes (5 rotas)
2. Company Events (3 rotas)
3. Attendance System (components/attendance/ - 7 arquivos + hook)
4. Communication Hub (components/communication-hub/ - 7 arquivos)
5. Components CRUD (5 rotas educacionais)
6. Group Work (GroupWorkManagement + useGroupWork)
7. Legal/Consent (ConsentModal + useLegalConsent)
8. Experience Tracking (useExperienceEvents, useExperienceMetrics)
9. FinOps (useFinOps no BI)
10. Student View (ClassInstanceDetailStudentView)
11. AI Recommendations (RecommendationsRoute)
12. Resume Application (ResumeApplicationRoute)
