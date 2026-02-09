# Matriz de Testes Funcionais - ORCH ADMIN

> Testes T1-T10 + Performance P1-P4

**Versao:** 1.0.0
**Data:** 2026-02-09
**Autor:** Squad Cogedu (QA)

---

## 1. Visao Geral

Esta matriz define os testes funcionais obrigatorios para validacao do ORCH ADMIN antes do go-live.

### Prioridades

| Prioridade | Descricao | Blocking? |
|------------|-----------|-----------|
| P0 | Bloqueante - sem isso nao lanca | Sim |
| P1 | Alta - funcionalidade core | Sim |
| P2 | Media - nice to have | Nao |

---

## 2. Testes Funcionais (T1-T10)

### T1 - Deteccao de Contexto de Pagina

| Campo | Valor |
|-------|-------|
| **ID** | T1 |
| **Nome** | Deteccao de Contexto de Pagina |
| **Prioridade** | P0 (Bloqueante) |
| **Pre-condicoes** | Usuario logado, widget Orch visivel |

**Passos:**
1. Navegar para `/admission/new`
2. Abrir aba "Ajuda" no CommunicationHub
3. Aguardar saudacao do Orch

**Resultado Esperado:**
- Orch exibe saudacao contextual
- Menciona "Processo Seletivo" ou "Admissao"
- Sugere perguntas relevantes para a pagina

**Criterios de Aceite:**
- [ ] Saudacao aparece em < 3s
- [ ] Contexto correto (modulo admission)
- [ ] Sugestoes relevantes para criar processo seletivo

**Dados de Teste:**
- Usuario: `qa@cogedu.com`
- Pagina: `/admission/new`

---

### T2 - Listar Campos Obrigatorios

| Campo | Valor |
|-------|-------|
| **ID** | T2 |
| **Nome** | Listar Campos Obrigatorios |
| **Prioridade** | P0 (Bloqueante) |
| **Pre-condicoes** | T1 passou, sessao ativa |

**Passos:**
1. Estar na pagina `/admission/new` com widget aberto
2. Digitar "quais campos sao obrigatorios?"
3. Enviar mensagem

**Resultado Esperado:**
- Orch retorna lista de campos com `required: true`
- Formato: lista com marcadores
- Inclui: nome, periodo, etc.

**Criterios de Aceite:**
- [ ] Resposta em < 4s
- [ ] Lista ao menos 3 campos obrigatorios
- [ ] Formato legivel (lista/marcadores)

**Dados de Teste:**
- Query: "quais campos sao obrigatorios?"
- KB esperada: cogedu-admission-fields.yaml

---

### T3 - Preenchimento de Campo com Confirmacao

| Campo | Valor |
|-------|-------|
| **ID** | T3 |
| **Nome** | Preenchimento de Campo com Confirmacao |
| **Prioridade** | P0 (Bloqueante) |
| **Pre-condicoes** | Pagina com formulario, bridge carregado |

**Passos:**
1. Estar na pagina `/admission/new`
2. Digitar "preenche o campo nome com 'Vestibular 2026'"
3. Enviar mensagem
4. Confirmar quando Orch pedir confirmacao

**Resultado Esperado:**
- Orch pede confirmacao antes de preencher
- Apos confirmacao, campo e preenchido
- Orch confirma sucesso

**Criterios de Aceite:**
- [ ] Confirmacao solicitada ANTES de preencher
- [ ] Campo atualizado no DOM
- [ ] Estado do React atualizado (form valido)
- [ ] Audit log registrado (hash, nao valor)

**Dados de Teste:**
- Campo: `name`
- Valor: "Vestibular 2026"

---

### T4 - Deteccao de Mudanca de Pagina

| Campo | Valor |
|-------|-------|
| **ID** | T4 |
| **Nome** | Deteccao de Mudanca de Pagina |
| **Prioridade** | P0 (Bloqueante) |
| **Pre-condicoes** | Sessao ativa, widget aberto |

**Passos:**
1. Estar em `/admission` com widget aberto
2. Navegar para `/educational/class-instances`
3. Observar comportamento do widget

**Resultado Esperado:**
- Orch detecta mudanca de URL
- Atualiza contexto automaticamente
- Exibe nova saudacao ou atualiza sugestoes

