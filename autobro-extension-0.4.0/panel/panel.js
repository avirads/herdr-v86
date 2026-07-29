// Merged Web Bridge panel: controller console + automation planner. Its LLM
// is provided by the paired Herdr page (no extension-local model). Runs as the
// side panel and as a draggable popup window ("Open as window").
//
// Talks to the service worker via internal messaging (source 'web-bridge-ui')
// — extension pages are trusted, so no pairing token is involved. Skill packs
// are loaded from user-selected ZIP files. The authenticated Herdr provider handles chat
// and automation planning.

import { startDictation } from './voice.js';

const $ = id => document.getElementById(id);

const BASE_AUTOMATION_COMMANDS = [
  'pageInfo', 'inventoryCurrentPage', 'visibleActions', 'relatedActions',
  'extractGrids', 'fillInput', 'setSelect', 'clickAtXY',
  'typeText', 'pressKey', 'scroll', 'waitForElement', 'waitForLoad',
  'waitNetworkIdle', 'gotoUrl', 'currentTab', 'newTab'
];
const GUIDEWIRE_AUTOMATION_COMMANDS = ['gwClick', 'gwOpenMenu'];
const TAB_SCOPED_COMMANDS = new Set([
  'pageInfo', 'inventoryCurrentPage', 'visibleActions', 'relatedActions',
  'extractGrids', 'fillInput', 'setSelect', 'clickAtXY',
  'typeText', 'pressKey', 'scroll', 'waitForElement', 'waitForLoad',
  'waitNetworkIdle', 'gotoUrl'
]);
const RISKY_ACTION_RE = /\b(Update|Save|Add|Remove|New|Create|Edit|Quote|Bind|Issue|Cancel|Close|Withdraw|Delete|Deactivate|Import|Export)\b/i;

let plannedAutomation = null;
let riskyRunArmed = false;
let targetTab = null;
let guidewireSkillsLoaded = localStorage.getItem('webBridge.guidewireSkillsLoaded') === 'true';

function send(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ source: 'web-bridge-ui', ...payload }, response => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else if (!response?.ok) reject(new Error(response?.error || 'bridge error'));
      else resolve(response.result);
    });
  });
}

const renderOutput = (element, value) => {
  element.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
};
const show = value => renderOutput($('output'), value);
const showPlan = value => renderOutput($('automationPlan'), value);
const setAutomationStatus = value => { $('automationStatus').textContent = value; };
const setSkillStatus = value => { $('skillStatus').textContent = value; };
const setVoiceStatus = value => { $('voiceStatus').textContent = value; };

async function showPairingToken() {
  const key = 'webBridgePairingToken';
  const stored = await chrome.storage.local.get(key);
  const token = stored[key] || crypto.randomUUID();
  if (!stored[key]) await chrome.storage.local.set({ [key]: token });
  $('pairingToken').value = token;
}

$('copyPairingToken').addEventListener('click', async () => {
  const input = $('pairingToken');
  try {
    await navigator.clipboard.writeText(input.value);
    $('copyPairingToken').textContent = 'Copied';
    setTimeout(() => { $('copyPairingToken').textContent = 'Copy'; }, 1200);
  } catch {
    input.select();
    document.execCommand('copy');
  }
});

if (guidewireSkillsLoaded) setSkillStatus('Guidewire PolicyCenter skills previously loaded');

// --- status ----------------------------------------------------------------

async function refreshHealth() {
  try {
    const health = await send({ command: 'health' });
    $('health').textContent = `bridge v${health.bridgeVersion} — transports: ` +
      Object.entries(health.transports).filter(([, on]) => on).map(([name]) => name).join(', ');
  } catch (error) {
    $('health').textContent = `health error: ${error.message}`;
  }
  try {
    const status = await send({ command: 'llmStatus', timeoutMs: 20000 });
    $('engineStatus').textContent = status.modelName
      ? `engine: Herdr WebGPU LLM ready — ${status.modelName}`
      : 'engine: Herdr connected; configure its WebGPU LLM';
  } catch (error) {
    $('engineStatus').textContent = `engine: ${error.message}`;
  }
}

// --- skill packs -------------------------------------------------------------

function findZipEnd(view) {
  const minimum = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error('Invalid ZIP: end-of-directory record not found');
}

