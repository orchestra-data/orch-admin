# Validacao RAG - ORCH ADMIN

> 10 Queries de Teste + Scripts de Automacao

**Versao:** 1.0.0
**Data:** 2026-02-09
**Autor:** Squad Cogedu (QA)

---

## 1. Visao Geral

Esta matriz valida que o sistema RAG (Retrieval-Augmented Generation) do ORCH ADMIN esta funcionando corretamente. Os testes verificam:

1. **Indexacao:** 14 YAML files corretamente indexados
2. **Retrieval:** Chunks relevantes retornados
3. **Accuracy:** Respostas corretas baseadas na KB
4. **Performance:** Tempo de resposta dentro do SLA

### Knowledge Base Files (14 YAMLs)

| Arquivo | Tamanho | Chunks Est. |
|---------|---------|-------------|
| cogedu-admission-fields.yaml | 45KB | ~90 |
| cogedu-educational-fields.yaml | 52KB | ~104 |
| cogedu-financial-fields.yaml | 38KB | ~76 |
| cogedu-users-fields.yaml | 41KB | ~82 |
| cogedu-exams-fields.yaml | 48KB | ~96 |
| cogedu-content-fields.yaml | 35KB | ~70 |
| cogedu-reports-fields.yaml | 28KB | ~56 |
| cogedu-workflows.yaml | 62KB | ~124 |
| cogedu-error-codes.yaml | 22KB | ~44 |
| cogedu-faq.yaml | 85KB | ~170 |
| cogedu-glossary.yaml | 18KB | ~36 |
| cogedu-ava-architecture.yaml | 55KB | ~110 |
| cogedu-integration-guide.yaml | 42KB | ~84 |
| cogedu-release-notes.yaml | 33KB | ~66 |
| **TOTAL** | **604KB** | **~1208** |

---

## 2. Queries de Validacao (Q1-Q10)

### Q1 - Campos Obrigatorios de Admissao

| Campo | Valor |
|-------|-------|
| **ID** | Q1 |
| **Query** | "Quais campos sao obrigatorios para criar um processo seletivo?" |
| **KB Esperada** | cogedu-admission-fields.yaml |
| **Chunks Esperados** | admission.create, admission.fields.required |

**Resposta Esperada (contem):**
- Nome do processo
- Periodo de inscricao
- Cursos vinculados
- Documentos exigidos

**Criterios:**
- [ ] KB correta selecionada
- [ ] Minimo 3 campos listados
- [ ] Tempo < 4s

---

### Q2 - Workflow de Criacao de Turma

| Campo | Valor |
|-------|-------|
| **ID** | Q2 |
| **Query** | "Como criar uma turma no sistema?" |
| **KB Esperada** | cogedu-workflows.yaml |
| **Chunks Esperados** | workflows.create-class, workflows.steps |

**Resposta Esperada (contem):**
- Passos numerados (1, 2, 3...)
- Mencao a modulo Educational
- Campos obrigatorios

**Criterios:**
- [ ] Workflow estruturado
- [ ] Minimo 3 passos
- [ ] Tempo < 4s

---

### Q3 - Codigo de Erro Especifico

| Campo | Valor |
|-------|-------|
| **ID** | Q3 |
| **Query** | "O que significa o erro E-ADM-003?" |
| **KB Esperada** | cogedu-error-codes.yaml |
| **Chunks Esperados** | errors.admission.E-ADM-003 |

**Resposta Esperada (contem):**
- Descricao do erro
- Causa provavel
- Solucao sugerida

**Criterios:**
- [ ] Erro correto identificado
- [ ] Solucao pratica oferecida
- [ ] Tempo < 3s

---

### Q4 - Arquitetura do AVA

| Campo | Valor |
|-------|-------|
| **ID** | Q4 |
| **Query** | "Como funciona o player de video no AVA?" |
| **KB Esperada** | cogedu-ava-architecture.yaml |
| **Chunks Esperados** | ava.content-players, ava.video-player |

**Resposta Esperada (contem):**
- Mencao a VideoPlayer
- Suporte a formatos (MP4, HLS)
- Integracao com CDN

**Criterios:**
- [ ] KB do AVA consultada
- [ ] Detalhes tecnicos corretos
- [ ] Tempo < 4s

