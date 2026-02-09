# OrchWidget - Especificacao Tecnica

> Componente React 19 para o widget de chat do Orch Admin

**Versao:** 1.0.0
**Data:** 2026-02-09
**Autor:** Squad Cogedu (Architect)

---

## 1. Visao Geral

O OrchWidget e o componente de interface do assistente Orch, integrado como nova aba "Ajuda" no CommunicationHub do Cogedu Admin.

### Responsabilidades

- Exibir mensagens de chat (user/assistant)
- Enviar mensagens para o backend via API REST
- Receber respostas via streaming SSE
- Detectar mudanca de pagina (React Router v7)
- Gerenciar sessoes de conversa
- Exibir sugestoes de perguntas contextuais

---

## 2. Arquitetura

```
CommunicationHub
└── OrchWidget (aba "Ajuda")
    ├── OrchHeader
    │   ├── Titulo "Orch - Assistente"
    │   └── Botao Reset
    ├── OrchMessageList
    │   ├── Message (user)
    │   ├── Message (assistant)
    │   └── TypingIndicator
    ├── OrchSuggestedQuestions
    │   └── QuestionChip[]
    └── OrchInputBox
        ├── Textarea (auto-resize)
        └── SendButton
```

---

## 3. Tipos TypeScript

```typescript
// OrchWidget.types.ts

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    source?: 'cache' | 'primary' | 'fallback';
    tokensUsed?: number;
  };
}

export interface OrchSession {
  id: string;
  startedAt: Date;
  pageUrl: string;
  messages: Message[];
}

export interface WidgetConfig {
  position: 'bottom-right';
  appearance: {
    icon: string;
    label: string;
    colorPrimary: string;
    colorBackground: string;
    borderRadius: string;
    width: string;
    height: string;
  };
  behavior: {
    autoOpen: boolean;
    autoDetectPage: boolean;
    sendUrlOnOpen: boolean;
    persistConversation: boolean;
    maxConversationLength: number;
    typingIndicator: boolean;
  };
  suggestedQuestions: string[];
}

export interface OrchChatRequest {
  sessionId: string;
  message: string;
  pageUrl: string;
  context?: Record<string, unknown>;
}

export interface OrchChatResponse {
  message: string;
  suggestedQuestions?: string[];
  alerts?: OrchAlert[];
  metadata?: {
    model: string;
    tokensUsed: number;
    cached: boolean;
  };
}

export interface OrchAlert {
  id: string;
  type: 'info' | 'warning' | 'critical';
  message: string;
}

export interface UseOrchChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  sessionId: string | null;
  sendMessage: (text: string) => Promise<void>;
  resetSession: () => void;
  suggestedQuestions: string[];
}
```

---

## 4. Configuracao (WIDGET_CONFIG)

```typescript
// Conforme GUIA-IMPLANTACAO-CTO.md
export const WIDGET_CONFIG: WidgetConfig = {
  position: 'bottom-right',
  appearance: {
    icon: 'help-circle',
    label: 'Precisa de ajuda?',
    colorPrimary: '#4F46E5',
    colorBackground: '#FFFFFF',
    borderRadius: '12px',
    width: '380px',
    height: '520px',
  },
  behavior: {
    autoOpen: false,
    autoDetectPage: true,
    sendUrlOnOpen: true,
    persistConversation: true,
    maxConversationLength: 50,
    typingIndicator: true,
  },
  suggestedQuestions: [
    'O que faz essa pagina?',
    'Quais campos sao obrigatorios?',
    'Me da um passo a passo',
    'Preenche pra mim',
    'Como eu faco para...?',
    'Quero sugerir uma melhoria',
  ],
};
```

---

## 5. Hook useOrchChat

```typescript
// OrchWidget.hooks.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Message, OrchChatRequest, OrchChatResponse, UseOrchChatReturn } from './OrchWidget.types';
import { WIDGET_CONFIG } from './OrchWidget.config';
import { debounce } from '@/utils/debounce';

const API_BASE = '/orch-admin';

export function useOrchChat(): UseOrchChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(
    WIDGET_CONFIG.suggestedQuestions
  );

  const location = useLocation();
  const { user, token } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Iniciar sessao
  const initSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pageUrl: location.pathname }),
      });

      const data = await response.json();
      setSessionId(data.sessionId);

      if (data.greeting) {
        setMessages([
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.greeting,
            timestamp: new Date(),
          },
        ]);
      }

      if (data.suggestedQuestions) {
        setSuggestedQuestions(data.suggestedQuestions);
      }
    } catch (err) {
      setError(err as Error);
    }
  }, [location.pathname, token]);

  // Detectar mudanca de pagina
  const sendPageContext = useCallback(
    debounce(async (pageUrl: string) => {
      if (!sessionId) return;

      try {
        await fetch(`${API_BASE}/context`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ pageUrl }),
        });
      } catch (err) {
        console.warn('Failed to send page context:', err);
      }
    }, 300),
    [sessionId, token]
  );

  useEffect(() => {
    if (WIDGET_CONFIG.behavior.autoDetectPage) {
      sendPageContext(location.pathname);
    }
  }, [location.pathname, sendPageContext]);

  // Enviar mensagem
  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId || !text.trim()) return;

      // Cancelar requisicao anterior se existir
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const request: OrchChatRequest = {
          sessionId,
          message: text,
          pageUrl: location.pathname,
        };

        const response = await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(request),
          signal: abortControllerRef.current.signal,
        });

        // Verificar se e streaming (SSE)
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('text/event-stream')) {
          await handleStreamingResponse(response);
        } else {
          // Resposta completa (blocking)
          const data: OrchChatResponse = await response.json();

          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
            metadata: data.metadata,
          };

          setMessages((prev) => [...prev, assistantMessage]);

          if (data.suggestedQuestions) {
            setSuggestedQuestions(data.suggestedQuestions);
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err as Error);
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'system',
              content: 'Desculpe, ocorreu um erro. Tente novamente.',
              timestamp: new Date(),
            },
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, location.pathname, token]
  );

  // Handler para streaming SSE
  const handleStreamingResponse = async (response: Response) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let assistantContent = '';

    const assistantMessageId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      },
    ]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          const token = line.slice(6);
          if (token === '[DONE]') break;

          assistantContent += token;
          setMessages((prev) => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: assistantContent,
            };
            return updated;
          });
        }
      }
    }
  };

  // Reset sessao
  const resetSession = useCallback(() => {
    if (sessionId) {
      fetch(`${API_BASE}/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(console.warn);
    }

    setMessages([]);
    setSessionId(null);
    setSuggestedQuestions(WIDGET_CONFIG.suggestedQuestions);
    initSession();
  }, [sessionId, token, initSession]);

  // Inicializar ao montar
  useEffect(() => {
    initSession();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    isLoading,
    error,
    sessionId,
    sendMessage,
    resetSession,
    suggestedQuestions,
  };
}
```

---

## 6. Componente OrchWidget

```tsx
// OrchWidget.tsx

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Send, RotateCcw, X } from 'lucide-react';
import { useOrchChat } from './OrchWidget.hooks';
import { WIDGET_CONFIG } from './OrchWidget.config';
import { cn } from '@/lib/utils';