async function unzipSkillPack(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  const end = findZipEnd(view);
  const entryCount = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries = new Map();

  for (let entry = 0; entry < entryCount; entry += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Invalid ZIP: central-directory entry not found');
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength)).replaceAll('\\', '/');

    if (!name.endsWith('/')) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error(`Invalid ZIP local entry: ${name}`);
      }
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = new Uint8Array(buffer, dataOffset, compressedSize);
      let bytes;
      if (method === 0) {
        bytes = compressed;
      } else if (method === 8) {
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        throw new Error(`Unsupported ZIP compression method ${method}: ${name}`);
      }
      if (bytes.byteLength !== uncompressedSize) throw new Error(`Corrupt ZIP entry: ${name}`);
      entries.set(name.replace(/^\.?\//, ''), decoder.decode(bytes));
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function locatePackRoot(entries) {
  const indexes = [...entries.keys()].filter(path => path === 'index.json' || path.endsWith('/index.json'));
  if (indexes.length !== 1) throw new Error('ZIP must contain exactly one index.json');
  return indexes[0].slice(0, -'index.json'.length);
}

$('loadSkills').addEventListener('click', () => $('skillPackFile').click());

$('skillPackFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    setSkillStatus(`Reading ${file.name}…`);
    const entries = await unzipSkillPack(file);
    const root = locatePackRoot(entries);
    const index = JSON.parse(entries.get(`${root}index.json`));
    if (!Array.isArray(index) || index.some(path => typeof path !== 'string')) {
      throw new Error('index.json must be an array of skill paths');
    }
    let imported = 0;
    for (const path of index) {
      const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '');
      if (normalized.includes('../')) throw new Error(`Unsafe skill path: ${path}`);
      const content = entries.get(`${root}skills/${normalized}`);
      if (content === undefined) throw new Error(`Missing ZIP entry: skills/${normalized}`);
      setSkillStatus(`Loading ${file.name}: ${imported + 1}/${index.length}`);
      await send({ command: 'skillsImport', path, content });
      imported += 1;
    }
    const guidewire = [...entries.entries()].some(([path, content]) =>
      /policycenter|guidewire/i.test(`${path}\n${content}`)
    );
    if (guidewire) {
      guidewireSkillsLoaded = true;
      localStorage.setItem('webBridge.guidewireSkillsLoaded', 'true');
    }
    setSkillStatus(`${file.name} loaded: ${imported} skills`);
    await refreshSkillList();
  } catch (error) {
    setSkillStatus(`Skill load failed: ${error.message}`);
  } finally {
    event.target.value = '';
  }
});

function skillDisplayPath(path) {
  return String(path || '').replace(/^domain-skills\//, '');
}

async function refreshSkillList() {
  const select = $('skillList');
  const skills = await send({ command: 'skills', q: '', limit: 10000, maxChars: 0 });
  select.replaceChildren();
  for (const skill of skills) {
    const option = document.createElement('option');
    option.value = skill.path;
    option.textContent = skillDisplayPath(skill.path);
    select.append(option);
  }
  if (!skills.length) {
    select.append(new Option('No skills installed', ''));
  }
  guidewireSkillsLoaded = skills.some(skill => /(^|\/)policycenter-[^/]+\.md$/i.test(skill.path));
  localStorage.setItem('webBridge.guidewireSkillsLoaded', String(guidewireSkillsLoaded));
  setSkillStatus(`${skills.length} skill${skills.length === 1 ? '' : 's'} installed`);
  return skills;
}

$('refreshSkills').addEventListener('click', () => {
  refreshSkillList().catch(error => setSkillStatus(`Could not list skills: ${error.message}`));
});

$('viewSkill').addEventListener('click', async () => {
  const path = $('skillList').value;
  if (!path) return setSkillStatus('Select a skill to view');
  try {
    const skill = await send({ command: 'skillsGet', path });
    $('skillPath').value = skillDisplayPath(skill.path);
    $('skillContent').value = skill.content;
    setSkillStatus(`Viewing ${skillDisplayPath(skill.path)}`);
  } catch (error) {
    setSkillStatus(`Could not view skill: ${error.message}`);
  }
});

$('deleteSkill').addEventListener('click', async () => {
  const path = $('skillList').value;
  if (!path) return setSkillStatus('Select a skill to delete');
  const displayPath = skillDisplayPath(path);
  if (!confirm(`Delete ${displayPath}?`)) return;
  try {
    await send({ command: 'skillsDelete', path });
    if ($('skillPath').value === displayPath) {
      $('skillPath').value = '';
      $('skillContent').value = '';
    }
    await refreshSkillList();
    setSkillStatus(`Deleted ${displayPath}`);
  } catch (error) {
    setSkillStatus(`Could not delete skill: ${error.message}`);
  }
});

$('saveSkill').addEventListener('click', async () => {
  const path = $('skillPath').value.trim();
  const content = $('skillContent').value;
  if (!path || !content.trim()) return setSkillStatus('Enter a .md path and skill content');
  try {
    await send({ command: 'skillsImport', path, content });
    await refreshSkillList();
    $('skillList').value = `domain-skills/${path.replaceAll('\\', '/').replace(/^\/+/, '')}`;
    setSkillStatus(`Saved ${path}`);
  } catch (error) {
    setSkillStatus(`Could not save skill: ${error.message}`);
  }
});

$('addSkillFile').addEventListener('click', () => $('skillFile').click());

$('skillFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const content = await file.text();
    await send({ command: 'skillsImport', path: file.name, content });
    await refreshSkillList();
    $('skillList').value = `domain-skills/${file.name}`;
    setSkillStatus(`Added ${file.name}`);
  } catch (error) {
    setSkillStatus(`Could not add skill: ${error.message}`);
  } finally {
    event.target.value = '';
  }
});

