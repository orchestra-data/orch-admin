# ORCH Admin - Dify RAG Setup

Configuração do Dify como backend RAG para o ORCH Admin.

## Pré-requisitos

- Docker e Docker Compose
- OpenAI API Key (para embeddings e LLM)
- Node.js 18+ (para script de setup)

## Quick Start

### 1. Iniciar Dify

```bash
cd dify

# Copiar variáveis de ambiente
cp .env.example .env

# Editar .env e adicionar OPENAI_API_KEY
nano .env

# Iniciar containers
docker-compose up -d

# Verificar status
docker-compose ps
```

Acesse http://localhost:3001 e crie uma conta.

### 2. Obter API Key

1. Faça login no console Dify
2. Vá em **Settings** > **API Keys**
3. Clique em **Create new API key**
4. Copie a chave (começa com `sk-`)

### 3. Upload da Knowledge Base

```bash
# Instalar dependências
npm install ts-node typescript @types/node

# Executar script de upload
DIFY_API_KEY=sk-xxx npx ts-node setup-knowledge-base.ts
```

O script vai:
- Criar dataset "ORCH Admin Knowledge Base"
- Upload dos 14 arquivos YAML
- Indexar automaticamente

### 4. Criar App de Chat

1. No console Dify, vá em **Studio** > **Create App**
2. Escolha **Chat App**
3. Importe `orch-admin-app.json` ou configure manualmente:

**Model Settings:**
- Provider: OpenAI
- Model: gpt-4o-mini
- Temperature: 0.3
- Max tokens: 1024

**Context:**
- Attach dataset "ORCH Admin Knowledge Base"
- Search method: Hybrid Search
- Top K: 5

**Pre-prompt:** (veja orch-admin-app.json)

4. Clique em **Publish**
5. Vá em **API Access** e copie a API key do app

### 5. Configurar Cogedu

Adicione ao `.env` do backend Cogedu:

```bash
DIFY_API_URL=http://localhost:3001/v1
DIFY_ORCH_ADMIN_API_KEY=app-xxx
```

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `docker-compose.yml` | Stack Dify completa |
| `nginx.conf` | Reverse proxy config |
| `.env.example` | Template de variáveis |
| `setup-knowledge-base.ts` | Script de upload |
| `orch-admin-app.json` | Configuração do app |

## Estrutura Docker

```
┌─────────────────────────────────────────────┐
│                  nginx:80                    │
│              (reverse proxy)                 │
└─────────────┬───────────────┬───────────────┘
              │               │
    ┌─────────▼─────┐ ┌───────▼───────┐
    │   dify-web    │ │   dify-api    │
    │   (console)   │ │   (backend)   │
    └───────────────┘ └───────┬───────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼───────┐   ┌─────────▼─────────┐   ┌───────▼───────┐
│   PostgreSQL  │   │      Redis        │   │   Weaviate    │
│   (metadata)  │   │     (cache)       │   │   (vectors)   │
└───────────────┘   └───────────────────┘   └───────────────┘
```

## Knowledge Base (14 arquivos)

| Arquivo | Tamanho | Conteúdo |
|---------|---------|----------|
| cogedu-educational-fields.yaml | 117KB | Módulo educacional |
| cogedu-exams-fields.yaml | 89KB | Módulo avaliações |
| cogedu-users-fields.yaml | 69KB | Módulo usuários |
| cogedu-admission-fields.yaml | 62KB | Módulo admissão |
| cogedu-pages-guide.yaml | 46KB | Índice de páginas |
| cogedu-workflows.yaml | 37KB | Workflows passo-a-passo |
| cogedu-ava-api-endpoints.yaml | 31KB | AVA: endpoints |
| cogedu-ava-data-schema.yaml | 29KB | AVA: schema |
| zodiac-personas.yaml | 27KB | Perfis comportamentais |
| cogedu-data-schema.yaml | 21KB | Schema do banco |
| cogedu-ava-architecture.yaml | 18KB | AVA: arquitetura |
| cogedu-ava-pages-routes.yaml | 15KB | AVA: rotas |
| orch-memory-schema.yaml | 15KB | Schema memória |
| orch-proactive-alerts.yaml | 12KB | Regras de alertas |

## Troubleshooting

### Dify não inicia
```bash
# Ver logs
docker-compose logs -f api

# Reiniciar
docker-compose down && docker-compose up -d
```

### Erro de OpenAI API
- Verifique se `OPENAI_API_KEY` está correto no `.env`
- Verifique se a key tem créditos disponíveis

### Documents não indexam
- Aguarde alguns minutos (indexação é assíncrona)
- Verifique no console Dify > Knowledge > dataset > Documents

### API retorna 401
- Verifique se está usando a API key do **App** (não do console)
- A key do app começa com `app-`, não `sk-`

## Produção

Para produção, altere:

1. `SECRET_KEY` no docker-compose.yml
2. Senhas do PostgreSQL e Redis
3. Configure HTTPS no nginx
4. Use volumes persistentes externos
5. Configure backup do PostgreSQL

## Links

- [Dify Documentation](https://docs.dify.ai)
- [Dify GitHub](https://github.com/langgenius/dify)
- [OpenAI API](https://platform.openai.com)
