# orch-bridge.js - Especificacao Tecnica

> Bridge de comunicacao DOM para o Orch Admin

**Versao:** 1.0.0
**Data:** 2026-02-09
**Autor:** Squad Cogedu (Architect)

---

## 1. Visao Geral

O `orch-bridge.js` e um script que roda na pagina do Cogedu e permite ao widget Orch:
- **Ler** campos do formulario atual
- **Preencher** campos com valores fornecidos pelo usuario
- **Detectar** mudancas de pagina (React Router)
- **Comunicar** via postMessage com o widget

---

## 2. Protocolo de Comunicacao

### Canal

```javascript
window.postMessage({ channel: 'orch-page-guide', ... }, '*')
```

### Eventos Widget → Pagina

| Evento | Payload | Descricao |
|--------|---------|-----------|
| `SCAN_PAGE` | `{}` | Escanear todos os campos da pagina |
| `READ_FIELDS` | `{}` | Ler valores atuais dos campos |
| `FILL_FIELD` | `{ fieldName, value }` | Preencher um campo |
| `CLEAR_FIELD` | `{ fieldName }` | Limpar um campo |
| `GET_FIELD_OPTIONS` | `{ fieldName }` | Opcoes de um select |
| `GET_FORM_STATE` | `{}` | Estado completo do form |
| `HANDSHAKE` | `{}` | Iniciar comunicacao |

### Eventos Pagina → Widget

| Evento | Payload | Descricao |
|--------|---------|-----------|
| `HANDSHAKE_ACK` | `{ channelToken }` | Confirmacao + token |
| `SCAN_RESULT` | `{ fields, modals, actions }` | Resultado do scan |
| `FIELDS_DATA` | `{ fields: [...] }` | Dados dos campos |
| `FILL_SUCCESS` | `{ fieldName, value }` | Sucesso ao preencher |
| `FILL_ERROR` | `{ fieldName, error }` | Erro ao preencher |
| `VALIDATION_ERROR` | `{ fieldName, message }` | Validacao falhou |
| `PAGE_CHANGED` | `{ url, title }` | URL mudou |
| `FIELD_OPTIONS` | `{ fieldName, options }` | Opcoes do select |

---

## 3. Compatibilidade React 19

React 19 usa synthetic events. Para que o state do React atualize ao preencher um campo via DOM:

```javascript
/**
 * Setar valor em input React 19
 * @param {HTMLInputElement} element
 * @param {string} newValue
 */
function setReactInputValue(element, newValue) {
  // Usar native setter para bypassar React controlled input
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;

  nativeInputValueSetter.call(element, newValue);

  // Disparar eventos na ordem correta
  element.dispatchEvent(new Event('focus', { bubbles: true }));
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

/**
 * Setar valor em textarea React 19
 */
function setReactTextareaValue(element, newValue) {
  const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  ).set;

  nativeTextareaSetter.call(element, newValue);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Setar valor em select React 19
 */
function setReactSelectValue(element, newValue) {
  element.value = newValue;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Setar checkbox/radio React 19
 */
function setReactCheckboxValue(element, checked) {
  element.checked = checked;
  element.dispatchEvent(new Event('click', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
```

---

## 4. Deteccao de Mudanca de Pagina

```javascript
class OrchBridge {
  constructor() {
    this.currentUrl = window.location.href;
    this.setupNavigationDetection();
  }

  setupNavigationDetection() {
    // 1. MutationObserver para mudancas no DOM
    const observer = new MutationObserver(
      this.debounce(() => {
        if (window.location.href !== this.currentUrl) {
          this.handleUrlChange();
        }
      }, 500)
    );

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 2. Interceptar history.pushState/replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleUrlChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleUrlChange();
    };

    // 3. Evento popstate (back/forward)
    window.addEventListener('popstate', () => {
      this.handleUrlChange();
    });
  }

  handleUrlChange() {
    const newUrl = window.location.href;
    if (newUrl !== this.currentUrl) {
      this.currentUrl = newUrl;
      this.sendToWidget({
        type: 'PAGE_CHANGED',
        payload: {
          url: newUrl,
          title: document.title,
          pathname: window.location.pathname,
        },
      });
    }
  }

  debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }
}
```

---

## 5. Seletores CSS

### Prioridade de Busca

1. Seletor CSS direto (se fornecido)
2. `[name="fieldName"]`
3. `#fieldName`
4. `[data-name="fieldName"]`
5. `[data-testid="fieldName"]`

### Estrategias de Label

```javascript
function findFieldLabel(element) {
  // 1. Label com for="id"
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.textContent.trim();
  }

  // 2. Label pai
  const parentLabel = element.closest('label');
  if (parentLabel) return parentLabel.textContent.trim();

  // 3. aria-label
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label');
  }

  // 4. aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const refLabel = document.getElementById(labelledBy);
    if (refLabel) return refLabel.textContent.trim();
  }

  // 5. Sibling anterior (comum em forms)
  const prevSibling = element.previousElementSibling;
  if (prevSibling?.tagName === 'LABEL') {
    return prevSibling.textContent.trim();
  }

  // 6. Placeholder como fallback
  return element.placeholder || element.name || '';
}
```