$('clearSkillEditor').addEventListener('click', () => {
  $('skillPath').value = '';
  $('skillContent').value = '';
});

// --- automation planner (same logic as the external controller) --------------

function getAllowedAutomationCommands(options = {}) {
  return new Set([
    ...BASE_AUTOMATION_COMMANDS,
    ...(options.guidewire ? GUIDEWIRE_AUTOMATION_COMMANDS : [])
  ]);
}

function hasGuidewireSkills(skills) {
  return guidewireSkillsLoaded || skills.some(skill =>
    /policycenter|guidewire/i.test(`${skill.path || ''}\n${skill.content || ''}`)
  );
}

function parseJsonObject(text) {
  const trimmed = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const repairCommonJsonTypos = value => value
    .replace(/"([A-Za-z_$][\w$]*)\s*:/g, '"$1":')
    .replace(/,\s*([}\]])/g, '$1');
  const parseWithClosers = value => {
    const stack = [];
    let inString = false;
    let escape = false;
    for (const char of value) {
      if (escape) escape = false;
      else if (char === '\\') escape = inString;
      else if (char === '"') inString = !inString;
      else if (!inString && (char === '{' || char === '[')) stack.push(char);
      else if (!inString && char === '}') {
        if (stack.at(-1) === '{') stack.pop();
      } else if (!inString && char === ']') {
        if (stack.at(-1) === '[') stack.pop();
      }
    }
    const suffix = stack.reverse().map(char => char === '{' ? '}' : ']').join('');
    return JSON.parse(value + suffix);
  };
  try {
    return JSON.parse(trimmed);
  } catch (firstError) {
    const repaired = repairCommonJsonTypos(trimmed);
    if (repaired !== trimmed) {
      try { return JSON.parse(repaired); } catch { /* fall through */ }
    }
    const start = trimmed.indexOf('{');
    if (start < 0) throw new Error('LLM response did not contain a JSON object');
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let index = start; index < trimmed.length; index += 1) {
      const char = trimmed[index];
      if (escape) escape = false;
      else if (char === '\\') escape = inString;
      else if (char === '"') inString = !inString;
      else if (!inString && char === '{') depth += 1;
      else if (!inString && char === '}') {
        depth -= 1;
        if (depth === 0) return JSON.parse(trimmed.slice(start, index + 1));
      }
    }
    try {
      return parseWithClosers(repairCommonJsonTypos(trimmed.slice(start)));
    } catch { /* keep original error */ }
    throw firstError;
  }
}

function compactPageContext(page) {
  return {
    url: page?.url,
    title: page?.title,
    pageTitle: page?.pageTitle,
    targetTab,
    controls: (page?.controls || []).slice(0, 45).map(control => ({
      tag: control.tag, type: control.type, id: control.id, name: control.name,
      label: control.label, value: control.value, disabled: control.disabled,
      readonly: control.readonly, options: (control.options || []).slice(0, 12)
    })),
    actions: (page?.actions || []).slice(0, 35).map(action => ({
      id: action.id, text: action.text, tag: action.tag, clickable: action.clickable,
      role: action.role, title: action.title, ariaLabel: action.ariaLabel, className: action.className
    })),
    relatedActions: (page?.relatedActions || []).slice(0, 12).map(action => ({
      id: action.id, text: action.text, visible: action.visible, dataGwClick: action.dataGwClick,
      role: action.role, title: action.title, ariaLabel: action.ariaLabel, className: action.className
    }))
  };
}

