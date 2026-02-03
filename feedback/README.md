# Orch Feedback System

Sistema de coleta e organizacao de feedback dos usuarios via Orch.

## Como Funciona

```
    +----------------------------+
    | Usuario interage com Orch  |
    +-------------+--------------+
                  |
    +-------------v--------------+
    | Orch detecta sentimento    |
    | (frustracao, confusao,     |
    |  insatisfacao, reclamacao) |
    +-------------+--------------+
                  |
    +-------------v--------------+
    | Orch pergunta:             |
    | "Notei que voce esta com   |
    |  dificuldade. Gostaria de:"|
    | 1. Sugerir funcionalidade  |
    | 2. Pedir ajuste            |
    | 3. Reportar falha          |
    +-------------+--------------+
                  |
       +----------+----------+
       |          |          |
  +----v---+ +---v----+ +---v----+
  |Feature | |Adjust  | |Bug     |
  |Request | |ment    | |Report  |
  +----+---+ +---+----+ +---+----+
       |          |          |
    +--v----------v----------v--+
    | Orch faz perguntas para   |
    | coletar detalhes          |
    +-------------+-------------+
                  |
    +-------------v--------------+
    | Grava no banco apropriado  |
    | (FAQ ou Improvements)      |
    +-------------+--------------+
                  |
    +-------------v--------------+
    | Arquivo datado gerado em   |
    | feedback/reports/          |
    +----------------------------+
```

## Estrutura

| Arquivo | Descricao |
|---------|-----------|
| `faq-bank.yaml` | Banco de perguntas frequentes (duvidas recorrentes) |
| `improvements-bank.yaml` | Banco de melhorias, ajustes e falhas reportadas |
| `reports/YYYY-MM-DD_feedback.yaml` | Relatorios diarios consolidados |

## Deteccao de Sentimento

O Orch detecta sinais de insatisfacao atraves de:

| Sinal | Exemplos |
|-------|----------|
| Palavras negativas | "nao funciona", "ta errado", "nao consigo", "odeio" |
| Repeticao | Usuario pergunta a mesma coisa varias vezes |
| Frustacao explicita | "que raiva", "complicado demais", "perdi tudo" |
| Tentativas falhas | Usuario tenta preencher/salvar e falha repetidamente |
| Confusao | "nao entendo", "pra que serve isso", "cadê o botao" |
| Abandono | Usuario muda de pagina rapidamente sem completar acao |

## Tipos de Feedback

### Feature Request (Nova Funcionalidade)
- Usuario quer algo que nao existe no sistema
- Coleta: descricao, contexto, impacto esperado

### Adjustment (Ajuste)
- Funcionalidade existe mas poderia ser melhor
- Coleta: o que existe, o que deveria mudar, por que

### Bug Report (Falha)
- Algo nao funciona como esperado
- Coleta: passos para reproduzir, esperado vs real, workaround

### UX Issue (Usabilidade)
- Interface confusa ou dificil de usar
- Coleta: o que confundiu, sugestao de melhoria

## Perguntas que o Orch Faz

Para cada tipo, o Orch faz perguntas especificas:

### Feature Request
1. "O que voce gostaria que o sistema fizesse?"
2. "Em qual pagina/tela voce sente falta disso?"
3. "Com que frequencia voce precisaria dessa funcionalidade?"
4. "Isso impacta o seu trabalho diario? Como?"

### Adjustment
1. "O que exatamente voce gostaria que fosse diferente?"
2. "Como funciona hoje e como deveria funcionar?"
3. "Isso afeta outras pessoas da sua equipe tambem?"

### Bug Report
1. "O que voce tentou fazer?"
2. "O que aconteceu de errado?"
3. "Apareceu alguma mensagem de erro?"
4. "Conseguiu contornar o problema de alguma forma?"

## Relatorios

Relatorios diarios sao gerados automaticamente em `reports/` com:
- Total de feedbacks do dia por tipo
- Top 5 paginas com mais problemas
- FAQs novas detectadas
- Melhorias mais pedidas (por frequencia)
