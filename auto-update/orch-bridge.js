/**
 * Orch Bridge - Runtime Fallback para paginas desconhecidas
 *
 * Quando o Orch detecta uma URL que nao esta no knowledge base,
 * este script escaneia o DOM da pagina atual e gera documentacao
 * provisoria dos campos, modais e acoes encontrados.
 *
 * Integrado ao CommunicationHub via postMessage.
 *
 * USO:
 * - Carregado automaticamente pelo widget do Orch
 * - Ativado quando a pagina atual nao tem match no KB
 * - Envia resultado de volta ao Orch via postMessage
 */

(function orchBridge() {
  'use strict';

  // ============================================================================
  // CONFIG
  // ============================================================================

  const ORCH_ORIGIN = window.location.origin;
  const SCAN_DEBOUNCE_MS = 500;
  const MAX_FIELD_SCAN_DEPTH = 10;

  // ============================================================================
  // DOM SCANNER
  // ============================================================================

  /**
   * Escaneia todos os campos de formulario visiveis na pagina atual.
   * Detecta inputs, selects, textareas e componentes React comuns.
   */
  function scanPageFields() {
    const fields = [];
    const seen = new Set();

    // Inputs nativos
    const inputs = document.querySelectorAll(
      'input[name], input[id], select[name], select[id], textarea[name], textarea[id]'
    );

    inputs.forEach((el) => {
      const name = el.getAttribute('name') || el.getAttribute('id') || '';
      if (!name || seen.has(name)) return;
      seen.add(name);

      const label = findLabelForElement(el);
      const type = el.tagName.toLowerCase() === 'select'
        ? 'select'
        : el.tagName.toLowerCase() === 'textarea'
          ? 'textarea'
          : el.getAttribute('type') || 'text';

      const field = {
        name: name,
        label: label || name,
        type: type,
        required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
        placeholder: el.getAttribute('placeholder') || '',
        visible: isElementVisible(el),
        value_present: !!el.value,
      };

      // Opcoes de selects
      if (type === 'select') {
        const options = Array.from(el.querySelectorAll('option'))
          .map((opt) => opt.textContent.trim())
          .filter((text) => text && text !== '');
        if (options.length > 0) {
          field.options = options;
        }
      }

      fields.push(field);
    });

    // Radix UI / Custom components (data-attributes comuns)
    const radixInputs = document.querySelectorAll(
      '[data-radix-collection-item], [role="combobox"], [role="listbox"], [role="switch"], [role="checkbox"], [role="slider"]'
    );

    radixInputs.forEach((el) => {
      const name = el.getAttribute('name') ||
        el.getAttribute('aria-label') ||
        el.getAttribute('data-name') || '';
      if (!name || seen.has(name)) return;
      seen.add(name);

      fields.push({
        name: name,
        label: findLabelForElement(el) || name,
        type: el.getAttribute('role') || 'custom',
        required: el.getAttribute('aria-required') === 'true',
        placeholder: '',
        visible: isElementVisible(el),
        value_present: false,
      });
    });

    return fields;
  }

  /**
   * Escaneia modais/dialogs abertos ou presentes no DOM.
   */
  function scanPageModals() {
    const modals = [];

    // Radix Dialog / AlertDialog / Sheet
    const dialogSelectors = [
      '[role="dialog"]',
      '[role="alertdialog"]',
      '[data-state="open"][data-radix-dialog-content]',
      '[data-state="open"][data-radix-alert-dialog-content]',
      '.fixed.inset-0', // Common overlay pattern
    ];

    dialogSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        const title = el.querySelector('[data-radix-dialog-title], h2, h3, [role="heading"]');
        const titleText = title ? title.textContent.trim() : 'Modal sem titulo';

        // Scan fields inside modal
        const modalFields = [];
        const modalInputs = el.querySelectorAll('input[name], select[name], textarea[name]');
        modalInputs.forEach((input) => {
          modalFields.push({
            name: input.getAttribute('name') || '',
            label: findLabelForElement(input) || input.getAttribute('name') || '',
            type: input.tagName.toLowerCase() === 'select'
              ? 'select'
              : input.getAttribute('type') || 'text',
            required: input.hasAttribute('required'),
          });
        });

        // Scan buttons inside modal
        const modalButtons = [];
        el.querySelectorAll('button').forEach((btn) => {
          const text = btn.textContent.trim();
          if (text && text.length < 50) {
            modalButtons.push(text);
          }
        });

        modals.push({
          name: titleText,
          visible: isElementVisible(el),
          fields: modalFields,
          actions: modalButtons,
        });
      });
    });

    return modals;
  }

  /**
   * Escaneia botoes de acao na pagina.
   */
  function scanPageActions() {
    const actions = [];
    const seen = new Set();

    document.querySelectorAll('button, [role="button"], a.btn, a[class*="button"]').forEach((el) => {
      // Ignorar botoes dentro de modais fechados
      const closedModal = el.closest('[data-state="closed"]');
      if (closedModal) return;

      const text = el.textContent.trim();
      if (!text || text.length > 60 || seen.has(text)) return;
      seen.add(text);

      // Ignorar botoes de navegacao genericos
      const ignorePatterns = ['close', 'fechar', 'x', 'menu', 'toggle'];
      if (ignorePatterns.some((p) => text.toLowerCase() === p)) return;

      actions.push({
        text: text,
        type: el.tagName.toLowerCase(),
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
        visible: isElementVisible(el),
      });
    });

    return actions;
  }

  /**
   * Scan completo da pagina - campos, modais e acoes.
   */
  function fullPageScan() {
    return {
      url: window.location.pathname,
      timestamp: new Date().toISOString(),
      title: document.title || '',
      heading: getPageHeading(),
      fields: scanPageFields(),
      modals: scanPageModals(),
      actions: scanPageActions(),
      meta: {
        has_form: document.querySelector('form') !== null,
        has_table: document.querySelector('table, [role="grid"]') !== null,
        has_tabs: document.querySelector('[role="tablist"]') !== null,
        has_search: document.querySelector('input[type="search"], input[placeholder*="buscar"], input[placeholder*="pesquisar"]') !== null,
      },
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  function findLabelForElement(el) {
    // 1. Label via for attribute
    const id = el.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent.trim();
    }

    // 2. Parent label
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const text = parentLabel.textContent.trim();
      // Remove o valor do input do texto do label
      const inputValue = el.value || '';
      return text.replace(inputValue, '').trim();
    }

    // 3. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // 4. aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl) return labelEl.textContent.trim();
    }

    // 5. Previous sibling label
    const prev = el.previousElementSibling;
    if (prev && prev.tagName === 'LABEL') {
      return prev.textContent.trim();
    }

    // 6. Parent container with label-like class
    const container = el.closest('[class*="field"], [class*="form-group"], [class*="input"]');
    if (container) {
      const label = container.querySelector('label, [class*="label"], span:first-child');
      if (label && label !== el) return label.textContent.trim();
    }

    return '';
  }

  function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      el.offsetParent !== null
    );
  }

  function getPageHeading() {
    const h1 = document.querySelector('h1');
    if (h1) return h1.textContent.trim();

    const h2 = document.querySelector('main h2, [role="main"] h2, #root h2');
    if (h2) return h2.textContent.trim();

    return '';
  }

  // ============================================================================
  // FIELD FILLING (React 19 compatible)
  // ============================================================================

  /**
   * Preenche um campo de formulario de forma compativel com React 19.
   * Usa o setter nativo do prototype para disparar re-renders.
   */
  function fillField(selector, value) {
    const el = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;

    if (!el) {
      return { success: false, error: 'Elemento nao encontrado' };
    }

    try {
      const tagName = el.tagName.toLowerCase();

      if (tagName === 'select') {
        // Select: set value and dispatch change
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype, 'value'
        ).set;
        nativeSetter.call(el, value);
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (tagName === 'input' && (el.type === 'checkbox' || el.type === 'radio')) {
        // Checkbox/Radio: toggle checked
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype, 'checked'
        ).set;
        nativeSetter.call(el, value === true || value === 'true');
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('click', { bubbles: true }));
      } else {
        // Text inputs / textarea: use native value setter
        const proto = tagName === 'textarea'
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;

        // Focus first
        el.dispatchEvent(new Event('focus', { bubbles: true }));

        // Set value via native setter (triggers React internal tracking)
        nativeSetter.call(el, value);

        // Dispatch events in order React expects
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }

      return { success: true, field: el.getAttribute('name') || el.id, value: value };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Preenche multiplos campos de uma vez.
   */
  function fillMultipleFields(fieldMap) {
    const results = [];

    for (const [selector, value] of Object.entries(fieldMap)) {
      const result = fillField(
        selector.startsWith('[') || selector.startsWith('#') || selector.startsWith('.')
          ? selector
          : `[name="${selector}"]`,
        value
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Limpa um campo de formulario.
   */
  function clearField(selector) {
    return fillField(selector, '');
  }

  /**
   * Le o estado atual de todos os campos do formulario.
   */
  function getFormState() {
    const state = {};
    const form = document.querySelector('form');
    const container = form || document.querySelector('main, [role="main"], #root');

    if (!container) return state;

    container.querySelectorAll('input[name], select[name], textarea[name]').forEach((el) => {
      const name = el.getAttribute('name');
      if (!name) return;

      if (el.type === 'checkbox' || el.type === 'radio') {
        state[name] = el.checked;
      } else {
        state[name] = el.value;
      }
    });

    return state;
  }

  // ============================================================================
  // MESSAGE HANDLER
  // ============================================================================

  /**
   * Escuta mensagens do widget Orch no CommunicationHub.
   */
  function handleMessage(event) {
    // Verificar origem
    if (event.origin !== ORCH_ORIGIN) return;

    const { type, payload } = event.data || {};

    switch (type) {
      case 'ORCH_SCAN_PAGE': {
        const result = fullPageScan();
        event.source.postMessage({
          type: 'ORCH_SCAN_RESULT',
          payload: result,
        }, event.origin);
        break;
      }

      case 'ORCH_READ_FIELDS': {
        const fields = scanPageFields();
        event.source.postMessage({
          type: 'ORCH_FIELDS_RESULT',
          payload: { url: window.location.pathname, fields },
        }, event.origin);
        break;
      }

      case 'ORCH_FILL_FIELD': {
        const { selector, value } = payload || {};
        const result = fillField(selector, value);
        event.source.postMessage({
          type: 'ORCH_FILL_RESULT',
          payload: result,
        }, event.origin);
        break;
      }

      case 'ORCH_FILL_MULTIPLE': {
        const results = fillMultipleFields(payload || {});
        event.source.postMessage({
          type: 'ORCH_FILL_MULTIPLE_RESULT',
          payload: { results },
        }, event.origin);
        break;
      }

      case 'ORCH_CLEAR_FIELD': {
        const { selector } = payload || {};
        const result = clearField(selector);
        event.source.postMessage({
          type: 'ORCH_CLEAR_RESULT',
          payload: result,
        }, event.origin);
        break;
      }

      case 'ORCH_GET_FORM_STATE': {
        const state = getFormState();
        event.source.postMessage({
          type: 'ORCH_FORM_STATE_RESULT',
          payload: { url: window.location.pathname, state },
        }, event.origin);
        break;
      }

      case 'ORCH_GET_PAGE_INFO': {
        event.source.postMessage({
          type: 'ORCH_PAGE_INFO_RESULT',
          payload: {
            url: window.location.pathname,
            title: document.title,
            heading: getPageHeading(),
          },
        }, event.origin);
        break;
      }

      default:
        break;
    }
  }

  // ============================================================================
  // URL CHANGE DETECTION
  // ============================================================================

  let lastUrl = window.location.pathname;

  /**
   * Detecta mudancas de URL (SPA navigation) e notifica o Orch.
   */
  function watchUrlChanges() {
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.pathname;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        // Notifica o Orch que a pagina mudou
        window.postMessage({
          type: 'ORCH_URL_CHANGED',
          payload: {
            url: currentUrl,
            title: document.title,
            heading: getPageHeading(),
          },
        }, ORCH_ORIGIN);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Tambem intercepta pushState/replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function () {
      originalPushState.apply(this, arguments);
      const currentUrl = window.location.pathname;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        window.postMessage({
          type: 'ORCH_URL_CHANGED',
          payload: { url: currentUrl, title: document.title },
        }, ORCH_ORIGIN);
      }
    };

    history.replaceState = function () {
      originalReplaceState.apply(this, arguments);
      const currentUrl = window.location.pathname;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        window.postMessage({
          type: 'ORCH_URL_CHANGED',
          payload: { url: currentUrl, title: document.title },
        }, ORCH_ORIGIN);
      }
    };

    // popstate (back/forward)
    window.addEventListener('popstate', () => {
      const currentUrl = window.location.pathname;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        window.postMessage({
          type: 'ORCH_URL_CHANGED',
          payload: { url: currentUrl, title: document.title },
        }, ORCH_ORIGIN);
      }
    });
  }

  // ============================================================================
  // INIT
  // ============================================================================

  function init() {
    window.addEventListener('message', handleMessage);
    watchUrlChanges();

    // Expose API for direct access (when Orch runs in same context)
    window.__orchBridge = {
      scanPageFields,
      scanPageModals,
      scanPageActions,
      fullPageScan,
      fillField,
      fillMultipleFields,
      clearField,
      getFormState,
      getPageHeading,
    };

    console.log('[Orch Bridge] Initialized - listening for messages');
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