function buildAutomationPrompt(userPrompt, page, skills, options = {}) {
  const allowedCommands = getAllowedAutomationCommands(options);
  const guidewireInstructions = options.guidewire
    ? `For Guidewire actions, use gwClick with an exact id from Current page actions or Related actions.
For instructions that mention a down arrow, dropdown, menu, chevron, or expander beside a tab/action, use gwOpenMenu with the exact parent action id.
Add waitNetworkIdle after navigation or Guidewire clicks.`
    : 'Do not use Guidewire-only commands such as gwClick or gwOpenMenu unless the Guidewire skill pack is loaded.';
  return `Convert the user's plain-English browser automation request into AutoBro web-bridge command JSON.
Return only JSON. No markdown.
Allowed shape: {"steps":[{"command":"fillInput","args":["selector","value"]}]}
Use strict JSON: double-quoted property names and strings, no trailing commas, no comments, no prose.
Allowed commands: ${Array.from(allowedCommands).join(', ')}.
Command args must be arrays of primitive values only.
For browser tab requests, use tab commands: "open new tab" -> {"command":"newTab","args":["about:blank"]}; "open URL" -> {"command":"newTab","args":["https://..."]} or gotoUrl for the current tab.
Use exact selectors from Current page controls. For named inputs, use [name="field-name"].
${guidewireInstructions}
Do not invent field names, selectors, action ids, credentials, account numbers, policy numbers, or business values.
Do not submit, save, issue, bind, delete, withdraw, cancel, deactivate, or otherwise mutate data unless the user explicitly requested that action.
Use clickAtXY only when the user provides exact coordinates. Do not use clickAtXY to click browser chrome such as the new-tab button.
Prefer the smallest reliable step list.
Current page: ${JSON.stringify(compactPageContext(page))}
Relevant skills: ${JSON.stringify(skills)}
User request: ${JSON.stringify(userPrompt)}`;
}

function llmContent(payload) {
  const message = payload?.choices?.[0]?.message || {};
  return message.content || message.reasoning_content || payload?.content || '';
}

function actionHaystack(action) {
  return [
    action?.id, action?.text, action?.dataGwClick, action?.role,
    action?.title, action?.ariaLabel, action?.className
  ].filter(Boolean).join(' ').toLowerCase();
}

