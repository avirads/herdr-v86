// In-browser port of the Go bridge's GET /skills (server.go:568-665).
// Skill markdown lives in OPFS under /domain-skills; the side panel imports
// files there. Search is the same token-containment scoring.

const SKILLS_DIR = 'domain-skills';
const DISABLED_SKILLS_KEY = 'webBridgeDisabledSkills';

const storageGet = key => new Promise(resolve => chrome.storage.local.get(key, resolve));
const storageSet = value => new Promise(resolve => chrome.storage.local.set(value, resolve));

function tokenize(value) {
  return (value.toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => t.length > 2);
}

function skillScore(haystack, query) {
  const lower = haystack.toLowerCase();
  return tokenize(query).reduce((score, token) => score + (lower.includes(token) ? 1 : 0), 0);
}

async function* walk(dir, prefix = '') {
  for await (const [name, handle] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'directory') yield* walk(handle, path);
    else if (name.toLowerCase().endsWith('.md')) yield { path, handle };
  }
}

async function skillsRoot(create = false) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(SKILLS_DIR, { create });
}

function skillParts(path) {
  const normalized = String(path || '').replaceAll('\\', '/').replace(/^\/+/, '')
    .replace(new RegExp(`^${SKILLS_DIR}/`), '');
  const parts = normalized.split('/');
  if (!normalized.toLowerCase().endsWith('.md') ||
      parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('Skill path must be a safe relative .md path');
  }
  return parts;
}

function canonicalSkillPath(path) {
  return `${SKILLS_DIR}/${skillParts(path).join('/')}`;
}

async function disabledSkills() {
  const stored = await storageGet(DISABLED_SKILLS_KEY);
  return new Set(Array.isArray(stored[DISABLED_SKILLS_KEY]) ? stored[DISABLED_SKILLS_KEY] : []);
}

export async function setSkillLoaded(path, loaded) {
  const canonical = canonicalSkillPath(path);
  await getSkill(canonical);
  const disabled = await disabledSkills();
  if (loaded) disabled.delete(canonical);
  else disabled.add(canonical);
  await storageSet({ [DISABLED_SKILLS_KEY]: [...disabled].sort() });
  return { path: canonical, loaded: loaded === true };
}

export async function importSkill(path, content) {
  const dir = await skillsRoot(true);
  const parts = skillParts(path);
  let current = dir;
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  const file = await current.getFileHandle(parts.at(-1), { create: true });
  const writable = await file.createWritable();
  await writable.write(content);
  await writable.close();
  await setSkillLoaded(path, true);
}

export async function getSkill(path) {
  const parts = skillParts(path);
  let current = await skillsRoot();
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part);
  }
  const handle = await current.getFileHandle(parts.at(-1));
  const canonical = `${SKILLS_DIR}/${parts.join('/')}`;
  const disabled = await disabledSkills();
  return { path: canonical, content: await (await handle.getFile()).text(), loaded: !disabled.has(canonical) };
}

export async function listSkills(maxChars = 0) {
  let dir;
  try {
    dir = await skillsRoot();
  } catch {
    return [];
  }
  const disabled = await disabledSkills();
  const skills = [];
  for await (const { path, handle } of walk(dir)) {
    let content = await (await handle.getFile()).text();
    if (maxChars >= 0 && content.length > maxChars) content = content.slice(0, maxChars);
    const canonical = `${SKILLS_DIR}/${path}`;
    skills.push({ path: canonical, content, loaded: !disabled.has(canonical) });
  }
  skills.sort((a, b) => a.path.localeCompare(b.path));
  return skills;
}

export async function loadSkills(query = '', limit = 4, maxChars = 6000) {
  const skills = [];
  for (const skill of await listSkills(-1)) {
    if (!skill.loaded) continue;
    let { content } = skill;
    const { path } = skill;
    const score = skillScore(`${path}\n${content}`, query);
    if (query && score === 0) continue;
    if (maxChars >= 0 && content.length > maxChars) content = content.slice(0, maxChars);
    skills.push({ path, score, content, loaded: true });
  }
  skills.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return skills.slice(0, Math.max(0, limit));
}
