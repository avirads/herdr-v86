(() => {
  const clean = value => (value || '').replace(/\s+/g, ' ').trim();
  const visible = element => Boolean(element?.offsetWidth || element?.offsetHeight || element?.getClientRects().length);
  // True only when the element actually has a click affordance (so we never
  // offer "click X" for plain text / labels / containers).
  const clickable = element => {
    if (!element) return false;
    if (/^(A|BUTTON)$/.test(element.tagName)) return true;
    if (element.tagName === 'INPUT' && /^(button|submit|reset|checkbox|radio|image)$/i.test(element.type || '')) return true;
    const role = element.getAttribute('role') || '';
    if (/^(button|menuitem|menuitemcheckbox|menuitemradio|link|tab|option)$/i.test(role)) return true;
    if (element.hasAttribute('data-gw-click') || element.querySelector('[data-gw-click]')) return true;
    if (typeof element.onclick === 'function') return true;
    return /gw-action|gw-Button|gw-Command|gw-Link|gw-MenuItem|MenuItemWidget|TabBarLink|gw-clickable|gw-ButtonValue|gw-PickerLink|gw-CheckBox/i.test(String(element.className || ''));
  };
  const labelFor = element => {
    const id = element.id || element.name;
    const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    if (explicit) return clean(explicit.innerText);
    return clean(element.closest('.gw-InputColumnWidget, .gw-ValueWidget, .gw-InputWidget, tr, div')?.innerText || '').slice(0, 180);
  };
  const actionPattern = /Search|Reset|New|Edit|Add|Remove|Next|Back|Update|Save|Quote|Bind|Issue|Cancel|Close|Select|OK|Import|Export|Withdraw|Assign|Complete|View|Open|Download|Print|Document|Forms|Login|Log In|Submit/i;

  function pageInfo() {
    return {
      url: location.href,
      title: document.title,
      pageTitle: document.querySelector('#gw-center-title-toolbar')?.innerText || '',
      w: innerWidth,
      h: innerHeight,
      sx: scrollX,
      sy: scrollY,
      pw: document.documentElement.scrollWidth,
      ph: document.documentElement.scrollHeight
    };
  }

  function inventoryCurrentPage() {
    return {
      ...pageInfo(),
      controls: [...document.querySelectorAll('input,select,textarea')]
        .filter(visible)
        .map(element => ({
          tag: element.tagName,
          type: element.type,
          id: element.id,
          name: element.name,
          label: labelFor(element),
          value: element.type === 'password' ? '<password>' : element.value,
          checked: element.checked,
          disabled: element.disabled,
          readonly: element.readOnly,
          options: element.tagName === 'SELECT'
            ? [...element.options].map(option => ({
                value: option.value,
                text: clean(option.text),
                selected: option.selected
              })).slice(0, 80)
            : undefined
        })),
      actions: visibleActions(),
      messages: extractMessages()
    };
  }

  function extractMessages() {
    return [...document.querySelectorAll('[id$="_msgs"], .gw-message, .gw-MessagesWidget, .gw-VerbatimWidget')]
      .filter(visible)
      .map(element => clean(element.innerText))
      .filter(Boolean);
  }

  function loginStatus() {
    const controls = [...document.querySelectorAll('input,select,textarea')]
      .filter(visible)
      .map(element => ({
        tag: element.tagName,
        type: element.type,
        id: element.id,
        name: element.name,
        label: labelFor(element),
        value: element.type === 'password' ? '<password>' : element.value,
        disabled: element.disabled,
        readonly: element.readOnly
      }));
    const loginControls = controls.filter(control =>
      control.type === 'password' ||
      /Login-LoginScreen|username|password/i.test(`${control.name || ''} ${control.id || ''} ${control.label || ''}`)
    );
    const loginForm = loginControls.some(control => control.type === 'password');
    const bodyText = document.body?.innerText || '';
    const policyCenterPage = /Guidewire PolicyCenter/i.test(document.title);
    return {
      ...pageInfo(),
      loggedIn: !loginForm && policyCenterPage,
      loginForm,
      loginControls,
      userText: bodyText.match(/Super User|User:\s*[^\n]+|su\b/)?.[0] || '',
      messages: extractMessages()
    };
  }

  function localLogin(username = 'su', password = 'gw') {
    if (!/^https?:$/.test(location.protocol)) {
      return { ok: false, reason: `refusing localLogin on unsupported protocol: ${location.protocol}` };
    }
    const inputs = [...document.querySelectorAll('input')].filter(visible);
    const user = inputs.find(element => element.type !== 'password' && /user|username|login/i.test(`${element.name || ''} ${element.id || ''}`))
      || inputs.find(element => element.type === 'text');
    const pass = inputs.find(element => element.type === 'password');
    if (!user || !pass) return { ok: false, reason: 'login form not visible', status: loginStatus() };

    const setValue = (element, value) => {
      element.focus();
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setValue(user, username);
    setValue(pass, password);

    const submit = [...document.querySelectorAll('[id], button, input[type="submit"]')]
      .filter(visible)
      .find(element => /Login.*submit|Log In|Login/i.test(`${element.id || ''} ${element.innerText || ''} ${element.value || ''}`));
    if (submit) {
      const target = submit.querySelector?.('[data-gw-click]') || submit;
      if (globalThis.gwEvents?.abstractOnEvent) {
        globalThis.gwEvents.abstractOnEvent(target, new MouseEvent('click', { bubbles: true, cancelable: true, view: window }), false);
      } else {
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
      return { ok: true, submitted: 'button', status: loginStatus() };
    }

    const form = pass.closest('form');
    if (form?.requestSubmit) {
      form.requestSubmit();
      return { ok: true, submitted: 'form', status: loginStatus() };
    }
    pass.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    return { ok: true, submitted: 'enter', status: loginStatus() };
  }

  function visibleActions(pattern = actionPattern.source, limit = 240) {
    const re = new RegExp(pattern, 'i');
    return [...document.querySelectorAll('[id]')]
      .filter(element => visible(element) && re.test(`${element.id} ${element.innerText || ''}`))
      .map(element => ({
        id: element.id,
        text: clean(element.innerText).slice(0, 160),
        tag: element.tagName,
        clickable: clickable(element),
        role: element.getAttribute('role') || '',
        title: element.getAttribute('title') || '',
        ariaLabel: element.getAttribute('aria-label') || '',
        className: String(element.className || '').slice(0, 160)
      }))
      .slice(0, limit);
  }

  function findRelatedActionRoots(query = '', limit = 80) {
    const tokens = clean(query).toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2);
    const seen = new Set();
    return [...document.querySelectorAll('[id], [data-gw-click], [role="button"], [role="menuitem"], button, a')]
      .map(element => {
        const root = element.id ? element : element.closest('[id]');
        if (!root?.id || seen.has(root.id)) return null;
        seen.add(root.id);
        const target = root.querySelector?.('[data-gw-click]') || root;
        const text = clean(root.innerText || root.textContent || element.getAttribute('aria-label') || element.title || '');
        const dataGwClick = target.getAttribute?.('data-gw-click') || '';
        const haystack = `${root.id} ${text} ${root.className || ''} ${dataGwClick}`.toLowerCase();
        const tokenScore = tokens.reduce((score, token) => score + (haystack.includes(token) ? 4 : 0), 0);
        const actionScore = /gw-action|MenuItem|Button|TabBarLink|data-gw-click|fireEvent/i.test(`${root.className || ''} ${dataGwClick}`) ? 2 : 0;
        const visibleScore = visible(root) ? 1 : 0;
        const containerPenalty = /^(HTML|BODY|FORM)$/i.test(root.tagName) || /^gw-|gw-/.test(root.id) ? 8 : 0;
        const textPenalty = text.length > 80 ? 6 : 0;
        const exactTextBonus = tokens.some(token => clean(text).toLowerCase().split(/[^a-z0-9]+/).includes(token)) && text.length <= 40 ? 8 : 0;
        const leafBonus = root.querySelectorAll('[id]').length <= 1 ? 3 : 0;
        const score = tokenScore + actionScore + visibleScore + exactTextBonus + leafBonus - containerPenalty - textPenalty;
        if (!score) return null;
        return {
          id: root.id,
          text: text.slice(0, 160),
          tag: root.tagName,
          visible: visible(root),
          dataGwClick,
          role: root.getAttribute('role') || '',
          title: root.getAttribute('title') || '',
          ariaLabel: root.getAttribute('aria-label') || '',
          className: String(root.className || '').slice(0, 160),
          score,
          element: root
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || Number(b.visible) - Number(a.visible))
      .slice(0, limit);
  }

  function relatedActions(query = '', limit = 80) {
    return findRelatedActionRoots(query, limit).map(action => ({
      id: action.id,
      text: action.text,
      tag: action.tag,
      visible: action.visible,
      dataGwClick: action.dataGwClick,
      role: action.role,
      title: action.title,
      ariaLabel: action.ariaLabel,
      className: action.className,
      score: action.score
    }));
  }

  function extractGrids() {
    return {
      pageTitle: document.querySelector('#gw-center-title-toolbar')?.innerText || '',
      tables: [...document.querySelectorAll('table, .gw-ListViewWidget, .gw-IteratorEntriesWidget')]
        .filter(visible)
        .map((table, tableIndex) => ({
          tableIndex,
          id: table.id,
          headers: [...table.querySelectorAll('th, .gw-header, [role="columnheader"]')]
            .filter(visible)
            .map(header => clean(header.innerText)),
          rows: [...table.querySelectorAll('tr, [role="row"], .gw-IteratorEntryWidget')]
            .filter(visible)
            .map((row, rowIndex) => ({
              rowIndex,
              text: clean(row.innerText).slice(0, 500),
              cells: [...row.querySelectorAll('td, [role="gridcell"]')]
                .filter(visible)
                .map(cell => clean(cell.innerText)),
              actions: [...row.querySelectorAll('[id]')]
                .filter(element => visible(element) && /Select|View|Edit|Remove|Open|Menu|Action/.test(`${element.id} ${element.innerText || ''}`))
                .map(element => ({ id: element.id, text: clean(element.innerText) }))
            }))
            .filter(row => row.text || row.actions.length)
            .slice(0, 100)
        }))
    };
  }

  function findSearchAction() {
    const exact = [...document.querySelectorAll('[id]')]
      .filter(visible)
      .find(element => /SearchAndResetInputSet-SearchLinksInputSet-Search$/.test(element.id));
    if (exact) return exact.id;
    const buttonLike = [...document.querySelectorAll('[id]')]
      .filter(visible)
      .find(element =>
        !element.id.startsWith('TabBar-') &&
        /(^|[-_])Search$|SearchLinksInputSet-Search|Search_Button|SearchButton/i.test(element.id) &&
        /gw-action|gw-Button|gw-Link|Button|MenuItemWidget/i.test(`${element.className || ''} ${element.tagName}`)
      );
    return buttonLike?.id || '';
  }

  function findField(selectorOrName) {
    const value = String(selectorOrName || '');
    if (!value) return null;
    try {
      const bySelector = document.querySelector(value);
      if (bySelector) return bySelector;
    } catch {
      // Treat invalid CSS as a field name/id below.
    }
    const escaped = CSS.escape(value);
    const exact = document.querySelector(`[name="${escaped}"], #${escaped}`);
    if (exact) return exact;
    const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2);
    return [...document.querySelectorAll('input,select,textarea')]
      .filter(visible)
      .find(element => {
        const haystack = `${element.name || ''} ${element.id || ''} ${labelFor(element)}`.toLowerCase();
        return tokens.length && tokens.every(token => haystack.includes(token));
      }) || null;
  }

  function fillInput(selector, value) {
    if (selector && typeof selector === 'object') {
      value = selector.value ?? selector.text ?? value;
      selector = selector.selector ?? selector.name ?? selector.id;
    }
    const element = findField(selector);
    if (!element) return { ok: false, reason: 'missing', selector };
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, selector, name: element.name || '', id: element.id || '' };
  }

  function setSelect(name, value) {
    if (name && typeof name === 'object') {
      value = name.value ?? value;
      name = name.name ?? name.selector ?? name.id;
    }
    const element = document.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!element) return { ok: false, reason: 'missing', name };
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, name, value: element.value };
  }

  function elementState(selector, visibleOnly = false) {
    const element = document.querySelector(selector);
    if (!element) return { found: false, selector, visible: false };
    const isVisible = visible(element);
    return {
      found: true,
      selector,
      visible: isVisible,
      tag: element.tagName,
      id: element.id || '',
      name: element.name || '',
      text: clean(element.innerText || element.value || '').slice(0, 180),
      ok: !visibleOnly || isVisible
    };
  }

  function dispatchKey(selector, key = 'Enter', event = 'keypress') {
    const element = document.querySelector(selector);
    if (!element) return { ok: false, reason: 'missing', selector };
    const keyCodes = { Enter: 13, Tab: 9, Escape: 27, Backspace: 8, ' ': 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
    const keyCode = keyCodes[key] || (key.length === 1 ? key.charCodeAt(0) : 0);
    element.focus();
    element.dispatchEvent(new KeyboardEvent(event, {
      key,
      code: key,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    }));
    return { ok: true, selector, key, event };
  }

  function gwClick(id) {
    const query = String(id || '');
    const exact = document.getElementById(query);
    const element = exact || findRelatedActionRoots(query, 1)[0]?.element;
    const target = element?.querySelector('[data-gw-click]') || element;
    if (!target) return { fired: false, reason: 'missing', id };
    if (globalThis.gwEvents?.abstractOnEvent) {
      globalThis.gwEvents.abstractOnEvent(target, new MouseEvent('click', { bubbles: true, cancelable: true, view: window }), false);
    } else {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
    return { fired: true, id: element.id, text: clean(element.innerText), resolvedFrom: exact ? 'id' : 'query' };
  }

  function resolveTarget(target) {
    const value = String(target || '');
    if (!value) return null;
    const byId = document.getElementById(value);
    if (byId) return byId;
    try {
      const bySelector = document.querySelector(value);
      if (bySelector) return bySelector;
    } catch {
      // not a valid selector; fall through to name/field/action resolution
    }
    const byName = document.querySelector(`[name="${CSS.escape(value)}"]`);
    if (byName) return byName;
    return findField(value) || findRelatedActionRoots(value, 1)[0]?.element || null;
  }

  function highlightElement(target) {
    const element = resolveTarget(target);
    if (!element) return { ok: false, reason: 'missing', target: String(target || '') };

    document.getElementById('autobro-highlight')?.remove();
    document.getElementById('autobro-highlight-label')?.remove();
    document.getElementById('autobro-highlight-style')?.remove();

    const style = document.createElement('style');
    style.id = 'autobro-highlight-style';
    style.textContent = '@keyframes bhh-pulse{0%{box-shadow:0 0 0 3px #ff3b30,0 0 0 9999px rgba(15,23,42,.38),0 0 22px 6px rgba(255,59,48,.9)}50%{box-shadow:0 0 0 6px #ff3b30,0 0 0 9999px rgba(15,23,42,.38),0 0 36px 14px rgba(255,59,48,.7)}100%{box-shadow:0 0 0 3px #ff3b30,0 0 0 9999px rgba(15,23,42,.38),0 0 22px 6px rgba(255,59,48,.9)}}'
      + '#autobro-highlight{position:fixed;z-index:2147483646;pointer-events:none;border-radius:5px;background:rgba(255,59,48,.10);outline:2px solid rgba(255,255,255,.95);outline-offset:1px;animation:bhh-pulse 1s ease-in-out infinite;transition:opacity .4s ease}'
      + '#autobro-highlight-label{position:fixed;z-index:2147483647;pointer-events:none;background:#ff3b30;color:#fff;font:600 12px/1.3 system-ui,sans-serif;padding:3px 8px;border-radius:4px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:opacity .4s ease;max-width:360px;overflow:hidden;text-overflow:ellipsis}';
    (document.head || document.documentElement).appendChild(style);

    const box = document.createElement('div');
    box.id = 'autobro-highlight';
    const label = document.createElement('div');
    label.id = 'autobro-highlight-label';
    label.textContent = clean(element.getAttribute('name') || element.id || element.tagName || 'element').slice(0, 60);
    const place = () => {
      const rect = element.getBoundingClientRect();
      box.style.left = `${rect.left - 4}px`;
      box.style.top = `${rect.top - 4}px`;
      box.style.width = `${rect.width + 8}px`;
      box.style.height = `${rect.height + 8}px`;
      label.style.left = `${Math.max(4, rect.left - 4)}px`;
      label.style.top = `${rect.top - 26 < 4 ? rect.bottom + 6 : rect.top - 26}px`;
    };
    document.documentElement.appendChild(box);
    document.documentElement.appendChild(label);
    try { element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); } catch { /* detached */ }
    place();

    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove, true);
    let frames = 0;
    const tick = () => { place(); if (++frames < 48) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(() => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove, true);
      box.style.opacity = '0';
      label.style.opacity = '0';
      setTimeout(() => { box.remove(); label.remove(); style.remove(); }, 400);
    }, 3200);
    return { ok: true, id: element.id || '', name: element.name || '', tag: element.tagName, text: clean(element.innerText || element.value || '').slice(0, 120) };
  }

  function showWidget() {
    const existing = document.getElementById('autobro-page-widget');
    if (existing) {
      existing.style.display = existing.style.display === 'none' ? 'block' : 'none';
      chrome.storage.local.set({ browserHarnessWidgetOpen: existing.style.display !== 'none' });
      return { ok: true, visible: existing.style.display !== 'none' };
    }
    chrome.storage.local.set({ browserHarnessWidgetOpen: true });

    const host = document.createElement('div');
    host.id = 'autobro-page-widget';
    host.style.cssText = 'position:fixed;z-index:2147483647;top:80px;right:24px;width:380px;min-width:300px;min-height:180px;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .box {
          color: #1f2933;
          background: #f7f9fb;
          border: 1px solid #bac6d3;
          border-radius: 8px;
          box-sizing: border-box;
          box-shadow: 0 12px 32px rgba(15, 23, 42, .24);
          display: flex;
          flex-direction: column;
          font: 13px/1.4 system-ui, sans-serif;
          height: 100%;
          overflow: hidden;
          position: relative;
          pointer-events: auto;
          user-select: text;
        }
        .bar {
          align-items: center;
          background: #ffffff;
          border-bottom: 1px solid #d7e0ea;
          cursor: move;
          display: flex;
          gap: 8px;
          padding: 8px;
          user-select: none;
        }
        .spacer { flex: 1; }
        button {
          background: #fff;
          border: 1px solid #bac6d3;
          border-radius: 6px;
          cursor: pointer;
          padding: 5px 8px;
        }
        button:hover { background: #edf4fb; }
        .panel {
          display: none;
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 10px;
        }
        .panel.open { display: block; }
        .resize-handle {
          height: 14px;
          position: absolute;
          width: 14px;
          z-index: 2;
        }
        .resize-nw { cursor: nwse-resize; left: 0; top: 0; }
        .resize-ne { cursor: nesw-resize; right: 0; top: 0; }
        .resize-sw { bottom: 0; cursor: nesw-resize; left: 0; }
        .resize-se { bottom: 0; cursor: nwse-resize; right: 0; }
        .status {
          background: #fff;
          border: 1px solid #d7e0ea;
          border-radius: 6px;
          display: grid;
          gap: 6px;
          margin-bottom: 8px;
          padding: 8px;
        }
        .row {
          align-items: baseline;
          display: grid;
          gap: 8px;
          grid-template-columns: 70px 1fr;
        }
        .label { color: #52616f; font-size: 12px; }
        .value { overflow-wrap: anywhere; }
        .field { margin-bottom: 8px; }
        .flowbar {
          display: flex;
          gap: 8px;
        }
        .flowbar input { flex: 1; }
        .flow-list {
          background: #fff;
          border: 1px solid #d7e0ea;
          border-radius: 6px;
          box-sizing: border-box;
          display: grid;
          gap: 4px;
          margin-top: 6px;
          max-height: 110px;
          overflow: auto;
          padding: 6px;
        }
        .flow-item {
          align-items: center;
          display: grid;
          gap: 6px;
          grid-template-columns: 22px 1fr 28px;
        }
        .flow-item-control { display: block; }
        .step-main {
          align-items: center;
          display: grid;
          gap: 6px;
          grid-template-columns: 22px 1fr 28px;
        }
        .step-inline { display: flex; gap: 4px; margin: 4px 0 2px 28px; }
        .step-inline .step-value { flex: 1; }
        .step-inline button { white-space: nowrap; }
        .flow-item span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        label {
          color: #52616f;
          display: block;
          font-size: 12px;
          margin-bottom: 3px;
        }
        input, textarea {
          background: #fff;
          border: 1px solid #d7e0ea;
          border-radius: 6px;
          box-sizing: border-box;
          color: #1f2933;
          font: 12px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace;
          padding: 7px 8px;
          pointer-events: auto;
          user-select: text;
          width: 100%;
        }
        textarea { resize: vertical; }
        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }
        pre {
          background: #fff;
          border: 1px solid #d7e0ea;
          border-radius: 6px;
          box-sizing: border-box;
          max-height: 220px;
          overflow: auto;
          padding: 8px;
          white-space: pre-wrap;
        }
      </style>
      <div class="box">
        <div id="dragBar" class="bar">
          <button id="autoToggle">Auto</button>
          <button id="agentToggle">Agent</button>
          <button id="debugToggle">Debug</button>
          <div class="spacer"></div>
          <button id="closeWidget">Close</button>
        </div>
        <div id="autoPanel" class="panel">
          <div class="status">
            <div class="row"><div class="label">Auto</div><div id="autoStatus" class="value">Idle</div></div>
          </div>
          <div class="field">
            <label for="autoFlow">Flow</label>
            <div class="flowbar">
              <input id="autoFlow" list="flowOptions" spellcheck="true" placeholder="Flow name">
              <datalist id="flowOptions"></datalist>
              <button id="runFlow">Run</button>
            </div>
            <div class="toolbar">
              <button id="discoverSteps">Discover</button>
              <button id="copyFlow">Copy</button>
              <button id="deleteFlow">Delete</button>
            </div>
            <div id="flowList" class="flow-list"></div>
          </div>
          <div class="field">
            <label for="autoStep">Step</label>
            <textarea id="autoStep" rows="4" spellcheck="true" placeholder="Describe the browser action in plain English"></textarea>
          </div>
          <div class="toolbar">
            <button id="addFlow">Add</button>
            <button id="checkAuto">Check</button>
            <button id="saveAuto">Save</button>
            <button id="deleteAuto">Delete</button>
          </div>
        </div>
        <div id="agentPanel" class="panel">
          <div class="status">
            <div class="row"><div class="label">LLM</div><div id="agentStatus" class="value">Not tested</div></div>
          </div>
          <div class="field">
            <label for="llmModel">Model</label>
            <input id="llmModel" spellcheck="false" placeholder="optional" value="gemma-4-E4B-it-qat-UD-Q4_K_XL">
          </div>
          <div class="toolbar">
            <button id="saveAgentConfig">Save</button>
            <button id="testAgentConfig">Test</button>
          </div>
        </div>
        <div id="debugPanel" class="panel">
          <pre id="output">Ready.</pre>
          <textarea id="command" rows="5" spellcheck="false">{"command":"pageInfo"}</textarea>
          <div class="toolbar">
            <button id="runCommand">Run JSON Command</button>
          </div>
        </div>
        <div class="resize-handle resize-nw" data-resize="nw"></div>
        <div class="resize-handle resize-ne" data-resize="ne"></div>
        <div class="resize-handle resize-sw" data-resize="sw"></div>
        <div class="resize-handle resize-se" data-resize="se"></div>
      </div>
    `;
    document.documentElement.appendChild(host);

    const $ = id => shadow.getElementById(id);
    ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'keypress', 'input', 'change', 'focusin', 'focusout']
      .forEach(type => shadow.addEventListener(type, event => event.stopPropagation()));
    const output = $('output');
    const autoPanel = $('autoPanel');
    const agentPanel = $('agentPanel');
    const debugPanel = $('debugPanel');
    const autoStatus = $('autoStatus');
    const agentStatus = $('agentStatus');
    const autoFlow = $('autoFlow');
    const flowOptions = $('flowOptions');
    const flowList = $('flowList');
    const autoStep = $('autoStep');
    const llmModel = $('llmModel');
    const agentConfigKey = 'browserHarnessAgentConfig';
    const autoStepsKey = 'browserHarnessAutoSteps';
    const autoFlowsKey = 'browserHarnessAutoFlows';
    let lastAutomation = null;

    const setText = (element, value) => { element.textContent = value || 'Unavailable'; };
    const print = value => { output.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
    const showDebug = () => debugPanel.classList.add('open');
    const normalizeStep = value => (value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const storageGet = key => new Promise(resolve => chrome.storage.local.get(key, resolve));
    const storageSet = value => new Promise(resolve => chrome.storage.local.set(value, resolve));
    const requestRaw = payload => new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ source: 'autobro-extension-widget', ...payload }, response => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else if (!response?.ok) reject(new Error(response?.error || `command failed: ${payload.command}`));
        else resolve(response.result);
      });
    });
    const request = (command, argsOrExtra) => {
      if (Array.isArray(argsOrExtra)) return requestRaw({ command, args: argsOrExtra });
      if (argsOrExtra && typeof argsOrExtra === 'object') return requestRaw({ command, ...argsOrExtra });
      return requestRaw({ command });
    };
    const toggleOnly = panel => {
      const wasOpen = panel.classList.contains('open');
      autoPanel.classList.remove('open');
      agentPanel.classList.remove('open');
      debugPanel.classList.remove('open');
      if (!wasOpen) panel.classList.add('open');
    };
    const focusAutoStep = () => setTimeout(() => {
      autoStep.focus();
      autoStep.setSelectionRange(autoStep.value.length, autoStep.value.length);
    }, 0);
    const defaultLlmModel = 'gemma-4-E4B-it-qat-UD-Q4_K_XL';
    const legacyLlmModel = 'gemma-4-12b-it-qat-q4_0';
    const llmConnectionError = error => {
      const message = error?.message || String(error);
      if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
        return new Error('Cannot reach the WebGPU LLM host. Open the WebGPU LLM Host page, load a model, then use Agent > Test.');
      }
      return error;
    };

    async function loadAgentConfig() {
      const stored = await storageGet(agentConfigKey);
      const config = stored[agentConfigKey] || {};
      llmModel.value = !config.model || config.model === legacyLlmModel ? defaultLlmModel : config.model;
    }

    async function getAgentConfig() {
      const stored = await storageGet(agentConfigKey);
      const config = stored[agentConfigKey] || {};
      return {
        model: (config.model === legacyLlmModel ? defaultLlmModel : config.model || llmModel.value || defaultLlmModel).trim()
      };
    }

    async function saveAgentConfig() {
      const config = {
        model: llmModel.value.trim()
      };
      await storageSet({ [agentConfigKey]: config });
      setText(agentStatus, 'Saved');
      return config;
    }

    async function testAgentConfig() {
      setText(agentStatus, 'Testing...');
      let config = null;
      try {
        config = await saveAgentConfig();
        const payload = await requestRaw({ command: 'llmModels' });
        const modelIds = Array.isArray(payload?.data) ? payload.data.map(model => model.id).filter(Boolean) : [];
        setText(agentStatus, `Connected: ${config.model || modelIds[0] || 'model available'}`);
      } catch (error) {
        const detail = llmConnectionError(error);
        setText(agentStatus, `Failed: ${detail?.message || String(detail)}`);
      }
    }

    async function getSavedAutoSteps() {
      const stored = await storageGet(autoStepsKey);
      return stored[autoStepsKey] || {};
    }

    async function getSavedAutoFlows() {
      const stored = await storageGet(autoFlowsKey);
      return stored[autoFlowsKey] || {};
    }

    function currentFlowKey() {
      return normalizeStep(autoFlow.value || 'default');
    }

    function splitFlowSteps(text) {
      return text.split(',').map(step => step.trim()).filter(Boolean);
    }

    function describeActionStep(action) {
      const name = action.text || action.id || action.tag;
      return `click ${name}`;
    }

    function stepTarget(control) {
      return control.name ? `[name="${control.name}"]` : (control.id || '');
    }

    function isNoiseAction(action) {
      const id = action.id || '';
      const text = (action.text || '').trim();
      if (!text || text.length > 48) return true;
      if (/^gw-/.test(id)) return true;
      if (/PanelSet$|Panel$|ttlBar|TitleBar|-title|ScreenHeader|MessagesWidget|_msgs$|InfoBar|RequiredSymbol|-ttl$|Header_Cell$|_Cell$/i.test(id)) return true;
      return false;
    }

    function fieldLabel(control) {
      return control.label || control.name || control.id || 'field';
    }

    function describeFieldRow(control) {
      const name = control.label || control.name || control.id || control.tag;
      const kind = control.tag === 'SELECT' ? 'select'
        : control.type === 'checkbox' ? 'checkbox'
        : control.type === 'radio' ? 'radio'
        : control.type || 'text';
      const flags = [control.disabled ? 'disabled' : '', control.readonly ? 'readonly' : ''].filter(Boolean).join(',');
      return `${name} (${flags ? `${kind}, ${flags}` : kind})`;
    }

    function discoveredSteps(page) {
      const items = [];
      // List every form field (data entry happens in the app, not here).
      (page?.controls || [])
        .filter(control => control.id || control.name)
        .forEach(control => items.push({ text: describeFieldRow(control), target: stepTarget(control), kind: 'field', control }));
      // Plus clickable actions so a flow can capture navigation clicks too.
      (page?.actions || [])
        .filter(action => action.id && action.clickable && !isNoiseAction(action))
        .forEach(action => items.push({ text: describeActionStep(action), target: action.id, kind: 'action' }));
      const seen = new Set();
      return items.filter(item => {
        const key = `${item.kind}:${item.target}`;
        if (!item.target || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 200);
    }

    // Append a step to the current flow without re-rendering, so the discovered
    // field list stays on screen while several fields are recorded in sequence.
    async function appendFlowStep(text) {
      const key = currentFlowKey();
      const flows = await getSavedAutoFlows();
      const flow = flows[key] || { name: autoFlow.value.trim() || 'default', steps: [] };
      flow.steps.push({ step: text, addedAt: new Date().toISOString() });
      flows[key] = flow;
      await storageSet({ [autoFlowsKey]: flows });
      return flow.steps.length;
    }

    // Turn a field's CURRENT value (typed by the user in the app) into a step.
    function recordedStepText(element, label) {
      if (element.tagName === 'SELECT') {
        const value = (element.options[element.selectedIndex]?.text || '').trim();
        return value && value !== '<none>' ? `Select "${value}" in "${label}"` : '';
      }
      if (element.type === 'checkbox' || element.type === 'radio') {
        return `${element.checked ? 'Check' : 'Uncheck'} "${label}"`;
      }
      const value = (element.value || '').trim();
      return value ? `Fill "${label}" with "${value}"` : '';
    }

    async function recordFieldStep(step, button) {
      const element = resolveTarget(step.target);
      if (!element) { setText(autoStatus, 'Field not found on page'); return; }
      highlightElement(step.target);
      const label = fieldLabel(step.control);
      const text = recordedStepText(element, label);
      if (!text) { setText(autoStatus, `Enter a value for "${label}" in the app, then Record`); return; }
      const count = await appendFlowStep(text);
      if (button) { button.textContent = '✓'; button.title = text; }
      setText(autoStatus, `Recorded step ${count}: ${text}`);
    }

    function renderDiscoveredSteps(steps) {
      flowList.innerHTML = '';
      if (!steps.length) {
        const empty = document.createElement('div');
        empty.className = 'label';
        empty.textContent = 'No form elements or actions found';
        flowList.append(empty);
        return;
      }
      steps.forEach((step, index) => {
        const row = document.createElement('div');
        row.className = 'flow-item';
        const num = document.createElement('div');
        num.className = 'label';
        num.textContent = String(index + 1);
        const text = document.createElement('span');
        text.textContent = step.text;
        text.style.cursor = 'pointer';
        text.addEventListener('click', () => {
          if (step.target) highlightElement(step.target);
          setText(autoStatus, `Highlighted: ${step.text}`);
        });

        if (step.kind === 'field') {
          row.classList.add('flow-item-control');
          text.title = `${step.text}  ->  click to highlight; enter the value in the app, then Record`;
          const record = document.createElement('button');
          record.textContent = 'Record';
          record.title = "Capture this field's current value (entered in the app) as a flow step";
          record.addEventListener('click', () => recordFieldStep(step, record));
          row.append(num, text, record);
        } else {
          text.title = `${step.text}  ->  ${step.target} (click to highlight in page)`;
          const add = document.createElement('button');
          add.textContent = '+';
          add.title = 'Add a click step for this action';
          add.addEventListener('click', async () => {
            const label = (step.text || '').replace(/^click\s+/i, '').trim();
            const count = await appendFlowStep(`Click "${label}"`);
            add.textContent = '✓';
            setText(autoStatus, `Recorded step ${count}: Click "${label}"`);
          });
          row.append(num, text, add);
        }
        flowList.append(row);
      });
    }

    async function discoverSteps() {
      setText(autoStatus, 'Discovering form elements...');
      try {
        const page = await request('inventoryCurrentPage');
        const steps = discoveredSteps(page);
        renderDiscoveredSteps(steps);
        const fields = steps.filter(step => step.kind === 'field').length;
        setText(autoStatus, `Found ${fields} field(s) + ${steps.length - fields} action(s)`);
      } catch (error) {
        setText(autoStatus, `Discover failed: ${error?.message || String(error)}`);
      }
    }

    async function renderFlowOptions(flows = null) {
      const saved = flows || await getSavedAutoFlows();
      flowOptions.innerHTML = '';
      Object.entries(saved)
        .sort(([, a], [, b]) => String(a.name || '').localeCompare(String(b.name || '')))
        .forEach(([key, flow]) => {
          const option = document.createElement('option');
          option.value = flow.name || key;
          option.label = `${flow.steps?.length || 0} step(s)`;
          flowOptions.append(option);
        });
    }

    async function renderFlow() {
      const key = currentFlowKey();
      const flows = await getSavedAutoFlows();
      await renderFlowOptions(flows);
      const flow = flows[key] || { name: autoFlow.value.trim() || 'default', steps: [] };
      flowList.innerHTML = '';
      if (!flow.steps.length) {
        const empty = document.createElement('div');
        empty.className = 'label';
        empty.textContent = 'No steps';
        flowList.append(empty);
        return;
      }
      flow.steps.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'flow-item';
        const num = document.createElement('div');
        num.className = 'label';
        num.textContent = String(index + 1);
        const text = document.createElement('span');
        text.textContent = item.step || item;
        text.title = item.step || item;
        text.addEventListener('click', () => {
          autoStep.value = item.step || item;
          focusAutoStep();
        });
        const remove = document.createElement('button');
        remove.textContent = 'x';
        remove.addEventListener('click', async () => {
          const latest = await getSavedAutoFlows();
          const target = latest[key];
          if (!target) return;
          target.steps.splice(index, 1);
          await storageSet({ [autoFlowsKey]: latest });
          await renderFlow();
        });
        row.append(num, text, remove);
        flowList.append(row);
      });
    }

    async function copyText(text) {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }

    async function copyFlowSteps() {
      const flows = await getSavedAutoFlows();
      const flow = flows[currentFlowKey()];
      if (!flow?.steps?.length) return setText(autoStatus, 'No steps in flow');
      const text = flow.steps.map((item, index) => `${index + 1}. ${item.step || item}`).join('\n');
      await copyText(text);
      setText(autoStatus, `Copied ${flow.steps.length} step(s)`);
    }

    async function deleteFlow() {
      const key = currentFlowKey();
      const flows = await getSavedAutoFlows();
      const flow = flows[key];
      if (!flow) return setText(autoStatus, 'No saved flow');
      delete flows[key];
      await storageSet({ [autoFlowsKey]: flows });
      setText(autoStatus, `Deleted ${flow.name || key}`);
      await renderFlow();
    }

    function parseJsonObject(text) {
      const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      try {
        return JSON.parse(trimmed);
      } catch (firstError) {
        const start = trimmed.indexOf('{');
        if (start < 0) throw new Error('LLM response did not contain a JSON object');
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = start; i < trimmed.length; i += 1) {
          const char = trimmed[i];
          if (escape) {
            escape = false;
          } else if (char === '\\') {
            escape = inString;
          } else if (char === '"') {
            inString = !inString;
          } else if (!inString && char === '{') {
            depth += 1;
          } else if (!inString && char === '}') {
            depth -= 1;
            if (depth === 0) return JSON.parse(trimmed.slice(start, i + 1));
          }
        }
        throw firstError;
      }
    }

    const baseAutomationCommands = new Set([
      'pageInfo', 'inventoryCurrentPage', 'visibleActions', 'relatedActions',
      'extractGrids', 'fillInput', 'setSelect', 'clickAtXY', 'typeText',
      'pressKey', 'scroll', 'waitForElement', 'waitForLoad',
      'waitNetworkIdle', 'gotoUrl', 'currentTab', 'newTab'
    ]);

    function hasGuidewireSkillContext(skills) {
      return skills.some(skill => /policycenter|guidewire/i.test(`${skill.path || ''}\n${skill.content || ''}`));
    }

    function allowedAutomationCommands(skills = []) {
      const commands = new Set(baseAutomationCommands);
      if (hasGuidewireSkillContext(skills)) commands.add('gwClick');
      return commands;
    }

    function normalizeAutomation(value, skills = []) {
      const allowedCommands = allowedAutomationCommands(skills);
      const steps = Array.isArray(value?.steps) ? value.steps : [value];
      return {
        steps: steps.map(step => {
          if (!step || typeof step !== 'object') throw new Error('Automation step must be an object');
          if (typeof step.command !== 'string' || !step.command) throw new Error('Automation step must include command');
          if (!allowedCommands.has(step.command)) throw new Error(`Command not allowed: ${step.command}`);
          return { command: step.command, args: Array.isArray(step.args) ? step.args : [], tabId: step.tabId };
        })
      };
    }

    async function loadSkillContext(step) {
      const payload = await requestRaw({
        command: 'skills',
        q: step,
        limit: 2,
        maxChars: 1200
      });
      return Array.isArray(payload.skills)
        ? payload.skills.map(skill => ({ path: skill.path, content: String(skill.content || '').slice(0, 1200) }))
        : [];
    }

    function compactPageContext(page) {
      return {
        url: page?.url,
        title: page?.title,
        pageTitle: page?.pageTitle,
        controls: (page?.controls || []).slice(0, 30).map(control => ({
          tag: control.tag,
          type: control.type,
          id: control.id,
          name: control.name,
          label: control.label,
          disabled: control.disabled,
          readonly: control.readonly
        })),
        actions: (page?.actions || []).slice(0, 12).map(action => ({
          id: action.id,
          text: action.text,
          tag: action.tag
        })),
        relatedActions: (page?.relatedActions || []).slice(0, 8).map(action => ({
          id: action.id,
          text: action.text,
          visible: action.visible,
          dataGwClick: action.dataGwClick
        }))
      };
    }

    function automationPrompt(step, page, skills = []) {
      const guidewire = hasGuidewireSkillContext(skills);
      const commands = Array.from(allowedAutomationCommands(skills)).join(', ');
      const guidewireInstructions = guidewire
        ? 'For clicking Guidewire actions, copy the exact id string from Current page actions or Related actions into gwClick, for example {"command":"gwClick","args":["Some-Action-id"]}. Do not invent action ids, and do not pass selector objects to gwClick.'
        : 'Do not use Guidewire-only commands such as gwClick unless Guidewire skills are loaded.';
      return `Convert the plain-English browser automation step into autobro extension command JSON.
Return only JSON. No markdown.
Allowed shape: {"steps":[{"command":"pageInfo","args":[]}]}
Allowed commands include ${commands}.
Command args must be arrays of primitive values, not objects. Example: {"command":"fillInput","args":["[name=\"some-field\"]","value"]}.
For browser tab requests, use tab commands: "open new tab" -> {"command":"newTab","args":["about:blank"]}; "open URL" -> {"command":"newTab","args":["https://..."]} or gotoUrl for the current tab.
Prefer stable CSS selectors from Current page controls. For named inputs, use [name="field-name"].
For fillInput, use only exact selectors derived from Current page controls; do not invent simplified names. If a control has name "Login-LoginScreen-LoginDV-username", use [name="Login-LoginScreen-LoginDV-username"], not [name="username"].
${guidewireInstructions}
Prefer the smallest action whose text matches the instruction. Avoid page, form, body, panel, or container ids unless no more specific action exists.
For username-only or password-only instructions, fill only the requested field with fillInput. Do not invent missing credentials, do not submit unless the instruction asks to submit or log in, and do not use clickAtXY unless the user provides exact coordinates. Do not use clickAtXY to click browser chrome such as the new-tab button.
Use the current page context and relevant agent skills when helpful.
Current page: ${JSON.stringify(compactPageContext(page))}
Agent skills: ${JSON.stringify(skills)}
Step: ${JSON.stringify(step)}`;
    }

    async function askLlmForAutomation(step) {
      const config = await getAgentConfig();
      const page = await request('inventoryCurrentPage').catch(() => pageInfo());
      const related = await request('relatedActions', [step, 12]).catch(() => []);
      const skills = await loadSkillContext(step).catch(() => []);
      try {
        const payload = await requestRaw({
          command: 'llmChatCompletions',
          body: {
            model: config.model || undefined,
            max_tokens: 1024,
            temperature: 0,
            chat_template_kwargs: { enable_thinking: false },
            messages: [
              { role: 'system', content: 'You are terse. Never reason or use <think> blocks. Output ONLY the final JSON object in message.content — no prose, no explanation. Produce valid JSON commands for a local browser automation bridge.' },
              { role: 'user', content: automationPrompt(step, { ...page, relatedActions: related }, skills) }
            ]
          }
        });
        const message = payload?.choices?.[0]?.message || {};
        const content = message.content || message.reasoning_content || payload?.content || '';
        if (!content) throw new Error('LLM returned no content');
        return normalizeAutomation(parseJsonObject(content), skills);
      } catch (error) {
        throw llmConnectionError(error);
      }
    }

    async function automationForStep(step) {
      return await askLlmForAutomation(step);
    }

    async function runAutomation(automation) {
      const results = [];
      for (const step of automation.steps) {
        const payload = { command: step.command };
        if (step.args?.length) payload.args = step.args;
        if (step.tabId) payload.tabId = step.tabId;
        const result = await requestRaw(payload);
        results.push({ request: payload, result });
      }
      return results;
    }

    async function checkAutoStep() {
      const text = autoStep.value.trim();
      if (!text) return setText(autoStatus, 'Enter a step first');
      setText(autoStatus, 'Asking LLM...');
      try {
        const automation = await automationForStep(text);
        lastAutomation = { key: normalizeStep(text), step: text, automation };
        setText(autoStatus, `Running ${automation.steps.length} command(s)...`);
        await runAutomation(automation);
        setText(autoStatus, 'Loading resultant page...');
        await request('waitForLoad', [10]).catch(() => null);
        await request('waitNetworkIdle', [10, 600]).catch(() => null);
        await discoverSteps();
      } catch (error) {
        setText(autoStatus, `Failed: ${error?.message || String(error)}`);
      }
    }

    async function addFlowStep() {
      const text = autoStep.value.trim();
      if (!text) return setText(autoStatus, 'Enter a step first');
      const steps = splitFlowSteps(text);
      const key = currentFlowKey();
      const flows = await getSavedAutoFlows();
      const flow = flows[key] || { name: autoFlow.value.trim() || 'default', steps: [] };
      const addedAt = new Date().toISOString();
      flow.steps.push(...steps.map(step => ({ step, addedAt })));
      flows[key] = flow;
      await storageSet({ [autoFlowsKey]: flows });
      setText(autoStatus, `Added ${steps.length} step(s) to ${flow.name}`);
      await renderFlow();
    }

    async function runFlow() {
      const key = currentFlowKey();
      const flows = await getSavedAutoFlows();
      const flow = flows[key];
      if (!flow?.steps?.length) return setText(autoStatus, 'No steps in flow');
      try {
        for (let i = 0; i < flow.steps.length; i += 1) {
          const text = flow.steps[i].step || flow.steps[i];
          setText(autoStatus, `Flow ${i + 1}/${flow.steps.length}: asking LLM...`);
          const automation = await automationForStep(text);
          setText(autoStatus, `Flow ${i + 1}/${flow.steps.length}: running ${automation.steps.length} command(s)...`);
          await runAutomation(automation);
        }
        setText(autoStatus, `Flow done: ${flow.name}`);
      } catch (error) {
        setText(autoStatus, `Flow failed: ${error?.message || String(error)}`);
      }
    }

    async function saveAutoStep() {
      const text = autoStep.value.trim();
      const key = normalizeStep(text);
      if (!key) return setText(autoStatus, 'Enter a step first');
      setText(autoStatus, 'Saving...');
      try {
        const automation = lastAutomation?.key === key ? lastAutomation.automation : await automationForStep(text);
        const saved = await getSavedAutoSteps();
        saved[key] = { step: text, automation, savedAt: new Date().toISOString() };
        await storageSet({ [autoStepsKey]: saved });
        setText(autoStatus, 'Saved');
      } catch (error) {
        setText(autoStatus, `Save failed: ${error?.message || String(error)}`);
      }
    }

    async function deleteAutoStep() {
      const key = normalizeStep(autoStep.value);
      if (!key) return setText(autoStatus, 'Enter a step first');
      const saved = await getSavedAutoSteps();
      if (!saved[key]) return setText(autoStatus, 'No saved item for this step');
      delete saved[key];
      await storageSet({ [autoStepsKey]: saved });
      setText(autoStatus, 'Deleted');
    }

    $('autoToggle').addEventListener('click', () => {
      toggleOnly(autoPanel);
      if (autoPanel.classList.contains('open')) focusAutoStep();
    });
    $('agentToggle').addEventListener('click', () => toggleOnly(agentPanel));
    $('debugToggle').addEventListener('click', () => toggleOnly(debugPanel));
    $('closeWidget').addEventListener('click', () => {
      host.style.display = 'none';
      chrome.storage.local.set({ browserHarnessWidgetOpen: false });
    });
    $('saveAgentConfig').addEventListener('click', saveAgentConfig);
    $('testAgentConfig').addEventListener('click', testAgentConfig);
    $('autoFlow').addEventListener('input', renderFlow);
    $('autoFlow').addEventListener('change', renderFlow);
    $('discoverSteps').addEventListener('click', discoverSteps);
    $('addFlow').addEventListener('click', addFlowStep);
    $('runFlow').addEventListener('click', runFlow);
    $('copyFlow').addEventListener('click', copyFlowSteps);
    $('deleteFlow').addEventListener('click', deleteFlow);
    $('checkAuto').addEventListener('click', checkAutoStep);
    $('saveAuto').addEventListener('click', saveAutoStep);
    $('deleteAuto').addEventListener('click', deleteAutoStep);
    autoStep.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      if (event.altKey) {
        event.preventDefault();
        checkAutoStep();
      } else if (event.ctrlKey) {
        event.preventDefault();
        addFlowStep();
      }
    });
    $('runCommand').addEventListener('click', async () => {
      showDebug();
      try {
        const payload = JSON.parse($('command').value);
        if (!payload.command) throw new Error('JSON command must include "command"');
        print(await requestRaw(payload));
      } catch (error) {
        print(error?.stack || error?.message || String(error));
      }
    });

    let dragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let dragPointerId = null;
    let resizing = false;
    let resizeMode = '';
    let resizePointerId = null;
    let resizeStartX = 0;
    let resizeStartY = 0;
    let resizeStartRect = null;
    const minWidgetWidth = 300;
    const minWidgetHeight = 180;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const stopDrag = () => {
      dragging = false;
      dragPointerId = null;
    };
    const stopResize = () => {
      resizing = false;
      resizeMode = '';
      resizePointerId = null;
      resizeStartRect = null;
    };
    const moveWidget = event => {
      if (!dragging || resizing || (dragPointerId !== null && event.pointerId !== dragPointerId)) return;
      const width = host.getBoundingClientRect().width;
      const height = host.getBoundingClientRect().height;
      host.style.left = `${clamp(event.clientX - dragOffsetX, 0, Math.max(0, innerWidth - width))}px`;
      host.style.top = `${clamp(event.clientY - dragOffsetY, 0, Math.max(0, innerHeight - height))}px`;
      host.style.right = 'auto';
      event.preventDefault();
    };
    $('dragBar').addEventListener('pointerdown', event => {
      if (event.target.tagName === 'BUTTON') return;
      dragging = true;
      dragPointerId = event.pointerId;
      const rect = host.getBoundingClientRect();
      dragOffsetX = event.clientX - rect.left;
      dragOffsetY = event.clientY - rect.top;
      $('dragBar').setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    $('dragBar').addEventListener('pointermove', moveWidget);
    $('dragBar').addEventListener('pointerup', stopDrag);
    $('dragBar').addEventListener('pointercancel', stopDrag);
    const resizeWidget = event => {
      if (!resizing || !resizeStartRect || (resizePointerId !== null && event.pointerId !== resizePointerId)) return;
      const dx = event.clientX - resizeStartX;
      const dy = event.clientY - resizeStartY;
      const startLeft = resizeStartRect.left;
      const startTop = resizeStartRect.top;
      const startRight = resizeStartRect.right;
      const startBottom = resizeStartRect.bottom;
      let nextLeft = startLeft;
      let nextTop = startTop;
      let nextWidth = resizeStartRect.width;
      let nextHeight = resizeStartRect.height;
      if (resizeMode.includes('e')) {
        nextWidth = clamp(resizeStartRect.width + dx, minWidgetWidth, Math.max(minWidgetWidth, innerWidth - startLeft));
      }
      if (resizeMode.includes('s')) {
        nextHeight = clamp(resizeStartRect.height + dy, minWidgetHeight, Math.max(minWidgetHeight, innerHeight - startTop));
      }
      if (resizeMode.includes('w')) {
        nextWidth = clamp(resizeStartRect.width - dx, minWidgetWidth, Math.max(minWidgetWidth, startRight));
        nextLeft = clamp(startRight - nextWidth, 0, startRight - minWidgetWidth);
      }
      if (resizeMode.includes('n')) {
        nextHeight = clamp(resizeStartRect.height - dy, minWidgetHeight, Math.max(minWidgetHeight, startBottom));
        nextTop = clamp(startBottom - nextHeight, 0, startBottom - minWidgetHeight);
      }
      host.style.left = `${nextLeft}px`;
      host.style.top = `${nextTop}px`;
      host.style.width = `${nextWidth}px`;
      host.style.height = `${nextHeight}px`;
      host.style.right = 'auto';
      event.preventDefault();
    };
    shadow.querySelectorAll('[data-resize]').forEach(handle => {
      handle.addEventListener('pointerdown', event => {
        resizing = true;
        resizeMode = handle.dataset.resize;
        resizePointerId = event.pointerId;
        resizeStartX = event.clientX;
        resizeStartY = event.clientY;
        resizeStartRect = host.getBoundingClientRect();
        handle.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      });
      handle.addEventListener('pointermove', resizeWidget);
      handle.addEventListener('pointerup', stopResize);
      handle.addEventListener('pointercancel', stopResize);
    });
    document.addEventListener('pointerup', stopDrag);
    document.addEventListener('pointerup', stopResize);
    window.addEventListener('blur', stopDrag);
    window.addEventListener('blur', stopResize);

    loadAgentConfig();
    renderFlow();
    autoPanel.classList.add('open');
    focusAutoStep();
    return { ok: true, visible: true };
  }

  const commands = {
    pageInfo,
    loginStatus,
    localLogin,
    inventoryCurrentPage,
    extractMessages,
    visibleActions,
    relatedActions,
    extractGrids,
    findSearchAction,
    fillInput,
    setSelect,
    elementState,
    dispatchKey,
    gwClick,
    highlightElement,
    showWidget
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.source !== 'autobro-extension') return false;
    const command = commands[message.command];
    if (!command) {
      sendResponse({ ok: false, error: `unknown content command: ${message.command}` });
      return false;
    }
    try {
      sendResponse({ ok: true, result: command(...(message.args || [])) });
    } catch (error) {
      sendResponse({ ok: false, error: error?.stack || error?.message || String(error) });
    }
    return false;
  });

  chrome.storage.local.get('browserHarnessWidgetOpen', result => {
    if (result.browserHarnessWidgetOpen) showWidget();
  });
})();