function extractMenuTargetLabel(userPrompt) {
  const match = String(userPrompt || '').match(
    /\b(?:down\s*arrow|drop\s*down|dropdown|menu|chevron)\b.*?\b(?:beside|next\s+to|near|for|by|of)\b\s+(?:the\s+)?["']?([a-z0-9][a-z0-9 _-]*?)["']?\s*$/i
  );
  return match?.[1]?.replace(/\b(menu|button|tab|arrow|dropdown|drop\s*down)\b/ig, '').trim() || '';
}

function planMenuArrowAutomation(userPrompt, page, options = {}) {
  if (!options.guidewire) return null;
  const label = extractMenuTargetLabel(userPrompt);
  if (!label) return null;
  const labelTokens = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!labelTokens.length) return null;

  const seen = new Set();
  const candidates = [...(page?.relatedActions || []), ...(page?.actions || [])]
    .filter(action => action?.id && !seen.has(action.id) && seen.add(action.id))
    .map(action => {
      const haystack = actionHaystack(action);
      if (!labelTokens.every(token => haystack.includes(token))) return null;
      const id = String(action.id || '');
      const menuScore = /menu|arrow|chevron|drop|popup|submenu|tabbar|tab/i.test(haystack) ? 20 : 0;
      const navScore = /^TabBar-|TabBar|MenuLinks|MenuActions|Tab$|Tab_/.test(id) ? 45 : 0;
      const classScore = /Menu|Popup|TabBar|Chevron|Arrow/.test(String(action.className || id)) ? 12 : 0;
      const pageContentPenalty = /viewMore|Dashboard|Chart|Tile|Summary|LV-|Cell|Header|Widget/i.test(id) ? 45 : 0;
      const text = String(action.text || '').trim().toLowerCase();
      const visibleScore = action.visible === false ? -35 : 35;
      const exactTextBonus = text === label.toLowerCase() ? 25 : 0;
      const hiddenSubmenuPenalty = action.visible === false && /^TabBar-.*_/.test(id) ? 35 : 0;
      const relatedScore = Number(action.score || 0);
      return { action, score: navScore + menuScore + classScore + visibleScore + exactTextBonus + relatedScore - hiddenSubmenuPenalty - pageContentPenalty };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0]?.action;
  if (!best) return null;
  return {
    targetTab,
    source: 'menu-arrow heuristic',
    steps: [
      { command: 'gwOpenMenu', args: [best.id], tabId: targetTab?.tabId },
      { command: 'waitNetworkIdle', args: [10, 600], tabId: targetTab?.tabId }
    ]
  };
}

function planBrowserTabAutomation(userPrompt) {
  const text = String(userPrompt || '').trim();
  const urlMatch = text.match(/\b(?:open|create)\s+(?:a\s+)?new\s+tab\s+(?:to|for|with|at)?\s*(https?:\/\/\S+)/i)
    || text.match(/\bopen\s+(https?:\/\/\S+)\s+(?:in\s+)?(?:a\s+)?new\s+tab\b/i);
  if (urlMatch) {
    return { targetTab, source: 'browser-tab heuristic', steps: [{ command: 'newTab', args: [urlMatch[1]] }] };
  }
  if (/^\s*(?:open|create)\s+(?:a\s+)?new\s+tab\s*$/i.test(text)) {
    return { targetTab, source: 'browser-tab heuristic', steps: [{ command: 'newTab', args: ['about:blank'] }] };
  }
  return null;
}

function validGwClickIds(page) {
  return new Set([
    ...(page?.actions || []).map(action => action.id),
    ...(page?.relatedActions || []).map(action => action.id)
  ].filter(Boolean));
}

function normalizeAutomation(value, page = null, options = {}) {
  const allowedCommands = getAllowedAutomationCommands(options);
  const gwClickIds = validGwClickIds(page);
  const rawSteps = Array.isArray(value?.steps) ? value.steps : [value];
  const steps = rawSteps.map(step => {
    if (!step || typeof step !== 'object') throw new Error('Automation step must be an object');
    if (!allowedCommands.has(step.command)) throw new Error(`Command not allowed: ${step.command}`);
    const args = step.args === undefined ? [] : step.args;
    if (!Array.isArray(args)) throw new Error(`args must be an array for ${step.command}`);
    for (const arg of args) {
      if (!['string', 'number', 'boolean'].includes(typeof arg) && arg !== null) {
        throw new Error(`Unsupported argument type for ${step.command}`);
      }
    }
    if (step.command === 'gwClick' || step.command === 'gwOpenMenu') {
      const target = String(args[0] || '');
      if (!target || target.length < 8 || !target.includes('-')) {
        throw new Error(`${step.command} requires an exact page action id, not ${JSON.stringify(target)}`);
      }
      if (gwClickIds.size && !gwClickIds.has(target)) {
        throw new Error(`${step.command} target is not in current page actions: ${target}`);
      }
    }
    const normalized = { command: step.command, args };
    if ((TAB_SCOPED_COMMANDS.has(step.command) || GUIDEWIRE_AUTOMATION_COMMANDS.includes(step.command)) && targetTab?.tabId) {
      normalized.tabId = targetTab.tabId;
    }
    return normalized;
  });
  if (!steps.length) throw new Error('Automation plan has no steps');
  const usesTargetTab = steps.some(step => TAB_SCOPED_COMMANDS.has(step.command) || GUIDEWIRE_AUTOMATION_COMMANDS.includes(step.command));
  // waitNetworkIdle only sees requests started after the CDP debugger is
  // attached — attach up front (gw-click-and-wait-patterns, "Attach First").
  if (usesTargetTab && targetTab?.tabId
    && steps.some(step => step.command === 'waitNetworkIdle')
    && !steps.some(step => step.command === 'attach')) {
    steps.unshift({ command: 'attach', tabId: targetTab.tabId });
  }
  return { targetTab: usesTargetTab ? targetTab : null, steps };
}

function planHasRiskyAction(plan) {
  return plan.steps.some(step => (step.command === 'gwClick' || step.command === 'gwOpenMenu') && RISKY_ACTION_RE.test(String(step.args?.[0] || '')));
}

async function refreshTargetTab() {
  const tabs = await send({ command: 'listTabs', args: [false] });
  const tab = (tabs || [])[0];
  if (!tab?.tabId) throw new Error('No normal HTTP/HTTPS target tab found');
  targetTab = tab;
  setAutomationStatus(`Target: ${tab.title || tab.url} (${tab.tabId})`);
  return tab;
}

async function loadSkillContext(userPrompt) {
  const payload = await send({ command: 'skills', q: userPrompt, limit: 2, maxChars: 1800 }).catch(() => null);
  const skills = Array.isArray(payload?.skills) ? payload.skills : Array.isArray(payload) ? payload : [];
  return skills.map(skill => ({
    path: skill.path,
    content: String(skill.content || '').slice(0, 1800)
  }));
}

async function askLlmForAutomation(userPrompt) {
  const browserTabPlan = planBrowserTabAutomation(userPrompt);
  if (browserTabPlan) return normalizeAutomation(browserTabPlan, null, { guidewire: false });
  const tab = await refreshTargetTab();
  const page = await send({ command: 'inventoryCurrentPage', tabId: tab.tabId });
  const relatedActions = await send({
    command: 'relatedActions', args: [userPrompt, 12], tabId: tab.tabId
  }).catch(() => []);
  const pageContext = { ...page, relatedActions };
  const skills = await loadSkillContext(userPrompt);
  const guidewire = hasGuidewireSkills(skills);
  const automationOptions = { guidewire };
  const heuristicPlan = planMenuArrowAutomation(userPrompt, pageContext, automationOptions);
  if (heuristicPlan) return normalizeAutomation(heuristicPlan, pageContext, automationOptions);
  const request = {
    command: 'llmChatCompletions',
    body: {
      temperature: 0,
      max_tokens: 1200,
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: 'You produce browser automation JSON. Output only the final JSON object.' },
        { role: 'user', content: buildAutomationPrompt(userPrompt, pageContext, skills, automationOptions) }
      ]
    },
    timeoutMs: 120000
  };

  const payload = await send(request);
  const content = llmContent(payload);
  if (!content) throw new Error('LLM returned no content');
  try {
    return normalizeAutomation(parseJsonObject(content), pageContext, automationOptions);
  } catch (parseError) {
    const repairedPayload = await send({
      ...request,
      body: {
        temperature: 0,
        max_tokens: 800,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          { role: 'system', content: 'Repair malformed automation output. Return only strict valid JSON matching {"steps":[{"command":"...","args":[]}]} with no markdown or prose.' },
          {
            role: 'user',
            content: JSON.stringify({
              parseError: parseError.message,
              allowedCommands: Array.from(getAllowedAutomationCommands(automationOptions)),
              userRequest: userPrompt,
              currentPage: compactPageContext(pageContext),
              malformedOutput: content
            })
          }
        ]
      }
    });
    const repaired = llmContent(repairedPayload);
    if (!repaired) throw parseError;
    try {
      return normalizeAutomation(parseJsonObject(repaired), pageContext, automationOptions);
    } catch (repairError) {
      throw new Error(`LLM returned invalid JSON after repair: ${repairError.message}. Raw: ${repaired.slice(0, 300)}`);
    }
  }
}