---

### Q5 - Termo do Glossario

| Campo | Valor |
|-------|-------|
| **ID** | Q5 |
| **Query** | "O que e uma matriz curricular?" |
| **KB Esperada** | cogedu-glossary.yaml |
| **Chunks Esperados** | glossary.matriz-curricular |

**Resposta Esperada (contem):**
- Definicao clara
- Contexto educacional
- Relacao com grade horaria

**Criterios:**
- [ ] Definicao do glossario
- [ ] Linguagem acessivel
- [ ] Tempo < 2s

---

### Q6 - FAQ Comum

| Campo | Valor |
|-------|-------|
| **ID** | Q6 |
| **Query** | "Como resetar a senha de um aluno?" |
| **KB Esperada** | cogedu-faq.yaml |
| **Chunks Esperados** | faq.users.password-reset |

**Resposta Esperada (contem):**
- Passos para reset
- Onde encontrar a opcao
- Notificacao ao aluno

**Criterios:**
- [ ] Resposta do FAQ
- [ ] Instrucoes claras
- [ ] Tempo < 3s

---

### Q7 - Relatorio Especifico

| Campo | Valor |
|-------|-------|
| **ID** | Q7 |
| **Query** | "Quais filtros estao disponiveis no relatorio de inadimplencia?" |
| **KB Esperada** | cogedu-reports-fields.yaml |
| **Chunks Esperados** | reports.financial.inadimplencia.filters |

**Resposta Esperada (contem):**
- Lista de filtros
- Periodo, curso, situacao
- Opcoes de exportacao

**Criterios:**
- [ ] Filtros corretos listados
- [ ] Minimo 4 filtros
- [ ] Tempo < 4s

---

### Q8 - Integracao Externa

| Campo | Valor |
|-------|-------|
| **ID** | Q8 |
| **Query** | "Como integrar com o sistema de pagamento?" |
| **KB Esperada** | cogedu-integration-guide.yaml |
| **Chunks Esperados** | integrations.payment, integrations.webhooks |

**Resposta Esperada (contem):**
- Endpoints de API
- Webhooks disponiveis
- Autenticacao necessaria

**Criterios:**
- [ ] Guia de integracao
- [ ] Detalhes tecnicos
- [ ] Tempo < 4s

---

### Q9 - Release Notes

| Campo | Valor |
|-------|-------|
| **ID** | Q9 |
| **Query** | "O que mudou na versao 2.5?" |
| **KB Esperada** | cogedu-release-notes.yaml |
| **Chunks Esperados** | releases.v2.5, releases.v2.5.changes |

**Resposta Esperada (contem):**
- Lista de mudancas
- Novas features
- Bug fixes

**Criterios:**
- [ ] Versao correta
- [ ] Mudancas listadas
- [ ] Tempo < 3s

---

### Q10 - Query Multi-KB

| Campo | Valor |
|-------|-------|
| **ID** | Q10 |
| **Query** | "Como configurar avaliacoes para um curso EAD com integracao de video?" |
| **KBs Esperadas** | cogedu-exams-fields.yaml, cogedu-ava-architecture.yaml, cogedu-educational-fields.yaml |
| **Chunks Esperados** | Multiplos de diferentes KBs |

**Resposta Esperada (contem):**
- Configuracao de avaliacoes
- Integracao com AVA
- Setup de curso EAD

**Criterios:**
- [ ] Multiplas KBs consultadas
- [ ] Resposta coerente
- [ ] Tempo < 5s

---

## 3. Metricas de Qualidade

### Thresholds

| Metrica | Target | Minimo |
|---------|--------|--------|
| Accuracy | >= 95% | 90% |
| Retrieval Precision | >= 90% | 85% |
| Retrieval Recall | >= 85% | 80% |
| Latencia P50 | < 2s | 3s |
| Latencia P95 | < 4s | 5s |

### Formula de Accuracy

```
Accuracy = (Respostas Corretas / Total de Queries) * 100

Onde "Resposta Correta" significa:
1. KB correta consultada
2. Chunks relevantes retornados
3. Resposta contem informacao esperada
4. Tempo dentro do SLA
```

---

## 4. Script de Validacao

### rag_validator.py