**Criterios de Aceite:**
- [ ] Deteccao em < 500ms
- [ ] Evento PAGE_CHANGED enviado
- [ ] Contexto atualizado para modulo educational

**Validacao Tecnica:**
```javascript
// Console: verificar evento
window.addEventListener('message', e => {
  if (e.data.type === 'PAGE_CHANGED') console.log('OK', e.data);
});
```

---

### T5 - Memoria Persistente Entre Sessoes

| Campo | Valor |
|-------|-------|
| **ID** | T5 |
| **Nome** | Memoria Persistente Entre Sessoes |
| **Prioridade** | P1 (Alta) |
| **Pre-condicoes** | Usuario com historico de conversas |

**Passos:**
1. Criar conversa sobre "processo seletivo de medicina"
2. Fechar navegador
3. Abrir novamente e iniciar nova sessao
4. Perguntar "o que conversamos antes?"

**Resultado Esperado:**
- Orch recupera contexto da conversa anterior
- Menciona "processo seletivo de medicina"
- Demonstra continuidade

**Criterios de Aceite:**
- [ ] Memoria carregada do PostgreSQL
- [ ] Ultimos 30 dias disponiveis
- [ ] Resumo acessivel

**SQL de Verificacao:**
```sql
SELECT summary, started_at
FROM orch_conversations
WHERE user_id = 'uuid'
ORDER BY started_at DESC
LIMIT 5;
```

---

### T6 - Adaptacao Comportamental a Frustracao

| Campo | Valor |
|-------|-------|
| **ID** | T6 |
| **Nome** | Adaptacao Comportamental a Frustracao |
| **Prioridade** | P1 (Alta) |
| **Pre-condicoes** | Sessao ativa |

**Passos:**
1. Enviar mensagem expressando frustracao: "isso nao funciona!"
2. Observar resposta do Orch

**Resultado Esperado:**
- Orch detecta sentimento negativo
- Responde com empatia primeiro
- Depois oferece ajuda tecnica

**Criterios de Aceite:**
- [ ] Tom empatico na resposta
- [ ] Nao responde defensivamente
- [ ] Oferece solucao apos acolhimento

**Exemplo de Resposta Esperada:**
> "Entendo sua frustracao. Vamos resolver isso juntos. O que exatamente nao esta funcionando?"

---

### T7 - Workflow Passo-a-Passo

| Campo | Valor |
|-------|-------|
| **ID** | T7 |
| **Nome** | Workflow Passo-a-Passo |
| **Prioridade** | P1 (Alta) |
| **Pre-condicoes** | Sessao ativa |

**Passos:**
1. Perguntar "como criar uma turma?"
2. Observar resposta

**Resultado Esperado:**
- Orch retorna workflow estruturado
- Passos numerados (1, 2, 3...)
- Cada passo e acionavel

**Criterios de Aceite:**
- [ ] Workflow do cogedu-workflows.yaml
- [ ] Minimo 3 passos
- [ ] Formato lista numerada

**KB Esperada:** cogedu-workflows.yaml → create-class

---

### T8 - Pagina Nao Mapeada (DOM Scan)

| Campo | Valor |
|-------|-------|
| **ID** | T8 |
| **Nome** | Pagina Nao Mapeada (DOM Scan) |
| **Prioridade** | P1 (Alta) |
| **Pre-condicoes** | Pagina nova sem YAML |

**Passos:**
1. Navegar para pagina nova (sem documentacao)
2. Abrir widget
3. Perguntar sobre a pagina

**Resultado Esperado:**
- Bridge faz scan do DOM
- Orch responde com base nos campos detectados
- Log enviado para unknown-pages-log

**Criterios de Aceite:**
- [ ] Fallback funciona
- [ ] Campos detectados corretamente
- [ ] Admin notificado

---

### T9 - Perguntas Cross-Plataforma (AVA)

| Campo | Valor |
|-------|-------|
| **ID** | T9 |
| **Nome** | Perguntas Cross-Plataforma (AVA) |
| **Prioridade** | P2 (Media) |
| **Pre-condicoes** | KB do AVA indexada |

**Passos:**
1. Estar no Admin
2. Perguntar "como funciona o player de video no AVA?"

**Resultado Esperado:**
- Orch busca na KB "Cogedu AVA"
- Retorna info do cogedu-ava-architecture.yaml
- Explica content players