$('refreshTarget').addEventListener('click', async () => {
  try {
    await refreshTargetTab();
  } catch (error) {
    setAutomationStatus(`Target failed: ${error.message}`);
  }
});

$('planAutomation').addEventListener('click', async () => {
  const userPrompt = $('automationPrompt').value.trim();
  if (!userPrompt) return setAutomationStatus('Enter an automation prompt first');
  plannedAutomation = null;
  riskyRunArmed = false;
  setAutomationStatus('Planning...');
  showPlan('Planning...');
  try {
    const plan = await askLlmForAutomation(userPrompt);
    plannedAutomation = plan;
    showPlan(plan);
    setAutomationStatus(`Plan ready: ${plan.steps.length} step(s) for tab ${plan.targetTab?.tabId}`);
  } catch (error) {
    showPlan(`error: ${error.message}`);
    setAutomationStatus('Planning failed');
  }
});

$('runAutomation').addEventListener('click', async () => {
  if (!plannedAutomation) return setAutomationStatus('Plan first');
  // window.confirm is unreliable in side panels — use a two-click confirm.
  if (planHasRiskyAction(plannedAutomation) && !riskyRunArmed) {
    riskyRunArmed = true;
    return setAutomationStatus('Plan includes a potentially mutating action — click Run again to confirm');
  }
  riskyRunArmed = false;
  setAutomationStatus(`Running ${plannedAutomation.steps.length} step(s)...`);
  try {
    const results = [];
    for (const step of plannedAutomation.steps) {
      results.push({ request: step, result: await send(step) });
    }
    show(results);
    setAutomationStatus('Run complete');
  } catch (error) {
    show(`error: ${error.message}`);
    setAutomationStatus('Run failed');
  }
});