export function OrchWidget() {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    resetSession,
    suggestedQuestions,
  } = useOrchChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll para ultima mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handler de envio
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  // Handler de tecla
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Click em sugestao
  const handleSuggestionClick = (question: string) => {
    sendMessage(question);
  };

  return (
    <div
      className="flex flex-col h-full bg-white"
      style={{
        width: WIDGET_CONFIG.appearance.width,
        height: WIDGET_CONFIG.appearance.height,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <HelpCircle size={20} />
          <span className="font-medium">Orch - Assistente</span>
        </div>
        <button
          onClick={resetSession}
          className="p-1 hover:bg-indigo-700 rounded"
          title="Reiniciar conversa"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <HelpCircle size={48} className="mx-auto mb-4 text-indigo-300" />
            <p>Ola! Sou o Orch, seu assistente.</p>
            <p className="text-sm">Como posso ajudar?</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-2',
                message.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : message.role === 'system'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce delay-100">.</span>
                <span className="animate-bounce delay-200">.</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && suggestedQuestions.length > 0 && (
        <div className="px-4 py-2 border-t">
          <p className="text-xs text-gray-500 mb-2">Perguntas sugeridas:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.slice(0, 3).map((q, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(q)}
                className="text-xs bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1 text-gray-700"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-100 border-t border-red-200 flex items-center justify-between">
          <span className="text-sm text-red-700">{error.message}</span>
          <button onClick={() => {}} className="text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="flex-1 resize-none border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

## 7. Integracao com CommunicationHub

```tsx
// Em CommunicationHub.tsx, adicionar nova aba:

import { OrchWidget } from './OrchWidget';
import { HelpCircle } from 'lucide-react';

const tabs = [
  // ... outras abas existentes
  {
    id: 'orch',
    label: 'Ajuda',
    icon: HelpCircle,
    component: OrchWidget,
  },
];
```

---

## 8. Tratamento de Erros

| Erro | Tratamento |
|------|------------|
| Network error | "Verifique sua conexao" |
| 401 Unauthorized | Redirecionar para login |
| 429 Rate Limit | "Muitas mensagens. Aguarde..." |
| 500 Server Error | "Erro no servidor. Tente novamente." |
| Timeout (30s) | "Timeout. Tente novamente." |

---

## 9. Acessibilidade

- **Keyboard navigation:** Tab para navegar, Enter para enviar
- **ARIA labels:** `role="log"` no container de mensagens, `aria-live="polite"`
- **Contraste:** Minimo 4.5:1 (WCAG AA)
- **Focus visible:** Outline visivel em todos os elementos interativos

---

## 10. Performance

- **Debounce:** 300ms no envio de contexto de pagina
- **AbortController:** Cancela requisicoes duplicadas
- **Lazy loading:** Widget carrega apenas quando aba e aberta
- **Virtual scrolling:** Considerar para > 100 mensagens

---

## 11. Monitoramento

Eventos de analytics a registrar:

| Evento | Quando |
|--------|--------|
| `orch_widget_opened` | Aba Ajuda clicada |
| `orch_message_sent` | Usuario envia mensagem |
| `orch_message_received` | Resposta recebida |
| `orch_error` | Erro ocorre |
| `orch_suggested_question_clicked` | Sugestao clicada |
| `orch_session_reset` | Sessao reiniciada |

---

## 12. Checklist de Implementacao

- [ ] Criar `OrchWidget.types.ts`
- [ ] Criar `OrchWidget.config.ts`
- [ ] Criar `OrchWidget.hooks.ts` com `useOrchChat`
- [ ] Criar `OrchWidget.tsx`
- [ ] Criar `utils/debounce.ts`
- [ ] Integrar no CommunicationHub
- [ ] Testar streaming SSE
- [ ] Testar deteccao de navegacao
- [ ] Testar tratamento de erros
- [ ] Adicionar analytics
- [ ] Validar acessibilidade

---

## 13. Referencias

- GUIA-IMPLANTACAO-CTO.md - Secao 7 (FASE 3)
- React 19 Documentation
- React Router v7 Documentation
