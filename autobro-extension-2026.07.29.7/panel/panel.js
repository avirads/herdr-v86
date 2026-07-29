// Merged Web Bridge panel: controller console + automation planner. Its LLM
// is provided by the paired Herdr page (no extension-local model). Runs as the
// side panel and as a draggable popup window ("Open as window").
//
// Talks to the service worker via internal messaging (source 'web-bridge-ui')
// — extension pages are trusted, so no pairing token is involved. Skill packs
// are loaded from user-selected ZIP files. The authenticated Herdr provider
// handles automation planning.

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
let plannedSkillPath = null;

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

if (guidewireSkillsLoaded) setSkillStatus('Guidewire PolicyCenter skills previously loaded');

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
    const manifestText = entries.get(`${root}manifest.json`);
    const manifest = manifestText ? JSON.parse(manifestText) : null;
    if (manifest && (typeof manifest.name !== 'string' || typeof manifest.version !== 'string')) {
      throw new Error('manifest.json requires string name and version fields');
    }
    if (manifest?.skillCount !== undefined && manifest.skillCount !== index.length) {
      throw new Error(`manifest skillCount ${manifest.skillCount} does not match index count ${index.length}`);
    }
    const packLabel = manifest
      ? `${manifest.displayName || manifest.name} v${manifest.version}`
      : file.name;
    let imported = 0;
    for (const path of index) {
      const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '');
      if (normalized.includes('../')) throw new Error(`Unsafe skill path: ${path}`);
      const content = entries.get(`${root}skills/${normalized}`);
      if (content === undefined) throw new Error(`Missing ZIP entry: skills/${normalized}`);
      setSkillStatus(`Loading ${packLabel}: ${imported + 1}/${index.length}`);
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
    setSkillStatus(`${packLabel} loaded: ${imported} skills`);
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
  const selected = select.value;
  const skills = await send({ command: 'skillsList', maxChars: 0 });
  select.replaceChildren();
  for (const skill of skills) {
    const option = document.createElement('option');
    option.value = skill.path;
    option.textContent = `${skill.loaded ? 'Loaded' : 'Unloaded'} — ${skillDisplayPath(skill.path)}`;
    option.dataset.loaded = String(skill.loaded);
    select.append(option);
  }
  if (!skills.length) {
    select.append(new Option('No skills installed', ''));
  }
  if (selected && [...select.options].some(option => option.value === selected)) select.value = selected;
  guidewireSkillsLoaded = skills.some(skill =>
    skill.loaded && /(^|\/)policycenter-[^/]+\.md$/i.test(skill.path)
  );
  localStorage.setItem('webBridge.guidewireSkillsLoaded', String(guidewireSkillsLoaded));
  setSkillStatus(`${skills.length} skill${skills.length === 1 ? '' : 's'} installed`);
  await showSelectedSkill();
  return skills;
}

$('refreshSkills').addEventListener('click', () => {
  refreshSkillList().catch(error => setSkillStatus(`Could not list skills: ${error.message}`));
});

async function showSelectedSkill() {
  const path = $('skillList').value;
  if (!path) {
    $('automationPrompt').value = '';
    return;
  }
  try {
    const skill = await send({ command: 'skillsGet', path });
    $('automationPrompt').value = skill.content;
    setSkillStatus(`${skill.loaded ? 'Loaded' : 'Unloaded'} — viewing ${skillDisplayPath(skill.path)}`);
  } catch (error) {
    $('automationPrompt').value = '';
    setSkillStatus(`Could not view skill: ${error.message}`);
  }
}