---

## 6. Auditoria de Preenchimentos

**IMPORTANTE:** Nunca armazenar valores reais. Usar hash SHA-256.

```javascript
async function logFieldFill(fieldName, value, userId, pageUrl) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const auditLog = {
    timestamp: new Date().toISOString(),
    user_id: userId,
    page_url: pageUrl,
    field_name: fieldName,
    value_hash: hashHex, // Hash, NAO o valor real
    action_type: 'fill',
    confirmed_by_user: true,
  };

  // Enviar para backend
  await fetch('/orch-admin/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auditLog),
  });
}
```

### Campos Sensiveis (Confirmacao Dupla)

```javascript
const SENSITIVE_FIELDS = [
  'cpf', 'rg', 'cnh',
  'password', 'senha',
  'card_number', 'cvv',
  'bank_account', 'pix',
  'social_security',
];

function isSensitiveField(fieldName) {
  const lower = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(f => lower.includes(f));
}
```

---

## 7. Tratamento de Erros

### Tipos de Erro

| Tipo | Descricao | Acao |
|------|-----------|------|
| `ELEMENT_NOT_FOUND` | Campo nao existe | Informar usuario |
| `INVALID_CHANNEL_TOKEN` | Token invalido | Rejeitar comando |
| `FIELD_DISABLED` | Campo desabilitado | Informar usuario |
| `FIELD_READONLY` | Campo somente leitura | Informar usuario |
| `VALIDATION_ERROR` | Valor invalido | Mostrar mensagem |
| `TIMEOUT` | Operacao demorou | Tentar novamente |
| `PERMISSION_DENIED` | Sem permissao | Informar usuario |

### Timeouts

```javascript
const TIMEOUTS = {
  HANDSHAKE: 5000,   // 5s para handshake
  SCAN: 3000,        // 3s para scan
  FILL: 2000,        // 2s para preencher
  DEFAULT: 10000,    // 10s padrao
};
```

### Retry com Backoff

```javascript
async function withRetry(fn, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}
```

---

## 8. Scan de Pagina (Fallback)

Quando a pagina nao esta mapeada nos YAML, o bridge faz scan do DOM:

```javascript
function scanPage() {
  const fields = [];
  const modals = [];
  const actions = [];

  // Campos de input
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.type === 'hidden') return;

    fields.push({
      name: el.name || el.id || '',
      type: el.type || el.tagName.toLowerCase(),
      label: findFieldLabel(el),
      value: el.value,
      required: el.required,
      disabled: el.disabled,
      placeholder: el.placeholder || '',
      options: el.tagName === 'SELECT'
        ? Array.from(el.options).map(o => ({ value: o.value, label: o.text }))
        : undefined,
    });
  });

  // Modais (Radix UI, HeadlessUI, etc)
  document.querySelectorAll('[role="dialog"], [data-state="open"]').forEach(el => {
    modals.push({
      id: el.id || '',
      title: el.querySelector('[role="heading"]')?.textContent || '',
      isOpen: true,
    });
  });

  // Acoes (botoes)
  document.querySelectorAll('button, [role="button"]').forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length < 50) {
      actions.push({
        label: text,
        type: el.type || 'button',
        disabled: el.disabled,
      });
    }
  });

  return {
    fields,
    modals,
    actions,
    meta: {
      url: window.location.href,
      title: document.title,
      hasForm: fields.length > 0,
      hasTable: !!document.querySelector('table'),
      hasTabs: !!document.querySelector('[role="tablist"]'),
    },
  };
}
```

---

## 9. Seguranca

### Same-Origin Policy

```javascript
window.addEventListener('message', (event) => {
  // Validar origem
  if (event.origin !== window.location.origin) {
    console.warn('Orch Bridge: mensagem de origem invalida', event.origin);
    return;
  }

  // Validar canal
  if (event.data?.channel !== 'orch-page-guide') {
    return;
  }

  // Processar mensagem
  handleMessage(event.data);
});
```

### Channel Token

```javascript
let channelToken = null;

function handleHandshake() {
  channelToken = crypto.randomUUID();
  sendToWidget({
    type: 'HANDSHAKE_ACK',
    payload: { channelToken },
  });
}

function validateToken(token) {
  return token === channelToken;
}

// Comandos de escrita EXIGEM token valido
function handleFillField(payload) {
  if (!validateToken(payload.token)) {
    return sendError('INVALID_CHANNEL_TOKEN');
  }
  // ... preencher
}
```

### Rate Limiting

```javascript
const rateLimiter = {
  commands: [],
  limit: 100,
  window: 60000, // 1 minuto

  check() {
    const now = Date.now();
    this.commands = this.commands.filter(t => now - t < this.window);

    if (this.commands.length >= this.limit) {
      return false;
    }

    this.commands.push(now);
    return true;
  },
};
```