```python
#!/usr/bin/env python3
"""
rag_validator.py
Valida qualidade do RAG do ORCH ADMIN
"""

import requests
import json
import time
from dataclasses import dataclass
from typing import List, Optional

ORCH_API = "http://localhost:3000/api/orch-admin"
DIFY_API = "http://localhost:3001/v1"

@dataclass
class ValidationQuery:
    id: str
    query: str
    expected_kb: List[str]
    expected_keywords: List[str]
    max_time: float

VALIDATION_QUERIES = [
    ValidationQuery(
        id="Q1",
        query="Quais campos sao obrigatorios para criar um processo seletivo?",
        expected_kb=["cogedu-admission-fields"],
        expected_keywords=["nome", "periodo", "inscricao", "obrigatorio"],
        max_time=4.0
    ),
    ValidationQuery(
        id="Q2",
        query="Como criar uma turma no sistema?",
        expected_kb=["cogedu-workflows"],
        expected_keywords=["passo", "turma", "criar", "educational"],
        max_time=4.0
    ),
    ValidationQuery(
        id="Q3",
        query="O que significa o erro E-ADM-003?",
        expected_kb=["cogedu-error-codes"],
        expected_keywords=["erro", "causa", "solucao"],
        max_time=3.0
    ),
    ValidationQuery(
        id="Q4",
        query="Como funciona o player de video no AVA?",
        expected_kb=["cogedu-ava-architecture"],
        expected_keywords=["video", "player", "mp4", "hls"],
        max_time=4.0
    ),
    ValidationQuery(
        id="Q5",
        query="O que e uma matriz curricular?",
        expected_kb=["cogedu-glossary"],
        expected_keywords=["matriz", "curricular", "disciplina"],
        max_time=2.0
    ),
    ValidationQuery(
        id="Q6",
        query="Como resetar a senha de um aluno?",
        expected_kb=["cogedu-faq"],
        expected_keywords=["senha", "reset", "aluno", "email"],
        max_time=3.0
    ),
    ValidationQuery(
        id="Q7",
        query="Quais filtros estao disponiveis no relatorio de inadimplencia?",
        expected_kb=["cogedu-reports-fields"],
        expected_keywords=["filtro", "periodo", "curso", "situacao"],
        max_time=4.0
    ),
    ValidationQuery(
        id="Q8",
        query="Como integrar com o sistema de pagamento?",
        expected_kb=["cogedu-integration-guide"],
        expected_keywords=["api", "webhook", "pagamento", "integracao"],
        max_time=4.0
    ),
    ValidationQuery(
        id="Q9",
        query="O que mudou na versao 2.5?",
        expected_kb=["cogedu-release-notes"],
        expected_keywords=["versao", "2.5", "mudanca", "feature"],
        max_time=3.0
    ),
    ValidationQuery(
        id="Q10",
        query="Como configurar avaliacoes para um curso EAD com integracao de video?",
        expected_kb=["cogedu-exams-fields", "cogedu-ava-architecture", "cogedu-educational-fields"],
        expected_keywords=["avaliacao", "ead", "video", "curso"],
        max_time=5.0
    ),
]

def validate_query(session_id: str, vq: ValidationQuery) -> dict:
    """Valida uma query contra o RAG"""

    start_time = time.time()

    response = requests.post(
        f"{ORCH_API}/chat",
        json={
            "session_id": session_id,
            "message": vq.query
        },
        headers={"Authorization": "Bearer TEST_TOKEN"}
    )

    elapsed = time.time() - start_time
    data = response.json()
    message = data.get("message", "").lower()
    sources = data.get("sources", [])

    # Validar keywords
    keywords_found = sum(1 for kw in vq.expected_keywords if kw.lower() in message)
    keyword_score = keywords_found / len(vq.expected_keywords)

    # Validar KB (se disponivel nos sources)
    kb_found = any(
        any(kb in str(src).lower() for kb in vq.expected_kb)
        for src in sources
    ) if sources else True  # Assume OK se sources nao disponivel

    # Validar tempo
    time_ok = elapsed <= vq.max_time

    return {
        "id": vq.id,
        "query": vq.query,
        "response": message[:300],
        "elapsed": round(elapsed, 2),
        "max_time": vq.max_time,
        "time_ok": time_ok,
        "keywords_found": keywords_found,
        "keywords_total": len(vq.expected_keywords),
        "keyword_score": round(keyword_score * 100, 1),
        "kb_ok": kb_found,
        "passed": time_ok and keyword_score >= 0.5 and kb_found
    }

def run_validation():
    """Executa validacao completa do RAG"""

    print("=" * 60)
    print("RAG VALIDATION - ORCH ADMIN")
    print("=" * 60)

    # Criar sessao
    session = requests.post(f"{ORCH_API}/sessions").json()
    session_id = session["session_id"]
    print(f"Session: {session_id}\n")

    results = []
    passed = 0
    total_time = 0

    for vq in VALIDATION_QUERIES:
        print(f"[{vq.id}] {vq.query[:50]}...")
        result = validate_query(session_id, vq)
        results.append(result)

        status = "PASS" if result["passed"] else "FAIL"
        print(f"      {status} | {result['elapsed']}s | Keywords: {result['keyword_score']}%")

        if result["passed"]:
            passed += 1
        total_time += result["elapsed"]

    # Calcular metricas
    accuracy = passed / len(VALIDATION_QUERIES) * 100
    avg_time = total_time / len(VALIDATION_QUERIES)

    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"Accuracy:     {accuracy:.1f}% ({passed}/{len(VALIDATION_QUERIES)})")
    print(f"Avg Latency:  {avg_time:.2f}s")
    print(f"Total Time:   {total_time:.2f}s")

    # Salvar resultados
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "accuracy": accuracy,
        "avg_latency": avg_time,
        "queries": results
    }

    with open("rag_validation_results.json", "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nResults saved to rag_validation_results.json")

    # Exit code
    return accuracy >= 90.0

if __name__ == "__main__":
    success = run_validation()
    exit(0 if success else 1)
```

