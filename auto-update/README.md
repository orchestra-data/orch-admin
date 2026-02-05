# Orch Auto-Update System

Sistema hibrido para manter o knowledge base do Orch atualizado automaticamente.

## Arquitetura

```
                    +------------------+
                    |   Dev faz push   |
                    |   no Cogedu      |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  CI/CD Pipeline   |
                    |  (GitHub Action)  |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  orch-scanner.ts  |  <-- Escaneia router.tsx + componentes
                    |  (AST Parser)     |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Compara com      |
                    |  YAML atual       |
                    +--------+---------+
                             |
                  +----------+----------+
                  |                     |
          +-------v-------+    +-------v--------+
          | Sem mudancas   |    | Mudancas       |
          | (skip)         |    | detectadas     |
          +---------------+    +-------+--------+
                                       |
                              +--------v---------+
                              |  Atualiza YAML   |
                              |  + Commit + Push  |
                              +--------+---------+
                                       |
                              +--------v---------+
                              |  Webhook -> RAG   |
                              |  Reindexar        |
                              +------------------+


    === RUNTIME FALLBACK ===

          +------------------+
          | Funcionario abre |
          | pagina nova      |
          +--------+---------+
                   |
          +--------v---------+
          | Orch recebe URL  |
          | desconhecida     |
          +--------+---------+
                   |
          +--------v---------+
          | read_page_fields |
          | (DOM scan)       |
          +--------+---------+
                   |
          +--------v---------+
          | Gera doc          |
          | provisoria        |
          +--------+---------+
                   |
          +--------v---------+
          | Notifica admin   |
          | para review      |
          +------------------+
```

## Componentes

| Componente | Tipo | Descricao |
|-----------|------|-----------|
| `orch-scanner.ts` | Script Node.js | Escaneia codebase via REGEX e extrai rotas/campos (ver limitacoes no arquivo) |
| `orch-update.yml` | GitHub Action | Pipeline CI/CD que roda o scanner |
| `orch-bridge.js` | Script browser | Runtime fallback no widget |
| `unknown-pages-log` | API endpoint | Registra paginas desconhecidas |