$('skillList').addEventListener('change', () => {
  showSelectedSkill().catch(error => setSkillStatus(`Could not view skill: ${error.message}`));
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
    const rawArgs = step.args === undefined ? [] : step.args;
    if (!Array.isArray(rawArgs)) throw new Error(`args must be an array for ${step.command}`);
    const args = rawArgs.map(arg =>
      typeof arg === 'string'
        ? arg.replace(/<timestamp suffix>/gi, String(Date.now()).slice(-8))
        : arg
    );
    for (const arg of args) {
      if (!['string', 'number', 'boolean'].includes(typeof arg) && arg !== null) {
        throw new Error(`Unsupported argument type for ${step.command}`);
      }
      if (typeof arg === 'string' && /<[^>]+>/.test(arg)) {
        throw new Error(`Unresolved placeholder in ${step.command}: ${JSON.stringify(arg)}`);
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
  return { targetTab: usesTargetTab || options.guidewire ? targetTab : null, steps, logoutAfterRun: options.guidewire === true };
}

function planHasRiskyAction(plan) {
  return plan.steps.some(step => (step.command === 'gwClick' || step.command === 'gwOpenMenu') && RISKY_ACTION_RE.test(String(step.args?.[0] || '')));
}

async function refreshTargetTab() {
  const tabs = await send({ command: 'listTabs', args: [false] });
  const candidates = tabs || [];
  const tab = candidates.find(candidate => {
    try {
      return new URL(candidate.url).hostname.replace(/^www\./, '') !== 'fapstaff.com';
    } catch {
      return true;
    }
  }) || candidates[0];
  if (!tab?.tabId) throw new Error('No normal HTTP/HTTPS target tab found');
  targetTab = tab;
  const targetLabel = String(tab.title || tab.url || '')
    .replace(/https?:\/\/(?:www\.)?fapstaff\.com\/plu\/?/gi, 'https://fapstaff.com/')
    .replace(/(?:www\.)?fapstaff\.com\/plu\/?/gi, 'fapstaff.com/');
  setAutomationStatus(`Target: ${targetLabel} (${tab.tabId})`);
  return tab;
}

async function loadLoginSkill() {
  const installed = await send({ command: 'skillsList', maxChars: 0 });
  const match = installed.find(skill => /policycenter-login-session-health\.md$/i.test(skill.path));
  if (!match?.path) throw new Error('Guidewire login/session skill is not installed');
  const skill = await send({ command: 'skillsGet', path: match.path });
  if (!skill.loaded) throw new Error('Guidewire login/session skill is unloaded');
  return { path: skill.path, content: String(skill.content || '').slice(0, 4000) };
}

async function prepareAutomationTab({ guidewire = false } = {}) {
  const sourceTab = await refreshTargetTab();
  if (!/^https?:/i.test(sourceTab.url || '')) throw new Error('Automation requires an HTTP/HTTPS application tab');
  const created = await send({ command: 'newTab', args: [sourceTab.url] });
  if (!created?.tabId) throw new Error('Could not create a fresh automation tab');
  targetTab = created;
  await send({ command: 'waitForLoad', args: [20], tabId: created.tabId });
  if (!guidewire) return { tab: created, loginSkill: null };

  const loginSkill = await loadLoginSkill();
  const login = await send({ command: 'loginStatus', tabId: created.tabId });
  if (login?.loginForm) {
    const hostname = new URL(created.url || sourceTab.url).hostname;
    if (!['localhost', '127.0.0.1'].includes(hostname)) {
      throw new Error('Login is required; the login skill forbids automatic credentials outside local development');
    }
    const result = await send({ command: 'localLogin', args: ['su', 'gw'], tabId: created.tabId });
    if (result?.finalStatus?.loginForm) throw new Error('Local login did not complete');
  }
  return { tab: created, loginSkill };
}

async function loadSkillContext(userPrompt) {
  const payload = await send({ command: 'skills', q: userPrompt, limit: 2, maxChars: 1800 }).catch(() => null);
  const skills = Array.isArray(payload?.skills) ? payload.skills : Array.isArray(payload) ? payload : [];
  return skills.map(skill => ({
    path: skill.path,
    content: String(skill.content || '').slice(0, 1800)
  }));
}

async function askLlmForAutomation(userPrompt, selectedSkills = []) {
  const browserTabPlan = planBrowserTabAutomation(userPrompt);
  if (browserTabPlan) return normalizeAutomation(browserTabPlan, null, { guidewire: false });
  const skills = selectedSkills.length ? selectedSkills : await loadSkillContext(userPrompt);
  const guidewire = hasGuidewireSkills(skills);
  const prepared = await prepareAutomationTab({ guidewire });
  const tab = prepared.tab;
  if (prepared.loginSkill && !skills.some(skill => skill.path === prepared.loginSkill.path)) {
    skills.unshift(prepared.loginSkill);
  }
  const page = await send({ command: 'inventoryCurrentPage', tabId: tab.tabId });
  const relatedActions = await send({
    command: 'relatedActions', args: [userPrompt, 12], tabId: tab.tabId
  }).catch(() => []);
  const pageContext = { ...page, relatedActions };
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
        { role: 'system', content: 'You produce compact browser automation JSON. Output only one strict JSON object. Never output placeholders in angle brackets.' },
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
        max_tokens: 1600,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          { role: 'system', content: 'Repair malformed automation output. Return one complete, compact, strict JSON object matching {"steps":[{"command":"...","args":[]}]} with no markdown, prose, comments, trailing commas, or angle-bracket placeholders.' },
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
      const retryPayload = await send({
        ...request,
        body: {
          ...request.body,
          max_tokens: 1800,
          messages: [
            { role: 'system', content: 'Return one complete compact strict JSON automation object only. No markdown, prose, comments, trailing commas, or placeholders.' },
            { role: 'user', content: buildAutomationPrompt(userPrompt, pageContext, skills, automationOptions) }
          ]
        }
      });
      const retry = llmContent(retryPayload);
      if (retry) {
        try {
          return normalizeAutomation(parseJsonObject(retry), pageContext, automationOptions);
        } catch { /* report the repair failure below */ }
      }
      throw new Error(`LLM returned invalid JSON after repair and retry: ${repairError.message}. Raw: ${repaired.slice(0, 300)}`);
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
  plannedSkillPath = null;
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

async function executePlannedAutomation() {
  if (!plannedAutomation) return setAutomationStatus('Plan first');
  // window.confirm is unreliable in side panels — use a two-click confirm.
  if (planHasRiskyAction(plannedAutomation) && !riskyRunArmed) {
    riskyRunArmed = true;
    return setAutomationStatus('Plan includes a potentially mutating action — click Run again to confirm');
  }
  riskyRunArmed = false;
  setAutomationStatus(`Running ${plannedAutomation.steps.length} step(s)...`);
  let runFailed = false;
  try {
    const results = [];
    for (const step of plannedAutomation.steps) {
      results.push({ request: step, result: await send(step) });
    }
    show(results);
    setAutomationStatus('Run complete');
  } catch (error) {
    runFailed = true;
    show(`error: ${error.message}`);
    setAutomationStatus('Run failed');
  } finally {
    if (plannedAutomation.logoutAfterRun && plannedAutomation.targetTab?.tabId) {
      try {
        const logout = await send({ command: 'gwLogout', tabId: plannedAutomation.targetTab.tabId });
        if (!logout?.fired) throw new Error(logout?.reason || 'logout action not found');
        await send({ command: 'waitForLoad', args: [15], tabId: plannedAutomation.targetTab.tabId }).catch(() => undefined);
        setAutomationStatus(runFailed ? 'Run failed; logged out' : 'Run complete; logged out');
      } catch (logoutError) {
        setAutomationStatus(`${runFailed ? 'Run failed' : 'Run complete'}; logout failed: ${logoutError.message}`);
      }
    }
  }
}

$('runAutomation').addEventListener('click', executePlannedAutomation);

$('runSkill').addEventListener('click', async () => {
  const path = $('skillList').value;
  if (!path) return setSkillStatus('Select a skill to run');
  if (plannedSkillPath === path && plannedAutomation) {
    await executePlannedAutomation();
    return;
  }
  plannedAutomation = null;
  plannedSkillPath = null;
  riskyRunArmed = false;
  setSkillStatus(`Planning ${skillDisplayPath(path)}…`);
  setAutomationStatus('Planning selected skill…');
  showPlan('Planning…');
  try {
    const skill = await send({ command: 'skillsGet', path });
    if (!skill.loaded) {
      setSkillStatus(`Load ${skillDisplayPath(path)} before running it`);
      return;
    }
    const request = `Run the workflow defined by the selected installed skill ${JSON.stringify(skillDisplayPath(path))}.
Follow its safety rules and use the live page state. Do not invent missing business values.
The selected skill text is already supplied as skill context.`;
    const plan = await askLlmForAutomation(request, [{
      path: skill.path,
      content: String(skill.content || '').slice(0, 6000)
    }]);
    plannedAutomation = plan;
    plannedSkillPath = path;
    showPlan(plan);
    setSkillStatus(`Running ${skillDisplayPath(path)}`);
    await executePlannedAutomation();
  } catch (error) {
    showPlan(`error: ${error.message}`);
    setSkillStatus(`Could not run skill: ${error.message}`);
    setAutomationStatus('Selected skill failed');
  }
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
        setAutomationStatus(`Side panel failed: ${error.message}`);
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

refreshSkillList().catch(error => setSkillStatus(`Could not list skills: ${error.message}`));