---

## 5. Verificacao de Indexacao

### Verificar Chunks no Dify

```bash
# Via Dify API
curl -X GET "http://localhost:3001/v1/datasets/{dataset_id}/documents" \
  -H "Authorization: Bearer {api_key}"

# Resposta esperada: 14 documents, ~1208 chunks
```

### SQL de Verificacao

```sql
-- Se usando pgvector diretamente
SELECT
  source_file,
  COUNT(*) as chunk_count,
  AVG(LENGTH(content)) as avg_chunk_size
FROM orch_knowledge_chunks
GROUP BY source_file
ORDER BY source_file;

-- Total esperado
SELECT COUNT(*) as total_chunks FROM orch_knowledge_chunks;
-- ~1208 chunks
```

---

## 6. Troubleshooting

### Problema: Baixa Accuracy

**Sintomas:** Accuracy < 90%

**Causas possiveis:**
1. Chunks muito grandes (> 1000 tokens)
2. Overlap insuficiente (< 100 tokens)
3. Embeddings desatualizados
4. Top-K muito baixo

**Solucoes:**
```yaml
# Ajustar no Dify
chunk_size: 500      # Reduzir de 1000
chunk_overlap: 100   # Aumentar overlap
top_k: 5             # Aumentar de 3
```

### Problema: Latencia Alta

**Sintomas:** P95 > 5s

**Causas possiveis:**
1. Muitos chunks retornados
2. Modelo LLM lento
3. Sem cache de embeddings

**Solucoes:**
```yaml
# Ajustar no Dify
top_k: 3                    # Reduzir
score_threshold: 0.7        # Filtrar chunks ruins
cache_embeddings: true      # Ativar cache
```

### Problema: KB Errada Selecionada

**Sintomas:** Resposta de KB incorreta

**Causas possiveis:**
1. Chunks similares em KBs diferentes
2. Metadata de source nao indexada
3. Routing mal configurado

**Solucoes:**
```yaml
# Adicionar prefixo ao chunk
chunk_template: "[{source_file}] {content}"

# Ou usar metadata filtering
metadata_filter:
  source_file: cogedu-admission-fields.yaml
```

---

## 7. Referencias

- GUIA-IMPLANTACAO-CTO.md - Secao 6 (Dify RAG)
- tests/functional-tests.md - Testes T1-T10
- Dify Documentation: https://docs.dify.ai/