---

## 10. Instalacao

```javascript
// No App.tsx ou RootLayout.tsx
useEffect(() => {
  const script = document.createElement('script');
  script.src = '/orch-bridge.js';
  script.async = true;
  document.body.appendChild(script);

  return () => {
    document.body.removeChild(script);
  };
}, []);
```

---

## 11. Implementacao Completa

```javascript
// orch-bridge.js

(function() {
  'use strict';

  const CHANNEL = 'orch-page-guide';
  let channelToken = null;
  let currentUrl = window.location.href;

  // Inicializar
  function init() {
    setupMessageListener();
    setupNavigationDetection();
    console.log('Orch Bridge initialized');
  }

  // Listener de mensagens
  function setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.channel !== CHANNEL) return;

      const { type, payload } = event.data;

      switch (type) {
        case 'HANDSHAKE':
          handleHandshake();
          break;
        case 'SCAN_PAGE':
          handleScanPage();
          break;
        case 'READ_FIELDS':
          handleReadFields();
          break;
        case 'FILL_FIELD':
          handleFillField(payload);
          break;
        case 'CLEAR_FIELD':
          handleClearField(payload);
          break;
        case 'GET_FIELD_OPTIONS':
          handleGetFieldOptions(payload);
          break;
        default:
          console.warn('Orch Bridge: comando desconhecido', type);
      }
    });
  }

  // Handlers...
  function handleHandshake() {
    channelToken = crypto.randomUUID();
    sendToWidget('HANDSHAKE_ACK', { channelToken, url: currentUrl });
  }

  function handleScanPage() {
    const result = scanPage();
    sendToWidget('SCAN_RESULT', result);
  }

  function handleReadFields() {
    const fields = scanPage().fields;
    sendToWidget('FIELDS_DATA', { fields });
  }

  function handleFillField({ fieldName, value, token }) {
    if (!validateToken(token)) {
      sendToWidget('FILL_ERROR', { fieldName, error: 'INVALID_TOKEN' });
      return;
    }

    const element = findField(fieldName);
    if (!element) {
      sendToWidget('FILL_ERROR', { fieldName, error: 'ELEMENT_NOT_FOUND' });
      return;
    }

    try {
      fillElement(element, value);
      sendToWidget('FILL_SUCCESS', { fieldName, value });
    } catch (error) {
      sendToWidget('FILL_ERROR', { fieldName, error: error.message });
    }
  }

  function handleClearField({ fieldName, token }) {
    handleFillField({ fieldName, value: '', token });
  }

  function handleGetFieldOptions({ fieldName }) {
    const element = findField(fieldName);
    if (element?.tagName === 'SELECT') {
      const options = Array.from(element.options).map(o => ({
        value: o.value,
        label: o.text,
      }));
      sendToWidget('FIELD_OPTIONS', { fieldName, options });
    }
  }

  // Utilitarios
  function sendToWidget(type, payload) {
    window.postMessage({ channel: CHANNEL, type, payload }, '*');
  }

  function validateToken(token) {
    return token === channelToken;
  }

  function findField(fieldName) {
    return (
      document.querySelector(`[name="${fieldName}"]`) ||
      document.querySelector(`#${fieldName}`) ||
      document.querySelector(`[data-name="${fieldName}"]`)
    );
  }

  function fillElement(element, value) {
    const tag = element.tagName;
    const type = element.type;

    if (tag === 'SELECT') {
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (type === 'checkbox' || type === 'radio') {
      element.checked = !!value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (tag === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
      ).set;
      setter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, 'value'
      ).set;
      setter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function scanPage() {
    // ... implementacao completa na secao 8
  }

  function setupNavigationDetection() {
    // ... implementacao completa na secao 4
  }

  // Iniciar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

---

## 12. Testes

### Unitarios (Jest)

```javascript
describe('OrchBridge', () => {
  test('handshake gera token valido', () => {
    // ...
  });

  test('fillField atualiza valor em input React 19', () => {
    // ...
  });

  test('scanPage detecta todos os campos', () => {
    // ...
  });

  test('rejeita comandos sem token', () => {
    // ...
  });
});
```

### E2E (Playwright)

```javascript
test('preencher campo via bridge', async ({ page }) => {
  await page.goto('/admission/new');

  // Enviar comando via postMessage
  await page.evaluate(() => {
    window.postMessage({
      channel: 'orch-page-guide',
      type: 'FILL_FIELD',
      payload: { fieldName: 'name', value: 'Teste', token: '...' }
    }, '*');
  });

  // Verificar que campo foi preenchido
  await expect(page.locator('[name="name"]')).toHaveValue('Teste');
});
```

---

## 13. Referencias

- GUIA-IMPLANTACAO-CTO.md - Secao 8 (FASE 4)
- React 19 Synthetic Events Documentation
- postMessage API (MDN)