// --- chat --------------------------------------------------------------------
// Free-form Q&A against the WebGPU model, separate from the automation flow:
// no command schema, no JSON parsing — the raw model text is shown. Keeps a
// running conversation so follow-ups have context.

const chatMessages = [];
let chatBusy = false;
let stopVoice = null;
let voiceBusy = false;

function renderChatLog() {
  const log = $('chatLog');
  log.innerHTML = '';
  for (const message of chatMessages) {
    const row = document.createElement('div');
    row.style.margin = '.35rem 0';
    const who = document.createElement('strong');
    who.textContent = message.role === 'user' ? 'You: ' : 'Model: ';
    who.style.color = message.role === 'user' ? 'inherit' : 'var(--teal, #0a7)';
    const body = document.createElement('span');
    body.style.whiteSpace = 'pre-wrap';
    body.textContent = message.content;
    row.append(who, body);
    log.append(row);
  }
  log.scrollTop = log.scrollHeight;
}

// Stream a completion over a dedicated port; onChunk fires per token batch.
function streamChat(messages, onChunk) {
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: 'web-bridge-ui-stream' });
    let settled = false;
    const finish = (fn, arg) => { if (!settled) { settled = true; try { port.disconnect(); } catch { /* */ } fn(arg); } };
    port.onMessage.addListener(message => {
      if (message.type === 'chunk') onChunk(message.text);
      else if (message.type === 'done') finish(resolve);
      else if (message.type === 'error') finish(reject, new Error(message.error));
    });
    port.onDisconnect.addListener(() => finish(reject, new Error('stream disconnected')));
    port.postMessage({ type: 'chat', body: { messages } });
  });
}

async function sendChat() {
  if (chatBusy) return;
  const text = $('chatInput').value.trim();
  if (!text) return;
  chatBusy = true;
  $('chatSend').disabled = true;
  chatMessages.push({ role: 'user', content: text });
  const messagesToSend = chatMessages.slice(); // history incl. this user turn
  const assistant = { role: 'assistant', content: '' };
  chatMessages.push(assistant); // filled incrementally as tokens stream in
  $('chatInput').value = '';
  renderChatLog();
  $('chatStatus').textContent = 'thinking…';
  const started = performance.now();
  try {
    await streamChat(messagesToSend, chunk => {
      assistant.content += chunk;
      renderChatLog();
    });
    if (!assistant.content) assistant.content = '(no content)';
    renderChatLog();
    $('chatStatus').textContent = `streamed · ${((performance.now() - started) / 1000).toFixed(1)}s`;
    if ($('chatRaw').checked) show({ role: 'assistant', content: assistant.content });
  } catch (error) {
    chatMessages.pop(); // assistant placeholder
    chatMessages.pop(); // user turn — clean retry
    renderChatLog();
    $('chatStatus').textContent = `error: ${error.message}`;
  } finally {
    chatBusy = false;
    $('chatSend').disabled = false;
  }
}

async function stopVoiceInput() {
  if (!stopVoice) return;
  const stop = stopVoice;
  stopVoice = null;
  $('voiceToggle').textContent = 'Start voice';
  setVoiceStatus('voice: stopping...');
  try {
    await stop();
    setVoiceStatus('voice: idle');
  } catch (error) {
    setVoiceStatus(`voice stop error: ${error.message}`);
  }
}

async function startVoiceInput() {
  if (voiceBusy || stopVoice) return;
  voiceBusy = true;
  $('voiceToggle').disabled = true;
  setVoiceStatus('voice: loading Moonshine...');
  try {
    stopVoice = await startDictation({
      onUpdate: text => {
        if (text?.trim()) {
          $('chatInput').value = text.trim();
          setVoiceStatus('voice: listening...');
        }
      },
      onCommit: async text => {
        const clean = text?.trim();
        if (!clean) return;
        $('chatInput').value = clean;
        setVoiceStatus(`voice: heard "${clean}"`);
        if ($('voiceAutoSend').checked && !chatBusy) await sendChat();
      },
      onError: error => {
        setVoiceStatus(`voice error: ${error.message}`);
      }
    });
    $('voiceToggle').textContent = 'Stop voice';
    setVoiceStatus('voice: listening...');
  } catch (error) {
    stopVoice = null;
    $('voiceToggle').textContent = 'Start voice';
    setVoiceStatus(`voice error: ${error.message}`);
  } finally {
    voiceBusy = false;
    $('voiceToggle').disabled = false;
  }
}