**Criterios de Aceite:**
- [ ] KB correta selecionada
- [ ] Resposta tecnica adequada
- [ ] Menciona VideoPlayer, IframePlayer, etc.

---

### T10 - Alerta Proativo

| Campo | Valor |
|-------|-------|
| **ID** | T10 |
| **Nome** | Alerta Proativo |
| **Prioridade** | P2 (Media) |
| **Pre-condicoes** | Feature ativa, dados de evasao |

**Passos:**
1. Criar cenario com alunos sem acesso ha 15 dias
2. Aguardar job de alertas rodar
3. Verificar widget

**Resultado Esperado:**
- Orch exibe alerta proativamente
- Mensagem: "3 alunos da Turma X nao acessam ha 15 dias"
- Oferece link para detalhes

**Criterios de Aceite:**
- [ ] Alerta aparece sem usuario perguntar
- [ ] Severidade correta (high)
- [ ] Cooldown respeitado (nao repete)

---

## 3. Testes de Performance (P1-P4)

### P1 - Tempo de Resposta Simples

| Metrica | Alvo |
|---------|------|
| Query simples | < 2s |
| Percentil 95 | < 3s |

**Query de Teste:** "O que faz essa pagina?"

---

### P2 - Tempo de Resposta com RAG

| Metrica | Alvo |
|---------|------|
| Query com RAG | < 4s |
| Percentil 95 | < 5s |

**Query de Teste:** "Quais campos sao obrigatorios para criar processo seletivo?"

---

### P3 - Tempo de Preenchimento de Campo

| Metrica | Alvo |
|---------|------|
| Fill field | < 500ms |

**Teste:** Medir tempo do comando FILL_FIELD ate FILL_SUCCESS

---

### P4 - Deteccao de Mudanca de Pagina

| Metrica | Alvo |
|---------|------|
| PAGE_CHANGED | < 100ms |

**Teste:** Medir tempo da navegacao ate evento PAGE_CHANGED

---

## 4. Dados de Teste

### Usuarios

| Usuario | Role | Tenant |
|---------|------|--------|
| qa@cogedu.com | Admin | tenant-qa |
| professor@cogedu.com | Professor | tenant-qa |
| aluno@cogedu.com | Aluno | tenant-qa |

### Paginas

| Pagina | Modulo | KB |
|--------|--------|-----|
| /admission/new | Admissao | cogedu-admission-fields.yaml |
| /educational/class-instances | Educacional | cogedu-educational-fields.yaml |
| /users/students/new | Usuarios | cogedu-users-fields.yaml |
| /exams/questions | Avaliacoes | cogedu-exams-fields.yaml |

---

## 5. Ambiente de Teste

### Pre-requisitos

- [ ] Dify rodando (http://localhost:3001)
- [ ] PostgreSQL com tabelas orch_*
- [ ] 14 YAML files indexados
- [ ] Backend com endpoints /orch-admin/*
- [ ] Frontend com widget integrado

### Variaveis

```bash
DIFY_API_URL=http://localhost:3001/v1
DIFY_API_KEY=app-xxx
DATABASE_URL=postgresql://...
```

---

## 6. Criterios de Aprovacao

### Para Go-Live

- [ ] 100% dos testes P0 passam
- [ ] 90%+ dos testes P1 passam
- [ ] Performance P1-P4 dentro dos alvos
- [ ] Zero vulnerabilidades criticas (S1-S4)

### Metricas de Qualidade

| Metrica | Alvo |
|---------|------|
| Taxa de sucesso | >= 95% |
| Latencia P50 | < 2s |
| Latencia P95 | < 5s |
| Taxa de erro | < 1% |

---

## 7. Template de Bug Report

```markdown
## Bug Report

**Teste:** T[N]
**Severidade:** Critical/High/Medium/Low
**Ambiente:** staging/production

### Descricao
[O que aconteceu]

### Passos para Reproduzir
1. ...
2. ...

### Resultado Esperado
[O que deveria acontecer]

### Resultado Atual
[O que aconteceu]

### Evidencias
- Screenshot:
- Console log:
- Network request:

### Dados Adicionais
- Browser:
- Usuario:
- Timestamp:
```

---

## 8. Referencias

- GUIA-IMPLANTACAO-CTO.md - Secao 14 (FASE 10)
- tests/security-tests.md - Testes de seguranca S1-S4
- tests/rag-validation.md - Validacao do RAG