$('voiceToggle').addEventListener('click', () => {
  if (stopVoice) stopVoiceInput();
  else startVoiceInput();
});

window.addEventListener('beforeunload', () => {
  if (stopVoice) stopVoice().catch(() => undefined);
});

$('chatSend').addEventListener('click', sendChat);
$('chatInput').addEventListener('keydown', event => {
  // Enter sends; Shift+Enter inserts a newline.
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendChat();
  }
});
$('chatClear').addEventListener('click', () => {
  chatMessages.length = 0;
  renderChatLog();
  $('chatStatus').textContent = '';
});

// --- command console ---------------------------------------------------------

$('send').addEventListener('click', async () => {
  try {
    const raw = $('payload').value.trim();
    if (!raw.startsWith('{') && !raw.startsWith('[')) {
      $('automationPrompt').value = raw;
      setAutomationStatus('Moved plain text to Automation prompt. Click Plan.');
      show('Plain text belongs in Automation prompt, not the JSON command console.');
      return;
    }
    show(await send(JSON.parse(raw)));
  } catch (error) {
    show(`error: ${error.message}`);
  }
});

$('screenshot').addEventListener('click', async () => {
  try {
    const result = await send({ command: 'captureScreenshot' });
    const img = $('shot');
    img.src = `data:${result.mimeType};base64,${result.data}`;
    img.style.display = 'block';
    show({ mimeType: result.mimeType, bytes: Math.round(result.data.length * 0.75) });
  } catch (error) {
    show(`error: ${error.message}`);
  }
});

for (const button of document.querySelectorAll('button[data-cmd]')) {
  button.addEventListener('click', () => {
    $('payload').value = button.dataset.cmd;
    $('send').click();
  });
}

// --- window mode ---------------------------------------------------------------

// The same panel serves the side panel and the popup window; offer whichever
// surface the user is NOT currently in.
(async () => {
  const button = $('openWindow');
  let inPopup = false;
  try {
    inPopup = (await chrome.windows.getCurrent())?.type === 'popup';
  } catch { /* default to side-panel assumption */ }

  if (inPopup) {
    button.textContent = 'Open side panel ⇥';
    button.title = 'Dock this panel in the browser side panel (closes this window)';
    button.addEventListener('click', async () => {
      try {
        const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
        await chrome.sidePanel.open({ windowId: win.id });
        window.close(); // the two surfaces are mutually exclusive
      } catch (error) {
        $('engineStatus').textContent = `side panel: ${error.message}`;
      }
    });
  } else {
    button.textContent = 'Open as window ⧉';
    button.title = 'Open this panel as a draggable, resizable window (closes the side panel)';
    button.addEventListener('click', async () => {
      // Route through the SW so it reuses the singleton + saved position/size,
      // then close this side panel so only one surface is shown.
      try { await send({ command: 'openPanelWindow' }); } catch { /* ignore */ }
      window.close();
    });
  }
})();

// --- one-click pairing fallback ---------------------------------------------
// The extension can also try a native OS notification for this (see
// external-messaging.js), but that pipeline has been observed to silently
// no-op in some environments. Polling here means approving a pairing request
// only ever depends on this panel rendering, which Chrome always does.
let lastPairingOrigin = null;
async function pollPendingPairing() {
  let origin = null;
  try { ({ origin } = await send({ command: 'checkPendingPairing' })); } catch { return; }
  if (origin === lastPairingOrigin) return;
  lastPairingOrigin = origin;
  $('pairingRequest').style.display = origin ? 'flex' : 'none';
  if (origin) $('pairingRequestText').textContent = `${origin} wants to pair with this browser.`;
}
$('pairingApprove').addEventListener('click', async () => {
  try { await send({ command: 'respondPairing', approve: true }); } catch { /* ignore */ }
  $('pairingRequest').style.display = 'none';
  lastPairingOrigin = null;
});
$('pairingDeny').addEventListener('click', async () => {
  try { await send({ command: 'respondPairing', approve: false }); } catch { /* ignore */ }
  $('pairingRequest').style.display = 'none';
  lastPairingOrigin = null;
});
pollPendingPairing();
setInterval(pollPendingPairing, 1000);

refreshHealth();
refreshSkillList().catch(error => setSkillStatus(`Could not list skills: ${error.message}`));
showPairingToken().catch(error => { $('pairingToken').value = `error: ${error.message}`; });
setInterval(refreshHealth, 15000);
